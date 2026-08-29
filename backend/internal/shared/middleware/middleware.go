package middleware

import (
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/IProgressX/auditor-x/backend/internal/shared/response"
)

type Authenticator func(http.ResponseWriter, *http.Request) bool

func HTTP(logger *slog.Logger, frontendURL string, authenticate Authenticator) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			started := time.Now()
			origin := r.Header.Get("Origin")
			if origin == frontendURL {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Access-Control-Allow-Credentials", "true")
				w.Header().Add("Vary", "Origin")
			}
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			if r.Method != http.MethodGet && r.Method != http.MethodHead && origin != "" && origin != frontendURL {
				response.Error(w, http.StatusForbidden, "ORIGIN_NOT_ALLOWED", "The request origin is not allowed.")
				return
			}
			if isProtected(r.URL.Path) && !authenticate(w, r) {
				return
			}
			next.ServeHTTP(w, r)
			logger.Info("request", "method", r.Method, "path", r.URL.Path, "duration", time.Since(started))
		})
	}
}

func isProtected(path string) bool {
	return strings.HasPrefix(path, "/api/v1/") && !strings.HasPrefix(path, "/api/v1/auth/")
}
