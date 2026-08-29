# Repository persistence and access boundaries

Implemented 2026-08-28. Repository persistence and the selection/creation UI are implemented;
the optional first scan worker and persisted scan results are covered in [scan pipeline](scan-pipeline.md).

## Activation is explicit

`REPOSITORY_STORAGE=prototype` remains the default so the existing demo and configured
shared database are not silently changed. `DATABASE_URL` alone does not enable persisted repositories.

To enable the new backend after review:

1. Use a disposable Supabase test project or local Supabase stack. Review
   `supabase/migrations/20260828073925_repository_membership.sql` and check for conflicting existing tables.
2. Apply the migration through your normal approved migration workflow, then run the local
   Supabase database tests/advisors and review the result before promoting it to a shared environment.
   This change does not apply migrations automatically, link a project, or change credentials.
3. Set `REPOSITORY_STORAGE=postgres` and the intended `DATABASE_URL` on the backend; restart it.
   Missing `DATABASE_URL` or an invalid mode fails configuration validation.
4. Restart both API and frontend with this revision. Sign in normally and open `/repositories`.
   The page discovers backend mode from `/api/v1/capabilities`; adding a repository is offered
   only in postgres mode. Open any listed repository to visit `/dashboard?repository={id}`.

The configured database login must be allowed to `SET ROLE authenticated`. Application repository
queries explicitly drop to that role and set the verified user's identity within each transaction.
Do not grant BYPASSRLS to the application role. A deployment-specific login/role grant must be
reviewed by the database administrator; this migration does not create credentials or grant role membership.

## Implemented API in postgres mode

| Request | Result |
| --- | --- |
| `GET /api/v1/capabilities` | Authenticated mode/feature flags; no-store, no connection details; available in both modes |
| `POST /api/v1/repositories` | Creates repository and owner membership atomically; `201` plus `Location` |
| `GET /api/v1/repositories?page=1&page_size=20` | Only the caller's memberships; bounded pagination; `data` is always an array |
| `GET /api/v1/repositories/{id}` | Repository details and caller access level; missing/unauthorized IDs both return `404` |
| `GET /api/v1/repositories/{id}/dashboard` | Legacy placeholder: checks membership, then `409 SCAN_REQUIRED`; use scan-specific endpoints for real results |
| `POST /api/v1/repositories/{id}/scans` | Checks membership/write access, then `501 SCANNER_NOT_READY`; no fake accepted job |
| `GET /api/v1/issues?repository_id={id}` | Checks membership and returns an empty array; never returns demo findings |

Creation body:

```json
{
  "repository_url": "https://github.com/IProgressX/auditor-x",
  "branch": "main"
}
```

Only HTTPS GitHub repository URLs are accepted. Credentials, alternate hosts/ports, branch/file
URLs, query strings and encoded path tricks are rejected. URLs are canonicalized to lowercase,
without `.git` or a trailing slash. Branch defaults to `main` and accepts a conservative safe subset
of Git branch names. This stores metadata only: it does not contact GitHub, confirm repository existence,
verify upstream permissions, clone code, or choose the actual default branch.

`created_by`, membership and access level cannot be supplied in the creation body. The handler
rejects unknown fields, multiple JSON documents and bodies over 8 KiB. Duplicate URL registration
by one creator returns `409`; separate creators may independently register the same upstream URL.
List metadata contains `page`, `page_size` and the current page's `count`, not an invented total.

## Security model

- Ownership references the existing `auth.users(id)`; there is no duplicated password/user table.
- Auth passes the provider-verified user ID to request context, ignoring the User object in the cookie.
- RLS is enabled and forced on both tables. Explicit grants give `authenticated` only SELECT/INSERT;
  `anon` and PUBLIC get none. UPDATE/DELETE/invites/transfers are not exposed in this slice.
- Repository reads permit the creator or a member. Membership reads expose only the caller's own row.
- `repository_owner_id` on membership is constrained by a composite FK to `(repositories.id, created_by)`.
  This proves owner self-enrollment without recursive policies or SECURITY DEFINER functions.
- The Go adapter additionally scopes list/detail queries to the verified member ID. It runs each operation
  in a short transaction with `SET LOCAL ROLE authenticated` and transaction-local JWT claims.
  Commit/rollback clears identity before the connection returns to the pool.
