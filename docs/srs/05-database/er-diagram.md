# ER Diagram

> **Project:** AuditorX  
> **Status:** Draft

**Implementation status (as of 2026-09-12):** The diagram below is the full **planned/target** ER model. Only four tables exist in the codebase today: `repositories`, `repository_members`, `scan_jobs`, and `scan_findings` (see `supabase/migrations/20260828073925_repository_membership.sql` and `supabase/migrations/20260828102015_durable_scan_jobs.sql`), all with Row Level Security enabled and forced. `USER` is not a local table — it is Supabase Auth's `auth.users`. `SCAN` is implemented as `scan_jobs`. `ISSUE` as a stateful entity does not exist; the implemented analog is the immutable `scan_findings` table (no status, notes, or history). Everything else below — `ROLE`, `ISSUE_STATUS_HISTORY`, `ISSUE_NOTE`, `PRIORITY_LABEL`, `PRIORITY_PREDICTION`, `PRIORITY_DATASET`, `PRIORITY_MODEL`, `EVALUATION_RUN`, `AI_ANALYSIS`, `AI_REPOSITORY_SUMMARY`, `REPORT`, `AUDIT_LOG` — has no corresponding table. See "Currently Implemented ER Diagram" below for the as-built subset, and §5 in `data-model.md` / the corresponding sections of `data-dictionary.md` for field-level detail.

## Currently Implemented ER Diagram

```mermaid
erDiagram
    USER ||--o{ REPOSITORY_MEMBER : assigned
    REPOSITORY ||--o{ REPOSITORY_MEMBER : grants
    USER ||--o{ REPOSITORY : creates
    REPOSITORY ||--o{ SCAN_JOB : has
    USER ||--o{ SCAN_JOB : requests
    SCAN_JOB ||--o{ SCAN_FINDING : produces

    USER {
        uuid id PK "Supabase auth.users.id"
        varchar email UK "Supabase auth.users.email"
    }

    REPOSITORY {
        uuid id PK
        varchar name
        varchar owner_name
        varchar repository_url
        varchar default_branch
        varchar status
        uuid created_by FK
        timestamp created_at
    }

    REPOSITORY_MEMBER {
        uuid repository_id PK "composite PK with user_id"
        uuid repository_owner_id FK
        uuid user_id PK
        varchar access_level
        timestamp created_at
    }

    SCAN_JOB {
        uuid id PK
        uuid repository_id FK
        uuid requested_by FK
        varchar branch
        varchar rules_version
        varchar status
        integer attempts
        uuid lease_token
        timestamp lease_expires_at
        varchar commit_sha
        varchar scanner_version
        varchar error_code
        timestamp created_at
        timestamp started_at
        timestamp finished_at
    }

    SCAN_FINDING {
        uuid scan_id PK "composite PK with fingerprint"
        uuid repository_id FK
        varchar fingerprint PK
        varchar rule_id
        varchar severity
        text file_path
        integer start_line
        integer end_line
        text message
    }
```

## Full Planned ER Diagram (target design)

