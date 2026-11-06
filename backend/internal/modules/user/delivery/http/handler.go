package http

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/IProgressX/auditor-x/backend/internal/modules/user/entity"
	"github.com/IProgressX/auditor-x/backend/internal/modules/user/repository"
	"github.com/IProgressX/auditor-x/backend/internal/modules/user/service"
	"github.com/IProgressX/auditor-x/backend/internal/shared/identity"
	"github.com/IProgressX/auditor-x/backend/internal/shared/response"
)

const sessionCookieName = "auditorx_session"

type Handler struct {
	service      *service.UserService
	frontendURL  string
	cookieSecure bool
	cookieDomain string
	ExtraRoutes  func(*http.ServeMux)
}

func NewHandler(service *service.UserService, frontendURL string, cookieSecure bool, cookieDomain string) *Handler {
	return &Handler{service: service, frontendURL: frontendURL, cookieSecure: cookieSecure, cookieDomain: cookieDomain}
}

type credentials struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (h *Handler) SignIn(w http.ResponseWriter, r *http.Request) {
	input, ok := decodeCredentials(w, r)
	if !ok {
		return
	}
	session, err := h.service.SignIn(r.Context(), input.Email, input.Password)
	if err != nil {
		writeAuthError(w, err)
		return
	}
	h.setSessionCookie(w, session)
	response.JSON(w, http.StatusOK, map[string]any{"data": map[string]any{"user": session.User}})
}

func (h *Handler) SignUp(w http.ResponseWriter, r *http.Request) {
	input, ok := decodeCredentials(w, r)
	if !ok {
		return
	}
	session, err := h.service.SignUp(r.Context(), input.Email, input.Password)
	if err != nil {
		writeAuthError(w, err)
		return
	}
	h.setSessionCookie(w, session)
	response.JSON(w, http.StatusCreated, map[string]any{"data": map[string]any{"user": session.User}})
}

func (h *Handler) Refresh(w http.ResponseWriter, r *http.Request) {
	stored, err := readSessionCookie(r)
	if err != nil || stored.AccessToken == "" {
		h.clearSessionCookie(w)
		response.Error(w, http.StatusUnauthorized, "AUTH_REQUIRED", "A valid session is required.")
		return
	}
	session, err := h.service.Refresh(r.Context(), stored.AccessToken)
	if err != nil {
		h.clearSessionCookie(w)
		writeAuthError(w, err)
		return
	}
	h.setSessionCookie(w, session)
	response.JSON(w, http.StatusOK, map[string]any{"data": map[string]any{"user": session.User}})
}

func (h *Handler) SignOut(w http.ResponseWriter, r *http.Request) {
	stored, _ := readSessionCookie(r)
	if stored.AccessToken != "" {
		if err := h.service.SignOut(r.Context(), stored.AccessToken); err != nil {
			writeAuthError(w, err)
			return
		}
	}
	h.clearSessionCookie(w)
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	user, ok := h.authenticate(w, r)
	if !ok {
		return
	}
	response.JSON(w, http.StatusOK, map[string]any{"data": map[string]any{"user": user}})
}

func (h *Handler) Authenticate(w http.ResponseWriter, r *http.Request) bool {
	user, ok := h.authenticate(w, r)
	if !ok {
		return false
	}
	if user.ID == "" {
		response.Error(w, http.StatusUnauthorized, "INVALID_SESSION", "A verified user is required.")
		return false
	}
	// Pass only the identity resolved from the server-side session downstream.
	*r = *r.WithContext(identity.WithUserID(r.Context(), user.ID))
	return true
}

func (h *Handler) authenticate(w http.ResponseWriter, r *http.Request) (entity.User, bool) {
	stored, err := readSessionCookie(r)
	if err != nil {
		response.Error(w, http.StatusUnauthorized, "AUTH_REQUIRED", "A valid session is required.")
		return entity.User{}, false
	}
	user, err := h.service.User(r.Context(), stored.AccessToken)
	if err != nil {
		var authError *repository.AuthError
		if errors.As(err, &authError) && authError.Status == http.StatusUnauthorized {
			h.clearSessionCookie(w)
		}
		writeAuthError(w, err)
		return entity.User{}, false
	}
	if user.ID == "" {
		h.clearSessionCookie(w)
		response.Error(w, http.StatusUnauthorized, "INVALID_SESSION", "A verified user is required.")
		return entity.User{}, false
	}
	return user, true
}

func decodeCredentials(w http.ResponseWriter, r *http.Request) (credentials, bool) {
	var input credentials
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&input); err != nil {
		response.Error(w, http.StatusBadRequest, "INVALID_JSON", "Email and password are required.")
		return input, false
	}
	if err := decoder.Decode(new(any)); err != io.EOF {
		response.Error(w, http.StatusBadRequest, "INVALID_JSON", "Send one JSON credentials object.")
		return input, false
	}
	input.Email = strings.TrimSpace(input.Email)
	if input.Email == "" || len(input.Email) > 254 || utf8.RuneCountInString(input.Password) < 8 || utf8.RuneCountInString(input.Password) > 128 || len(input.Password) > 512 {
		response.Error(w, http.StatusBadRequest, "INVALID_CREDENTIALS", "Enter a valid email and a password between 8 and 128 characters.")
		return input, false
	}
	return input, true
}

func (h *Handler) setSessionCookie(w http.ResponseWriter, session entity.Session) {
	maxAge := session.ExpiresIn
	if maxAge <= 0 {
		maxAge = 30 * 24 * 60 * 60
	}
	http.SetCookie(w, &http.Cookie{Name: sessionCookieName, Value: session.AccessToken, Path: "/", Domain: h.cookieDomain, MaxAge: maxAge, Expires: time.Now().Add(time.Duration(maxAge) * time.Second), HttpOnly: true, Secure: h.cookieSecure, SameSite: http.SameSiteLaxMode})
}

// SetSessionCookie lets external identity providers create the same opaque local session.
func (h *Handler) SetSessionCookie(w http.ResponseWriter, session entity.Session) {
	h.setSessionCookie(w, session)
}

func (h *Handler) clearSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{Name: sessionCookieName, Value: "", Path: "/", Domain: h.cookieDomain, MaxAge: -1, Expires: time.Unix(1, 0), HttpOnly: true, Secure: h.cookieSecure, SameSite: http.SameSiteLaxMode})
}

func readSessionCookie(r *http.Request) (entity.Session, error) {
	var session entity.Session
	cookie, err := r.Cookie(sessionCookieName)
	if err != nil {
		return session, err
	}
	if cookie.Value == "" || len(cookie.Value) > 256 {
		return session, errors.New("invalid session token")
	}
	session.AccessToken = cookie.Value
	return session, nil
}

func writeAuthError(w http.ResponseWriter, err error) {
	var provider *repository.AuthError
	if errors.As(err, &provider) {
		response.Error(w, provider.Status, "AUTH_FAILED", provider.Message)
		return
	}
	response.Error(w, http.StatusServiceUnavailable, "AUTH_STORE_UNAVAILABLE", "The account store is unavailable. Please try again.")
}
