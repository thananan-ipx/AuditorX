package github

import (
	"context"
	"encoding/base64"
	"io"
	"net/http"
	"strings"
	"testing"
)

type transportFunc func(*http.Request) (*http.Response, error)

func (f transportFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }
func TestEncryptedTokensBoundToIdentity(t *testing.T) {
	key := make([]byte, 32)
	sealed, err := Seal(key, "ghu_secret", 42)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(sealed), "ghu_secret") {
		t.Fatal("plaintext stored")
	}
	token, err := Open(key, sealed, 42)
	if err != nil || token != "ghu_secret" {
		t.Fatal("round trip failed")
	}
	if _, err = Open(key, sealed, 43); err == nil {
		t.Fatal("ciphertext can be moved to another identity")
	}
	sealed[len(sealed)-1] ^= 1
	if _, err = Open(key, sealed, 42); err == nil {
		t.Fatal("tampering accepted")
	}
}
func TestArchiveRedirectDoesNotLeakToken(t *testing.T) {
	for _, location := range []string{"https://codeload.github.com/org/repo/zip/sha?token=signed", "https://evil.test/steal", "http://codeload.github.com/org/repo", "https://codeload.github.com.evil.test/a", "https://user@codeload.github.com/a", "https://codeload.github.com:443/a"} {
		t.Run(location, func(t *testing.T) {
			calls := 0
			c := NewClient()
			c.HTTP.Transport = transportFunc(func(r *http.Request) (*http.Response, error) {
				calls++
				if calls == 1 {
					if r.URL.Host != "api.github.com" || r.Header.Get("Authorization") != "Bearer ghu_secret" {
						t.Fatal("missing API auth")
					}
					return &http.Response{StatusCode: 302, Header: http.Header{"Location": {location}}, Body: io.NopCloser(strings.NewReader(""))}, nil
				}
				if r.URL.Host != "codeload.github.com" || r.Header.Get("Authorization") != "" {
					t.Fatal("token leaked or unsafe host requested")
				}
				return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader("archive"))}, nil
			})
			data, err := c.Archive(context.Background(), "ghu_secret", "/repos/org/repo", strings.Repeat("a", 40), 20)
			if strings.HasPrefix(location, "https://codeload.github.com/org/") {
				if err != nil || string(data) != "archive" || calls != 2 {
					t.Fatal("valid archive rejected")
				}
			} else if err == nil || calls != 1 {
				t.Fatal("unsafe redirect followed")
			}
		})
	}
}
func TestClientFailuresHideProviderBodies(t *testing.T) {
	c := NewClient()
	c.HTTP.Transport = transportFunc(func(r *http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: 403, Body: io.NopCloser(strings.NewReader("secret token and provider diagnostics"))}, nil
	})
	err := c.Get(context.Background(), "secret", "/user", new(Profile))
	if err != ErrAccess || strings.Contains(err.Error(), "diagnostics") {
		t.Fatal("provider error exposed")
	}
}
func TestConfigRequiresCompleteSafeConfiguration(t *testing.T) {
	for _, name := range []string{"GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET", "GITHUB_CALLBACK_URL", "GITHUB_APP_SLUG", "GITHUB_TOKEN_ENCRYPTION_KEY"} {
		t.Setenv(name, "")
	}
	c, err := LoadConfig()
	if err != nil || c.Enabled() {
		t.Fatal("disabled integration needs no secrets")
	}
	t.Setenv("GITHUB_CLIENT_ID", "Iv1.test")
	if _, err = LoadConfig(); err == nil {
		t.Fatal("partial configuration accepted")
	}
	t.Setenv("GITHUB_CLIENT_SECRET", "test-secret")
	t.Setenv("GITHUB_APP_SLUG", "auditorx-test")
	t.Setenv("GITHUB_TOKEN_ENCRYPTION_KEY", base64.StdEncoding.EncodeToString(make([]byte, 32)))
	for _, callback := range []string{"http://localhost:8080/api/v1/auth/github/callback", "https://example.com/api/v1/auth/github/callback"} {
		t.Setenv("GITHUB_CALLBACK_URL", callback)
		if _, err = LoadConfig(); err != nil {
			t.Fatal(err)
		}
	}
	for _, callback := range []string{"http://example.com/api/v1/auth/github/callback", "https://user@example.com/api/v1/auth/github/callback", "https://example.com/wrong", "https://example.com/api/v1/auth/github/callback?q=1"} {
		t.Setenv("GITHUB_CALLBACK_URL", callback)
		if _, err = LoadConfig(); err == nil {
			t.Fatal("unsafe callback accepted")
		}
	}
}
