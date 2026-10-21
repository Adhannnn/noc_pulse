package config

import (
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	Port              string
	DatabaseURL       string
	JWTSecret         string
	HostTotalRamGB    int
	DiscordWebhookURL string
	TelegramBotToken  string
	TelegramChatID    string
}

func LoadConfig() *Config {
	_ = godotenv.Load(".env", "../.env")

	port := getEnv("PORT", "4000")
	dbURL := getEnv("DATABASE_URL", "postgresql://postgres:postgres123@host.docker.internal:5432/pulse_noc?schema=public")
	jwtSecret := getEnv("JWT_SECRET", "super-secret-pulsenoc-jwt-key-2026")
	
	ramGBStr := getEnv("HOST_TOTAL_RAM_GB", "4")
	ramGB, err := strconv.Atoi(ramGBStr)
	if err != nil || ramGB <= 0 {
		ramGB = 4
	}

	return &Config{
		Port:              port,
		DatabaseURL:       dbURL,
		JWTSecret:         jwtSecret,
		HostTotalRamGB:    ramGB,
		DiscordWebhookURL: getEnv("DISCORD_WEBHOOK_URL", ""),
		TelegramBotToken:  getEnv("TELEGRAM_BOT_TOKEN", ""),
		TelegramChatID:    getEnv("TELEGRAM_CHAT_ID", ""),
	}
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}
