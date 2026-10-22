package storage

import (
	"context"
	"fmt"
	"log"
	"net/url"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
	"pulsenoc/backend/internal/models"
)

type PostgresStore struct {
	pool *pgxpool.Pool
}

func sanitizePostgresURL(rawURL string) string {
	u, err := url.Parse(rawURL)
	if err != nil {
		return rawURL
	}
	q := u.Query()
	// Strip Prisma-specific ?schema= parameter (unrecognized by PostgreSQL server)
	if schema := q.Get("schema"); schema != "" {
		q.Del("schema")
		if q.Get("search_path") == "" {
			q.Set("search_path", schema)
		}
	}
	// Default to sslmode=disable if not specified for local/internal connections
	if q.Get("sslmode") == "" {
		q.Set("sslmode", "disable")
	}
	u.RawQuery = q.Encode()
	return u.String()
}

func NewPostgresStore(dbURL string) (*PostgresStore, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cleanedURL := sanitizePostgresURL(dbURL)
	config, err := pgxpool.ParseConfig(cleanedURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse database url: %w", err)
	}

	config.MaxConns = 25
	config.MinConns = 2
	config.MaxConnLifetime = 30 * time.Minute
	config.MaxConnIdleTime = 5 * time.Minute

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("failed to create connection pool: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("database ping failed: %w", err)
	}

	store := &PostgresStore{pool: pool}
	if err := store.autoMigrate(ctx); err != nil {
		log.Printf("[Storage] Auto-migration warning: %v", err)
	}

	if err := store.seedAdmin(ctx); err != nil {
		log.Printf("[Storage] Seed admin warning: %v", err)
	}

	return store, nil
}

func (s *PostgresStore) Close() {
	if s.pool != nil {
		s.pool.Close()
	}
}

func (s *PostgresStore) Pool() *pgxpool.Pool {
	return s.pool
}

