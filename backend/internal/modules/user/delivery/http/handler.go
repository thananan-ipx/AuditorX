package http

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

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
		writeAuthError(w, err, http.StatusUnauthorized)
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
	redirectTo := h.frontendURL + "/login?status=Email+confirmed.+You+can+sign+in+now."
	session, err := h.service.SignUp(r.Context(), input.Email, input.Password, redirectTo)
	if err != nil {
		writeAuthError(w, err, http.StatusBadRequest)
		return
	}
	requiresConfirmation := session.AccessToken == ""
	if !requiresConfirmation {
		h.setSessionCookie(w, session)
	}
	response.JSON(w, http.StatusCreated, map[string]any{"data": map[string]any{"user": session.User, "requires_email_confirmation": requiresConfirmation}})
}

func (h *Handler) Refresh(w http.ResponseWriter, r *http.Request) {
	stored, err := readSessionCookie(r)
	if err != nil || stored.RefreshToken == "" {
		h.clearSessionCookie(w)
		response.Error(w, http.StatusUnauthorized, "AUTH_REQUIRED", "A valid session is required.")
		return
	}
	session, err := h.service.Refresh(r.Context(), stored.RefreshToken)
	if err != nil {
		h.clearSessionCookie(w)
		writeAuthError(w, err, http.StatusUnauthorized)
		return
	}
	h.setSessionCookie(w, session)
	response.JSON(w, http.StatusOK, map[string]any{"data": map[string]any{"user": session.User}})
}

func (h *Handler) SignOut(w http.ResponseWriter, r *http.Request) {
	stored, _ := readSessionCookie(r)
	if stored.AccessToken != "" {
		_ = h.service.SignOut(r.Context(), stored.AccessToken)
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
	// Preserve the existing middleware contract while passing verified identity downstream.
	// Never use the User object supplied in the unsigned session cookie.
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
	if err == nil {
		return user, true
	}
	if stored.RefreshToken == "" {
		h.clearSessionCookie(w)
		response.Error(w, http.StatusUnauthorized, "SESSION_EXPIRED", "The session has expired.")
		return entity.User{}, false
	}
	refreshed, refreshErr := h.service.Refresh(r.Context(), stored.RefreshToken)
	if refreshErr != nil {
		h.clearSessionCookie(w)
		response.Error(w, http.StatusUnauthorized, "SESSION_EXPIRED", "The session has expired.")
		return entity.User{}, false
	}
	h.setSessionCookie(w, refreshed)
	if refreshed.User.ID != "" {
		return refreshed.User, true
	}
	user, err = h.service.User(r.Context(), refreshed.AccessToken)
	if err != nil {
		response.Error(w, http.StatusUnauthorized, "INVALID_SESSION", "The refreshed session is invalid.")
		return entity.User{}, false
	}
	return user, true
}

func decodeCredentials(w http.ResponseWriter, r *http.Request) (credentials, bool) {
	var input credentials
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&input); err != nil {
		response.Error(w, http.StatusBadRequest, "INVALID_JSON", "Email and password are required.")
		return input, false
	}
	input.Email = strings.TrimSpace(input.Email)
	if input.Email == "" || len(input.Password) < 8 {
		response.Error(w, http.StatusBadRequest, "INVALID_CREDENTIALS", "Enter a valid email and a password of at least 8 characters.")
		return input, false
	}
	return input, true
}

func (h *Handler) setSessionCookie(w http.ResponseWriter, session entity.Session) {
	payload, _ := json.Marshal(session)
	maxAge := 30 * 24 * 60 * 60
	http.SetCookie(w, &http.Cookie{Name: sessionCookieName, Value: base64.RawURLEncoding.EncodeToString(payload), Path: "/", Domain: h.cookieDomain, MaxAge: maxAge, Expires: time.Now().Add(time.Duration(maxAge) * time.Second), HttpOnly: true, Secure: h.cookieSecure, SameSite: http.SameSiteLaxMode})
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
	payload, err := base64.RawURLEncoding.DecodeString(cookie.Value)
	if err != nil {
		return session, err
	}
	if err := json.Unmarshal(payload, &session); err != nil {
		return session, err
	}
	if session.AccessToken == "" {
		return session, errors.New("missing access token")
	}
	return session, nil
}

func writeAuthError(w http.ResponseWriter, err error, fallbackStatus int) {
	var provider *repository.ProviderError
	if errors.As(err, &provider) {
		response.Error(w, fallbackStatus, "AUTH_FAILED", provider.Message)
		return
	}
	response.Error(w, http.StatusBadGateway, "AUTH_PROVIDER_ERROR", "The authentication provider is unavailable.")
}
