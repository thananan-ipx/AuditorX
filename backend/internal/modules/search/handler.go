package search

import (
	"context"
	"net/http"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/IProgressX/auditor-x/backend/internal/modules/project/entity"
	"github.com/IProgressX/auditor-x/backend/internal/shared/identity"
	"github.com/IProgressX/auditor-x/backend/internal/shared/response"
)

type RepositoryDirectory interface {
	Search(context.Context, string, string) ([]entity.Repository, error)
}

type Handler struct{ Repositories RepositoryDirectory }
type Hit struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
}

func (h Handler) RegisterRoutes(mux *http.ServeMux) { mux.HandleFunc("GET /api/v1/search", h.Find) }

func (h Handler) Find(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	actor := identity.UserID(r.Context())
	if actor == "" {
		response.Error(w, 401, "AUTH_REQUIRED", "A verified user is required.")
		return
	}
	raw := r.URL.Query().Get("q")
	query := strings.TrimSpace(raw)
	count := utf8.RuneCountInString(query)
	if !utf8.ValidString(raw) || len(raw) > 1024 || count < 2 || count > 100 || strings.ContainsFunc(raw, unicode.IsControl) {
		response.Error(w, 400, "INVALID_QUERY", "Search queries must contain 2 to 100 characters without control characters.")
		return
	}
	items, err := h.Repositories.Search(r.Context(), actor, query)
	if err != nil {
		response.Error(w, 503, "SEARCH_UNAVAILABLE", "Repository search is unavailable. Try again later.")
		return
	}
	hits := make([]Hit, 0, len(items))
	for _, item := range items {
		hits = append(hits, Hit{ID: item.ID, Title: item.Owner + "/" + item.Name, Description: item.Branch})
	}
	response.JSON(w, 200, map[string]any{"data": map[string]any{"repositories": hits}})
}
