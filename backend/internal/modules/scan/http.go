package scan

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"path"
	"regexp"
	"strings"

	project "github.com/IProgressX/auditor-x/backend/internal/modules/project/entity"
	"github.com/IProgressX/auditor-x/backend/internal/shared/identity"
	"github.com/IProgressX/auditor-x/backend/internal/shared/response"
)

type RepositoryReader interface {
	Get(context.Context, string) (project.Repository, error)
}
type JobStore interface {
	Enqueue(context.Context, string, string, string, ...PredictionContext) (Job, error)
	EnqueueUpload(context.Context, string, string, string, string, string, []byte, ...PredictionContext) (Job, error)
	Get(context.Context, string, string, string) (Job, error)
	List(context.Context, string, string) ([]Job, error)
	Findings(context.Context, string, string, string) ([]Finding, error)
	Cancel(context.Context, string, string, string) (Job, error)
}
type Handler struct {
	Repositories RepositoryReader
	Jobs         JobStore
	Predictor    Predictor
}

var uuidPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

func (h Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/v1/local-projects", h.ListLocalProjects)
	mux.HandleFunc("GET /api/v1/repositories/{repositoryID}/scans/{scanID}/predictions", h.PredictionStatus)
	mux.HandleFunc("POST /api/v1/repositories/{repositoryID}/scans/{scanID}/predictions/retry", h.RetryPrediction)
	mux.HandleFunc("POST /api/v1/repositories/{repositoryID}/scans/{scanID}/predictions", h.Predict)
	mux.HandleFunc("GET /api/v1/repositories/{repositoryID}/scans/{scanID}/labels", h.Labels)
	mux.HandleFunc("POST /api/v1/repositories/{repositoryID}/scans/{scanID}/findings/{fingerprint}/labels", h.SaveLabel)
	mux.HandleFunc("POST /api/v1/repositories/{repositoryID}/scans/local", h.EnqueueLocal)
	mux.HandleFunc("POST /api/v1/repositories/{repositoryID}/scans", h.Enqueue)
	mux.HandleFunc("POST /api/v1/repositories/{repositoryID}/scans/upload", h.EnqueueUpload)
	mux.HandleFunc("GET /api/v1/repositories/{repositoryID}/scans", h.List)
	mux.HandleFunc("GET /api/v1/repositories/{repositoryID}/scans/{scanID}", h.Get)
	mux.HandleFunc("GET /api/v1/repositories/{repositoryID}/scans/{scanID}/findings", h.Findings)
	mux.HandleFunc("POST /api/v1/repositories/{repositoryID}/scans/{scanID}/cancel", h.Cancel)
}

func (h Handler) EnqueueLocal(w http.ResponseWriter, r *http.Request) {
	repo, ok := h.repository(w, r, true)
	if !ok {
		return
	}
	if os.Getenv("LOCAL_SCAN_ENABLED") != "true" {
		response.Error(w, 503, "LOCAL_SCAN_DISABLED", "Local path scanning is disabled.")
		return
	}
	var input struct {
		Path              string             `json:"path"`
		PredictionContext *PredictionContext `json:"prediction_context"`
	}
	r.Body = http.MaxBytesReader(w, r.Body, 2048)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	decodeErr := decoder.Decode(&input)
	localPath, valid := normalizeLocalPath(input.Path, os.Getenv("LOCAL_SCAN_HOST_ROOT"))
	if decodeErr != nil || !valid || (input.PredictionContext != nil && !input.PredictionContext.valid()) {
		response.Error(w, 400, "INVALID_LOCAL_PATH", "Enter a project name or a full path inside the configured mounted folder. Paths outside that folder and parent traversal are not allowed.")
		return
	}
	var extra any
	if decoder.Decode(&extra) != io.EOF {
		response.Error(w, 400, "INVALID_LOCAL_PATH", "Send one JSON object.")
		return
	}
	store, ok := h.Jobs.(interface {
		EnqueueLocal(context.Context, string, string, string, string, ...PredictionContext) (Job, error)
	})
	if !ok {
		response.Error(w, 503, "LOCAL_SCAN_DISABLED", "Local path scanning is unavailable.")
		return
	}
	context := defaultPredictionContext()
	if input.PredictionContext != nil {
		context = *input.PredictionContext
	}
	job, err := store.EnqueueLocal(r.Context(), identity.UserID(r.Context()), repo.ID, repo.Branch, localPath, context)
	if err != nil {
		writeError(w, err)
		return
	}
	w.Header().Set("Location", "/api/v1/repositories/"+repo.ID+"/scans/"+job.ID)
	response.JSON(w, 202, map[string]any{"data": job})
}

