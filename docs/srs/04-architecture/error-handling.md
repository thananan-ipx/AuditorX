# Error Handling Architecture

> **Project:** AuditorX  
> **Status:** Draft

---

## 1. Purpose

กำหนดแนวทางการจัดการข้อผิดพลาดแบบสม่ำเสมอทั้ง Backend, Frontend และ External Integrations

---

## 2. Error Categories

| Category | Example |
|---|---|
| Validation | Invalid request |
| Authentication | Invalid/expired session |
| Authorization | Repository access denied |
| Not Found | Missing issue/repository |
| Conflict | Invalid state transition |
| External Integration | GitHub/OpenAI unavailable |
| Static Analysis | Semgrep execution failed |
| Database | Persistence failure |
| Internal | Unexpected application error |

---

## 3. Error Response Concept

Suggested fields:

```json
{
  "code": "SEMGREP_EXECUTION_FAILED",
  "message": "Unable to complete source code analysis.",
  "request_id": "...",
  "details": {}
}
```

User-facing messages should not reveal sensitive internals.

---

## 4. Scan Error Handling

```text
Pending
→ Running
→ Completed

or

Pending/Running
→ Failed

or

Pending/Running
→ Cancelled
```

On scan failure:

- save scan state
- save safe error category
- preserve metadata
- notify user
- do not generate fake findings

Cancellation is a terminal user-requested state, not an execution failure. The worker must stop safely and must not persist partial findings as a completed result.

---

## 5. AI Error Handling

> **Implementation status: Not yet built.** There is no AI engine in the codebase as of
> 2026-09-12 (see `ai-engine.md`); this section describes planned handling for when it exists.

AI failure:

- does not fail successful Semgrep scan
- stores AI failure status
- allows static finding review
- allows retry

---

## 6. GitHub Error Handling

Examples:

- unauthorized
- repository not found
- branch not found
- rate limit
- timeout
- service unavailable

Map provider-specific errors to internal error codes.

---

## 7. Retry Strategy

Retry only where safe and useful.

Potential retry:
- temporary AI error
- temporary GitHub/network error

Avoid blind retry:
- invalid token
- invalid repository
- invalid rule configuration

---

## 8. Timeout

External calls must have explicit timeouts.

Long-running scan execution should be treated as a job/process instead of an indefinitely open HTTP request.

---

## 9. Logging

Log:

- request ID
- scan ID
- integration
- internal error code
- timing

Do not log:

- passwords
- access tokens
- API keys
- full source code
