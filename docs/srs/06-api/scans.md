# Scan API

> Related: `UC-003`, `UC-010`, `FR-SCAN-*`

**Implementation status (as of 2026-09-12):** A real, durable scan queue exists (`backend/internal/modules/scan`), but only when the backend runs in `postgres` repository-storage mode **and** the scan queue feature flag is enabled (check `GET /api/v1/capabilities` — see `api-overview.md`/`evaluation.md`). When those conditions aren't both met, `POST /api/v1/repositories/{repository_id}/scans` instead returns `501 SCANNER_NOT_READY` from a legacy placeholder handler, and none of the other scan routes exist at all. All implemented routes are nested under `/repositories/{repository_id}/scans`, not top-level `/scans/{scan_id}` as drafted below; there is no `reanalyze-ai` or `ai-summary` endpoint (no AI feature is implemented — see `evaluation.md`); and a `GET .../scans/{scan_id}/findings` endpoint exists but was missing from this document, added below. Corrections are inlined; original planned content is kept for endpoints that are not yet built.

## POST /api/v1/repositories/{repository_id}/scans **(implemented, queue mode only)**

Enqueues a scan job. Requires `owner` or `editor` access on the repository.

Request — `branch` must be omitted or equal to the repository's registered branch; `rule_profile` must be omitted or `"recommended"` (there is only one rule profile today):

```json
{
  "branch": "main",
  "rule_profile": "recommended"
}
```

Response: `202 Accepted`, `Location` header set to the new scan's URL. Body is the created job (real field names — see `docs/05-database/data-dictionary.md` §6):

```json
{
  "data": {
    "id": "uuid",
    "repository_id": "uuid",
    "requested_by": "uuid",
    "branch": "main",
    "rules_version": "baseline-v2",
    "status": "queued",
    "attempts": 0,
    "commit_sha": null,
    "scanner_version": null,
    "error_code": null,
    "created_at": "2026-09-12T12:00:00Z",
    "started_at": null,
    "finished_at": null
  }
}
```

Upload-backed jobs additionally return `source_kind: "upload"`, a sanitized `source_name`, and
the archive's SHA-256 `source_digest`; GitHub jobs return `source_kind: "github"` and null upload metadata.

The planned response shape below (`scan_id`/`status: "Pending"`) is not what is implemented:

```json
{
  "data": {
    "scan_id": "uuid",
    "status": "Pending"
  }
}
```

When queue mode is **not** active, this same path instead returns `501 SCANNER_NOT_READY` with no job created.

---

## POST /api/v1/repositories/{repository_id}/scans/upload **(implemented, queue mode only)**

Enqueues local source for the current repository workspace. Requires `owner` or `editor` access
and `multipart/form-data` containing either one `archive` part with a `.zip` filename, or folder
files whose form names are `file:{relative-path}`. The same one-active-scan rule and source limits
apply: 20 MiB total, 1 MiB per supported file and at most 1,000 supported files. Only
`.py`, `.js`, `.jsx`, `.ts`, `.tsx` and `.go` are analyzed. Unsafe paths, symlinks, hidden folders,
dependencies and repository-supplied configuration are rejected or ignored as appropriate.

The archive bytes are write-only to authenticated clients, verified again by the worker, and
deleted after a terminal worker result or cancellation. Returns `202 Accepted` and the same job
shape as the GitHub enqueue route.

---

## GET /api/v1/repositories/{repository_id}/scans **(implemented, queue mode only)**

Lists the most recent scans for the repository, newest first, capped at the latest 20 — there is no full pagination (`page`/`page_size` are not supported here).

---

## GET /api/v1/repositories/{repository_id}/scans/{scan_id} **(implemented, queue mode only; originally documented as `GET /api/v1/scans/{scan_id}`)**

Returns scan status. Real response uses the `scan_jobs` field names (no `quality_score` or `issue_count` — those are planned, not implemented):

```json
{
  "data": {
    "id": "uuid",
    "status": "completed",
    "branch": "main",
    "commit_sha": "...",
    "rules_version": "baseline-v2",
    "attempts": 1,
    "created_at": "...",
    "started_at": "...",
    "finished_at": "..."
  }
}
```

---

## GET /api/v1/repositories/{repository_id}/scans/{scan_id}/findings **(implemented, queue mode only — was missing from this document)**

Returns the findings for a **completed** scan only. Returns `409 SCAN_NOT_COMPLETED` if the scan has not finished successfully. See `docs/05-database/data-dictionary.md` §7a for the `ScanFinding` shape (`fingerprint`, `rule_id`, `severity`, `file`, `line`, `end_line`, `message` — no `id`, `title`, `category`, or `status`).

```json
{
  "data": [
    {
      "fingerprint": "...",
      "rule_id": "...",
      "severity": "High",
      "file": "src/app.go",
      "line": 42,
      "end_line": 44,
      "message": "..."
    }
  ],
  "meta": { "scan_id": "uuid", "count": 1 }
}
```

---

## POST /api/v1/repositories/{repository_id}/scans/{scan_id}/cancel **(implemented, queue mode only; originally documented as `POST /api/v1/scans/{scan_id}/cancel`)**

Cancels a `queued` or `running` scan for an authorized (`owner`/`editor`) user. Returns `200 OK` with the updated job on success, or `409 SCAN_CONFLICT` when the scan is no longer cancellable — not `202 Accepted` as originally drafted.

---

## POST /api/v1/scans/{scan_id}/reanalyze-ai — **[Planned; not implemented]**

Optional convenience action to retry/re-run AI analysis for eligible findings. No AI analysis of any kind is implemented (see `evaluation.md`).

---

## POST /api/v1/scans/{scan_id}/ai-summary — **[Planned; not implemented]**

Creates or retries a repository-level AI summary for a completed Scan. Returns `202 Accepted` with the new summary identifier and Pending status.

Related:
- `FR-AI-006`
- `FR-DASH-006`

---

## GET /api/v1/scans/{scan_id}/ai-summary — **[Planned; not implemented]**

Returns the latest repository-level summary and its status. Static Scan results remain available when the summary is Pending or Failed.

---

## Scan States

Implemented (`scan_jobs.status`, lowercase):

- queued
- running
- completed
- failed
- cancelled

Planned document originally used capitalized state names (`Pending`, `Running`, `Completed`, `Failed`, `Cancelled`) — the implemented values are lowercase and `queued` replaces `Pending`.

Invalid state transitions return `409 Conflict` (implemented as `SCAN_CONFLICT`).

---

## Errors

Implemented (`backend/internal/modules/scan/http.go`):

- `AUTH_REQUIRED` (401)
- `RESOURCE_NOT_FOUND` (404) — repository or scan not found
- `INSUFFICIENT_ACCESS` (403) — write access required to enqueue/cancel
- `INVALID_JSON` / `INVALID_INPUT` (400) — bad request body, wrong branch, or unsupported rule profile
- `INVALID_UPLOAD` (400) — malformed, unsafe, empty or oversized local source upload
- `SCAN_CONFLICT` (409) — scan already active, or no longer cancellable
- `SCAN_NOT_COMPLETED` (409) — findings requested before the scan finished
- `SCAN_STORE_UNAVAILABLE` (503) — storage/configuration problem
- `SCANNER_NOT_READY` (501) — returned by the legacy placeholder route when the scan queue is not enabled

Planned, not implemented:

- `REPOSITORY_ACCESS_DENIED`
- `BRANCH_NOT_FOUND`
- `SCAN_ALREADY_RUNNING` if policy prevents parallel scans
- `SOURCE_RETRIEVAL_FAILED`
- `SEMGREP_EXECUTION_FAILED`
