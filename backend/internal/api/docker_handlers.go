package api

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"pulsenoc/backend/internal/docker"
)

type DockerHandler struct {
	dockerSvc *docker.DockerService
}

func NewDockerHandler(dockerSvc *docker.DockerService) *DockerHandler {
	return &DockerHandler{dockerSvc: dockerSvc}
}

func (h *DockerHandler) ListContainers(w http.ResponseWriter, r *http.Request) {
	if h.dockerSvc == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "Docker service unavailable"})
		return
	}

	containers, err := h.dockerSvc.ListContainers(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, containers)
}

func (h *DockerHandler) StreamLogs(w http.ResponseWriter, r *http.Request) {
	if h.dockerSvc == nil {
		http.Error(w, "Docker service unavailable", http.StatusServiceUnavailable)
		return
	}

	containerID := chi.URLParam(r, "id")
	h.dockerSvc.StreamLogsWS(w, r, containerID)
}
