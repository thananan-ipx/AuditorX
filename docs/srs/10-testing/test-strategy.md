# Test Strategy

> **Project:** AuditorX  
> **Status:** Draft

---

## 1. Purpose

กำหนดแนวทางการทดสอบ AuditorX เพื่อให้ Functional Requirements, Non-Functional Requirements และ Integration สำคัญได้รับการตรวจสอบอย่างเป็นระบบ

---

> **Implementation status note:** Real, runnable tests exist today for the scan/repository/auth pipeline (Go unit and PGlite-backed integration tests under `backend/**/*_test.go`, plus `scripts/verify.ps1` and `scripts/verify-scanner.ps1`, and frontend service/controller/markup tests under `frontend/tests`). Items below referring to AI provider abstraction, the Priority model/predictor, or evaluation endpoints are **not applicable yet — no AI/priority-engine code exists to test.** They remain as planned targets for when that functionality is built.

## 2. Test Levels

### Unit Testing
Targets:
- domain rules
- score calculation
- severity mapping
- validation
- status transition
- adapters/parsers
- priority feature extraction and baseline mapping — *not applicable yet, no priority-engine code exists*
- prediction output validation — *not applicable yet, no priority-engine code exists*

### Integration Testing
Targets:
- database repositories — **implemented**: PGlite-backed integration suite applies real migrations and exercises API enqueue, persistence across reconnect, exclusive job claims, expired-lease reclaim, stale-token rejection, cancellation, atomic rollback on failed publish, retry exhaustion, revoked membership handling and HTTP finding retrieval
- Semgrep adapter — **implemented**: fixture source adapter with a synthetic commit ID and the real safe ZIP extractor; with `AUDITORX_TEST_SEMGREP` set the integration test runs the real Semgrep binary, otherwise a deterministic fake analyzer covers orchestration
- GitHub integration abstraction — **implemented** for the public, unauthenticated retrieval path exercised in tests; a live public-GitHub retrieval test remains required and not yet run
- AI provider abstraction — **not applicable yet — no AI/priority-engine code exists to test.**
- Priority model adapter and registry — **not applicable yet — no AI/priority-engine code exists to test.**
- API handlers + services — **implemented**: Go handler and service tests across user/project/scan modules

### API Testing
Targets:
- authentication
- authorization
- repository access
- scan flow
- issue management
- reporting
- priority labels, model and evaluation endpoints — **not applicable yet — no AI/priority-engine code exists to test.**

### UI Testing
Targets:
- navigation
- forms
- filters
- loading/error states
- role-based visibility
- model/baseline source and evaluation-metric presentation — **not applicable yet — no AI/priority-engine code exists to test.**

### End-to-End Testing
Critical flows:
- Login → Repository → Scan → Issue → AI → Dashboard — *the AI step is not applicable yet, no AI code exists*; there is also no live, signed-in, full-stack browser end-to-end test yet (frontend+API+worker+real Supabase together) — this remains required but not done
- Scan → Report
- Admin → User permission
- Scan History
- Issue → Priority Prediction → Human-reviewed Label — *not applicable yet — no AI/priority-engine code exists to test*

---

## 3. Test Environments

Recommended:

- local unit test
- isolated integration test
- docker-based application test
- controlled POC/demo environment

---

## 4. Test Data

Use dedicated non-sensitive repositories and fixtures.

Do not use real secrets.

Test datasets should include:

- no finding
- low severity finding
- multiple severity levels
- malformed analyzer output
- AI unavailable — *not applicable yet, since there is no AI call to fail; today every result already excludes AI content*
- GitHub unavailable
- unauthorized repository
- multiple scan history records
- imbalanced human-reviewed priority labels — *not applicable yet — no AI/priority-engine code exists to test*
- multiple repositories for leakage-safe split testing — *not applicable yet — no AI/priority-engine code exists to test*
- priority model unavailable/invalid output — *not applicable yet — no AI/priority-engine code exists to test*

---

## 5. Mocking Strategy

Mock external systems for deterministic tests:

- GitHub
- OpenAI API — *not applicable yet, no AI provider integration exists*
- PriorityPredictor — *not applicable yet, no priority-engine code exists*

Semgrep should have both:
- adapter/unit tests with fixtures — **implemented** via the fixture source adapter and deterministic fake analyzer
- at least selected integration tests running actual Semgrep — **implemented**: the real Semgrep binary runs when `AUDITORX_TEST_SEMGREP` is set, and `scripts/verify-scanner.ps1` runs the real executable against deliberately unsafe static fixture code

---

## 6. Security Testing

Minimum checks:

- unauthenticated API access
- repository access violation
- admin endpoint access
- invalid tokens/session
- malicious input
- secret leakage in responses/logs
- path handling
- AI context minimization behavior — *not applicable yet — no AI/priority-engine code exists to test*
- model activation authorization and artifact-metadata exposure — *not applicable yet — no AI/priority-engine code exists to test*

---

## 7. Non-functional Testing

### Performance
Measure:
- common API response
- dashboard aggregation
- representative scan duration

### Reliability
Test:
- AI failure after successful Semgrep — *not applicable yet, no AI call exists to fail; today Semgrep results are shown with no AI layer at all*
- failed source retrieval — **implemented**: covered by the durable scan pipeline's terminal-failure and lease-reclaim tests
- database error behavior — **implemented**: covered by the PGlite integration suite (atomic rollback on failed publish, retry exhaustion, stale-token rejection)
- repeated requests — **implemented**: covered by duplicate-action and `409 SCAN_CONFLICT` handling tests

### Compatibility
Test modern supported browser(s) for POC.

### Supervised Model Evaluation

**Not applicable yet — no AI/priority-engine code exists to test.** `evaluation-protocol.md` describes a planned evaluation methodology for a model that has not been built; none of the items below can be executed today:

- Repository-grouped partitions are disjoint
- preprocessing is fitted on training data only
- candidate and baseline use the same untouched test partition
- Macro-F1, per-class metrics, Critical Recall and Confusion Matrix are reproducible
- model selection uses validation data, not test results
- human label agreement is reported on an overlapping subset
- negative or non-significant results remain reportable

---

## 8. Entry Criteria

Feature ready for formal testing when:

- requirement identified
- implementation complete enough
- test environment available
- critical dependencies available/mocked

---

## 9. Exit Criteria

For POC/MVP:

- critical acceptance flows pass
- no known blocker defect
- authorization checks pass
- scan findings persist correctly
- AI failure degrades gracefully — *not applicable yet, no AI code exists to fail; today's baseline is simply "no AI layer is shown"*
- Priority model failure uses the versioned baseline visibly — *not applicable yet — no AI/priority-engine code exists to test*
- candidate promotion criteria and leakage check pass — *not applicable yet — no AI/priority-engine code exists to test*
- evaluation artifacts contain required reproducibility metadata — *not applicable yet — no AI/priority-engine code exists to test*
- report flow works
- traceability updated

---

## 10. Defect Severity

| Level | Meaning |
|---|---|
| Blocker | Core flow cannot proceed |
| Critical | Security/data integrity or major core failure |
| Major | Important feature incorrect |
| Minor | Limited functional/UI issue |
| Cosmetic | Presentation-only issue |

---

## 11. Traceability

Every formal test case should reference:
- Requirement ID
- Use Case ID where relevant
- Test Case ID
