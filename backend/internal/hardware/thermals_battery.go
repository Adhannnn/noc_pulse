package hardware

import (
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/shirou/gopsutil/v4/host"
	"pulsenoc/backend/internal/models"
)

func GetThermals() models.HostThermalInfo {
	// 1. Try gopsutil SensorsTemperatures
	temps, err := host.SensorsTemperatures()
	if err == nil && len(temps) > 0 {
		var maxTemp float64
		var count int
		for _, t := range temps {
			if t.Temperature > 0 && t.Temperature < 125 {
				if t.Temperature > maxTemp {
					maxTemp = t.Temperature
				}
				count++
			}
		}
		if count > 0 {
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
	}

	// 2. Direct Linux sysfs fallback: /sys/class/thermal or /host/sys/class/thermal
	basePaths := []string{"/sys/class/thermal", "/host/sys/class/thermal"}
	for _, basePath := range basePaths {
		if _, err := os.Stat(basePath); err == nil {
			zones, _ := filepath.Glob(filepath.Join(basePath, "thermal_zone*"))
			var maxTemp float64
			found := false
			for _, zone := range zones {
				content, err := os.ReadFile(filepath.Join(zone, "temp"))
				if err == nil {
					raw := strings.TrimSpace(string(content))
					if milli, err := strconv.ParseFloat(raw, 64); err == nil && milli > 0 {
						celsius := milli / 1000.0
						if celsius > 0 && celsius < 125 {
							if celsius > maxTemp {
								maxTemp = celsius
							}
							found = true
						}
					}
				}
			}
			if found {
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
		}
	}

	return models.HostThermalInfo{
		CPUTempC:      nil,
		IsThrottling:  false,
		ThermalStatus: "NORMAL",
	}
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