func (s *PostgresStore) autoMigrate(ctx context.Context) error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id VARCHAR(64) PRIMARY KEY,
			email VARCHAR(255) UNIQUE NOT NULL,
			name VARCHAR(255) NOT NULL,
			password VARCHAR(255) NOT NULL,
			role VARCHAR(50) DEFAULT 'OPERATOR',
			"createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
			"updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE TABLE IF NOT EXISTS datacenters (
			id VARCHAR(64) PRIMARY KEY,
			name VARCHAR(255) NOT NULL,
			location VARCHAR(255),
			description TEXT,
			"createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
			"updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE TABLE IF NOT EXISTS monitors (
			id VARCHAR(64) PRIMARY KEY,
			name VARCHAR(255) NOT NULL,
			type VARCHAR(50) DEFAULT 'HTTP',
			url TEXT,
			port INT,
			"group" VARCHAR(100) DEFAULT 'Home DC',
			"intervalSec" INT DEFAULT 60,
			"timeoutSec" INT DEFAULT 10,
			"isActive" BOOLEAN DEFAULT true,
			"currentStatus" VARCHAR(50) DEFAULT 'PENDING',
			"uptimePercent24h" DOUBLE PRECISION DEFAULT 100.0,
			"lastProbedAt" TIMESTAMP WITH TIME ZONE,
			"dataCenterId" VARCHAR(64) REFERENCES datacenters(id) ON DELETE SET NULL,
			"createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
			"updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE TABLE IF NOT EXISTS service_groups (
			id VARCHAR(64) PRIMARY KEY,
			name VARCHAR(255) UNIQUE NOT NULL,
			"createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
			"updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE TABLE IF NOT EXISTS heartbeats (
			id VARCHAR(64) PRIMARY KEY,
			"monitorId" VARCHAR(64) NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
			status VARCHAR(50) NOT NULL,
			"latencyMs" INT NOT NULL,
			"statusCode" INT,
			"errorMessage" TEXT,
			timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE INDEX IF NOT EXISTS idx_heartbeats_monitor_time ON heartbeats("monitorId", timestamp DESC);`,
		`CREATE TABLE IF NOT EXISTS incidents (
			id VARCHAR(64) PRIMARY KEY,
			"monitorId" VARCHAR(64) NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
			title VARCHAR(255) NOT NULL,
			description TEXT,
			severity VARCHAR(50) DEFAULT 'CRITICAL',
			status VARCHAR(50) DEFAULT 'INVESTIGATING',
			"startedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
			"resolvedAt" TIMESTAMP WITH TIME ZONE
		);`,
		`CREATE TABLE IF NOT EXISTS alert_channels (
			id VARCHAR(64) PRIMARY KEY,
			name VARCHAR(255) NOT NULL,
			type VARCHAR(50) NOT NULL,
			"webhookUrl" TEXT,
			"chatId" VARCHAR(255),
			"botToken" VARCHAR(255),
			"isEnabled" BOOLEAN DEFAULT true,
			"createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
			"updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE TABLE IF NOT EXISTS host_metrics (
			id VARCHAR(64) PRIMARY KEY,
			"cpuUsage" DOUBLE PRECISION NOT NULL,
			"ramUsedMb" DOUBLE PRECISION NOT NULL,
			"ramTotalMb" DOUBLE PRECISION NOT NULL,
			"diskUsagePct" DOUBLE PRECISION NOT NULL,
			"diskUsedGb" DOUBLE PRECISION NOT NULL,
			"diskTotalGb" DOUBLE PRECISION NOT NULL,
			"diskReadKb" DOUBLE PRECISION DEFAULT 0,
			"diskWriteKb" DOUBLE PRECISION DEFAULT 0,
			"networkInKb" DOUBLE PRECISION NOT NULL,
			"networkOutKb" DOUBLE PRECISION NOT NULL,
			timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE INDEX IF NOT EXISTS idx_host_metrics_time ON host_metrics(timestamp DESC);`,
		`CREATE TABLE IF NOT EXISTS database_connections (
			id VARCHAR(64) PRIMARY KEY,
			name VARCHAR(255) NOT NULL,
			engine VARCHAR(50) DEFAULT 'PostgreSQL',
			host VARCHAR(255) NOT NULL,
			port INT DEFAULT 5432,
			database VARCHAR(255) DEFAULT 'postgres',
			username VARCHAR(255) DEFAULT 'postgres',
			password VARCHAR(255),
			status VARCHAR(50) DEFAULT 'ONLINE',
			"latencyMs" INT DEFAULT 3,
			connections INT DEFAULT 12,
			"createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
			"updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE TABLE IF NOT EXISTS ip_addresses (
			id VARCHAR(64) PRIMARY KEY,
			ip VARCHAR(50) UNIQUE NOT NULL,
			subnet VARCHAR(50) DEFAULT '192.168.1.0/24',
			hostname VARCHAR(255),
			status VARCHAR(50) DEFAULT 'ACTIVE',
			"assignedTo" VARCHAR(255),
			"lastPingMs" INT DEFAULT 5,
			"createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
			"updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE TABLE IF NOT EXISTS backup_records (
			id VARCHAR(64) PRIMARY KEY,
			"deviceName" VARCHAR(255) NOT NULL,
			filename VARCHAR(255) NOT NULL,
			"sizeKb" INT NOT NULL,
			status VARCHAR(50) DEFAULT 'SUCCESS',
			"createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
		);`,
	}

	for _, q := range queries {
		if _, err := s.pool.Exec(ctx, q); err != nil {
			return fmt.Errorf("failed query %s: %w", q, err)
		}
	}
	return nil
}

func (s *PostgresStore) seedAdmin(ctx context.Context) error {
	defaultAdminEmail := "admin@pulsenoc.local"
	defaultAdminPass := "admin123456"

	var exists bool
	err := s.pool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM users WHERE LOWER(email) = LOWER($1))", defaultAdminEmail).Scan(&exists)
	if err == nil && !exists {
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(defaultAdminPass), bcrypt.DefaultCost)
		if err == nil {
			id := fmt.Sprintf("usr-%d", time.Now().UnixNano())
			_, err = s.pool.Exec(ctx, `
				INSERT INTO users (id, email, name, password, role, "createdAt", "updatedAt")
				VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
				ON CONFLICT (email) DO NOTHING
			`, id, defaultAdminEmail, "PulseNOC Administrator", string(hashedPassword), "ADMIN")
			if err == nil {
				log.Printf("[Storage] Default admin user seeded: %s / %s\n", defaultAdminEmail, defaultAdminPass)
			}
		}
	}
	return nil
}

// User Queries
func (s *PostgresStore) GetUserByEmail(ctx context.Context, email string) (*models.User, error) {
	if s == nil || s.pool == nil {
		return nil, fmt.Errorf("storage not connected")
	}
	var u models.User
	row := s.pool.QueryRow(ctx, `
		SELECT id, email, name, password, role, "createdAt", "updatedAt"
		FROM users WHERE LOWER(email) = LOWER($1)
	`, email)
	err := row.Scan(&u.ID, &u.Email, &u.Name, &u.Password, &u.Role, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (s *PostgresStore) GetUserByID(ctx context.Context, id string) (*models.User, error) {
	var u models.User
	row := s.pool.QueryRow(ctx, `
		SELECT id, email, name, password, role, "createdAt", "updatedAt"
		FROM users WHERE id = $1
	`, id)
	err := row.Scan(&u.ID, &u.Email, &u.Name, &u.Password, &u.Role, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (s *PostgresStore) GetAllUsers(ctx context.Context) ([]models.User, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, email, name, role, "createdAt", "updatedAt"
		FROM users ORDER BY "createdAt" DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	users := make([]models.User, 0)
	for rows.Next() {
		var u models.User
		if err := rows.Scan(&u.ID, &u.Email, &u.Name, &u.Role, &u.CreatedAt, &u.UpdatedAt); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, nil
}

func (s *PostgresStore) CreateUser(ctx context.Context, u *models.User) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO users (id, email, name, password, role, "createdAt", "updatedAt")
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, u.ID, u.Email, u.Name, u.Password, u.Role, u.CreatedAt, u.UpdatedAt)
	return err
}

func (s *PostgresStore) UpdateUserRole(ctx context.Context, id string, role models.UserRole) error {
	_, err := s.pool.Exec(ctx, `UPDATE users SET role = $1, "updatedAt" = NOW() WHERE id = $2`, role, id)
	return err
}

func (s *PostgresStore) DeleteUser(ctx context.Context, id string) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM users WHERE id = $1`, id)
	return err
}

