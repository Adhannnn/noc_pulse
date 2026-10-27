package models

import "time"

type UserRole string

const (
	RoleAdmin    UserRole = "ADMIN"
	RoleOperator UserRole = "OPERATOR"
)

type User struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	Name      string    `json:"name"`
	Password  string    `json:"-"`
	Role      UserRole  `json:"role"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type MonitorType string

const (
	MonitorTypeHTTP     MonitorType = "HTTP"
	MonitorTypeTCP      MonitorType = "TCP"
	MonitorTypePing     MonitorType = "PING"
	MonitorTypeDatabase MonitorType = "DATABASE"
)

type MonitorStatus string

const (
	MonitorStatusUp       MonitorStatus = "UP"
	MonitorStatusDegraded MonitorStatus = "DEGRADED"
	MonitorStatusDown     MonitorStatus = "DOWN"
	MonitorStatusPending  MonitorStatus = "PENDING"
)

type TimingBreakdown struct {
	DNSLookupMs    int64 `json:"dnsLookupMs"`
	TCPHandshakeMs int64 `json:"tcpHandshakeMs"`
	TLSHandshakeMs int64 `json:"tlsHandshakeMs"`
	TTFBMs         int64 `json:"ttfbMs"`
	TransferMs     int64 `json:"transferMs"`
	TotalMs        int64 `json:"totalMs"`
}

type SSLCertificateInfo struct {
	Issuer         string     `json:"issuer"`
	Subject        string     `json:"subject"`
	ValidFrom      time.Time  `json:"validFrom"`
	ValidTo        time.Time  `json:"validTo"`
	DaysRemaining  int        `json:"daysRemaining"`
	IsExpired      bool       `json:"isExpired"`
	WarningTrigger bool       `json:"warningTrigger"`
}

type Monitor struct {
	ID               string              `json:"id"`
	Name             string              `json:"name"`
	Type             MonitorType         `json:"type"`
	URL              string              `json:"url"`
	Port             *int                `json:"port,omitempty"`
	Group            string              `json:"group"`
	IntervalSec      int                 `json:"intervalSec"`
	TimeoutSec       int                 `json:"timeoutSec"`
	IsActive         bool                `json:"isActive"`
	CurrentStatus    MonitorStatus       `json:"currentStatus"`
	UptimePercent24h float64             `json:"uptimePercent24h"`
	LastProbedAt     *time.Time          `json:"lastProbedAt,omitempty"`
	DataCenterID     *string             `json:"dataCenterId,omitempty"`
	CreatedAt        time.Time           `json:"createdAt"`
	UpdatedAt        time.Time           `json:"updatedAt"`
	Timing           *TimingBreakdown    `json:"timing,omitempty"`
	SSLCert          *SSLCertificateInfo `json:"sslCert,omitempty"`
	Heartbeats       []Heartbeat         `json:"heartbeats"`
}

type Heartbeat struct {
	ID           string        `json:"id"`
	MonitorID    string        `json:"monitorId"`
	Status       MonitorStatus `json:"status"`
	LatencyMs    int           `json:"latencyMs"`
	StatusCode   *int          `json:"statusCode,omitempty"`
	ErrorMessage *string       `json:"errorMessage,omitempty"`
	Timestamp    time.Time     `json:"timestamp"`
}

type HostThermalInfo struct {
	CPUTempC      *float64 `json:"cpuTempC,omitempty"`
	IsThrottling  bool     `json:"isThrottling"`
	ThermalStatus string   `json:"thermalStatus"` // NORMAL, WARM, CRITICAL
}

type HostBatteryInfo struct {
	HasBattery bool   `json:"hasBattery"`
	Percentage int    `json:"percentage"`
	Status     string `json:"status"` // Charging, Discharging, Full, AC Connected
	IsCharging bool   `json:"isCharging"`
	ACOnline   bool   `json:"acOnline"`
}

type ProcessInfo struct {
	PID        int32   `json:"pid"`
	Name       string  `json:"name"`
	Username   string  `json:"username"`
	CPUPercent float64 `json:"cpuPercent"`
	MemPercent float32 `json:"memPercent"`
	MemRSSMB   float64 `json:"memRssMb"`
	Status     string  `json:"status"`
	Cmdline    string  `json:"cmdline"`
}

type HostMetric struct {
	ID           string           `json:"id"`
	CPUUsage     float64          `json:"cpuUsage"`
	RAMUsedMB    float64          `json:"ramUsedMb"`
	RAMTotalMB   float64          `json:"ramTotalMb"`
	DiskUsagePct float64          `json:"diskUsagePct"`
	DiskUsedGB   float64          `json:"diskUsedGb"`
	DiskTotalGB  float64          `json:"diskTotalGb"`
	DiskReadKB   float64          `json:"diskReadKb"`
	DiskWriteKB  float64          `json:"diskWriteKb"`
	NetworkInKB  float64          `json:"networkInKb"`
	NetworkOutKB float64          `json:"networkOutKb"`
	CPUTempC     *float64         `json:"cpuTempC,omitempty"`
	Battery      *HostBatteryInfo `json:"battery,omitempty"`
	Timestamp    time.Time        `json:"timestamp"`
}

type ServiceGroup struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type DatabaseConnection struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Engine      string    `json:"engine"`
	Host        string    `json:"host"`
	Port        int       `json:"port"`
	Database    string    `json:"database"`
	Username    string    `json:"username"`
	Password    *string   `json:"password,omitempty"`
	Status      string    `json:"status"`
	LatencyMs   int       `json:"latencyMs"`
	Connections int       `json:"connections"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

type AlertChannel struct {
	ID         string    `json:"id"`
	Name       string    `json:"name"`
	Type       string    `json:"type"`
	WebhookURL *string   `json:"webhookUrl,omitempty"`
	ChatID     *string   `json:"chatId,omitempty"`
	BotToken   *string   `json:"botToken,omitempty"`
	IsEnabled  bool      `json:"isEnabled"`
	CreatedAt  time.Time `json:"createdAt"`
	UpdatedAt  time.Time `json:"updatedAt"`
}

type IPAddress struct {
	ID         string    `json:"id"`
	IP         string    `json:"ip"`
	Subnet     string    `json:"subnet"`
	Hostname   *string   `json:"hostname,omitempty"`
	Status     string    `json:"status"`
	AssignedTo *string   `json:"assignedTo,omitempty"`
	LastPingMs *int      `json:"lastPingMs,omitempty"`
	CreatedAt  time.Time `json:"createdAt"`
	UpdatedAt  time.Time `json:"updatedAt"`
}

type BackupRecord struct {
	ID         string    `json:"id"`
	DeviceName string    `json:"deviceName"`
	Filename   string    `json:"filename"`
	SizeKB     int       `json:"sizeKb"`
	Status     string    `json:"status"`
	CreatedAt  time.Time `json:"createdAt"`
}

type Incident struct {
	ID          string    `json:"id"`
	MonitorID   string    `json:"monitorId"`
	Title       string    `json:"title"`
	Description *string   `json:"description,omitempty"`
	Severity    string    `json:"severity"`
	Status      string    `json:"status"`
	StartedAt   time.Time `json:"startedAt"`
	ResolvedAt  *time.Time `json:"resolvedAt,omitempty"`
}
