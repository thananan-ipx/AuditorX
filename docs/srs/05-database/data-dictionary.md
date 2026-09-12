# Data Dictionary

> **Project:** AuditorX  
> **Status:** Draft

**Implementation status (as of 2026-09-12):** Only §§4–6 (`Repository`, `RepositoryMember`, `Scan`) plus a new §7a (`ScanFinding`) describe tables that exist today, in `supabase/migrations/20260828073925_repository_membership.sql` and `supabase/migrations/20260828102015_durable_scan_jobs.sql`. Each of those sections is annotated with the real column list where it differs from the field names below. `User` (§2) and `Role` (§3) are not local tables — identity is Supabase Auth's `auth.users`. `Issue` (§7) as a stateful, editable entity and everything from §8 onward (`IssueStatusHistory`, `IssueNote`, `PriorityLabel`, `PriorityPrediction`, `PriorityDataset`, `PriorityModel`, `EvaluationRun`, `AIAnalysis`, `AIRepositorySummary`, `Report`, `AuditLog`) is planned/target design with no corresponding table. Content is retained as forward-looking scope.

## 1. Conventions

- PK = Primary Key
- FK = Foreign Key
- UK = Unique Key
- Required = must not be null unless otherwise stated

---

## 2. User — **[Planned local profile; identity itself is implemented via Supabase Auth]**

There is no `public.users` table. Identity is Supabase Auth's `auth.users`, referenced by other tables only via foreign key (`created_by`, `requested_by`, `user_id`, etc.). The application layer exposes only `id` and `email` (`backend/internal/modules/user/entity/user.go`). All other fields below are **planned**, not implemented.

| Field | Type | Constraint | Description | Status |
|---|---|---|---|---|
| id | UUID | PK | User identifier | Implemented (Supabase `auth.users.id`) |
| email | VARCHAR | UK, Required | Login email | Implemented (Supabase `auth.users.email`) |
| password_hash | VARCHAR | Required | Hashed password | Planned (managed internally by Supabase Auth, not exposed) |
| first_name | VARCHAR | Required | First name | Planned |
| last_name | VARCHAR | Required | Last name | Planned |
| role_id | UUID | FK, Required | User role | Planned |
| account_status | VARCHAR | Required | Active/Suspended | Planned |
| created_at | TIMESTAMP | Required | Created time | Planned (local profile) |
| updated_at | TIMESTAMP | Required | Updated time | Planned (local profile) |

---

## 3. Role — **[Planned]**

Not implemented. Access today is per-repository only, via `RepositoryMember.access_level`.

| Field | Type | Constraint | Description |
|---|---|---|---|
| id | UUID | PK | Role identifier |
| name | VARCHAR | UK, Required | Role name |

---

## 4. Repository — **[Implemented]**

Real table: `public.repositories`. Columns actually implemented: `id`, `name`, `owner_name`, `repository_url`, `default_branch`, `status`, `created_by`, `created_at`. `provider`, `external_repository_id`, `primary_language`, `criticality`, and `updated_at` below are **planned**, not present in the table.

| Field | Type | Constraint | Description | Status |
|---|---|---|---|---|
| id | UUID | PK | Internal repository ID | Implemented |
| name | VARCHAR | Required, 1–100 chars | Repository name | Implemented |
| provider | VARCHAR | Required | e.g. github | Planned |
| external_repository_id | VARCHAR | Nullable | Provider repository ID | Planned |
| repository_url | VARCHAR | Required | Must equal `https://github.com/{owner_name}/{name}`, lowercase | Implemented |
| owner_name | VARCHAR | Required, 1–39 chars | Repository owner | Implemented |
| default_branch | VARCHAR | Required, default `main` | Default branch | Implemented |
| primary_language | VARCHAR | Nullable | Primary language | Planned |
| criticality | VARCHAR | Required | Low/Medium/High/Critical; default Medium | Planned |
| status | VARCHAR | Required | `Active`/`Archived` | Implemented |
| created_by | UUID | FK → `auth.users`, Required | Creator | Implemented |
| created_at | TIMESTAMP | Required | Created time | Implemented |
| updated_at | TIMESTAMP | Required | Updated time | Planned |

Unique constraints actually implemented: `(created_by, repository_url)` and `(id, created_by)` — not a global unique on `repository_url` alone.

---

## 5. RepositoryMember — **[Implemented]**

Real table: `public.repository_members`. There is **no surrogate `id` column** — the primary key is the composite `(repository_id, user_id)` shown below. The table also stores `repository_owner_id`, a composite FK to `repositories(id, created_by)` used to avoid a recursive RLS policy lookup. There is no `updated_at`.

