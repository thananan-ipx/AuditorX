# Durable scan pipeline and web workflow

Implemented 2026-08-28. Real Semgrep scanning, durable queue state, and authenticated
result APIs are implemented, with scan controls, history, polling and actual findings
on the web dashboard. No production/shared database was migrated or worker deployed.

## What works

- A writer enqueues a scan of a repository's registered branch. One queued/running
  job per repository is enforced by a unique partial index, including concurrent requests.
- The worker claims a job with `FOR UPDATE SKIP LOCKED`, commits the claim, and releases
  the DB connection before doing expensive work. Each attempt has a random lease token.
- A 3-minute lease outlasts the 2-minute job timeout. An expired lease is reclaimable;
  after 3 attempts it becomes `failed / RETRY_EXHAUSTED`. A shutdown leaves the lease
  for recovery. Normal source/scanner errors become terminal failures; users can enqueue again.
- A cancelled/expired/reclaimed job cannot publish results. Findings and completed status
  are committed in one transaction; a failed insert rolls back the entire publication.
- Membership is checked at enqueue/read/cancel, at claim, and again before publication.
  Owners/editors can enqueue or cancel. Viewers can read, but not write. Revoked queued
  jobs fail with `ACCESS_REVOKED`; lease tokens are not exposed to API users.
- Public GitHub source retrieval resolves a branch to an immutable commit SHA, then fetches
  that SHA's ZIP from codeload.github.com. Requests use fixed GitHub hosts, no credentials,
  no configured HTTP proxy, and reject redirects. Private repositories and renamed-repo
  redirects are intentionally unsupported in this slice.
- Archives are bounded to 20 MiB compressed, 20 MiB extracted supported source, 2,000 entries,
  1,000 supported files and 1 MiB per supported file. Unsafe paths, Windows reserved names,
  duplicate case-insensitive paths, multiple roots and symlinks are rejected.
- Only `.py`, `.js`, `.ts`, `.go` regular files are extracted. Hidden directories, vendor,
  node_modules and repository configuration are excluded. No clone hooks, dependency installs,
  build scripts, repository-supplied rules, autofix or source execution are used.
- Semgrep CE **1.175.0** runs with the embedded **baseline-v1** ruleset: Python/JS/TS dynamic
  eval and Go disabled TLS verification. These three initial rules are not a comprehensive
  security audit. Metrics/version checks are disabled; subprocess credentials and user config
  are not inherited. Config/cache/log output uses a fresh temporary directory.
- Results include rule, severity, file, lines, message and a deterministic location-based
  fingerprint. Source snippets are not persisted. More than 1,000 findings, parser errors,
  unknown rules or engine versions fail closed. The fingerprint is not yet a cross-scan
  issue identity when source lines move.

## Opt-in configuration

1. Review `20260828102015_durable_scan_jobs.sql` after the repository membership migration.
   Test it on a disposable full Supabase stack and run advisors before promoting it.
2. Provision a dedicated least-privileged worker login that may `SET ROLE auditorx_scan_worker`.
   The migration creates a NOLOGIN/NOBYPASSRLS role with explicit table grants and policies;
   it does not create credentials or grant this role to the API login or client roles.
   Do not use the admin connection from the test harness as a production worker credential.
3. Set API `REPOSITORY_STORAGE=postgres` and `SCAN_QUEUE_ENABLED=true` after the migration
   and worker are ready. The default remains false. There is no automatic migration.
4. Install the pinned scanner in a dedicated environment:

```powershell
python -m venv tools/scanner-env
./tools/scanner-env/Scripts/python.exe -m pip install -r tools/scanner-requirements.txt
```

5. Configure the worker process with `SCAN_WORKER_DATABASE_URL` and an absolute
   `SEMGREP_EXECUTABLE` path, then run `go run ./cmd/scan-worker` from `backend`.
   The worker deliberately does not read `.env`, API auth credentials or `DATABASE_URL`.
   Run it under a dedicated OS account/container with resource limits and restricted network
   access. Process-tree cancellation is implemented for Windows and Linux/macOS, but this
   process wrapper is **not an OS security sandbox**. Do not expose it as a public scanning
   service before production isolation, rate limits and workload quotas are added and tested.

