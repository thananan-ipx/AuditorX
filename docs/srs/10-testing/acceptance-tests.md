# Acceptance Tests

> **Project:** AuditorX  
> **Status:** Draft

---

## 1. Purpose

Acceptance Tests ใช้ตรวจสอบว่า AuditorX Prototype สามารถตอบสนองกระบวนการหลักตาม SRS ได้

> **Implementation status note:** AC-005, AC-006, AC-017, AC-018 and AC-019 describe planned AI-explanation and priority-engine behavior. **Not applicable yet — no AI/priority-engine code exists to test.** As of 2026-09-12, every scan result is shown exactly as Semgrep produces it, with no AI explanation, summary, or prioritization layer. The remaining acceptance criteria below cover the real, implemented scan/repository/auth pipeline.

---

## AC-001 Login

Given an active user exists  
When correct credentials are submitted  
Then the user can enter the system according to assigned role.

Related:
- `UC-001`
- `FR-AUTH-003`

---

## AC-002 Add Repository

Given an authenticated user has provider access  
When the user adds a valid repository  
Then AuditorX stores and displays the repository.

Related:
- `UC-002`
- `FR-REP-001`

---

## AC-003 Start Source Code Scan

Given an accessible repository exists  
When Developer selects branch/rule profile and starts scan  
Then a scan record is created and analysis begins.

Related:
- `UC-003`
- `FR-SCAN-001`

---

## AC-004 Persist Static Findings

Given Semgrep finds issues  
When the scan completes  
Then AuditorX stores normalized issues including rule, file, line and severity.

Related:
- `FR-SCAN-006`

---

## AC-005 AI Explanation

> **Not applicable yet — no AI/priority-engine code exists to test.** No AI analysis runs today; this criterion describes planned functionality.

Given an issue exists and AI service is available  
When AI analysis runs  
Then AuditorX displays explanation, impact and recommendation.

Related:
- `UC-004`
- `FR-AI-002`
- `FR-AI-003`
- `FR-AI-004`

---

## AC-006 AI Graceful Degradation

> **Not applicable yet — no AI/priority-engine code exists to test.** There is no AI service to be unavailable; today Semgrep findings are always shown with no AI layer at all, which trivially satisfies the spirit of this criterion but cannot exercise the described degradation path.

Given static scan succeeded  
And AI service is unavailable  
When the user views scan results  
Then Semgrep findings remain available and AI is shown as unavailable/failed.

Related:
- `FR-AI-009`
- `NFR-REL-001`

---

## AC-007 Dashboard

Given a completed scan exists  
When user opens repository dashboard  
Then score, issue count, severity distribution and latest scan information are displayed.

Related:
- `UC-005`
- `FR-DASH-*`

---

## AC-008 Issue Detail

Given an issue exists  
When user opens issue detail  
Then rule, severity, file, line and code snippet are displayed.

Related:
- `UC-006`
- `FR-ISSUE-*`

---

## AC-009 Issue Filtering

Given multiple issues exist  
When user filters by severity/status/category  
Then only matching permitted issues are shown.

Related:
- `UC-007`
- `FR-FILTER-*`

---

## AC-010 Issue Status

Given an authorized user opens an issue  
When status is changed  
Then issue is updated and status history is recorded.

Related:
- `FR-ISSUE-007`
- `FR-ISSUE-009`

---

## AC-011 Scan History

Given a repository has multiple scans  
When user opens scan history  
Then each scan is shown separately with relevant metadata.

Related:
- `UC-010`
- `FR-REP-008`
- `FR-SCAN-009`

---

## AC-012 Generate Report

Given a completed scan exists  
When user requests a report  
Then AuditorX generates a report using available static analysis data and AI summary if available.

Related:
- `UC-008`
- `FR-REPORT-*`

---

## AC-013 Repository Authorization

Given a user has no access to a repository  
When the user attempts to access repository data  
Then the operation is rejected and no protected data is returned.

Related:
- `BR-003`
- `NFR-SEC-002`

---

## AC-014 User Administration

Given an Administrator is authenticated  
When role/status/repository permission is changed  
Then the change is persisted and auditable.

Related:
- `UC-009`
- `FR-USER-*`

---

## AC-015 MCP Prototype

Given a compatible MCP client is authorized  
When it requests a supported coding-standard resource  
Then AuditorX returns only authorized context.

Related:
- `UC-011`
- `FR-MCP-*`

---

## AC-016 Cancel Scan

> **Verified**: covered by the PGlite-backed database integration suite's cancellation test, which confirms a cancelled/expired/reclaimed job cannot publish results.

Given an authorized user has a Pending or Running scan  
When the user requests cancellation  
Then the worker stops safely, the Scan becomes Cancelled, and no partial result is presented as Completed.

Related:
- `UC-003`
- `FR-SCAN-010`

---

## AC-017 Repository AI Summary

> **Not applicable yet — no AI/priority-engine code exists to test.** No repository-summary generation exists in the codebase.

Given a completed Scan with persisted findings exists  
When an authorized user requests a repository summary  
Then the validated summary is stored separately and becomes available on the Dashboard without replacing deterministic static metrics.

Related:
- `UC-004`
- `FR-AI-006`
- `FR-DASH-006`

---

## AC-018 Issue Prioritization and Fallback

> **Not applicable yet — no AI/priority-engine code exists to test.** No priority model, predictor or baseline mapping exists in the codebase.

Given a normalized Issue exists  
When the Active supervised model is available  
Then AuditorX stores a versioned Priority Prediction with confidence and source.

Given the model is unavailable  
When Priority is requested  
Then AuditorX uses `severity-priority-v1`, identifies the baseline source and preserves Severity, Quality Score and static findings.

Related:
- `FR-PRIO-001`–`FR-PRIO-004`
- `FR-PRIO-008`

---

## AC-019 Reproducible Model Evaluation

> **Not applicable yet — no AI/priority-engine code exists to test.** No dataset, model, or evaluation pipeline exists in the codebase.

Given a versioned human-reviewed dataset and candidate model exist  
When an evaluation run completes  
Then repository partitions are disjoint, candidate and baseline metrics are stored, and activation is allowed only when leakage and promotion criteria pass.

Related:
- `FR-PRIO-005`–`FR-PRIO-007`
- `BR-016`–`BR-018`
- `NFR-MAIN-005`

---

## 2. Prototype Acceptance Summary

The prototype is considered acceptable when:

1. Core authentication works.
2. Repository can be added and authorized.
3. Supported source can be scanned with Semgrep.
4. Findings include usable file/line information.
5. AI explanation works for representative findings. — *not applicable yet, no AI code exists*
6. AI failure does not invalidate static findings. — *not applicable yet, no AI code exists to fail; today findings are simply shown without any AI layer*
7. Dashboard displays deterministic metrics.
8. Issue workflow and history work.
9. Scan history works.
10. Report generation works.
11. Admin authorization works.
12. MCP prototype demonstrates authorized context retrieval.
13. Pending or Running scans can be cancelled safely.
14. Repository AI Summary is traceable to a completed Scan. — *not applicable yet, no AI code exists*
15. Issue Priority is versioned, explainable and visibly sourced from model or baseline. — *not applicable yet, no priority-engine code exists*
16. Human-reviewed labels remain separate from immutable Predictions. — *not applicable yet, no priority-engine code exists*
17. Model evaluation is leakage-safe and reproducible. — *not applicable yet, no priority-engine code exists*
18. No blocker defect remains in the critical flow.
