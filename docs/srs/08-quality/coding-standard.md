# AuditorX Coding Standard

> **Project:** AuditorX  
> **Status:** Draft

---

## 1. Purpose

กำหนด Coding Standard เบื้องต้นสำหรับโค้ดของ AuditorX เพื่อให้ทีมและ AI Coding Assistant สร้างโค้ดในแนวทางเดียวกัน

**Implementation status:** This document mixes team/manual conventions with automatically detected checks. New scans use 14 rules in `baseline-v2`, including dynamic eval, disabled TLS verification, hardcoded secrets, shell command execution, SQL string construction, sensitive logging and ignored Go JSON encoder/decoder errors. See `semgrep-rules.md` for the authoritative list. Other guidance such as naming, layering, general documentation and Python/ML evaluation practices still relies on code review unless a specific automated rule is documented.

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

**Implementation status:** `baseline-v2` detects hardcoded secret-like literals and direct logging of secret-like variables. Plaintext passwords stored outside source code, frontend-only authorization trust and repository-to-AI data transfer remain manual/application-level controls rather than Semgrep guarantees.

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
