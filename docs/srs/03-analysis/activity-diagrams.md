# Activity Diagrams

> **Project:** AuditorX  
> **Document:** Activity Diagrams  
> **Status:** Draft  
> **Related SRS Section:** 4.5 การวิเคราะห์กระบวนการทำงานของระบบ

---

## 1. Purpose

เอกสารนี้รวบรวม Activity Diagram ของกระบวนการหลักใน AuditorX โดยใช้รหัสที่สัมพันธ์กับ Master Use Case เพื่อรักษา Traceability ระหว่าง Requirements, Use Cases, Design และ Test Cases

Diagram IDs ใช้รูปแบบ:

```text
AD-<Use Case Number>
```

ตัวอย่าง:

```text
UC-003 → AD-003
```

ไม่จำเป็นต้องสร้าง Activity Diagram สำหรับทุก Use Case หากกระบวนการนั้นเป็น CRUD หรือมีขั้นตอนไม่ซับซ้อน แต่ในเอกสารนี้กำหนด Diagram สำหรับกระบวนการหลักที่มีประโยชน์ต่อการออกแบบและพัฒนา

---

## 2. Activity Diagram Index

| Activity Diagram ID | Related Use Case | Process |
|---|---|---|
| AD-001 | UC-001 | Login |
| AD-002 | UC-002 | Repository Management |
| AD-003 | UC-003 | Source Code Scan |
| AD-004 | UC-004 | AI Analysis |
| AD-005 | UC-005 | Dashboard |
| AD-006 | UC-006 | Issue Review and Status Management |
| AD-007 | UC-007 | Search / Filter / Sort Issues |
| AD-008 | UC-008 | Report Generation |
| AD-009 | UC-009 | User and Permission Management |
| AD-010 | UC-010 | Scan History |
| AD-011 | UC-011 | MCP Context Access |
| AD-012 | UC-012 | Priority Model Evaluation and Activation |

---

## 3. AD-001 Login

**Related Use Case:** `UC-001`  
**Related Requirements:** `FR-AUTH-*`  
**Status:** Implemented

```mermaid
flowchart TD
    A[Open Login Page]
    B[Enter Email and Password]
    C{Input valid?}
    D[Validate Credentials]
    E{Credentials correct?}
    F{Account active?}
    G[Create Session / Token]
    H[Load Role and Permissions]
    I[Open Main Page]
    X[Show Validation Error]
    Y[Show Authentication Error]
    Z[Show Account Suspended]

    A --> B --> C
    C -- No --> X
    C -- Yes --> D --> E
    E -- No --> Y
    E -- Yes --> F
    F -- No --> Z
    F -- Yes --> G --> H --> I
```

---

## 4. AD-002 Repository Management

**Related Use Case:** `UC-002`  
**Related Requirements:** `FR-REP-*`  
**Status:** Partially implemented — Add/List/View Access implemented; Edit and Delete flows (branches E/F/K/L/M) are not yet implemented

```mermaid
flowchart TD
    A[Open Repository Page]
    B[View Accessible Repositories]
    C{Action}
    D[Add Repository]
    E[Edit Repository]
    F[Delete Repository]
    G[Validate Repository Data]
    H[Validate Access]
    I{Valid and Authorized?}
    J[Save Repository]
    K[Confirm Delete]
    L{Confirmed?}
    M[Delete / Mark Deleted]
    N[Show Error]
    O[Refresh Repository List]

    A --> B --> C
    C -->|Add| D --> G --> H --> I
    C -->|Edit| E --> G --> H --> I
    C -->|Delete| F --> K --> L
    I -- Yes --> J --> O
    I -- No --> N
    L -- Yes --> M --> O
    L -- No --> O
```

---

## 5. AD-003 Source Code Scan

**Related Use Case:** `UC-003`  
**Related Requirements:** `FR-SCAN-*`  
**Status:** Partially implemented — core scan lifecycle (create/run Semgrep/store findings/cancel/fail) is implemented; "Select Branch"/"Select Rule Set" (steps B, C) are not user-selectable (fixed to registered branch and a fixed rule profile), "Trigger AI Analysis" (step P) is not implemented, and priority prediction (step V) is not implemented

```mermaid
flowchart TD
    A[Select Repository]
    B[Select Branch]
    C[Select Rule Set]
    D[Start Scan]
    E[Validate User Access]
    F{Authorized?}
    G[Create Scan Record: Pending]
    H[Retrieve / Prepare Source Code]
    I{Source Ready?}
    J[Set Scan: Running]
    K[Run Semgrep]
    L{Semgrep Success?}
    M[Normalize Findings]
    N[Store Issues]
    O[Set Scan: Completed]
    P[Trigger AI Analysis]
    Q[Calculate Deterministic Summary / Quality Score]
    V[Predict Priority or Use Versioned Baseline]
    R[Show Scan Result]
    S[User Requests Cancellation]
    T[Stop Worker Safely]
    U[Set Scan: Cancelled]
    X[Reject Request]
    Y[Set Scan: Failed]
    Z[Store Error]

    A --> B --> C --> D --> E --> F
    F -- No --> X
    F -- Yes --> G --> H --> I
    I -- No --> Y --> Z
    I -- Yes --> J --> K --> L
    L -- No --> Y
    L -- Yes --> M --> N --> Q --> V --> O --> P --> R
    G -. Cancel .-> S
    J -. Cancel .-> S --> T --> U
```

