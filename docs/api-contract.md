# Current API contract

**Authentication update (2026-11-01):** Website accounts and opaque sessions now
use local PostgreSQL. Supabase Auth is no longer required. Paths remain unchanged;
signup creates a usable session immediately, and refresh rotates the current opaque
cookie token. See [Local authentication](local-auth.md). Docker Compose now uses
`REPOSITORY_STORAGE=postgres` by default.

Snapshot: 2026-08-28. Routes below exist in the Go implementation. This document reconciles
the prototype route names without silently renaming working endpoints or claiming the SRS is complete.

The audit rows below describe the default `REPOSITORY_STORAGE=prototype` mode.
The opt-in postgres mode now implements repository create/list/detail and membership enforcement;
see [the persistence API contract](repository-persistence.md) for its responses and activation steps.

| Method | Route | Implementation status |
| --- | --- | --- |
| GET | `/health` | Service/database health |
| POST | `/api/v1/auth/sign-in` | Existing auth handler |
| POST | `/api/v1/auth/sign-up` | Existing auth handler |
| POST | `/api/v1/auth/refresh` | Existing auth handler |
| POST | `/api/v1/auth/sign-out` | Existing auth handler |
| GET | `/api/v1/auth/me` | Existing auth handler |
| GET | `/api/v1/capabilities` | Authenticated storage mode and availability flags, no-store; queue availability is not worker health |
| GET | `/api/v1/repositories` | Prototype list |
| GET | `/api/v1/repositories/{repositoryID}/dashboard` | Prototype dashboard |
| POST | `/api/v1/repositories/{repositoryID}/scans` | Prototype acceptance only, no worker |
| GET | `/api/v1/issues?severity=High` | Prototype issue list with severity filter |

Auth route names in older design documents (`login`, `register`, `logout`) describe intent;
they are not implemented aliases. Frontend services currently use `sign-in`, `sign-up` and
`sign-out`. Keep these stable until a deliberate contract migration is approved.

The shared frontend client reads JSON success data from `data`, structured failures from
`error.message`, and sends session cookies. Failures are `ApiError` instances preserving HTTP `status`
and optional business `code` (e.g. `SCAN_REQUIRED` versus `REPOSITORY_EXISTS`). A `204 No Content` resolves to `null`.
Non-JSON/empty error bodies use the HTTP status instead of exposing gateway response text.

Repository creation is implemented in postgres mode. Repository updates/deletion,
issue writes, reports and evaluation endpoints remain planned. Do not present prototype `202 Pending`
as proof that source code has been analyzed. Postgres mode checks membership and returns
`501 SCANNER_NOT_READY` instead of pretending to queue a scan.

With the additional `SCAN_QUEUE_ENABLED=true` opt-in, the scan POST instead persists a job and
returns `202`. Scan list/detail/findings/cancel routes are also enabled; see [the scan API contract](scan-pipeline.md#api).
This does not change the existing dashboard/issue placeholder response shape. In postgres mode the
web dashboard uses `scan_queue: true` to enable start/cancel, scan history, active polling and
scan-specific findings, without requesting the old dashboard/issues endpoints.

The frontend now exposes `/repositories` and `/dashboard?repository={id}`. It discovers storage
mode through capabilities, uses actual selected IDs, scopes issue requests by `repository_id`, and
shows dedicated no-scan/error states instead of silently substituting demo data. See
[the repository UI workflow](repository-persistence.md#frontend-workflow) for behavior and limitations.
