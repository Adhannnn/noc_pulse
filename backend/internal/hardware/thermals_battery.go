package hardware

import (
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/shirou/gopsutil/v4/sensors"
	"pulsenoc/backend/internal/models"
)

func GetThermals() models.HostThermalInfo {
	// Ensure HOST_SYS environment variable is set if /host/sys is available
	if os.Getenv("HOST_SYS") == "" {
		if _, err := os.Stat("/host/sys"); err == nil {
			_ = os.Setenv("HOST_SYS", "/host/sys")
		}
	}

	var temps []float64

	// Strategy 1: gopsutil v4 cross-platform sensor inspection
	if tempStats, err := sensors.SensorsTemperatures(); err == nil && len(tempStats) > 0 {
		for _, stat := range tempStats {
			if stat.Temperature >= 15 && stat.Temperature <= 125 {
				temps = append(temps, stat.Temperature)
			}
		}
	}

	// Strategy 2: Multi-source direct sysfs reading (handles relative and host-remapped symlinks)
	sysBases := []string{"/host/sys", "/sys", "/host/root/sys"}
	for _, sysBase := range sysBases {
		if _, err := os.Stat(sysBase); err != nil {
			continue
		}

		// 2a. Direct physical devices under /devices/ (bypasses symlinks completely)
		temps = append(temps, readDirectDevices(sysBase)...)

		// 2b. /class/hwmon (k10temp, amdgpu, coretemp, etc.)
		temps = append(temps, readHwmonDir(sysBase)...)

		// 2c. /class/thermal (ACPI thermal_zone)
		temps = append(temps, readThermalZones(sysBase)...)

		if len(temps) > 0 {
			break
		}
	}

	if len(temps) > 0 {
		var maxTemp float64
		for _, t := range temps {
			if t > maxTemp {
				maxTemp = t
			}
		}

		status := "NORMAL"
		throttling := false
		if maxTemp >= 85 {
			status = "CRITICAL"
			throttling = true
		} else if maxTemp >= 70 {
			status = "WARM"
		}
		rounded := roundTwoDecimals(maxTemp)
		return models.HostThermalInfo{
			CPUTempC:      &rounded,
			IsThrottling:  throttling,
			ThermalStatus: status,
		}
	}

	return models.HostThermalInfo{
		CPUTempC:      nil,
		IsThrottling:  false,
		ThermalStatus: "NORMAL",
	}
}

func readDirectDevices(basePath string) []float64 {
	var results []float64
	patterns := []string{
		filepath.Join(basePath, "devices", "virtual", "thermal", "thermal_zone*", "temp"),
		filepath.Join(basePath, "devices", "platform", "*", "hwmon", "hwmon*", "temp*_input"),
		filepath.Join(basePath, "devices", "platform", "*", "temp*_input"),
		filepath.Join(basePath, "devices", "pci*", "*", "hwmon", "hwmon*", "temp*_input"),
		filepath.Join(basePath, "devices", "pci*", "*", "*", "hwmon", "hwmon*", "temp*_input"),
		filepath.Join(basePath, "devices", "pci*", "*", "*", "*", "hwmon", "hwmon*", "temp*_input"),
	}

	for _, pattern := range patterns {
		matches, err := filepath.Glob(pattern)
		if err != nil {
			continue
		}
		for _, match := range matches {
			if t, ok := parseTempFile(match); ok {
				results = append(results, t)
			}
		}
	}

	return results
}

func readHwmonDir(basePath string) []float64 {
	var results []float64
	hwmonBase := filepath.Join(basePath, "class", "hwmon")
	entries, err := os.ReadDir(hwmonBase)
	if err != nil {
		return results
	}

	for _, entry := range entries {
		entryPath := filepath.Join(hwmonBase, entry.Name())

		// Check direct inputs
		inputs, _ := filepath.Glob(filepath.Join(entryPath, "temp*_input"))
		if len(inputs) == 0 {
			inputs, _ = filepath.Glob(filepath.Join(entryPath, "device", "temp*_input"))
		}

		// If entry is a symlink, resolve and rewrite /sys/ to basePath if absolute
		if len(inputs) == 0 {
			target, err := os.Readlink(entryPath)
			if err == nil {
				var resolved string
				if filepath.IsAbs(target) {
					if strings.HasPrefix(target, "/sys/") {
						resolved = filepath.Join(basePath, strings.TrimPrefix(target, "/sys/"))
					} else {
						resolved = target
					}
				} else {
					resolved = filepath.Clean(filepath.Join(hwmonBase, target))
				}
				inputs, _ = filepath.Glob(filepath.Join(resolved, "temp*_input"))
				if len(inputs) == 0 {
					inputs, _ = filepath.Glob(filepath.Join(resolved, "device", "temp*_input"))
				}
			}
		}

		for _, inp := range inputs {
			if t, ok := parseTempFile(inp); ok {
				results = append(results, t)
			}
		}
	}

	return results
}

