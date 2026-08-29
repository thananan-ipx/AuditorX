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
	rows, err := tx.Query(ctx, selectRepository+` ORDER BY r.created_at DESC, r.id DESC LIMIT $2 OFFSET $3`, actor, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]entity.Repository, 0)
	for rows.Next() {
		item, err := scan(rows)
		if err != nil {
			return nil, err
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
