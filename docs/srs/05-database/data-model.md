# Data Model

> **Project:** AuditorX  
> **Document:** Logical Data Model  
> **Status:** Draft

**Implementation status (as of 2026-09-12):** This document mixes the schema that is actually built with a larger target design. Only `Repository`, `RepositoryMember` and a durable `Scan`/`ScanFinding` pair (backed by the `scan_jobs` and `scan_findings` tables) exist in the codebase today (`supabase/migrations/20260828073925_repository_membership.sql`, `supabase/migrations/20260828102015_durable_scan_jobs.sql`). See §2.1 for the current schema as-built. `User`/`Role` are not a local table — identity is Supabase Auth's `auth.users`, referenced only by foreign key. Everything else in §2 (`Issue` as a persistent, stateful entity, `IssueStatusHistory`, `IssueNote`, `PriorityLabel`, `PriorityPrediction`, `PriorityDataset`, `PriorityModel`, `EvaluationRun`, `AIAnalysis`, `AIRepositorySummary`, `Report`, `AuditLog`) is planned/target design with no corresponding table yet. Sections below are annotated **[Implemented]** or **[Planned]** accordingly; content is retained as forward-looking scope for the project spec.

---

## 1. Purpose

เอกสารนี้กำหนด Logical Data Model ของ AuditorX เพื่อใช้เป็นฐานสำหรับ Database Schema, API DTO, Repository Layer และ Traceability

---

## 2. Core Entities

| Entity | Purpose | Status |
|---|---|---|
| User | ข้อมูลผู้ใช้งาน (Supabase Auth `auth.users`; no local profile table) | Implemented (Supabase-managed) |
| Role | บทบาทของผู้ใช้งาน (global roles) | Planned — today access is per-repository only, via `RepositoryMember.access_level` |
| Repository | Repository ที่ถูกนำเข้ามาวิเคราะห์ | Implemented |
| RepositoryMember | สิทธิ์ของผู้ใช้งานต่อ Repository | Implemented |
| Scan | การวิเคราะห์ Repository หนึ่งครั้ง | Implemented (as `scan_jobs`) |
| Issue | Finding ที่ถูก Normalize เป็นปัญหาใน AuditorX (stateful, editable) | Planned — today findings are immutable rows in `scan_findings`, see §2.1 |
| IssueStatusHistory | ประวัติการเปลี่ยนสถานะ Issue | Planned |
| IssueNote | หมายเหตุของ Issue | Planned |
| PriorityLabel | Human-reviewed Ground Truth สำหรับ Issue Priority | Planned |
| PriorityPrediction | ผล Priority จาก supervised model หรือ baseline | Planned |
| PriorityDataset | Versioned manifest ของข้อมูลและ repository-grouped split | Planned |
| PriorityModel | Metadata และ artifact ของโมเดลแต่ละ version | Planned |
| EvaluationRun | ผลเปรียบเทียบ candidate model กับ baseline | Planned |
| AIAnalysis | ผลการวิเคราะห์จาก AI | Planned |
| AIRepositorySummary | ผลสรุประดับ Repository สำหรับ Scan หนึ่งครั้ง | Planned |
| Report | Metadata ของรายงาน | Planned |
| AuditLog | ประวัติเหตุการณ์สำคัญของระบบ | Planned |

### 2.1 Implemented Schema (current, from `supabase/migrations/*.sql`)

These four tables exist today, all with Row Level Security enabled and forced:

- **`repositories`**: `id`, `name`, `owner_name`, `repository_url` (must equal `https://github.com/{owner_name}/{name}`, lowercase), `default_branch` (default `main`), `status` (`Active`/`Archived`), `created_by` (FK `auth.users`), `created_at`. One row per `(created_by, repository_url)`. No `provider`, `external_repository_id`, `primary_language`, `criticality`, or `updated_at` columns.
- **`repository_members`**: composite PK `(repository_id, user_id)`, plus `repository_owner_id` (a composite FK back to `repositories(id, created_by)` used to avoid recursive RLS), `access_level` (`owner`/`editor`/`viewer`), `created_at`. No surrogate `id` column, no `updated_at`.
- **`scan_jobs`** (the implemented `Scan`): `id`, `repository_id`, `requested_by` (FK `auth.users`), `branch`, `rules_version` (currently fixed to `'baseline-v1'`), `status` (`queued`/`running`/`completed`/`failed`/`cancelled`), `attempts` (0–3), `lease_token`, `lease_expires_at`, `commit_sha` (40-char hex), `scanner_version`, `error_code`, `created_at`, `started_at`, `finished_at`. Only one `queued`/`running` job per repository is allowed (partial unique index). No `quality_score`, `score_version`, `score_calculated_at`, `severity_mapping_version`, or `error_message` columns.
- **`scan_findings`** (the implemented, immutable per-scan finding — not a persistent `Issue`): composite PK `(scan_id, fingerprint)`, `repository_id`, `fingerprint` (64-char hash), `rule_id`, `severity` (`High`/`Medium`/`Low` only), `file_path`, `start_line`, `end_line`, `message`. No `title`, `category`, `start_column`/`end_column`, `code_snippet`, `status`, `metadata`, `created_at`/`updated_at` — a finding has no lifecycle or notes; it is simply what a completed scan found.

