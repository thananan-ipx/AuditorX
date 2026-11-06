package scan

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/IProgressX/auditor-x/backend/internal/shared/identity"
	"github.com/IProgressX/auditor-x/backend/internal/shared/response"
)

func defaultPredictionContext(values ...PredictionContext) PredictionContext {
	if len(values) > 0 {
		return values[0]
	}
	return PredictionContext{RepositoryCriticality: "unknown", Exposure: "unknown", Impact: "unknown"}
}

func predictionContextJSON(values ...PredictionContext) string {
	raw, _ := json.Marshal(defaultPredictionContext(values...))
	return string(raw)
}

type PredictionRun struct {
	ID           int64             `json:"id"`
	ScanID       string            `json:"scan_id"`
	RepositoryID string            `json:"repository_id"`
	Status       string            `json:"status"`
	Attempts     int               `json:"attempts"`
	Context      PredictionContext `json:"context"`
	Result       *PredictionResult `json:"result"`
	ErrorCode    *string           `json:"error_code"`
	CreatedAt    time.Time         `json:"created_at"`
	FinishedAt   *time.Time        `json:"finished_at"`
	LeaseToken   string            `json:"-"`
}

const predictionPublicColumns = `id,scan_id::text,repository_id::text,status,attempts,context,result,error_code,created_at,finished_at`
const predictionColumns = predictionPublicColumns + `,coalesce(lease_token::text,'')`

func readPrediction(row interface{ Scan(...any) error }) (PredictionRun, error) {
	return readPredictionFields(row, true)
}
func readPredictionFields(row interface{ Scan(...any) error }, worker bool) (PredictionRun, error) {
	var run PredictionRun
	fields := []any{&run.ID, &run.ScanID, &run.RepositoryID, &run.Status, &run.Attempts, &run.Context, &run.Result, &run.ErrorCode, &run.CreatedAt, &run.FinishedAt}
	if worker {
		fields = append(fields, &run.LeaseToken)
	}
	err := row.Scan(fields...)
	return run, translate(err)
}

type PredictionRunStore interface {
	LatestPrediction(context.Context, string, string, string) (PredictionRun, error)
	RetryPrediction(context.Context, string, string, string) (PredictionRun, error)
}

func (s *Store) LatestPrediction(ctx context.Context, actor, repo, scan string) (PredictionRun, error) {
	tx, err := s.begin(ctx, actor, false)
	if err != nil {
		return PredictionRun{}, err
	}
	defer rollback(tx)
	run, err := readPredictionFields(tx.QueryRow(ctx, `SELECT `+predictionPublicColumns+` FROM public.priority_prediction_runs WHERE repository_id=$1::uuid AND scan_id=$2::uuid ORDER BY id DESC LIMIT 1`, repo, scan), false)
	if err != nil {
		return run, err
	}
	return run, tx.Commit(ctx)
}
func (s *Store) RetryPrediction(ctx context.Context, actor, repo, scan string) (PredictionRun, error) {
	tx, err := s.begin(ctx, actor, false)
	if err != nil {
		return PredictionRun{}, err
	}
	defer rollback(tx)
	// Serialize retries against the same scan before checking the active run.
	// Completed scan rows are intentionally not updatable by authenticated users.
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, scan); err != nil {
		return PredictionRun{}, err
	}
	var id string
	if err = tx.QueryRow(ctx, `SELECT id::text FROM public.scan_jobs WHERE repository_id=$1::uuid AND id=$2::uuid AND status='completed'`, repo, scan).Scan(&id); err != nil {
		return PredictionRun{}, translate(err)
	}
	_, err = tx.Exec(ctx, `INSERT INTO public.priority_prediction_runs(scan_id,repository_id,requested_by,context) SELECT id,repository_id,$3::uuid,prediction_context FROM public.scan_jobs WHERE repository_id=$1::uuid AND id=$2::uuid ON CONFLICT(scan_id) WHERE status IN ('queued','running') DO NOTHING`, repo, scan, actor)
	if err != nil {
		return PredictionRun{}, err
	}
	run, err := readPredictionFields(tx.QueryRow(ctx, `SELECT `+predictionPublicColumns+` FROM public.priority_prediction_runs WHERE repository_id=$1::uuid AND scan_id=$2::uuid ORDER BY id DESC LIMIT 1`, repo, scan), false)
	if err != nil {
		return run, err
	}
	return run, tx.Commit(ctx)
}

type PredictionQueue interface {
	ClaimPrediction(context.Context) (PredictionRun, []Finding, error)
	FinishPrediction(context.Context, PredictionRun, *PredictionResult) error
}