func readThermalZones(basePath string) []float64 {
	var results []float64
	thermalBase := filepath.Join(basePath, "class", "thermal")
	entries, err := os.ReadDir(thermalBase)
	if err != nil {
		return results
	}

	for _, entry := range entries {
		if !strings.HasPrefix(entry.Name(), "thermal_zone") {
			continue
		}
		zonePath := filepath.Join(thermalBase, entry.Name())
		tempFile := filepath.Join(zonePath, "temp")

		if t, ok := parseTempFile(tempFile); ok {
			results = append(results, t)
			continue
		}

		// Try resolving symlink
		target, err := os.Readlink(zonePath)
		if err == nil {
			var resolved string
			if filepath.IsAbs(target) {
				if strings.HasPrefix(target, "/sys/") {
					resolved = filepath.Join(basePath, strings.TrimPrefix(target, "/sys/"))
				} else {
					resolved = target
				}
			} else {
				resolved = filepath.Clean(filepath.Join(thermalBase, target))
			}
			if t, ok := parseTempFile(filepath.Join(resolved, "temp")); ok {
				results = append(results, t)
			}
		}
	}

	return results
}

func parseTempFile(path string) (float64, bool) {
	content, err := os.ReadFile(path)
	if err != nil {
		return 0, false
	}
	raw := strings.TrimSpace(string(content))
	val, err := strconv.ParseFloat(raw, 64)
	if err != nil || val <= 0 {
		return 0, false
	}

	var celsius float64
	if val > 1000 {
		celsius = val / 1000.0
	} else if val >= 15 && val <= 125 {
		celsius = val
	}

	if celsius >= 15 && celsius <= 125 {
		return celsius, true
	}
	return 0, false
}

func GetBattery() models.HostBatteryInfo {
	basePaths := []string{"/sys/class/power_supply", "/host/sys/class/power_supply"}
	for _, basePath := range basePaths {
		if _, err := os.Stat(basePath); err == nil {
			// Check AC adapter state
			acOnline := true
			acFiles, _ := filepath.Glob(filepath.Join(basePath, "AC*"))
			if len(acFiles) == 0 {
				acFiles, _ = filepath.Glob(filepath.Join(basePath, "A*"))
			}
			for _, ac := range acFiles {
				if content, err := os.ReadFile(filepath.Join(ac, "online")); err == nil {
					acOnline = strings.TrimSpace(string(content)) == "1"
					break
				}
			}

			// Check battery BAT*
			batFiles, _ := filepath.Glob(filepath.Join(basePath, "BAT*"))
			if len(batFiles) > 0 {
				batPath := batFiles[0]
				capContent, err := os.ReadFile(filepath.Join(batPath, "capacity"))
				statusContent, _ := os.ReadFile(filepath.Join(batPath, "status"))

				if err == nil {
					capVal, _ := strconv.Atoi(strings.TrimSpace(string(capContent)))
					statusStr := strings.TrimSpace(string(statusContent))
					if statusStr == "" {
						if acOnline {
							statusStr = "AC Connected"
						} else {
							statusStr = "Discharging"
						}
					}
					isCharging := strings.EqualFold(statusStr, "Charging")
					return models.HostBatteryInfo{
						HasBattery: true,
						Percentage: capVal,
						Status:     statusStr,
						IsCharging: isCharging,
						ACOnline:   acOnline,
					}
				}
			}

			// If no BAT* found but AC adapter found
			if len(acFiles) > 0 {
				return models.HostBatteryInfo{
					HasBattery: false,
					Percentage: 100,
					Status:     "AC Powered",
					IsCharging: false,
					ACOnline:   acOnline,
				}
			}
		}
	}

	return models.HostBatteryInfo{
		HasBattery: false,
		Percentage: 100,
		Status:     "AC Powered",
		IsCharging: false,
		ACOnline:   true,
	}
}
