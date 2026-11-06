package main

import (
	"context"
	"log/slog"
	"os"
	"os/exec"
	"os/signal"
	"syscall"
	"time"

	"encoding/base64"
	"github.com/IProgressX/auditor-x/backend/internal/modules/scan"
	"github.com/IProgressX/auditor-x/backend/internal/shared/database"
	"github.com/IProgressX/auditor-x/backend/internal/shared/github"
)

func main() {
	// Deliberately do not load .env or fall back to the API's DATABASE_URL.
	dsn := os.Getenv("SCAN_WORKER_DATABASE_URL")
	binary := os.Getenv("SEMGREP_EXECUTABLE")
	if dsn == "" || binary == "" {
		slog.Error("SCAN_WORKER_DATABASE_URL and SEMGREP_EXECUTABLE are required")
		os.Exit(1)
	}
	if _, err := exec.LookPath(binary); err != nil {
		slog.Error("Semgrep executable is unavailable")
		os.Exit(1)
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	pool, err := database.Connect(ctx, dsn)
	if err != nil {
		slog.Error("worker database connection failed", "error", err)
		os.Exit(1)
	}
	defer pool.Close()
	var key []byte
	if encoded := os.Getenv("GITHUB_TOKEN_ENCRYPTION_KEY"); encoded != "" {
		key, err = base64.StdEncoding.DecodeString(encoded)
		if err != nil || len(key) != 32 {
			slog.Error("GITHUB_TOKEN_ENCRYPTION_KEY must encode 32 bytes")
			os.Exit(1)
		}
	}
	store := scan.NewStore(pool)
	worker := scan.Worker{Queue: store, Source: scan.JobSource{GitHub: scan.ConnectedGitHubSource{Store: store, Client: github.NewClient(), Key: key}}, Analyzer: scan.Semgrep{Executable: binary}}
	slog.Info("scan worker ready", "rules", "baseline-v1/baseline-v2/baseline-v3/baseline-v4", "default_rules", "baseline-v4", "scope", "GitHub/local upload, Python/JS/TS/Go, detected Next.js packages")
	for ctx.Err() == nil {
		worked, err := worker.RunOne(ctx)
		if err != nil && ctx.Err() == nil {
			slog.Error("scan worker iteration failed; check database role and migrations")
		}
		if !worked || err != nil {
			select {
			case <-ctx.Done():
				return
			case <-time.After(3 * time.Second):
			}
		}
	}
}
