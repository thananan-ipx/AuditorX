package scan

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	project "github.com/IProgressX/auditor-x/backend/internal/modules/project/entity"
	"github.com/IProgressX/auditor-x/backend/internal/modules/project/repository"
	"github.com/IProgressX/auditor-x/backend/internal/modules/project/service"
	"github.com/IProgressX/auditor-x/backend/internal/shared/identity"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const alice = "11111111-1111-4111-8111-111111111111"
const bob = "22222222-2222-4222-8222-222222222222"

type fixtureSource struct{ data []byte }

func (f fixtureSource) Fetch(_ context.Context, _ Job, destination string) (string, error) {
	return strings.Repeat("a", 40), extractSource(f.data, destination)
}

type fixedAnalyzer struct{}

func (fixedAnalyzer) Analyze(context.Context, string, string) (Result, error) {
	return Result{ScannerVersion: "1.175.0", Findings: []Finding{{Fingerprint: strings.Repeat("f", 64), RuleID: "auditorx.python.dynamic-eval", Severity: "High", File: "app.py", Line: 3, EndLine: 3, Message: "Avoid dynamic code evaluation"}}}, nil
}

func TestPostgresIntegration(t *testing.T) {
	dsn := os.Getenv("AUDITORX_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("run tools/database-tests npm test for an ephemeral database")
	}
	u, err := url.Parse(dsn)
	if err != nil || u.Hostname() != "127.0.0.1" || u.Path != "/postgres" || u.Query().Get("host") != "" {
		t.Fatal("only loopback ephemeral harness is allowed")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Second)
	defer cancel()
	connect := func() *pgxpool.Pool {
		cfg, e := pgxpool.ParseConfig(dsn)
		if e != nil {
			t.Fatal(e)
		}
		cfg.MaxConns = 1
		cfg.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeExec
		pool, e := pgxpool.NewWithConfig(ctx, cfg)
		if e != nil {
			t.Fatal(e)
		}
		var marker string
		if e = pool.QueryRow(ctx, `SELECT id FROM public.auditorx_test_marker`).Scan(&marker); e != nil || marker != "ephemeral-test-only" {
			pool.Close()
			t.Fatal("missing ephemeral marker")
		}
		return pool
	}
	pool := connect()
	defer func() { pool.Close() }()
	projects := service.New(repository.NewPostgres(pool))
	repo, err := projects.Create(identity.WithUserID(ctx, alice), project.CreateInput{URL: "https://github.com/fixture/scan-integration"})
	if err != nil {
		t.Fatal(err)
	}
	store := NewStore(pool)
	api := func(actor, method, path, body string) *httptest.ResponseRecorder {
		mux := http.NewServeMux()
		Handler{Repositories: projects, Jobs: store}.RegisterRoutes(mux)
		request := httptest.NewRequest(method, path, strings.NewReader(body))
		request = request.WithContext(identity.WithUserID(ctx, actor))
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, request)
		return rec
	}
	base := "/api/v1/repositories/" + repo.ID + "/scans"
	created := api(alice, "POST", base, `{"branch":"main","rule_profile":"recommended"}`)
	if created.Code != 202 {
		t.Fatalf("enqueue: %d %s", created.Code, created.Body)
	}
	var payload struct {
		Data Job `json:"data"`
	}
	if err = json.Unmarshal(created.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	first := payload.Data
	if first.Status != "queued" || first.Attempts != 0 || created.Header().Get("Location") != base+"/"+first.ID {
		t.Fatalf("unexpected enqueue: %+v", first)
	}
	if rec := api(alice, "POST", base, `{}`); rec.Code != 409 {
		t.Fatalf("duplicate: %d", rec.Code)
	}
	if rec := api(bob, "GET", base+"/"+first.ID, ""); rec.Code != 404 {
		t.Fatalf("cross-user API: %d", rec.Code)
	}
	if _, err = store.Get(ctx, bob, repo.ID, first.ID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("RLS scan read: %v", err)
	}

	// The previous API process may disappear after enqueue; another pool sees the job.
	pool.Close()
	pool = connect()
	projects = service.New(repository.NewPostgres(pool))
	store = NewStore(pool)
	firstClaim, err := store.Claim(ctx)
	if err != nil || firstClaim.ID != first.ID || firstClaim.Attempts != 1 {
		t.Fatalf("claim after reconnect: %+v %v", firstClaim, err)
	}
	if _, err = store.Claim(ctx); !errors.Is(err, ErrNotFound) {
		t.Fatalf("active lease claimed twice: %v", err)
	}
	expire := func(id string) {
		t.Helper()
		if _, e := pool.Exec(ctx, `UPDATE public.scan_jobs SET lease_expires_at=now()-interval '1 second' WHERE id=$1::uuid`, id); e != nil {
			t.Fatal(e)
		}
	}
	expire(first.ID)
	secondClaim, err := store.Claim(ctx)
	if err != nil || secondClaim.Attempts != 2 || secondClaim.LeaseToken == firstClaim.LeaseToken {
		t.Fatalf("reclaim: %+v %v", secondClaim, err)
	}
	sample, _ := (fixedAnalyzer{}).Analyze(ctx, "", first.RulesVersion)
	sample.CommitSHA = strings.Repeat("a", 40)
	if err = store.Finish(ctx, firstClaim, sample, ""); !errors.Is(err, ErrLeaseLost) {
		t.Fatalf("stale publication accepted: %v", err)
	}
	if rec := api(alice, "POST", base+"/"+first.ID+"/cancel", ""); rec.Code != 200 {
		t.Fatalf("cancel: %d %s", rec.Code, rec.Body)
	}
	if err = store.Finish(ctx, secondClaim, sample, ""); !errors.Is(err, ErrLeaseLost) {
		t.Fatalf("cancelled publication accepted: %v", err)
	}

	// Actual source extractor -> analyzer -> atomic store -> authenticated result API.
	accepted, err := store.Enqueue(ctx, alice, repo.ID, "main")
	if err != nil {
		t.Fatal(err)
	}
	sourceData, err := os.ReadFile("testdata/fixture/app.py")
	if err != nil {
		t.Fatal(err)
	}
	var analyzer Analyzer = fixedAnalyzer{}
	if binary := os.Getenv("AUDITORX_TEST_SEMGREP"); binary != "" {
		analyzer = Semgrep{Executable: binary}
		t.Log("Running real Semgrep through the durable worker pipeline")
	} else {
		t.Log("Semgrep runtime not supplied; testing orchestration with a deterministic analyzer")
	}
	worker := Worker{Queue: store, Source: fixtureSource{archive(t, map[string]string{"fixture/app.py": string(sourceData)}, false)}, Analyzer: analyzer}
	if worked, e := worker.RunOne(ctx); e != nil || !worked {
		t.Fatalf("worker: %v %v", worked, e)
	}
	result, err := store.Get(ctx, alice, repo.ID, accepted.ID)
	if err != nil || result.Status != "completed" || result.CommitSHA == nil {
		t.Fatalf("result: %+v %v", result, err)
	}
	rec := api(alice, "GET", base+"/"+accepted.ID+"/findings", "")
	if rec.Code != 200 {
		t.Fatalf("findings: %d %s", rec.Code, rec.Body)
	}
	var results struct {
		Data []Finding `json:"data"`
	}
	if err = json.Unmarshal(rec.Body.Bytes(), &results); err != nil {
		t.Fatal(err)
	}
	if len(results.Data) != 1 || results.Data[0].File != "app.py" || results.Data[0].Line != 3 {
		t.Fatalf("findings: %+v", results)
	}
	t.Logf("Persisted and retrieved %d finding(s) through HTTP for scan %s", len(results.Data), accepted.ID)
	if rec := api(bob, "GET", base+"/"+accepted.ID+"/findings", ""); rec.Code != 404 {
		t.Fatal("cross-user findings visible")
	}
	if strings.Contains(api(alice, "GET", base+"/"+accepted.ID, "").Body.String(), "lease_token") {
		t.Fatal("lease leaked through API")
	}

	// Uploaded source is digest-verified, scanned through the same worker, and deleted afterward.
	uploadArchive := archive(t, map[string]string{"app.py": string(sourceData)}, false)
	digestBytes := sha256.Sum256(uploadArchive)
	digest := hex.EncodeToString(digestBytes[:])
	uploaded, err := store.EnqueueUpload(ctx, alice, repo.ID, "main", "project.zip", digest, uploadArchive)
	if err != nil {
		t.Fatal(err)
	}
	uploadWorker := Worker{Queue: store, Source: JobSource{}, Analyzer: fixedAnalyzer{}}
	if worked, e := uploadWorker.RunOne(ctx); e != nil || !worked {
		t.Fatalf("upload worker: %v %v", worked, e)
	}
	uploadResult, err := store.Get(ctx, alice, repo.ID, uploaded.ID)
	if err != nil || uploadResult.Status != "completed" || uploadResult.SourceKind != "upload" || uploadResult.CommitSHA == nil || *uploadResult.CommitSHA != digest {
		t.Fatalf("upload result: %+v %v", uploadResult, err)
	}
	var remaining int
	if err = pool.QueryRow(ctx, `SELECT count(*) FROM public.scan_source_archives WHERE scan_id=$1::uuid`, uploaded.ID).Scan(&remaining); err != nil || remaining != 0 {
		t.Fatalf("uploaded archive retained: %d %v", remaining, err)
	}

	// Publishing is all-or-nothing even if a later finding violates a DB constraint.
	queued, err := store.Enqueue(ctx, alice, repo.ID, "main")
	if err != nil {
		t.Fatal(err)
	}
	claimed, err := store.Claim(ctx)
	if err != nil {
		t.Fatal(err)
	}
	invalid := sample
	invalid.Findings = append(append([]Finding{}, sample.Findings...), Finding{Fingerprint: strings.Repeat("b", 64), Severity: "Invalid", RuleID: "bad", File: "app.py", Line: 5, EndLine: 5, Message: "bad"})
	if err = store.Finish(ctx, claimed, invalid, ""); err == nil {
		t.Fatal("invalid result committed")
	}
	findings, err := store.Findings(ctx, alice, repo.ID, queued.ID)
	if err != nil || len(findings) != 0 {
		t.Fatalf("partial findings visible: %+v %v", findings, err)
	}
	if err = store.Finish(ctx, claimed, Result{}, "SCANNER_FAILED"); err != nil {
		t.Fatal(err)
	}

	// Three expired attempts terminate, so the repository is not permanently stuck.
	exhausted, err := store.Enqueue(ctx, alice, repo.ID, "main")
	if err != nil {
		t.Fatal(err)
	}
	for attempt := 1; attempt <= 3; attempt++ {
		j, e := store.Claim(ctx)
		if e != nil || j.Attempts != attempt {
			t.Fatalf("attempt %d: %+v %v", attempt, j, e)
		}
		expire(exhausted.ID)
	}
	if _, err = store.Claim(ctx); !errors.Is(err, ErrNotFound) {
		t.Fatal(err)
	}
	failed, err := store.Get(ctx, alice, repo.ID, exhausted.ID)
	if err != nil || failed.Status != "failed" || failed.ErrorCode == nil || *failed.ErrorCode != "RETRY_EXHAUSTED" {
		t.Fatalf("exhaustion: %+v %v", failed, err)
	}

	revoked, err := store.Enqueue(ctx, alice, repo.ID, "main")
	if err != nil {
		t.Fatal(err)
	}
	if _, err = pool.Exec(ctx, `DELETE FROM public.repository_members WHERE repository_id=$1::uuid AND user_id=$2::uuid`, repo.ID, alice); err != nil {
		t.Fatal(err)
	}
	if _, err = store.Claim(ctx); !errors.Is(err, ErrNotFound) {
		t.Fatalf("revoked job claimed: %v", err)
	}
	var code string
	if err = pool.QueryRow(ctx, `SELECT error_code FROM public.scan_jobs WHERE id=$1::uuid`, revoked.ID).Scan(&code); err != nil || code != "ACCESS_REVOKED" {
		t.Fatalf("revoked: %s %v", code, err)
	}
	var role string
	if err = pool.QueryRow(ctx, `SELECT current_user`).Scan(&role); err != nil || role == "auditorx_scan_worker" || role == "authenticated" {
		t.Fatalf("role leaked: %s %v", role, err)
	}
}
