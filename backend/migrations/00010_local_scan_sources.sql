-- +goose Up
ALTER TABLE public.scan_jobs DROP CONSTRAINT scan_jobs_source_kind_check;
ALTER TABLE public.scan_jobs ADD CONSTRAINT scan_jobs_source_kind_check CHECK (source_kind IN ('github','upload','local'));
ALTER TABLE public.scan_jobs DROP CONSTRAINT scan_jobs_source_metadata_check;
ALTER TABLE public.scan_jobs ADD CONSTRAINT scan_jobs_source_metadata_check CHECK (
  (source_kind = 'github' AND source_name IS NULL AND source_digest IS NULL)
  OR (source_kind = 'upload' AND length(source_name) BETWEEN 1 AND 255 AND source_name ~* '\.zip$' AND source_name !~ '[/\\]' AND source_digest ~ '^[0-9a-f]{64}$')
  OR (source_kind = 'local' AND source_name IS NOT NULL AND length(source_name) BETWEEN 1 AND 255 AND source_digest IS NULL)
);

-- +goose Down
-- Local jobs must be explicitly removed before downgrading; preserve existing data.
ALTER TABLE public.scan_jobs DROP CONSTRAINT scan_jobs_source_kind_check;
ALTER TABLE public.scan_jobs ADD CONSTRAINT scan_jobs_source_kind_check CHECK (source_kind IN ('github','upload'));
ALTER TABLE public.scan_jobs DROP CONSTRAINT scan_jobs_source_metadata_check;
ALTER TABLE public.scan_jobs ADD CONSTRAINT scan_jobs_source_metadata_check CHECK (
  (source_kind = 'github' AND source_name IS NULL AND source_digest IS NULL)
  OR (source_kind = 'upload' AND length(source_name) BETWEEN 1 AND 255 AND source_name ~* '\.zip$' AND source_name !~ '[/\\]' AND source_digest ~ '^[0-9a-f]{64}$')
);
