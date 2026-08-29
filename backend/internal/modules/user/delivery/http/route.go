package http

import "net/http"

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/v1/auth/sign-in", h.SignIn)
	mux.HandleFunc("POST /api/v1/auth/sign-up", h.SignUp)
	mux.HandleFunc("POST /api/v1/auth/refresh", h.Refresh)
	mux.HandleFunc("POST /api/v1/auth/sign-out", h.SignOut)
	mux.HandleFunc("GET /api/v1/auth/me", h.Me)
}