---

## 3. Relationships

The diagram below is the **target/planned** relationship graph (see §5 for traceability). The currently implemented subset is only:

```text
User(auth.users) ──< RepositoryMember >── Repository ──< Scan(scan_jobs) ──< ScanFinding(scan_findings)
```

Full planned graph:

```text
User
 ├──< RepositoryMember >── Repository
 │                         └──< Scan
 │                              └──< Issue
 │                                   ├──< IssueStatusHistory
 │                                   ├──< IssueNote
 │                                   ├──< PriorityLabel
 │                                   ├──< PriorityPrediction >── PriorityModel
 │                                   └──< AIAnalysis
 │
 └──< AuditLog

Scan ├──< AIRepositorySummary
     └──< Report

PriorityDataset ├──< PriorityModel
                └──< EvaluationRun >── PriorityModel
```

---

## 4. Entity Definitions

### User — **[Implemented, but not as a local table]**

Represents an AuditorX user. There is no `public.users` table; identity is Supabase Auth's `auth.users`, and the application only carries `id` and `email` (see `backend/internal/modules/user/entity/user.go`). The fields below (`password_hash`, `first_name`, `last_name`, `role_id`, `account_status`, `updated_at`) are **planned** and not present anywhere in the codebase today.

Key fields (planned superset):

- id
- email
- password_hash
- first_name
- last_name
- role_id
- account_status
- created_at
- updated_at

### Role — **[Planned]**

Represents application-wide roles. Not implemented — the only access control that exists is per-repository (`RepositoryMember.access_level` = `owner`/`editor`/`viewer`).

Initial roles:

- Administrator
- Project Manager / Reviewer
- Developer

### Repository — **[Implemented]**

Represents a source repository registered in AuditorX. The actually-implemented columns are `id`, `name`, `owner_name`, `repository_url`, `default_branch`, `status`, `created_by`, `created_at` (see §2.1). `provider`, `external_repository_id`, `primary_language`, `criticality`, and `updated_at` below are **planned** and do not exist in the `repositories` table today.

Key fields:

- id
- name
- provider *(planned)*
- external_repository_id *(planned)*
- repository_url
- owner_name
- default_branch
- primary_language *(planned)*
- criticality *(planned)*
- status
- created_by
- created_at
- updated_at *(planned)*

### RepositoryMember — **[Implemented]**

Represents repository-level access. The implemented table (`repository_members`) uses a composite primary key `(repository_id, user_id)` — there is no surrogate `id` column — and also stores `repository_owner_id` (a composite FK to `repositories(id, created_by)` used to avoid a recursive RLS lookup). There is no `updated_at`.

Key fields:

- ~~id~~ *(no surrogate key; PK is `(repository_id, user_id)`)*
- repository_id
- repository_owner_id *(implemented, not originally listed)*
- user_id
- access_level
- created_at

### Scan — **[Implemented, as `scan_jobs`]**

Represents one analysis execution. The implemented table is `scan_jobs`; see §2.1 for its exact columns. It uses `requested_by` (not `started_by`) and `rules_version` (not `rule_profile`), and adds `attempts`, `lease_token`, `lease_expires_at`, and `scanner_version` for durable worker leasing — none of which appear below. `quality_score`, `score_version`, `score_calculated_at`, `severity_mapping_version`, and `error_message` are **planned** and not implemented.

Key fields (planned superset; see §2.1 for the real column list):

- id
- repository_id
- branch
- commit_sha
- rule_profile *(implemented as `rules_version`, fixed to `baseline-v1`)*
- severity_mapping_version *(planned)*
- status
- quality_score *(planned)*
- score_version *(planned)*
- score_calculated_at *(planned)*
- started_by *(implemented as `requested_by`)*
- started_at
- completed_at *(implemented as `finished_at`)*
- error_code
- error_message *(planned)*
- created_at

Implemented scan states (`scan_jobs.status` CHECK constraint):

```text
queued
running
completed
failed
cancelled
```

`cancelled` is implemented. Only a `queued` or `running` job may transition to `cancelled` (enforced by the `scan_jobs_cancel` RLS policy).

`quality_score` and its recalculation behavior described below are **planned** — no such column exists yet.

`quality_score` is deterministic under `score_version`. When an Issue status or other score input changes, the system recalculates the Scan score and updates `score_calculated_at`; it must not silently apply a different formula version.

