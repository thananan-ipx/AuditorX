package http

import (
	"net"
	"net/http"
	"sync"
	"time"

	"github.com/IProgressX/auditor-x/backend/internal/shared/response"
)

type authWindow struct {
	count int
	until time.Time
}
type authLimiter struct {
	mu      sync.Mutex
	entries map[string]authWindow
}

func (l *authLimiter) wrap(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		host, _, err := net.SplitHostPort(r.RemoteAddr)
		if err != nil {
			host = r.RemoteAddr
		}
		now := time.Now()
		l.mu.Lock()
		if len(l.entries) >= 4096 {
			for key, value := range l.entries {
				if !now.Before(value.until) {
					delete(l.entries, key)
				}
			}
		}
		entry, exists := l.entries[host]
		allowed := exists || len(l.entries) < 4096
		if !now.Before(entry.until) {
			entry = authWindow{until: now.Add(time.Minute)}
		}
		if entry.count >= 10 {
			allowed = false
		}
		if allowed {
			entry.count++
			l.entries[host] = entry
		}
		l.mu.Unlock()
		if !allowed {
			w.Header().Set("Retry-After", "60")
			response.Error(w, http.StatusTooManyRequests, "AUTH_RATE_LIMITED", "Too many attempts. Try again in a minute.")
			return
		}
		next(w, r)
	}
}
