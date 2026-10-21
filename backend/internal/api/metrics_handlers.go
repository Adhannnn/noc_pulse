package api

import (
	"net/http"
	"strconv"

	"github.com/shirou/gopsutil/v4/mem"
	"pulsenoc/backend/internal/hardware"
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