| Field | Type | Constraint | Description | Status |
|---|---|---|---|---|
| ~~id~~ | — | — | Not implemented; PK is `(repository_id, user_id)` | N/A |
| repository_id | UUID | PK (part 1), FK → `repositories.id` | Repository | Implemented |
| repository_owner_id | UUID | FK → `repositories(id, created_by)` | Denormalized owner, used to avoid recursive RLS | Implemented (not in original design) |
| user_id | UUID | PK (part 2), FK → `auth.users.id` | User | Implemented |
| access_level | VARCHAR | Required | `owner`/`editor`/`viewer` | Implemented |
| created_at | TIMESTAMP | Required | Created time | Implemented |

The composite primary key `(repository_id, user_id)` is implemented (not merely "recommended").

---

## 6. Scan — **[Implemented, as `scan_jobs`]**

Real table: `public.scan_jobs`. Real column names differ from the planned ones below in several places (`requested_by` not `started_by`, `rules_version` not `rule_profile`, `finished_at` not `completed_at`), and several planned columns (`quality_score`, `score_version`, `score_calculated_at`, `severity_mapping_version`, `error_message`) do not exist. The implemented table also adds `attempts`, `lease_token`, `lease_expires_at`, and `scanner_version` for durable worker leasing, which are not in the planned list below.

| Field | Type | Constraint | Description | Status |
|---|---|---|---|---|
| id | UUID | PK | Scan ID | Implemented |
| repository_id | UUID | FK, Required | Repository | Implemented |
| branch | VARCHAR | Required, 1–255 chars | Scanned branch | Implemented |
| commit_sha | VARCHAR | Nullable, 40-char hex | Scanned commit | Implemented |
| rule_profile | VARCHAR | Required | Rule profile/version | Implemented as `rules_version`; new scans default to `baseline-v2`, and `baseline-v1` remains valid for history |
| severity_mapping_version | VARCHAR | Required | Version of Semgrep-to-AuditorX severity mapping | Planned |
| status | VARCHAR | Required | `queued`/`running`/`completed`/`failed`/`cancelled` | Implemented (values differ from planned `Pending/Running/...`) |
| quality_score | DECIMAL | Nullable | Final quality score | Planned |
| score_version | VARCHAR | Nullable | Formula version used for quality score | Planned |
| score_calculated_at | TIMESTAMP | Nullable | Latest score calculation time | Planned |
| started_by | UUID | FK, Required | User | Implemented as `requested_by` |
| started_at | TIMESTAMP | Nullable | Start time | Implemented |
| completed_at | TIMESTAMP | Nullable | End time | Implemented as `finished_at` |
| error_code | VARCHAR | Nullable | Controlled error code | Implemented |
| error_message | TEXT | Nullable | Safe error detail | Planned |
| created_at | TIMESTAMP | Required | Created time | Implemented |
| attempts | INTEGER | Required, 0–3 | Retry count | Implemented (not in original design) |
| lease_token | UUID | Nullable | Worker lease token | Implemented (not in original design) |
| lease_expires_at | TIMESTAMP | Nullable | Worker lease expiry | Implemented (not in original design) |
| scanner_version | VARCHAR | Nullable | Scanner build/version that produced the result | Implemented (not in original design) |

Only one `queued`/`running` job per repository is allowed at a time (`scan_jobs_one_active` partial unique index).

---

## 7. Issue — **[Planned; implemented today only as immutable `ScanFinding`, see §7a]**

**This table does not exist.** There is no persistent, editable `Issue` entity with a `status` lifecycle, notes, or history. What is implemented is `scan_findings` — see §7a. The fields below remain the planned target design.

| Field | Type | Constraint | Description |
|---|---|---|---|
| id | UUID | PK | Issue ID |
| scan_id | UUID | FK, Required | Source scan |
| rule_id | VARCHAR | Required | Analyzer rule ID |
| title | VARCHAR | Nullable | Normalized title |
| message | TEXT | Required | Finding message |
| category | VARCHAR | Required | Security/Code Quality/Coding Standard/Best Practice |
| severity | VARCHAR | Required | AuditorX severity |
| file_path | TEXT | Required | Relative file path |
| start_line | INTEGER | Required | Start line |
| start_column | INTEGER | Nullable | Start column |
| end_line | INTEGER | Nullable | End line |
| end_column | INTEGER | Nullable | End column |
| code_snippet | TEXT | Nullable | Relevant code |
| finding_fingerprint | VARCHAR | Required | Versioned key for matching repeated findings across scans |
| fingerprint_version | VARCHAR | Required | Fingerprint algorithm version |
| status | VARCHAR | Required | Issue lifecycle status |
| metadata | JSONB | Nullable | Analyzer metadata |
| created_at | TIMESTAMP | Required | Created time |
| updated_at | TIMESTAMP | Required | Updated time |

