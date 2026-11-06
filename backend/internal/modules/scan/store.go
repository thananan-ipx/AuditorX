package scan

import (
	"context"
	"errors"
	"time"

	"github.com/IProgressX/auditor-x/backend/internal/modules/project/repository"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type Store struct{ db repository.Beginner }

func NewStore(db repository.Beginner) *Store { return &Store{db: db} }

func rollback(tx pgx.Tx) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = tx.Rollback(ctx)
}
func (s *Store) begin(ctx context.Context, actor string, worker bool) (pgx.Tx, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	role := "SET LOCAL ROLE authenticated"
	if worker {
		role = "SET LOCAL ROLE auditorx_scan_worker"
	}
	if _, err = tx.Exec(ctx, role); err == nil && !worker {
		_, err = tx.Exec(ctx, `SELECT set_config('request.jwt.claim.sub',$1,true)`, actor)
	}
	if err != nil {
		rollback(tx)
		return nil, err
	}
	return tx, nil
}

const jobColumns = `id::text,repository_id::text,requested_by::text,branch,rules_version,status,attempts,commit_sha,scanner_version,error_code,source_kind,source_name,source_digest,created_at,started_at,finished_at,source_languages,checked_rule_ids`

func readJob(row interface{ Scan(...any) error }) (Job, error) {
	var j Job
	err := row.Scan(&j.ID, &j.RepositoryID, &j.RequestedBy, &j.Branch, &j.RulesVersion, &j.Status, &j.Attempts, &j.CommitSHA, &j.ScannerVersion, &j.ErrorCode, &j.SourceKind, &j.SourceName, &j.SourceDigest, &j.CreatedAt, &j.StartedAt, &j.FinishedAt, &j.SourceLanguages, &j.CheckedRuleIDs)
	return j, translate(err)
}
func translate(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return ErrConflict
	}
	return err
}

func (s *Store) Enqueue(ctx context.Context, actor, repo, branch string) (Job, error) {
	tx, err := s.begin(ctx, actor, false)
	if err != nil {
		return Job{}, err
	}
	defer rollback(tx)
	job, err := readJob(tx.QueryRow(ctx, `INSERT INTO public.scan_jobs(repository_id,requested_by,branch) VALUES ($1::uuid,$2::uuid,$3) RETURNING `+jobColumns, repo, actor, branch))
	if err != nil {
		return Job{}, err
	}
	return job, tx.Commit(ctx)
}

