package alerting

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"pulsenoc/backend/internal/config"
	"pulsenoc/backend/internal/models"
	"pulsenoc/backend/internal/storage"
)

type DiscordEmbedField struct {
	Name   string `json:"name"`
	Value  string `json:"value"`
	Inline bool   `json:"inline"`
}

type DiscordFooter struct {
	Text string `json:"text"`
}

type DiscordEmbed struct {
	Title       string              `json:"title"`
	Description string              `json:"description,omitempty"`
	Color       int                 `json:"color"`
	Fields      []DiscordEmbedField `json:"fields,omitempty"`
	Footer      *DiscordFooter      `json:"footer,omitempty"`
	Timestamp   string              `json:"timestamp,omitempty"`
}

type DiscordPayload struct {
	Username  string         `json:"username,omitempty"`
	AvatarURL string         `json:"avatar_url,omitempty"`
	Embeds    []DiscordEmbed `json:"embeds"`
}

type TelegramPayload struct {
	ChatID    string `json:"chat_id"`
	Text      string `json:"text"`
	ParseMode string `json:"parse_mode"`
}

type AlertDispatcher struct {
	store      *storage.PostgresStore
	cfg        *config.Config
	httpClient *http.Client
	lastAlert  map[string]time.Time
	mu         sync.Mutex
}

func NewAlertDispatcher(store *storage.PostgresStore, cfg *config.Config) *AlertDispatcher {
	return &AlertDispatcher{
		store: store,
		cfg:   cfg,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
		lastAlert: make(map[string]time.Time),
	}
}

// DispatchStateChange handles monitor state transitions (UP -> DOWN, DOWN -> UP)
func (d *AlertDispatcher) DispatchStateChange(ctx context.Context, m *models.Monitor, prevStatus models.MonitorStatus, newStatus models.MonitorStatus, errMsg string) {
	if prevStatus == newStatus {
		return
	}

	// Only trigger on notable transitions: into DOWN, or recovery from DOWN/DEGRADED to UP
	isOutage := newStatus == models.MonitorStatusDown
	isRecovery := (prevStatus == models.MonitorStatusDown || prevStatus == models.MonitorStatusDegraded) && newStatus == models.MonitorStatusUp

	if !isOutage && !isRecovery {
		return
	}

	// Anti-flapping check: suppress if identical alert sent within 3 minutes
	key := fmt.Sprintf("%s:%s", m.ID, newStatus)
	d.mu.Lock()
	lastSent, exists := d.lastAlert[key]
	if exists && time.Since(lastSent) < 3*time.Minute {
		d.mu.Unlock()
		log.Printf("[Alerting] Suppressed flapping alert for monitor %s (%s)", m.Name, newStatus)
		return
	}
	d.lastAlert[key] = time.Now()
	d.mu.Unlock()

	// Manage Incident in DB
	if d.store != nil {
		if isOutage {
			incidentDesc := fmt.Sprintf("Service outage detected for monitor '%s' (%s).", m.Name, m.URL)
			if errMsg != "" {
				incidentDesc = fmt.Sprintf("%s Reason: %s", incidentDesc, errMsg)
			}
			inc := &models.Incident{
				ID:          fmt.Sprintf("inc-%d", time.Now().UnixNano()),
				MonitorID:   m.ID,
				Title:       fmt.Sprintf("Outage: %s is DOWN", m.Name),
				Description: &incidentDesc,
				Severity:    "CRITICAL",
				Status:      "INVESTIGATING",
				StartedAt:   time.Now(),
			}
			if err := d.store.CreateIncident(ctx, inc); err != nil {
				log.Printf("[Alerting] Failed to record incident in database: %v", err)
			}
		} else if isRecovery {
			if err := d.store.ResolveMonitorIncidents(ctx, m.ID); err != nil {
				log.Printf("[Alerting] Failed to auto-resolve incidents for monitor %s: %v", m.ID, err)
			}
		}
	}

	// Dispatch notification to channels
	d.broadcastNotification(ctx, m, isOutage, errMsg)
}

// DispatchSSLWarning dispatches alert when SSL certificate is expiring soon or expired
func (d *AlertDispatcher) DispatchSSLWarning(ctx context.Context, m *models.Monitor, cert *models.SSLCertificateInfo) {
	if cert == nil || (!cert.WarningTrigger && !cert.IsExpired) {
		return
	}

	// Rate limit SSL warnings to once per 24 hours per monitor
	key := fmt.Sprintf("ssl:%s:%v", m.ID, cert.IsExpired)
	d.mu.Lock()
	lastSent, exists := d.lastAlert[key]
	if exists && time.Since(lastSent) < 24*time.Hour {
		d.mu.Unlock()
		return
	}
	d.lastAlert[key] = time.Now()
	d.mu.Unlock()

	title := fmt.Sprintf("⚠️ [PulseNOC] SSL Certificate Expiring Soon: %s", m.Name)
	color := 0xF59E0B // Amber
	if cert.IsExpired {
		title = fmt.Sprintf("🚨 [PulseNOC] SSL Certificate EXPIRED: %s", m.Name)
		color = 0xDC2626 // Red
	}

	statusText := fmt.Sprintf("%d days remaining", cert.DaysRemaining)
	if cert.IsExpired {
		statusText = "EXPIRED"
	}

	fields := []DiscordEmbedField{
		{Name: "Monitor", Value: m.Name, Inline: true},
		{Name: "Target", Value: m.URL, Inline: true},
		{Name: "SSL Expiry", Value: statusText, Inline: true},
		{Name: "Issuer", Value: cert.Issuer, Inline: true},
		{Name: "Valid Until", Value: cert.ValidTo.Format("2006-01-02 15:04:05 MST"), Inline: true},
	}

	telegramMsg := fmt.Sprintf(
		"%s\n*Monitor:* %s\n*Target:* `%s`\n*Issuer:* `%s`\n*Valid Until:* `%s` (%s)",
		title,
		m.Name,
		m.URL,
		cert.Issuer,
		cert.ValidTo.Format("2006-01-02 15:04:05 MST"),
		statusText,
	)

	d.sendToAllChannels(ctx, title, "", color, fields, telegramMsg)
}

