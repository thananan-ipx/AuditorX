package githubconnect

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestNextCannotEscapeFrontend(t *testing.T) {
	for _, input := range []string{"https://evil.test", "//evil.test", "/\\evil.test", "/%5cevil.test", "/%2f%2fevil.test", "/login?next=//evil.test", "/\r\nevil"} {
		if safeNext(input) != "/repositories" {
			t.Fatalf("unsafe next accepted: %q", input)
		}
	}
	if safeNext("/dashboard?repository=123") != "/dashboard?repository=123" {
		t.Fatal("safe next lost")
	}
}
func TestDisabledIntegrationHasNoRedirect(t *testing.T) {
	h := &Handler{}
	mux := http.NewServeMux()
	h.RegisterRoutes(mux)
	for _, path := range []string{"/api/v1/auth/github/start", "/api/v1/auth/github/callback", "/api/v1/github/connection"} {
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, httptest.NewRequest("GET", path, nil))
		if w.Code != 503 || w.Header().Get("Location") != "" || w.Header().Get("Cache-Control") != "no-store" {
			t.Fatal("disabled provider invoked")
		}
	}
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest("GET", "/api/v1/auth/github/config", nil))
	if w.Code != 200 || !strings.Contains(w.Body.String(), `"enabled":false`) {
		t.Fatal("disabled availability missing")
	}
}