- SQL errors are not returned to the browser. Storage/schema failures produce a sanitized `503`;
  the system never falls back to demo data in postgres mode.

This follows Supabase's [RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security)
and [explicit-grant change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically).

## Repeatable isolated verification

Install dependencies once:

```powershell
npm --prefix tools/database-tests ci
npm --prefix frontend ci
```

Then run from the repository root:

```powershell
./scripts/verify.ps1 -Target database
./scripts/verify.ps1
```

The database harness uses [PGlite](https://pglite.dev/docs/) with a minimal Auth fixture, applies the actual
migration to a new in-memory database, and runs SQL allow/deny tests. A loopback-only temporary socket
also runs the real Go store through pgx: create/list/detail, isolation, duplicate handling, membership
revocation, reconnect persistence, transaction identity cleanup and injected partial-write rollback.
Only the child test process receives `AUDITORX_TEST_DATABASE_URL`; application `.env` files and
`DATABASE_URL` are not used to select a test target. Go checks the loopback host and a harness marker
before writing. The database and socket are closed on completion.

PGlite uses one underlying server session, so the harness uses unnamed extended-protocol queries
instead of pgx's named statement cache. It does not validate production pooler behavior, TLS,
full Supabase Auth/GoTrue, multiple Postgres sessions or crash/recovery durability. Full-stack
Supabase advisors and staging verification remain required before activating this in a shared environment.

## Frontend workflow

- `/repositories` lists accessible repositories in pages of 20. The final full page may offer
  Next once more because the API deliberately has no total; an empty page offers Previous.
  Refresh list rechecks access and storage mode without relying on cached membership.
- The create form submits only URL/branch, disables duplicate submissions, preserves failed inputs,
  and opens the created repository's dashboard. Blank branch defaults to `main`. Server validation
  remains authoritative; registration does not verify upstream access or repository/branch existence.
- `/dashboard?repository={id}` supports bookmarks and reloads. Postgres deep links load the selected
  detail directly, including IDs outside page one. Missing or inaccessible explicit IDs never fall
  back to another repository. Without an ID, the first accessible repository is selected.
- Without the queue, `409 SCAN_REQUIRED` renders a queue-unavailable state with no sample score/findings. Expired
  sessions offer sign-in with a return URL; permission, not-found, duplicate, and service failures
  have separate messages. Loading requests are canceled when the page/selection changes.
- Prototype mode is visibly labeled sample data, creation is hidden, and Simulate scan explains
  that no code was scanned. In postgres mode, `scan_queue: true` enables the real scan workflow;
  start/cancel, active polling, history and findings use the scan-specific APIs. See
  [web scan behavior](scan-pipeline.md#web-workflow) for restrictions and retry semantics.
- Overview/Repositories navigation is functional. Planned navigation is disabled and labeled Soon;
  fabricated account, usage and GitHub-connection claims were removed from the shared layout.

Capabilities response:

```json
{"data":{"repository_storage":"postgres","repository_creation":true,"scan_execution":false,"scan_queue":false}}
```

`scan_execution` remains false for compatibility. `scan_queue` indicates enabled queue routes in
postgres mode, not worker health; older APIs omitting it leave scan controls disabled. UI capability flags
are only presentation hints; all membership and write authorization remain enforced by the API/RLS.

## Verification and next slice

Verification on 2026-08-28: the full `scripts/verify.ps1` passed, including Go checks,
12 isolated database/harness tests, 34 frontend unit/markup tests, lint, typecheck and production build.
The three-job workflow YAML also passed parsing and configuration checks. No shared database
migration, full Supabase stack/advisor run, GitHub-hosted CI run, commit, push or deployment was performed.

The UI increment adds frontend service/markup coverage for mode discovery, create payloads, pagination,
explicit selection, no-scan state, expired sessions, error handling and abort-signal propagation. It
does not substitute for a signed-in end-to-end check against a disposable full Supabase stack.

The optional durable scan/job backend and its web scan controls, real results and polling are now
implemented. Issue lifecycle and persisted quality scoring remain next. Activation still requires the
reviewed migration/role workflow above; implementing the UI does not activate postgres mode itself.
