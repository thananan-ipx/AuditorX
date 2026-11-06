// Package dataset exposes versioned, explicitly synthetic coursework datasets.
package dataset

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/IProgressX/auditor-x/backend/internal/modules/project/repository"
	"github.com/IProgressX/auditor-x/backend/internal/shared/identity"
	"github.com/IProgressX/auditor-x/backend/internal/shared/response"
	"github.com/jackc/pgx/v5"
)

type Dataset struct {
	ID          string              `json:"id"`
	Title       string              `json:"title"`
	DatasetKind string              `json:"dataset_kind"`
	Description string              `json:"description"`
	Manifest    json.RawMessage     `json:"manifest"`
	Metrics     json.RawMessage     `json:"metrics"`
	Samples     []map[string]string `json:"samples"`
}

type Bundle struct {
	Dataset
	Files map[string]string `json:"files"`
}

type Reader interface {
	Get(context.Context, string, string) (Bundle, error)
}

type Store struct{ DB repository.Beginner }

func (s Store) Get(ctx context.Context, actor, id string) (Bundle, error) {
	var result Bundle
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return result, err
	}
	defer func() {
		cleanup, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = tx.Rollback(cleanup)
	}()
	if _, err = tx.Exec(ctx, "SET LOCAL ROLE authenticated"); err != nil {
		return result, err
	}
	if _, err = tx.Exec(ctx, `SELECT set_config('request.jwt.claim.sub',$1,true)`, actor); err != nil {
		return result, err
	}
	var payload []byte
	if err = tx.QueryRow(ctx, `SELECT payload FROM public.synthetic_training_datasets WHERE id=$1`, id).Scan(&payload); err != nil {
		return result, err
	}
	if err = json.Unmarshal(payload, &result); err != nil {
		return result, err
	}
	if result.DatasetKind != "synthetic" || result.ID != id || len(result.Samples) == 0 {
		return Bundle{}, errors.New("invalid synthetic dataset")
	}
	return result, tx.Commit(ctx)
}

type Handler struct{ Datasets Reader }

func (h Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/v1/datasets/{datasetID}", h.Get)
	mux.HandleFunc("GET /api/v1/datasets/{datasetID}/download", h.Download)
}

func (h Handler) load(w http.ResponseWriter, r *http.Request) (Bundle, bool) {
	w.Header().Set("Cache-Control", "no-store")
	actor := identity.UserID(r.Context())
	if actor == "" {
		response.Error(w, 401, "AUTH_REQUIRED", "A verified user is required.")
		return Bundle{}, false
	}
	bundle, err := h.Datasets.Get(r.Context(), actor, r.PathValue("datasetID"))
	if errors.Is(err, pgx.ErrNoRows) {
		response.Error(w, 404, "DATASET_NOT_FOUND", "This dataset is not available.")
		return Bundle{}, false
	}
	if err != nil {
		response.Error(w, 503, "DATASET_UNAVAILABLE", "Could not load the dataset. Try again later.")
		return Bundle{}, false
	}
	return bundle, true
}

func (h Handler) Get(w http.ResponseWriter, r *http.Request) {
	if bundle, ok := h.load(w, r); ok {
		response.JSON(w, 200, map[string]any{"data": bundle.Dataset})
	}
}

func (h Handler) Download(w http.ResponseWriter, r *http.Request) {
	bundle, ok := h.load(w, r)
	if !ok {
		return
	}
	// Preserve the original file bytes, BOM and line endings: trainer checks hashes.
	var buffer bytes.Buffer
	archive := zip.NewWriter(&buffer)
	for _, name := range []string{"dataset.csv", "train.csv", "validation.csv", "test.csv", "manifest.json", "metrics.json"} {
		content, exists := bundle.Files[name]
		if !exists {
			response.Error(w, 503, "DATASET_UNAVAILABLE", "Dataset export is incomplete.")
			return
		}
		file, err := archive.Create(name)
		if err != nil {
			response.Error(w, 503, "DATASET_UNAVAILABLE", "Could not export the dataset.")
			return
		}
		if _, err = file.Write([]byte(content)); err != nil {
			response.Error(w, 503, "DATASET_UNAVAILABLE", "Could not export the dataset.")
			return
		}
	}
	if err := archive.Close(); err != nil {
		response.Error(w, 503, "DATASET_UNAVAILABLE", "Could not export the dataset.")
		return
	}
	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", `attachment; filename="auditorx-synthetic-priority-v1.zip"`)
	w.WriteHeader(200)
	_, _ = w.Write(buffer.Bytes())
}
