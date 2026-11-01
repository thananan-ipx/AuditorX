-- +goose Up
ALTER TABLE public.scan_jobs
  DROP CONSTRAINT scan_jobs_rules_version_check;

ALTER TABLE public.scan_jobs
  ALTER COLUMN rules_version SET DEFAULT 'baseline-v2';

ALTER TABLE public.scan_jobs
  ADD CONSTRAINT scan_jobs_rules_version_check
  CHECK (rules_version IN ('baseline-v1', 'baseline-v2'));

-- +goose Down
ALTER TABLE public.scan_jobs DROP CONSTRAINT scan_jobs_rules_version_check;
ALTER TABLE public.scan_jobs ALTER COLUMN rules_version SET DEFAULT 'baseline-v1';
ALTER TABLE public.scan_jobs ADD CONSTRAINT scan_jobs_rules_version_check CHECK (rules_version = 'baseline-v1');
