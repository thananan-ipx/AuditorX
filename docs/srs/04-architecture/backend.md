# Backend Architecture

> **Project:** AuditorX  
> **Technology:** Go  
> **Status:** Draft

---

## 0. Implementation Status (as of 2026-09-12)

The sections below (layers, project structure, core services, interfaces) describe the
**target/planned** backend design for the full SRS scope. The code currently in
`backend/` implements a smaller slice of this:

- Routing uses the Go 1.22+ standard library `net/http.ServeMux` with method+path patterns
  (e.g. `GET /api/v1/...`), wrapped by custom middleware in `internal/shared/middleware`.
  There is no third-party web framework (no chi/gin/echo).
- Implemented modules live under `backend/internal/modules/`: `user` (Supabase-Auth-backed
  authentication and cookie session middleware), `project` (repository create/get/list and
  membership only — no edit/delete yet), `scan` (scan job queue, worker claim, GitHub source
  fetch, Semgrep analyzer), and `audit` (a legacy "prototype" mode that serves hardcoded
  sample dashboard data). The `repository/`, `issue/`, `priority/`, `evaluation/`, `ai/`,
  `dashboard/`, `report/`, `mcp/`, `platform/`, and separate top-level `auth/` directories in
  the structure below do not exist yet — Auth lives inside `user`.
- Two runtime modes are selected by `REPOSITORY_STORAGE` (`backend/internal/config/config.go`):
  `prototype` (wires in the `audit` module) and `postgres` (wires in `project`, and `scan` when
  `SCAN_QUEUE_ENABLED=true`). `GET /api/v1/capabilities` reports `repository_storage`,
  `repository_creation`, `scan_execution` (always `false`, a legacy/unused flag), and
  `scan_queue`.
- The Priority/Evaluation and AI Analysis services described below are **not implemented** —
  see `priority-engine.md` and `ai-engine.md` for their planned-only status. The Issue,
  Dashboard and Report services below are likewise not implemented as separate services yet;
  the `audit` module's prototype dashboard is the only current "dashboard".
- The scan worker is a **separate OS process** (`cmd/scan-worker`), not a goroutine in the API
  process — see "7. Concurrency" below for the corrected model.

---

## 1. Purpose

Backend เป็นศูนย์กลางของ Business Logic, Authorization, Persistence และ External Integration ของ AuditorX

---

## 2. Suggested Layers

```text
HTTP Handler
    ↓
Application / Use Case
    ↓
Domain / Business Logic
    ↓
Repository / Integration Interfaces
    ↓
PostgreSQL / GitHub / Semgrep / AI
```

---

## 3. Suggested Project Structure

This is the **target** structure for the full SRS scope. The current, implemented structure
is:

```text
backend/
├── cmd/
│   ├── api/            # HTTP API process
│   └── scan-worker/    # separate worker process (own DB role, doesn't read .env)
├── internal/
│   ├── config/
│   ├── modules/
│   │   ├── user/       # Supabase-Auth-backed auth + session middleware
│   │   ├── project/    # repository create/get/list, membership
│   │   ├── scan/       # scan queue, worker claim, GitHub fetch, Semgrep analyzer
│   │   └── audit/      # legacy "prototype" hardcoded dashboard data
│   └── shared/         # database, health, logger, middleware, response
└── (migrations live in supabase/migrations at the repo root)
```

The originally suggested (still-planned) structure, adding the not-yet-built
Priority/Evaluation, AI, Dashboard, Report and MCP concerns as their own modules, is:

```text
backend/
├── cmd/
│   └── api/
├── internal/
│   ├── auth/
│   ├── user/
│   ├── repository/
│   ├── scan/
│   ├── issue/
│   ├── priority/
│   ├── evaluation/
│   ├── ai/
│   ├── dashboard/
│   ├── report/
│   ├── mcp/
│   ├── platform/
│   └── shared/
├── migrations/
└── tests/
```

---

## 4. Core Services

