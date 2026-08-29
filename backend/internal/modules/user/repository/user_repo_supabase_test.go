package repository

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestSupabaseUserRepositorySignIn(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/auth/v1/token" || r.URL.Query().Get("grant_type") != "password" {
			t.Fatalf("unexpected target %s", r.URL.String())
		}
		if r.Header.Get("apikey") != "publishable-test" {
			t.Fatalf("missing apikey header")
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"access_token": "access", "refresh_token": "refresh", "expires_in": 3600, "user": map[string]string{"id": "user-1", "email": "test@example.com"}})
	}))
	defer server.Close()
	repo, err := NewSupabaseUserRepository(server.URL, "publishable-test")
	if err != nil {
		t.Fatalf("create repository: %v", err)
	}
	session, err := repo.SignIn(context.Background(), "test@example.com", "password123")
	if err != nil {
		t.Fatalf("SignIn() error = %v", err)
	}
	if session.User.ID != "user-1" || session.AccessToken != "access" {
		t.Fatalf("unexpected session: %+v", session)
	}
}

func TestSupabaseUserRepositoryUserSendsAccessToken(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("Authorization"); got != "Bearer user-token" {
			t.Fatalf("Authorization = %q", got)
		}
		_ = json.NewEncoder(w).Encode(map[string]string{"id": "user-1", "email": "test@example.com"})
	}))
	defer server.Close()
	repo, _ := NewSupabaseUserRepository(server.URL, "publishable-test")
	if _, err := repo.User(context.Background(), "user-token"); err != nil {
		t.Fatalf("User() error = %v", err)
	}
}
