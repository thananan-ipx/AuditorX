-- +goose Up
-- Historical scans remain NULL: their source has already been deleted and their
-- language/rule scope cannot be reconstructed from findings alone.
ALTER TABLE public.scan_jobs
  ADD COLUMN source_languages text[],
  ADD COLUMN checked_rule_ids text[],
  ADD CONSTRAINT scan_scope_pair CHECK (
    (source_languages IS NULL AND checked_rule_ids IS NULL) OR
    (status = 'completed' AND source_languages IS NOT NULL AND checked_rule_ids IS NOT NULL
      AND cardinality(source_languages) BETWEEN 1 AND 4
      AND source_languages <@ ARRAY['go','javascript','python','typescript']::text[]
      AND cardinality(checked_rule_ids) BETWEEN 1 AND 14)
  );
GRANT SELECT (source_languages, checked_rule_ids) ON public.scan_jobs TO authenticated;

-- +goose Down
ALTER TABLE public.scan_jobs DROP CONSTRAINT scan_scope_pair,
  DROP COLUMN source_languages, DROP COLUMN checked_rule_ids;
