package prober

import (
	"context"
	"crypto/tls"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/http/httptrace"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"pulsenoc/backend/internal/alerting"
	"pulsenoc/backend/internal/models"
	"pulsenoc/backend/internal/storage"
	"pulsenoc/backend/internal/websocket"
)

type ProberEngine struct {
	store           *storage.PostgresStore
	hub             *websocket.Hub
	alertDispatcher *alerting.AlertDispatcher
	mu              sync.RWMutex
}

func NewProberEngine(store *storage.PostgresStore, hub *websocket.Hub, alertDispatcher *alerting.AlertDispatcher) *ProberEngine {
	return &ProberEngine{
		store:           store,
		hub:             hub,
		alertDispatcher: alertDispatcher,
	}
}

func (p *ProberEngine) Start(ctx context.Context) {
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()

	// Initial immediate probe
	go p.probeAllMonitors(ctx)

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			p.probeAllMonitors(ctx)
		}
	}
}

func (p *ProberEngine) probeAllMonitors(ctx context.Context) {
	monitors, err := p.store.GetAllMonitors(ctx)
	if err != nil {
		log.Printf("[Prober] Error loading monitors: %v", err)
		return
	}

	var wg sync.WaitGroup
	for _, m := range monitors {
		if !m.IsActive {
			continue
		}
		wg.Add(1)
		go func(mon models.Monitor) {
			defer wg.Done()
			p.ProbeSingle(ctx, &mon)
		}(m)
	}
	wg.Wait()
}

func (p *ProberEngine) ProbeSingle(ctx context.Context, m *models.Monitor) {
	timeout := time.Duration(m.TimeoutSec) * time.Second
	if timeout <= 0 {
		timeout = 10 * time.Second
	}
	probeCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	prevStatus := m.CurrentStatus

	var hb *models.Heartbeat
	switch m.Type {
	case models.MonitorTypeTCP:
		hb = p.probeTCP(probeCtx, m)
	case models.MonitorTypeHTTP, "":
		hb = p.probeHTTP(probeCtx, m)
	default:
		hb = p.probeHTTP(probeCtx, m)
	}

	// Persist heartbeat & SSL update in PostgreSQL
	if p.store != nil {
		saveCtx, saveCancel := context.WithTimeout(context.Background(), 5*time.Second)
		_ = p.store.RecordHeartbeat(saveCtx, hb)
		if m.SSLCert != nil {
			_ = p.store.UpdateMonitorSSL(saveCtx, m.ID, m.SSLCert)
		}
		saveCancel()
	}

	// Automated Alert Dispatch on state changes & SSL warnings
	if p.alertDispatcher != nil {
		errMsg := ""
		if hb.ErrorMessage != nil {
			errMsg = *hb.ErrorMessage
		}
		p.alertDispatcher.DispatchStateChange(ctx, m, prevStatus, hb.Status, errMsg)

		if m.SSLCert != nil && (m.SSLCert.WarningTrigger || m.SSLCert.IsExpired) {
			p.alertDispatcher.DispatchSSLWarning(ctx, m, m.SSLCert)
		}

		// Latency Anomaly: Check if response time exceeds configured threshold
		if hb.Status == models.MonitorStatusUp && p.store != nil {
			if th, err := p.store.GetAlertThresholds(ctx); err == nil && th.IsEnabled && th.LatencyMs > 0 {
				if hb.LatencyMs >= th.LatencyMs {
					p.alertDispatcher.DispatchLatencyThreshold(ctx, m, hb.LatencyMs, th.LatencyMs)
				}
			}
		}
	}

	m.CurrentStatus = hb.Status

	// Broadcast via WebSocket to dashboard
	if p.hub != nil {
		payload := map[string]interface{}{
			"monitorId":  hb.MonitorID,
			"status":     hb.Status,
			"latencyMs":  hb.LatencyMs,
			"statusCode": hb.StatusCode,
			"timestamp":  hb.Timestamp,
		}
		if m.SSLCert != nil {
			payload["sslCert"] = m.SSLCert
		}
		p.hub.Broadcast("monitors:heartbeat", payload)
	}
}

