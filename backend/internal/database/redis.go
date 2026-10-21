package database

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

type RedisAdapter struct {
	client *redis.Client
}

func NewRedisAdapter(host string, port int, password string) (*RedisAdapter, error) {
	addr := fmt.Sprintf("%s:%d", host, port)
	client := redis.NewClient(&redis.Options{
		Addr:        addr,
		Password:    password,
		DB:          0,
		DialTimeout: 4 * time.Second,
	})

	return &RedisAdapter{client: client}, nil
}

func (a *RedisAdapter) Ping(ctx context.Context) (time.Duration, error) {
	start := time.Now()
	err := a.client.Ping(ctx).Err()
	return time.Since(start), err
}

func (a *RedisAdapter) GetTelemetry(ctx context.Context) (*TelemetryStats, error) {
	start := time.Now()
	err := a.client.Ping(ctx).Err()
	latency := int(time.Since(start).Milliseconds())
	if err != nil {
		return nil, err
	}

	stats := &TelemetryStats{
		Engine:     "Redis",
		LatencyMs:  latency,
		ExtraStats: make(map[string]string),
	}

	infoStr, err := a.client.Info(ctx).Result()
	if err == nil {
		lines := strings.Split(infoStr, "\r\n")
		for _, line := range lines {
			parts := strings.SplitN(line, ":", 2)
			if len(parts) == 2 {
				k, v := parts[0], parts[1]
				switch k {
				case "connected_clients":
					stats.ActiveConnections, _ = strconv.Atoi(v)
				case "maxclients":
					stats.MaxConnections, _ = strconv.Atoi(v)
				case "used_memory_human":
					stats.ExtraStats["used_memory"] = v
				case "redis_version":
					stats.ExtraStats["version"] = v
				case "uptime_in_days":
					stats.ExtraStats["uptime_days"] = v
				}
			}
		}
	}

	dbSize, _ := a.client.DBSize(ctx).Result()
	stats.TotalTablesOrKeys = int(dbSize)

	return stats, nil
}

func (a *RedisAdapter) ListTables(ctx context.Context) ([]string, error) {
	keys, _, err := a.client.Scan(ctx, 0, "*", 50).Result()
	if err != nil {
		return nil, err
	}
	return keys, nil
}

func (a *RedisAdapter) GetTableData(ctx context.Context, keyName string, _ int) (*QueryResult, error) {
	start := time.Now()
	keyType, _ := a.client.Type(ctx, keyName).Result()
	val, err := a.client.Get(ctx, keyName).Result()
	if err != nil {
		val = fmt.Sprintf("[%s type data]", keyType)
	}

	return &QueryResult{
		Columns:  []string{"Key", "Type", "Value"},
		Rows:     []map[string]interface{}{{"Key": keyName, "Type": keyType, "Value": val}},
		RowCount: 1,
		Duration: time.Since(start).String(),
	}, nil
}

func (a *RedisAdapter) ExecuteQuery(ctx context.Context, query string) (*QueryResult, error) {
	start := time.Now()
	parts := strings.Fields(query)
	if len(parts) == 0 {
		return nil, fmt.Errorf("empty redis command")
	}

	args := make([]interface{}, len(parts))
	for i, p := range parts {
		args[i] = p
	}

	val, err := a.client.Do(ctx, args...).Result()
	if err != nil {
		return nil, err
	}

	return &QueryResult{
		Columns:  []string{"Result"},
		Rows:     []map[string]interface{}{{"Result": fmt.Sprintf("%v", val)}},
		RowCount: 1,
		Duration: time.Since(start).String(),
	}, nil
}

func (a *RedisAdapter) Close() error {
	return a.client.Close()
}
