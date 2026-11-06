package dataset

import (
	"archive/zip"
	"bytes"
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/IProgressX/auditor-x/backend/internal/shared/identity"
	"github.com/jackc/pgx/v5"
)

type fakeReader struct {
	bundle Bundle
	err    error
	actor  string
	calls  int
}

func (f *fakeReader) Get(_ context.Context, actor, _ string) (Bundle, error) {
	f.actor = actor
	f.calls++
	return f.bundle, f.err
}

func request(t *testing.T, store *fakeReader, path string, signedIn bool) *httptest.ResponseRecorder {
	t.Helper()
	mux := http.NewServeMux()
	Handler{store}.RegisterRoutes(mux)
	r := httptest.NewRequest("GET", path, nil)
	if signedIn {
		r = r.WithContext(identity.WithUserID(r.Context(), "verified-user"))
	}
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, r)
	return w
}

func TestDatasetAuthenticationAndFailureSemantics(t *testing.T) {
	store := &fakeReader{}
	for _, path := range []string{"/api/v1/datasets/demo", "/api/v1/datasets/demo/download"} {
		if w := request(t, store, path, false); w.Code != 401 || store.calls != 0 {
			t.Fatal("anonymous request reached storage")
		}
	}
	store.err = pgx.ErrNoRows
	if w := request(t, store, "/api/v1/datasets/missing", true); w.Code != 404 {
		t.Fatal("missing dataset was not 404")
	}
	store.err = errors.New("private database credentials")
	if w := request(t, store, "/api/v1/datasets/demo", true); w.Code != 503 || strings.Contains(w.Body.String(), "credentials") {
		t.Fatal("failure leaked or became empty results")
	}
}

func TestDatasetDetailAndExportPreserveProvenanceAndBytes(t *testing.T) {
	store := &fakeReader{bundle: Bundle{Dataset: Dataset{ID: "demo", DatasetKind: "synthetic", Samples: []map[string]string{{"priority_label": "Low"}}}, Files: map[string]string{}}}
	for _, name := range []string{"dataset.csv", "train.csv", "validation.csv", "test.csv", "manifest.json", "metrics.json"} {
		store.bundle.Files[name] = "\ufefforiginal,bytes\r\n"
	}
	w := request(t, store, "/api/v1/datasets/demo", true)
	if w.Code != 200 || store.actor != "verified-user" || w.Header().Get("Cache-Control") != "no-store" || !strings.Contains(w.Body.String(), `"dataset_kind":"synthetic"`) || strings.Contains(w.Body.String(), `"files"`) {
		t.Fatalf("bad detail: %s", w.Body.String())
	}
	w = request(t, store, "/api/v1/datasets/demo/download", true)
	archive, err := zip.NewReader(bytes.NewReader(w.Body.Bytes()), int64(w.Body.Len()))
	if err != nil || w.Code != 200 || len(archive.File) != 6 || w.Header().Get("Content-Type") != "application/zip" {
		t.Fatalf("invalid ZIP: %v", err)
	}
	for _, entry := range archive.File {
		file, err := entry.Open()
		if err != nil {
			t.Fatal(err)
		}
		data, err := io.ReadAll(file)
		_ = file.Close()
		if err != nil || string(data) != store.bundle.Files[entry.Name] {
			t.Fatal("export changed original file bytes")
		}
	}
	delete(store.bundle.Files, "train.csv")
	if w := request(t, store, "/api/v1/datasets/demo/download", true); w.Code != 503 {
		t.Fatal("incomplete bundle exported successfully")
	}
}
