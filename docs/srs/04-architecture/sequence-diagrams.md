# Sequence Diagrams

> **Project:** AuditorX  
> **Status:** Draft

---

## 1. Purpose

Sequence Diagram ใช้อธิบายการติดต่อระหว่าง Actor และ Component สำหรับ Use Case ที่มี Integration หรือ Business Flow สำคัญ

ใช้รหัส:

```text
SD-<Use Case Number>
```

---

## 2. Sequence Diagram Index

| ID | Use Case |
|---|---|
| SD-001 | UC-001 Login |
| SD-002 | UC-002 Repository Management |
| SD-003 | UC-003 Source Code Scan |
| SD-004 | UC-004 AI Analysis |
| SD-005 | UC-005 Dashboard |
| SD-006 | UC-006 Issue Detail / Status |
| SD-008 | UC-008 Report Generation |
| SD-009 | UC-009 User Management |
| SD-010 | UC-010 Scan History |
| SD-011 | UC-011 MCP Context Access |
| SD-012 | UC-012 Priority Model Evaluation and Activation |

`UC-007` ไม่จำเป็นต้องมี Sequence Diagram แยกในระยะแรก เพราะเป็น Query/Filtering flow ที่ไม่ซับซ้อน

---

## 3. SD-001 Login

```mermaid
sequenceDiagram
    actor U as User
    participant F as Frontend
    participant B as Backend
    participant D as Database

    U->>F: Submit email/password
    F->>B: POST login
    B->>D: Find user
    D-->>B: User record
    B->>B: Verify password/status
    B-->>F: Session/Token + user role
    F-->>U: Open application
```

---

## 4. SD-002 Repository Management

```mermaid
sequenceDiagram
    actor U as Developer
    participant F as Frontend
    participant B as Backend
    participant G as GitHub
    participant D as Database

    U->>F: Add repository
    F->>B: Repository request
    B->>B: Validate user permission
    B->>G: Request repository metadata
    G-->>B: Metadata / access result
    B->>D: Save repository
    D-->>B: Repository record
    B-->>F: Success
    F-->>U: Repository added
```

---

## 5. SD-003 Source Code Scan

```mermaid
sequenceDiagram
    actor U as Developer
    participant F as Frontend
    participant B as Backend
    participant G as GitHub
    participant S as Semgrep
    participant P as Priority Engine
    participant D as Database

    U->>F: Start scan
    F->>B: POST scan
    B->>B: Validate access
    B->>D: Create Pending scan
    B->>G: Retrieve source
    G-->>B: Source / commit
    B->>D: Update Running
    B->>S: Execute Semgrep
    S-->>B: Findings
    B->>B: Normalize findings
    B->>D: Store issues
    B->>P: Predict priority from versioned features
    P-->>B: Prediction or baseline fallback
    B->>D: Store immutable Predictions
    B->>B: Calculate deterministic Quality Score
    B->>D: Mark scan Completed
    B-->>F: Scan result/status
    F-->>U: Show result
```

**Implementation status:** the enqueue → worker → source → Semgrep → store-issues portion is
implemented (in `postgres` mode with `SCAN_QUEUE_ENABLED=true`), with two corrections to the
diagram above: (1) the worker is a separate OS process that claims the job with
`FOR UPDATE SKIP LOCKED` and a lease token rather than the API executing the scan inline, and
(2) source retrieval resolves the branch to a commit SHA via the GitHub API before fetching that
commit's ZIP from `codeload.github.com`. The `Priority Engine` participant and the "Predict
priority" / "Store immutable Predictions" / "Calculate deterministic Quality Score" steps are
**not implemented** — see `priority-engine.md`. Findings are stored with their Semgrep-derived
severity only.

---

## 6. SD-004 AI Analysis

> **Implementation status: Not yet built.** No AI provider integration exists in the codebase
> as of 2026-09-12 (see `ai-engine.md`); this sequence is planned only.

```mermaid
sequenceDiagram
    actor U as User
    participant F as Frontend
    participant B as Backend
    participant D as Database
    participant A as AI Provider

    U->>F: Request/view AI analysis
    F->>B: AI analysis request
    B->>D: Load issue/rule/context
    D-->>B: Issue data
    B->>B: Minimize/sanitize context
    B->>A: Structured AI request
    A-->>B: Structured response
    B->>B: Validate response
    B->>D: Store AI analysis
    B-->>F: Explanation/recommendation
    F-->>U: Display AI result
```

---

## 7. SD-005 Dashboard

```mermaid
sequenceDiagram
    actor U as User
    participant F as Frontend
    participant B as Backend
    participant D as Database

    U->>F: Open repository dashboard
    F->>B: GET dashboard
    B->>B: Validate repository access
    B->>D: Query latest scan/issues/history
    D-->>B: Aggregated data
    B->>B: Build dashboard DTO
    B-->>F: Dashboard data
    F-->>U: Render dashboard
```