func (s *Store) ClaimPrediction(ctx context.Context) (PredictionRun, []Finding, error) {
	tx, err := s.begin(ctx, "", true)
	if err != nil {
		return PredictionRun{}, nil, err
	}
	defer rollback(tx)
	_, err = tx.Exec(ctx, `UPDATE public.priority_prediction_runs SET status='failed',error_code='PREDICTION_UNAVAILABLE',finished_at=now(),lease_token=NULL,lease_expires_at=NULL WHERE status='running' AND lease_expires_at<now() AND attempts>=3`)
	if err != nil {
		return PredictionRun{}, nil, err
	}
	run, err := readPrediction(tx.QueryRow(ctx, `UPDATE public.priority_prediction_runs SET status='running',attempts=attempts+1,lease_token=gen_random_uuid(),lease_expires_at=now()+interval '30 seconds',error_code=NULL WHERE id=(SELECT id FROM public.priority_prediction_runs WHERE ((status='queued' AND retry_at<=now()) OR (status='running' AND lease_expires_at<now())) AND attempts<3 ORDER BY retry_at,id FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING `+predictionColumns))
	if errors.Is(err, ErrNotFound) {
		if e := tx.Commit(ctx); e != nil {
			return run, nil, e
		}
		return run, nil, err
	}
	if err != nil {
		return run, nil, err
	}
	rows, err := tx.Query(ctx, `SELECT fingerprint,rule_id,severity,file_path,start_line,end_line,message FROM public.scan_findings WHERE scan_id=$1::uuid AND repository_id=$2::uuid ORDER BY file_path,start_line,rule_id,fingerprint LIMIT 1000`, run.ScanID, run.RepositoryID)
	if err != nil {
		return run, nil, err
	}
	findings := []Finding{}
	for rows.Next() {
		var f Finding
		if err = rows.Scan(&f.Fingerprint, &f.RuleID, &f.Severity, &f.File, &f.Line, &f.EndLine, &f.Message); err != nil {
			rows.Close()
			return run, nil, err
		}
		findings = append(findings, f)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return run, nil, err
	}
	return run, findings, tx.Commit(ctx)
}
func (s *Store) FinishPrediction(ctx context.Context, run PredictionRun, result *PredictionResult) error {
	tx, err := s.begin(ctx, "", true)
	if err != nil {
		return err
	}
	defer rollback(tx)
	status := "completed"
	var code *string
	if result == nil {
		status = "queued"
		message := "PREDICTION_UNAVAILABLE"
		code = &message
		if run.Attempts >= 3 {
			status = "failed"
		}
	}
	var encoded any
	if result != nil {
		raw, marshalErr := json.Marshal(result)
		if marshalErr != nil {
			return marshalErr
		}
		encoded = string(raw)
	}
	command, err := tx.Exec(ctx, `UPDATE public.priority_prediction_runs SET status=$3,result=$4::jsonb,error_code=$5,finished_at=CASE WHEN $3 IN ('completed','failed') THEN now() ELSE NULL END,retry_at=now()+interval '15 seconds',lease_token=NULL,lease_expires_at=NULL WHERE id=$1 AND lease_token=$2::uuid AND status='running' AND lease_expires_at>now()`, run.ID, run.LeaseToken, status, encoded, code)
	if err != nil {
		return err
	}
	if command.RowsAffected() != 1 {
		return ErrLeaseLost
	}
	return tx.Commit(ctx)
}

type PredictionWorker struct {
	Queue     PredictionQueue
	Predictor Predictor
}

func (w PredictionWorker) RunOne(ctx context.Context) (bool, error) {
	run, findings, err := w.Queue.ClaimPrediction(ctx)
	if errors.Is(err, ErrNotFound) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	var result *PredictionResult
	if len(findings) == 0 {
		result = &PredictionResult{Predictions: []PriorityPrediction{}}
	} else {
		callCtx, cancel := context.WithTimeout(ctx, 6*time.Second)
		if w.Predictor != nil {
			value, e := w.Predictor.Predict(callCtx, predictionItems(findings, run.Context))
			if e == nil {
				result = &value
			}
		}
		cancel()
	}
	if ctx.Err() != nil {
		return true, ctx.Err()
	}
	finishCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	err = w.Queue.FinishPrediction(finishCtx, run, result)
	if errors.Is(err, ErrLeaseLost) {
		return true, nil
	}
	return true, err
}
func (h Handler) PredictionStatus(w http.ResponseWriter, r *http.Request) {
	repo, ok := h.repository(w, r, false)
	if !ok {
		return
	}
	actor, id := identity.UserID(r.Context()), r.PathValue("scanID")
	job, err := h.Jobs.Get(r.Context(), actor, repo.ID, id)
	if err != nil {
		writeError(w, err)
		return
	}
	if job.Status != "completed" {
		response.Error(w, 409, "SCAN_NOT_COMPLETED", "Complete the scan before predicting priority.")
		return
	}
	store, ok := h.Jobs.(PredictionRunStore)
	if !ok {
		response.Error(w, 503, "PREDICTION_STORE_UNAVAILABLE", "Prediction storage is unavailable.")
		return
	}
	run, err := store.LatestPrediction(r.Context(), actor, repo.ID, id)
	if errors.Is(err, ErrNotFound) {
		response.JSON(w, 200, map[string]any{"data": nil})
		return
	}
	if err != nil {
		writeError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	response.JSON(w, 200, map[string]any{"data": run})
}
func (h Handler) RetryPrediction(w http.ResponseWriter, r *http.Request) {
	repo, ok := h.repository(w, r, true)
	if !ok {
		return
	}
	store, ok := h.Jobs.(PredictionRunStore)
	if !ok {
		response.Error(w, 503, "PREDICTION_STORE_UNAVAILABLE", "Prediction storage is unavailable.")
		return
	}
	run, err := store.RetryPrediction(r.Context(), identity.UserID(r.Context()), repo.ID, r.PathValue("scanID"))
	if err != nil {
		writeError(w, err)
		return
	}
	response.JSON(w, 202, map[string]any{"data": run})
}

// Compile-time checks keep durable and read-only prediction contracts separate.
var _ PredictionQueue = (*Store)(nil)
var _ PredictionRunStore = (*Store)(nil)
