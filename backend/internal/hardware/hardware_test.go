package hardware

import (
	"testing"
)

func TestHardwareCollector_CollectAndServerInfo(t *testing.T) {
	collector := NewHardwareCollector(nil, nil, 8)

	// Collect local metrics
	metric, err := collector.Collect()
	if err != nil {
		t.Fatalf("Collector failed: %v", err)
	}

	if metric.RAMTotalMB <= 0 {
		t.Errorf("Expected RAMTotalMB > 0, got %f", metric.RAMTotalMB)
	}

	info, err := collector.GetServerInfo()
	if err != nil {
		t.Fatalf("GetServerInfo failed: %v", err)
	}

	if info["os"] == "" {
		t.Errorf("Expected non-empty os info")
	}

	// Test Thermals
	thermals := GetThermals()
	if thermals.ThermalStatus == "" {
		t.Errorf("Expected non-empty ThermalStatus")
	}

	// Test Battery
	battery := GetBattery()
	if battery.Status == "" {
		t.Errorf("Expected non-empty Battery status")
	}

	// Test Top Processes
	procs, err := GetTopProcesses("cpu", 10)
	if err != nil {
		t.Fatalf("GetTopProcesses failed: %v", err)
	}
	if len(procs) == 0 {
		t.Logf("Notice: 0 processes returned in test environment (normal in sandbox/ci)")
	}
}
