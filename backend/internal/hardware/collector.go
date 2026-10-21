package hardware

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/shirou/gopsutil/v4/cpu"
	"github.com/shirou/gopsutil/v4/disk"
	"github.com/shirou/gopsutil/v4/host"
	"github.com/shirou/gopsutil/v4/mem"
	netUtil "github.com/shirou/gopsutil/v4/net"
	"pulsenoc/backend/internal/models"
	"pulsenoc/backend/internal/storage"
	"pulsenoc/backend/internal/websocket"
)

type HardwareCollector struct {
	store       *storage.PostgresStore
	hub         *websocket.Hub
	totalRAMGB  int
	lastNetIn   uint64
	lastNetOut  uint64
	lastDiskRd  uint64
	lastDiskWr  uint64
	lastChecked time.Time
}

func NewHardwareCollector(store *storage.PostgresStore, hub *websocket.Hub, totalRAMGB int) *HardwareCollector {
	return &HardwareCollector{
		store:       store,
		hub:         hub,
		totalRAMGB:  totalRAMGB,
		lastChecked: time.Now(),
	}
}

func (c *HardwareCollector) Start(ctx context.Context) {
	ticker := time.NewTicker(2 * time.Second)
	saveTicker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	defer saveTicker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			metric, err := c.Collect()
			if err != nil {
				log.Printf("[Hardware] Collect error: %v", err)
				continue
			}

			// Realtime broadcast to all connected frontend clients
			c.hub.Broadcast("metrics:host", metric)

		case <-saveTicker.C:
			metric, err := c.Collect()
			if err != nil {
				continue
			}
			// Persist to PostgreSQL every 30s for historical telemetry charts
			saveCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			_ = c.store.SaveHostMetric(saveCtx, metric)
			cancel()
		}
	}
}

func (c *HardwareCollector) Collect() (*models.HostMetric, error) {
	now := time.Now()
	duration := now.Sub(c.lastChecked).Seconds()
	if duration <= 0 {
		duration = 1
	}

	// 1. CPU Usage
	cpuPercents, err := cpu.Percent(0, false)
	var cpuUsage float64
	if err == nil && len(cpuPercents) > 0 {
		cpuUsage = cpuPercents[0]
	}

	// 2. RAM Usage
	vMem, err := mem.VirtualMemory()
	var ramUsedMB, ramTotalMB float64
	if err == nil {
		ramUsedMB = float64(vMem.Used) / (1024 * 1024)
		ramTotalMB = float64(vMem.Total) / (1024 * 1024)
	}
	if c.totalRAMGB > 0 && ramTotalMB == 0 {
		ramTotalMB = float64(c.totalRAMGB) * 1024
	}

	// 3. Disk Partitions (Root /)
	diskStat, err := disk.Usage("/")
	var diskUsagePct, diskUsedGB, diskTotalGB float64
	if err == nil {
		diskUsagePct = diskStat.UsedPercent
		diskUsedGB = float64(diskStat.Used) / (1024 * 1024 * 1024)
		diskTotalGB = float64(diskStat.Total) / (1024 * 1024 * 1024)
	}

	// 4. Disk IO delta
	var diskReadKB, diskWriteKB float64
	diskIO, err := disk.IOCounters()
	if err == nil {
		var totalRead, totalWrite uint64
		for _, io := range diskIO {
			totalRead += io.ReadBytes
			totalWrite += io.WriteBytes
		}
		if c.lastDiskRd > 0 && totalRead >= c.lastDiskRd {
			diskReadKB = float64(totalRead-c.lastDiskRd) / (1024 * duration)
		}
		if c.lastDiskWr > 0 && totalWrite >= c.lastDiskWr {
			diskWriteKB = float64(totalWrite-c.lastDiskWr) / (1024 * duration)
		}
		c.lastDiskRd = totalRead
		c.lastDiskWr = totalWrite
	}

	// 5. Network IO delta
	var netInKB, netOutKB float64
	netIO, err := netUtil.IOCounters(false)
	if err == nil && len(netIO) > 0 {
		bytesRecv := netIO[0].BytesRecv
		bytesSent := netIO[0].BytesSent
		if c.lastNetIn > 0 && bytesRecv >= c.lastNetIn {
			netInKB = float64(bytesRecv-c.lastNetIn) / (1024 * duration)
		}
		if c.lastNetOut > 0 && bytesSent >= c.lastNetOut {
			netOutKB = float64(bytesSent-c.lastNetOut) / (1024 * duration)
		}
		c.lastNetIn = bytesRecv
		c.lastNetOut = bytesSent
	}
	c.lastChecked = now

	return &models.HostMetric{
		ID:           fmt.Sprintf("hm-%s", uuid.New().String()[:8]),
		CPUUsage:     roundTwoDecimals(cpuUsage),
		RAMUsedMB:    roundTwoDecimals(ramUsedMB),
		RAMTotalMB:   roundTwoDecimals(ramTotalMB),
		DiskUsagePct: roundTwoDecimals(diskUsagePct),
		DiskUsedGB:   roundTwoDecimals(diskUsedGB),
		DiskTotalGB:  roundTwoDecimals(diskTotalGB),
		DiskReadKB:   roundTwoDecimals(diskReadKB),
		DiskWriteKB:  roundTwoDecimals(diskWriteKB),
		NetworkInKB:  roundTwoDecimals(netInKB),
		NetworkOutKB: roundTwoDecimals(netOutKB),
		Timestamp:    now,
	}, nil
}

func (c *HardwareCollector) GetServerInfo() (map[string]interface{}, error) {
	hInfo, err := host.Info()
	if err != nil {
		return map[string]interface{}{
			"hostname": "debian-server",
			"os":       "linux",
			"platform": "debian",
			"uptime":   86400,
		}, nil
	}

	cpuInfo, _ := cpu.Info()
	cpuModel := "Native CPU"
	if len(cpuInfo) > 0 {
		cpuModel = cpuInfo[0].ModelName
	}

	return map[string]interface{}{
		"hostname":        hInfo.Hostname,
		"os":              hInfo.OS,
		"platform":        hInfo.Platform,
		"platformVersion": hInfo.PlatformVersion,
		"kernelVersion":   hInfo.KernelVersion,
		"uptime":          hInfo.Uptime,
		"cpuModel":        cpuModel,
	}, nil
}

func roundTwoDecimals(val float64) float64 {
	return float64(int(val*100)) / 100
}
