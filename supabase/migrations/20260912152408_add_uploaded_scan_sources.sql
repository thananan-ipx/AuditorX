ALTER TABLE public.scan_jobs
  ADD COLUMN source_kind text NOT NULL DEFAULT 'github'
    CHECK (source_kind IN ('github', 'upload')),
  ADD COLUMN source_name text,
  ADD COLUMN source_digest text;

ALTER TABLE public.scan_jobs
  DROP CONSTRAINT scan_jobs_commit_sha_check;
ALTER TABLE public.scan_jobs
  ADD CONSTRAINT scan_jobs_commit_sha_check
  CHECK (commit_sha ~ '^[0-9a-f]{40}$' OR commit_sha ~ '^[0-9a-f]{64}$');

ALTER TABLE public.scan_jobs
  ADD CONSTRAINT scan_jobs_source_metadata_check CHECK (
    (source_kind = 'github' AND source_name IS NULL AND source_digest IS NULL)
    OR
    (source_kind = 'upload'
      AND length(source_name) BETWEEN 1 AND 255
      AND source_name ~* '\.zip$'
      AND source_name !~ '[/\\]'
      AND source_digest ~ '^[0-9a-f]{64}$')
  );

CREATE TABLE public.scan_source_archives (
  scan_id uuid PRIMARY KEY,
  repository_id uuid NOT NULL,
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  archive bytea NOT NULL CHECK (octet_length(archive) BETWEEN 1 AND 20971520),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (scan_id, repository_id)
    REFERENCES public.scan_jobs(id, repository_id) ON DELETE CASCADE
);

CREATE INDEX scan_source_archives_requested_by ON public.scan_source_archives(requested_by);

ALTER TABLE public.scan_source_archives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_source_archives FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.scan_source_archives FROM PUBLIC, anon, authenticated;
GRANT SELECT (scan_id,repository_id,requested_by,created_at), INSERT (scan_id,repository_id,requested_by,archive), DELETE ON public.scan_source_archives TO authenticated;
GRANT SELECT (source_kind,source_name,source_digest) ON public.scan_jobs TO authenticated;
GRANT INSERT (source_kind,source_name,source_digest) ON public.scan_jobs TO authenticated;

CREATE POLICY scan_source_archives_insert ON public.scan_source_archives FOR INSERT TO authenticated
WITH CHECK (
  requested_by = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.scan_jobs j
    JOIN public.repository_members m ON m.repository_id = j.repository_id
    WHERE j.id = scan_source_archives.scan_id
      AND j.repository_id = scan_source_archives.repository_id
      AND j.requested_by = scan_source_archives.requested_by
      AND j.source_kind = 'upload'
      AND m.user_id = (SELECT auth.uid())
      AND m.access_level IN ('owner','editor')
  )
);

CREATE POLICY scan_source_archives_read_metadata ON public.scan_source_archives FOR SELECT TO authenticated
USING (
  requested_by = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.repository_members m
    WHERE m.repository_id = scan_source_archives.repository_id
      AND m.user_id = (SELECT auth.uid())
      AND m.access_level IN ('owner','editor')
  )
);

CREATE POLICY scan_source_archives_delete ON public.scan_source_archives FOR DELETE TO authenticated
USING (
  requested_by = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.repository_members m
    WHERE m.repository_id = scan_source_archives.repository_id
      AND m.user_id = (SELECT auth.uid())
      AND m.access_level IN ('owner','editor')
  )
);

GRANT SELECT, DELETE ON public.scan_source_archives TO auditorx_scan_worker;
CREATE POLICY scan_worker_source_archives_read ON public.scan_source_archives
  FOR SELECT TO auditorx_scan_worker USING (true);
CREATE POLICY scan_worker_source_archives_delete ON public.scan_source_archives
  FOR DELETE TO auditorx_scan_worker USING (true);
