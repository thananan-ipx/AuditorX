package search

import (
	"context"
	"errors"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/IProgressX/auditor-x/backend/internal/modules/project/entity"
	"github.com/IProgressX/auditor-x/backend/internal/shared/identity"
)

type testDirectory struct {
	calls        int
	actor, query string
	fail         bool
}

func (d *testDirectory) Search(_ context.Context, actor, query string) ([]entity.Repository, error) {
	d.calls++
	d.actor, d.query = actor, query
	if d.fail {
		return nil, errors.New("private database connection details")
	}
	return []entity.Repository{{ID: "repo-1", Owner: "org", Name: "search", Branch: "main", CreatedBy: "private-owner", URL: "https://github.com/org/search"}}, nil
}

func TestSearchRejectsUnverifiedAndInvalidQueriesBeforeReading(t *testing.T) {
	store := &testDirectory{}
	h := Handler{Repositories: store}
	for _, query := range []string{"", "a", strings.Repeat("ก", 101), "ab\ncd", "ab\x00cd"} {
		r := httptest.NewRequest("GET", "/api/v1/search?q="+url.QueryEscape(query), nil)
		r = r.WithContext(identity.WithUserID(r.Context(), "verified"))
		w := httptest.NewRecorder()
		h.Find(w, r)
		if w.Code != 400 {
			t.Fatalf("invalid query status=%d", w.Code)
		}
	}
	w := httptest.NewRecorder()
	h.Find(w, httptest.NewRequest("GET", "/api/v1/search?q=valid", nil))
	if w.Code != 401 || store.calls != 0 {
		t.Fatal("invalid request reached search storage")
	}
}

func TestSearchPreservesVerifiedIdentityAndReturnsOnlyMetadata(t *testing.T) {
	store := &testDirectory{}
	r := httptest.NewRequest("GET", "/api/v1/search?q="+url.QueryEscape(" ไทย "), nil)
	r = r.WithContext(identity.WithUserID(r.Context(), "verified-user"))
	w := httptest.NewRecorder()
	Handler{store}.Find(w, r)
	if w.Code != 200 || store.actor != "verified-user" || store.query != "ไทย" || w.Header().Get("Cache-Control") != "no-store" {
		t.Fatal("query or identity was lost")
	}
	if strings.Contains(w.Body.String(), "private-owner") || strings.Contains(w.Body.String(), "https://") {
		t.Fatal("search exposed more than navigation metadata")
	}
	store.fail = true
	w = httptest.NewRecorder()
	Handler{store}.Find(w, r)
	if w.Code != 503 || strings.Contains(w.Body.String(), "private database") {
		t.Fatal("storage failure leaked details or became empty results")
	}
}
