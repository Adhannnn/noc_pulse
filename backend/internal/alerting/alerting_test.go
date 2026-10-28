package alerting

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"testing"
	"time"

	"pulsenoc/backend/internal/config"
	"pulsenoc/backend/internal/models"
)

func TestAlertDispatcher_AntiFlapping(t *testing.T) {
	cfg := &config.Config{}
	dispatcher := NewAlertDispatcher(nil, cfg)

	m := &models.Monitor{
		ID:   "mon-123",
		Name: "Production API",
		URL:  "https://api.example.com",
	}

	// First outage should record time in lastAlert
	dispatcher.DispatchStateChange(context.Background(), m, models.MonitorStatusUp, models.MonitorStatusDown, "CONNECTION_REFUSED")

	key := "mon-123:DOWN"
	dispatcher.mu.Lock()
	t1, exists := dispatcher.lastAlert[key]
	dispatcher.mu.Unlock()

	if !exists {
		t.Fatalf("Expected key %s to exist in lastAlert", key)
	}

	// Second outage immediately after should be suppressed (time unchanged)
	dispatcher.DispatchStateChange(context.Background(), m, models.MonitorStatusUp, models.MonitorStatusDown, "CONNECTION_REFUSED")

	dispatcher.mu.Lock()
	t2 := dispatcher.lastAlert[key]
	dispatcher.mu.Unlock()

	if !t1.Equal(t2) {
		t.Errorf("Expected identical alert timestamp due to flapping suppression, got %v and %v", t1, t2)
	}
}

type roundTripperFunc func(req *http.Request) (*http.Response, error)

