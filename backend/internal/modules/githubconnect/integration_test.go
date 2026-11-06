package githubconnect

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	projectrepo "github.com/IProgressX/auditor-x/backend/internal/modules/project/repository"
	"github.com/IProgressX/auditor-x/backend/internal/modules/scan"
	userentity "github.com/IProgressX/auditor-x/backend/internal/modules/user/entity"
	userrepo "github.com/IProgressX/auditor-x/backend/internal/modules/user/repository"
	"github.com/IProgressX/auditor-x/backend/internal/shared/github"
	"github.com/IProgressX/auditor-x/backend/internal/shared/identity"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type roundTrip func(*http.Request) (*http.Response, error)

func (f roundTrip) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

type analyzer struct{}

func (analyzer) Analyze(context.Context, string, string) (scan.Result, error) {
	return scan.Result{ScannerVersion: "1.175.0", Findings: []scan.Finding{}}, nil
}

func TestPostgresIntegration(t *testing.T) {
	dsn := os.Getenv("AUDITORX_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("run tools/database-tests npm test")
	}
	u, err := url.Parse(dsn)
	if err != nil || u.Hostname() != "127.0.0.1" || u.Path != "/postgres" || u.Query().Get("host") != "" {
		t.Fatal("requires isolated loopback harness")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Second)
	defer cancel()
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	cfg.MaxConns = 1
	cfg.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeExec
	db, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	// The PGlite socket multiplexes one session across sequential Go packages.
	if _, err = db.Exec(ctx, "RESET ROLE"); err != nil {
		t.Fatal(err)
	}
	var marker string
	if err = db.QueryRow(ctx, `SELECT id FROM public.auditorx_test_marker`).Scan(&marker); err != nil || marker != "ephemeral-test-only" {
		t.Fatalf("missing test marker: %q %v", marker, err)
	}
	role := func(name string) {
		t.Helper()
		_, err := db.Exec(ctx, name)
		if err != nil {
			t.Fatal(err)
		}
	}
	role("SET ROLE auditorx_api")
	users, err := userrepo.NewPostgresUserRepository(db)
	if err != nil {
		t.Fatal(err)
	}
	local, err := users.SignUp(ctx, "github-local@example.test", "Test-password-2026!")
	if err != nil {
		t.Fatal(err)
	}
	var archive bytes.Buffer
	writer := zip.NewWriter(&archive)
	file, _ := writer.Create("fixture/app.py")
	_, _ = file.Write([]byte("x = 1\n"))
	_ = writer.Close()
	ghID := int64(987001)
	email := "github-new@example.test"
	allowRepo := true
	exchanges := 0
	challenge := ""
	client := github.NewClient()
	client.HTTP.Transport = roundTrip(func(r *http.Request) (*http.Response, error) {
		body := ""
		status := 200
		headers := http.Header{}
		switch {
		case r.URL.Host == "github.com" && r.URL.Path == "/login/oauth/access_token":
			exchanges++
			var input map[string]string
			_ = json.NewDecoder(r.Body).Decode(&input)
			hash := sha256.Sum256([]byte(input["code_verifier"]))
			if base64.RawURLEncoding.EncodeToString(hash[:]) != challenge {
				t.Fatal("PKCE verifier not bound to authorize challenge")
			}
			body = `{"access_token":"ghu_fixture_secret","expires_in":28800}`
		case r.URL.Host == "codeload.github.com":
			if r.Header.Get("Authorization") != "" {
				t.Fatal("token forwarded to download host")
			}
			body = archive.String()
		default:
			if r.URL.Host != "api.github.com" || r.Header.Get("Authorization") != "Bearer ghu_fixture_secret" {
				t.Fatalf("unexpected upstream host/auth: %s", r.URL.Host)
			}
			switch r.URL.Path {
			case "/user":
				data, _ := json.Marshal(map[string]any{"id": ghID, "login": "fixture-user"})
				body = string(data)
			case "/user/emails":
				data, _ := json.Marshal([]map[string]any{{"email": email, "verified": true, "primary": true}})
				body = string(data)
			case "/user/installations":
				body = `{"total_count":1,"installations":[{"id":10,"account":{"login":"fixture"}}]}`
			case "/user/installations/10/repositories":
				body = `{"total_count":1,"repositories":[{"id":9001,"name":"private-repo","full_name":"fixture/private-repo","private":true,"default_branch":"main","owner":{"login":"fixture"}}]}`
				if !allowRepo {
					body = `{"total_count":0,"repositories":[]}`
				}
			case "/repositories/9001":
				body = `{"id":9001,"name":"private-repo","full_name":"fixture/private-repo","private":true,"default_branch":"main","owner":{"login":"fixture"}}`
			case "/repos/fixture/private-repo/branches/main":
				body = `{"name":"main"}`
			case "/repos/fixture/private-repo/commits/main":
				body = `{"sha":"` + strings.Repeat("a", 40) + `"}`
			case "/repos/fixture/private-repo/zipball/" + strings.Repeat("a", 40):
				status = 302
				headers.Set("Location", "https://codeload.github.com/fixture/private-repo/zip/sha?token=fixture-signed")
			default:
				t.Fatalf("unexpected upstream path: %s", r.URL.Path)
			}
		}
		return &http.Response{StatusCode: status, Header: headers, Body: io.NopCloser(strings.NewReader(body))}, nil
	})
	key := make([]byte, 32)
	h := &Handler{Config: github.Config{ClientID: "client", ClientSecret: "fixture", CallbackURL: "http://localhost:8080/api/v1/auth/github/callback", AppSlug: "auditorx", EncryptionKey: key}, FrontendURL: "http://localhost:3000", Store: Store{DB: db, Key: key}, Client: client, Users: users, Repositories: projectrepo.NewPostgres(db)}
	h.Authenticate = func(w http.ResponseWriter, r *http.Request) bool {
		cookie, e := r.Cookie("session")
		if e != nil {
			w.WriteHeader(401)
			return false
		}
		user, e := users.User(r.Context(), cookie.Value)
		if e != nil {
			w.WriteHeader(401)
			return false
		}
		*r = *r.WithContext(identity.WithUserID(r.Context(), user.ID))
		return true
	}
	h.SetSession = func(w http.ResponseWriter, s userentity.Session) {
		http.SetCookie(w, &http.Cookie{Name: "session", Value: s.AccessToken})
	}
	mux := http.NewServeMux()
	h.RegisterRoutes(mux)
	start := func(mode, session string) (string, *http.Cookie) {
		t.Helper()
		r := httptest.NewRequest("GET", "/api/v1/auth/github/start?mode="+mode+"&next=%2Frepositories", nil).WithContext(ctx)
		if session != "" {
			r.AddCookie(&http.Cookie{Name: "session", Value: session})
		}
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, r)
		if w.Code != 302 {
			t.Fatalf("start failed: %d %s", w.Code, w.Body.String())
		}
		location, _ := url.Parse(w.Header().Get("Location"))
		challenge = location.Query().Get("code_challenge")
		if location.Host != "github.com" || len(challenge) != 43 {
			t.Fatal("bad authorize request")
		}
		return location.Query().Get("state"), w.Result().Cookies()[0]
	}
	callback := func(state string, cookie *http.Cookie, session string) *httptest.ResponseRecorder {
		t.Helper()
		r := httptest.NewRequest("GET", "/api/v1/auth/github/callback?code=fixture&state="+state, nil).WithContext(ctx)
		r.AddCookie(cookie)
		if session != "" {
			r.AddCookie(&http.Cookie{Name: "session", Value: session})
		}
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, r)
		return w
	}
	state, cookie := start("login", "")
	wrong := *cookie
	wrong.Value = randomToken()
	w := callback(state, &wrong, "")
	if !strings.Contains(w.Header().Get("Location"), "github_state") || exchanges != 0 {
		t.Fatal("wrong-browser state reached exchange")
	}
	w = callback(state, cookie, "")
	if w.Header().Get("Location") != "http://localhost:3000/repositories" {
		t.Fatalf("GitHub login failed: %s", w.Header().Get("Location"))
	}
	session := ""
	for _, c := range w.Result().Cookies() {
		if c.Name == "session" {
			session = c.Value
		}
	}
	user, err := users.User(ctx, session)
	if err != nil || user.Email != email {
		t.Fatal("GitHub-only session not accepted")
	}
	refreshed, err := users.Refresh(ctx, session)
	if err != nil {
		t.Fatal("GitHub-only session cannot refresh")
	}
	session = refreshed.AccessToken
	w = callback(state, cookie, "")
	if !strings.Contains(w.Header().Get("Location"), "github_state") || exchanges != 1 {
		t.Fatal("state replay accepted")
	}
	// Never claim a local account merely because GitHub supplies its email.
	_, err = users.GitHubSession(ctx, "", 987002, "other", local.User.Email, []byte("encrypted"), nil)
	var auth *userrepo.AuthError
	if !errors.As(err, &auth) || auth.Status != 409 {
		t.Fatal("matching email implicitly linked")
	}
	_, err = users.GitHubSession(ctx, local.User.ID, ghID, "fixture-user", "", []byte("encrypted"), nil)
	if !errors.As(err, &auth) || auth.Status != 409 {
		t.Fatal("GitHub identity linked to two accounts")
	}
	// Linking an unclaimed GitHub identity requires a live local session.
	ghID = 987003
	email = local.User.Email
	state, cookie = start("connect", local.AccessToken)
	w = callback(state, cookie, local.AccessToken)
	if w.Header().Get("Location") != "http://localhost:3000/repositories" {
		t.Fatalf("explicit link failed: %s", w.Header().Get("Location"))
	}
	for _, c := range w.Result().Cookies() {
		if c.Name == "session" {
			linked, e := users.User(ctx, c.Value)
			if e != nil || linked.ID != local.User.ID {
				t.Fatal("link changed local user")
			}
		}
	}
	// Import checks the selected installation, persists its immutable ID and can
	// be scanned by the existing queue/worker using the requester's credential.
	importRequest := func(id int64) *httptest.ResponseRecorder {
		payload, _ := json.Marshal(map[string]any{"repository_id": id, "installation_id": 10, "page": 1, "branch": "main"})
		r := httptest.NewRequest("POST", "/api/v1/github/import", bytes.NewReader(payload)).WithContext(identity.WithUserID(ctx, user.ID))
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, r)
		return w
	}
	w = importRequest(9002)
	if w.Code != 403 {
		t.Fatal("arbitrary repository imported")
	}
	w = importRequest(9001)
	if w.Code != 201 {
		t.Fatalf("import failed: %d %s", w.Code, w.Body.String())
	}
	var imported struct {
		Data struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &imported)
	jobs := scan.NewStore(db)
	job, err := jobs.Enqueue(ctx, user.ID, imported.Data.ID, "main")
	if err != nil {
		t.Fatal(err)
	}
	role("RESET ROLE")
	worker := scan.Worker{Queue: jobs, Source: scan.JobSource{GitHub: scan.ConnectedGitHubSource{Store: jobs, Client: client, Key: key}}, Analyzer: analyzer{}}
	if done, e := worker.RunOne(ctx); e != nil || !done {
		t.Fatalf("connected scan failed: %v", e)
	}
	result, err := jobs.Get(ctx, user.ID, imported.Data.ID, job.ID)
	if err != nil || result.Status != "completed" || result.CommitSHA == nil || *result.CommitSHA != strings.Repeat("a", 40) {
		t.Fatalf("connected scan result: %+v %v", result, err)
	}
	// Removing a public/private repo from the installation must fence retrieval,
	// even though its old URL and AuditorX membership still exist.
	_, err = jobs.Enqueue(ctx, user.ID, imported.Data.ID, "main")
	if err != nil {
		t.Fatal(err)
	}
	allowRepo = false
	if done, e := worker.RunOne(ctx); e != nil || !done {
		t.Fatal(e)
	}
	list, err := jobs.List(ctx, user.ID, imported.Data.ID)
	if err != nil || list[0].Status != "failed" || list[0].ErrorCode == nil || *list[0].ErrorCode != "GITHUB_ACCESS_REQUIRED" {
		t.Fatal("removed GitHub access was not enforced")
	}
	role("SET ROLE auditorx_api")
	if err = h.Store.Disconnect(ctx, user.ID); err != nil {
		t.Fatal(err)
	}
	if _, err = h.Store.Token(ctx, user.ID); err == nil {
		t.Fatal("disconnected token remains usable")
	}
	// Disconnect removes scanning credentials but preserves the sign-in identity.
	resumed, err := users.GitHubSession(ctx, "", 987001, "renamed-login", "changed@example.test", []byte("new-encrypted"), nil)
	if err != nil || resumed.User.ID != user.ID {
		t.Fatal("disconnect or email/login rename changed identity")
	}
	role("RESET ROLE")
}
