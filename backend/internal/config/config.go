package config

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	Port              string
	DatabaseURL       string
	RepositoryStorage string
	ScanQueueEnabled  bool
	FrontendURL       string
	CookieSecure      bool
	CookieDomain      string
}

func Load() (Config, error) {
	if err := godotenv.Load(); err != nil && !errors.Is(err, os.ErrNotExist) {
		return Config{}, fmt.Errorf("load .env: %w", err)
	}

	cookieSecure, err := strconv.ParseBool(valueOrDefault("COOKIE_SECURE", "false"))
	if err != nil {
		return Config{}, fmt.Errorf("parse COOKIE_SECURE: %w", err)
	}
	scanQueueEnabled, err := strconv.ParseBool(valueOrDefault("SCAN_QUEUE_ENABLED", "false"))
	if err != nil {
		return Config{}, fmt.Errorf("parse SCAN_QUEUE_ENABLED: %w", err)
	}

	cfg := Config{
		Port:              valueOrDefault("PORT", "8080"),
		DatabaseURL:       strings.TrimSpace(os.Getenv("DATABASE_URL")),
		RepositoryStorage: valueOrDefault("REPOSITORY_STORAGE", "prototype"),
		ScanQueueEnabled:  scanQueueEnabled,
		FrontendURL:       strings.TrimRight(valueOrDefault("FRONTEND_URL", "http://localhost:3000"), "/"),
		CookieSecure:      cookieSecure,
		CookieDomain:      strings.TrimSpace(os.Getenv("COOKIE_DOMAIN")),
	}
	if cfg.DatabaseURL == "" {
		return Config{}, errors.New("DATABASE_URL is required for local accounts")
	}
	if cfg.RepositoryStorage != "prototype" && cfg.RepositoryStorage != "postgres" {
		return Config{}, errors.New("REPOSITORY_STORAGE must be prototype or postgres")
	}
	if cfg.RepositoryStorage == "postgres" && cfg.DatabaseURL == "" {
		return Config{}, errors.New("DATABASE_URL is required for postgres repository storage")
	}
	if cfg.ScanQueueEnabled && cfg.RepositoryStorage != "postgres" {
		return Config{}, errors.New("SCAN_QUEUE_ENABLED requires postgres repository storage")
	}

	return cfg, nil
}

func valueOrDefault(name, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(name)); value != "" {
		return value
	}
	return fallback
}