---

## 7a. ScanFinding — **[Implemented]**

Real table: `public.scan_findings`. This is the actual, currently-implemented counterpart to the planned `Issue` above — an **immutable** record of what one completed scan found, with no status, notes, or history.

| Field | Type | Constraint | Description |
|---|---|---|---|
| scan_id | UUID | PK (part 1), FK → `scan_jobs(id, repository_id)` | Source scan |
| repository_id | UUID | FK (composite with scan_id) | Repository, denormalized for RLS |
| fingerprint | VARCHAR | PK (part 2), Required, exactly 64 chars | Hash identifying this finding |
| rule_id | VARCHAR | Required, 1–200 chars | Analyzer rule ID |
| severity | VARCHAR | Required | `High`/`Medium`/`Low` only |
| file_path | TEXT | Required, 1–500 chars | Relative file path |
| start_line | INTEGER | Required, > 0 | Start line |
| end_line | INTEGER | Required, ≥ start_line | End line |
| message | TEXT | Required, 1–2000 chars | Finding message |

No `id`, `title`, `category`, `start_column`/`end_column`, `code_snippet`, `fingerprint_version`, `status`, `metadata`, `created_at`, or `updated_at` — none of these are implemented.

---

## 8. IssueStatusHistory — **[Planned — not implemented]**

| Field | Type | Constraint | Description |
|---|---|---|---|
| id | UUID | PK | History ID |
| issue_id | UUID | FK, Required | Issue |
| old_status | VARCHAR | Nullable | Previous state |
| new_status | VARCHAR | Required | New state |
| changed_by | UUID | FK, Required | User |
| changed_at | TIMESTAMP | Required | Change time |

---

## 9. IssueNote — **[Planned — not implemented]**

| Field | Type | Constraint | Description |
|---|---|---|---|
| id | UUID | PK | Note ID |
| issue_id | UUID | FK, Required | Issue |
| user_id | UUID | FK, Required | Author |
| note | TEXT | Required | Note text |
| created_at | TIMESTAMP | Required | Created |
| updated_at | TIMESTAMP | Required | Updated |

---

## 10. PriorityLabel — **[Planned — not implemented]**

| Field | Type | Constraint | Description |
|---|---|---|---|
| id | UUID | PK | Label ID |
| issue_id | UUID | FK, Required | Labeled Issue |
| label | VARCHAR | Required | Critical/High/Medium/Low |
| labeled_by | UUID | FK, Required | Human reviewer |
| rationale | TEXT | Required | Label reason |
| guideline_version | VARCHAR | Required | Labeling guideline version |
| created_at | TIMESTAMP | Required | Created time |

---

## 11. PriorityPrediction — **[Planned — not implemented]**

| Field | Type | Constraint | Description |
|---|---|---|---|
| id | UUID | PK | Prediction ID |
| issue_id | UUID | FK, Required | Predicted Issue |
| priority_model_id | UUID | FK, Nullable | Model; null for baseline |
| priority | VARCHAR | Required | Critical/High/Medium/Low |
| priority_source | VARCHAR | Required | model/baseline |
| predictor_version | VARCHAR | Required | Model or baseline version |
| feature_schema_version | VARCHAR | Required | Feature contract version |
| feature_snapshot | JSONB | Required | Sanitized feature values used for this Prediction |
| probabilities | JSONB | Required | Probability by class |
| confidence | DECIMAL | Required | Selected-class probability |
| fallback_reason | VARCHAR | Nullable | Controlled fallback reason |
| created_at | TIMESTAMP | Required | Prediction time |

---

## 12. PriorityDataset — **[Planned — not implemented]**

| Field | Type | Constraint | Description |
|---|---|---|---|
| id | UUID | PK | Dataset ID |
| version | VARCHAR | UK, Required | Immutable dataset version |
| labeling_guideline_version | VARCHAR | Required | Guideline used for labels |
| manifest_reference | TEXT | Required | Dataset manifest location |
| manifest_checksum | VARCHAR | Required | Manifest integrity checksum |
| split_seed | INTEGER | Required | Reproducible split seed |
| split_manifest | JSONB | Required | Repository-grouped partitions |
| label_distribution | JSONB | Required | Counts per class/partition |
| created_at | TIMESTAMP | Required | Created time |

---

## 13. PriorityModel — **[Planned — not implemented]**

