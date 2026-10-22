package database

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	_ "github.com/go-sql-driver/mysql"
)

type MySQLAdapter struct {
	db     *sql.DB
	dbName string
}

func NewMySQLAdapter(host string, port int, dbName, user, password string) (*MySQLAdapter, error) {
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?timeout=5s", user, password, host, port, dbName)
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	return &MySQLAdapter{db: db, dbName: dbName}, nil
}

func (a *MySQLAdapter) Ping(ctx context.Context) (time.Duration, error) {
	start := time.Now()
	err := a.db.PingContext(ctx)
	return time.Since(start), err
}

func (a *MySQLAdapter) GetTelemetry(ctx context.Context) (*TelemetryStats, error) {
	start := time.Now()
	err := a.db.PingContext(ctx)
	latency := int(time.Since(start).Milliseconds())
	if err != nil {
		return nil, err
	}

	stats := &TelemetryStats{
		Engine:     "MySQL",
		LatencyMs:  latency,
		ExtraStats: make(map[string]string),
	}

	// 1. Threads Connected (Active Connections)
	var varName, varValue string
	_ = a.db.QueryRowContext(ctx, "SHOW STATUS LIKE 'Threads_connected'").Scan(&varName, &varValue)
	stats.ExtraStats["Threads_connected"] = varValue

	// 2. Max Connections
	_ = a.db.QueryRowContext(ctx, "SHOW VARIABLES LIKE 'max_connections'").Scan(&varName, &varValue)
	stats.ExtraStats["max_connections"] = varValue

	// 3. Database Size MB
	var sizeMB float64
	_ = a.db.QueryRowContext(ctx, `
		SELECT round(sum(data_length + index_length) / 1024 / 1024, 2)
		FROM information_schema.tables WHERE table_schema = ?
	`, a.dbName).Scan(&sizeMB)
	stats.DatabaseSizeMB = sizeMB

	// 4. Total Tables
	_ = a.db.QueryRowContext(ctx, `
		SELECT count(*) FROM information_schema.tables WHERE table_schema = ?
	`, a.dbName).Scan(&stats.TotalTablesOrKeys)

	return stats, nil
}

func (a *MySQLAdapter) ListTables(ctx context.Context) ([]string, error) {
	rows, err := a.db.QueryContext(ctx, `
		SELECT table_name FROM information_schema.tables
		WHERE table_schema = ? ORDER BY table_name ASC
	`, a.dbName)
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

func (a *MySQLAdapter) GetTableData(ctx context.Context, tableName string, limit int) (*QueryResult, error) {
	if limit <= 0 || limit > 100 {
		limit = 25
	}
	query := fmt.Sprintf("SELECT * FROM `%s` LIMIT %d", tableName, limit)
	return a.ExecuteQuery(ctx, query)
}

func (a *MySQLAdapter) ExecuteQuery(ctx context.Context, query string) (*QueryResult, error) {
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

func (a *MySQLAdapter) Close() error {
	return a.db.Close()
}