> Implemented today: Auth Service (in `user`), Repository Service (create/get/list + membership,
> in `project`), and Scan Service (in `scan`, minus AI-related steps). Issue, Priority, Model
> Evaluation, AI Analysis, Dashboard and Report services below are planned/not implemented; the
> `audit` module's static sample data stands in for Dashboard when in `prototype` mode.

### Auth Service
- Register
- Login
- Logout
- Session/token validation
- Password hashing

### User Service
- Role management
- Account status
- Repository access control

### Repository Service
- Add/edit/delete repository
- Validate access
- Branch/metadata retrieval

### Scan Service
- Create scan
- Run scan workflow
- Update scan status
- Normalize Semgrep findings
- Persist issues

### Issue Service
- Query issue
- Update status
- Add note
- Persist status history

### Priority Service
- Extract versioned features
- Load Active model through an adapter
- Persist Prediction and probabilities
- Apply versioned severity baseline on failure
- Accept authorized human-reviewed labels without mutating prior Predictions

### Model Evaluation Service
- Build repository-grouped dataset versions
- Run candidate and baseline evaluation offline
- Store reproducibility metadata and metrics
- Register/promote model versions through authorized workflow

### AI Analysis Service
- Build sanitized context
- Call AI provider
- Validate structured response
- Store AI analysis
- Retry failed AI analysis
- Explain a persisted Priority without generating or overwriting it

### Dashboard Service
- Aggregate scan and issue data
- Calculate summary metrics
- Serve trends and score

### Report Service
- Build report data
- Generate report artifact
- Store report metadata

---

## 5. Backend Interfaces

Recommended abstractions:

```text
PriorityPredictor
FeatureExtractor
PriorityBaseline
ModelRegistry
EvaluationRunner
RepositoryProvider
StaticAnalyzer
AIProvider
ReportGenerator
ScanRepository
IssueRepository
UserRepository
```

External systems should be called through adapters rather than directly from handlers.

---

## 6. Transaction Boundaries

Database transactions should be used where multiple related writes must succeed together, for example:

- Issue status + status history
- User role update + audit record
- Scan completion + summary update

Long-running external calls should not hold database transactions open unnecessarily.

---

## 7. Concurrency

Scan execution must be separated from normal request processing where practical.

Potential model:

```text
POST /scans
→ Create Pending Scan
→ Queue / Worker
→ Execute Scan
→ Persist Result
```

**Implemented today:** this decision has been made for the `postgres` + `SCAN_QUEUE_ENABLED`
mode. The worker is a **separate OS process** (`cmd/scan-worker`), not a goroutine inside the
API binary. It does not read `.env` and does not share the API's `DATABASE_URL`; it connects
with its own `SCAN_WORKER_DATABASE_URL` using a dedicated least-privileged Postgres role that
can `SET ROLE auditorx_scan_worker` (`NOLOGIN`/`NOBYPASSRLS`, provisioned by the migration).
Jobs are claimed with `FOR UPDATE SKIP LOCKED` plus a per-attempt lease token; a 3-minute lease
outlasts the 2-minute job timeout, with 3 retry attempts before `RETRY_EXHAUSTED`.

---

## 8. Validation

Backend validates:

- request schema
- role
- repository access
- scan state transition
- issue status transition
- external API response
- AI response schema

---

## 9. Observability

Backend should emit:

- structured application logs
- request ID / correlation ID
- scan ID
- user ID where safe
- integration error category
- processing duration

Never log secrets or full sensitive source code.

---

## 10. Traceability

| Backend Area | Use Cases |
|---|---|
| Auth | `UC-001` |
| Repository | `UC-002`, `UC-010` |
| Scan | `UC-003` |
| AI | `UC-004` |
| Dashboard | `UC-005` |
| Issue | `UC-006`, `UC-007` |
| Priority / Evaluation | `UC-006`, `UC-012` |
| Report | `UC-008` |
| User | `UC-009` |
| MCP | `UC-011` |
