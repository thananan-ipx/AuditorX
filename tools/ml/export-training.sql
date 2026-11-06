-- Operator-only local export: immutable CSV snapshot of latest human labels.
-- One latest labeled scan per project group; no excluded/unreviewed/uncertain rows.
COPY (
 WITH latest AS (
   SELECT DISTINCT ON (scan_id,fingerprint) * FROM public.priority_labels
   ORDER BY scan_id,fingerprint,id DESC
 ), snapshots AS (
   SELECT DISTINCT ON (l.repository_group) l.repository_group,l.scan_id
   FROM latest l JOIN public.scan_jobs j ON j.id=l.scan_id
   WHERE l.review_status='accepted' AND l.priority_label IS NOT NULL
   ORDER BY l.repository_group,j.finished_at DESC,l.scan_id DESC
 ), counts AS (
   SELECT scan_id,rule_id,count(*) AS rule_count_in_scan FROM public.scan_findings GROUP BY scan_id,rule_id
 )
 SELECT 'priority-dataset-v1' AS schema_version,l.guideline_version,l.repository_group,
   f.repository_id,f.scan_id,j.commit_sha AS source_revision,j.rules_version,j.scanner_version,
   f.fingerprint AS finding_fingerprint,l.id AS label_revision_id,
   f.severity,regexp_replace(f.rule_id,'^auditorx\.(python|javascript|go)\.','') AS rule_family,
   CASE WHEN f.rule_id LIKE 'auditorx.nextjs.review.%' THEN 'Manual review'
        WHEN f.rule_id LIKE '%.security.%' OR j.rules_version='baseline-v1' THEN 'Security'
        WHEN f.rule_id LIKE '%.coding-standard.%' THEN 'Coding standard'
        WHEN f.rule_id LIKE '%.code-quality.%' THEN 'Code quality' ELSE 'unknown' END AS category,
   CASE WHEN lower(f.file_path) ~ '\.py$' THEN 'python'
        WHEN lower(f.file_path) ~ '\.(js|jsx)$' THEN 'javascript'
        WHEN lower(f.file_path) ~ '\.(ts|tsx)$' THEN 'typescript'
        WHEN lower(f.file_path) ~ '\.go$' THEN 'go' ELSE 'unknown' END AS language,
   lower(substring(f.file_path FROM '\.([^.]+)$')) AS file_type,c.rule_count_in_scan,
   l.priority_label,l.reviewer,l.labeled_at
 FROM latest l JOIN snapshots s ON s.scan_id=l.scan_id AND s.repository_group=l.repository_group
 JOIN public.scan_findings f ON f.scan_id=l.scan_id AND f.fingerprint=l.fingerprint
 JOIN public.scan_jobs j ON j.id=f.scan_id
 JOIN counts c ON c.scan_id=f.scan_id AND c.rule_id=f.rule_id
 WHERE l.review_status='accepted' AND l.priority_label IS NOT NULL
 ORDER BY l.repository_group,f.fingerprint
) TO STDOUT WITH (FORMAT CSV, HEADER true);