func (s *Store) EnqueueUpload(ctx context.Context, actor, repo, branch, name, digest string, archive []byte) (Job, error) {
	tx, err := s.begin(ctx, actor, false)
	if err != nil {
		return Job{}, err
	}
	defer rollback(tx)
	job, err := readJob(tx.QueryRow(ctx, `INSERT INTO public.scan_jobs(repository_id,requested_by,branch,source_kind,source_name,source_digest)
 VALUES ($1::uuid,$2::uuid,$3,'upload',$4,$5) RETURNING `+jobColumns, repo, actor, branch, name, digest))
	if err != nil {
		return Job{}, err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO public.scan_source_archives(scan_id,repository_id,requested_by,archive) VALUES ($1::uuid,$2::uuid,$3::uuid,$4)`, job.ID, repo, actor, archive); err != nil {
		return Job{}, err
	}
	return job, tx.Commit(ctx)
}

func (s *Store) EnqueueLocal(ctx context.Context, actor, repo, branch, name string) (Job, error) {
	tx, err := s.begin(ctx, actor, false)
	if err != nil {
		return Job{}, err
	}
	defer rollback(tx)
	j, err := readJob(tx.QueryRow(ctx, `INSERT INTO public.scan_jobs(repository_id,requested_by,branch,source_kind,source_name) VALUES ($1::uuid,$2::uuid,$3,'local',$4) RETURNING `+jobColumns, repo, actor, branch, name))
	if err != nil {
		return Job{}, err
	}
	return j, tx.Commit(ctx)
}

func (s *Store) Get(ctx context.Context, actor, repo, id string) (Job, error) {
	tx, err := s.begin(ctx, actor, false)
	if err != nil {
		return Job{}, err
	}
	defer rollback(tx)
	j, err := readJob(tx.QueryRow(ctx, `SELECT `+jobColumns+` FROM public.scan_jobs WHERE repository_id=$1::uuid AND id=$2::uuid`, repo, id))
	if err != nil {
		return Job{}, err
	}
	return j, tx.Commit(ctx)
}

func (s *Store) List(ctx context.Context, actor, repo string) ([]Job, error) {
	tx, err := s.begin(ctx, actor, false)
	if err != nil {
		return nil, err
	}
	defer rollback(tx)
	rows, err := tx.Query(ctx, `SELECT `+jobColumns+` FROM public.scan_jobs WHERE repository_id=$1::uuid ORDER BY created_at DESC,id DESC LIMIT 20`, repo)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	jobs := []Job{}
	for rows.Next() {
		j, e := readJob(rows)
		if e != nil {
			return nil, e
		}
		jobs = append(jobs, j)
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	rows.Close()
	return jobs, tx.Commit(ctx)
}

func (s *Store) Findings(ctx context.Context, actor, repo, id string) ([]Finding, error) {
	tx, err := s.begin(ctx, actor, false)
	if err != nil {
		return nil, err
	}
	defer rollback(tx)
	rows, err := tx.Query(ctx, `SELECT fingerprint,rule_id,severity,file_path,start_line,end_line,message FROM public.scan_findings WHERE repository_id=$1::uuid AND scan_id=$2::uuid ORDER BY file_path,start_line,rule_id,fingerprint LIMIT 1000`, repo, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	findings := []Finding{}
	for rows.Next() {
		var f Finding
		if err = rows.Scan(&f.Fingerprint, &f.RuleID, &f.Severity, &f.File, &f.Line, &f.EndLine, &f.Message); err != nil {
			return nil, err
		}
		findings = append(findings, f)
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	rows.Close()
	return findings, tx.Commit(ctx)
}

func (s *Store) Cancel(ctx context.Context, actor, repo, id string) (Job, error) {
	tx, err := s.begin(ctx, actor, false)
	if err != nil {
		return Job{}, err
	}
	defer rollback(tx)
	if _, err = tx.Exec(ctx, `DELETE FROM public.scan_source_archives WHERE repository_id=$1::uuid AND scan_id=$2::uuid`, repo, id); err != nil {
		return Job{}, err
	}
	job, err := readJob(tx.QueryRow(ctx, `UPDATE public.scan_jobs SET status='cancelled',finished_at=now() WHERE repository_id=$1::uuid AND id=$2::uuid AND status IN ('queued','running') RETURNING `+jobColumns, repo, id))
	if errors.Is(err, ErrNotFound) {
		return Job{}, ErrConflict
	}
	if err != nil {
		return Job{}, err
	}
	return job, tx.Commit(ctx)
}

// Claim is atomic and does not hold a DB connection while scanning. A lease is
// longer than the worker's hard job timeout. Its random token fences stale workers.
func (s *Store) Claim(ctx context.Context) (Job, error) {
	tx, err := s.begin(ctx, "", true)
	if err != nil {
		return Job{}, err
	}
	defer rollback(tx)
	_, err = tx.Exec(ctx, `WITH failed AS (
 UPDATE public.scan_jobs j SET status='failed',error_code=CASE WHEN attempts>=3 THEN 'RETRY_EXHAUSTED' ELSE 'ACCESS_REVOKED' END,finished_at=now(),lease_token=NULL,lease_expires_at=NULL
 WHERE (status='queued' OR (status='running' AND lease_expires_at<now())) AND (attempts>=3 OR NOT EXISTS (
 SELECT 1 FROM public.repository_members m WHERE m.repository_id=j.repository_id AND m.user_id=j.requested_by AND m.access_level IN ('owner','editor'))) RETURNING id)
 DELETE FROM public.scan_source_archives a USING failed WHERE a.scan_id=failed.id`)
	if err != nil {
		return Job{}, err
	}
	j, err := readJob(tx.QueryRow(ctx, `UPDATE public.scan_jobs SET status='running',attempts=attempts+1,lease_token=gen_random_uuid(),lease_expires_at=now()+interval '3 minutes',started_at=now(),error_code=NULL
 WHERE id=(SELECT j.id FROM public.scan_jobs j WHERE (j.status='queued' OR (j.status='running' AND j.lease_expires_at<now())) AND j.attempts<3
 AND EXISTS (SELECT 1 FROM public.repository_members m WHERE m.repository_id=j.repository_id AND m.user_id=j.requested_by AND m.access_level IN ('owner','editor'))
 ORDER BY j.created_at,j.id FOR UPDATE OF j SKIP LOCKED LIMIT 1) RETURNING `+jobColumns))
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			if e := tx.Commit(ctx); e != nil {
				return Job{}, e
			}
		}
		return Job{}, err
	}
	err = tx.QueryRow(ctx, `SELECT j.lease_token::text,r.repository_url,a.archive FROM public.scan_jobs j JOIN public.repositories r ON r.id=j.repository_id LEFT JOIN public.scan_source_archives a ON a.scan_id=j.id WHERE j.id=$1::uuid`, j.ID).Scan(&j.LeaseToken, &j.RepositoryURL, &j.Archive)
	if err != nil {
		return Job{}, err
	}
	return j, tx.Commit(ctx)
}

func (s *Store) Finish(ctx context.Context, j Job, result Result, errorCode string) error {
	tx, err := s.begin(ctx, "", true)
	if err != nil {
		return err
	}
	defer rollback(tx)
	// Lock before inserting any findings; cancellation and another claim cannot race publication.
	var id string
	err = tx.QueryRow(ctx, `SELECT id::text FROM public.scan_jobs WHERE id=$1::uuid AND status='running' AND lease_token=$2::uuid AND lease_expires_at>now() FOR UPDATE`, j.ID, j.LeaseToken).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrLeaseLost
	}
	if err != nil {
		return err
	}
	var authorized bool
	err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM public.repository_members WHERE repository_id=$1::uuid AND user_id=$2::uuid AND access_level IN ('owner','editor'))`, j.RepositoryID, j.RequestedBy).Scan(&authorized)
	if err != nil {
		return err
	}
	if !authorized {
		errorCode = "ACCESS_REVOKED"
	}
	if _, err = tx.Exec(ctx, `DELETE FROM public.scan_source_archives WHERE scan_id=$1::uuid`, j.ID); err != nil {
		return err
	}
	status := "failed"
	if errorCode == "" {
		if len(result.Findings) > 1000 {
			return errors.New("finding limit exceeded")
		}
		for _, f := range result.Findings {
			_, err = tx.Exec(ctx, `INSERT INTO public.scan_findings(scan_id,repository_id,fingerprint,rule_id,severity,file_path,start_line,end_line,message) VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8,$9)`, j.ID, j.RepositoryID, f.Fingerprint, f.RuleID, f.Severity, f.File, f.Line, f.EndLine, f.Message)
			if err != nil {
				return err
			}
		}
		status = "completed"
	}
	var languages, checkedRules []string
	if status == "completed" {
		languages = result.SourceLanguages
		checkedRules = result.CheckedRuleIDs
	}
	_, err = tx.Exec(ctx, `UPDATE public.scan_jobs SET status=$3,commit_sha=nullif($4,''),scanner_version=nullif($5,''),error_code=nullif($6,''),source_languages=$7,checked_rule_ids=$8,finished_at=now(),lease_token=NULL,lease_expires_at=NULL WHERE id=$1::uuid AND lease_token=$2::uuid`, j.ID, j.LeaseToken, status, result.CommitSHA, result.ScannerVersion, errorCode, languages, checkedRules)
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}
