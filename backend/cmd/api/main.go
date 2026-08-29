package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/IProgressX/auditor-x/backend/internal/config"
	"github.com/IProgressX/auditor-x/backend/internal/modules/audit"
	"github.com/IProgressX/auditor-x/backend/internal/modules/project"
	projectrepo "github.com/IProgressX/auditor-x/backend/internal/modules/project/repository"
	projectservice "github.com/IProgressX/auditor-x/backend/internal/modules/project/service"
	"github.com/IProgressX/auditor-x/backend/internal/modules/scan"
	"github.com/IProgressX/auditor-x/backend/internal/modules/user"
	"github.com/IProgressX/auditor-x/backend/internal/shared/database"
	"github.com/IProgressX/auditor-x/backend/internal/shared/health"
	"github.com/IProgressX/auditor-x/backend/internal/shared/logger"
	"github.com/IProgressX/auditor-x/backend/internal/shared/middleware"
	"github.com/IProgressX/auditor-x/backend/internal/shared/response"
)

func main() {
	appLogger := logger.New(os.Stdout)
	cfg, err := config.Load()
	if err != nil {
		appLogger.Error("configuration startup failed", "error", err)
		os.Exit(1)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	databasePool, err := database.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		appLogger.Error("database startup failed", "error", err)
		os.Exit(1)
	}
	if databasePool == nil {
		appLogger.Warn("DATABASE_URL is not set")
	} else {
		defer databasePool.Close()
		appLogger.Info("database connection established")
	}
	appLogger.Info("repository storage selected", "mode", cfg.RepositoryStorage)

	userModule, err := user.NewModule(cfg)
	if err != nil {
		appLogger.Error("user module startup failed", "error", err)
		os.Exit(1)
	}
	handler := newHandler(cfg, appLogger, databasePool, userModule)

	server := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	appLogger.Info("AuditorX API listening", "address", server.Addr)
	serverErrors := make(chan error, 1)
	go func() {
		serverErrors <- server.ListenAndServe()
	}()

	select {
	case <-ctx.Done():
		appLogger.Info("shutdown requested")
	case err := <-serverErrors:
		if err != nil && err != http.ErrServerClosed {
			appLogger.Error("server stopped", "error", err)
			os.Exit(1)
		}
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		appLogger.Error("graceful shutdown failed", "error", err)
	}
}

func newHandler(cfg config.Config, appLogger *slog.Logger, databasePool *database.Pool, userModule interface {
	RegisterRoutes(*http.ServeMux)
	Authenticate(http.ResponseWriter, *http.Request) bool
}) http.Handler {
	mux := http.NewServeMux()
	// Do not wrap a nil *Pool in an interface: that would look non-nil to health.
	var pinger health.DatabasePinger
	if databasePool != nil {
		pinger = databasePool
	}
	mux.HandleFunc("GET /health", health.Handler(appLogger, pinger))
	userModule.RegisterRoutes(mux)
	// Describe product availability, never database connection details or credentials.
	mux.HandleFunc("GET /api/v1/capabilities", func(w http.ResponseWriter, r *http.Request) {
		mode := "prototype"
		if cfg.RepositoryStorage == "postgres" {
			mode = "postgres"
		}
		w.Header().Set("Cache-Control", "no-store")
		response.JSON(w, http.StatusOK, map[string]any{"data": map[string]any{
			"repository_storage":  mode,
			"repository_creation": mode == "postgres",
			"scan_execution":      false,
			"scan_queue":          cfg.ScanQueueEnabled && mode == "postgres",
		}})
	})
	if cfg.RepositoryStorage == "postgres" {
		var scanHandler interface{ RegisterRoutes(*http.ServeMux) }
		if cfg.ScanQueueEnabled {
			scanHandler = scan.Handler{Repositories: projectservice.New(projectrepo.NewPostgres(databasePool)), Jobs: scan.NewStore(databasePool)}
		}
		project.NewModule(databasePool).RegisterRoutesWithScans(mux, scanHandler)
	} else {
		audit.NewModule().RegisterRoutes(mux)
	}
	return middleware.HTTP(appLogger, cfg.FrontendURL, userModule.Authenticate)(mux)
}
