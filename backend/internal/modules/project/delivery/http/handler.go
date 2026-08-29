package http

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"

	"github.com/IProgressX/auditor-x/backend/internal/modules/project/entity"
	"github.com/IProgressX/auditor-x/backend/internal/modules/project/service"
	"github.com/IProgressX/auditor-x/backend/internal/shared/identity"
	"github.com/IProgressX/auditor-x/backend/internal/shared/response"
)

type Handler struct{ service *service.Service }

func NewHandler(service *service.Service) *Handler { return &Handler{service: service} }

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	h.RegisterRoutesWithScans(mux, nil)
}

func (h *Handler) RegisterRoutesWithScans(mux *http.ServeMux, scans interface{ RegisterRoutes(*http.ServeMux) }) {
	mux.HandleFunc("GET /api/v1/repositories", h.List)
	mux.HandleFunc("POST /api/v1/repositories", h.Create)
	mux.HandleFunc("GET /api/v1/repositories/{repositoryID}", h.Get)
	mux.HandleFunc("GET /api/v1/repositories/{repositoryID}/dashboard", h.Dashboard)
	if scans == nil {
		mux.HandleFunc("POST /api/v1/repositories/{repositoryID}/scans", h.StartScan)
	} else {
		scans.RegisterRoutes(mux)
	}
	mux.HandleFunc("GET /api/v1/issues", h.Issues)
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	if identity.UserID(r.Context()) == "" {
		writeError(w, entity.ErrUnauthorized)
		return
	}
	var input entity.CreateInput
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8192))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&input); err != nil {
		invalidJSON(w)
		return
	}
	if err := decoder.Decode(new(any)); err != io.EOF {
		invalidJSON(w)
		return
	}
	item, err := h.service.Create(r.Context(), input)
	if err != nil {
		writeError(w, err)
		return
	}
	w.Header().Set("Location", "/api/v1/repositories/"+item.ID)
	response.JSON(w, http.StatusCreated, map[string]any{"data": item})
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	page, size := 1, 20
	var err error
	if value := r.URL.Query().Get("page"); value != "" {
		page, err = strconv.Atoi(value)
	}
	if err != nil {
		writeError(w, entity.ErrInvalid)
		return
	}
	if value := r.URL.Query().Get("page_size"); value != "" {
		size, err = strconv.Atoi(value)
	}
	if err != nil {
		writeError(w, entity.ErrInvalid)
		return
	}
	items, err := h.service.List(r.Context(), page, size)
	if err != nil {
		writeError(w, err)
		return
	}
	if items == nil {
		items = []entity.Repository{}
	}
	response.JSON(w, http.StatusOK, map[string]any{"data": items, "meta": map[string]int{"page": page, "page_size": size, "count": len(items)}})
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	item, err := h.service.Get(r.Context(), r.PathValue("repositoryID"))
	if err != nil {
		writeError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]any{"data": item})
}

func (h *Handler) Dashboard(w http.ResponseWriter, r *http.Request) {
	if _, err := h.service.Get(r.Context(), r.PathValue("repositoryID")); err != nil {
		writeError(w, err)
		return
	}
	response.Error(w, http.StatusConflict, "SCAN_REQUIRED", "This repository has no completed scan yet.")
}

func (h *Handler) StartScan(w http.ResponseWriter, r *http.Request) {
	item, err := h.service.Get(r.Context(), r.PathValue("repositoryID"))
	if err != nil {
		writeError(w, err)
		return
	}
	if item.AccessLevel != "owner" && item.AccessLevel != "editor" {
		response.Error(w, http.StatusForbidden, "INSUFFICIENT_ACCESS", "This repository requires write access to start a scan.")
		return
	}
	response.Error(w, http.StatusNotImplemented, "SCANNER_NOT_READY", "The scan worker is not implemented yet. No scan was queued.")
}

func (h *Handler) Issues(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("repository_id")
	if id == "" {
		writeError(w, entity.ErrInvalid)
		return
	}
	if _, err := h.service.Get(r.Context(), id); err != nil {
		writeError(w, err)
		return
	}
	// No live scans yet. Never reuse sample findings in persistent mode.
	response.JSON(w, http.StatusOK, map[string]any{"data": []any{}, "meta": map[string]int{"count": 0}})
}

func invalidJSON(w http.ResponseWriter) {
	response.Error(w, http.StatusBadRequest, "INVALID_JSON", "Provide one JSON object with repository_url and optional branch only (maximum 8 KiB).")
}

func writeError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, entity.ErrUnauthorized):
		response.Error(w, http.StatusUnauthorized, "AUTH_REQUIRED", "A verified user is required.")
	case errors.Is(err, entity.ErrNotFound):
		response.Error(w, http.StatusNotFound, "RESOURCE_NOT_FOUND", "Repository was not found.")
	case errors.Is(err, entity.ErrConflict):
		response.Error(w, http.StatusConflict, "REPOSITORY_EXISTS", "You already registered this repository.")
	case errors.Is(err, entity.ErrInvalid):
		response.Error(w, http.StatusBadRequest, "INVALID_INPUT", err.Error())
	default:
		// Provider/SQL details may include schema names or credentials.
		response.Error(w, http.StatusServiceUnavailable, "REPOSITORY_STORE_UNAVAILABLE", "Repository storage is unavailable. Check database configuration and migrations.")
	}
}
