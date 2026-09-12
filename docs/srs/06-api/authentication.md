# Authentication API

> Related: `UC-001`, `FR-AUTH-*`

**Implementation status (as of 2026-09-12):** The actual routes, paths, and payloads implemented by `backend/internal/modules/user` (Supabase-Auth-backed) differ from the design below in several ways: paths use hyphenated verbs (`sign-in`/`sign-up`/`sign-out`) rather than `login`/`register`/`logout`, there is no `PATCH /api/v1/auth/me`, and the user object never carries a `role` (there is no local `Role`/`account_status` concept — see `docs/05-database/data-model.md`). The session is held in an HttpOnly cookie (`auditorx_session`), not returned as bearer tokens in the response body. Corrections are inlined below; the original request/response shapes are kept as illustrative but are not what the backend actually returns.

## POST /api/v1/auth/sign-up **(implemented; originally documented as `/auth/register`)**

Creates a user account via Supabase Auth. Actual request body is only `email` and `password` (email is trimmed, password must be ≥ 8 characters) — there is no `first_name`/`last_name` (no local profile fields exist).

Request (as implemented):

```json
{
  "email": "john@example.com",
  "password": "********"
}
```

Response: `201 Created`

```json
{
  "data": {
    "user": { "id": "uuid", "email": "john@example.com" },
    "requires_email_confirmation": true
  }
}
```

If email confirmation is not required, a session cookie is also set (see below).

Planned request shape (not implemented — `first_name`/`last_name` are not accepted):

```json
{
  "first_name": "John",
  "last_name": "Doe",
  "email": "john@example.com",
  "password": "********"
}
```

---

## POST /api/v1/auth/sign-in **(implemented; originally documented as `/auth/login`)**

Request:

```json
{
  "email": "john@example.com",
  "password": "********"
}
```

Response (as implemented — no `role` field; sets the `auditorx_session` HttpOnly cookie):

```json
{
  "data": {
    "user": {
      "id": "uuid",
      "email": "john@example.com"
    }
  }
}
```

The `"role": "Developer"` field shown in earlier drafts of this document is **planned**, not implemented — there is no local role concept today.

---

## POST /api/v1/auth/refresh **(implemented; not in the original design)**

Refreshes the session using the refresh token stored in the `auditorx_session` cookie. Returns the same shape as sign-in. Not part of the original planned endpoint list.

---

## POST /api/v1/auth/sign-out **(implemented; originally documented as `/auth/logout`)**

Ends current authenticated session and clears the session cookie.

Response: `204 No Content`

---

## GET /api/v1/auth/me **(implemented)**

Returns the current user (`id`, `email` only — no `role`).

---

## PATCH /api/v1/auth/me — **[Planned; not implemented]**

Updates allowed profile fields. No such route is registered in `backend/internal/modules/user/delivery/http/route.go`.

---

## Errors

Implemented: the handler returns `AUTH_FAILED` (with the underlying Supabase Auth provider message) or `AUTH_PROVIDER_ERROR` for sign-in/sign-up failures, `INVALID_JSON`/`INVALID_CREDENTIALS` for malformed input, and `AUTH_REQUIRED`/`SESSION_EXPIRED`/`INVALID_SESSION` for session checks. The codes below are planned and not all guaranteed to appear verbatim:

- `EMAIL_ALREADY_EXISTS`
- `INVALID_CREDENTIALS`
- `ACCOUNT_SUSPENDED` *(planned — no account-status concept implemented)*
- `UNAUTHENTICATED`
