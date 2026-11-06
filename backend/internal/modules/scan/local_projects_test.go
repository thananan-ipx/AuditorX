package scan

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/IProgressX/auditor-x/backend/internal/shared/identity"
)

type localProjectsStub struct {
	jobsStub
	actor         string
	limit, offset int
}

func (s *localProjectsStub) LocalProjects(_ context.Context, actor string, limit, offset int) ([]LocalProject, error) {
	s.actor, s.limit, s.offset = actor, limit, offset
	return []LocalProject{{Name: "first"}, {Name: "second"}, {Name: "next-page"}}, nil
}

func TestLocalProjectsHTTP(t *testing.T) {
	for _, tc := range []struct {
		actor, query string
		want         int
	}{
		{"", "", 401}, {alice, "?page=0", 400}, {alice, "?page_size=101", 400},
		{alice, "?page=abc", 400}, {alice, "?page=10001", 400}, {alice, "?page=2&page_size=2", 200},
	} {
		store := &localProjectsStub{}
		mux := http.NewServeMux()
		Handler{Jobs: store}.RegisterRoutes(mux)
		r := httptest.NewRequest("GET", "/api/v1/local-projects"+tc.query, nil)
		if tc.actor != "" {
			r = r.WithContext(identity.WithUserID(r.Context(), tc.actor))
		}
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, r)
		if w.Code != tc.want {
			t.Fatalf("%s: %d %s", tc.query, w.Code, w.Body.String())
		}
		if tc.want != 200 {
			if store.actor != "" {
				t.Fatal("invalid/anonymous request reached store")
			}
			continue
		}
		var payload struct {
			Data []LocalProject `json:"data"`
			Meta struct {
				HasNext bool `json:"has_next"`
			} `json:"meta"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &payload); err != nil {
			t.Fatal(err)
		}
		if len(payload.Data) != 2 || !payload.Meta.HasNext || store.actor != alice || store.limit != 3 || store.offset != 2 || w.Header().Get("Cache-Control") != "no-store" {
			t.Fatalf("bad scoped pagination: %+v %+v", payload, store)
		}
	}
}
