# User Management API

> Related: `UC-009`, `FR-USER-*`

**Implementation status: Not yet built.** No admin user-management endpoints exist anywhere in the codebase — there is no `GET /api/v1/users`, no user detail/PATCH route, and no `{user_id}/repositories` route. The user module (`backend/internal/modules/user`) only registers the self-service auth routes documented in `authentication.md` (`sign-in`, `sign-up`, `refresh`, `sign-out`, `me`); there is no admin listing, search, enable/disable, or global role-assignment capability, and no local `Role`/`account_status` concept (see `docs/05-database/data-model.md`). Repository-level access is instead granted only at repository-creation time and read back via `GET /api/v1/repositories/{id}` (`access_level` field) — see `repositories.md`. Everything below describes planned/target API design; no corresponding code exists in the repository as of 2026-09-12.

Administrator-only unless otherwise noted.

## GET /api/v1/users

Lists users.

Query:

- `search`
- `status`
- `role`
- `page`
- `page_size`

---

## GET /api/v1/users/{user_id}

Returns user administration detail.

---

## PATCH /api/v1/users/{user_id}

Updates administrative fields.

Example:

```json
{
  "role": "Project Manager / Reviewer",
  "account_status": "Active"
}
```

---

## GET /api/v1/users/{user_id}/repositories

Returns repository permissions.

---

## PUT /api/v1/users/{user_id}/repositories/{repository_id}

Assigns/updates repository access.

Request:

```json
{
  "access_level": "write"
}
```

---

## DELETE /api/v1/users/{user_id}/repositories/{repository_id}

Removes repository access.

---

## Security

- Every endpoint requires Administrator authorization.
- Role/status/permission changes should be audit logged.
- API must prevent unauthorized privilege escalation.
