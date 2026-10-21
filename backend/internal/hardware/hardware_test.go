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
}
