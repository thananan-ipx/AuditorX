package repository

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/IProgressX/auditor-x/backend/internal/modules/user/entity"
)

type SupabaseUserRepository struct {
	url    string
	key    string
	client *http.Client
}

func NewSupabaseUserRepository(rawURL, publishableKey string) (*SupabaseUserRepository, error) {
	rawURL = strings.TrimRight(strings.TrimSpace(rawURL), "/")
	publishableKey = strings.TrimSpace(publishableKey)
	if rawURL == "" || publishableKey == "" {
		return nil, errors.New("SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required")
	}
	if _, err := url.ParseRequestURI(rawURL); err != nil {
		return nil, fmt.Errorf("invalid SUPABASE_URL: %w", err)
	}
	return &SupabaseUserRepository{url: rawURL, key: publishableKey, client: &http.Client{Timeout: 8 * time.Second}}, nil
}

func (r *SupabaseUserRepository) SignIn(ctx context.Context, email, password string) (entity.Session, error) {
	var session entity.Session
	err := r.request(ctx, http.MethodPost, "/auth/v1/token?grant_type=password", "", map[string]string{"email": email, "password": password}, &session)
	return session, err
}

func (r *SupabaseUserRepository) SignUp(ctx context.Context, email, password, redirectTo string) (entity.Session, error) {
	var session entity.Session
	path := "/auth/v1/signup"
	if redirectTo != "" {
		path += "?redirect_to=" + url.QueryEscape(redirectTo)
	}
	err := r.request(ctx, http.MethodPost, path, "", map[string]string{"email": email, "password": password}, &session)
	return session, err
}

func (r *SupabaseUserRepository) Refresh(ctx context.Context, refreshToken string) (entity.Session, error) {
	var session entity.Session
	err := r.request(ctx, http.MethodPost, "/auth/v1/token?grant_type=refresh_token", "", map[string]string{"refresh_token": refreshToken}, &session)
	return session, err
}

func (r *SupabaseUserRepository) User(ctx context.Context, accessToken string) (entity.User, error) {
	var user entity.User
	err := r.request(ctx, http.MethodGet, "/auth/v1/user", accessToken, nil, &user)
	return user, err
}

func (r *SupabaseUserRepository) SignOut(ctx context.Context, accessToken string) error {
	return r.request(ctx, http.MethodPost, "/auth/v1/logout", accessToken, nil, nil)
}

func (r *SupabaseUserRepository) request(ctx context.Context, method, path, accessToken string, body, output any) error {
	var reader io.Reader
	if body != nil {
		encoded, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("encode auth request: %w", err)
		}
		reader = bytes.NewReader(encoded)
	}
	request, err := http.NewRequestWithContext(ctx, method, r.url+path, reader)
	if err != nil {
		return fmt.Errorf("create auth request: %w", err)
	}
	request.Header.Set("apikey", r.key)
	request.Header.Set("Content-Type", "application/json")
	if accessToken != "" {
		request.Header.Set("Authorization", "Bearer "+accessToken)
	}
	response, err := r.client.Do(request)
	if err != nil {
		return fmt.Errorf("call Supabase Auth: %w", err)
	}
	defer response.Body.Close()
	payload, err := io.ReadAll(io.LimitReader(response.Body, 1<<20))
	if err != nil {
		return fmt.Errorf("read auth response: %w", err)
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		var failure struct {
			Message          string `json:"message"`
			Error            string `json:"error"`
			ErrorDescription string `json:"error_description"`
		}
		_ = json.Unmarshal(payload, &failure)
		message := failure.Message
		if message == "" {
			message = failure.ErrorDescription
		}
		if message == "" {
			message = failure.Error
		}
		if message == "" {
			message = "Supabase Auth rejected the request"
		}
		return &ProviderError{Status: response.StatusCode, Message: message}
	}
	if output != nil && len(payload) > 0 {
		if err := json.Unmarshal(payload, output); err != nil {
			return fmt.Errorf("decode auth response: %w", err)
		}
	}
	return nil
}
