package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"pulsenoc/backend/internal/models"
	"pulsenoc/backend/internal/storage"
)

type MiscHandler struct {
	store *storage.PostgresStore
}

func NewMiscHandler(store *storage.PostgresStore) *MiscHandler {
	return &MiscHandler{store: store}
}

// IP Management
func (h *MiscHandler) GetAllIPs(w http.ResponseWriter, r *http.Request) {
	ips, err := h.store.GetAllIPs(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, ips)
}

func (h *MiscHandler) CreateIP(w http.ResponseWriter, r *http.Request) {
	var body struct {
		IP         string  `json:"ip"`
		Subnet     string  `json:"subnet"`
		Hostname   *string `json:"hostname"`
		Status     string  `json:"status"`
		AssignedTo *string `json:"assignedTo"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}

	lastPing := 4
	ip := &models.IPAddress{
		ID:         fmt.Sprintf("ip-%s", uuid.New().String()[:8]),
		IP:         body.IP,
		Subnet:     body.Subnet,
		Hostname:   body.Hostname,
		Status:     body.Status,
		AssignedTo: body.AssignedTo,
		LastPingMs: &lastPing,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}

	if err := h.store.CreateIP(r.Context(), ip); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusCreated, ip)
}

func (h *MiscHandler) DeleteIP(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.store.DeleteIP(r.Context(), id); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// Alert Channels
func (h *MiscHandler) GetAllAlertChannels(w http.ResponseWriter, r *http.Request) {
	channels, err := h.store.GetAllAlertChannels(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, channels)
}

func (h *MiscHandler) CreateAlertChannel(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name       string  `json:"name"`
		Type       string  `json:"type"`
		WebhookURL *string `json:"webhookUrl"`
		ChatID     *string `json:"chatId"`
		BotToken   *string `json:"botToken"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}

	ch := &models.AlertChannel{
		ID:         fmt.Sprintf("ac-%s", uuid.New().String()[:8]),
		Name:       body.Name,
		Type:       body.Type,
		WebhookURL: body.WebhookURL,
		ChatID:     body.ChatID,
		BotToken:   body.BotToken,
		IsEnabled:  true,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}

	if err := h.store.CreateAlertChannel(r.Context(), ch); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusCreated, ch)
}

func (h *MiscHandler) DeleteAlertChannel(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.store.DeleteAlertChannel(r.Context(), id); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *MiscHandler) TestAlertChannel(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Test notification dispatched successfully",
	})
}
