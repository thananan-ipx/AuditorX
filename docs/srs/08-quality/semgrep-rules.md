# Semgrep Rules Strategy

> **Project:** AuditorX  
> **Analyzer:** Semgrep Community Edition  
> **Status:** Draft  
> **Related:** `FR-SCAN-*`, `UC-003`

---

> **Go rule update:** New local scans now use `baseline-v4` (21 rules total; 4 Go rules). See [Go review and regression coverage](../../go-rules.md). The v2 description below is retained as historical implementation context.

## 1. Purpose

กำหนดแนวทางเลือก จัดกลุ่ม และบริหาร Semgrep Rules สำหรับ AuditorX

**Implementation status:** New scans use the fixed, embedded **`baseline-v2`** ruleset with **14 active rules**. Historical or already-queued `baseline-v1` scans remain supported and are analyzed with their recorded ruleset; ruleset changes never reinterpret a historical scan. Both YAML files are embedded into the worker via `go:embed`. There is still no user-selectable profile or per-scan rule selection — the API accepts only the `recommended` profile, which resolves to the database default (`baseline-v2` for new scans).

| Rule ID | Language(s) | Semgrep severity | AuditorX severity | Check |
|---|---|---|---|---|
| `auditorx.python.security.dynamic-eval` | Python | ERROR | High | dynamic `eval(...)` call |
| `auditorx.javascript.security.dynamic-eval` | JavaScript, TypeScript | ERROR | High | dynamic `eval(...)` call |
| `auditorx.go.security.tls-verification-disabled` | Go | ERROR | High | `tls.Config{InsecureSkipVerify: true}` |
| `auditorx.python.security.hardcoded-secret` | Python | ERROR | High | secret-like variable assigned a literal |
| `auditorx.javascript.security.hardcoded-secret` | JavaScript, TypeScript | ERROR | High | secret-like variable declared with a literal |
| `auditorx.go.security.hardcoded-secret` | Go | ERROR | High | secret-like variable assigned a literal |
| `auditorx.python.security.shell-command-execution` | Python | ERROR | High | `shell=True`, `os.system`, or `os.popen` |
| `auditorx.javascript.security.shell-command-execution` | JavaScript, TypeScript | ERROR | High | direct `child_process.exec`/`execSync` usage |
| `auditorx.python.security.sql-string-construction` | Python | ERROR | High | SQL built with f-strings, `%`, or concatenation |
| `auditorx.javascript.security.sql-template-interpolation` | JavaScript, TypeScript | ERROR | High | interpolated template passed to `query`/`execute` |
| `auditorx.python.coding-standard.sensitive-logging` | Python | WARNING | Medium | secret-like variable written to a logger or `print` |
| `auditorx.javascript.coding-standard.sensitive-logging` | JavaScript, TypeScript | WARNING | Medium | secret-like variable written to console/logger |
| `auditorx.go.coding-standard.sensitive-logging` | Go | WARNING | Medium | secret-like variable written with log/fmt |
| `auditorx.go.code-quality.unhandled-json-error` | Go | WARNING | Medium | ignored JSON encoder/decoder error |

The scan worker (`backend/internal/modules/scan/scanner.go`) pins Semgrep Community Edition to exactly version `1.175.0` and fails closed (returns no findings) if the installed Semgrep reports a different version, fatal or unknown scanner diagnostics, more than 1000 results, an unsupported ruleset version, or a rule ID outside the allowlist for that version. The one tolerated diagnostic is Semgrep's structured warning-level `PartialParsing`: findings from valid portions remain usable while the affected source fragments are skipped. The rules have real positive/negative fixture coverage. A general path-traversal rule is intentionally deferred until framework-specific taint sources and sanitizers can be defined without excessive false positives.

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

**Implementation status: Not yet built.** There is no selectable profile concept today; new scans run `baseline-v2`, while recorded `baseline-v1` jobs retain backward-compatible execution.

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

**Implementation status:** This mapping is implemented in `parseFindings` and enforced (unrecognized source severities fail the scan). `baseline-v2` contains 10 ERROR rules that map to **High** and 4 WARNING rules that map to **Medium**. No active rule produces Low or Critical. There is no persisted `severity_mapping_version` field yet — the mapping is fixed in code rather than versioned/stored per scan.

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
