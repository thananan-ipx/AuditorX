# Repository API

> Related: `UC-002`, `UC-010`, `FR-REP-*`

**Implementation status (as of 2026-09-12):** Only `GET`, `POST`, and `GET /{repository_id}` are implemented (`backend/internal/modules/project/delivery/http/handler.go`), and only when the backend runs in `postgres` repository-storage mode (see `GET /api/v1/capabilities` in `api-overview.md`/`evaluation.md`). There is **no `PATCH`, no `DELETE`, and no `/branches` endpoint** — repositories cannot be updated, deleted, or have their branches queried today. `POST` accepts only `repository_url` and an optional `branch`; there is no `provider` or `criticality` field anywhere (no such column exists — see `docs/05-database/data-dictionary.md` §4). `GET /api/v1/repositories` does not support a `search` query parameter. Corrections are inlined below.

## GET /api/v1/repositories **(implemented)**

Lists repositories the current user is a member of, paginated (`page` defaults 1, `page_size` defaults 20, max 100). There is no `search` query parameter — only `page` and `page_size` are read.

---

## POST /api/v1/repositories **(implemented)**

Registers a repository. Request accepts only `repository_url` and optional `branch` — no `provider` or `criticality` field is accepted (unknown fields are rejected with `400 INVALID_JSON`). The URL must be an `https://github.com/{owner}/{repo}` address with no credentials, query, or fragment; branch defaults to `main` when omitted.

Request (as implemented):

```json
{
  "repository_url": "https://github.com/example/repo",
  "branch": "main"
}
```

The planned request shape below, including `provider` and `criticality`, is **not implemented**:

```json
{
  "provider": "github",
  "repository_url": "https://github.com/example/repo",
  "default_branch": "main",
  "criticality": "Medium"
}
```

Backend does not validate provider/GitHub access before persistence — it only validates the URL's shape and syntax, and rejects if the caller already registered that URL (`409 REPOSITORY_EXISTS`).

Response: `201 Created`, with a `Location` header.

---

## GET /api/v1/repositories/{repository_id} **(implemented)**

Returns repository metadata (`id`, `name`, `owner`, `repository_url`, `branch`, `status`, `created_by`, `access_level`, `created_at` — see `docs/05-database/data-dictionary.md` §4).

---

## PATCH /api/v1/repositories/{repository_id} — **[Planned; not implemented]**

Updates allowed fields such as default branch and controlled Repository Criticality. Backend records criticality changes for Priority traceability. No such route is registered, and there is no `criticality` column to update.

---

## DELETE /api/v1/repositories/{repository_id} — **[Planned; not implemented]**

Deletes or marks repository deleted according to persistence policy. No such route is registered.

---

## GET /api/v1/repositories/{repository_id}/branches — **[Planned; not implemented]**

Returns accessible branch information from provider. No such route is registered; a repository has exactly one registered branch today.

---

## GET /api/v1/repositories/{repository_id}/scans **(implemented — see `scans.md`)**

Returns scan history, but only when the scan queue is enabled (`postgres` mode + `scan_queue` capability). Returns the most recent 20 scans, newest first — not full pagination. When the scan queue is not enabled, this path is not registered at all. See `scans.md` for the full contract, including `GET .../scans/{scan_id}` and `GET .../scans/{scan_id}/findings`.

Related:
- `FR-REP-008`
- `FR-SCAN-009`
- `UC-010`

---

## Authorization

All operations require repository-level authorization except initial add, which requires validation against the external provider. As implemented, "validation against the external provider" is limited to syntactic URL/branch validation — the backend does not call the GitHub API to confirm the repository exists or is accessible.
