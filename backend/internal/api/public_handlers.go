package api

import (
	"net/http"
	"time"

	"pulsenoc/backend/internal/models"
	"pulsenoc/backend/internal/storage"
)

type PublicHeartbeatInfo struct {
	Status    models.MonitorStatus `json:"status"`
	LatencyMs int                  `json:"latencyMs"`
	Timestamp time.Time            `json:"timestamp"`
}

type PublicMonitorInfo struct {
	ID               string                `json:"id"`
	Name             string                `json:"name"`
	Type             models.MonitorType    `json:"type"`
	Group            string                `json:"group"`
	CurrentStatus    models.MonitorStatus  `json:"currentStatus"`
	UptimePercent24h float64               `json:"uptimePercent24h"`
	LastProbedAt     *time.Time            `json:"lastProbedAt,omitempty"`
	SSLDaysRemaining *int                  `json:"sslDaysRemaining,omitempty"`
	Heartbeats       []PublicHeartbeatInfo `json:"heartbeats"`
}

type PublicGroupInfo struct {
	Name          string              `json:"name"`
	Status        string              `json:"status"` // OPERATIONAL, DEGRADED, OUTAGE
	UptimePercent float64             `json:"uptimePercent"`
	Monitors      []PublicMonitorInfo `json:"monitors"`
}

type PublicStatusResponse struct {
	OverallStatus   string            `json:"overallStatus"` // ALL_OPERATIONAL, DEGRADED, MAJOR_OUTAGE
	SystemUptime    float64           `json:"systemUptime"`
	LastUpdated     time.Time         `json:"lastUpdated"`
	Groups          []PublicGroupInfo `json:"groups"`
	ActiveIncidents []models.Incident `json:"activeIncidents"`
	PastIncidents   []models.Incident `json:"pastIncidents"`
}

type PublicHandler struct {
	store *storage.PostgresStore
}

func NewPublicHandler(store *storage.PostgresStore) *PublicHandler {
	return &PublicHandler{store: store}
}

func (h *PublicHandler) GetPublicStatus(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	monitors, err := h.store.GetAllMonitors(ctx)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to load status metrics"})
		return
	}

	incidents, err := h.store.GetAllIncidents(ctx)
	if err != nil {
		incidents = []models.Incident{}
	}

	activeIncidents := make([]models.Incident, 0)
	pastIncidents := make([]models.Incident, 0)
	for _, inc := range incidents {
		if inc.Status != "RESOLVED" {
			activeIncidents = append(activeIncidents, inc)
		} else {
			if len(pastIncidents) < 10 {
				pastIncidents = append(pastIncidents, inc)
			}
		}
	}

	// Group monitors
	groupMap := make(map[string][]PublicMonitorInfo)
	var totalUptime float64
	var activeCount int

	hasDown := false
	hasDegraded := false

	for _, m := range monitors {
		if !m.IsActive {
			continue
		}
		activeCount++
		totalUptime += m.UptimePercent24h

		if m.CurrentStatus == models.MonitorStatusDown {
			hasDown = true
		} else if m.CurrentStatus == models.MonitorStatusDegraded {
			hasDegraded = true
		}

		gName := m.Group
		if gName == "" {
			gName = "Default"
		}

		hbList := make([]PublicHeartbeatInfo, 0, len(m.Heartbeats))
		for _, hb := range m.Heartbeats {
			hbList = append(hbList, PublicHeartbeatInfo{
				Status:    hb.Status,
				LatencyMs: hb.LatencyMs,
				Timestamp: hb.Timestamp,
			})
		}

		var sslDays *int
		if m.SSLCert != nil {
			days := m.SSLCert.DaysRemaining
			sslDays = &days
		}

		pubM := PublicMonitorInfo{
			ID:               m.ID,
			Name:             m.Name,
			Type:             m.Type,
			Group:            gName,
			CurrentStatus:    m.CurrentStatus,
			UptimePercent24h: m.UptimePercent24h,
			LastProbedAt:     m.LastProbedAt,
			SSLDaysRemaining: sslDays,
			Heartbeats:       hbList,
		}

		groupMap[gName] = append(groupMap[gName], pubM)
	}

	overallStatus := "ALL_OPERATIONAL"
	if hasDown || len(activeIncidents) > 0 {
		overallStatus = "MAJOR_OUTAGE"
	} else if hasDegraded {
		overallStatus = "DEGRADED"
	}

	systemUptime := 100.0
	if activeCount > 0 {
		systemUptime = float64(int((totalUptime/float64(activeCount))*100)) / 100
	}

	groups := make([]PublicGroupInfo, 0, len(groupMap))
	for name, mList := range groupMap {
		var gUptime float64
		gHasDown := false
		gHasDegraded := false

		for _, m := range mList {
			gUptime += m.UptimePercent24h
			if m.CurrentStatus == models.MonitorStatusDown {
				gHasDown = true
			} else if m.CurrentStatus == models.MonitorStatusDegraded {
				gHasDegraded = true
			}
		}

		gStatus := "OPERATIONAL"
		if gHasDown {
			gStatus = "OUTAGE"
		} else if gHasDegraded {
			gStatus = "DEGRADED"
		}

		avgUptime := 100.0
		if len(mList) > 0 {
			avgUptime = float64(int((gUptime/float64(len(mList)))*100)) / 100
		}

		groups = append(groups, PublicGroupInfo{
			Name:          name,
			Status:        gStatus,
			UptimePercent: avgUptime,
			Monitors:      mList,
		})
	}

	resp := PublicStatusResponse{
		OverallStatus:   overallStatus,
		SystemUptime:    systemUptime,
		LastUpdated:     time.Now().UTC(),
		Groups:          groups,
		ActiveIncidents: activeIncidents,
		PastIncidents:   pastIncidents,
	}

	writeJSON(w, http.StatusOK, resp)
}
