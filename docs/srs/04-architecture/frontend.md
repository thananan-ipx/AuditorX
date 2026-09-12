# Frontend Architecture

> **Project:** AuditorX  
> **Technology:** Next.js, React, TypeScript, Tailwind CSS  
> **Status:** Draft

---

## 0. Implementation Status (as of 2026-09-12)

Implemented: Next.js App Router frontend calling the Go API through a thin client at
`frontend/lib/api-client.ts`. The repository registration form does not download or clone code
client-side (by design) — it only registers repository metadata with the backend. The real scan
UI (start/cancel scan, poll status every 3 seconds, view findings with severity/text filtering,
50 findings per page) is shown only when `GET /api/v1/capabilities` reports `postgres` storage
with `scan_queue: true`; otherwise a clearly labeled "prototype"/sample dashboard is shown
instead (backed by the backend's `audit` module). AI explanation/recommendation display,
priority display, and the MCP-facing pieces described below are **not implemented** — see
`ai-engine.md`, `priority-engine.md` and `mcp.md`.

---

## 1. Purpose

Frontend ทำหน้าที่เป็น User Interface ของ AuditorX โดยไม่รับผิดชอบ Business Logic สำคัญหรือการตัดสินสิทธิ์ขั้นสุดท้าย

---

## 2. Responsibilities

- Authentication UI
- Repository management UI
- Scan configuration and status
- Dashboard
- Issue list and filtering
- Issue detail and code snippet display
- AI explanation and recommendation display
- Scan history
- Report generation/download UI
- Admin user management

---

## 3. Suggested Application Structure

```text
frontend/
├── app/
│   ├── login/
│   ├── dashboard/
│   ├── repositories/
│   ├── scans/
│   ├── issues/
│   ├── reports/
│   └── admin/
├── components/
├── features/
├── services/
├── hooks/
├── types/
├── utils/
└── styles/
```

---

## 4. Feature Modules

### Authentication
Related: `UC-001`, `FR-AUTH-*`

### Repository
Related: `UC-002`, `FR-REP-*`

### Scan
Related: `UC-003`, `UC-010`, `FR-SCAN-*`

### AI Analysis
Related: `UC-004`, `FR-AI-*`

### Dashboard
Related: `UC-005`, `FR-DASH-*`

### Issue
Related: `UC-006`, `UC-007`, `FR-ISSUE-*`, `FR-FILTER-*`

### Report
Related: `UC-008`, `FR-REPORT-*`

### Admin
Related: `UC-009`, `FR-USER-*`

---

## 5. Frontend Data Flow

```text
Page
→ Feature Component
→ API Service
→ Backend API
→ Response DTO
→ State
→ UI
```

---

## 6. UI State

Suggested states:

- loading
- success
- empty
- error
- unauthorized
- forbidden
- processing

Long-running scan actions must show status instead of blocking the page.

---

## 7. Permission Handling

Frontend may hide unavailable actions based on role, but backend remains the authority.

Example:

```text
Developer
→ Show Start Scan

Reviewer
→ Hide/disable actions not granted

Administrator
→ Show User Management
```

---

## 8. Error Handling

Frontend should map backend errors into understandable messages:

- Validation error
- Unauthorized
- Forbidden
- Not found
- External service unavailable
- Scan failed
- AI unavailable
- Unexpected error

---

## 9. Security

- Do not expose API keys
- Do not trust client-side role checks
- Avoid rendering untrusted HTML
- Escape code/output where required
- Minimize sensitive information in browser state
- Do not store repository credentials in insecure browser storage

---

## 10. Related Documents

- `architecture-overview.md`
- `backend.md`
- `security.md`
- `../06-api/api-overview.md`
- `../07-ui/screen-specifications.md`
