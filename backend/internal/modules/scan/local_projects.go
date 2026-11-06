package scan

import (
	"context"
	"net/http"
	"path"
	"strconv"
	"strings"
	"time"

	"github.com/IProgressX/auditor-x/backend/internal/shared/identity"
	"github.com/IProgressX/auditor-x/backend/internal/shared/response"
)

// A local project is a source path (or uploaded archive) within an accessible
// repository. It is derived from all scan history, not just the latest 20 jobs.
type LocalProject struct {
	Name           string    `json:"name"`
	SourceName     string    `json:"source_name"`
	SourceKind     string    `json:"source_kind"`
	RepositoryID   string    `json:"repository_id"`
	RepositoryName string    `json:"repository_name"`
	AccessLevel    string    `json:"access_level"`
	ScanID         string    `json:"scan_id"`
	Status         string    `json:"status"`
	CreatedAt      time.Time `json:"created_at"`
	ScanCount      int       `json:"scan_count"`
	High           int       `json:"high"`
	Medium         int       `json:"medium"`
	Low            int       `json:"low"`
}

func (s *Store) LocalProjects(ctx context.Context, actor string, limit, offset int) ([]LocalProject, error) {
	tx, err := s.begin(ctx, actor, false)
	if err != nil {
		return nil, err
	}
	defer rollback(tx)
	rows, err := tx.Query(ctx, `WITH projects AS (
		SELECT DISTINCT ON (j.repository_id,j.source_kind,j.source_name)
		j.repository_id,r.name AS repository_name,m.access_level,j.source_kind,j.source_name,
		j.id AS scan_id,j.status,j.created_at,
		count(*) OVER (PARTITION BY j.repository_id,j.source_kind,j.source_name) AS scan_count
		FROM public.scan_jobs j
		JOIN public.repositories r ON r.id=j.repository_id
		JOIN public.repository_members m ON m.repository_id=j.repository_id AND m.user_id=(SELECT auth.uid())
		WHERE j.source_kind IN ('local','upload')
		ORDER BY j.repository_id,j.source_kind,j.source_name,j.created_at DESC,j.id DESC
	), page AS (
		SELECT * FROM projects ORDER BY created_at DESC,scan_id DESC LIMIT $1 OFFSET $2
	)
	SELECT p.repository_id::text,p.repository_name,p.access_level,p.source_kind,p.source_name,
	p.scan_id::text,p.status,p.created_at,p.scan_count,
	coalesce(f.high,0),coalesce(f.medium,0),coalesce(f.low,0)
	FROM page p LEFT JOIN LATERAL (
		SELECT count(*) FILTER (WHERE severity='High') AS high,
		count(*) FILTER (WHERE severity='Medium') AS medium,
		count(*) FILTER (WHERE severity='Low') AS low
		FROM public.scan_findings WHERE scan_id=p.scan_id
	) f ON p.status='completed'
	ORDER BY p.created_at DESC,p.scan_id DESC`, limit, offset)
	if err != nil {
		return nil, err
	}
	items := []LocalProject{}
	for rows.Next() {
		var item LocalProject
		if err = rows.Scan(&item.RepositoryID, &item.RepositoryName, &item.AccessLevel, &item.SourceKind,
			&item.SourceName, &item.ScanID, &item.Status, &item.CreatedAt, &item.ScanCount,
			&item.High, &item.Medium, &item.Low); err != nil {
			rows.Close()
			return nil, err
		}
		item.Name = path.Base(strings.ReplaceAll(item.SourceName, `\`, "/"))
		items = append(items, item)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return nil, err
	}
	return items, tx.Commit(ctx)
}

func (h Handler) ListLocalProjects(w http.ResponseWriter, r *http.Request) {
	actor := identity.UserID(r.Context())
	if actor == "" {
		response.Error(w, 401, "UNAUTHORIZED", "Sign in to view local projects.")
		return
	}
	page, size := 1, 100
	for key, target := range map[string]*int{"page": &page, "page_size": &size} {
		if raw := r.URL.Query().Get(key); raw != "" {
			value, err := strconv.Atoi(raw)
			if err != nil || value < 1 || (key == "page" && value > 10000) || (key == "page_size" && value > 100) {
				response.Error(w, 400, "INVALID_PAGINATION", "Use page 1..10000 and page_size 1..100.")
				return
			}
			*target = value
		}
	}
	store, ok := h.Jobs.(interface {
		LocalProjects(context.Context, string, int, int) ([]LocalProject, error)
	})
	if !ok {
		response.Error(w, 503, "LOCAL_PROJECTS_UNAVAILABLE", "Local project history is unavailable.")
		return
	}
	items, err := store.LocalProjects(r.Context(), actor, size+1, (page-1)*size)
	if err != nil {
		writeError(w, err)
		return
	}
	hasNext := len(items) > size
	if hasNext {
		items = items[:size]
	}
	w.Header().Set("Cache-Control", "no-store")
	response.JSON(w, 200, map[string]any{"data": items, "meta": map[string]any{"page": page, "page_size": size, "has_next": hasNext}})
}
