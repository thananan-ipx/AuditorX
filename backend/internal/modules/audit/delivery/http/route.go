package http

import "net/http"

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/v1/repositories", h.Repositories)
	mux.HandleFunc("GET /api/v1/repositories/{repositoryID}/dashboard", h.Dashboard)
	mux.HandleFunc("POST /api/v1/repositories/{repositoryID}/scans", h.StartScan)
	mux.HandleFunc("GET /api/v1/issues", h.Issues)
}
