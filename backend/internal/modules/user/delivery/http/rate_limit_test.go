package http

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestAuthLimiterUsesPeerIPAndIgnoresForwardedHeaders(t *testing.T) {
	limiter := &authLimiter{entries: make(map[string]authWindow)}
	handler := limiter.wrap(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(204) })
	for attempt := 0; attempt < 11; attempt++ {
		r := httptest.NewRequest("POST", "/api/v1/auth/sign-in", nil)
		r.RemoteAddr = "127.0.0.1:1234"
		r.Header.Set("X-Forwarded-For", "different-each-request")
		w := httptest.NewRecorder()
		handler(w, r)
		if attempt < 10 && w.Code != 204 {
			t.Fatal("legitimate attempt rejected")
		}
		if attempt == 10 && (w.Code != 429 || w.Header().Get("Retry-After") == "") {
			t.Fatal("repeated attempts not throttled")
		}
	}
}
