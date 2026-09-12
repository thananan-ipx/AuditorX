# Screen Specifications

> **Project:** AuditorX  
> **Status:** Draft

---

## 1. Purpose

กำหนดหน้าจอหลักและพฤติกรรม UI ของ AuditorX เพื่อใช้เป็นฐานในการพัฒนา Frontend และทดสอบ Acceptance/UI Flow

---

## 2. SCR-001 Login

**Related Use Case:** `UC-001`

### Purpose
ให้ผู้ใช้งานเข้าสู่ระบบ

### Components
- Email input
- Password input
- Login button
- Validation message

### States
- default
- submitting
- invalid credentials
- suspended account
- success

---

## 3. SCR-002 Repository List

**Related Use Case:** `UC-002`

**Implementation:** `frontend/features/repositories/pages/repositories-page.tsx`.

### Components
- Repository cards (2-column grid), each showing owner/name, branch, access level badge, and status
- Search — **Not yet built.** No search input exists on this screen
- Add Repository — implemented as an inline form: **HTTPS GitHub URL + branch only.** No repository code is downloaded and no GitHub OAuth/permission is requested at this step; branch/URL reachability is not validated client-side. Only shown when `capabilities.repository_creation` is true
- Repository status — implemented (badge; shows "Sample data" in demo/prototype mode)
- Last scan — **Not yet built.** Not shown on the list card
- Primary language — **Not yet built.** Not shown on the list card
- Pagination — implemented as Previous/Next controls (page size 20), shown only when `capabilities.repository_storage === "postgres"`

### Actions
- Add — implemented (see above)
- View — implemented ("Open dashboard" link per card)
- Edit — **Not yet built.** No repository edit UI exists
- Delete where permitted — **Not yet built.** No repository delete UI exists

---

## 4. SCR-003 Repository Detail

**Related:** `UC-002`, `UC-010`

**Implementation status:** There is no standalone Repository Detail screen. Opening a repository navigates to the Dashboard route (`/dashboard?repository={id}`), which branches into one of: the sample-data prototype dashboard, an "unscanned"/scan-queue-unavailable placeholder, or — when Postgres + scan queue are enabled — the real Scans workspace (see SCR-004/SCR-008 below), which is the closest implemented equivalent of this screen today.

### Components
- Repository metadata — implemented (owner/name, branch, access level)
- Default branch — implemented
- Latest scan — implemented (within the Scans workspace, via Scan History/Scan Detail)
- Quality score — **Not yet built** in the real workspace; present only in the sample-data prototype dashboard
- Start Scan — implemented, gated to `access_level` of owner or editor
- Scan History — implemented (latest 20 scans)
- Issue summary — implemented only as a per-scan Findings list (High/Medium/Low counts), not a repository-level rollup

---

## 5. SCR-004 Scan Configuration

**Related Use Case:** `UC-003`

**Implementation:** There is no separate scan-configuration screen; Start/Cancel controls live directly in the Scans workspace (`frontend/features/scans/components/repository-scans.tsx`), part of the Dashboard route.

### Inputs
- Branch — implemented, but not user-editable at scan time: the scan uses the repository's already-registered branch
- Rule profile — **Not yet built.** There is no rule-profile selection; every scan runs the single fixed `baseline-v1` ruleset (see `docs/08-quality/semgrep-rules.md`)

### Actions
- Start Scan — implemented, gated to `access_level` of owner or editor (read-only users see "Only repository owners and editors can start or cancel scans.")
- Cancel while the scan is queued or running — implemented, same role gating

### States

Actual implemented `ScanStatus` values: `queued`, `running`, `completed`, `failed`, `cancelled`. ("Ready"/"Validating"/"Pending" below describe a richer target flow not currently implemented — the UI's "Ready" and "loading" labels refer to the workspace's own load state, not a per-scan status.)

- Ready
- Validating
- Pending
- Running
- Completed
- Failed
- Cancelled

---

## 6. SCR-005 Dashboard

**Related Use Case:** `UC-005`

**Implementation status:** All components below (Quality Score, Predicted Priority distribution, priority model/baseline version, Category distribution, Scan trend, AI summary) exist today only in the legacy sample-data prototype dashboard (`frontend/features/dashboard/pages/dashboard-page-client.tsx`), shown when `repository_storage !== "postgres"`. When Postgres + scan queue are enabled, this route instead renders the Scans workspace (SCR-004/SCR-008/SCR-006 below), which has none of these widgets. See `docs/07-ui/dashboard.md` for details.

### Components
- Repository name
- Quality Score — **Not yet built** in the real workspace
- Total Issues — implemented in the real workspace only as per-scan High/Medium/Low counts, not a repository-level total
- Severity distribution — implemented in the real workspace as High/Medium/Low only (no Critical)
- Predicted Priority distribution — **Not yet built.** No priority prediction exists anywhere in the real UI
- Active priority model/baseline version and fallback count — **Not yet built.** No priority model exists
- Category distribution — **Not yet built.** Findings carry no category field today
- Scan trend — **Not yet built** in the real workspace
- AI summary — **Not yet built.** No AI summary/explanation panel exists in the real workspace
- Latest scan metadata — implemented (status, branch, commit, rules version, scanner version, timestamps)

### Actions
- Navigate to filtered Issue List — implemented only as the in-page Findings search/severity filter on a selected scan, not a dedicated Issue List screen
- Open Scan History — implemented
- Generate Report — **Not yet built.** No report generation exists anywhere in the UI

---

## 7. SCR-006 Issue List

**Related:** `UC-006`, `UC-007`

**Implementation status:** There is no standalone Issue List screen. The closest implemented equivalent is the read-only Findings list embedded under a selected, completed scan in the Scans workspace (`frontend/features/scans/components/repository-scans.tsx`), described accurately below where it overlaps.

