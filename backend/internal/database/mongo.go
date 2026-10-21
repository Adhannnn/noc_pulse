package database

import (
	"context"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type MongoAdapter struct {
	client *mongo.Client
	dbName string
}

func NewMongoAdapter(host string, port int, dbName, user, password string) (*MongoAdapter, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var uri string
	if user != "" && password != "" {
		uri = fmt.Sprintf("mongodb://%s:%s@%s:%d/%s", user, password, host, port, dbName)
	} else {
		uri = fmt.Sprintf("mongodb://%s:%d/%s", host, port, dbName)
	}

	clientOpts := options.Client().ApplyURI(uri).SetTimeout(5 * time.Second)
	client, err := mongo.Connect(ctx, clientOpts)
	if err != nil {
		return nil, err
	}

	return &MongoAdapter{client: client, dbName: dbName}, nil
}

func (a *MongoAdapter) Ping(ctx context.Context) (time.Duration, error) {
	start := time.Now()
	err := a.client.Ping(ctx, nil)
	return time.Since(start), err
}

func (a *MongoAdapter) GetTelemetry(ctx context.Context) (*TelemetryStats, error) {
	start := time.Now()
	err := a.client.Ping(ctx, nil)
	latency := int(time.Since(start).Milliseconds())
	if err != nil {
		return nil, err
	}

	stats := &TelemetryStats{
		Engine:     "MongoDB",
		LatencyMs:  latency,
		ExtraStats: make(map[string]string),
	}

	// 1. Collections Count
	db := a.client.Database(a.dbName)
	cols, err := db.ListCollectionNames(ctx, bson.M{})
	if err == nil {
		stats.TotalTablesOrKeys = len(cols)
	}

	// 2. Server status
	var serverStatus bson.M
	err = a.client.Database("admin").RunCommand(ctx, bson.D{{Key: "serverStatus", Value: 1}}).Decode(&serverStatus)
	if err == nil {
		if conns, ok := serverStatus["connections"].(bson.M); ok {
			if curr, ok := conns["current"].(int32); ok {
				stats.ActiveConnections = int(curr)
			}
			if avail, ok := conns["available"].(int32); ok {
				stats.MaxConnections = int(avail) + stats.ActiveConnections
			}
		}
	}

	return stats, nil
}

func (a *MongoAdapter) ListTables(ctx context.Context) ([]string, error) {
	return a.client.Database(a.dbName).ListCollectionNames(ctx, bson.M{})
}

func (a *MongoAdapter) GetTableData(ctx context.Context, collectionName string, limit int) (*QueryResult, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	start := time.Now()
	coll := a.client.Database(a.dbName).Collection(collectionName)

	findOpts := options.Find().SetLimit(int64(limit))
	cur, err := coll.Find(ctx, bson.M{}, findOpts)
	if err != nil {
		return nil, err
	}
	defer cur.Close(ctx)

	var rows []map[string]interface{}
	for cur.Next(ctx) {
		var doc map[string]interface{}
		if err := cur.Decode(&doc); err == nil {
			rows = append(rows, doc)
		}
	}

	cols := []string{"_id", "Data"}
	return &QueryResult{
		Columns:  cols,
		Rows:     rows,
		RowCount: len(rows),
		Duration: time.Since(start).String(),
	}, nil
}

func (a *MongoAdapter) ExecuteQuery(ctx context.Context, query string) (*QueryResult, error) {
	return a.GetTableData(ctx, query, 20)
}

func (a *MongoAdapter) Close() error {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	return a.client.Disconnect(ctx)
}
