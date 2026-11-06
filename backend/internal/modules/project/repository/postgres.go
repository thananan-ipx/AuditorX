package repository

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/IProgressX/auditor-x/backend/internal/modules/project/entity"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type Beginner interface {
	Begin(context.Context) (pgx.Tx, error)
}
type Postgres struct{ db Beginner }

func NewPostgres(db Beginner) *Postgres { return &Postgres{db: db} }

// Every transaction drops to the non-privileged authenticated role. Actor values
// are transaction-local so a pooled connection cannot leak one user's identity.
func (p *Postgres) begin(ctx context.Context, actor string) (pgx.Tx, error) {
	tx, err := p.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	if _, err = tx.Exec(ctx, "SET LOCAL ROLE authenticated"); err != nil {
		rollback(tx)
		return nil, err
	}
	claims, _ := json.Marshal(map[string]string{"sub": actor, "role": "authenticated"})
	_, err = tx.Exec(ctx, `SELECT set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true)`, actor, string(claims))
	if err != nil {
		rollback(tx)
		return nil, err
	}
	return tx, nil
}

func rollback(tx pgx.Tx) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = tx.Rollback(ctx)
}

func (p *Postgres) Create(ctx context.Context, actor string, input entity.NewRepository) (entity.Repository, error) {
	return p.create(ctx, actor, input, 0, 0)
}

// ImportGitHub persists the immutable upstream identity atomically with ownership.
func (p *Postgres) ImportGitHub(ctx context.Context, actor string, input entity.NewRepository, githubID, installationID int64) (entity.Repository, error) {
	return p.create(ctx, actor, input, githubID, installationID)
}

func (p *Postgres) create(ctx context.Context, actor string, input entity.NewRepository, githubID, installationID int64) (entity.Repository, error) {
	tx, err := p.begin(ctx, actor)
	if err != nil {
		return entity.Repository{}, err
	}
	defer rollback(tx)
	var result entity.Repository
	err = tx.QueryRow(ctx, `INSERT INTO public.repositories (name, owner_name, repository_url, default_branch, created_by)
		VALUES ($1, $2, $3, $4, $5::uuid)
		RETURNING id::text, name, owner_name, repository_url, default_branch, status, created_by::text, created_at`,
		input.Name, input.Owner, input.URL, input.Branch, actor).Scan(&result.ID, &result.Name, &result.Owner, &result.URL, &result.Branch, &result.Status, &result.CreatedBy, &result.CreatedAt)
	if err != nil {
		return entity.Repository{}, mapError(err)
	}
	_, err = tx.Exec(ctx, `INSERT INTO public.repository_members (repository_id, repository_owner_id, user_id, access_level) VALUES ($1::uuid, $2::uuid, $2::uuid, 'owner')`, result.ID, actor)
	if err != nil {
		return entity.Repository{}, mapError(err)
	}
	if githubID > 0 {
		if _, err = tx.Exec(ctx, "SET LOCAL ROLE auditorx_api"); err != nil {
			return entity.Repository{}, err
		}
		if _, err = tx.Exec(ctx, `INSERT INTO auth.github_repositories(repository_id,github_id,installation_id) VALUES($1::uuid,$2,$3)`, result.ID, githubID, installationID); err != nil {
			return entity.Repository{}, err
		}
	}
	if err = tx.Commit(ctx); err != nil {
		return entity.Repository{}, err
	}
	result.AccessLevel = "owner"
	return result, nil
}

const selectRepository = `SELECT r.id::text, r.name, r.owner_name, r.repository_url, r.default_branch,
	r.status, r.created_by::text, m.access_level, r.created_at
	FROM public.repositories r JOIN public.repository_members m ON m.repository_id = r.id
	WHERE m.user_id = $1::uuid`

func scan(row interface{ Scan(...any) error }) (entity.Repository, error) {
	var item entity.Repository
	err := row.Scan(&item.ID, &item.Name, &item.Owner, &item.URL, &item.Branch, &item.Status, &item.CreatedBy, &item.AccessLevel, &item.CreatedAt)
	return item, mapError(err)
}

func (p *Postgres) Get(ctx context.Context, actor, id string) (entity.Repository, error) {
	tx, err := p.begin(ctx, actor)
	if err != nil {
		return entity.Repository{}, err
	}
	defer rollback(tx)
	item, err := scan(tx.QueryRow(ctx, selectRepository+` AND r.id = $2::uuid`, actor, id))
	if err != nil {
		return entity.Repository{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return entity.Repository{}, err
	}
	return item, nil
}

func (p *Postgres) List(ctx context.Context, actor string, limit, offset int) ([]entity.Repository, error) {
	tx, err := p.begin(ctx, actor)
	if err != nil {
		return nil, err
	}
	defer rollback(tx)
	rows, err := tx.Query(ctx, `SELECT r.id::text, r.name, r.owner_name, r.repository_url, r.default_branch,
		r.status, r.created_by::text, m.access_level, r.created_at,
		s.status, s.created_at, COALESCE(f.high, 0), COALESCE(f.medium, 0), COALESCE(f.low, 0)
		FROM public.repositories r JOIN public.repository_members m ON m.repository_id = r.id
		LEFT JOIN LATERAL (SELECT j.id, j.status, j.created_at FROM public.scan_jobs j
			WHERE j.repository_id = r.id ORDER BY j.created_at DESC, j.id DESC LIMIT 1) s ON true
		LEFT JOIN LATERAL (SELECT count(*) FILTER (WHERE severity = 'High')::int AS high,
			count(*) FILTER (WHERE severity = 'Medium')::int AS medium,
			count(*) FILTER (WHERE severity = 'Low')::int AS low
			FROM public.scan_findings sf WHERE sf.scan_id = s.id AND sf.repository_id = r.id) f ON true
		WHERE m.user_id = $1::uuid ORDER BY r.created_at DESC, r.id DESC LIMIT $2 OFFSET $3`, actor, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]entity.Repository, 0)
	for rows.Next() {
		var item entity.Repository
		var status *string
		var created *time.Time
		var high, medium, low int
		if err := rows.Scan(&item.ID, &item.Name, &item.Owner, &item.URL, &item.Branch, &item.Status, &item.CreatedBy, &item.AccessLevel, &item.CreatedAt, &status, &created, &high, &medium, &low); err != nil {
			return nil, mapError(err)
		}
		if status != nil && created != nil {
			item.LatestScan = &entity.ScanSummary{Status: *status, CreatedAt: *created, High: high, Medium: medium, Low: low}
		}
		items = append(items, item)
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	rows.Close()
	if err = tx.Commit(ctx); err != nil {
		return nil, err
	}
	return items, nil
}

// Count returns how many repositories the actor can access.
func (p *Postgres) Count(ctx context.Context, actor string) (int, error) {
	tx, err := p.begin(ctx, actor)
	if err != nil {
		return 0, err
	}
	defer rollback(tx)
	var total int
	if err = tx.QueryRow(ctx, `SELECT count(*)::int FROM public.repository_members WHERE user_id = $1::uuid`, actor).Scan(&total); err != nil {
		return 0, err
	}
	if err = tx.Commit(ctx); err != nil {
		return 0, err
	}
	return total, nil
}

func mapError(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return entity.ErrNotFound
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return entity.ErrConflict
	}
	return err
}