The API publishes `scan_queue: true` when queue endpoints are enabled. The old
`scan_execution` flag remains false for compatibility; the web workflow uses `scan_queue`
in postgres mode. Neither flag is a live worker-health signal. Configure/run the worker separately.

## Local Supabase environment

The repository now includes `supabase/config.toml` and pins Supabase CLI **2.116.0**
as a dev dependency in `tools/database-tests`. It uses the existing migrations only;
it is not linked to a cloud project. Docker Desktop **4.88.1** was used for the verified
Windows setup. Install dependencies, then use the pinned CLI from the repository root:

For normal interactive testing, one command starts Docker Desktop when needed, local
Supabase, the API, scan worker and frontend. It prints the app/Studio/Mailpit URLs and
keeps running until `Ctrl+C`; local credentials stay in child-process environments and
logs go under ignored `.local/logs/`:

```powershell
.\scripts\dev-local.ps1
```

Use `.\scripts\dev-local.ps1 -SmokeTest` to start every layer, check API/frontend readiness,
then stop automatically. By default the script stops only the Supabase instance it started
and preserves its database backup. `-KeepSupabase` leaves that instance running.

Supabase uses the `auditorx-supabase-local` Docker network configured for `127.0.0.1`.
Some Docker Desktop versions still publish those ports to all interfaces; on those hosts the
script asks for confirmation before startup. On a trusted network, pass `-AllowLanExposure`
to skip that prompt (including when using `-SmokeTest`). Never use this flag on public Wi-Fi.

At startup the script provisions a randomly named, dedicated `NOINHERIT` worker login with
membership only in `auditorx_scan_worker` and an in-memory password. It removes that temporary
login on shutdown. The API database login is not granted the worker role.

The lower-level commands remain available for database-only work:

```powershell
npm --prefix tools/database-tests ci
$supabase = ".\tools\database-tests\node_modules\.bin\supabase.cmd"
& $supabase start
& $supabase db reset --local --no-seed
& $supabase db lint --local --schema public --level warning --fail-on error
& $supabase db advisors --local --type all --level warn --fail-on error
& $supabase stop --project-id auditor-x
```

`db reset --local` destroys and recreates **only the local** database. Never substitute
`--linked`. The generated local Auth redirect is `http://localhost:3000`. Analytics is
disabled because its Vector log collector could not reach Docker Desktop's engine from
the custom network on this Windows host; Auth, database, REST, Realtime, Storage and Studio
remain available. Docker Desktop currently publishes CLI-managed ports as `0.0.0.0` even
when a bridge network requests a `127.0.0.1` default binding. Use the stack only on a trusted
network, or stop it when not testing, until host binding is enforced outside the CLI.
The verified stack was stopped with its local database backup preserved after testing.

The verified clean reset applied both migrations, database lint and security/performance
advisors reported no issues, all four application tables had enabled/forced RLS, and
`auditorx_scan_worker` remained `NOLOGIN`/`NOBYPASSRLS`. No cloud project was linked or changed.

## API

All routes require the existing verified session and current repository membership.

| Request | Result |
| --- | --- |
| `POST /api/v1/repositories/{repo}/scans` | `202`, persisted job and Location; body `{ "branch": "main", "rule_profile": "recommended" }` or `{}` for registered branch |
| `GET /api/v1/repositories/{repo}/scans` | Latest 20 jobs, newest first; no full-history pagination yet |
| `GET /api/v1/repositories/{repo}/scans/{scan}` | Poll status: queued/running/completed/failed/cancelled |
| `GET /api/v1/repositories/{repo}/scans/{scan}/findings` | Completed scan findings; otherwise `409 SCAN_NOT_COMPLETED` |
| `POST /api/v1/repositories/{repo}/scans/{scan}/cancel` | Cancel an active job; `409` when no longer cancellable |

