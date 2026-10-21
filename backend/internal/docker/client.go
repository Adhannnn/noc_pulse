package docker

import (
	"bufio"
	"context"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/gorilla/websocket"
	moby "github.com/moby/moby/client"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type ContainerInfo struct {
	ID      string   `json:"id"`
	Names   []string `json:"names"`
	Image   string   `json:"image"`
	State   string   `json:"state"`
	Status  string   `json:"status"`
	Created int64    `json:"created"`
}

type DockerService struct {
	cli *moby.Client
}

func NewDockerService() (*DockerService, error) {
	cli, err := moby.NewClientWithOpts(moby.FromEnv, moby.WithAPIVersionNegotiation())
	if err != nil {
		return nil, fmt.Errorf("failed to init docker client: %w", err)
	}
	return &DockerService{cli: cli}, nil
}

func (s *DockerService) ListContainers(ctx context.Context) ([]ContainerInfo, error) {
	result, err := s.cli.ContainerList(ctx, moby.ContainerListOptions{All: true})
	if err != nil {
		return nil, err
	}

	var list []ContainerInfo
	for _, c := range result.Items {
		var cleanedNames []string
		for _, n := range c.Names {
			cleanedNames = append(cleanedNames, strings.TrimPrefix(n, "/"))
		}

		list = append(list, ContainerInfo{
			ID:      c.ID[:12],
			Names:   cleanedNames,
			Image:   c.Image,
			State:   string(c.State),
			Status:  c.Status,
			Created: c.Created,
		})
	}
	return list, nil
}

func (s *DockerService) StreamLogsWS(w http.ResponseWriter, r *http.Request, containerID string) {
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[Docker] WS Upgrade error: %v", err)
		return
	}
	defer ws.Close()

	tailStr := r.URL.Query().Get("tail")
	if tailStr == "" {
		tailStr = "150"
	}
	if _, err := strconv.Atoi(tailStr); err != nil {
		tailStr = "150"
	}

	opts := moby.ContainerLogsOptions{
		ShowStdout: true,
		ShowStderr: true,
		Follow:     true,
		Tail:       tailStr,
		Timestamps: true,
	}

	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()

	logsResult, err := s.cli.ContainerLogs(ctx, containerID, opts)
	if err != nil {
		_ = ws.WriteJSON(map[string]string{"error": fmt.Sprintf("Failed to fetch logs: %v", err)})
		return
	}
	defer logsResult.Close()

	scanner := bufio.NewScanner(logsResult)
	// Docker log streams have an 8-byte multiplex header if TTY is not enabled.
	for scanner.Scan() {
		raw := scanner.Bytes()
		// Strip multiplex header if present
		var cleanLine string
		if len(raw) > 8 && (raw[0] == 1 || raw[0] == 2) {
			cleanLine = string(raw[8:])
		} else {
			cleanLine = string(raw)
		}

		if err := ws.WriteMessage(websocket.TextMessage, []byte(cleanLine)); err != nil {
			break
		}
	}
}

func (s *DockerService) Close() {
	if s.cli != nil {
		_ = s.cli.Close()
	}
}