```mermaid
erDiagram
    ROLE ||--o{ USER : has
    USER ||--o{ REPOSITORY_MEMBER : assigned
    REPOSITORY ||--o{ REPOSITORY_MEMBER : grants
    USER ||--o{ REPOSITORY : creates
    REPOSITORY ||--o{ SCAN : has
    USER ||--o{ SCAN : starts
    SCAN ||--o{ ISSUE : produces
    ISSUE ||--o{ ISSUE_STATUS_HISTORY : has
    USER ||--o{ ISSUE_STATUS_HISTORY : changes
    ISSUE ||--o{ ISSUE_NOTE : has
    USER ||--o{ ISSUE_NOTE : writes
    ISSUE ||--o{ PRIORITY_LABEL : labeled
    USER ||--o{ PRIORITY_LABEL : reviews
    ISSUE ||--o{ PRIORITY_PREDICTION : predicts
    PRIORITY_MODEL o|--o{ PRIORITY_PREDICTION : produces
    PRIORITY_DATASET ||--o{ PRIORITY_MODEL : trains
    PRIORITY_DATASET ||--o{ EVALUATION_RUN : evaluates
    PRIORITY_MODEL ||--o{ EVALUATION_RUN : candidate
    ISSUE ||--o{ AI_ANALYSIS : has
    SCAN ||--o{ AI_REPOSITORY_SUMMARY : summarizes
    SCAN ||--o{ REPORT : generates
    USER ||--o{ REPORT : requests
    USER ||--o{ AUDIT_LOG : acts

    ROLE {
        uuid id PK
        varchar name
    }

    USER {
        uuid id PK
        varchar email UK
        varchar password_hash
        varchar first_name
        varchar last_name
        uuid role_id FK
        varchar account_status
        timestamp created_at
        timestamp updated_at
    }

    REPOSITORY {
        uuid id PK
        varchar name
        varchar provider
        varchar external_repository_id
        varchar repository_url
        varchar owner_name
        varchar default_branch
        varchar primary_language
        varchar criticality
        varchar status
        uuid created_by FK
        timestamp created_at
        timestamp updated_at
    }

    REPOSITORY_MEMBER {
        uuid id PK
        uuid repository_id FK
        uuid user_id FK
        varchar access_level
        timestamp created_at
    }

    SCAN {
        uuid id PK
        uuid repository_id FK
        varchar branch
        varchar commit_sha
        varchar rule_profile
        varchar severity_mapping_version
        varchar status
        decimal quality_score
        varchar score_version
        timestamp score_calculated_at
        uuid started_by FK
        timestamp started_at
        timestamp completed_at
        varchar error_code
        text error_message
        timestamp created_at
    }

    ISSUE {
        uuid id PK
        uuid scan_id FK
        varchar rule_id
        varchar title
        text message
        varchar category
        varchar severity
        text file_path
        integer start_line
        integer start_column
        integer end_line
        integer end_column
        text code_snippet
        varchar finding_fingerprint
        varchar fingerprint_version
        varchar status
        jsonb metadata
        timestamp created_at
        timestamp updated_at
    }

    ISSUE_STATUS_HISTORY {
        uuid id PK
        uuid issue_id FK
        varchar old_status
        varchar new_status
        uuid changed_by FK
        timestamp changed_at
    }

    ISSUE_NOTE {
        uuid id PK
        uuid issue_id FK
        uuid user_id FK
        text note
        timestamp created_at
        timestamp updated_at
    }

    PRIORITY_LABEL {
        uuid id PK
        uuid issue_id FK
        varchar label
        uuid labeled_by FK
        text rationale
        varchar guideline_version
        timestamp created_at
    }

    PRIORITY_PREDICTION {
        uuid id PK
        uuid issue_id FK
        uuid priority_model_id FK
        varchar priority
        varchar priority_source
        varchar predictor_version
        varchar feature_schema_version
        jsonb feature_snapshot
        jsonb probabilities
        decimal confidence
        varchar fallback_reason
        timestamp created_at
    }

    PRIORITY_DATASET {
        uuid id PK
        varchar version UK
        varchar labeling_guideline_version
        text manifest_reference
        varchar manifest_checksum
        integer split_seed
        jsonb split_manifest
        jsonb label_distribution
        timestamp created_at
    }

    PRIORITY_MODEL {
        uuid id PK
        varchar version UK
        varchar algorithm
        varchar feature_schema_version
        uuid training_dataset_id FK
        text artifact_reference
        varchar artifact_checksum
        jsonb hyperparameters
        jsonb validation_metrics
        jsonb test_metrics
        varchar status
        timestamp created_at
        timestamp activated_at
    }

    EVALUATION_RUN {
        uuid id PK
        uuid priority_dataset_id FK
        uuid candidate_model_id FK
        varchar baseline_version
        integer split_seed
        varchar source_revision
        jsonb candidate_metrics
        jsonb baseline_metrics
        jsonb confusion_matrix
        varchar leakage_check_status
        varchar status
        timestamp created_at
    }

    AI_ANALYSIS {
        uuid id PK
        uuid issue_id FK
        varchar provider
        varchar model
        varchar status
        text summary
        text root_cause
        text impact
        text recommendation
        text priority_explanation
        text confidence_note
        timestamp created_at
    }

    AI_REPOSITORY_SUMMARY {
        uuid id PK
        uuid scan_id FK
        varchar provider
        varchar model
        varchar prompt_version
        varchar status
        text summary
        jsonb major_risks
        jsonb recommended_priorities
        jsonb positive_observations
        text confidence_note
        timestamp created_at
    }

    REPORT {
        uuid id PK
        uuid repository_id FK
        uuid scan_id FK
        uuid generated_by FK
        varchar format
        text storage_reference
        varchar status
        timestamp created_at
    }

    AUDIT_LOG {
        uuid id PK
        uuid actor_user_id FK
        varchar action
        varchar resource_type
        uuid resource_id
        jsonb metadata
        timestamp created_at
    }
```

## Notes

- Field types are conceptual and may be refined during implementation.
- `uuid` is the recommended identifier type for the initial design.
- `jsonb` is appropriate for analyzer metadata that does not justify fixed columns.
- `AI_ANALYSIS` can have multiple records per issue to preserve re-analysis history.