### Issue — **[Planned; implemented today only as immutable `ScanFinding`]**

Represents a normalized, stateful static analysis finding with a lifecycle, notes, and history. **This does not exist.** What is implemented is `scan_findings`: an immutable record of what one completed scan found, with no `status`, no notes, and no history (see §2.1). The full stateful `Issue` entity below, including its status lifecycle, is planned/target design.

Key fields (planned):

- id
- scan_id
- rule_id
- title
- message
- category
- severity
- file_path
- start_line
- start_column
- end_line
- end_column
- code_snippet
- finding_fingerprint
- fingerprint_version
- status
- metadata
- created_at
- updated_at

Planned issue states (not implemented):

```text
Open
In Progress
Resolved
Accepted Risk
False Positive
```

---

## 4a. Planned / Not Yet Implemented Entities

Everything from `IssueStatusHistory` through `AuditLog` below has no corresponding table in the codebase. These remain part of the target design for future implementation.

### IssueStatusHistory

Key fields:

- id
- issue_id
- old_status
- new_status
- changed_by
- changed_at

### IssueNote

Key fields:

- id
- issue_id
- user_id
- note
- created_at
- updated_at

### PriorityLabel

Append-only human-reviewed Ground Truth. A corrected label creates a new record; it does not mutate a prior Prediction.

Key fields:

- id
- issue_id
- label
- labeled_by
- rationale
- guideline_version
- created_at

### PriorityPrediction

Key fields:

- id
- issue_id
- priority_model_id (nullable for baseline)
- priority
- priority_source
- predictor_version
- feature_schema_version
- feature_snapshot
- probabilities
- confidence
- fallback_reason
- created_at

`priority_source` is `model` or `baseline`. Predictions are immutable historical outputs.

### PriorityDataset

Key fields:

- id
- version
- labeling_guideline_version
- manifest_reference
- manifest_checksum
- split_seed
- split_manifest
- label_distribution
- created_at

The split manifest groups by Repository and is immutable for one dataset version.

### PriorityModel

Key fields:

- id
- version
- algorithm
- feature_schema_version
- training_dataset_id
- artifact_reference
- artifact_checksum
- hyperparameters
- validation_metrics
- test_metrics
- status
- created_at
- activated_at

Status values are `Candidate`, `Active` and `Retired`. At most one model is Active for the priority task.

### EvaluationRun

Key fields:

- id
- priority_dataset_id
- candidate_model_id
- baseline_version
- split_seed
- source_revision
- candidate_metrics
- baseline_metrics
- confusion_matrix
- leakage_check_status
- status
- created_at

Status values are `Pending`, `Completed` and `Failed`.

### AIAnalysis

Key fields:

- id
- issue_id
- provider
- model
- status
- summary
- root_cause
- impact
- recommendation
- priority_explanation
- confidence_note
- created_at

Potential status:

```text
Pending
Completed
Failed
```

### AIRepositorySummary

Represents an AI-generated repository-level summary for one Scan. Multiple records may exist to preserve retry and model history; the latest Completed record is shown on the Dashboard.

Key fields:

- id
- scan_id
- provider
- model
- prompt_version
- status
- summary
- major_risks
- recommended_priorities
- positive_observations
- confidence_note
- created_at

Status values are `Pending`, `Completed` and `Failed`.

### Report

Key fields:

- id
- repository_id
- scan_id
- generated_by
- format
- storage_reference
- status
- created_at

### AuditLog

Key fields:

- id
- actor_user_id
- action
- resource_type
- resource_id
- metadata
- created_at

---

## 5. Traceability

| Entity | Requirements |
|---|---|
| User / Role | `FR-AUTH-*`, `FR-USER-*` |
| Repository / RepositoryMember | `FR-REP-*` |
| Scan | `FR-SCAN-*`, `FR-REP-008` |
| Issue | `FR-ISSUE-*`, `FR-FILTER-*` |
| PriorityLabel / PriorityPrediction | `FR-PRIO-002`–`FR-PRIO-005`, `FR-PRIO-008` |
| PriorityDataset / PriorityModel / EvaluationRun | `FR-PRIO-006`, `FR-PRIO-007`, `NFR-MAIN-005` |
| AIAnalysis | Issue-level `FR-AI-*` except `FR-AI-006` |
| AIRepositorySummary | `FR-AI-006`, `FR-DASH-006` |
| Report | `FR-REPORT-*` |
| AuditLog | `NFR-SEC-*`, `NFR-MAIN-003` |

---

## 6. Design Rules

- Primary keys should use a consistent strategy.
- Foreign keys must enforce entity relationships.
- Important status values should use controlled values.
- Timestamps should use a consistent timezone strategy.
- Sensitive credentials must not be stored in these entities unless encrypted/secured by an approved design.
- Full repository source code is not part of the primary persistent data model.
