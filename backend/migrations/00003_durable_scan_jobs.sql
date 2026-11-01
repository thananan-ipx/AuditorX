-- +goose Up
-- No login/password or role membership is provisioned here. Grant this role only
-- to a dedicated worker login through the deployment's approved admin workflow.
CREATE ROLE auditorx_scan_worker NOLOGIN NOBYPASSRLS;

CREATE TABLE public.scan_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id uuid NOT NULL REFERENCES public.repositories(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES auth.users(id),
  branch text NOT NULL CHECK (length(branch) BETWEEN 1 AND 255),
  rules_version text NOT NULL DEFAULT 'baseline-v1' CHECK (rules_version = 'baseline-v1'),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','completed','failed','cancelled')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 3),
  lease_token uuid,
  lease_expires_at timestamptz,
  commit_sha text CHECK (commit_sha ~ '^[0-9a-f]{40}$'),
  scanner_version text,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  UNIQUE (id, repository_id),
  CHECK (status <> 'completed' OR (commit_sha IS NOT NULL AND scanner_version IS NOT NULL AND finished_at IS NOT NULL)),
  CHECK (status <> 'running' OR (lease_token IS NOT NULL AND lease_expires_at IS NOT NULL AND attempts > 0))
);
CREATE UNIQUE INDEX scan_jobs_one_active ON public.scan_jobs(repository_id) WHERE status IN ('queued','running');
CREATE INDEX scan_jobs_claim ON public.scan_jobs(created_at, id) WHERE status IN ('queued','running');
CREATE INDEX scan_jobs_repository_history ON public.scan_jobs(repository_id, created_at DESC, id DESC);
CREATE INDEX scan_jobs_requested_by ON public.scan_jobs(requested_by);

CREATE TABLE public.scan_findings (
  scan_id uuid NOT NULL,
  repository_id uuid NOT NULL,
  fingerprint text NOT NULL CHECK (length(fingerprint) = 64),
  rule_id text NOT NULL CHECK (length(rule_id) BETWEEN 1 AND 200),
  severity text NOT NULL CHECK (severity IN ('High','Medium','Low')),
  file_path text NOT NULL CHECK (length(file_path) BETWEEN 1 AND 500),
  start_line integer NOT NULL CHECK (start_line > 0),
  end_line integer NOT NULL CHECK (end_line >= start_line),
  message text NOT NULL CHECK (length(message) BETWEEN 1 AND 2000),
  PRIMARY KEY (scan_id, fingerprint),
  FOREIGN KEY (scan_id, repository_id) REFERENCES public.scan_jobs(id, repository_id) ON DELETE CASCADE
);
CREATE INDEX scan_findings_repository ON public.scan_findings(repository_id);

ALTER TABLE public.scan_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_jobs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.scan_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_findings FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.scan_jobs, public.scan_findings FROM PUBLIC, anon, authenticated;
GRANT SELECT (id,repository_id,requested_by,branch,rules_version,status,attempts,commit_sha,scanner_version,error_code,created_at,started_at,finished_at) ON public.scan_jobs TO authenticated;
GRANT INSERT (repository_id,requested_by,branch) ON public.scan_jobs TO authenticated;
GRANT UPDATE (status,finished_at) ON public.scan_jobs TO authenticated;
GRANT SELECT ON public.scan_findings TO authenticated;

CREATE POLICY scan_jobs_read ON public.scan_jobs FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.repository_members m WHERE m.repository_id = scan_jobs.repository_id AND m.user_id = (SELECT auth.uid()))
);
CREATE POLICY scan_jobs_enqueue ON public.scan_jobs FOR INSERT TO authenticated WITH CHECK (
  requested_by = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.repository_members m WHERE m.repository_id = scan_jobs.repository_id
    AND m.user_id = (SELECT auth.uid()) AND m.access_level IN ('owner','editor')
  ) AND EXISTS (SELECT 1 FROM public.repositories r WHERE r.id = scan_jobs.repository_id AND r.default_branch = scan_jobs.branch)
);
CREATE POLICY scan_jobs_cancel ON public.scan_jobs FOR UPDATE TO authenticated USING (
  status IN ('queued','running') AND EXISTS (SELECT 1 FROM public.repository_members m
    WHERE m.repository_id = scan_jobs.repository_id AND m.user_id = (SELECT auth.uid()) AND m.access_level IN ('owner','editor'))
) WITH CHECK (
  status = 'cancelled' AND EXISTS (SELECT 1 FROM public.repository_members m
    WHERE m.repository_id = scan_jobs.repository_id AND m.user_id = (SELECT auth.uid()) AND m.access_level IN ('owner','editor'))
);
CREATE POLICY scan_findings_read ON public.scan_findings FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.repository_members m WHERE m.repository_id = scan_findings.repository_id AND m.user_id = (SELECT auth.uid()))
);

GRANT USAGE ON SCHEMA public TO auditorx_scan_worker;
GRANT SELECT ON public.repositories, public.repository_members TO auditorx_scan_worker;
GRANT SELECT, UPDATE ON public.scan_jobs TO auditorx_scan_worker;
GRANT SELECT, INSERT ON public.scan_findings TO auditorx_scan_worker;
CREATE POLICY scan_worker_repositories ON public.repositories FOR SELECT TO auditorx_scan_worker USING (true);
CREATE POLICY scan_worker_members ON public.repository_members FOR SELECT TO auditorx_scan_worker USING (true);
CREATE POLICY scan_worker_jobs_read ON public.scan_jobs FOR SELECT TO auditorx_scan_worker USING (true);
CREATE POLICY scan_worker_jobs_update ON public.scan_jobs FOR UPDATE TO auditorx_scan_worker USING (true) WITH CHECK (true);
CREATE POLICY scan_worker_findings_read ON public.scan_findings FOR SELECT TO auditorx_scan_worker USING (true);
CREATE POLICY scan_worker_findings_insert ON public.scan_findings FOR INSERT TO auditorx_scan_worker WITH CHECK (true);

-- +goose Down
DROP TABLE public.scan_findings;
DROP TABLE public.scan_jobs;
DROP POLICY scan_worker_repositories ON public.repositories;
DROP POLICY scan_worker_members ON public.repository_members;
REVOKE ALL ON public.repositories, public.repository_members FROM auditorx_scan_worker;
REVOKE USAGE ON SCHEMA public FROM auditorx_scan_worker;
DROP ROLE auditorx_scan_worker;
