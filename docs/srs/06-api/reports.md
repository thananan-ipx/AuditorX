# Report API

> Related: `UC-008`, `FR-REPORT-*`

**Implementation status: Not yet built.** Describes planned/target API design; no corresponding code exists in the repository as of 2026-09-12. There is no `Report` table (see `docs/05-database/data-model.md` §4a) and no report generation, export, or download route registered anywhere in `backend/cmd/api/main.go`. All content below is retained as forward-looking scope for the project spec.

## POST /api/v1/reports

Creates a report.

Request:

```json
{
  "repository_id": "uuid",
  "scan_id": "uuid",
  "format": "pdf"
}
```

Response may be:

- `201 Created` if generation is immediate
- `202 Accepted` if generation is asynchronous

---

## GET /api/v1/reports/{report_id}

Returns report metadata and status.

---

## GET /api/v1/reports/{report_id}/download

Returns or redirects to the authorized report artifact.

---

## GET /api/v1/repositories/{repository_id}/reports

Lists reports for repository.

---

## Rules

- User must have repository access.
- Scan must belong to repository.
- Report generation must not be marked successful if artifact generation fails.
- AI summary is optional; report may still be generated from static analysis data.
- Priority distribution must identify predictor version/source and fallback count.
- Report wording must distinguish Severity, deterministic Quality Score, predicted Priority and human-reviewed Label.
