# Priority Model and Evaluation API

> Related: `FR-PRIO-*`, `BR-016`–`BR-019`

**Implementation status: Not yet built.** None of the `/api/v1/priority/*` endpoints below exist. There is no priority-prediction model, no model registry, no feature snapshots, and no evaluation-run persistence anywhere in the codebase (no such tables — see `docs/05-database/data-model.md` §4a — and no such routes in `backend/cmd/api/main.go`).

The only "evaluation"/mode-detection mechanism actually implemented today is unrelated to ML model evaluation: `GET /api/v1/capabilities`, which reports which product features are currently switched on:

```json
{
  "data": {
    "repository_storage": "postgres",
    "repository_creation": true,
    "scan_execution": false,
    "scan_queue": true
  }
}
```

`repository_storage` is `"prototype"` or `"postgres"`; `repository_creation` is true only in `postgres` mode; `scan_execution` is currently hardcoded `false`; `scan_queue` is true only when both `postgres` mode and the scan-queue feature flag are enabled. See `backend/cmd/api/main.go`. This is a capability/feature-flag probe for the frontend, not a machine-learning model evaluation API. Everything below remains planned/target API design for the priority-prediction feature described in `FR-PRIO-*`.

## GET /api/v1/priority/models/active — **[Planned; not implemented]**

Returns the Active priority model or the active baseline configuration.

Response includes:

- version
- algorithm/source
- feature_schema_version
- training_dataset_version where applicable
- promotion metrics
- activated_at

## GET /api/v1/priority/models — **[Planned; not implemented]**

Lists Candidate, Active and Retired model versions. Model artifacts and internal storage credentials are never returned.

## POST /api/v1/priority/models/{model_id}/activate — **[Planned; not implemented]**

Administrator-only action. Activation succeeds only when a Completed EvaluationRun has:

- leakage check Passed
- candidate Macro-F1 not lower than baseline
- candidate Critical Recall not lower than baseline
- matching immutable model/dataset artifacts

Activation retires the previously Active model in the same transaction and writes an AuditLog entry.

## GET /api/v1/priority/evaluations — **[Planned; not implemented]**

Lists evaluation runs with dataset/model/baseline versions and summary metrics.

## GET /api/v1/priority/evaluations/{evaluation_id} — **[Planned; not implemented]**

Returns:

- dataset and split metadata
- candidate/baseline configurations
- Macro-F1 and per-class metrics
- Confusion Matrix
- leakage-check status
- source revision
- run status and timestamps

## Authorization

- Authenticated repository users may view the predictor version/source attached to Issues they can access.
- Reviewer/Administrator roles with repository permission may create Priority Labels.
- Only Administrator may view full evaluation metadata or activate a model.
- Training jobs and artifact upload are offline operational workflows and are not public MVP endpoints.