| Field | Type | Constraint | Description |
|---|---|---|---|
| id | UUID | PK | Model ID |
| version | VARCHAR | UK, Required | Immutable model version |
| algorithm | VARCHAR | Required | Algorithm name |
| feature_schema_version | VARCHAR | Required | Expected feature contract |
| training_dataset_id | UUID | FK, Required | Training dataset |
| artifact_reference | TEXT | Required | Model artifact location |
| artifact_checksum | VARCHAR | Required | Artifact integrity checksum |
| hyperparameters | JSONB | Required | Training configuration |
| validation_metrics | JSONB | Required | Validation results |
| test_metrics | JSONB | Nullable | Final test results |
| status | VARCHAR | Required | Candidate/Active/Retired |
| created_at | TIMESTAMP | Required | Created time |
| activated_at | TIMESTAMP | Nullable | Activation time |

---

## 14. EvaluationRun — **[Planned — not implemented]**

| Field | Type | Constraint | Description |
|---|---|---|---|
| id | UUID | PK | Evaluation ID |
| priority_dataset_id | UUID | FK, Required | Evaluated dataset |
| candidate_model_id | UUID | FK, Required | Candidate model |
| baseline_version | VARCHAR | Required | Compared baseline version |
| split_seed | INTEGER | Required | Split seed |
| source_revision | VARCHAR | Required | Pipeline source revision |
| candidate_metrics | JSONB | Nullable | Candidate metrics |
| baseline_metrics | JSONB | Nullable | Baseline metrics |
| confusion_matrix | JSONB | Nullable | Candidate confusion matrix |
| leakage_check_status | VARCHAR | Required | Pending/Passed/Failed |
| status | VARCHAR | Required | Pending/Completed/Failed |
| created_at | TIMESTAMP | Required | Created time |

---

## 15. AIAnalysis — **[Planned — not implemented]**

| Field | Type | Constraint | Description |
|---|---|---|---|
| id | UUID | PK | Analysis ID |
| issue_id | UUID | FK, Required | Issue |
| provider | VARCHAR | Required | AI provider |
| model | VARCHAR | Required | Model identifier |
| status | VARCHAR | Required | Pending/Completed/Failed |
| summary | TEXT | Nullable | Short explanation |
| root_cause | TEXT | Nullable | Root cause |
| impact | TEXT | Nullable | Potential impact |
| recommendation | TEXT | Nullable | Remediation |
| priority_explanation | TEXT | Nullable | LLM explanation of persisted system Priority |
| confidence_note | TEXT | Nullable | Uncertainty/context note |
| created_at | TIMESTAMP | Required | Created |

---

## 16. AIRepositorySummary — **[Planned — not implemented]**

| Field | Type | Constraint | Description |
|---|---|---|---|
| id | UUID | PK | Summary ID |
| scan_id | UUID | FK, Required | Source scan |
| provider | VARCHAR | Required | AI provider |
| model | VARCHAR | Required | Model identifier |
| prompt_version | VARCHAR | Required | Repository-summary prompt version |
| status | VARCHAR | Required | Pending/Completed/Failed |
| summary | TEXT | Nullable | Overall quality summary |
| major_risks | JSONB | Nullable | Ordered risk list |
| recommended_priorities | JSONB | Nullable | Ordered recommended priorities |
| positive_observations | JSONB | Nullable | Positive observations |
| confidence_note | TEXT | Nullable | Context limitation / uncertainty |
| created_at | TIMESTAMP | Required | Created time |

---

## 17. Report — **[Planned — not implemented]**

| Field | Type | Constraint | Description |
|---|---|---|---|
| id | UUID | PK | Report ID |
| repository_id | UUID | FK, Required | Repository |
| scan_id | UUID | FK, Required | Scan |
| generated_by | UUID | FK, Required | User |
| format | VARCHAR | Required | e.g. pdf |
| storage_reference | TEXT | Nullable | Artifact reference |
| status | VARCHAR | Required | Generating/Completed/Failed |
| created_at | TIMESTAMP | Required | Created |

---

## 18. AuditLog — **[Planned — not implemented]**

| Field | Type | Constraint | Description |
|---|---|---|---|
| id | UUID | PK | Log ID |
| actor_user_id | UUID | FK, Nullable | Actor |
| action | VARCHAR | Required | Action code |
| resource_type | VARCHAR | Nullable | Target type |
| resource_id | UUID | Nullable | Target ID |
| metadata | JSONB | Nullable | Safe metadata |
| created_at | TIMESTAMP | Required | Event time |

Sensitive values must not be persisted in `metadata`.
