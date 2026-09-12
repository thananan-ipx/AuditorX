# Security Architecture

> **Project:** AuditorX  
> **Status:** Draft

---

## 0. Implementation Status (as of 2026-09-12)

This document mixes controls that are **implemented today** with controls that are **planned**
for scope (AI, MCP) that does not exist yet in the codebase. Implemented today:

- HTTPS-only GitHub repository URL validation, with lowercase-normalized owner/repo and no
  query/fragment/credentials permitted in registered URLs.
- Per-repository membership authorization checked at every scan action: enqueue, read, cancel,
  claim, and publish.
- A dedicated least-privileged Postgres role (`auditorx_scan_worker`, `NOLOGIN`/`NOBYPASSRLS`)
  for the scan worker process, separate from the API's database credentials, plus Supabase Row
  Level Security on the application tables (see `supabase/migrations`).
- Scan jobs are claimed with `FOR UPDATE SKIP LOCKED` and per-attempt lease tokens to prevent
  double-processing; a 3-minute lease outlasts the 2-minute job timeout, with 3 retry attempts
  before `RETRY_EXHAUSTED`.
- Public GitHub repositories only — there is no stored-credential, OAuth, or private-repository
  support in the code today. Source retrieval rejects redirects and uses fixed GitHub hosts.

The **OpenAI API** and **MCP Client** trust boundaries in section 2, and the AI-related and
MCP-related items throughout this document, describe planned/target architecture — no AI engine
or MCP server exists in the repository yet (see `ai-engine.md` and `mcp.md`).

---

## 1. Security Goals

- Protect user accounts
- Protect repository access
- Protect source code
- Protect API credentials
- Enforce authorization
- Limit AI data exposure
- Preserve auditability

---

## 2. Trust Boundaries

```text
Browser
  ↓
[Boundary]
  ↓
AuditorX Backend
  ├── [Boundary] GitHub
  ├── [Boundary] OpenAI API
  ├── [Boundary] Semgrep execution
  └── [Boundary] MCP Client
```

---

## 3. Authentication

Requirements:
- `FR-AUTH-*`
- `NFR-SEC-001`
- `NFR-SEC-003`

Passwords must be stored as secure hashes.

Authentication strategy must support session/token invalidation.

---

## 4. Authorization

Authorization is enforced by backend.

Checks include:

- user role
- account status
- repository membership/access
- action permission
- MCP resource permission

---

## 5. Repository Security

- Validate access before retrieval
- Do not expose repository tokens to frontend
- Use least-privilege tokens where possible
- Remove temporary source code when no longer required
- Avoid logging repository secrets or source content

---

## 6. Secret Management

Secrets include:

- database credentials
- OpenAI API key
- GitHub token/client secret
- application signing secrets

Rules:

- no hardcoding
- no plaintext logging
- environment/secret store injection
- separate dev/test/prod credentials

---

## 7. AI Data Protection

Before sending code to AI:

1. identify required issue context
2. reduce context
3. filter secrets where feasible
4. avoid entire repository upload
5. send only fields required for analysis

AI output is advisory.

---

## 8. Input Validation

Validate:

- repository URL/identifier
- branch
- filter parameters
- issue status transition
- report selection
- external API responses
- file/path values

---

## 9. Audit Logging

Security-relevant events should include:

- login failure
- account status change
- role change
- repository permission change
- sensitive administration action
- MCP access
- integration failure category
- Priority Label creation
- model activation/retirement
- evaluation leakage-check failure

Logs must avoid sensitive payloads.

---

## 10. Security Requirements Mapping

| Area | Requirements |
|---|---|
| Authentication | `NFR-SEC-001`, `NFR-SEC-003` |
| Repository Access | `NFR-SEC-002` |
| Secret Handling | `NFR-SEC-004` |
| Transport Security | `NFR-SEC-005` |
| Input Validation | `NFR-SEC-006` |
| AI Context | `NFR-SEC-007`, `NFR-SEC-008` |
