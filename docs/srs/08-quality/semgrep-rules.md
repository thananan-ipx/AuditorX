# Semgrep Rules Strategy

> **Project:** AuditorX  
> **Analyzer:** Semgrep Community Edition  
> **Status:** Draft  
> **Related:** `FR-SCAN-*`, `UC-003`

---

## 1. Purpose

กำหนดแนวทางเลือก จัดกลุ่ม และบริหาร Semgrep Rules สำหรับ AuditorX

**Implementation status:** Today AuditorX runs exactly **3 active rules** in one fixed, embedded ruleset called `baseline-v1` (`backend/internal/modules/scan/rules/baseline-v1.yaml`, embedded into the scan worker via `go:embed`). There is no rule catalog, no rule profiles, and no per-scan rule selection yet — every scan uses `baseline-v1` and only `baseline-v1`. The 3 rules:

| Rule ID | Language(s) | Semgrep severity | AuditorX severity | Check |
|---|---|---|---|---|
| `auditorx.python.dynamic-eval` | Python | ERROR | High | dynamic `eval(...)` call |
| `auditorx.javascript.dynamic-eval` | JavaScript, TypeScript | ERROR | High | dynamic `eval(...)` call |
| `auditorx.go.tls-verification-disabled` | Go | ERROR | High | `tls.Config{InsecureSkipVerify: true}` |

The scan worker (`backend/internal/modules/scan/scanner.go`) pins Semgrep Community Edition to exactly version `1.175.0` and fails closed (returns no findings) if the installed Semgrep reports a different `version` in its JSON output, if it reports any scanner errors, if it returns more than 1000 results, or if a result references a rule ID outside this list of 3. Everything else in this document below (rule categories, profiles, custom-rule structure, rule repository layout) describes the planned target design for a future, larger rule catalog and is not yet implemented.

---

## 2. Rule Categories

AuditorX groups rules into:

- Security
- Code Quality
- Coding Standard
- Best Practice

---

## 3. Initial Language Scope

- JavaScript
- TypeScript
- Python
- Go

Rules must be explicitly compatible with supported languages.

---

## 4. Rule Sources

Potential rule sources:

1. Semgrep-provided community/open rules
2. AuditorX custom rules
3. Organization-specific rules in future

For the academic POC, use only rule sources that can be legally and technically used within the project.

---

## 5. Rule Profile Concept

**Implementation status: Not yet built.** There is no profile concept today; every scan runs the single fixed `baseline-v1` ruleset described in Section 1.

Instead of selecting individual rules every time, AuditorX should support profiles.

Example profiles:

### default

Balanced rule set for general quality review.

### security

Security-focused checks.

### quality

Maintainability and common quality problems.

### strict

Broader or stricter rule profile for demonstration/testing.

---

## 6. Rule Metadata

AuditorX should normalize useful metadata:

```text
rule_id
name/title
message
category
source severity
AuditorX severity
language
references
tags
```

---

## 7. Severity Mapping

Source severity from Semgrep must be converted through a controlled mapping.

Authoritative MVP mapping (`severity_mapping_version = "semgrep-severity-v1"`):

| Semgrep | AuditorX |
|---|---|
| ERROR | High |
| WARNING | Medium |
| INFO | Low |

Critical should only be assigned by an explicit AuditorX rule/mapping policy, not guessed by AI.

Every Scan must store the mapping version. A future mapping change requires a new version and must not reinterpret historical findings silently.

**Implementation status:** This ERROR→High / WARNING→Medium / INFO→Low mapping is implemented in `parseFindings` (`backend/internal/modules/scan/scanner.go`) and enforced (unrecognized source severities fail the scan). In practice all 3 current `baseline-v1` rules are declared as `severity: ERROR`, so every finding today maps to **High** — Medium and Low are reachable by the mapping code but not currently produced by any active rule. Critical is not assigned anywhere; there is no rule or policy that produces it, matching the guidance above. There is no persisted `severity_mapping_version` field yet — the mapping is fixed in code rather than versioned/stored per scan.

---

## 8. Custom Rules

Custom rules should have:

- stable rule ID
- description
- supported language
- category
- severity
- positive example
- negative example
- rationale
- references if appropriate

Suggested naming:

```text
auditorx.<language>.<category>.<rule-name>
```

Example:

```text
auditorx.go.quality.unhandled-error
```

---

## 9. Rule Repository Structure

Suggested future structure:

```text
rules/
├── javascript/
├── typescript/
├── python/
├── go/
└── shared/
```

---

## 10. Rule Testing

Each custom rule should be tested against:

- code that must match
- code that must not match
- edge cases

False Positive rate should be reviewed during POC.

---

## 11. Finding Normalization

```text
Semgrep Finding
→ Validate
→ Map Severity
→ Map Category
→ Capture Location
→ Create AuditorX Issue
```

---

## 12. AI Relationship

Semgrep detects issues.

AI may:

- explain
- analyze context
- recommend remediation

AI must not silently remove or rewrite Semgrep findings.

---

## 13. POC Success Criteria

- supported languages can be scanned
- findings include file and line
- rule categories map correctly
- findings become AuditorX Issues
- custom rule can be added without changing core architecture
