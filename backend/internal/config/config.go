package config

import (
	"errors"
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"

	"github.com/IProgressX/auditor-x/backend/internal/shared/github"
	"github.com/joho/godotenv"
)

type Config struct {
	Port                 string
	DatabaseURL          string
	RepositoryStorage    string
	ScanQueueEnabled     bool
	FrontendURL          string
	CookieSecure         bool
	CookieDomain         string
	GitHub               github.Config
	PredictionServiceURL string
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
		Port:                 valueOrDefault("PORT", "8080"),
		DatabaseURL:          strings.TrimSpace(os.Getenv("DATABASE_URL")),
		RepositoryStorage:    valueOrDefault("REPOSITORY_STORAGE", "prototype"),
		ScanQueueEnabled:     scanQueueEnabled,
		FrontendURL:          strings.TrimRight(valueOrDefault("FRONTEND_URL", "http://localhost:3000"), "/"),
		CookieSecure:         cookieSecure,
		CookieDomain:         strings.TrimSpace(os.Getenv("COOKIE_DOMAIN")),
		PredictionServiceURL: strings.TrimRight(strings.TrimSpace(os.Getenv("PREDICTION_SERVICE_URL")), "/"),
	}
	if cfg.DatabaseURL == "" {
		return Config{}, errors.New("DATABASE_URL is required for local accounts")
	}
	if cfg.PredictionServiceURL != "" {
		u, e := url.Parse(cfg.PredictionServiceURL)
		if e != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Hostname() == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" || (u.Path != "" && u.Path != "/") {
			return Config{}, errors.New("PREDICTION_SERVICE_URL must be an HTTP origin without credentials, path or query")
		}
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
	cfg.GitHub, err = github.LoadConfig()
	if err != nil {
		return Config{}, err
	}
	if cfg.GitHub.Enabled() && cfg.RepositoryStorage != "postgres" {
		return Config{}, errors.New("GitHub integration requires postgres repository storage")
	}

	return cfg, nil
}

func valueOrDefault(name, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(name)); value != "" {
		return value
	}
	return fallback
}
