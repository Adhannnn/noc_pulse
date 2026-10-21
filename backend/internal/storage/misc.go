package storage

import (
	"context"

	"pulsenoc/backend/internal/models"
)

// IP Management
func (s *PostgresStore) GetAllIPs(ctx context.Context) ([]models.IPAddress, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, ip, subnet, hostname, status, "assignedTo", "lastPingMs", "createdAt", "updatedAt"
		FROM ip_addresses ORDER BY ip ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.IPAddress
	for rows.Next() {
		var ip models.IPAddress
		if err := rows.Scan(&ip.ID, &ip.IP, &ip.Subnet, &ip.Hostname, &ip.Status, &ip.AssignedTo, &ip.LastPingMs, &ip.CreatedAt, &ip.UpdatedAt); err != nil {
			return nil, err
		}
		list = append(list, ip)
	}
	return list, nil
}

func (s *PostgresStore) CreateIP(ctx context.Context, ip *models.IPAddress) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO ip_addresses (id, ip, subnet, hostname, status, "assignedTo", "lastPingMs", "createdAt", "updatedAt")
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`, ip.ID, ip.IP, ip.Subnet, ip.Hostname, ip.Status, ip.AssignedTo, ip.LastPingMs, ip.CreatedAt, ip.UpdatedAt)
	return err
}

func (s *PostgresStore) DeleteIP(ctx context.Context, id string) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM ip_addresses WHERE id = $1`, id)
	return err
}

// Backups
func (s *PostgresStore) GetAllBackups(ctx context.Context) ([]models.BackupRecord, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, "deviceName", filename, "sizeKb", status, "createdAt"
		FROM backup_records ORDER BY "createdAt" DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.BackupRecord
	for rows.Next() {
		var b models.BackupRecord
		if err := rows.Scan(&b.ID, &b.DeviceName, &b.Filename, &b.SizeKB, &b.Status, &b.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, b)
	}
	return list, nil
}

func (s *PostgresStore) CreateBackup(ctx context.Context, b *models.BackupRecord) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO backup_records (id, "deviceName", filename, "sizeKb", status, "createdAt")
		VALUES ($1, $2, $3, $4, $5, $6)
	`, b.ID, b.DeviceName, b.Filename, b.SizeKB, b.Status, b.CreatedAt)
	return err
}

// Alert Channels
func (s *PostgresStore) GetAllAlertChannels(ctx context.Context) ([]models.AlertChannel, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, name, type, "webhookUrl", "chatId", "botToken", "isEnabled", "createdAt", "updatedAt"
		FROM alert_channels ORDER BY "createdAt" DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.AlertChannel
	for rows.Next() {
		var ac models.AlertChannel
		if err := rows.Scan(&ac.ID, &ac.Name, &ac.Type, &ac.WebhookURL, &ac.ChatID, &ac.BotToken, &ac.IsEnabled, &ac.CreatedAt, &ac.UpdatedAt); err != nil {
			return nil, err
		}
		list = append(list, ac)
	}
	return list, nil
}

func (s *PostgresStore) CreateAlertChannel(ctx context.Context, ac *models.AlertChannel) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO alert_channels (id, name, type, "webhookUrl", "chatId", "botToken", "isEnabled", "createdAt", "updatedAt")
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`, ac.ID, ac.Name, ac.Type, ac.WebhookURL, ac.ChatID, ac.BotToken, ac.IsEnabled, ac.CreatedAt, ac.UpdatedAt)
	return err
}

func (s *PostgresStore) DeleteAlertChannel(ctx context.Context, id string) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM alert_channels WHERE id = $1`, id)
	return err
}
