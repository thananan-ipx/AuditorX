# AuditorX development baseline

Snapshot: 2026-08-28. This records the runnable implementation, not all planned SRS features.

## Current scope

- Go API with user/auth and audit modules; audit data remains in memory.
- Next.js feature folders with `/login`, `/repositories` and `/dashboard?repository={id}` routes.
- Repository selection, creation and no-scan/error states are connected to the API; demo mode is clearly labeled.
- Simulating a scan returns a prototype `Pending` response; it does not run Semgrep or persist a job.
  A separate `SCAN_QUEUE_ENABLED=true` opt-in now provides durable scan APIs and a standalone
  Semgrep worker. The web dashboard now supports start/cancel, status polling, history and real findings.
- Dashboard AI summaries and priority predictions are sample data, not live model output.
- Repository metadata persistence and membership enforcement are implemented behind `REPOSITORY_STORAGE=postgres`;
  see [activation and test details](repository-persistence.md). The first real scan backend is implemented;
  see [pipeline setup and limits](scan-pipeline.md). Persisted quality scoring, reports and ML evaluation remain pending.

## Verification

Requirements: Node.js 24, npm 11, Go 1.25.x and PowerShell (7+ on Linux).
Install dependencies with `npm ci` in both `frontend/` and `tools/database-tests/`, then run from the repository root:

```powershell
./scripts/verify.ps1
./scripts/verify.ps1 -Target backend
./scripts/verify.ps1 -Target frontend
./scripts/verify.ps1 -Target database
```

The script stops on the first failed check and restores the caller's working directory.
It checks Go formatting without rewriting files, runs `go vet`, uncached tests and `go build`,
then runs isolated migration/RLS/Go adapter tests and frontend lint, route-type generation,
TypeScript checks, unit tests and a production build.
Use `-Race` when the Go race detector and a supported C compiler are available; CI enables it on Linux.

Unit tests mock external HTTP services. CI needs neither application secrets nor a live database/API.
Local Next.js commands can still load your existing `.env.local`; never commit that file.
The shared API client has regression tests for response envelopes, custom headers, empty responses,
HTTP errors, invalid JSON and network failures.

### Local verification result (2026-08-28)

`./scripts/verify.ps1` passed on Windows with Node 24.14.0, npm 11.17.0 and Go 1.25.5:
Go format/vet/tests/build, 17 isolated database/harness tests, frontend lint/typecheck,
all 34 frontend API/workflow/markup tests and production build.
The workflow YAML was also parsed and its triggers, jobs and read-only permissions checked.
The GitHub-hosted workflow, Linux race-detector run and Docker image builds have not been executed locally.

After the web scan increment, `npm run check` passed again: lint, route/type generation,
all **65** frontend service/controller/markup tests and production build. The local login
preview returned HTTP 200. No signed-in browser interaction or full-stack browser test was run;
the backend/database figures above are from the preceding backend increment, not a new run.

On 2026-08-29, a separate full local Supabase stack was initialized with Docker Desktop
4.88.1 and pinned CLI 2.116.0. A clean local reset replayed both migrations; database lint,
security/performance advisors, forced-RLS/worker-role queries, the 17-test isolated database
suite and the real Semgrep fixture/worker pipeline all passed. The CLI was never logged in or
linked to a cloud project. See [local setup and host-binding limitation](scan-pipeline.md#local-supabase-environment).

## CI and baseline commit

`.github/workflows/ci.yml` defines separate backend, database and frontend jobs on pushes, pull requests
and manual dispatch. The workflow has read-only repository permissions and no deployment steps.
It will run on GitHub only after the files are committed and pushed. Required branch checks
must be configured separately by a repository administrator.

Review all existing untracked backend/frontend files before preparing the baseline commit;
do not blindly stage the entire workspace. Include lockfiles and `.env.example`, exclude real
environment files, caches, build output and credentials. This work does not automatically
commit or publish the user's existing changes.

The action configuration follows the official [checkout](https://github.com/actions/checkout),
[setup-go](https://github.com/actions/setup-go) and [setup-node](https://github.com/actions/setup-node) documentation.

## Next implementation slices

1. **Persistence and access boundaries:** agree on the user/profile mapping and repository membership model;
   implement versioned migrations, ownership checks and cross-user access tests on a disposable local database.
   Exit: data survives restart and unauthorized access is rejected. Do not apply migrations to a shared project implicitly.
2. **Repository management:** implement create/list/detail/update and branch validation.
   Exit: two test users cannot access each other's repositories.
3. **Real scan vertical slice:** isolated source retrieval, versioned Semgrep rules, normalized findings,
   durable job states, timeout/cancellation and result persistence.
   Exit: a fixture repository produces repeatable findings and a restart does not lose accepted jobs.
4. **Issue workflow and dashboard:** issue detail, severity filters, status/history, repeat-scan matching,
   deterministic score and empty/loading/error states.
5. **AI and report:** validated explanations tied to actual findings, failure fallback, usage limits and report export.
6. **Research extensions:** human-reviewed labels, leakage-safe priority evaluation, then MCP prototype.

The first four slices should work without AI. Use acceptance criteria, not the old estimated dates,
to decide when a slice is ready.

Progress: slices 1–2 now include migration/RLS, create/list/detail, ownership isolation tests,
branch validation, and frontend creation/selection. Update/delete and full Supabase staging
verification remain pending. Slice 3 now includes durable queue/leases, worker, public GitHub source
adapter, 14 pinned `baseline-v2` Semgrep rules (plus historical `baseline-v1` execution) and scan result APIs. The real local fixture flow passed end-to-end
through worker/database/HTTP; production isolation, live GitHub retrieval and full Postgres concurrency
tests remain pending. Web scan controls, polling, history and filtered findings are now implemented.
The next product slice is issue lifecycle/repeat-scan matching and deterministic persisted scoring.
No shared database or deployment was modified during local verification; signed-in browser
end-to-end validation against a disposable full-stack environment remains a separate check.
