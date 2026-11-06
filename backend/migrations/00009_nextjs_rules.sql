-- +goose Up
ALTER TABLE public.scan_jobs DROP CONSTRAINT scan_jobs_rules_version_check;
ALTER TABLE public.scan_jobs ALTER COLUMN rules_version SET DEFAULT 'baseline-v3';
ALTER TABLE public.scan_jobs ADD CONSTRAINT scan_jobs_rules_version_check CHECK (rules_version IN ('baseline-v1','baseline-v2','baseline-v3'));
ALTER TABLE public.scan_jobs DROP CONSTRAINT scan_scope_pair;
ALTER TABLE public.scan_jobs ADD CONSTRAINT scan_scope_pair CHECK (
  (source_languages IS NULL AND checked_rule_ids IS NULL) OR
  (status='completed' AND source_languages IS NOT NULL AND checked_rule_ids IS NOT NULL
    AND cardinality(source_languages) BETWEEN 1 AND 4
    AND source_languages <@ ARRAY['go','javascript','python','typescript']::text[]
    AND cardinality(checked_rule_ids) BETWEEN 1 AND 21)
);

-- +goose Down
-- Refuses rollback while v3 scans exist rather than rewriting their history.
ALTER TABLE public.scan_jobs DROP CONSTRAINT scan_jobs_rules_version_check;
ALTER TABLE public.scan_jobs ALTER COLUMN rules_version SET DEFAULT 'baseline-v2';
ALTER TABLE public.scan_jobs ADD CONSTRAINT scan_jobs_rules_version_check CHECK (rules_version IN ('baseline-v1','baseline-v2'));
ALTER TABLE public.scan_jobs DROP CONSTRAINT scan_scope_pair;
ALTER TABLE public.scan_jobs ADD CONSTRAINT scan_scope_pair CHECK (
  (source_languages IS NULL AND checked_rule_ids IS NULL) OR
  (status='completed' AND source_languages IS NOT NULL AND checked_rule_ids IS NOT NULL
    AND cardinality(source_languages) BETWEEN 1 AND 4
    AND source_languages <@ ARRAY['go','javascript','python','typescript']::text[]
    AND cardinality(checked_rule_ids) BETWEEN 1 AND 14)
);