---

## 6. AD-004 AI Analysis

**Related Use Case:** `UC-004`  
**Related Requirements:** `FR-AI-*`  
**Status: Not yet implemented** — no AI/LLM integration exists in the codebase; this whole flow is planned scope

```mermaid
flowchart TD
    A[Select Issue for AI Analysis]
    B[Load Rule Information]
    C[Load Relevant Code Context]
    D[Sanitize / Minimize Context]
    E[Build Structured Request]
    F[Call AI Service]
    G{AI Response Success?}
    H[Validate Response Structure]
    I{Response Valid?}
    J[Store Explanation]
    K[Store Impact]
    L[Store Recommendation]
    M[Store Priority Explanation]
    N[Show AI Result]
    X[Mark AI Analysis Failed]
    Y[Preserve Static Finding]
    Z[Allow Retry]

    A --> B --> C --> D --> E --> F --> G
    G -- No --> X --> Y --> Z
    G -- Yes --> H --> I
    I -- No --> X
    I -- Yes --> J --> K --> L --> M --> N
```

---

## 7. AD-005 Dashboard

**Related Use Case:** `UC-005`  
**Related Requirements:** `FR-DASH-*`  
**Status:** Partially implemented — covered partly by the real scan/findings view; Quality Score (F), Scan History trend (I), and AI Summary (J) are not yet implemented

```mermaid
flowchart TD
    A[Select Repository]
    B[Validate Access]
    C{Authorized?}
    D[Load Latest Scan]
    E{Scan Exists?}
    F[Load Quality Score]
    G[Load Issue Counts]
    H[Load Severity Distribution]
    I[Load Scan History]
    J[Load AI Summary if available]
    K[Render Dashboard]
    L[User selects metric / issue group]
    M[Open related Issue List]
    X[Access Denied]
    Y[Show No Scan Data]

    A --> B --> C
    C -- No --> X
    C -- Yes --> D --> E
    E -- No --> Y
    E -- Yes --> F --> G --> H --> I --> J --> K --> L --> M
```

---

## 8. AD-006 Issue Review and Status Management

**Related Use Case:** `UC-006`  
**Related Requirements:** `FR-ISSUE-*`, `FR-PRIO-*`  
**Status:** Partially implemented — Finding detail (rule/file/line/severity) is implemented; Code Snippet (F), AI Explanation (G), Priority/Source/Confidence (P), Update Status (I), Add Note (J), and Submit Priority Label (Q) are not yet implemented (there is no persistent Issue entity, status field, or note field)

```mermaid
flowchart TD
    A[Open Issue]
    B[Validate Access]
    C{Authorized?}
    D[Load Issue Detail]
    E[Show Rule / File / Line / Severity]
    F[Show Code Snippet]
    G[Show AI Explanation if available]
    P[Show Priority / Source / Confidence]
    H{User Action}
    I[Update Status]
    J[Add Note]
    Q[Submit Human-reviewed Priority Label]
    K[Validate Permission]
    L{Allowed?}
    M[Save Change]
    N[Write Status History]
    O[Refresh Issue]
    X[Access Denied]
    Y[Read-only View]

    A --> B --> C
    C -- No --> X
    C -- Yes --> D --> E --> F --> P --> G --> H
    H -->|Update Status| I --> K --> L
    H -->|Add Note| J --> K
    H -->|Submit Priority Label| Q --> K
    L -- Yes --> M --> N --> O
    L -- No --> Y
```

---

## 9. AD-007 Search / Filter / Sort Issues

**Related Use Case:** `UC-007`  
**Related Requirements:** `FR-FILTER-*`  
**Status:** Partially implemented — only text search and severity filter (step C, partial) exist; category/status/language filters and sort (step D) are not yet implemented

```mermaid
flowchart TD
    A[Open Issue List]
    B[Enter Search / Filter Criteria]
    C[Select Severity / Category / Status / Language]
    D[Select Sort Order]
    E[Validate Query]
    F[Query Issues]
    G{Results Found?}
    H[Show Filtered Results]
    I[Select Issue]
    J[Open Issue Detail]
    X[Show Empty State]
    Y[Clear Filters]

    A --> B --> C --> D --> E --> F --> G
    G -- Yes --> H --> I --> J
    G -- No --> X --> Y --> F
```

---

## 10. AD-008 Report Generation

**Related Use Case:** `UC-008`  
**Related Requirements:** `FR-REPORT-*`  
**Status: Not yet implemented** — no report generation or download endpoint exists in the codebase; this whole flow is planned scope

```mermaid
flowchart TD
    A[Select Repository]
    B[Select Completed Scan]
    C[Validate Access]
    D{Authorized?}
    E[Load Repository Data]
    F[Load Score and Issue Summary]
    G[Load Issue Details]
    H[Load AI Summary if available]
    I[Generate Report]
    J{Generation Success?}
    K[Store Report Metadata]
    L[Provide Download]
    X[Access Denied]
    Y[Show Report Error]

    A --> B --> C --> D
    D -- No --> X
    D -- Yes --> E --> F --> G --> H --> I --> J
    J -- Yes --> K --> L
    J -- No --> Y
```

