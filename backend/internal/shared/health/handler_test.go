package health

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type failingDatabase struct{}

func (failingDatabase) Ping(context.Context) error { return errors.New("database unavailable") }

func TestHandlerReportsUnavailableDatabase(t *testing.T) {
	handler := Handler(slog.New(slog.NewTextHandler(io.Discard, nil)), failingDatabase{})
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/health", nil))
	if recorder.Code != http.StatusServiceUnavailable || !strings.Contains(recorder.Body.String(), `"database":"unavailable"`) {
		t.Fatalf("unexpected response %d: %s", recorder.Code, recorder.Body.String())
	}
}