func (f roundTripperFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func TestAlertDispatcher_SendDiscord(t *testing.T) {
	mockResponse := &http.Response{
		StatusCode: http.StatusOK,
		Header:     make(http.Header),
		Body:       io.NopCloser(bytes.NewBufferString(`{"ok":true}`)),
	}

	dispatcher := NewAlertDispatcher(nil, &config.Config{})
	dispatcher.httpClient.Transport = roundTripperFunc(func(req *http.Request) (*http.Response, error) {
		if req.Method != "POST" {
			t.Errorf("Expected POST method, got %s", req.Method)
		}
		if req.Header.Get("Content-Type") != "application/json" {
			t.Errorf("Expected application/json Content-Type")
		}
		return mockResponse, nil
	})

	fields := []DiscordEmbedField{
		{Name: "Monitor", Value: "API Gateway", Inline: true},
	}

	err := dispatcher.sendDiscord(context.Background(), "https://discord.com/api/webhooks/test", "🚨 Service Alert", "Details", 0xDC2626, fields)
	if err != nil {
		t.Fatalf("sendDiscord failed: %v", err)
	}
}

func TestAlertDispatcher_SendTelegram(t *testing.T) {
	mockResponse := &http.Response{
		StatusCode: http.StatusOK,
		Header:     make(http.Header),
		Body:       io.NopCloser(bytes.NewBufferString(`{"ok":true}`)),
	}

	dispatcher := NewAlertDispatcher(nil, &config.Config{})
	dispatcher.httpClient.Transport = roundTripperFunc(func(req *http.Request) (*http.Response, error) {
		if req.Method != "POST" {
			t.Errorf("Expected POST method, got %s", req.Method)
		}
		return mockResponse, nil
	})

	err := dispatcher.sendTelegram(context.Background(), "mockToken", "mockChatID", "Test alert")
	if err != nil {
		t.Fatalf("sendTelegram failed: %v", err)
	}
}

func TestAlertDispatcher_SSLWarning(t *testing.T) {
	dispatcher := NewAlertDispatcher(nil, &config.Config{})
	m := &models.Monitor{
		ID:   "mon-ssl",
		Name: "HTTPS Service",
		URL:  "https://secure.example.com",
	}

	cert := &models.SSLCertificateInfo{
		Issuer:         "Let's Encrypt Authority X3",
		DaysRemaining:  5,
		WarningTrigger: true,
		IsExpired:      false,
		ValidTo:        time.Now().Add(5 * 24 * time.Hour),
	}

	dispatcher.DispatchSSLWarning(context.Background(), m, cert)

	key := "ssl:mon-ssl:false"
	dispatcher.mu.Lock()
	_, exists := dispatcher.lastAlert[key]
	dispatcher.mu.Unlock()

	if !exists {
		t.Fatalf("Expected SSL warning timestamp to be recorded for key %s", key)
	}
}

func TestAlertDispatcher_DispatchTest(t *testing.T) {
	mockResponse := &http.Response{
		StatusCode: http.StatusOK,
		Header:     make(http.Header),
		Body:       io.NopCloser(bytes.NewBufferString(`{"ok":true}`)),
	}

	dispatcher := NewAlertDispatcher(nil, &config.Config{})
	dispatcher.httpClient.Transport = roundTripperFunc(func(req *http.Request) (*http.Response, error) {
		return mockResponse, nil
	})

	// Discord valid
	err := dispatcher.DispatchTest(context.Background(), "DISCORD", "https://discord.com/api/webhooks/123", "", "")
	if err != nil {
		t.Errorf("Expected Discord DispatchTest to succeed, got %v", err)
	}

	// Discord empty URL
	err = dispatcher.DispatchTest(context.Background(), "DISCORD", "", "", "")
	if err == nil {
		t.Errorf("Expected error for empty Discord webhook URL")
	}

	// Telegram valid
	err = dispatcher.DispatchTest(context.Background(), "TELEGRAM", "", "bot-token", "chat-id")
	if err != nil {
		t.Errorf("Expected Telegram DispatchTest to succeed, got %v", err)
	}

	// Telegram missing token
	err = dispatcher.DispatchTest(context.Background(), "TELEGRAM", "", "", "chat-id")
	if err == nil {
		t.Errorf("Expected error for missing Telegram bot token")
	}

	// Unsupported type
	err = dispatcher.DispatchTest(context.Background(), "SLACK", "", "", "")
	if err == nil {
		t.Errorf("Expected error for unsupported type SLACK")
	}
}

func TestAlertDispatcher_DispatchHostThreshold(t *testing.T) {
	dispatcher := NewAlertDispatcher(nil, &config.Config{})

	// Warning threshold
	dispatcher.DispatchHostThreshold(context.Background(), "CPU Usage", 88.5, 85.0, "%")
	key := "threshold:host:CPU Usage"

	dispatcher.mu.Lock()
	t1, exists := dispatcher.lastAlert[key]
	dispatcher.mu.Unlock()

	if !exists {
		t.Fatalf("Expected threshold alert to be recorded for %s", key)
	}

	// Throttled attempt immediately after
	dispatcher.DispatchHostThreshold(context.Background(), "CPU Usage", 92.0, 85.0, "%")
	dispatcher.mu.Lock()
	t2 := dispatcher.lastAlert[key]
	dispatcher.mu.Unlock()

	if !t1.Equal(t2) {
		t.Errorf("Expected threshold alert to be throttled within cooldown window")
	}
}

func TestAlertDispatcher_DispatchLatencyThreshold(t *testing.T) {
	dispatcher := NewAlertDispatcher(nil, &config.Config{})
	m := &models.Monitor{
		ID:   "mon-latency",
		Name: "Database Cluster",
		URL:  "tcp://db.internal:5432",
	}

	dispatcher.DispatchLatencyThreshold(context.Background(), m, 1250, 1000)
	key := "threshold:latency:mon-latency"

	dispatcher.mu.Lock()
	t1, exists := dispatcher.lastAlert[key]
	dispatcher.mu.Unlock()

	if !exists {
		t.Fatalf("Expected latency threshold alert to be recorded for %s", key)
	}

	dispatcher.DispatchLatencyThreshold(context.Background(), m, 1300, 1000)
	dispatcher.mu.Lock()
	t2 := dispatcher.lastAlert[key]
	dispatcher.mu.Unlock()

	if !t1.Equal(t2) {
		t.Errorf("Expected latency threshold alert to be throttled")
	}
}
