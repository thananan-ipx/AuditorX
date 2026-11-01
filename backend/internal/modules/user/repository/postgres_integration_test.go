package repository_test

import (
	"context"
	"encoding/base64"
	"errors"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	projectentity "github.com/IProgressX/auditor-x/backend/internal/modules/project/entity"
	projectrepo "github.com/IProgressX/auditor-x/backend/internal/modules/project/repository"
	"github.com/IProgressX/auditor-x/backend/internal/modules/user/repository"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestPostgresIntegration(t *testing.T) {
	dsn := os.Getenv("AUDITORX_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("run tools/database-tests npm test")
	}
	u, err := url.Parse(dsn)
	if err != nil || u.Hostname() != "127.0.0.1" || u.Path != "/postgres" || u.Query().Get("host") != "" {
		t.Fatal("requires isolated loopback harness")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()
	connect := func(api bool) *pgxpool.Pool {
		cfg, err := pgxpool.ParseConfig(dsn)
		if err != nil {
			t.Fatal(err)
		}
		cfg.MaxConns = 1
		cfg.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeExec
		if api {
			cfg.AfterConnect = func(ctx context.Context, conn *pgx.Conn) error {
				_, err := conn.Exec(ctx, "SET ROLE auditorx_api")
				return err
			}
		}
		pool, err := pgxpool.NewWithConfig(ctx, cfg)
		if err != nil {
			t.Fatal(err)
		}
		t.Cleanup(pool.Close)
		return pool
	}
	admin := connect(false)
	var marker string
	if err := admin.QueryRow(ctx, "SELECT id FROM public.auditorx_test_marker").Scan(&marker); err != nil || marker != "ephemeral-test-only" {
		t.Fatal("test database marker missing")
	}
	app := connect(true)
	repo, err := repository.NewPostgresUserRepository(app)
	if err != nil {
		t.Fatal(err)
	}
	password := "Local-auth-test-89!"
	account, err := repo.SignUp(ctx, " Owner@Example.Test ", password)
	if err != nil {
		t.Fatal(err)
	}
	if account.User.Email != "owner@example.test" || account.AccessToken == "" {
		t.Fatal("account was not normalized or session absent")
	}
	if _, err := repo.SignUp(ctx, "OWNER@example.test", password); err == nil {
		t.Fatal("duplicate email accepted")
	}
	other, err := repo.SignUp(ctx, "other@example.test", password)
	if err != nil {
		t.Fatal(err)
	}
	var storedHash string
	if err := admin.QueryRow(ctx, "SELECT password_hash FROM auth.users WHERE id=$1::uuid", account.User.ID).Scan(&storedHash); err != nil || !strings.HasPrefix(storedHash, "$argon2id$") || strings.Contains(storedHash, password) {
		t.Fatal("password not stored as Argon2id")
	}
	for _, email := range []string{"owner@example.test", "missing@example.test"} {
		_, err := repo.SignIn(ctx, email, "Wrong-password-99!")
		var failure *repository.AuthError
		if !errors.As(err, &failure) || failure.Status != 401 || failure.Message != "Invalid email or password." {
			t.Fatal("wrong credentials accepted or account presence disclosed")
		}
	}
	session, err := repo.SignIn(ctx, "OWNER@EXAMPLE.TEST", password)
	if err != nil {
		t.Fatal(err)
	}
	if session.AccessToken == account.AccessToken {
		t.Fatal("session token reused across logins")
	}
	forged := base64.RawURLEncoding.EncodeToString([]byte(`{"user":{"id":"admin"}}`))
	if _, err := repo.User(ctx, forged); err == nil {
		t.Fatal("forged cookie accepted")
	}
	// Tokens resolve through PostgreSQL even after a new repository/pool is created.
	reconnected, err := repository.NewPostgresUserRepository(connect(true))
	if err != nil {
		t.Fatal(err)
	}
	user, err := reconnected.User(ctx, session.AccessToken)
	if err != nil || user.ID != account.User.ID {
		t.Fatal("session did not survive reconnect")
	}
	projects := projectrepo.NewPostgres(app)
	project, err := projects.Create(ctx, user.ID, projectentity.NewRepository{Name: "local-auth", Owner: "org", URL: "https://github.com/org/local-auth", Branch: "main"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := projects.Get(ctx, other.User.ID, project.ID); err == nil {
		t.Fatal("another account accessed owner repository")
	}
	rotated, err := repo.Refresh(ctx, session.AccessToken)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := repo.User(ctx, session.AccessToken); err == nil {
		t.Fatal("rotated session still valid")
	}
	if err := repo.SignOut(ctx, rotated.AccessToken); err != nil {
		t.Fatal(err)
	}
	if _, err := repo.User(ctx, rotated.AccessToken); err == nil {
		t.Fatal("signed-out session still valid")
	}
	// The PGlite socket harness multiplexes one backend session. Explicitly
	// restore the administrator just for the expiry fixture, then drop it again.
	if _, err := admin.Exec(ctx, "RESET ROLE"); err != nil {
		t.Fatal(err)
	}
	if _, err := admin.Exec(ctx, `UPDATE auth.sessions SET created_at=now()-interval '2 days',expires_at=now()-interval '1 day' WHERE user_id=$1::uuid`, other.User.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := app.Exec(ctx, "SET ROLE auditorx_api"); err != nil {
		t.Fatal(err)
	}
	if _, err := repo.User(ctx, other.AccessToken); err == nil {
		t.Fatal("expired session accepted")
	}
	if _, err := app.Exec(ctx, "SET ROLE authenticated"); err != nil {
		t.Fatal(err)
	}
	if _, err := app.Exec(ctx, "SELECT password_hash FROM auth.users"); err == nil {
		t.Fatal("authenticated role read password hashes")
	}
	if _, err := app.Exec(ctx, "SELECT token_hash FROM auth.sessions"); err == nil {
		t.Fatal("authenticated role read sessions")
	}
}