func (h Handler) EnqueueUpload(w http.ResponseWriter, r *http.Request) {
	repo, ok := h.repository(w, r, true)
	if !ok {
		return
	}
	archive, name, prediction, err := readUpload(w, r)
	if err != nil {
		response.Error(w, 400, "INVALID_UPLOAD", "Upload one ZIP archive or one source folder up to 20 MiB.")
		return
	}
	validationRoot, err := os.MkdirTemp("", "auditorx-upload-validation-")
	if err != nil {
		writeError(w, err)
		return
	}
	defer os.RemoveAll(validationRoot)
	if err = extractUploadedSource(archive, validationRoot); err != nil {
		response.Error(w, 400, "INVALID_UPLOAD", "The upload must contain supported source files with safe paths and valid size limits.")
		return
	}
	digestBytes := sha256.Sum256(archive)
	digest := hex.EncodeToString(digestBytes[:])
	job, err := h.Jobs.EnqueueUpload(r.Context(), identity.UserID(r.Context()), repo.ID, repo.Branch, name, digest, archive, prediction)
	if err != nil {
		writeError(w, err)
		return
	}
	w.Header().Set("Location", "/api/v1/repositories/"+repo.ID+"/scans/"+job.ID)
	response.JSON(w, 202, map[string]any{"data": job})
}

func readUpload(w http.ResponseWriter, r *http.Request) ([]byte, string, PredictionContext, error) {
	prediction := defaultPredictionContext()
	contextSeen := false
	r.Body = http.MaxBytesReader(w, r.Body, maxArchiveBytes+(2<<20))
	reader, err := r.MultipartReader()
	if err != nil {
		return nil, "", prediction, err
	}
	var direct []byte
	var directName string
	var folder bytes.Buffer
	folderZip := zip.NewWriter(&folder)
	folderFiles := 0
	parts := 0
	for {
		part, nextErr := reader.NextPart()
		if errors.Is(nextErr, io.EOF) {
			break
		}
		if nextErr != nil {
			return nil, "", prediction, nextErr
		}
		parts++
		if parts > 1001 {
			part.Close()
			return nil, "", prediction, errors.New("too many upload parts")
		}
		field := part.FormName()
		switch {
		case field == "prediction_context" && !contextSeen:
			contextSeen = true
			raw, readErr := io.ReadAll(io.LimitReader(part, 1025))
			decoder := json.NewDecoder(bytes.NewReader(raw))
			decoder.DisallowUnknownFields()
			if readErr != nil || len(raw) > 1024 || decoder.Decode(&prediction) != nil || decoder.Decode(new(any)) != io.EOF || !prediction.valid() {
				part.Close()
				return nil, "", prediction, errors.New("invalid prediction context")
			}
		case field == "archive" && direct == nil && folderFiles == 0:
			directName = path.Base(strings.ReplaceAll(part.FileName(), "\\", "/"))
			if len(directName) < 5 || len(directName) > 255 || !strings.HasSuffix(strings.ToLower(directName), ".zip") {
				part.Close()
				return nil, "", prediction, errors.New("invalid archive name")
			}
			direct, err = io.ReadAll(io.LimitReader(part, maxArchiveBytes+1))
		case strings.HasPrefix(field, "file:") && direct == nil:
			relative := strings.TrimPrefix(field, "file:")
			entry, createErr := folderZip.Create("upload/" + relative)
			if createErr != nil {
				part.Close()
				return nil, "", prediction, createErr
			}
			written, copyErr := io.Copy(entry, io.LimitReader(part, maxFileBytes+1))
			if copyErr != nil || written > maxFileBytes {
				part.Close()
				return nil, "", prediction, errors.New("uploaded file too large")
			}
			folderFiles++
		default:
			part.Close()
			return nil, "", prediction, errors.New("unexpected upload part")
		}
		part.Close()
		if err != nil || len(direct) > maxArchiveBytes {
			return nil, "", prediction, errors.New("archive too large")
		}
	}
	if err = folderZip.Close(); err != nil {
		return nil, "", prediction, err
	}
	if direct != nil && folderFiles == 0 {
		return direct, directName, prediction, nil
	}
	if direct == nil && folderFiles > 0 && folder.Len() <= maxArchiveBytes {
		return folder.Bytes(), "local-folder.zip", prediction, nil
	}
	return nil, "", prediction, errors.New("missing upload")
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
		Branch            string             `json:"branch"`
		RuleProfile       string             `json:"rule_profile"`
		PredictionContext *PredictionContext `json:"prediction_context"`
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 2048))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&input); err != nil || decoder.Decode(new(any)) != io.EOF {
		response.Error(w, 400, "INVALID_JSON", "Provide one JSON object with branch and optional rule_profile.")
		return
	}
	if input.Branch != "" && input.Branch != repo.Branch || input.RuleProfile != "" && input.RuleProfile != "recommended" || (input.PredictionContext != nil && !input.PredictionContext.valid()) {
		response.Error(w, 400, "INVALID_INPUT", "Use the registered branch and recommended rule profile.")
		return
	}
	context := defaultPredictionContext()
	if input.PredictionContext != nil {
		context = *input.PredictionContext
	}
	job, err := h.Jobs.Enqueue(r.Context(), identity.UserID(r.Context()), repo.ID, repo.Branch, context)
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
