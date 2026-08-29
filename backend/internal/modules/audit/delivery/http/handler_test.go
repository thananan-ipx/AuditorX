package http

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/IProgressX/auditor-x/backend/internal/modules/audit/repository"
	"github.com/IProgressX/auditor-x/backend/internal/modules/audit/service"
)

func testHandler() *Handler { return NewHandler(service.New(repository.NewMemoryAuditRepository())) }

func TestDashboard(t *testing.T) {
	mux := http.NewServeMux()
	testHandler().RegisterRoutes(mux)
	recorder := httptest.NewRecorder()
	mux.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/v1/repositories/repo-001/dashboard", nil))
	if recorder.Code != http.StatusOK || !strings.Contains(recorder.Body.String(), `"quality_score"`) {
		t.Fatalf("unexpected response %d: %s", recorder.Code, recorder.Body.String())
	}
}

func TestStartScan(t *testing.T) {
	mux := http.NewServeMux()
	testHandler().RegisterRoutes(mux)
	recorder := httptest.NewRecorder()
	mux.ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, "/api/v1/repositories/repo-001/scans", strings.NewReader(`{"branch":"develop"}`)))
	if recorder.Code != http.StatusAccepted || !strings.Contains(recorder.Body.String(), `"Pending"`) {
		t.Fatalf("unexpected response %d: %s", recorder.Code, recorder.Body.String())
	}
}