// HTTP Probe with NOC-Grade Waterfall Timing and SSL Inspection
func (p *ProberEngine) probeHTTP(ctx context.Context, m *models.Monitor) *models.Heartbeat {
	targetURL := m.URL
	if !strings.HasPrefix(targetURL, "http://") && !strings.HasPrefix(targetURL, "https://") {
		targetURL = "http://" + targetURL
	}

	var dnsStart, dnsDone time.Time
	var connStart, connDone time.Time
	var tlsStart, tlsDone time.Time
	var gotFirstByte time.Time

	trace := &httptrace.ClientTrace{
		DNSStart: func(_ httptrace.DNSStartInfo) { dnsStart = time.Now() },
		DNSDone:  func(_ httptrace.DNSDoneInfo) { dnsDone = time.Now() },
		ConnectStart: func(_, _ string) {
			if connStart.IsZero() {
				connStart = time.Now()
			}
		},
		ConnectDone: func(_, _ string, _ error) {
			if connDone.IsZero() {
				connDone = time.Now()
			}
		},
		TLSHandshakeStart: func() { tlsStart = time.Now() },
		TLSHandshakeDone:  func(_ tls.ConnectionState, _ error) { tlsDone = time.Now() },
		GotFirstResponseByte: func() { gotFirstByte = time.Now() },
	}

	req, err := http.NewRequestWithContext(httptrace.WithClientTrace(ctx, trace), "GET", targetURL, nil)
	if err != nil {
		errMsg := err.Error()
		return &models.Heartbeat{
			ID:           fmt.Sprintf("hb-%s", uuid.New().String()[:8]),
			MonitorID:    m.ID,
			Status:       models.MonitorStatusDown,
			LatencyMs:    0,
			ErrorMessage: &errMsg,
			Timestamp:    time.Now(),
		}
	}
	req.Header.Set("User-Agent", "PulseNOC-Engine/2.0 (Debian/Linux; x86_64)")

	client := &http.Client{
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: false},
		},
	}

	startTime := time.Now()
	resp, err := client.Do(req)
	totalDuration := time.Since(startTime)

	if err != nil {
		errMsg := p.classifyNetworkError(err)
		return &models.Heartbeat{
			ID:           fmt.Sprintf("hb-%s", uuid.New().String()[:8]),
			MonitorID:    m.ID,
			Status:       models.MonitorStatusDown,
			LatencyMs:    int(totalDuration.Milliseconds()),
			ErrorMessage: &errMsg,
			Timestamp:    time.Now(),
		}
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, resp.Body)

	// Timing calculations
	var dnsMs, tcpMs, tlsMs, ttfbMs, transferMs int64
	if !dnsStart.IsZero() && !dnsDone.IsZero() {
		dnsMs = dnsDone.Sub(dnsStart).Milliseconds()
	}
	if !connStart.IsZero() && !connDone.IsZero() {
		tcpMs = connDone.Sub(connStart).Milliseconds()
	}
	if !tlsStart.IsZero() && !tlsDone.IsZero() {
		tlsMs = tlsDone.Sub(tlsStart).Milliseconds()
	}
	if !gotFirstByte.IsZero() {
		ttfbMs = gotFirstByte.Sub(connDone).Milliseconds()
		transferMs = time.Since(gotFirstByte).Milliseconds()
	}

	m.Timing = &models.TimingBreakdown{
		DNSLookupMs:    dnsMs,
		TCPHandshakeMs: tcpMs,
		TLSHandshakeMs: tlsMs,
		TTFBMs:         ttfbMs,
		TransferMs:     transferMs,
		TotalMs:        totalDuration.Milliseconds(),
	}

	// SSL Certificate Analysis
	if resp.TLS != nil && len(resp.TLS.PeerCertificates) > 0 {
		cert := resp.TLS.PeerCertificates[0]
		now := time.Now()
		daysRemaining := int(cert.NotAfter.Sub(now).Hours() / 24)
		isExpired := now.After(cert.NotAfter)

		m.SSLCert = &models.SSLCertificateInfo{
			Issuer:         cert.Issuer.CommonName,
			Subject:        cert.Subject.CommonName,
			ValidFrom:      cert.NotBefore,
			ValidTo:        cert.NotAfter,
			DaysRemaining:  daysRemaining,
			IsExpired:      isExpired,
			WarningTrigger: daysRemaining <= 14,
		}
	}

	statusCode := resp.StatusCode
	status := models.MonitorStatusUp
	if statusCode >= 400 && statusCode < 500 {
		status = models.MonitorStatusDegraded
	} else if statusCode >= 500 {
		status = models.MonitorStatusDown
	}

	return &models.Heartbeat{
		ID:         fmt.Sprintf("hb-%s", uuid.New().String()[:8]),
		MonitorID:  m.ID,
		Status:     status,
		LatencyMs:  int(totalDuration.Milliseconds()),
		StatusCode: &statusCode,
		Timestamp:  time.Now(),
	}
}

// TCP Socket Probe
func (p *ProberEngine) probeTCP(ctx context.Context, m *models.Monitor) *models.Heartbeat {
	targetHost := m.URL
	targetPort := 80
	if m.Port != nil && *m.Port > 0 {
		targetPort = *m.Port
	}
	addr := net.JoinHostPort(targetHost, strconv.Itoa(targetPort))

	d := net.Dialer{}
	startTime := time.Now()
	conn, err := d.DialContext(ctx, "tcp", addr)
	latency := int(time.Since(startTime).Milliseconds())

	if err != nil {
		errMsg := err.Error()
		return &models.Heartbeat{
			ID:           fmt.Sprintf("hb-%s", uuid.New().String()[:8]),
			MonitorID:    m.ID,
			Status:       models.MonitorStatusDown,
			LatencyMs:    latency,
			ErrorMessage: &errMsg,
			Timestamp:    time.Now(),
		}
	}
	defer conn.Close()

	return &models.Heartbeat{
		ID:        fmt.Sprintf("hb-%s", uuid.New().String()[:8]),
		MonitorID: m.ID,
		Status:    models.MonitorStatusUp,
		LatencyMs: latency,
		Timestamp: time.Now(),
	}
}

func (p *ProberEngine) classifyNetworkError(err error) string {
	errStr := err.Error()
	if strings.Contains(errStr, "no such host") {
		return "DNS_RESOLUTION_FAILED"
	}
	if strings.Contains(errStr, "connection refused") {
		return "CONNECTION_REFUSED"
	}
	if strings.Contains(errStr, "context deadline exceeded") || strings.Contains(errStr, "timeout") {
		return "CONNECTION_TIMEOUT"
	}
	if strings.Contains(errStr, "certificate") || strings.Contains(errStr, "x509") {
		return "SSL_CERTIFICATE_ERROR"
	}
	return errStr
}
