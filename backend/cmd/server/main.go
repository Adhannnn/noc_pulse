package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"pulsenoc/backend/internal/alerting"
	"pulsenoc/backend/internal/api"
	"pulsenoc/backend/internal/auth"
	"pulsenoc/backend/internal/config"
	"pulsenoc/backend/internal/docker"
	"pulsenoc/backend/internal/hardware"
	"pulsenoc/backend/internal/prober"
	"pulsenoc/backend/internal/storage"
	"pulsenoc/backend/internal/websocket"
)

func main() {
	log.Println("==================================================")
	log.Println("🚀 Starting PulseNOC Go Backend (NOC Telemetry)")
	log.Println("==================================================")

	cfg := config.LoadConfig()

	// 1. Storage Layer (PostgreSQL) with startup retry loop to survive container reboot race condition
	var store *storage.PostgresStore
	var err error
	maxRetries := 10
	for attempt := 1; attempt <= maxRetries; attempt++ {
		store, err = storage.NewPostgresStore(cfg.DatabaseURL)
		if err == nil {
			log.Printf("[Storage] PostgreSQL connection pool initialized and verified (attempt %d/%d).", attempt, maxRetries)
			defer store.Close()
			break
		}
		log.Printf("[Storage] Connection attempt %d/%d failed: %v. Retrying in 3s...", attempt, maxRetries, err)
		time.Sleep(3 * time.Second)
	}

	if store == nil {
		log.Printf("[Storage] Warning: Failed to connect to DB at %s after %d retries: %v. Running in degraded state.", cfg.DatabaseURL, maxRetries, err)
	}

	// 2. Auth Service
	authSvc := auth.NewAuthService(cfg.JWTSecret)

	// 3. Realtime WebSocket Hub
	wsHub := websocket.NewHub()
	go wsHub.Run()

	// 4. Background Hardware Telemetry Collector
	hwCollector := hardware.NewHardwareCollector(store, wsHub, cfg.HostTotalRamGB)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go hwCollector.Start(ctx)

	// 5. Automated Alert Dispatcher & Network Prober Engine
	alertDispatcher := alerting.NewAlertDispatcher(store, cfg)
	var proberEng *prober.ProberEngine
	if store != nil {
		proberEng = prober.NewProberEngine(store, wsHub, alertDispatcher)
		go proberEng.Start(ctx)
	}

	// 6. Docker Service
	dockerSvc, err := docker.NewDockerService()
	if err != nil {
		log.Printf("[Docker] Warning: Docker socket client unavailable: %v", err)
	} else {
		log.Println("[Docker] Docker socket client initialized successfully.")
		defer dockerSvc.Close()
	}

	// 7. Chi HTTP Router
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(60 * time.Second))

	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	// Handlers
	authHandler := api.NewAuthHandler(store, authSvc)
	metricsHandler := api.NewMetricsHandler(store, hwCollector)
	monitorsHandler := api.NewMonitorsHandler(store, proberEng)
	databasesHandler := api.NewDatabasesHandler(store)
	dockerHandler := api.NewDockerHandler(dockerSvc)
	miscHandler := api.NewMiscHandler(store)

	// WebSocket endpoint
	r.HandleFunc("/ws", wsHub.ServeWS)
	r.HandleFunc("/socket.io", wsHub.ServeWS)
	r.HandleFunc("/socket.io/", wsHub.ServeWS)

	// Health Check
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"UP","engine":"golang","version":"2.0.0"}`))
	})

	// Public Routes
	r.Post("/api/auth/login", authHandler.Login)

	// Protected Routes
	r.Group(func(protected chi.Router) {
		protected.Use(authSvc.Middleware)

		// Auth & User Management
		protected.Get("/api/auth/users", authHandler.GetAllUsers)
		protected.Post("/api/auth/users", authHandler.CreateUser)
		protected.Put("/api/auth/users/{id}/role", authHandler.UpdateUserRole)
		protected.Delete("/api/auth/users/{id}", authHandler.DeleteUser)

		// Hardware & Metrics
		protected.Get("/api/metrics/history", metricsHandler.GetHistory)
		protected.Get("/api/metrics/server-info", metricsHandler.GetServerInfo)
		protected.Get("/api/metrics/memory-detail", metricsHandler.GetMemoryDetail)
		protected.Get("/api/metrics/processes", metricsHandler.GetProcesses)
		protected.Post("/api/metrics/processes/{pid}/kill", metricsHandler.KillProcess)

		// Monitors & Groups
		protected.Get("/api/monitors", monitorsHandler.GetAllMonitors)
		protected.Post("/api/monitors", monitorsHandler.CreateMonitor)
		protected.Get("/api/monitors/{id}", monitorsHandler.GetMonitorByID)
		protected.Post("/api/monitors/{id}", monitorsHandler.UpdateMonitor)
		protected.Delete("/api/monitors/{id}", monitorsHandler.DeleteMonitor)

		protected.Get("/api/groups", monitorsHandler.GetAllGroups)
		protected.Post("/api/groups", monitorsHandler.CreateGroup)
		protected.Post("/api/monitors/groups/rename", monitorsHandler.RenameGroup)
		protected.Delete("/api/groups/{name}", monitorsHandler.DeleteGroup)
		protected.Get("/api/monitors/incidents/all", monitorsHandler.GetAllIncidents)

		// Multi-Databases (PostgreSQL, MySQL, Redis, MongoDB)
		protected.Get("/api/databases", databasesHandler.GetAllDatabases)
		protected.Post("/api/databases", databasesHandler.CreateDatabase)
		protected.Post("/api/databases/test", databasesHandler.TestConnection)
		protected.Get("/api/databases/{id}/tables", databasesHandler.GetTables)
		protected.Get("/api/databases/{id}/tables/{tableName}", databasesHandler.GetTableData)
		protected.Post("/api/databases/{id}/query", databasesHandler.ExecuteQuery)
		protected.Delete("/api/databases/{id}", databasesHandler.DeleteDatabase)

		// Docker Container Management & Log Streaming
		protected.Get("/api/docker/containers", dockerHandler.ListContainers)
		protected.HandleFunc("/api/docker/containers/{id}/logs", dockerHandler.StreamLogs)

		// Alert Channels
		protected.Get("/api/alerts/channels", miscHandler.GetAllAlertChannels)
		protected.Post("/api/alerts/channels", miscHandler.CreateAlertChannel)
		protected.Delete("/api/alerts/channels/{id}", miscHandler.DeleteAlertChannel)
		protected.Post("/api/alerts/channels/{id}/test", miscHandler.TestAlertChannel)
	})

	server := &http.Server{
		Addr:         fmt.Sprintf(":%s", cfg.Port),
		Handler:      r,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	go func() {
		log.Printf("[Server] PulseNOC Go API listening on port %s", cfg.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[Server] Fatal error: %v", err)
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("[Server] Shutting down gracefully...")
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("[Server] Forced shutdown: %v", err)
	}
	log.Println("[Server] PulseNOC Go Backend stopped.")
}
