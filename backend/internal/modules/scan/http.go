package scan

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"regexp"

	project "github.com/IProgressX/auditor-x/backend/internal/modules/project/entity"
	"github.com/IProgressX/auditor-x/backend/internal/shared/identity"
	"github.com/IProgressX/auditor-x/backend/internal/shared/response"
)

type RepositoryReader interface {
	Get(context.Context, string) (project.Repository, error)
}
type JobStore interface {
	Enqueue(context.Context, string, string, string) (Job, error)
	Get(context.Context, string, string, string) (Job, error)
	List(context.Context, string, string) ([]Job, error)
	Findings(context.Context, string, string, string) ([]Finding, error)
	Cancel(context.Context, string, string, string) (Job, error)
}
type Handler struct {
	Repositories RepositoryReader
	Jobs         JobStore
}

var uuidPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

func (h Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/v1/repositories/{repositoryID}/scans", h.Enqueue)
	mux.HandleFunc("GET /api/v1/repositories/{repositoryID}/scans", h.List)
	mux.HandleFunc("GET /api/v1/repositories/{repositoryID}/scans/{scanID}", h.Get)
	mux.HandleFunc("GET /api/v1/repositories/{repositoryID}/scans/{scanID}/findings", h.Findings)
	mux.HandleFunc("POST /api/v1/repositories/{repositoryID}/scans/{scanID}/cancel", h.Cancel)
}

func (h Handler) repository(w http.ResponseWriter, r *http.Request, write bool) (project.Repository, bool) {
	if !uuidPattern.MatchString(identity.UserID(r.Context())) {
		writeError(w, project.ErrUnauthorized)
		return project.Repository{}, false
	}
	repo, err := h.Repositories.Get(r.Context(), r.PathValue("repositoryID"))
	if err != nil {
		writeError(w, err)
		return repo, false
	}
	if write && repo.AccessLevel != "owner" && repo.AccessLevel != "editor" {
		response.Error(w, 403, "INSUFFICIENT_ACCESS", "Write access is required.")
		return repo, false
	}
	if id := r.PathValue("scanID"); id != "" && !uuidPattern.MatchString(id) {
		writeError(w, ErrNotFound)
		return repo, false
	}
	return repo, true
}

func (h Handler) Enqueue(w http.ResponseWriter, r *http.Request) {
	repo, ok := h.repository(w, r, true)
	if !ok {
		return
	}
	var input struct {
		Branch      string `json:"branch"`
		RuleProfile string `json:"rule_profile"`
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 2048))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&input); err != nil || decoder.Decode(new(any)) != io.EOF {
		response.Error(w, 400, "INVALID_JSON", "Provide one JSON object with branch and optional rule_profile.")
		return
	}
	if input.Branch != "" && input.Branch != repo.Branch || input.RuleProfile != "" && input.RuleProfile != "recommended" {
		response.Error(w, 400, "INVALID_INPUT", "Use the registered branch and recommended rule profile.")
		return
	}
	job, err := h.Jobs.Enqueue(r.Context(), identity.UserID(r.Context()), repo.ID, repo.Branch)
	if err != nil {
		writeError(w, err)
		return
	}
	w.Header().Set("Location", "/api/v1/repositories/"+repo.ID+"/scans/"+job.ID)
	response.JSON(w, 202, map[string]any{"data": job})
}
func (h Handler) List(w http.ResponseWriter, r *http.Request) {
	repo, ok := h.repository(w, r, false)
	if !ok {
		return
	}
	jobs, err := h.Jobs.List(r.Context(), identity.UserID(r.Context()), repo.ID)
	if err != nil {
		writeError(w, err)
		return
	}
	response.JSON(w, 200, map[string]any{"data": jobs, "meta": map[string]int{"limit": 20, "count": len(jobs)}})
}
func (h Handler) Get(w http.ResponseWriter, r *http.Request) {
	repo, ok := h.repository(w, r, false)
	if !ok {
		return
	}
	job, err := h.Jobs.Get(r.Context(), identity.UserID(r.Context()), repo.ID, r.PathValue("scanID"))
	if err != nil {
		writeError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	response.JSON(w, 200, map[string]any{"data": job})
}
func (h Handler) Findings(w http.ResponseWriter, r *http.Request) {
	repo, ok := h.repository(w, r, false)
	if !ok {
		return
	}
	actor, id := identity.UserID(r.Context()), r.PathValue("scanID")
	job, err := h.Jobs.Get(r.Context(), actor, repo.ID, id)
	if err != nil {
		writeError(w, err)
		return
	}
	if job.Status != "completed" {
		response.Error(w, 409, "SCAN_NOT_COMPLETED", "This scan has no completed result.")
		return
	}
	findings, err := h.Jobs.Findings(r.Context(), actor, repo.ID, id)
	if err != nil {
		writeError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	response.JSON(w, 200, map[string]any{"data": findings, "meta": map[string]any{"scan_id": id, "count": len(findings)}})
}
func (h Handler) Cancel(w http.ResponseWriter, r *http.Request) {
	repo, ok := h.repository(w, r, true)
	if !ok {
		return
	}
	actor, id := identity.UserID(r.Context()), r.PathValue("scanID")
	if _, err := h.Jobs.Get(r.Context(), actor, repo.ID, id); err != nil {
		writeError(w, err)
		return
	}
	job, err := h.Jobs.Cancel(r.Context(), actor, repo.ID, id)
	if err != nil {
		writeError(w, err)
		return
	}
	response.JSON(w, 200, map[string]any{"data": job})
}
func writeError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, project.ErrUnauthorized):
		response.Error(w, 401, "AUTH_REQUIRED", "A verified user is required.")
	case errors.Is(err, project.ErrNotFound), errors.Is(err, ErrNotFound):
		response.Error(w, 404, "RESOURCE_NOT_FOUND", "Repository or scan was not found.")
	case errors.Is(err, ErrConflict):
		response.Error(w, 409, "SCAN_CONFLICT", ErrConflict.Error())
	default:
		response.Error(w, 503, "SCAN_STORE_UNAVAILABLE", "Scan storage is unavailable. Check configuration and migrations.")
	}
}
