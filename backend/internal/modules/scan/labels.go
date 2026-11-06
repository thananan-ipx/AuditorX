package scan

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/IProgressX/auditor-x/backend/internal/shared/identity"
	"github.com/IProgressX/auditor-x/backend/internal/shared/response"
)

type LabelInput struct {
	RepositoryGroup       string `json:"repository_group"`
	ReviewStatus          string `json:"review_status"`
	PriorityLabel         string `json:"priority_label"`
	RepositoryCriticality string `json:"repository_criticality"`
	Exposure              string `json:"exposure"`
	Impact                string `json:"impact"`
	LabelReason           string `json:"label_reason"`
}
type PriorityLabel struct {
	LabelInput
	ID               int64     `json:"id"`
	ScanID           string    `json:"scan_id"`
	Fingerprint      string    `json:"fingerprint"`
	Reviewer         string    `json:"reviewer"`
	GuidelineVersion string    `json:"guideline_version"`
	LabeledAt        time.Time `json:"labeled_at"`
}
type LabelStore interface {
	Labels(context.Context, string, string, string) ([]PriorityLabel, error)
	SaveLabel(context.Context, string, string, string, string, LabelInput) (PriorityLabel, error)
}

const labelColumns = `id,scan_id::text,fingerprint,repository_group,review_status,coalesce(priority_label,''),repository_criticality,exposure,impact,label_reason,reviewer::text,guideline_version,labeled_at`

func readLabel(row interface{ Scan(...any) error }) (PriorityLabel, error) {
	var l PriorityLabel
	err := row.Scan(&l.ID, &l.ScanID, &l.Fingerprint, &l.RepositoryGroup, &l.ReviewStatus, &l.PriorityLabel, &l.RepositoryCriticality, &l.Exposure, &l.Impact, &l.LabelReason, &l.Reviewer, &l.GuidelineVersion, &l.LabeledAt)
	return l, translate(err)
}
func (s *Store) Labels(ctx context.Context, actor, repo, scan string) ([]PriorityLabel, error) {
	tx, err := s.begin(ctx, actor, false)
	if err != nil {
		return nil, err
	}
	defer rollback(tx)
	rows, err := tx.Query(ctx, `SELECT DISTINCT ON (fingerprint) `+labelColumns+` FROM public.priority_labels WHERE repository_id=$1::uuid AND scan_id=$2::uuid ORDER BY fingerprint,id DESC`, repo, scan)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	labels := []PriorityLabel{}
	for rows.Next() {
		l, e := readLabel(rows)
		if e != nil {
			return nil, e
		}
		labels = append(labels, l)
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	rows.Close()
	return labels, tx.Commit(ctx)
}
func (s *Store) SaveLabel(ctx context.Context, actor, repo, scan, fingerprint string, input LabelInput) (PriorityLabel, error) {
	tx, err := s.begin(ctx, actor, false)
	if err != nil {
		return PriorityLabel{}, err
	}
	defer rollback(tx)
	l, err := readLabel(tx.QueryRow(ctx, `INSERT INTO public.priority_labels(scan_id,fingerprint,repository_id,repository_group,review_status,priority_label,repository_criticality,exposure,impact,label_reason,reviewer)
 SELECT f.scan_id,f.fingerprint,f.repository_id,$4,$5,nullif($6,''),$7,$8,$9,$10,$11::uuid
 FROM public.scan_findings f JOIN public.scan_jobs j ON j.id=f.scan_id
 WHERE f.repository_id=$1::uuid AND f.scan_id=$2::uuid AND f.fingerprint=$3 AND j.status='completed'
 RETURNING `+labelColumns, repo, scan, fingerprint, input.RepositoryGroup, input.ReviewStatus, input.PriorityLabel, input.RepositoryCriticality, input.Exposure, input.Impact, input.LabelReason, actor))
	if err != nil {
		return PriorityLabel{}, err
	}
	return l, tx.Commit(ctx)
}
func oneOf(value string, values ...string) bool {
	for _, v := range values {
		if value == v {
			return true
		}
	}
	return false
}
func (input *LabelInput) valid() bool {
	input.RepositoryGroup = strings.TrimSpace(input.RepositoryGroup)
	input.LabelReason = strings.TrimSpace(input.LabelReason)
	return utf8.RuneCountInString(input.RepositoryGroup) >= 1 && utf8.RuneCountInString(input.RepositoryGroup) <= 100 &&
		utf8.RuneCountInString(input.LabelReason) >= 1 && utf8.RuneCountInString(input.LabelReason) <= 2000 &&
		oneOf(input.ReviewStatus, "unreviewed", "accepted", "simulated", "excluded", "needs_context") &&
		((oneOf(input.ReviewStatus, "accepted", "simulated") && oneOf(input.PriorityLabel, "High", "Medium", "Low")) || (!oneOf(input.ReviewStatus, "accepted", "simulated") && input.PriorityLabel == "")) &&
		(input.ReviewStatus != "simulated" || input.Exposure == "test_only") &&
		oneOf(input.RepositoryCriticality, "high", "normal", "low", "unknown") &&
		oneOf(input.Exposure, "public", "authenticated", "internal", "test_only", "unknown") && oneOf(input.Impact, "high", "medium", "low", "unknown")
}

var fingerprintPattern = regexp.MustCompile(`^[0-9a-f]{64}$`)

func (h Handler) Labels(w http.ResponseWriter, r *http.Request) {
	repo, ok := h.repository(w, r, false)
	if !ok {
		return
	}
	if _, err := h.Jobs.Get(r.Context(), identity.UserID(r.Context()), repo.ID, r.PathValue("scanID")); err != nil {
		writeError(w, err)
		return
	}
	store, ok := h.Jobs.(LabelStore)
	if !ok {
		response.Error(w, 503, "LABEL_STORE_UNAVAILABLE", "Label storage is unavailable.")
		return
	}
	labels, err := store.Labels(r.Context(), identity.UserID(r.Context()), repo.ID, r.PathValue("scanID"))
	if err != nil {
		writeError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	response.JSON(w, 200, map[string]any{"data": labels})
}
func (h Handler) SaveLabel(w http.ResponseWriter, r *http.Request) {
	repo, ok := h.repository(w, r, true)
	if !ok {
		return
	}
	if !fingerprintPattern.MatchString(r.PathValue("fingerprint")) {
		response.Error(w, 400, "INVALID_LABEL", "Invalid finding fingerprint.")
		return
	}
	var input LabelInput
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16384))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&input) != nil || decoder.Decode(new(any)) != io.EOF || !input.valid() {
		response.Error(w, 400, "INVALID_LABEL", "Accepted or simulated findings require High, Medium or Low priority. Simulated labels require test_only exposure. Other statuses must have no priority.")
		return
	}
	store, ok := h.Jobs.(LabelStore)
	if !ok {
		response.Error(w, 503, "LABEL_STORE_UNAVAILABLE", "Label storage is unavailable.")
		return
	}
	label, err := store.SaveLabel(r.Context(), identity.UserID(r.Context()), repo.ID, r.PathValue("scanID"), r.PathValue("fingerprint"), input)
	if err != nil {
		writeError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	response.JSON(w, 201, map[string]any{"data": label})
}
