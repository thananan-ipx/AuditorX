package repository_test

import (
	"context"
	"errors"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/IProgressX/auditor-x/backend/internal/modules/project/entity"
	"github.com/IProgressX/auditor-x/backend/internal/modules/project/repository"
	"github.com/IProgressX/auditor-x/backend/internal/modules/project/service"
	"github.com/IProgressX/auditor-x/backend/internal/shared/identity"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

const alice = "11111111-1111-4111-8111-111111111111"
const bob = "22222222-2222-4222-8222-222222222222"
const viewer = "33333333-3333-4333-8333-333333333333"

func TestPostgresIntegration(t *testing.T) {
	dsn := os.Getenv("AUDITORX_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("run tools/database-tests npm test to start an isolated database")
	}
	u, err := url.Parse(dsn)
	if err != nil || u.Hostname() != "127.0.0.1" || u.Path != "/postgres" || u.Query().Get("host") != "" {
		t.Fatal("integration tests require the loopback ephemeral harness, not DATABASE_URL")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()
	connect := func() *pgxpool.Pool {
		cfg, err := pgxpool.ParseConfig(dsn)
		if err != nil {
			t.Fatal("invalid test configuration")
		}
		cfg.MaxConns = 1
		// PGlite's socket multiplexes a single server session. Use unnamed
		// extended-protocol queries to avoid cross-connection statement-cache collisions.
		cfg.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeExec
		pool, err := pgxpool.NewWithConfig(ctx, cfg)
		if err != nil {
			t.Fatal(err)
		}
		var marker string
		if err := pool.QueryRow(ctx, "SELECT id FROM public.auditorx_test_marker").Scan(&marker); err != nil || marker != "ephemeral-test-only" {
			pool.Close()
			t.Fatal("database is not the dedicated ephemeral test harness")
		}
		return pool
	}
	pool := connect()
	defer func() { pool.Close() }()
	svc := service.New(repository.NewPostgres(pool))
	aCtx, bCtx := identity.WithUserID(ctx, alice), identity.WithUserID(ctx, bob)
	input := entity.CreateInput{URL: "https://github.com/org/adapter-test", Branch: "develop"}
	created, err := svc.Create(aCtx, input)
	if err != nil {
		t.Fatal(err)
	}
	if created.CreatedBy != alice || created.AccessLevel != "owner" || created.Branch != "develop" {
		t.Fatalf("unexpected repository: %+v", created)
	}
	directory := repository.NewPostgres(pool)
	matches, err := directory.Search(ctx, alice, "ADAPTER")
	if err != nil || len(matches) != 1 || matches[0].ID != created.ID {
		t.Fatalf("owner search failed: %+v %v", matches, err)
	}
	matches, err = directory.Search(ctx, bob, "adapter")
	if err != nil || len(matches) != 0 {
		t.Fatal("search exposed another user's repository")
	}
	for _, literal := range []string{"%", "_", "' OR true --"} {
		matches, err = directory.Search(ctx, alice, literal)
		if err != nil || len(matches) != 0 {
			t.Fatal("search query acted as a wildcard or SQL")
		}
	}
	if _, err := svc.Get(bCtx, created.ID); !errors.Is(err, entity.ErrNotFound) {
		t.Fatalf("cross-user read: %v", err)
	}
	items, err := svc.List(bCtx, 1, 20)
	if err != nil || len(items) != 0 {
		t.Fatalf("cross-user list: %v %+v", err, items)
	}
	if _, err := svc.Create(aCtx, input); !errors.Is(err, entity.ErrConflict) {
		t.Fatalf("duplicate: %v", err)
	}
	// Same upstream repository may be registered in separate ownership scopes.
	if _, err := svc.Create(bCtx, input); err != nil {
		t.Fatal(err)
	}
	items, err = svc.List(aCtx, 1, 20)
	if err != nil || len(items) != 1 || items[0].ID != created.ID {
		t.Fatalf("owner list: %v %+v", err, items)
	}

	// Confirm the actual pooled connection has no leftover actor after failed/successful calls.
	var role, userID string
	if err := pool.QueryRow(ctx, "SELECT current_user, coalesce(auth.uid()::text, '')").Scan(&role, &userID); err != nil {
		t.Fatal(err)
	}
	if role == "authenticated" || userID != "" {
		t.Fatalf("identity leaked: %s %s", role, userID)
	}

	// A second service/connection must read the persisted record.
	pool.Close()
	pool = connect()
	svc = service.New(repository.NewPostgres(pool))
	got, err := svc.Get(aCtx, created.ID)
	if err != nil || got.ID != created.ID {
		t.Fatalf("reconnect: %+v %v", got, err)
	}

	_, err = pool.Exec(ctx, `INSERT INTO public.repository_members (repository_id,repository_owner_id,user_id,access_level) VALUES ($1,$2,$3,'viewer')`, created.ID, alice, viewer)
	if err != nil {
		t.Fatal(err)
	}
	vCtx := identity.WithUserID(ctx, viewer)
	got, err = svc.Get(vCtx, created.ID)
	if err != nil || got.AccessLevel != "viewer" {
		t.Fatalf("member access: %+v %v", got, err)
	}
	matches, err = repository.NewPostgres(pool).Search(ctx, viewer, "adapter")
	if err != nil || len(matches) != 1 {
		t.Fatal("viewer could not search their repository")
	}
	if _, err := pool.Exec(ctx, "DELETE FROM public.repository_members WHERE user_id=$1", viewer); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Get(vCtx, created.ID); !errors.Is(err, entity.ErrNotFound) {
		t.Fatalf("revoked membership retained access: %v", err)
	}
	matches, err = repository.NewPostgres(pool).Search(ctx, viewer, "adapter")
	if err != nil || len(matches) != 0 {
		t.Fatal("revoked membership remained visible in search")
	}

	// Inject a membership write failure into a real transaction, then confirm rollback.
	failing := service.New(repository.NewPostgres(failMembershipDB{pool}))
	if _, err := failing.Create(aCtx, entity.CreateInput{URL: "https://github.com/org/atomic-failure"}); err == nil {
		t.Fatal("expected injected failure")
	}
	var count int
	if err := pool.QueryRow(ctx, "SELECT count(*) FROM public.repositories WHERE name='atomic-failure'").Scan(&count); err != nil || count != 0 {
		t.Fatalf("partial write: %d %v", count, err)
	}
}

type failMembershipDB struct{ *pgxpool.Pool }

func (p failMembershipDB) Begin(ctx context.Context) (pgx.Tx, error) {
	tx, err := p.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	return failMembershipTx{tx}, nil
}

type failMembershipTx struct{ pgx.Tx }

func (tx failMembershipTx) Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
	if strings.HasPrefix(sql, "INSERT INTO public.repository_members") {
		return pgconn.CommandTag{}, errors.New("injected membership write failure")
	}
	return tx.Tx.Exec(ctx, sql, args...)
}
