# Local PostgreSQL in Docker

AuditorX uses PostgreSQL 17 for accounts, sessions, repositories and scan storage.
The API no longer requires a Supabase project, key, connection or network service.

## Start and inspect

```powershell
docker compose up -d --build
docker compose ps
docker compose run --rm migrate status
```

Open `http://localhost:3000`. PostgreSQL is published only on `127.0.0.1:5433`,
database `auditorx`. Compose waits for PostgreSQL, applies pending Goose migrations,
then starts the API; the frontend waits for the API health check. PostgreSQL and
the API restart automatically after a transient failure. The stack also starts a
dedicated Semgrep scan worker and enables the scan queue by default. On a repository
dashboard, **Scan code from this computer → Choose folder / Choose ZIP** uploads
local source without connecting GitHub. Add/select a repository workspace first.

If another project uses ports 3000/8080, set `AUDITORX_WEB_PORT` and
`AUDITORX_API_PORT` in root `.env` (for example 3001/8081), and set `FRONTEND_URL`
to the corresponding web origin if overriding it explicitly. Rebuild the web
image after changing the API port because its public API URL is a build argument.

```powershell
pwsh ./scripts/dev-local.ps1 -SmokeTest
pwsh ./scripts/database-local.ps1 start
pwsh ./scripts/database-local.ps1 status
```

## Persistence and migrations

The `postgres_data` volume preserves data through restarts and `docker compose down`.
Do not remove that volume to update a schema. Goose v3.28.0 (also used by ERP) is
embedded in the migration executable, using Go 1.26 and a PostgreSQL advisory lock.

Add schema changes as new numbered `backend/migrations/*.sql` files with
`-- +goose Up` and `-- +goose Down`. Rebuild after adding a file:

```powershell
docker compose build migrate
docker compose run --rm migrate up
# Repeatable: only pending versions are applied.
docker compose run --rm migrate status
# Stop services and keep data.
docker compose down
```

`docker compose run --rm migrate down` rolls back one migration and can remove
accounts or data. It is not a restart command. Constraint rollbacks may reject
incompatible rows and leave the schema unchanged via transaction rollback.

Migration 00006 adds local passwords and sessions without deleting existing UUIDs,
repositories or memberships. The historical `auth` schema and `auth.uid()` helper
remain as internal PostgreSQL names used by the existing RLS policies. They do not
contact Supabase or require JWTs. Original SQL under `supabase/migrations` is kept
only as frozen baseline history, with a parity test; it is not a running service.

## Local credentials and roles

Development defaults:

| Role | Username | Password |
| --- | --- | --- |
| Database administrator (migrations) | `postgres` | `auditorx-local-admin` |
| API database login | `auditorx_api` | `auditorx-local-api` |
| Scan worker database login | `auditorx_worker` | `auditorx-local-worker` |

These are database credentials; website users create separate accounts on the Login
page. See [Local authentication](local-auth.md).

Override `AUDITORX_DB_PASSWORD`, `AUDITORX_DB_APP_PASSWORD`, `AUDITORX_DB_WORKER_PASSWORD` and `AUDITORX_DB_PORT` in
the root `.env` before creating a volume. Use URL-safe password values because
Compose also embeds them in connection URLs. Changing the administrator or API
password in `.env` after initialization does not rotate those existing PostgreSQL
passwords. The worker setup service applies its configured password each time it runs.

Only the migrator uses the administrator role. The API is `NOSUPERUSER`,
`NOBYPASSRLS` and `NOINHERIT`; repository operations explicitly assume
`authenticated` with a transaction-local verified user ID. Auth credentials and
sessions remain in the private `auth` schema and are unavailable to that role.
Compose's `worker-setup` provisions the worker login after migrations, including
on existing database volumes. That login can assume only `auditorx_scan_worker`;
the API login is never granted that role. The worker runs as an unprivileged user
with a read-only root filesystem, temporary source storage, resource limits and
no host source-folder mount. `SCAN_QUEUE_ENABLED=false` in root `.env` can disable
scan endpoints explicitly. Direct API runs still default to a disabled queue.

## Verification

Verified 2026-11-01 on the running Docker stack: signed-in browser uploads of a
local folder and a ZIP both completed with Semgrep 1.175.0 / baseline-v2 and
reported the expected `auditorx.python.security.dynamic-eval` finding. The upload
buttons were checked on desktop and mobile. Linux scanner subprocesses include
fixed `/usr/bin` and `/bin` paths so Semgrep can invoke `uname`, without inheriting
the host or uploaded project's PATH. API and worker logins are separate,
non-superuser/non-BYPASSRLS roles; only the worker has scan-worker membership.

```powershell
# Uses a disposable PostgreSQL container and separate network, never the app volume.
pwsh ./scripts/test-goose.ps1
# RLS and Go adapter tests use an in-memory PostgreSQL-compatible engine.
cd tools/database-tests
npm ci
npm test
```

Database volumes can contain password hashes, session hashes and uploaded code.
Keep dumps, `.env` files and `.local` credentials outside Git. Back up local data
before moving to another machine; a new volume recreates the schema, not the users.
