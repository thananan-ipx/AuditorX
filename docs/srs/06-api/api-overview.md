# API Overview

> **Project:** AuditorX  
> **Style:** RESTful HTTP API  
> **Status:** Draft

**Implementation status (as of 2026-09-12):** This document describes the target API surface; only a subset is implemented. Real, always-available routes are `GET /health` and `GET /api/v1/capabilities` (a feature-flag probe — see `evaluation.md`), registered in `backend/cmd/api/main.go`. Beyond those, the backend runs in one of two modes selected by `repository_storage`: in `postgres` mode it exposes the repository/scan endpoints in `repositories.md`/`scans.md` (full scan endpoints only when the scan-queue flag is also on) plus legacy placeholder `dashboard`/`issues` routes; in `prototype` mode it instead exposes a legacy `audit` module serving hardcoded sample data. There is no implemented `/priority/*` group (see `evaluation.md`), no `/reports/*` group (see `reports.md`), and no `/users/*` admin group (see `users.md`). See each endpoint document's own implementation-status note for specifics.

---

## 1. Purpose

API เป็น interface หลักระหว่าง Next.js Frontend และ Go Backend

Base path:

```text
/api/v1
```

---

## 2. Conventions

- JSON request/response
- UTF-8
- Resource-oriented paths
- Standard HTTP methods
- Consistent error envelope
- Backend enforces authorization

---

## 3. Response Concept

Success:

```json
{
  "data": {}
}
```

Collection:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "page_size": 20,
    "total": 0
  }
}
```

Error:

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "The requested resource was not found.",
    "request_id": "..."
  }
}
```

---

## 4. HTTP Status Guidelines

| Status | Meaning |
|---|---|
| 200 | Successful read/update |
| 201 | Resource created |
| 202 | Long-running operation accepted |
| 204 | Successful action without body |
| 400 | Validation error |
| 401 | Authentication required/invalid |
| 403 | Forbidden |
| 404 | Not found |
| 409 | Conflict/state conflict |
| 422 | Semantic validation error if used |
| 429 | Rate limited |
| 500 | Internal error |
| 502/503 | External dependency unavailable |

---

## 5. API Groups

| Group | Path | Status |
|---|---|---|
| Authentication | `/auth/*` | Implemented (paths differ — see `authentication.md`) |
| Repositories | `/repositories/*` | Implemented (list/create/get only — see `repositories.md`) |
| Scans | nested under `/repositories/{id}/scans/*`, not a top-level `/scans/*` | Implemented, queue mode only — see `scans.md` |
| Issues | `/issues/*` | Placeholder only (`GET /api/v1/issues` always empty) — see `issues.md` |
| Priority Models / Evaluation | `/priority/*` | Planned; not implemented — see `evaluation.md` |
| Dashboard | `/repositories/{id}/dashboard` | Placeholder only (`409 SCAN_REQUIRED`) — see `dashboard.md` |
| Reports | `/reports/*` | Planned; not implemented — see `reports.md` |
| Users | `/users/*` | Planned; not implemented (no admin endpoints) — see `users.md` |

---

## 6. Authentication

Protected endpoints require an authenticated session/token.

Exact token transport strategy remains to be finalized.

---

## 7. Pagination

Suggested query:

```text
?page=1&page_size=20
```

Maximum page size should be enforced by backend.

MVP defaults:

- `page` defaults to `1`
- `page_size` defaults to `20`
- maximum `page_size` is `100`
- collection responses include `page`, `page_size`, `total_items` and `total_pages`

---

## 8. Filtering and Sorting

Example:

```text
GET /api/v1/issues?severity=High&status=Open&sort=-created_at
```

Backend must whitelist sortable/filterable fields.

---

## 9. Idempotency

Create operations that may be accidentally retried should be designed to avoid duplicate side effects where practical.

Scan creation should prevent unintended duplicate jobs from the same user action.

---

## 10. Traceability

API operations should map back to:
- `FR-*`
- `UC-*`
- domain service
- test cases
