# Test Cases

> **Project:** AuditorX  
> **Status:** Draft

---

## 1. Test Case Convention

Use:

```text
TC-<AREA>-<NUMBER>
```

> **Implementation status note:** Section 5 (AI Analysis) and Section 15 (Supervised Issue Prioritization), plus TC-DASH-003 and TC-FILTER-003, describe planned functionality. **Not applicable yet — no AI/priority-engine code exists to test.** Section 4 (Scan) is real and implemented: it is exercised by the Go unit/integration tests under `backend/**/*_test.go`, the PGlite-backed database integration suite (API enqueue, persistence across reconnect, exclusive claims, expired-lease reclaim, stale-token rejection, cancellation, atomic rollback, retry exhaustion, revoked membership, HTTP finding retrieval), the fixture-based Semgrep adapter test (real Semgrep when `AUDITORX_TEST_SEMGREP` is set, otherwise a deterministic fake analyzer), and `scripts/verify-scanner.ps1` against static unsafe fixture code.

---

## 2. Authentication

### TC-AUTH-001 Successful Login

**Requirement:** `FR-AUTH-003`  
**Use Case:** `UC-001`

Precondition:
- Active user exists.

Steps:
1. Open login.
2. Enter correct email/password.
3. Submit.

Expected:
- Authentication succeeds.
- User enters application.
- Correct role is available.

---

### TC-AUTH-002 Invalid Login

**Requirement:** `FR-AUTH-005`  
**Use Case:** `UC-001`

Expected:
- Login denied.
- Understandable error displayed.
- No valid session/token created.

---

## 3. Repository

### TC-REP-001 Add Accessible Repository

**Requirement:** `FR-REP-001`, `FR-REP-003`  
**Use Case:** `UC-002`

Expected:
- Provider access validated.
- Repository persisted.
- Repository visible in list.

---

### TC-REP-002 Unauthorized Repository

Expected:
- Repository not added.
- Access denied error.
- No unauthorized source retrieval.

---

## 4. Scan

### TC-SCAN-001 Start Scan

**Requirement:** `FR-SCAN-001`  
**Use Case:** `UC-003`

Expected:
- Scan record created.
- Initial status is Pending.
- Scan progresses according to execution model.

---

### TC-SCAN-002 Successful Semgrep Scan

**Requirement:** `FR-SCAN-004`, `FR-SCAN-006`

Expected:
- Semgrep executes.
- Findings normalized.
- Issues stored with rule/file/line/severity.
- Scan stores `severity_mapping_version = "semgrep-severity-v1"`.

---

### TC-SCAN-003 No Findings

Expected:
- Scan completes.
- Issue count = 0.
- No fake findings are created.

---

### TC-SCAN-004 Semgrep Failure

**Requirement:** `FR-SCAN-008`

Expected:
- Scan marked Failed.
- Error stored safely.
- User can see failed status.

---

### TC-SCAN-005 Re-scan

**Requirement:** `FR-SCAN-009`  
**Use Case:** `UC-010`

Expected:
- New Scan record created.
- Old history remains.

---

### TC-SCAN-006 Cancel Running Scan

**Requirement:** `FR-SCAN-010`  
**Use Case:** `UC-003`

Preconditions:
- Authorized user has a Pending or Running scan.

Expected:
- Cancellation request is accepted.
- Worker stops safely.
- Scan reaches Cancelled.
- Partial findings are not presented as a completed result.

---

## 5. AI Analysis

> **Not applicable yet — no AI/priority-engine code exists to test.** All TC-AI-* cases below describe planned functionality; no AI analysis, structured-output validation, or repository summary exists in the codebase as of 2026-09-12.

### TC-AI-001 Explain Finding

**Requirement:** `FR-AI-002`, `FR-AI-003`, `FR-AI-004`, `FR-AI-005`  
**Use Case:** `UC-004`

Expected:
- Structured output validates.
- Explanation, impact and recommendation stored.
- Priority explanation refers to the persisted system Priority and does not overwrite Prediction, Label, Severity or Quality Score.

---

### TC-AI-002 AI Failure Does Not Break Scan

**Requirement:** `FR-AI-009`, `NFR-REL-001`

Expected:
- Static findings remain visible.
- AI status shows failure/unavailable.
- Scan remains valid.

---

### TC-AI-003 Re-analysis

**Requirement:** `FR-AI-008`

Expected:
- New AI attempt can run.
- Issue persists.
- A new AIAnalysis record is created and the previous attempt remains available for audit/history.
- The latest Completed attempt is selected for display.

---

### TC-AI-004 Repository Summary

**Requirement:** `FR-AI-006`  
**Use Case:** `UC-004`

Preconditions:
- A completed Scan with persisted findings exists.

Expected:
- A separate AIRepositorySummary record is created.
- Structured output is validated before Completed.
- Dashboard can read the latest Completed summary.
- A failed summary does not hide static Scan results.

---

## 6. Dashboard

### TC-DASH-001 Quality Score Display

**Requirement:** `FR-DASH-002`  
**Use Case:** `UC-005`

Expected:
- Score matches deterministic formula.
- Displayed score belongs to correct scan/repository.

---

### TC-DASH-002 No Scan Data

Expected:
- No fabricated score.
- Clear empty state shown.

---

### TC-DASH-003 Priority Overview

**Requirement:** `FR-DASH-008`

> **Not applicable yet — no AI/priority-engine code exists to test.**

Expected:
- Counts match persisted Predictions for the selected Scan.
- Active model/baseline version and fallback count are displayed.
- Priority is not presented as Severity or Quality Score.

