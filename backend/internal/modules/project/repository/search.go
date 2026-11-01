package repository

import (
	"context"
	"github.com/IProgressX/auditor-x/backend/internal/modules/project/entity"
)

// Search uses the same transaction-local actor and RLS as list/detail. strpos
// treats %, _ and backslashes literally rather than as SQL search wildcards.
func (p *Postgres) Search(ctx context.Context, actor, query string) ([]entity.Repository, error) {
	tx, err := p.begin(ctx, actor)
	if err != nil {
		return nil, err
	}
	defer rollback(tx)
	rows, err := tx.Query(ctx, selectRepository+`
        AND strpos(lower(r.owner_name || '/' || r.name || ' ' || r.default_branch), lower($2)) > 0
        ORDER BY CASE WHEN lower(r.name) = lower($2) THEN 0
                      WHEN strpos(lower(r.name), lower($2)) = 1 THEN 1 ELSE 2 END,
                 r.name, r.id
        LIMIT 5`, actor, query)
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
	if err := rows.Err(); err != nil {
		return nil, err
	}
	rows.Close()
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return items, nil
}
