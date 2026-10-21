package storage

import (
	"context"

	"pulsenoc/backend/internal/models"
)

// Database Connections
func (s *PostgresStore) GetAllDatabases(ctx context.Context) ([]models.DatabaseConnection, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, name, engine, host, port, database, username, password, status, "latencyMs", connections, "createdAt", "updatedAt"
		FROM database_connections
		ORDER BY "createdAt" DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.DatabaseConnection
	for rows.Next() {
		var db models.DatabaseConnection
		if err := rows.Scan(
			&db.ID, &db.Name, &db.Engine, &db.Host, &db.Port, &db.Database, &db.Username,
			&db.Password, &db.Status, &db.LatencyMs, &db.Connections, &db.CreatedAt, &db.UpdatedAt,
		); err != nil {
			return nil, err
		}
		list = append(list, db)
	}
	return list, nil
}

func (s *PostgresStore) GetDatabaseByID(ctx context.Context, id string) (*models.DatabaseConnection, error) {
	var db models.DatabaseConnection
	row := s.pool.QueryRow(ctx, `
		SELECT id, name, engine, host, port, database, username, password, status, "latencyMs", connections, "createdAt", "updatedAt"
		FROM database_connections WHERE id = $1
	`, id)
	err := row.Scan(
		&db.ID, &db.Name, &db.Engine, &db.Host, &db.Port, &db.Database, &db.Username,
		&db.Password, &db.Status, &db.LatencyMs, &db.Connections, &db.CreatedAt, &db.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &db, nil
}

func (s *PostgresStore) CreateDatabase(ctx context.Context, db *models.DatabaseConnection) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO database_connections (
			id, name, engine, host, port, database, username, password, status, "latencyMs", connections, "createdAt", "updatedAt"
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
	`, db.ID, db.Name, db.Engine, db.Host, db.Port, db.Database, db.Username,
		db.Password, db.Status, db.LatencyMs, db.Connections, db.CreatedAt, db.UpdatedAt)
	return err
}

func (s *PostgresStore) UpdateDatabaseStats(ctx context.Context, id string, status string, latencyMs, connections int) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE database_connections
		SET status = $1, "latencyMs" = $2, connections = $3, "updatedAt" = NOW()
		WHERE id = $4
	`, status, latencyMs, connections, id)
	return err
}

func (s *PostgresStore) DeleteDatabase(ctx context.Context, id string) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM database_connections WHERE id = $1`, id)
	return err
}
