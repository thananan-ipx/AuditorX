package http

import "net/http"

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	private := func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Cache-Control", "no-store")
			next(w, r)
		}
	}
	limiter := &authLimiter{entries: make(map[string]authWindow)}
	mux.HandleFunc("POST /api/v1/auth/sign-in", private(limiter.wrap(h.SignIn)))
	mux.HandleFunc("POST /api/v1/auth/sign-up", private(limiter.wrap(h.SignUp)))
	mux.HandleFunc("POST /api/v1/auth/refresh", private(h.Refresh))
	mux.HandleFunc("POST /api/v1/auth/sign-out", private(h.SignOut))
	mux.HandleFunc("GET /api/v1/auth/me", private(h.Me))
}
