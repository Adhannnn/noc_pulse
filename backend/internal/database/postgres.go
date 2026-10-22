package database

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
)

type PostgresAdapter struct {
	db     *sql.DB
	dbName string
}

func NewPostgresAdapter(host string, port int, dbName, user, password string) (*PostgresAdapter, error) {
	connStr := fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=disable", user, password, host, port, dbName)
	db, err := sql.Open("pgx", connStr)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	return &PostgresAdapter{db: db, dbName: dbName}, nil
}

func (a *PostgresAdapter) Ping(ctx context.Context) (time.Duration, error) {
	start := time.Now()
	err := a.db.PingContext(ctx)
	return time.Since(start), err
}

func (a *PostgresAdapter) GetTelemetry(ctx context.Context) (*TelemetryStats, error) {
	start := time.Now()
	err := a.db.PingContext(ctx)
	latency := int(time.Since(start).Milliseconds())
	if err != nil {
		return nil, err
	}

	stats := &TelemetryStats{
		Engine:    "PostgreSQL",
		LatencyMs: latency,
	}

	// 1. Active Connections
	_ = a.db.QueryRowContext(ctx, `SELECT count(*) FROM pg_stat_activity WHERE datname = $1`, a.dbName).Scan(&stats.ActiveConnections)
	_ = a.db.QueryRowContext(ctx, `SHOW max_connections`).Scan(&stats.MaxConnections)

	// 2. Cache Hit Ratio
	_ = a.db.QueryRowContext(ctx, `
		SELECT round(sum(blks_hit) * 100.0 / nullif(sum(blks_hit + blks_read), 0), 2)
		FROM pg_stat_database WHERE datname = $1
	`, a.dbName).Scan(&stats.CacheHitRatio)

	// 3. Database Size MB
	var sizeBytes float64
	_ = a.db.QueryRowContext(ctx, `SELECT pg_database_size($1)`, a.dbName).Scan(&sizeBytes)
	stats.DatabaseSizeMB = float64(int(sizeBytes/(1024*1024)*100)) / 100

	// 4. Total Tables
	_ = a.db.QueryRowContext(ctx, `
		SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'
	`).Scan(&stats.TotalTablesOrKeys)

	return stats, nil
}

func (a *PostgresAdapter) ListTables(ctx context.Context) ([]string, error) {
	rows, err := a.db.QueryContext(ctx, `
		SELECT table_name FROM information_schema.tables
		WHERE table_schema = 'public' ORDER BY table_name ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tables := make([]string, 0)
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err == nil {
			tables = append(tables, name)
		}
	}
	return tables, nil
}

func (a *PostgresAdapter) GetTableData(ctx context.Context, tableName string, limit int) (*QueryResult, error) {
	if limit <= 0 || limit > 100 {
		limit = 25
	}
	query := fmt.Sprintf(`SELECT * FROM "%s" LIMIT %d`, tableName, limit)
	return a.ExecuteQuery(ctx, query)
}

func (a *PostgresAdapter) ExecuteQuery(ctx context.Context, query string) (*QueryResult, error) {
	start := time.Now()
	rows, err := a.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	cols, err := rows.Columns()
	if err != nil {
		return nil, err
	}
	if cols == nil {
		cols = make([]string, 0)
	}

	results := make([]map[string]interface{}, 0)
	for rows.Next() {
		columns := make([]interface{}, len(cols))
		columnPointers := make([]interface{}, len(cols))
		for i := range columns {
			columnPointers[i] = &columns[i]
		}

		if err := rows.Scan(columnPointers...); err != nil {
			return nil, err
		}

		m := make(map[string]interface{})
		for i, colName := range cols {
			val := columnPointers[i].(*interface{})
			if val == nil || *val == nil {
				m[colName] = nil
			} else if b, ok := (*val).([]byte); ok {
				m[colName] = string(b)
			} else if t, ok := (*val).(time.Time); ok {
				m[colName] = t.Format(time.RFC3339)
			} else {
				m[colName] = *val
			}
		}
		results = append(results, m)
	}

	return &QueryResult{
		Columns:    cols,
		Rows:       results,
		RowCount:   len(results),
		Duration:   time.Since(start).String(),
		DurationMs: time.Since(start).Milliseconds(),
	}, nil
}

func (a *PostgresAdapter) Close() error {
	return a.db.Close()
}
