-- +goose Up
ALTER TABLE public.scan_jobs DROP CONSTRAINT scan_jobs_rules_version_check;
ALTER TABLE public.scan_jobs ALTER COLUMN rules_version SET DEFAULT 'baseline-v4';
ALTER TABLE public.scan_jobs ADD CONSTRAINT scan_jobs_rules_version_check
  CHECK (rules_version IN ('baseline-v1','baseline-v2','baseline-v3','baseline-v4'));

-- +goose Down
-- Refuse rollback while v4 scans exist; do not rewrite their provenance.
ALTER TABLE public.scan_jobs DROP CONSTRAINT scan_jobs_rules_version_check;
ALTER TABLE public.scan_jobs ALTER COLUMN rules_version SET DEFAULT 'baseline-v3';
ALTER TABLE public.scan_jobs ADD CONSTRAINT scan_jobs_rules_version_check
  CHECK (rules_version IN ('baseline-v1','baseline-v2','baseline-v3'));
