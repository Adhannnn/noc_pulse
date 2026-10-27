package hardware

import (
	"fmt"
	"os"
	"sort"
	"strings"
	"syscall"

	"github.com/shirou/gopsutil/v4/process"
	"pulsenoc/backend/internal/models"
)

func GetTopProcesses(sortBy string, limit int) ([]models.ProcessInfo, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}

	procs, err := process.Processes()
	if err != nil {
		return nil, fmt.Errorf("failed to list processes: %w", err)
	}

	var list []models.ProcessInfo
	for _, p := range procs {
		name, err := p.Name()
		if err != nil || name == "" {
			continue
		}

		// Filter out kernel worker threads in brackets e.g. [kworker/0:0]
		if strings.HasPrefix(name, "[") && strings.HasSuffix(name, "]") {
			continue
		}

		cpuPct, _ := p.CPUPercent()
		memPct, _ := p.MemoryPercent()
		memInfo, _ := p.MemoryInfo()
		username, _ := p.Username()
		statusSlice, _ := p.Status()
		status := "R"
		if len(statusSlice) > 0 {
			status = statusSlice[0]
		}
		cmdline, _ := p.Cmdline()
		if cmdline == "" {
			cmdline = name
		}

		var memRssMB float64
		if memInfo != nil {
			memRssMB = float64(memInfo.RSS) / (1024 * 1024)
		}

		list = append(list, models.ProcessInfo{
			PID:        p.Pid,
			Name:       name,
			Username:   username,
			CPUPercent: roundTwoDecimals(cpuPct),
			MemPercent: float32(roundTwoDecimals(float64(memPct))),
			MemRSSMB:   roundTwoDecimals(memRssMB),
			Status:     status,
			Cmdline:    cmdline,
		})
	}

	if sortBy == "mem" {
		sort.Slice(list, func(i, j int) bool {
			return list[i].MemRSSMB > list[j].MemRSSMB
		})
	} else {
		// Default: sort by CPU% desc, then by MemRSSMB desc
		sort.Slice(list, func(i, j int) bool {
			if list[i].CPUPercent == list[j].CPUPercent {
				return list[i].MemRSSMB > list[j].MemRSSMB
			}
			return list[i].CPUPercent > list[j].CPUPercent
		})
	}

	if len(list) > limit {
		list = list[:limit]
	}
	return list, nil
}

func KillProcess(pid int32, force bool) error {
	if pid <= 1 {
		return fmt.Errorf("cannot terminate protected system process PID %d", pid)
	}
	sig := syscall.SIGTERM
	if force {
		sig = syscall.SIGKILL
	}
	proc, err := os.FindProcess(int(pid))
	if err != nil {
		return fmt.Errorf("process with PID %d not found: %w", pid, err)
	}
	return proc.Signal(sig)
}
