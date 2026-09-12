# Issue API

> Related: `UC-006`, `UC-007`, `FR-ISSUE-*`, `FR-FILTER-*`

**Implementation status: Not yet built.** There is no persistent, stateful `Issue` entity and no issues API distinct from scan findings — no issue status lifecycle, no PATCH, no notes endpoint, no history endpoint, no AI analysis, and no priority-prediction/label endpoints exist anywhere in the codebase (see `docs/05-database/data-model.md` §4a for the corresponding "not implemented" tables). Describes planned/target API design; no corresponding code exists in the repository as of 2026-09-12.

The one route that is real, `GET /api/v1/issues`, is registered in `postgres` mode (`backend/internal/modules/project/delivery/http/handler.go`, `Issues` handler) but is a legacy placeholder: it requires only `repository_id`, ignores every filter listed below, and always returns an empty collection (`{"data": [], "meta": {"count": 0}}`) — "No live scans yet. Never reuse sample findings in persistent mode," per the handler's own comment. Per `docs/scan-pipeline.md` ("Web workflow" section), *"the existing dashboard and `/api/v1/issues` still use the earlier placeholder contract in postgres mode; the web dashboard now uses scan-specific endpoints for real results when the queue is enabled"* — i.e. the real findings for a completed scan are only available via `GET /api/v1/repositories/{repository_id}/scans/{scan_id}/findings` (see `scans.md`), not through this endpoint. In `prototype` mode (no database), a separate legacy `audit` module serves this same path with hardcoded/sample data instead (`backend/internal/modules/audit/delivery/http/handler.go`).

## GET /api/v1/issues — **[Planned target shape; implemented route is a legacy placeholder returning an empty list — see status note above]**

Filters issue collection.

Query parameters may include:

- `repository_id`
- `scan_id`
- `search`
- `severity`
- `category`
- `status`
- `language`
- `predicted_priority`
- `priority_source`
- `sort`
- `page`
- `page_size`

---

## GET /api/v1/issues/{issue_id} — **[Planned; not implemented]**

Returns:

- rule
- severity
- category
- file
- location
- code snippet
- issue status
- latest Priority Prediction, source, confidence/probabilities and predictor version
- latest human-reviewed Priority Label where authorized
- notes
- latest AI analysis
- status history where appropriate

---

## PATCH /api/v1/issues/{issue_id} — **[Planned; not implemented]**

Updates allowed issue properties.

Request:

```json
{
  "status": "In Progress"
}
```

Backend validates transition and permission.

---

## POST /api/v1/issues/{issue_id}/notes — **[Planned; not implemented]**

Request:

```json
{
  "note": "Needs refactoring before release."
}
```

---

## GET /api/v1/issues/{issue_id}/history — **[Planned; not implemented]**

Returns issue status history.

---

## POST /api/v1/issues/{issue_id}/ai-analysis — **[Planned; not implemented]**

Requests AI analysis or re-analysis.

Related:
- `UC-004`
- `FR-AI-008`

---

## GET /api/v1/issues/{issue_id}/priority-predictions — **[Planned; not implemented]**

Returns immutable Prediction history including:

- priority
- priority_source (`model` or `baseline`)
- predictor_version
- feature_schema_version
- sanitized feature snapshot where the caller is authorized
- probabilities/confidence
- fallback_reason
- created_at

Related: `FR-PRIO-002`, `FR-PRIO-003`, `FR-PRIO-004`

---

## POST /api/v1/issues/{issue_id}/priority-labels — **[Planned; not implemented]**

Creates an append-only human-reviewed label.

```json
{
  "label": "High",
  "rationale": "Blocks a release-critical authentication flow.",
  "guideline_version": "priority-label-v1"
}
```

Only an authorized Reviewer or Administrator may create a label. This endpoint never edits prior Predictions.

Related: `FR-PRIO-005`, `BR-016`

---

## Status Values

- Open
- In Progress
- Resolved
- Accepted Risk
- False Positive
