package middleware

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestProtectedRouteRequiresAuthentication(t *testing.T) {
	authCalled := false
	handler := HTTP(slog.New(slog.NewTextHandler(io.Discard, nil)), "http://localhost:3000", func(w http.ResponseWriter, _ *http.Request) bool {
		authCalled = true
		w.WriteHeader(http.StatusUnauthorized)
		return false
	})(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) }))
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/v1/issues", nil))
	if !authCalled || recorder.Code != http.StatusUnauthorized {
		t.Fatalf("authentication middleware was not enforced")
	}
}

func TestStateChangingRequestRejectsUntrustedOrigin(t *testing.T) {
	handler := HTTP(slog.New(slog.NewTextHandler(io.Discard, nil)), "http://localhost:3000", func(http.ResponseWriter, *http.Request) bool { return true })(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) }))
	request := httptest.NewRequest(http.MethodPost, "/api/v1/auth/sign-in", nil)
	request.Header.Set("Origin", "https://evil.example")
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want 403", recorder.Code)
	}
}
