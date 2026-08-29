package http

import (
	"encoding/json"
	"net/http"

	"github.com/IProgressX/auditor-x/backend/internal/modules/audit/service"
	"github.com/IProgressX/auditor-x/backend/internal/shared/response"
)

type Handler struct{ service *service.AuditService }

func NewHandler(service *service.AuditService) *Handler { return &Handler{service: service} }

func (h *Handler) Repositories(w http.ResponseWriter, _ *http.Request) {
	items := h.service.Repositories()
	response.JSON(w, http.StatusOK, map[string]any{"data": items, "meta": map[string]int{"page": 1, "page_size": 20, "total": len(items)}})
}
func (h *Handler) Dashboard(w http.ResponseWriter, r *http.Request) {
	dashboard, ok := h.service.Dashboard(r.PathValue("repositoryID"))
	if !ok {
		response.Error(w, http.StatusNotFound, "RESOURCE_NOT_FOUND", "Repository dashboard was not found.")
		return
	}
	response.JSON(w, http.StatusOK, map[string]any{"data": dashboard})
}
func (h *Handler) StartScan(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Branch string `json:"branch"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.Error(w, http.StatusBadRequest, "INVALID_JSON", "Request body must be valid JSON.")
		return
	}
	scan, ok := h.service.StartScan(r.PathValue("repositoryID"), body.Branch)
	if !ok {
		response.Error(w, http.StatusNotFound, "RESOURCE_NOT_FOUND", "Repository was not found.")
		return
	}
	response.JSON(w, http.StatusAccepted, map[string]any{"data": scan})
}
func (h *Handler) Issues(w http.ResponseWriter, r *http.Request) {
	items := h.service.Issues(r.URL.Query().Get("severity"))
	response.JSON(w, http.StatusOK, map[string]any{"data": items, "meta": map[string]int{"page": 1, "page_size": 20, "total": len(items)}})
}