### Columns / Data
- Severity — implemented (High/Medium/Low only, no Critical)
- Rule — implemented (rule ID, e.g. `auditorx.python.dynamic-eval`)
- Category — **Not yet built.** No category field on findings
- File — implemented (file path plus line/end-line)
- Line — implemented
- Status — **Not yet built.** Findings have no status workflow; they are read-only
- Predicted Priority — **Not yet built.** No priority prediction exists
- Priority Source — **Not yet built.**
- Confidence — **Not yet built.**

### Filters
- Search — implemented (free-text match against file, rule ID and message)
- Severity — implemented (High/Medium/Low/All)
- Category — **Not yet built.**
- Status — **Not yet built.**
- Language — **Not yet built.**
- Predicted Priority — **Not yet built.**
- Priority Source — **Not yet built.**
- Sort — **Not yet built.** Findings are shown in scan result order with pagination (50 per page, up to 1,000 findings total)

### Actions
- Open Issue Detail — **Not yet built.** Findings do not expand into a detail view; all data shown above is inline in the list row
- Clear filters — **Not yet built.** No explicit clear-filters control (filters can be reset manually)

---

## 8. SCR-007 Issue Detail

**Related:** `UC-004`, `UC-006`

**Implementation status: Not yet built.** There is no Issue Detail screen or expand-to-detail interaction; every field below is a planned feature. All fields a finding does carry today (rule ID, severity, file, line/end-line, message) are shown inline in the SCR-006 Findings list row.

### Components
- Issue title
- Rule ID
- Severity
- Category
- File path
- Line/Column
- Code Snippet
- Static Analysis message
- AI summary
- Root cause
- Impact
- Recommendation
- Predicted Priority
- Priority source, predictor version and confidence/probabilities
- Latest human-reviewed Priority Label where authorized
- LLM priority explanation
- Confidence note
- Issue status
- Notes
- Status history

### Actions
- Change status
- Add note
- Request AI re-analysis
- Reviewer/Administrator submits a reviewed Priority Label with rationale

---

## 9. SCR-008 Scan History

**Related Use Case:** `UC-010`

**Implementation:** Embedded panel in the Scans workspace, not a standalone screen. Shows the latest 20 scans, newest first.

### Components
- Scan date — implemented (queued/created timestamp on the list; started/finished timestamps in Scan Detail)
- Branch — implemented
- Commit SHA — implemented, but shown in Scan Detail rather than the list row
- Status — implemented (queued/running/completed/failed/cancelled)
- Quality Score — **Not yet built.** Not associated with scans
- Issue count — implemented only in Scan Detail's Findings panel (High/Medium/Low counts for that scan), not on the Scan History list row

### Actions
- Open Scan Detail — implemented (select a scan from the list)
- Re-scan — **Not yet built.** Only a fresh "Start scan" action exists; there is no one-click re-scan of a prior scan's branch/commit

---

## 10. SCR-009 Reports

**Related Use Case:** `UC-008`

**Implementation status: Not yet built.** No report screen, generation, export or download exists anywhere in the UI. The "Reports" sidebar item is present but disabled ("Soon") in `frontend/components/layout/dashboard-shell.tsx`.

### Components
- Report list
- Repository
- Scan
- Format
- Generated by
- Created time
- Status

### Actions
- Generate
- Download

---

## 11. SCR-010 User Management

**Related Use Case:** `UC-009`

Administrator only.

**Implementation status: Not yet built.** No user list, search, role assignment, or enable/disable UI exists anywhere in the frontend. The sidebar's "Team" item stands in for this screen but is disabled ("Soon") in `frontend/components/layout/dashboard-shell.tsx`.

### Components
- User list
- Search
- Role
- Account status
- Repository permissions

### Actions
- Change role
- Activate/Suspend
- Update repository access

---

## 12. SCR-011 Profile

**Implementation status: Not yet built.** No profile feature/page exists in `frontend/features`; there is no separate "Profile" sidebar item either — only a logout control at the bottom of the sidebar.

### Components
- First name
- Last name
- Email
- Role (read-only unless admin flow)

### Actions
- Update allowed fields

---

## 13. SCR-012 Model Evaluation

**Primary Actor:** Administrator  
**Related Use Case:** `UC-012`  
**Related Requirements:** `FR-PRIO-006`, `FR-PRIO-007`

**Implementation status: Not yet built.** No priority/ML model exists yet, so there is nothing to evaluate. The sidebar's "Model evaluation" item is present but disabled ("Soon") in `frontend/components/layout/dashboard-shell.tsx`.

### Components
- Active model/baseline version
- Candidate model list
- Dataset and feature-schema versions
- Candidate versus baseline Macro-F1
- Per-class Precision/Recall/F1
- Critical Recall
- Confusion Matrix
- Leakage-check status
- Reproducibility metadata

### Actions
- Open EvaluationRun detail
- Activate an eligible Candidate model
- View the reason an ineligible model cannot be activated

### Rules
- UI must not imply that a model is better when promotion criteria are not satisfied.
- Metric labels must identify dataset partition and version.
- Activation requires confirmation and backend authorization.

---

## 14. UI Validation Rules

- Required fields show validation before submission where appropriate.
- API validation is authoritative.
- Errors must be understandable.
- Sensitive internal details must not be shown.
- Destructive actions require confirmation.
- Long-running actions show progress/status.

---

## 15. Accessibility / Usability

- Severity should not rely on color alone.
- Interactive elements should have labels.
- Empty states must explain next action.
- Loading and failure states should be explicit.
- Code snippets should preserve formatting and allow readable horizontal scrolling if needed.