func (d *AlertDispatcher) broadcastNotification(ctx context.Context, m *models.Monitor, isOutage bool, errMsg string) {
	nowStr := time.Now().UTC().Format("2006-01-02 15:04:05 UTC")
	var title string
	var color int
	var statusVal string

	if isOutage {
		title = fmt.Sprintf("🚨 [PulseNOC OUTAGE] Service %s is DOWN", m.Name)
		color = 0xDC2626 // Red
		statusVal = "🔴 DOWN"
	} else {
		title = fmt.Sprintf("✅ [PulseNOC RECOVERY] Service %s is BACK UP", m.Name)
		color = 0x10B981 // Emerald
		statusVal = "🟢 UP / Operational"
	}

	fields := []DiscordEmbedField{
		{Name: "Monitor", Value: m.Name, Inline: true},
		{Name: "Target URL / Port", Value: m.URL, Inline: true},
		{Name: "Status", Value: statusVal, Inline: true},
		{Name: "Timestamp", Value: nowStr, Inline: true},
	}

	if isOutage && errMsg != "" {
		fields = append(fields, DiscordEmbedField{
			Name:   "Diagnostic Error",
			Value:  fmt.Sprintf("`%s`", errMsg),
			Inline: false,
		})
	}

	telegramMsg := fmt.Sprintf(
		"%s\n*Status:* %s\n*Target:* `%s`\n*Time:* `%s`",
		title,
		statusVal,
		m.URL,
		nowStr,
	)
	if isOutage && errMsg != "" {
		telegramMsg += fmt.Sprintf("\n*Error:* `%s`", errMsg)
	}

	d.sendToAllChannels(ctx, title, "", color, fields, telegramMsg)
}

func (d *AlertDispatcher) sendToAllChannels(ctx context.Context, title, desc string, color int, fields []DiscordEmbedField, telegramText string) {
	// 1. Send to environment-configured Discord webhook
	if d.cfg != nil && d.cfg.DiscordWebhookURL != "" {
		if err := d.sendDiscord(ctx, d.cfg.DiscordWebhookURL, title, desc, color, fields); err != nil {
			log.Printf("[Alerting] Failed to send to default Discord webhook: %v", err)
		}
	}

	// 2. Send to environment-configured Telegram bot
	if d.cfg != nil && d.cfg.TelegramBotToken != "" && d.cfg.TelegramChatID != "" {
		if err := d.sendTelegram(ctx, d.cfg.TelegramBotToken, d.cfg.TelegramChatID, telegramText); err != nil {
			log.Printf("[Alerting] Failed to send to default Telegram channel: %v", err)
		}
	}

	// 3. Send to channels configured in PostgreSQL
	if d.store != nil {
		channels, err := d.store.GetAllAlertChannels(ctx)
		if err == nil {
			for _, ch := range channels {
				if !ch.IsEnabled {
					continue
				}
				switch ch.Type {
				case "DISCORD":
					if ch.WebhookURL != nil && *ch.WebhookURL != "" && (d.cfg == nil || *ch.WebhookURL != d.cfg.DiscordWebhookURL) {
						if err := d.sendDiscord(ctx, *ch.WebhookURL, title, desc, color, fields); err != nil {
							log.Printf("[Alerting] Failed to send to DB Discord channel %s: %v", ch.Name, err)
						}
					}
				case "TELEGRAM":
					token := ""
					chatID := ""
					if ch.BotToken != nil {
						token = *ch.BotToken
					}
					if ch.ChatID != nil {
						chatID = *ch.ChatID
					}
					if token != "" && chatID != "" {
						if err := d.sendTelegram(ctx, token, chatID, telegramText); err != nil {
							log.Printf("[Alerting] Failed to send to DB Telegram channel %s: %v", ch.Name, err)
						}
					}
				}
			}
		}
	}
}

func (d *AlertDispatcher) sendDiscord(ctx context.Context, webhookURL string, title string, description string, color int, fields []DiscordEmbedField) error {
	payload := DiscordPayload{
		Username: "PulseNOC Sentinel",
		Embeds: []DiscordEmbed{
			{
				Title:       title,
				Description: description,
				Color:       color,
				Fields:      fields,
				Footer: &DiscordFooter{
					Text: "PulseNOC Telemetry & Alert Engine",
				},
				Timestamp: time.Now().UTC().Format(time.RFC3339),
			},
		},
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", webhookURL, bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := d.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("discord webhook rejected with HTTP %d", resp.StatusCode)
	}

	return nil
}

func (d *AlertDispatcher) sendTelegram(ctx context.Context, botToken string, chatID string, text string) error {
	apiURL := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", botToken)
	payload := TelegramPayload{
		ChatID:    chatID,
		Text:      text,
		ParseMode: "Markdown",
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", apiURL, bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := d.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("telegram bot api rejected with HTTP %d", resp.StatusCode)
	}

	return nil
}
