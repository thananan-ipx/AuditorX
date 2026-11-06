package githubconnect

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	projectentity "github.com/IProgressX/auditor-x/backend/internal/modules/project/entity"
	projectrepo "github.com/IProgressX/auditor-x/backend/internal/modules/project/repository"
	projectservice "github.com/IProgressX/auditor-x/backend/internal/modules/project/service"
	userentity "github.com/IProgressX/auditor-x/backend/internal/modules/user/entity"
	userrepo "github.com/IProgressX/auditor-x/backend/internal/modules/user/repository"
	"github.com/IProgressX/auditor-x/backend/internal/shared/github"
	"github.com/IProgressX/auditor-x/backend/internal/shared/identity"
	"github.com/IProgressX/auditor-x/backend/internal/shared/response"
)

type Handler struct {
	Config       github.Config
	FrontendURL  string
	CookieSecure bool
	Store        Store
	Client       *github.Client
	Users        *userrepo.PostgresUserRepository
	Repositories *projectrepo.Postgres
	Authenticate func(http.ResponseWriter, *http.Request) bool
	SetSession   func(http.ResponseWriter, userentity.Session)
	LimitAuth    func(http.HandlerFunc) http.HandlerFunc
}

const stateCookie = "auditorx_github_state"

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	wrap := func(fn http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Cache-Control", "no-store")
			w.Header().Set("Referrer-Policy", "no-referrer")
			if !h.Config.Enabled() {
				response.Error(w, 503, "GITHUB_NOT_CONFIGURED", "GitHub connection is not configured.")
				return
			}
			fn(w, r)
		}
	}
	mux.HandleFunc("GET /api/v1/auth/github/config", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		response.JSON(w, 200, map[string]any{"data": map[string]any{"enabled": h.Config.Enabled()}})
	})
	limited := func(fn http.HandlerFunc) http.HandlerFunc {
		if h.LimitAuth != nil {
			return h.LimitAuth(fn)
		}
		return fn
	}
	mux.HandleFunc("GET /api/v1/auth/github/start", wrap(limited(h.Start)))
	mux.HandleFunc("GET /api/v1/auth/github/callback", wrap(limited(h.Callback)))
	mux.HandleFunc("GET /api/v1/github/connection", wrap(h.Connection))
	mux.HandleFunc("POST /api/v1/github/disconnect", wrap(h.Disconnect))
	mux.HandleFunc("GET /api/v1/github/installations", wrap(h.Installations))
	mux.HandleFunc("GET /api/v1/github/repositories", wrap(h.RepositoriesList))
	mux.HandleFunc("GET /api/v1/github/branches", wrap(h.Branches))
	mux.HandleFunc("POST /api/v1/github/import", wrap(h.Import))
}
func safeNext(next string) string {
	// Allow only internal application destinations, never schemes, backslashes,
	// control characters or encoded variants of them.
	if len(next) > 2048 || strings.ContainsAny(next, "\\\r\n") {
		return "/repositories"
	}
	u, err := url.Parse(next)
	if err != nil || u.IsAbs() || u.Host != "" || !strings.HasPrefix(u.Path, "/") || strings.HasPrefix(u.Path, "//") || strings.ContainsAny(u.Path, "\\\r\n") || strings.HasPrefix(u.Path, "/login") {
		return "/repositories"
	}
	return u.String()
}
func randomToken() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		panic("system entropy unavailable")
	}
	return base64.RawURLEncoding.EncodeToString(b)
}
func (h *Handler) stateCookie(w http.ResponseWriter, value string, maxAge int) {
	http.SetCookie(w, &http.Cookie{Name: stateCookie, Value: value, Path: "/api/v1/auth/github", MaxAge: maxAge, HttpOnly: true, Secure: h.CookieSecure, SameSite: http.SameSiteLaxMode})
}
func (h *Handler) Start(w http.ResponseWriter, r *http.Request) {
	actor := ""
	mode := r.URL.Query().Get("mode")
	if mode == "connect" {
		if !h.Authenticate(w, r) {
			return
		}
		actor = identity.UserID(r.Context())
	} else if mode != "" && mode != "login" {
		response.Error(w, 400, "INVALID_MODE", "Choose login or connect.")
		return
	}
	state, browser, verifier := randomToken(), randomToken(), randomToken()
	flow := oauthState{Actor: actor, Verifier: verifier, Next: safeNext(r.URL.Query().Get("next"))}
	if err := h.Store.SaveState(r.Context(), state, browser, flow); err != nil {
		h.writeError(w, err)
		return
	}
	h.stateCookie(w, browser, 600)
	challenge := sha256.Sum256([]byte(verifier))
	q := url.Values{"client_id": {h.Config.ClientID}, "redirect_uri": {h.Config.CallbackURL}, "state": {state}, "code_challenge": {base64.RawURLEncoding.EncodeToString(challenge[:])}, "code_challenge_method": {"S256"}}
	http.Redirect(w, r, "https://github.com/login/oauth/authorize?"+q.Encode(), http.StatusFound)
}
func (h *Handler) Callback(w http.ResponseWriter, r *http.Request) {
	fail := func(code string) { http.Redirect(w, r, h.FrontendURL+"/login?error="+code, http.StatusSeeOther) }
	cookie, err := r.Cookie(stateCookie)
	h.stateCookie(w, "", -1)
	if err != nil || len(cookie.Value) != 43 || len(r.URL.Query().Get("state")) != 43 {
		fail("github_state")
		return
	}
	flow, err := h.Store.ConsumeState(r.Context(), r.URL.Query().Get("state"), cookie.Value)
	if err != nil {
		fail("github_state")
		return
	}
	if flow.Actor != "" {
		if !h.Authenticate(w, r) {
			return
		}
		if identity.UserID(r.Context()) != flow.Actor {
			fail("github_state")
			return
		}
	}
	code := r.URL.Query().Get("code")
	if r.URL.Query().Get("error") != "" || code == "" || len(code) > 1024 {
		fail("github_denied")
		return
	}
	token, err := h.Client.Exchange(r.Context(), h.Config, code, flow.Verifier)
	if err != nil {
		fail("github_access")
		return
	}
	var profile github.Profile
	if err = h.Client.Get(r.Context(), token.Token, "/user", &profile); err != nil || profile.ID <= 0 || profile.Login == "" {
		fail("github_access")
		return
	}
	// Email is used only for new-account creation, never to claim an existing account.
	var emails []github.Email
	_ = h.Client.Get(r.Context(), token.Token, "/user/emails", &emails)
	email := ""
	for _, e := range emails {
		if e.Verified && e.Primary {
			email = e.Email
			break
		}
	}
	encrypted, err := github.Seal(h.Config.EncryptionKey, token.Token, profile.ID)
	if err != nil {
		fail("github_access")
		return
	}
	var expires *time.Time
	if token.ExpiresIn > 0 {
		at := time.Now().Add(time.Duration(token.ExpiresIn) * time.Second)
		expires = &at
	}
	session, err := h.Users.GitHubSession(r.Context(), flow.Actor, profile.ID, profile.Login, email, encrypted, expires)
	if err != nil {
		var auth *userrepo.AuthError
		if errors.As(err, &auth) && auth.Status == 409 {
			fail("github_account_conflict")
		} else if errors.As(err, &auth) && auth.Status == 400 {
			fail("github_email")
		} else {
			fail("github_access")
		}
		return
	}
	h.SetSession(w, session)
	http.Redirect(w, r, h.FrontendURL+flow.Next, http.StatusSeeOther)
}
func (h *Handler) Connection(w http.ResponseWriter, r *http.Request) {
	c, err := h.Store.Connection(r.Context(), identity.UserID(r.Context()))
	if err != nil {
		h.writeError(w, err)
		return
	}
	response.JSON(w, 200, map[string]any{"data": map[string]any{"connection": c, "installation_url": "https://github.com/apps/" + h.Config.AppSlug + "/installations/new"}})
}
func (h *Handler) Disconnect(w http.ResponseWriter, r *http.Request) {
	if err := h.Store.Disconnect(r.Context(), identity.UserID(r.Context())); err != nil {
		h.writeError(w, err)
		return
	}
	w.WriteHeader(204)
}
func (h *Handler) token(w http.ResponseWriter, r *http.Request) (string, bool) {
	token, err := h.Store.Token(r.Context(), identity.UserID(r.Context()))
	if err != nil {
		h.writeError(w, github.ErrAccess)
		return "", false
	}
	return token, true
}
func pageParam(r *http.Request) (int, error) {
	s := r.URL.Query().Get("page")
	if s == "" {
		return 1, nil
	}
	p, e := strconv.Atoi(s)
	if e != nil || p < 1 || p > 10000 {
		return 0, errors.New("invalid page")
	}
	return p, nil
}
func positiveID(s string) (int64, error) {
	id, err := strconv.ParseInt(s, 10, 64)
	if err != nil || id < 1 {
		return 0, errors.New("invalid id")
	}
	return id, nil
}
func (h *Handler) Installations(w http.ResponseWriter, r *http.Request) {
	token, ok := h.token(w, r)
	if !ok {
		return
	}
	page, err := pageParam(r)
	if err != nil {
		response.Error(w, 400, "INVALID_PAGE", "Invalid page.")
		return
	}
	var out struct {
		Installations []github.Installation `json:"installations"`
		Total         int                   `json:"total_count"`
	}
	if err = h.Client.Get(r.Context(), token, "/user/installations?per_page=30&page="+strconv.Itoa(page), &out); err != nil {
		h.writeError(w, err)
		return
	}
	response.JSON(w, 200, map[string]any{"data": out})
}
func (h *Handler) RepositoriesList(w http.ResponseWriter, r *http.Request) {
	token, ok := h.token(w, r)
	if !ok {
		return
	}
	installation, err := positiveID(r.URL.Query().Get("installation_id"))
	page, e := pageParam(r)
	if err != nil || e != nil {
		response.Error(w, 400, "INVALID_QUERY", "Choose an installation and page.")
		return
	}
	var out struct {
		Repositories []github.Repository `json:"repositories"`
		Total        int                 `json:"total_count"`
	}
	path := "/user/installations/" + strconv.FormatInt(installation, 10) + "/repositories?per_page=30&page=" + strconv.Itoa(page)
	if err = h.Client.Get(r.Context(), token, path, &out); err != nil {
		h.writeError(w, err)
		return
	}
	response.JSON(w, 200, map[string]any{"data": out})
}
func (h *Handler) Branches(w http.ResponseWriter, r *http.Request) {
	token, ok := h.token(w, r)
	if !ok {
		return
	}
	id, err := positiveID(r.URL.Query().Get("repository_id"))
	page, e := pageParam(r)
	if err != nil || e != nil {
		response.Error(w, 400, "INVALID_QUERY", "Choose a repository and page.")
		return
	}
	repo, err := h.Client.Repository(r.Context(), token, id)
	if err != nil {
		h.writeError(w, err)
		return
	}
	path, _ := repo.Path()
	var branches []struct {
		Name string `json:"name"`
	}
	if err = h.Client.Get(r.Context(), token, path+"/branches?per_page=30&page="+strconv.Itoa(page), &branches); err != nil {
		h.writeError(w, err)
		return
	}
	response.JSON(w, 200, map[string]any{"data": branches})
}
func (h *Handler) Import(w http.ResponseWriter, r *http.Request) {
	token, ok := h.token(w, r)
	if !ok {
		return
	}
	var input struct {
		RepositoryID   int64  `json:"repository_id"`
		InstallationID int64  `json:"installation_id"`
		Page           int    `json:"page"`
		Branch         string `json:"branch"`
	}
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096))
	dec.DisallowUnknownFields()
	if dec.Decode(&input) != nil || dec.Decode(new(any)) != io.EOF || input.RepositoryID <= 0 || input.InstallationID <= 0 || input.Page < 1 || input.Page > 10000 {
		response.Error(w, 400, "INVALID_INPUT", "Select a GitHub repository and branch.")
		return
	}
	// Re-read the selected installation page: client-provided repo names, URLs and
	// visibility are never trusted, and arbitrary upstream IDs cannot be imported.
	var list struct {
		Repositories []github.Repository `json:"repositories"`
	}
	err := h.Client.Get(r.Context(), token, "/user/installations/"+strconv.FormatInt(input.InstallationID, 10)+"/repositories?per_page=30&page="+strconv.Itoa(input.Page), &list)
	if err != nil {
		h.writeError(w, err)
		return
	}
	selected := false
	for _, repo := range list.Repositories {
		if repo.ID == input.RepositoryID {
			selected = true
			break
		}
	}
	if !selected {
		h.writeError(w, github.ErrAccess)
		return
	}
	repo, err := h.Client.Repository(r.Context(), token, input.RepositoryID)
	if err != nil {
		h.writeError(w, err)
		return
	}
	path, _ := repo.Path()
	branch := strings.TrimSpace(input.Branch)
	if branch == "" {
		branch = repo.DefaultBranch
	}
	if branch == "" || len(branch) > 255 || strings.ContainsAny(branch, "\\\r\n") || strings.Contains(branch, "..") {
		response.Error(w, 400, "INVALID_BRANCH", "Choose a valid branch.")
		return
	}
	var check struct {
		Name string `json:"name"`
	}
	if err = h.Client.Get(r.Context(), token, path+"/branches/"+url.PathEscape(branch), &check); err != nil || check.Name != branch {
		response.Error(w, 400, "INVALID_BRANCH", "This branch is unavailable. Refresh the repository list.")
		return
	}
	canonical, err := projectservice.ValidateInput(projectentity.CreateInput{URL: "https://github.com/" + repo.Owner.Login + "/" + repo.Name, Branch: branch})
	if err != nil {
		response.Error(w, 400, "INVALID_BRANCH", "Choose a repository and branch supported by the scanner.")
		return
	}
	result, err := h.Repositories.ImportGitHub(r.Context(), identity.UserID(r.Context()), canonical, repo.ID, input.InstallationID)
	if err != nil {
		h.writeError(w, err)
		return
	}
	response.JSON(w, 201, map[string]any{"data": result})
}
func (h *Handler) writeError(w http.ResponseWriter, err error) {
	if errors.Is(err, github.ErrAccess) {
		response.Error(w, 403, "GITHUB_RECONNECT", "Reconnect GitHub or review the app's repository access.")
		return
	}
	if errors.Is(err, projectentity.ErrConflict) {
		response.Error(w, 409, "REPOSITORY_EXISTS", "This repository is already in your workspace.")
		return
	}
	response.Error(w, 503, "GITHUB_UNAVAILABLE", "GitHub connection is temporarily unavailable.")
}
