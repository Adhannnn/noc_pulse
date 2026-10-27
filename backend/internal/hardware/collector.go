package hardware

import (
	"context"
	"fmt"
	"log"
	"net"
	"os"
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

func init() {
	if _, err := os.Stat("/host/proc"); err == nil {
		os.Setenv("HOST_PROC", "/host/proc")
	}
	if _, err := os.Stat("/host/sys"); err == nil {
		os.Setenv("HOST_SYS", "/host/sys")
	}
}

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
			if c.store != nil {
				saveCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				_ = c.store.SaveHostMetric(saveCtx, metric)
				cancel()
			}
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

	thermal := GetThermals()
	battery := GetBattery()

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
		CPUTempC:     thermal.CPUTempC,
		Battery:      &battery,
		Timestamp:    now,
	}, nil
}

func (c *HardwareCollector) GetServerInfo() (map[string]interface{}, error) {
	hInfo, err := host.Info()
	if err != nil {
		return map[string]interface{}{
			"hostname":        "-",
			"os":              "-",
			"platform":        "-",
			"platformVersion": "-",
			"kernel":          "-",
			"kernelVersion":   "-",
			"uptime":          "-",
			"uptimeSeconds":   uint64(0),
			"cpuCores":        "-",
			"cpuCount":        0,
			"cpuModel":        "-",
			"ipAddress":       "-",
			"ipAddresses":     []string{},
		}, nil
	}

	cpuInfo, _ := cpu.Info()
	cpuModel := "-"
	if len(cpuInfo) > 0 && cpuInfo[0].ModelName != "" {
		cpuModel = cpuInfo[0].ModelName
	}

	cores, _ := cpu.Counts(true)
	if cores <= 0 {
		cores = len(cpuInfo)
	}

	// Collect host network IP addresses (non-loopback IPv4)
	var ips []string
	interfaces, err := net.Interfaces()
	if err == nil {
		for _, iface := range interfaces {
			if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
				continue
			}
			addrs, err := iface.Addrs()
			if err != nil {
				continue
			}
			for _, addr := range addrs {
				var ip net.IP
				switch v := addr.(type) {
				case *net.IPNet:
					ip = v.IP
				case *net.IPAddr:
					ip = v.IP
				}
				if ip != nil && ip.To4() != nil && !ip.IsLoopback() {
					ips = append(ips, ip.String())
				}
			}
		}
	}
	primaryIP := "-"
	if len(ips) > 0 {
		primaryIP = ips[0]
	}

	uptimeStr := formatUptime(hInfo.Uptime)
	cpuCoresStr := "-"
	if cores > 0 {
		cpuCoresStr = fmt.Sprintf("%d Cores", cores)
	}

	return map[string]interface{}{
		"hostname":        hInfo.Hostname,
		"os":              hInfo.OS,
		"platform":        hInfo.Platform,
		"platformVersion": hInfo.PlatformVersion,
		"kernel":          hInfo.KernelVersion,
		"kernelVersion":   hInfo.KernelVersion,
		"uptime":          uptimeStr,
		"uptimeSeconds":   hInfo.Uptime,
		"cpuCores":        cpuCoresStr,
		"cpuCount":        cores,
		"cpuModel":        cpuModel,
		"ipAddress":       primaryIP,
		"ipAddresses":     ips,
		"thermals":        GetThermals(),
		"battery":         GetBattery(),
	}, nil
}

func formatUptime(seconds uint64) string {
	days := seconds / 86400
	hours := (seconds % 86400) / 3600
	minutes := (seconds % 3600) / 60
	if days > 0 {
		return fmt.Sprintf("%dd %dh %dm", days, hours, minutes)
	}
	if hours > 0 {
		return fmt.Sprintf("%dh %dm", hours, minutes)
	}
	return fmt.Sprintf("%dm", minutes)
}

func roundTwoDecimals(val float64) float64 {
	return float64(int(val*100)) / 100
}