---

## 7. Issues

### TC-ISSUE-001 Issue Detail

**Requirement:** `FR-ISSUE-001`–`FR-ISSUE-006`  
**Use Case:** `UC-006`

Expected:
- Rule, severity, file, line, snippet and available AI detail display.

---

### TC-ISSUE-002 Update Status

**Requirement:** `FR-ISSUE-007`, `FR-ISSUE-009`

Expected:
- Authorized user can update.
- History record created.

---

### TC-ISSUE-003 Unauthorized Status Update

Expected:
- Change rejected.
- Existing issue remains unchanged.

---

## 8. Filter

### TC-FILTER-001 Filter by Severity

**Requirement:** `FR-FILTER-002`  
**Use Case:** `UC-007`

Expected:
- Only matching issues displayed/returned.

---

### TC-FILTER-002 Clear Filters

**Requirement:** `FR-FILTER-007`

Expected:
- Filters reset.
- Full permitted collection shown.

---

### TC-FILTER-003 Filter by Priority and Source

**Requirement:** `FR-FILTER-008`, `FR-FILTER-009`

> **Not applicable yet — no AI/priority-engine code exists to test.**

Expected:
- Results match selected predicted Priority and model/baseline source.
- Clear Filters restores the unfiltered authorized result set.

---

## 9. Report

### TC-REPORT-001 Generate Report

**Requirement:** `FR-REPORT-001`–`FR-REPORT-004`  
**Use Case:** `UC-008`

Expected:
- Report generated from selected scan.
- Metadata stored.
- Download available when completed.

---

### TC-REPORT-002 AI Missing

Expected:
- Report can still be generated from static analysis data.

---

## 10. User Management

### TC-USER-001 Change Role

**Requirement:** `FR-USER-004`  
**Use Case:** `UC-009`

Expected:
- Administrator can change role.
- Audit record created.

---

### TC-USER-002 Non-admin Attempts Admin Action

Expected:
- Request rejected with Forbidden.
- No user data modified.

---

## 11. Scan History

### TC-HISTORY-001 View History

**Requirement:** `FR-REP-008`  
**Use Case:** `UC-010`

Expected:
- Previous scans shown separately.
- Date/status/score/issue count correspond to each scan.

---

## 12. MCP

### TC-MCP-001 Authorized Context Request

**Requirement:** `FR-MCP-001`, `FR-MCP-003`  
**Use Case:** `UC-011`

Expected:
- Supported context returned.
- Only authorized content returned.

---

### TC-MCP-002 Unauthorized Context Request

Expected:
- Request rejected.
- Sensitive/private context not returned.

---

## 13. Security

### TC-SEC-001 Protected Endpoint Without Login

Expected:
- 401 Unauthorized.

### TC-SEC-002 Repository Access Violation

Expected:
- 403/appropriate denial.
- No repository data leaked.

### TC-SEC-003 Secret Logging

Expected:
- Password/token/API key absent from logs.

---

## 14. Quality Score

### TC-SCORE-001 Score Calculation v1

Input:

```text
Critical = 1
High = 2
Medium = 3
Low = 5
```

Expected:

```text
Penalty = 36
Score = 64
score_version = v1
```

The persisted Scan also has a non-null `score_calculated_at`.

Related:
- `BR-007`
- `FR-DASH-002`

---

## 15. Supervised Issue Prioritization

> **Not applicable yet — no AI/priority-engine code exists to test.** All TC-PRIO-* cases below describe planned functionality; no feature extraction, model, baseline mapping, or evaluation pipeline exists in the codebase as of 2026-09-12.

### TC-PRIO-001 Valid Model Prediction

**Requirement:** `FR-PRIO-001`, `FR-PRIO-002`

Expected:
- `priority-features-v1` is produced from approved non-LLM features.
- Prediction is one controlled Priority value.
- Probabilities contain all four classes and satisfy validation rules.

### TC-PRIO-002 Prediction Traceability

**Requirement:** `FR-PRIO-003`

Expected:
- Prediction stores Issue, predictor/model version, feature schema, probabilities, confidence and timestamp.
- Later labels or Predictions do not mutate the historical record.

### TC-PRIO-003 Model Failure Baseline

**Requirement:** `FR-PRIO-004`

Given the Active model cannot load or returns invalid output:

Expected:
- `severity-priority-v1` produces the Priority.
- `priority_source` is baseline.
- fallback reason is stored.
- Severity, Quality Score and Semgrep finding remain unchanged.

### TC-PRIO-004 Human-reviewed Label

**Requirement:** `FR-PRIO-005`

Expected:
- Authorized Reviewer/Administrator can append a label with rationale and guideline version.
- Developer without labeling permission is rejected.
- Prior Prediction is unchanged.
- Label event is auditable.

### TC-PRIO-005 Repository-grouped Evaluation

**Requirement:** `FR-PRIO-006`, `FR-PRIO-007`  
**Business Rules:** `BR-017`, `BR-018`

Expected:
- Train, validation and test repository groups are disjoint.
- Candidate and baseline run on the same test partition.
- Macro-F1, per-class metrics, Critical Recall and Confusion Matrix are stored.
- Model cannot activate when leakage check fails or promotion thresholds are not met.

### TC-PRIO-006 Priority Separation

**Requirement:** `FR-PRIO-008`

Expected:
- Prediction does not overwrite Issue Severity.
- Prediction does not modify deterministic Code Quality Score.
- LLM response cannot overwrite Prediction or human-reviewed Label.
