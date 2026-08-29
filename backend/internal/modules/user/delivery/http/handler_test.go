package http

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/IProgressX/auditor-x/backend/internal/modules/user/entity"
	"github.com/IProgressX/auditor-x/backend/internal/modules/user/service"
	"github.com/IProgressX/auditor-x/backend/internal/shared/identity"
)

type testRepository struct{ session entity.Session }

func (r testRepository) SignIn(context.Context, string, string) (entity.Session, error) {
	return r.session, nil
}

func TestAuthenticateUsesProviderIdentityNotCookieIdentity(t *testing.T) {
	verified := entity.User{ID: "11111111-1111-4111-8111-111111111111"}
	h := NewHandler(service.New(testRepository{session: entity.Session{User: verified}}), "http://localhost:3000", false, "")
	cookieSession := entity.Session{AccessToken: "valid-token", User: entity.User{ID: "spoofed-admin"}}
	payload, _ := json.Marshal(cookieSession)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/repositories", nil)
	req.AddCookie(&http.Cookie{Name: sessionCookieName, Value: base64.RawURLEncoding.EncodeToString(payload)})
	if !h.Authenticate(httptest.NewRecorder(), req) {
		t.Fatal("authentication failed")
	}
	if got := identity.UserID(req.Context()); got != verified.ID {
		t.Fatalf("identity = %q", got)
	}
}

func TestAuthenticateRejectsEmptyVerifiedIdentity(t *testing.T) {
	h := NewHandler(service.New(testRepository{}), "http://localhost:3000", false, "")
	payload, _ := json.Marshal(entity.Session{AccessToken: "token", User: entity.User{ID: "untrusted"}})
	req := httptest.NewRequest(http.MethodGet, "/api/v1/repositories", nil)
	req.AddCookie(&http.Cookie{Name: sessionCookieName, Value: base64.RawURLEncoding.EncodeToString(payload)})
	res := httptest.NewRecorder()
	if h.Authenticate(res, req) || res.Code != 401 || identity.UserID(req.Context()) != "" {
		t.Fatal("empty identity accepted")
	}
}
func (r testRepository) SignUp(context.Context, string, string, string) (entity.Session, error) {
	return r.session, nil
}
func (r testRepository) Refresh(context.Context, string) (entity.Session, error) {
	return r.session, nil
}
func (r testRepository) User(context.Context, string) (entity.User, error) {
	return r.session.User, nil
}
func (r testRepository) SignOut(context.Context, string) error { return nil }

func TestSignInSetsProtectedCookieWithoutReturningTokens(t *testing.T) {
	repo := testRepository{session: entity.Session{AccessToken: "secret-access", RefreshToken: "secret-refresh", User: entity.User{ID: "user-1", Email: "test@example.com"}}}
	handler := NewHandler(service.New(repo), "http://localhost:3000", false, "")
	request := httptest.NewRequest(http.MethodPost, "/api/v1/auth/sign-in", strings.NewReader(`{"email":"test@example.com","password":"password123"}`))
	recorder := httptest.NewRecorder()
	handler.SignIn(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d: %s", recorder.Code, recorder.Body.String())
	}
	cookie := recorder.Header().Get("Set-Cookie")
	if !strings.Contains(cookie, "HttpOnly") || !strings.Contains(cookie, "SameSite=Lax") {
		t.Fatalf("cookie is not protected: %s", cookie)
	}
	if strings.Contains(recorder.Body.String(), "secret-access") || strings.Contains(recorder.Body.String(), "secret-refresh") {
		t.Fatal("tokens must not be returned in response body")
	}
}
