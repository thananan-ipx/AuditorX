# Local website accounts

The website authenticates directly against PostgreSQL in Docker. No Supabase Auth
URL, publishable key, JWT secret or outbound identity-provider request is used.
Use **Create account** on the Login page to register and sign in immediately.
The email is a login identifier; mailbox ownership is not verified and no email
confirmation is sent.

## Passwords and sessions

- `auth.users` stores UUID, normalized lowercase email and an Argon2id password
  hash with a random 16-byte salt, 19 MiB memory, two passes and one lane.
  Passwords accept 8–128 Unicode characters. Concurrent hashing is bounded.
- `auth.sessions` stores only the SHA-256 digest of a random 256-bit opaque token,
  its owner and expiry. The raw token is carried in an `HttpOnly`, `SameSite=Lax`
  cookie. Set `COOKIE_SECURE=true` when using HTTPS.
- Sessions last 30 days, survive API/container restarts and are looked up in the
  database on every authenticated request. Client-supplied identities are ignored.
- Sign-out deletes the current session. Explicit refresh atomically consumes the
  old session and creates a new token; the old cookie cannot be reused.
- Invalid credentials use a generic message. Auth responses are `no-store` and
  never return password hashes or session tokens in JSON.
- Signup and sign-in share a limit of 10 attempts per minute per direct peer IP,
  per API process. Forwarded IP headers are not trusted. This limiter is local to
  each API instance; it is not a distributed limiter.
- Database failures return a generic service-unavailable response, without SQL or
  connection details. Repository RLS still uses the verified UUID inside each
  transaction. The `authenticated` role cannot read password hashes or sessions.

## Existing identities and development accounts

Migration 00006 preserves existing UUIDs, repositories and memberships. UUID-only
rows from the former provider have no local password and cannot sign in. No remote
passwords or accounts are downloaded. A new account does not claim an old UUID's
repositories automatically.

No default website password is embedded in the image or migration. Requested test
accounts are created through the local signup endpoint. Machine-local credentials
may be kept under `.local`, which is ignored by Git. The current app does not have
a password-reset email service or account-management UI.

## API

| Method | Path | Behavior |
| --- | --- | --- |
| POST | `/api/v1/auth/sign-up` | Register and start a session |
| POST | `/api/v1/auth/sign-in` | Validate credentials and start a session |
| GET | `/api/v1/auth/me` | Resolve the current session |
| POST | `/api/v1/auth/refresh` | Rotate the current session token |
| POST | `/api/v1/auth/sign-out` | Revoke the current session |

Route names and cookie name remain stable. Old provider cookies are rejected and
users must sign in again. Origin checks continue to apply. The historical `auth`
schema, `auth.uid()` function and frozen SQL baselines remain internal PostgreSQL
compatibility names; they do not require Supabase services or JWT authentication.

Current startup scripts use Docker Compose and Goose exclusively. See
[Local database](local-database.md) for startup, credentials and migration commands.