Cancellation immediately fences result publication; an already running analyzer may continue
until it returns or reaches its timeout. Raw scanner output and database errors are never returned
by the HTTP API. An enqueue response confirms durable acceptance, not worker health or completion.
The existing dashboard and `/api/v1/issues` still use the earlier placeholder contract in postgres
mode; the web dashboard now uses scan-specific endpoints for real results when the queue is enabled.

## Web workflow

After the opt-in setup above, sign in and choose a repository at `/repositories`, or open
`/dashboard?repository={id}`. Owners/editors can start a scan of the registered branch and
cancel a selected queued/running scan. Viewers can inspect history and findings only.
The server remains authoritative for every action; capability and role hints are not authorization.

- History shows the latest 20 scans. Select an entry to inspect its status, branch, commit,
  rule/scanner versions, timestamps and completed findings. No full-history pagination yet.
- Status refreshes every 3 seconds **after** the prior read finishes, while any listed/selected
  job is active. Viewing an older completed scan does not stop tracking a newer active job.
  Terminal-only history stops polling; Refresh discovers work started elsewhere afterward.
- Findings are requested only for completed scans. Severity and text filters operate on the
  returned findings, with 50 rows per page and counts for the entire selected scan (at most 1,000).
  Zero matches is distinct from a scan failure and is not proof of comprehensive security.
- Switching scans aborts/invalidates older requests and clears the previous findings. Leaving
  the repository stops polling and invalidates outstanding reads/action responses. Aborting
  a browser request does not cancel an accepted server job; use Cancel scan for that.
- Duplicate action clicks are blocked. A `409 SCAN_CONFLICT` reloads the current server state.
  An unconfirmed network/action error offers a **read-only** retry, never an automatic POST retry.
- Read failures hide previously loaded scan data and pause polling until manual retry.
  Expired sessions offer sign-in with the repository return URL. Revoked access never becomes
  a successful empty findings list. A queued job is not shown as proof of worker availability.
- Prototype mode keeps its labeled sample dashboard and simulated scan. Queue-disabled
  postgres mode explains the unavailable queue without inventing results. Real scan mode
  does not render the prototype quality score, AI assessment or priority predictions.

## Repeatable verification

```powershell
./scripts/verify.ps1
./scripts/verify-scanner.ps1 -SemgrepExecutable ./tools/scanner-env/Scripts/semgrep.exe
```

The scanner check runs the real executable on deliberately unsafe **static** fixture code.
The database harness applies both actual migrations to a new in-memory PGlite engine, then tests:
API enqueue, persistence across reconnect, exclusive claims, expired-lease reclaim, stale-token
rejection, cancellation, atomic rollback, retry exhaustion, revoked membership and HTTP finding
retrieval. The fixture source adapter uses a synthetic commit ID and the real safe ZIP extractor;
it never fetches a real user's repository. With `AUDITORX_TEST_SEMGREP` set, the integration test
runs real Semgrep, otherwise it uses a deterministic analyzer for orchestration coverage.
CI installs Semgrep and requires the real pipeline test in its database job.

PGlite multiplexes one server session, so Go package tests run serially and use unnamed pgx queries.
It cannot prove multi-session concurrent locking, production pooler/TLS behavior, crash recovery of
the database itself, full Supabase Auth or OS isolation. Full-stack staging/advisor checks and a
live public-GitHub retrieval test remain required; no external repository was downloaded in this run.

Frontend service/controller/markup tests cover capability routing, scoped endpoints, polling,
terminal states, history races, duplicate actions, conflicts, read-only retries, permission errors,
unmount cleanup, filter logic and escaped finding text. These checks do not replace a signed-in
browser end-to-end test against a disposable full Supabase/API/worker environment.

Next: issue lifecycle and repeat-scan matching, define persisted quality scoring, extend
rules/coverage, add production isolation and quotas, and verify with full Postgres concurrency.

References used: [Postgres row locking](https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE),
[Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[explicit grants change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically),
[Semgrep CLI](https://docs.semgrep.dev/cli-reference).
