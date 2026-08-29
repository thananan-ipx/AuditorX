package http

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/IProgressX/auditor-x/backend/internal/modules/project/entity"
	"github.com/IProgressX/auditor-x/backend/internal/modules/project/service"
	"github.com/IProgressX/auditor-x/backend/internal/shared/identity"
)

const alice = "11111111-1111-4111-8111-111111111111"
const bob = "22222222-2222-4222-8222-222222222222"
const repoID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

type stubStore struct {
	failure error
	access  string
	creates int
}

func (s *stubStore) Create(_ context.Context, actor string, input entity.NewRepository) (entity.Repository, error) {
	s.creates++
	return entity.Repository{ID: repoID, CreatedBy: actor, URL: input.URL}, s.failure
}
func (s *stubStore) List(_ context.Context, actor string, _, _ int) ([]entity.Repository, error) {
	if actor == bob {
		return nil, nil
	}
	return []entity.Repository{{ID: repoID}}, s.failure
}
func (s *stubStore) Get(_ context.Context, actor, id string) (entity.Repository, error) {
	if s.failure != nil {
		return entity.Repository{}, s.failure
	}
	if actor != alice || id != repoID {
		return entity.Repository{}, entity.ErrNotFound
	}
	return entity.Repository{ID: id, AccessLevel: s.access}, nil
}

func request(store *stubStore, actor, method, path, body string) *httptest.ResponseRecorder {
	mux := http.NewServeMux()
	NewHandler(service.New(store)).RegisterRoutes(mux)
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	if actor != "" {
		req = req.WithContext(identity.WithUserID(req.Context(), actor))
	}
	res := httptest.NewRecorder()
	mux.ServeHTTP(res, req)
	return res
}

func TestCreateAndRejectOwnershipSpoofing(t *testing.T) {
	s := &stubStore{}
	res := request(s, alice, "POST", "/api/v1/repositories", `{"repository_url":"https://github.com/org/repo","branch":"main"}`)
	if res.Code != 201 || res.Header().Get("Location") != "/api/v1/repositories/"+repoID || !strings.Contains(res.Body.String(), alice) {
		t.Fatalf("%d %s", res.Code, res.Body.String())
	}
	for _, body := range []string{
		`{"repository_url":"https://github.com/org/repo","created_by":"` + bob + `"}`,
		`{"repository_url":"https://github.com/org/repo"} {}`,
		`{"repository_url":"` + strings.Repeat("a", 9000) + `"}`, "null", "[]",
	} {
		res = request(s, alice, "POST", "/api/v1/repositories", body)
		if res.Code != 400 {
			t.Fatalf("expected invalid request: %d", res.Code)
		}
	}
	if s.creates != 1 {
		t.Fatalf("invalid body reached store %d times", s.creates)
	}
}

func TestNoCrossUserRepositoryOrAuditAccess(t *testing.T) {
	for _, endpoint := range []struct{ method, path string }{
		{"GET", "/api/v1/repositories/" + repoID},
		{"GET", "/api/v1/repositories/" + repoID + "/dashboard"},
		{"POST", "/api/v1/repositories/" + repoID + "/scans"},
		{"GET", "/api/v1/issues?repository_id=" + repoID},
	} {
		res := request(&stubStore{}, bob, endpoint.method, endpoint.path, "{}")
		if res.Code != 404 {
			t.Fatalf("%s: %d %s", endpoint.path, res.Code, res.Body.String())
		}
		res = request(&stubStore{}, "", endpoint.method, endpoint.path, "{}")
		if res.Code != 401 {
			t.Fatalf("missing identity: %s %d", endpoint.path, res.Code)
		}
	}
}

func TestEmptyListIsArrayAndStoreErrorsAreSanitized(t *testing.T) {
	res := request(&stubStore{}, bob, "GET", "/api/v1/repositories", "")
	if res.Code != 200 || !strings.Contains(res.Body.String(), `"data":[]`) {
		t.Fatal(res.Body.String())
	}
	res = request(&stubStore{failure: errors.New("password=do-not-leak")}, alice, "GET", "/api/v1/repositories", "")
	if res.Code != 503 || strings.Contains(res.Body.String(), "do-not-leak") {
		t.Fatal(res.Body.String())
	}
	res = request(&stubStore{}, alice, "GET", "/api/v1/repositories?page_size=100000", "")
	if res.Code != 400 {
		t.Fatal(res.Code)
	}
}

func TestPersistentModeDoesNotFabricateScanResults(t *testing.T) {
	res := request(&stubStore{access: "owner"}, alice, "POST", "/api/v1/repositories/"+repoID+"/scans", "{}")
	if res.Code != 501 {
		t.Fatal(res.Code)
	}
	res = request(&stubStore{access: "viewer"}, alice, "POST", "/api/v1/repositories/"+repoID+"/scans", "{}")
	if res.Code != 403 {
		t.Fatal(res.Code)
	}
	res = request(&stubStore{}, alice, "GET", "/api/v1/repositories/"+repoID+"/dashboard", "")
	if res.Code != 409 {
		t.Fatal(res.Code)
	}
	res = request(&stubStore{}, alice, "GET", "/api/v1/issues?repository_id="+repoID, "")
	if res.Code != 200 || !strings.Contains(res.Body.String(), `"data":[]`) {
		t.Fatal(res.Body.String())
	}
}
