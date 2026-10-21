package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"pulsenoc/backend/internal/database"
	"pulsenoc/backend/internal/models"
	"pulsenoc/backend/internal/storage"
)

type DatabasesHandler struct {
	store *storage.PostgresStore
}

func NewDatabasesHandler(store *storage.PostgresStore) *DatabasesHandler {
	return &DatabasesHandler{store: store}
}

func (h *DatabasesHandler) GetAllDatabases(w http.ResponseWriter, r *http.Request) {
	dbs, err := h.store.GetAllDatabases(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	// Dynamic background telemetry probe
	for i := range dbs {
		adapter, err := h.getAdapter(&dbs[i])
		if err == nil {
			ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
			stats, err := adapter.GetTelemetry(ctx)
			cancel()
			_ = adapter.Close()

			if err == nil {
				dbs[i].Status = "ONLINE"
				dbs[i].LatencyMs = stats.LatencyMs
				dbs[i].Connections = stats.ActiveConnections
			} else {
				dbs[i].Status = "DEGRADED"
			}
		}
	}

	writeJSON(w, http.StatusOK, dbs)
}

func (h *DatabasesHandler) CreateDatabase(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name     string  `json:"name"`
		Engine   string  `json:"engine"`
		Host     string  `json:"host"`
		Port     int     `json:"port"`
		Database string  `json:"database"`
		Username string  `json:"username"`
		Password *string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}

	db := &models.DatabaseConnection{
		ID:          fmt.Sprintf("db-%s", uuid.New().String()[:8]),
		Name:        body.Name,
		Engine:      body.Engine,
		Host:        body.Host,
		Port:        body.Port,
		Database:    body.Database,
		Username:    body.Username,
		Password:    body.Password,
		Status:      "ONLINE",
		LatencyMs:   2,
		Connections: 1,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if err := h.store.CreateDatabase(r.Context(), db); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusCreated, db)
}

func (h *DatabasesHandler) TestConnection(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Engine string `json:"engine"`
		Host   string `json:"host"`
		Port   int    `json:"port"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}

	start := time.Now()
	addr := net.JoinHostPort(body.Host, fmt.Sprintf("%d", body.Port))
	conn, err := net.DialTimeout("tcp", addr, 4*time.Second)
	latency := int(time.Since(start).Milliseconds())

	if err != nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"success":   false,
			"latencyMs": latency,
			"message":   fmt.Sprintf("Connection test failed for %s at %s: %v", body.Engine, addr, err),
		})
		return
	}
	_ = conn.Close()

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success":   true,
		"latencyMs": latency,
		"message":   fmt.Sprintf("Successfully connected to target %s engine at %s", body.Engine, addr),
	})
}

func (h *DatabasesHandler) GetTables(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	db, err := h.store.GetDatabaseByID(r.Context(), id)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "Database not found"})
		return
	}

	adapter, err := h.getAdapter(db)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": fmt.Sprintf("Failed to initialize %s adapter: %v", db.Engine, err)})
		return
	}
	defer adapter.Close()

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	tables, err := adapter.ListTables(ctx)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": fmt.Sprintf("Failed to list tables: %v", err)})
		return
	}
	writeJSON(w, http.StatusOK, tables)
}

func (h *DatabasesHandler) GetTableData(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	tableName := chi.URLParam(r, "tableName")

	db, err := h.store.GetDatabaseByID(r.Context(), id)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "Database not found"})
		return
	}

	adapter, err := h.getAdapter(db)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer adapter.Close()

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	data, err := adapter.GetTableData(ctx, tableName, 25)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, data)
}

func (h *DatabasesHandler) ExecuteQuery(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var body struct {
		Query string `json:"query"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}

	db, err := h.store.GetDatabaseByID(r.Context(), id)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "Database not found"})
		return
	}

	adapter, err := h.getAdapter(db)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer adapter.Close()

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	res, err := adapter.ExecuteQuery(ctx, body.Query)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, res)
}

func (h *DatabasesHandler) DeleteDatabase(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.store.DeleteDatabase(r.Context(), id); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *DatabasesHandler) getAdapter(db *models.DatabaseConnection) (database.Adapter, error) {
	pwd := ""
	if db.Password != nil {
		pwd = *db.Password
	}

	engine := strings.ToLower(db.Engine)
	switch {
	case strings.Contains(engine, "postgres"):
		return database.NewPostgresAdapter(db.Host, db.Port, db.Database, db.Username, pwd)
	case strings.Contains(engine, "mysql") || strings.Contains(engine, "maria"):
		return database.NewMySQLAdapter(db.Host, db.Port, db.Database, db.Username, pwd)
	case strings.Contains(engine, "redis"):
		return database.NewRedisAdapter(db.Host, db.Port, pwd)
	case strings.Contains(engine, "mongo"):
		return database.NewMongoAdapter(db.Host, db.Port, db.Database, db.Username, pwd)
	default:
		return database.NewPostgresAdapter(db.Host, db.Port, db.Database, db.Username, pwd)
	}
}
