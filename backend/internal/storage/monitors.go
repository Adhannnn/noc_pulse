package storage

import (
	"context"

	"pulsenoc/backend/internal/models"
)

// Monitors
func (s *PostgresStore) GetAllMonitors(ctx context.Context) ([]models.Monitor, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, name, type, url, port, "group", "intervalSec", "timeoutSec",
		       "isActive", "currentStatus", "uptimePercent24h", "lastProbedAt",
		       "dataCenterId", "createdAt", "updatedAt"
		FROM monitors
		ORDER BY "createdAt" ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.Monitor
	for rows.Next() {
		var m models.Monitor
		if err := rows.Scan(
			&m.ID, &m.Name, &m.Type, &m.URL, &m.Port, &m.Group, &m.IntervalSec, &m.TimeoutSec,
			&m.IsActive, &m.CurrentStatus, &m.UptimePercent24h, &m.LastProbedAt,
			&m.DataCenterID, &m.CreatedAt, &m.UpdatedAt,
		); err != nil {
			return nil, err
		}
		m.Heartbeats = []models.Heartbeat{}
		list = append(list, m)
	}

	// Fetch up to 30 recent heartbeats for each monitor
	for i := range list {
		hbRows, err := s.pool.Query(ctx, `
			SELECT id, "monitorId", status, "latencyMs", "statusCode", "errorMessage", timestamp
			FROM heartbeats
			WHERE "monitorId" = $1
			ORDER BY timestamp DESC
			LIMIT 30
		`, list[i].ID)
		if err == nil {
			for hbRows.Next() {
				var hb models.Heartbeat
				if err := hbRows.Scan(&hb.ID, &hb.MonitorID, &hb.Status, &hb.LatencyMs, &hb.StatusCode, &hb.ErrorMessage, &hb.Timestamp); err == nil {
					list[i].Heartbeats = append(list[i].Heartbeats, hb)
				}
			}
			hbRows.Close()
		}
	}

	return list, nil
}

func (s *PostgresStore) GetMonitorByID(ctx context.Context, id string) (*models.Monitor, error) {
	var m models.Monitor
	row := s.pool.QueryRow(ctx, `
		SELECT id, name, type, url, port, "group", "intervalSec", "timeoutSec",
		       "isActive", "currentStatus", "uptimePercent24h", "lastProbedAt",
		       "dataCenterId", "createdAt", "updatedAt"
		FROM monitors WHERE id = $1
	`, id)
	err := row.Scan(
		&m.ID, &m.Name, &m.Type, &m.URL, &m.Port, &m.Group, &m.IntervalSec, &m.TimeoutSec,
		&m.IsActive, &m.CurrentStatus, &m.UptimePercent24h, &m.LastProbedAt,
		&m.DataCenterID, &m.CreatedAt, &m.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	m.Heartbeats = []models.Heartbeat{}
	// Fetch recent heartbeats
	hbRows, err := s.pool.Query(ctx, `
		SELECT id, "monitorId", status, "latencyMs", "statusCode", "errorMessage", timestamp
		FROM heartbeats
		WHERE "monitorId" = $1
		ORDER BY timestamp DESC
		LIMIT 20
	`, id)
	if err == nil {
		defer hbRows.Close()
		for hbRows.Next() {
			var hb models.Heartbeat
			if err := hbRows.Scan(&hb.ID, &hb.MonitorID, &hb.Status, &hb.LatencyMs, &hb.StatusCode, &hb.ErrorMessage, &hb.Timestamp); err == nil {
				m.Heartbeats = append(m.Heartbeats, hb)
			}
		}
	}

	return &m, nil
}

func (s *PostgresStore) CreateMonitor(ctx context.Context, m *models.Monitor) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO monitors (
			id, name, type, url, port, "group", "intervalSec", "timeoutSec",
			"isActive", "currentStatus", "uptimePercent24h", "createdAt", "updatedAt"
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
	`, m.ID, m.Name, m.Type, m.URL, m.Port, m.Group, m.IntervalSec, m.TimeoutSec,
		m.IsActive, m.CurrentStatus, m.UptimePercent24h, m.CreatedAt, m.UpdatedAt)
	return err
}

func (s *PostgresStore) UpdateMonitor(ctx context.Context, id string, name, group, url string, port *int, intervalSec int) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE monitors
		SET name = $1, "group" = $2, url = $3, port = $4, "intervalSec" = $5, "updatedAt" = NOW()
		WHERE id = $6
	`, name, group, url, port, intervalSec, id)
	return err
}

func (s *PostgresStore) DeleteMonitor(ctx context.Context, id string) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM monitors WHERE id = $1`, id)
	return err
}

func (s *PostgresStore) RecordHeartbeat(ctx context.Context, hb *models.Heartbeat) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO heartbeats (id, "monitorId", status, "latencyMs", "statusCode", "errorMessage", timestamp)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, hb.ID, hb.MonitorID, hb.Status, hb.LatencyMs, hb.StatusCode, hb.ErrorMessage, hb.Timestamp)
	if err != nil {
		return err
	}

	// Update monitor status and last probed time
	_, err = s.pool.Exec(ctx, `
		UPDATE monitors
		SET "currentStatus" = $1, "lastProbedAt" = $2, "updatedAt" = NOW()
		WHERE id = $3
	`, hb.Status, hb.Timestamp, hb.MonitorID)
	return err
}

// Groups
func (s *PostgresStore) GetAllGroups(ctx context.Context) ([]models.ServiceGroup, error) {
	rows, err := s.pool.Query(ctx, `SELECT id, name, "createdAt", "updatedAt" FROM service_groups ORDER BY name ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]models.ServiceGroup, 0)
	for rows.Next() {
		var g models.ServiceGroup
		if err := rows.Scan(&g.ID, &g.Name, &g.CreatedAt, &g.UpdatedAt); err != nil {
			return nil, err
		}
		list = append(list, g)
	}
	return list, nil
}

func (s *PostgresStore) CreateGroup(ctx context.Context, g *models.ServiceGroup) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO service_groups (id, name, "createdAt", "updatedAt")
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (name) DO NOTHING
	`, g.ID, g.Name, g.CreatedAt, g.UpdatedAt)
	return err
}

func (s *PostgresStore) RenameGroup(ctx context.Context, oldName, newName string) error {
	_, err := s.pool.Exec(ctx, `UPDATE service_groups SET name = $1, "updatedAt" = NOW() WHERE name = $2`, newName, oldName)
	if err != nil {
		return err
	}
	_, err = s.pool.Exec(ctx, `UPDATE monitors SET "group" = $1 WHERE "group" = $2`, newName, oldName)
	return err
}

func (s *PostgresStore) DeleteGroup(ctx context.Context, name string) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM service_groups WHERE name = $1`, name)
	return err
}

// Incidents
func (s *PostgresStore) GetAllIncidents(ctx context.Context) ([]models.Incident, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, "monitorId", title, description, severity, status, "startedAt", "resolvedAt"
		FROM incidents
		ORDER BY "startedAt" DESC
		LIMIT 50
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]models.Incident, 0)
	for rows.Next() {
		var inc models.Incident
		if err := rows.Scan(&inc.ID, &inc.MonitorID, &inc.Title, &inc.Description, &inc.Severity, &inc.Status, &inc.StartedAt, &inc.ResolvedAt); err != nil {
			return nil, err
		}
		list = append(list, inc)
	}
	return list, nil
}
