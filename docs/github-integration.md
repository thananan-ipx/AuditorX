# GitHub sign-in and repository connection

AuditorX supports GitHub App user authorization alongside local email/password
accounts. Users can sign in with GitHub or connect GitHub from **Repositories**,
choose an installed account/organization, select an allowed public/private repo
and branch, and import it into their workspace. Import does not start a scan;
the existing dashboard starts/cancels jobs and displays findings.

## Register the GitHub App

Create a GitHub App in GitHub **Settings → Developer settings → GitHub Apps**.
For local development use:

- Homepage URL: `http://localhost:3000`
- Callback URL: `http://localhost:8080/api/v1/auth/github/callback`
- Repository permissions: **Contents: Read-only**, **Metadata: Read-only**.
- Account permissions: **Email addresses: Read-only** (needed for new accounts).
- Webhooks: disable for this version; no webhook receiver is implemented.
- Installation: allow the accounts that should use the app; users choose selected
  repositories when installing. Organization policy may require admin approval.

Use the app's **Client ID**, not its numeric App ID. Generate a client secret.
This implementation uses user access tokens, so it does not need an app private
key or installation-wide token. Follow GitHub's
[user authorization flow](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app)
and [installation access model](https://docs.github.com/en/apps/using-github-apps/authorizing-github-apps).

## Configure and start

Configure these server-only variables in root `.env` for Docker Compose, or
`backend/.env` when running the Go API directly. Never use `NEXT_PUBLIC_` secrets.

```dotenv
GITHUB_CLIENT_ID=Iv1.your-client-id
GITHUB_CLIENT_SECRET=your-client-secret
GITHUB_CALLBACK_URL=http://localhost:8080/api/v1/auth/github/callback
GITHUB_APP_SLUG=your-app-slug
GITHUB_TOKEN_ENCRYPTION_KEY=base64-encoded-32-random-bytes
```

Generate the key with PowerShell, then save it only in your ignored environment
configuration/secret store:

```powershell
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

Provide the **same encryption key** as `GITHUB_TOKEN_ENCRYPTION_KEY` in the scan
worker environment, alongside `SCAN_WORKER_DATABASE_URL` and
`SEMGREP_EXECUTABLE`. The worker needs neither the GitHub client secret nor a
GitHub App private key. When running Go directly, start the worker as a separate
process. The local Docker Compose stack includes the worker with the same
encryption key and enables the queue by default.

Apply Goose migration `00007_github_accounts.sql` before running the updated API
and worker. `docker compose up -d --build` runs the migration service before the
API starts. Existing local accounts, repository ownership and sessions survive.
All five GitHub settings may be omitted to keep GitHub disabled; partially
configured integrations fail startup. Use the same hostname throughout local
development (`localhost` or `127.0.0.1`) and HTTPS with `COOKIE_SECURE=true` for
hosted environments.

## Account and permission behavior

- A new GitHub account requires a verified primary email. An email matching an
  existing local account **does not** automatically link or claim that account:
  sign in with the existing method and use **Connect GitHub** instead.
- GitHub identity uses its numeric user ID. Renaming a GitHub login or changing
  email does not change the local user or their repositories.
- One GitHub identity is linked to one AuditorX account. Switching that identity
  is not supported in this version.
- **Disconnect** erases the local repository access token and preserves the
  sign-in identity, so GitHub-only accounts can sign in again. To revoke the app
  on GitHub as well, remove its authorization/installation in GitHub settings.
- Expiring tokens are supported, but this version deliberately does not retain
  refresh tokens. Reconnect when access expires or is revoked; local AuditorX
  sessions remain usable. This is not unattended, indefinite scanning access.
- Imported repositories store the immutable numeric GitHub repo ID and selected
  installation. Each scan checks the requester's current installation access,
  resolves the branch to a commit and downloads that commit. Shared workspace
  editors need their own connected GitHub access to the same installation/repo.
- Existing manually registered URLs keep public-only retrieval. Importing a URL
  already registered by the same user returns a conflict; conversion of existing
  manual registrations is not implemented. Scan history remains limited to the
  latest 20 entries; source extraction limits are unchanged.

## Security and verification

Authorization uses random single-use state, a host-only HttpOnly browser cookie,
10-minute expiry and PKCE S256. Linking checks the live local session again in
the callback. Tokens are encrypted with AES-256-GCM and bound to their GitHub user
ID; no provider token is sent to the frontend or scan API responses. Keep the
encryption key backed up; changing it requires users to reconnect.

Credential tables live in the private `auth` schema. Workers receive a token only
through a restricted function with a current job lease and current repository
write membership. GitHub archive downloads follow one HTTPS redirect to exactly
`codeload.github.com`, without forwarding the API bearer token. Source code is
never executed and still passes the existing safe extraction and Semgrep limits.

`scripts/verify.ps1` includes database-backed OAuth/login/link/import and worker
tests with mocked GitHub transport, state replay/wrong-browser rejection,
cross-account collision prevention, private repo retrieval and revoked-access
failure. No live GitHub account is authorized by automated tests. Complete a
real sign-in, selected private-repo import, scan and revocation check after
configuring your GitHub App; automated fixtures cannot verify its settings.

Local verification (2026-11-01): all 21 database harness tests passed, including
the new GitHub flow; frontend lint/typecheck/unit tests and production build
passed. A headless Chrome smoke test with a mocked GitHub API passed login
availability, private repo/branch selection, import conflict/retry/navigation,
callback error display, disconnect, Thai translation and mobile overflow checks.
The existing local-auth reconnect test now closes its old pool before reconnecting
to accommodate PGlite's single multiplexed backend session.
