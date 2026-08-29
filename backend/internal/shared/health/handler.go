package health

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/IProgressX/auditor-x/backend/internal/shared/response"
)

type DatabasePinger interface{ Ping(context.Context) error }

func Handler(logger *slog.Logger, database DatabasePinger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		databaseStatus, serviceStatus, status := "not_configured", "ok", http.StatusOK
		if database != nil {
			ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
			defer cancel()
			if err := database.Ping(ctx); err != nil {
				databaseStatus, serviceStatus, status = "unavailable", "degraded", http.StatusServiceUnavailable
				logger.Error("database health check failed", "error", err)
			} else {
				databaseStatus = "connected"
			}
		}
		response.JSON(w, status, map[string]any{"data": map[string]string{"status": serviceStatus, "service": "auditorx-api", "database": databaseStatus}})
	}
}
