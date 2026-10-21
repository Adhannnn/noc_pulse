package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"pulsenoc/backend/internal/models"
	"pulsenoc/backend/internal/prober"
	"pulsenoc/backend/internal/storage"
)

type MonitorsHandler struct {
	store  *storage.PostgresStore
	prober *prober.ProberEngine
}

func NewMonitorsHandler(store *storage.PostgresStore, prober *prober.ProberEngine) *MonitorsHandler {
	return &MonitorsHandler{store: store, prober: prober}
}

func (h *MonitorsHandler) GetAllMonitors(w http.ResponseWriter, r *http.Request) {
	monitors, err := h.store.GetAllMonitors(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, monitors)
}

func (h *MonitorsHandler) GetMonitorByID(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	m, err := h.store.GetMonitorByID(r.Context(), id)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "Monitor not found"})
		return
	}
	// Run single probe synchronously to fill latest waterfall timing & SSL info
	h.prober.ProbeSingle(r.Context(), m)
	writeJSON(w, http.StatusOK, m)
}

func (h *MonitorsHandler) CreateMonitor(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name        string             `json:"name"`
		Type        models.MonitorType `json:"type"`
		URL         string             `json:"url"`
		Port        *int               `json:"port"`
		Group       string             `json:"group"`
		IntervalSec int                `json:"intervalSec"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}

	if body.Group == "" {
		body.Group = "Home DC"
	}
	if body.IntervalSec <= 0 {
		body.IntervalSec = 60
	}

	m := &models.Monitor{
		ID:               fmt.Sprintf("mon-%s", uuid.New().String()[:8]),
		Name:             body.Name,
		Type:             body.Type,
		URL:              body.URL,
		Port:             body.Port,
		Group:            body.Group,
		IntervalSec:      body.IntervalSec,
		TimeoutSec:       10,
		IsActive:         true,
		CurrentStatus:    models.MonitorStatusPending,
		UptimePercent24h: 100.0,
		CreatedAt:        time.Now(),
		UpdatedAt:        time.Now(),
	}

	if err := h.store.CreateMonitor(r.Context(), m); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	// Trigger immediate probe in background
	go h.prober.ProbeSingle(r.Context(), m)

	writeJSON(w, http.StatusCreated, m)
}

func (h *MonitorsHandler) UpdateMonitor(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var body struct {
		Name        string `json:"name"`
		Group       string `json:"group"`
		URL         string `json:"url"`
		Port        *int   `json:"port"`
		IntervalSec int    `json:"intervalSec"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}

	if err := h.store.UpdateMonitor(r.Context(), id, body.Name, body.Group, body.URL, body.Port, body.IntervalSec); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *MonitorsHandler) DeleteMonitor(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.store.DeleteMonitor(r.Context(), id); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// Groups Handlers
func (h *MonitorsHandler) GetAllGroups(w http.ResponseWriter, r *http.Request) {
	groups, err := h.store.GetAllGroups(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, groups)
}

func (h *MonitorsHandler) CreateGroup(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}

	g := &models.ServiceGroup{
		ID:        fmt.Sprintf("grp-%s", uuid.New().String()[:8]),
		Name:      body.Name,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if err := h.store.CreateGroup(r.Context(), g); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusCreated, g)
}

func (h *MonitorsHandler) RenameGroup(w http.ResponseWriter, r *http.Request) {
	var body struct {
		OldName string `json:"oldName"`
		NewName string `json:"newName"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}

	if err := h.store.RenameGroup(r.Context(), body.OldName, body.NewName); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *MonitorsHandler) DeleteGroup(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	if err := h.store.DeleteGroup(r.Context(), name); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *MonitorsHandler) GetAllIncidents(w http.ResponseWriter, r *http.Request) {
	incidents, err := h.store.GetAllIncidents(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, incidents)
}