---

## 11. AD-009 User and Permission Management

**Related Use Case:** `UC-009`  
**Related Requirements:** `FR-USER-*`  
**Status:** Partially implemented — repository-level permission is implemented via membership roles (owner/editor/viewer) set at repository creation; the Administrator-facing user list/search/role-change/suspend flow shown here is not yet implemented

```mermaid
flowchart TD
    A[Administrator opens User Management]
    B[Search / Select User]
    C[View User Detail]
    D{Action}
    E[Change Role]
    F[Activate / Suspend]
    G[Change Repository Permission]
    H[Validate Change]
    I{Valid?}
    J[Save]
    K[Write Audit Information]
    L[Show Success]
    X[Show Error]

    A --> B --> C --> D
    D --> E --> H
    D --> F --> H
    D --> G --> H
    H --> I
    I -- Yes --> J --> K --> L
    I -- No --> X
```

---

## 12. AD-010 Scan History

**Related Use Case:** `UC-010`  
**Related Requirements:** `FR-REP-008`, `FR-SCAN-009`  
**Status:** Implemented

```mermaid
flowchart TD
    A[Select Repository]
    B[Validate Access]
    C{Authorized?}
    D[Load Scan History]
    E{History Exists?}
    F[Show Scan Date / Branch / Commit / Status]
    G[Show Score / Issue Count]
    H[Select Historical Scan]
    I[Open Scan Detail]
    J[Optional Re-scan]
    X[Access Denied]
    Y[Show Empty State]

    A --> B --> C
    C -- No --> X
    C -- Yes --> D --> E
    E -- No --> Y
    E -- Yes --> F --> G --> H --> I
    I --> J
```

---

## 13. AD-011 MCP Context Access

**Related Use Case:** `UC-011`  
**Related Requirements:** `FR-MCP-*`  
**Status: Not yet implemented** — no MCP integration exists in the codebase; this whole flow is planned scope

```mermaid
flowchart TD
    A[AI Coding Assistant connects]
    B[Send MCP Request]
    C[Validate Request]
    D[Validate Authorization]
    E{Authorized?}
    F[Identify Resource / Tool]
    G{Supported?}
    H[Load Coding Standard / Context]
    I[Filter Authorized Data]
    J[Return MCP Response]
    K[Log Request]
    X[Return Unauthorized]
    Y[Return Unsupported Resource]

    A --> B --> C --> D --> E
    E -- No --> X
    E -- Yes --> F --> G
    G -- No --> Y
    G -- Yes --> H --> I --> J --> K
```

---

## 14. AD-012 Priority Model Evaluation and Activation

**Related Use Case:** `UC-012`  
**Related Requirements:** `FR-PRIO-006`, `FR-PRIO-007`  
**Status: Not yet implemented** — no supervised ML / priority-prediction engine exists in the codebase; this whole flow is planned scope

```mermaid
flowchart TD
    A[Open Model Evaluation]
    B[Load Candidate / Baseline / Dataset Metadata]
    C{Evaluation Completed?}
    D{Leakage Check Passed?}
    E{Metrics Meet Promotion Criteria?}
    F[Administrator Confirms Activation]
    G[Verify Authorization and Artifact Checksum]
    H[Activate Candidate and Retire Previous Model]
    I[Write AuditLog]
    X[Block Activation and Show Reason]

    A --> B --> C
    C -- No --> X
    C -- Yes --> D
    D -- No --> X
    D -- Yes --> E
    E -- No --> X
    E -- Yes --> F --> G --> H --> I
```

---

## 15. Activity Diagram Traceability

| Activity Diagram | Use Case | Requirement |
|---|---|---|
| AD-001 | UC-001 | `FR-AUTH-*` |
| AD-002 | UC-002 | `FR-REP-*` |
| AD-003 | UC-003 | `FR-SCAN-*` |
| AD-004 | UC-004 | `FR-AI-*` |
| AD-005 | UC-005 | `FR-DASH-*` |
| AD-006 | UC-006 | `FR-ISSUE-*`, `FR-PRIO-001`–`FR-PRIO-005`, `FR-PRIO-008` |
| AD-007 | UC-007 | `FR-FILTER-*` |
| AD-008 | UC-008 | `FR-REPORT-*` |
| AD-009 | UC-009 | `FR-USER-*` |
| AD-010 | UC-010 | `FR-REP-008`, `FR-SCAN-009` |
| AD-011 | UC-011 | `FR-MCP-*` |
| AD-012 | UC-012 | `FR-PRIO-006`, `FR-PRIO-007` |

---

## 15. Design Notes

- Activity Diagrams describe workflow, not component-level communication.
- Component communication will be defined in Sequence Diagrams.
- Business logic that is not visible to users may be refined in architecture documents.
- Diagram IDs must remain stable once referenced by SRS or Test Cases.
