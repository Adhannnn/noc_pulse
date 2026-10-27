package api

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/shirou/gopsutil/v4/mem"
	"pulsenoc/backend/internal/auth"
	"pulsenoc/backend/internal/hardware"
	"pulsenoc/backend/internal/models"
	"pulsenoc/backend/internal/storage"
)

type MetricsHandler struct {
	store     *storage.PostgresStore
	collector *hardware.HardwareCollector
}

func NewMetricsHandler(store *storage.PostgresStore, collector *hardware.HardwareCollector) *MetricsHandler {
	return &MetricsHandler{store: store, collector: collector}
}

func (h *MetricsHandler) GetHistory(w http.ResponseWriter, r *http.Request) {
	limitStr := r.URL.Query().Get("limit")
	limit := 16
	if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
		limit = l
	}

	metrics, err := h.store.GetHostMetricsHistory(r.Context(), limit)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, metrics)
}

func (h *MetricsHandler) GetServerInfo(w http.ResponseWriter, r *http.Request) {
	info, err := h.collector.GetServerInfo()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, info)
}

func (h *MetricsHandler) GetMemoryDetail(w http.ResponseWriter, r *http.Request) {
	vMem, err := mem.VirtualMemory()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"totalMb":     float64(vMem.Total) / (1024 * 1024),
		"usedMb":      float64(vMem.Used) / (1024 * 1024),
		"freeMb":      float64(vMem.Free) / (1024 * 1024),
		"availableMb": float64(vMem.Available) / (1024 * 1024),
		"buffersMb":   float64(vMem.Buffers) / (1024 * 1024),
		"cachedMb":    float64(vMem.Cached) / (1024 * 1024),
		"usedPercent": vMem.UsedPercent,
	})
}

func (h *MetricsHandler) GetProcesses(w http.ResponseWriter, r *http.Request) {
	sortBy := r.URL.Query().Get("sort")
	if sortBy == "" {
		sortBy = "cpu"
	}
	limit := 25
	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
			limit = l
		}
	}

	procs, err := hardware.GetTopProcesses(sortBy, limit)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, procs)
}

func (h *MetricsHandler) KillProcess(w http.ResponseWriter, r *http.Request) {
	claims, ok := r.Context().Value(auth.UserContextKey).(*auth.Claims)
	if !ok || claims.Role != models.RoleAdmin {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "Access denied: Administrator privileges required to terminate processes."})
		return
	}

	pidStr := chi.URLParam(r, "pid")
	pid, err := strconv.ParseInt(pidStr, 10, 32)
	if err != nil || pid <= 1 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid PID"})
		return
	}

	force := r.URL.Query().Get("force") == "true"
	if err := hardware.KillProcess(int32(pid), force); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Signal successfully dispatched to process",
		"pid":     pid,
	})
}
