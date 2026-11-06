-- +goose Up
ALTER TABLE public.priority_labels DROP CONSTRAINT priority_labels_review_status_check;
ALTER TABLE public.priority_labels DROP CONSTRAINT priority_labels_check;
ALTER TABLE public.priority_labels ADD CONSTRAINT priority_labels_review_status_check
  CHECK (review_status IN ('unreviewed','accepted','simulated','excluded','needs_context'));
ALTER TABLE public.priority_labels ADD CONSTRAINT priority_labels_check CHECK (
  (review_status IN ('accepted','simulated') AND priority_label IS NOT NULL) OR
  (review_status NOT IN ('accepted','simulated') AND priority_label IS NULL)
);
ALTER TABLE public.priority_labels ADD CONSTRAINT priority_labels_simulated_context
  CHECK (review_status <> 'simulated' OR exposure='test_only');

-- +goose Down
-- Refuse rollback while simulated labels exist; never rewrite label history.
ALTER TABLE public.priority_labels DROP CONSTRAINT priority_labels_simulated_context;
ALTER TABLE public.priority_labels DROP CONSTRAINT priority_labels_review_status_check;
ALTER TABLE public.priority_labels DROP CONSTRAINT priority_labels_check;
ALTER TABLE public.priority_labels ADD CONSTRAINT priority_labels_review_status_check
  CHECK (review_status IN ('unreviewed','accepted','excluded','needs_context'));
ALTER TABLE public.priority_labels ADD CONSTRAINT priority_labels_check CHECK (
  (review_status='accepted' AND priority_label IS NOT NULL) OR
  (review_status<>'accepted' AND priority_label IS NULL)
);