**Implementation status:** in `prototype` mode this is served entirely from the `audit`
module's hardcoded sample data. In `postgres` mode, `/api/v1/issues` and the generic dashboard
still use that same placeholder contract; the web UI instead uses scan-specific endpoints
(`GET /api/v1/repositories/{repo}/scans[...]`) for real results when `scan_queue` is enabled.

---

## 8. SD-006 Issue Detail / Status

```mermaid
sequenceDiagram
    actor U as User
    participant F as Frontend
    participant B as Backend
    participant D as Database

    U->>F: Open issue
    F->>B: GET issue
    B->>D: Load issue, Prediction, Label and AI data
    D-->>B: Issue detail
    B-->>F: Issue detail
    F-->>U: Show issue

    alt Reviewer/Admin submits Priority Label
        U->>F: Confirm/correct Priority + rationale
        F->>B: POST priority label
        B->>B: Validate repository and labeling permission
        B->>D: Append human-reviewed Label
        D-->>B: Label stored
        B-->>F: Updated label history
    end

    U->>F: Change status / add note
    F->>B: PATCH issue
    B->>B: Validate permission/state
    B->>D: Update issue + history
    D-->>B: Updated issue
    B-->>F: Success
```

**Implementation status:** the "Confirm/correct Priority + rationale" / "POST priority label"
block is not implemented (no Priority Engine or Label storage exists — see
`priority-engine.md`); plain issue status/note updates are also not yet implemented as a
separate Issue service (see `backend.md`).

---

## 9. SD-008 Report Generation

> **Implementation status: Not yet built.** No Report Generator/service exists in the codebase
> as of 2026-09-12 (see `backend.md`); this sequence is planned only.

```mermaid
sequenceDiagram
    actor U as User
    participant F as Frontend
    participant B as Backend
    participant D as Database
    participant R as Report Generator

    U->>F: Generate report
    F->>B: Report request
    B->>B: Validate access
    B->>D: Load scan/issues/summary
    D-->>B: Report data
    B->>R: Generate artifact
    R-->>B: Report file/reference
    B->>D: Store report metadata
    B-->>F: Download reference
    F-->>U: Download report
```

---

## 10. SD-009 User Management

```mermaid
sequenceDiagram
    actor A as Administrator
    participant F as Frontend
    participant B as Backend
    participant D as Database

    A->>F: Update role/status/permission
    F->>B: Admin request
    B->>B: Verify admin permission
    B->>D: Update user data
    B->>D: Write audit record
    D-->>B: Success
    B-->>F: Updated result
```

---

## 11. SD-010 Scan History

```mermaid
sequenceDiagram
    actor U as User
    participant F as Frontend
    participant B as Backend
    participant D as Database

    U->>F: Open scan history
    F->>B: GET scan history
    B->>B: Validate access
    B->>D: Query repository scans
    D-->>B: Scan history
    B-->>F: History DTO
    F-->>U: Show scan history
```

---

## 12. SD-011 MCP Context Access

> **Implementation status: Not yet built.** No MCP endpoint exists in the codebase as of
> 2026-09-12 (see `mcp.md`); this sequence is planned only.

```mermaid
sequenceDiagram
    participant C as AI Coding Assistant
    participant M as MCP Endpoint
    participant B as AuditorX Backend
    participant D as Data/Standards Store

    C->>M: MCP request
    M->>B: Validate/handle request
    B->>B: Authorization check
    B->>D: Load authorized standard/context
    D-->>B: Context
    B->>B: Filter response
    B-->>M: MCP result
    M-->>C: Authorized context
```

---

## 13. SD-012 Priority Model Evaluation and Activation

> **Implementation status: Not yet built.** No priority/ML engine, model registry or evaluation
> pipeline exists in the codebase as of 2026-09-12 (see `priority-engine.md`); this sequence is
> planned only.

```mermaid
sequenceDiagram
    actor A as Administrator
    participant F as Frontend
    participant B as Backend
    participant D as Database
    participant R as Model Registry

    A->>F: Open candidate EvaluationRun
    F->>B: GET evaluation detail
    B->>D: Load candidate/baseline metrics and split metadata
    D-->>B: EvaluationRun
    B-->>F: Metrics + promotion eligibility
    A->>F: Confirm activation
    F->>B: POST activate model
    B->>B: Validate admin, leakage and thresholds
    B->>R: Verify artifact/checksum
    R-->>B: Artifact valid
    B->>D: Activate candidate + retire previous + AuditLog
    D-->>B: Commit
    B-->>F: Active model version
```

---

## 14. Traceability

| Sequence | Use Case |
|---|---|
| SD-001 | UC-001 |
| SD-002 | UC-002 |
| SD-003 | UC-003 |
| SD-004 | UC-004 |
| SD-005 | UC-005 |
| SD-006 | UC-006 |
| SD-008 | UC-008 |
| SD-009 | UC-009 |
| SD-010 | UC-010 |
| SD-011 | UC-011 |
| SD-012 | UC-012 |
