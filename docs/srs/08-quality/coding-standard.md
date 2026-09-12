# AuditorX Coding Standard

> **Project:** AuditorX  
> **Status:** Draft

---

## 1. Purpose

กำหนด Coding Standard เบื้องต้นสำหรับโค้ดของ AuditorX เพื่อให้ทีมและ AI Coding Assistant สร้างโค้ดในแนวทางเดียวกัน

**Implementation status:** This document mixes two different things: (1) team/manual coding conventions (naming, layering, logging, documentation, etc. — Sections 2–6, 8–11) that are **not automatically enforced by any tooling today**, and rely on code review; and (2) security rules that overlap with what Semgrep actually detects automatically. Only **3 rules**, in the fixed `baseline-v1` ruleset, are automatically enforced/detected by the scan pipeline today: dynamic `eval(...)` in Python, dynamic `eval(...)` in JavaScript/TypeScript, and disabled TLS certificate verification (`InsecureSkipVerify: true`) in Go — see `docs/08-quality/semgrep-rules.md` for the authoritative, code-verified list. None of the other guidance in this document (naming conventions, error-handling style, layering, logging fields, documentation expectations, Python/ML evaluation practices) is checked automatically by Semgrep, CI, or any other tool yet; treat it as team convention and planned future tooling unless a specific automated check is added and documented here.

---

## 2. General Principles

- Prefer readable code over clever code
- Keep functions focused
- Use meaningful names
- Validate all external input
- Handle errors explicitly
- Avoid hidden side effects
- Do not hardcode secrets
- Keep modules cohesive
- Write code that is testable

---

## 3. Go

### Naming

- exported identifiers use PascalCase
- unexported identifiers use camelCase
- package names short and lowercase
- avoid redundant package/type naming

### Error Handling

- never silently ignore relevant errors
- add context when propagating errors where useful
- do not expose internal error details to clients
- use controlled application error codes

### Context

Use `context.Context` for request-scoped and external I/O operations where appropriate.

### Layering

Handlers should not contain database or external integration implementation logic directly.

Preferred:

```text
Handler
→ Service / Use Case
→ Repository / Provider Interface
```

---

## 4. TypeScript / React

- TypeScript required for application code
- avoid `any` unless justified
- define explicit API response types
- keep UI components focused
- separate API calls from rendering logic
- handle loading, empty and error states
- avoid exposing authorization decisions only in UI

---

## 5. API

- use consistent response format
- validate request data
- use stable error codes
- use proper HTTP status codes
- never expose secrets
- backend is authorization authority

---

## 6. Database

- use explicit migrations
- use foreign keys where appropriate
- use transactions for atomic multi-write operations
- avoid string concatenation for SQL
- index fields used frequently for lookup/filtering
- avoid storing unnecessary source code

---

## 7. Security

Forbidden:

```text
hardcoded API keys
plaintext passwords
logging access tokens
trusting frontend role checks
sending entire repository to AI by default
```

**Implementation status:** None of the above are automatically scanned for today. The only automated security checks are the 2 rule categories in `baseline-v1` (dynamic eval; disabled Go TLS verification) described in Section 1 above — everything else in this list is a manual review requirement, not a tooling guarantee.

---

## 8. Logging

Logs should include:

- request ID
- scan ID when relevant
- controlled error code
- integration name

Do not log:

- password
- token
- API key
- full sensitive source code

---

## 9. Documentation

Public or important interfaces should be documented sufficiently for maintenance.

Architecture decisions should be reflected in Markdown docs.

---

## 10. AI-generated Code

AI-generated code must:

- follow this standard
- preserve existing architecture boundaries
- not invent unavailable infrastructure
- reference relevant requirement/use case when implementing major features
- be reviewed before merge

---

## 11. Python / ML Evaluation

Training and evaluation code must:

- run from version-controlled scripts or modules, not only interactive notebooks
- pin or record dependency versions
- accept explicit dataset version and split seed
- fit preprocessing on training data only
- keep feature schema versioned and validated
- emit machine-readable metrics and configuration
- verify artifact/manifest checksums
- avoid logging source snippets, credentials or direct personal identifiers
- preserve negative results and failed runs rather than overwriting them
