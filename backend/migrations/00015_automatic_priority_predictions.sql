-- +goose Up
ALTER TABLE public.scan_jobs ADD COLUMN prediction_context jsonb NOT NULL DEFAULT
 '{"repository_criticality":"unknown","exposure":"unknown","impact":"unknown"}'::jsonb;
ALTER TABLE public.scan_jobs ADD CONSTRAINT scan_prediction_context_valid CHECK (
 jsonb_typeof(prediction_context)='object' AND prediction_context - ARRAY['repository_criticality','exposure','impact']='{}'::jsonb AND
 coalesce(prediction_context->>'repository_criticality','') IN ('unknown','high','normal','low') AND
 coalesce(prediction_context->>'exposure','') IN ('unknown','public','authenticated','internal','test_only') AND
 coalesce(prediction_context->>'impact','') IN ('unknown','high','medium','low'));
GRANT SELECT(prediction_context), INSERT(prediction_context) ON public.scan_jobs TO authenticated;

CREATE TABLE public.priority_prediction_runs (
 id bigserial PRIMARY KEY,
 scan_id uuid NOT NULL,
 repository_id uuid NOT NULL,
 requested_by uuid NOT NULL REFERENCES auth.users(id),
 origin text NOT NULL DEFAULT 'manual' CHECK(origin IN ('automatic','manual')),
 context jsonb NOT NULL,
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','completed','failed')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 3),
 lease_token uuid,
 lease_expires_at timestamptz,
 retry_at timestamptz NOT NULL DEFAULT now(),
 result jsonb,
 error_code text CHECK(error_code IN ('PREDICTION_UNAVAILABLE')),
 created_at timestamptz NOT NULL DEFAULT now(),
 finished_at timestamptz,
 FOREIGN KEY(scan_id,repository_id) REFERENCES public.scan_jobs(id,repository_id) ON DELETE CASCADE,
 CHECK(status<>'running' OR (lease_token IS NOT NULL AND lease_expires_at IS NOT NULL)),
 CHECK((status='completed')=(result IS NOT NULL)),
 CHECK(status NOT IN ('completed','failed') OR finished_at IS NOT NULL)
);
CREATE UNIQUE INDEX priority_predictions_one_active ON public.priority_prediction_runs(scan_id) WHERE status IN ('queued','running');
CREATE INDEX priority_predictions_latest ON public.priority_prediction_runs(scan_id,id DESC);
CREATE INDEX priority_predictions_claim ON public.priority_prediction_runs(retry_at,id) WHERE status IN ('queued','running');
CREATE INDEX priority_predictions_repository ON public.priority_prediction_runs(repository_id);
CREATE INDEX priority_predictions_actor ON public.priority_prediction_runs(requested_by);
ALTER TABLE public.priority_prediction_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.priority_prediction_runs FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.priority_prediction_runs FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.priority_prediction_runs TO authenticated;
GRANT INSERT(scan_id,repository_id,requested_by,context) ON public.priority_prediction_runs TO authenticated;
GRANT USAGE ON SEQUENCE public.priority_prediction_runs_id_seq TO authenticated;
CREATE POLICY prediction_runs_read ON public.priority_prediction_runs FOR SELECT TO authenticated USING (
 EXISTS(SELECT 1 FROM public.repository_members m WHERE m.repository_id=priority_prediction_runs.repository_id AND m.user_id=(SELECT auth.uid())));
CREATE POLICY prediction_runs_retry ON public.priority_prediction_runs FOR INSERT TO authenticated WITH CHECK (
 requested_by=(SELECT auth.uid()) AND
 EXISTS(SELECT 1 FROM public.repository_members m WHERE m.repository_id=priority_prediction_runs.repository_id AND m.user_id=(SELECT auth.uid()) AND m.access_level IN ('owner','editor')) AND
 EXISTS(SELECT 1 FROM public.scan_jobs j WHERE j.id=scan_id AND j.repository_id=priority_prediction_runs.repository_id AND j.status='completed' AND j.prediction_context=context));
GRANT SELECT,UPDATE ON public.priority_prediction_runs TO auditorx_scan_worker;
CREATE POLICY prediction_worker_read ON public.priority_prediction_runs FOR SELECT TO auditorx_scan_worker USING(true);
CREATE POLICY prediction_worker_update ON public.priority_prediction_runs FOR UPDATE TO auditorx_scan_worker USING(true) WITH CHECK(true);

-- Queue within the same transaction that publishes completed findings.
-- +goose StatementBegin
CREATE FUNCTION public.queue_scan_priority_prediction() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.status=NEW.status THEN RETURN NEW; END IF;
 INSERT INTO public.priority_prediction_runs(scan_id,repository_id,requested_by,origin,context)
 VALUES(NEW.id,NEW.repository_id,NEW.requested_by,'automatic',NEW.prediction_context)
 ON CONFLICT(scan_id) WHERE status IN ('queued','running') DO NOTHING;
 RETURN NEW;
END;
$$;
-- +goose StatementEnd
REVOKE ALL ON FUNCTION public.queue_scan_priority_prediction() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER scan_priority_prediction AFTER INSERT OR UPDATE OF status ON public.scan_jobs
 FOR EACH ROW WHEN(NEW.status='completed') EXECUTE FUNCTION public.queue_scan_priority_prediction();

-- Existing results get a separate initial prediction; saved labels are untouched.
INSERT INTO public.priority_prediction_runs(scan_id,repository_id,requested_by,origin,context)
 SELECT id,repository_id,requested_by,'automatic',prediction_context FROM public.scan_jobs WHERE status='completed';

-- +goose Down
DROP TRIGGER scan_priority_prediction ON public.scan_jobs;
DROP FUNCTION public.queue_scan_priority_prediction();
DROP TABLE public.priority_prediction_runs;
ALTER TABLE public.scan_jobs DROP COLUMN prediction_context;