// Host Metrics Queries
func (s *PostgresStore) SaveHostMetric(ctx context.Context, m *models.HostMetric) error {
	if s == nil || s.pool == nil {
		return fmt.Errorf("storage not connected")
	}
	_, err := s.pool.Exec(ctx, `
		INSERT INTO host_metrics (
			id, "cpuUsage", "ramUsedMb", "ramTotalMb", "diskUsagePct",
			"diskUsedGb", "diskTotalGb", "diskReadKb", "diskWriteKb",
			"networkInKb", "networkOutKb", timestamp
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
	`, m.ID, m.CPUUsage, m.RAMUsedMB, m.RAMTotalMB, m.DiskUsagePct,
		m.DiskUsedGB, m.DiskTotalGB, m.DiskReadKB, m.DiskWriteKB,
		m.NetworkInKB, m.NetworkOutKB, m.Timestamp)
	return err
}

func (s *PostgresStore) GetHostMetricsHistory(ctx context.Context, limit int) ([]models.HostMetric, error) {
	if s == nil || s.pool == nil {
		return []models.HostMetric{}, nil
	}
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	rows, err := s.pool.Query(ctx, `
		SELECT id, "cpuUsage", "ramUsedMb", "ramTotalMb", "diskUsagePct",
		       "diskUsedGb", "diskTotalGb", "diskReadKb", "diskWriteKb",
		       "networkInKb", "networkOutKb", timestamp
		FROM host_metrics
		ORDER BY timestamp DESC
		LIMIT $1
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]models.HostMetric, 0)
	for rows.Next() {
		var m models.HostMetric
		if err := rows.Scan(
			&m.ID, &m.CPUUsage, &m.RAMUsedMB, &m.RAMTotalMB, &m.DiskUsagePct,
			&m.DiskUsedGB, &m.DiskTotalGB, &m.DiskReadKB, &m.DiskWriteKB,
			&m.NetworkInKB, &m.NetworkOutKB, &m.Timestamp,
		); err != nil {
			return nil, err
		}
		list = append(list, m)
	}
	return list, nil
}
