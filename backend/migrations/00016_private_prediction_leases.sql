-- +goose Up
-- Match scan_jobs: worker fencing tokens are never readable by client roles.
REVOKE SELECT ON public.priority_prediction_runs FROM authenticated;
GRANT SELECT(id,scan_id,repository_id,requested_by,origin,context,status,attempts,retry_at,result,error_code,created_at,finished_at)
 ON public.priority_prediction_runs TO authenticated;

-- +goose Down
GRANT SELECT ON public.priority_prediction_runs TO authenticated;
