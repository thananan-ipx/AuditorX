-- +goose Up
ALTER TABLE public.scan_findings ADD CONSTRAINT scan_findings_label_reference UNIQUE(scan_id,fingerprint,repository_id);
CREATE TABLE public.priority_labels (
  id bigserial PRIMARY KEY,
  scan_id uuid NOT NULL,
  fingerprint text NOT NULL,
  repository_id uuid NOT NULL,
  repository_group text NOT NULL CHECK(length(btrim(repository_group)) BETWEEN 1 AND 100),
  review_status text NOT NULL CHECK(review_status IN ('unreviewed','accepted','excluded','needs_context')),
  priority_label text CHECK(priority_label IN ('High','Medium','Low')),
  repository_criticality text NOT NULL CHECK(repository_criticality IN ('high','normal','low','unknown')),
  exposure text NOT NULL CHECK(exposure IN ('public','authenticated','internal','test_only','unknown')),
  impact text NOT NULL CHECK(impact IN ('high','medium','low','unknown')),
  label_reason text NOT NULL CHECK(length(btrim(label_reason)) BETWEEN 1 AND 2000),
  reviewer uuid NOT NULL REFERENCES auth.users(id),
  guideline_version text NOT NULL DEFAULT 'priority-labels-3class-v1' CHECK(guideline_version='priority-labels-3class-v1'),
  labeled_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(scan_id,fingerprint,repository_id) REFERENCES public.scan_findings(scan_id,fingerprint,repository_id) ON DELETE CASCADE,
  CHECK ((review_status='accepted' AND priority_label IS NOT NULL) OR (review_status<>'accepted' AND priority_label IS NULL))
);
CREATE INDEX priority_labels_latest ON public.priority_labels(scan_id,fingerprint,id DESC);
CREATE INDEX priority_labels_repository ON public.priority_labels(repository_id);
CREATE INDEX priority_labels_reviewer ON public.priority_labels(reviewer);
ALTER TABLE public.priority_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.priority_labels FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.priority_labels FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.priority_labels TO authenticated;
GRANT INSERT(scan_id,fingerprint,repository_id,repository_group,review_status,priority_label,repository_criticality,exposure,impact,label_reason,reviewer) ON public.priority_labels TO authenticated;
GRANT USAGE ON SEQUENCE public.priority_labels_id_seq TO authenticated;
CREATE POLICY priority_labels_read ON public.priority_labels FOR SELECT TO authenticated USING (
  EXISTS(SELECT 1 FROM public.repository_members m WHERE m.repository_id=priority_labels.repository_id AND m.user_id=(SELECT auth.uid()))
);
CREATE POLICY priority_labels_insert ON public.priority_labels FOR INSERT TO authenticated WITH CHECK (
  reviewer=(SELECT auth.uid()) AND
  EXISTS(SELECT 1 FROM public.repository_members m WHERE m.repository_id=priority_labels.repository_id AND m.user_id=(SELECT auth.uid()) AND m.access_level IN ('owner','editor')) AND
  EXISTS(SELECT 1 FROM public.scan_jobs j WHERE j.id=priority_labels.scan_id AND j.repository_id=priority_labels.repository_id AND j.status='completed')
);

-- +goose Down
DROP TABLE public.priority_labels;
ALTER TABLE public.scan_findings DROP CONSTRAINT scan_findings_label_reference;
