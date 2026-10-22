package database

import (
	"context"
	"time"
)

type TelemetryStats struct {
	Engine            string            `json:"engine"`
	LatencyMs         int               `json:"latencyMs"`
	ActiveConnections int               `json:"activeConnections"`
	MaxConnections    int               `json:"maxConnections"`
	CacheHitRatio     float64           `json:"cacheHitRatio"`
	DatabaseSizeMB    float64           `json:"databaseSizeMb"`
	TotalTablesOrKeys int               `json:"totalTablesOrKeys"`
	ExtraStats        map[string]string `json:"extraStats,omitempty"`
}

type QueryResult struct {
	Columns    []string                 `json:"columns"`
	Rows       []map[string]interface{} `json:"rows"`
	RowCount   int                      `json:"rowCount"`
	Duration   string                   `json:"duration"`
	DurationMs int64                    `json:"durationMs"`
}

type Adapter interface {
	Ping(ctx context.Context) (time.Duration, error)
	GetTelemetry(ctx context.Context) (*TelemetryStats, error)
	ListTables(ctx context.Context) ([]string, error)
	GetTableData(ctx context.Context, tableName string, limit int) (*QueryResult, error)
	ExecuteQuery(ctx context.Context, query string) (*QueryResult, error)
	Close() error
}
