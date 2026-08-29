package main

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/IProgressX/auditor-x/backend/internal/config"
)

type testUserModule struct{}

func (testUserModule) RegisterRoutes(*http.ServeMux)                        {}
func (testUserModule) Authenticate(http.ResponseWriter, *http.Request) bool { return true }

func TestHealthRoute(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	handler := newHandler(config.Config{FrontendURL: "http://localhost:3000"}, logger, nil, testUserModule{})
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/health", nil))
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", recorder.Code)
	}
}

func TestCapabilities(t *testing.T) {
	for _, mode := range []string{"", "prototype", "postgres"} {
		t.Run(mode, func(t *testing.T) {
			logger := slog.New(slog.NewTextHandler(io.Discard, nil))
			handler := newHandler(config.Config{RepositoryStorage: mode}, logger, nil, testUserModule{})
			recorder := httptest.NewRecorder()
			handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/v1/capabilities", nil))
			if recorder.Code != http.StatusOK || recorder.Header().Get("Cache-Control") != "no-store" {
				t.Fatalf("status/cache = %d/%q", recorder.Code, recorder.Header().Get("Cache-Control"))
			}
			var result struct {
				Data struct {
					Storage string `json:"repository_storage"`
					Create  bool   `json:"repository_creation"`
					Scan    bool   `json:"scan_execution"`
				} `json:"data"`
			}
			if err := json.Unmarshal(recorder.Body.Bytes(), &result); err != nil {
				t.Fatal(err)
			}
			wantMode := mode
			if wantMode == "" {
				wantMode = "prototype"
			}
			if result.Data.Storage != wantMode || result.Data.Create != (mode == "postgres") || result.Data.Scan {
				t.Fatalf("unexpected capabilities: %+v", result.Data)
			}
		})
	}
}

type deniedUserModule struct{ testUserModule }

func (deniedUserModule) Authenticate(w http.ResponseWriter, r *http.Request) bool {
	w.WriteHeader(http.StatusUnauthorized)
	return false
}

func TestCapabilitiesRequiresAuthentication(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	handler := newHandler(config.Config{}, logger, nil, deniedUserModule{})
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/v1/capabilities", nil))
	if recorder.Code != http.StatusUnauthorized || recorder.Body.Len() != 0 {
		t.Fatalf("unauthenticated capabilities exposed: %d %s", recorder.Code, recorder.Body)
	}
}

func TestScanQueueCapabilityAndRoutes(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	handler := newHandler(config.Config{RepositoryStorage: "postgres", ScanQueueEnabled: true}, logger, nil, testUserModule{})
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest("GET", "/api/v1/capabilities", nil))
	var body struct {
		Data struct {
			Queue     bool `json:"scan_queue"`
			Execution bool `json:"scan_execution"`
		} `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil || !body.Data.Queue || body.Data.Execution {
		t.Fatalf("capabilities: %s %v", rec.Body, err)
	}
	// The test auth stub has no verified actor. New routes must reject it before
	// touching the deliberately nil test database (not panic or shadow other routes).
	for _, path := range []string{"/api/v1/repositories/example/scans", "/api/v1/repositories/example/scans/example", "/api/v1/repositories/example/scans/example/findings"} {
		rec = httptest.NewRecorder()
		handler.ServeHTTP(rec, httptest.NewRequest("GET", path, nil))
		if rec.Code != 401 {
			t.Fatalf("route %s status=%d", path, rec.Code)
		}
	}
}
