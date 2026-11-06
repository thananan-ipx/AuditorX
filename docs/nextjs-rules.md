# Next.js scan profile

New scans use `baseline-v3`: the unchanged general language rules from
`baseline-v2`, plus versioned `nextjs-v1` rules only for detected Next.js packages.
`baseline-v1` and `baseline-v2` scans remain executable with their historical rules.
Migration `00009_nextjs_rules.sql` updates the default and allows up to 21 recorded
checks for a source tree containing all supported languages and Next.js routes.

## Detection and source handling

The scanner reads `package.json` declarations of `next` in `dependencies` or
`devDependencies`. JSX/TSX files, package names or script names alone do not enable
Next.js rules. The nearest manifest owns each source file, so a sibling React app
or a nested package without Next.js does not receive these checks.

Folder and ZIP uploads now include `package.json` (64 KiB maximum per manifest).
During extraction, manifests are reduced to a Next.js presence marker or an empty
object. Scripts, other dependency values and extra fields are not copied into the
analysis tree; no install/build scripts or project code are executed. The original
upload is temporary and deleted with the existing scan lifecycle. Other JSON,
environment files, lockfiles, repository rules, hidden/dependency directories and
executables remain excluded. At least one supported source file is still required.

Next.js rule paths are restricted to the actual JS/JSX/TS/TSX files owned by Next.js
packages. Dynamic route brackets are escaped as literal paths. API access reviews
apply only to `app/**/route.js`, `app/**/route.ts` and `pages/api/**` files, including
`src/app` and `src/pages` layouts.

## Checks

| Rule | Behavior |
| --- | --- |
| `request-html` | Tracks common request/query input, awaited App Router params and search params into `dangerouslySetInnerHTML`; recognizes explicit imports of DOMPurify/isomorphic-dompurify and sanitize-html sanitizers |
| `public-secret` | Flags `NEXT_PUBLIC_` references with secret/password/private-token names; ordinary public API URLs, anonymous keys and generic API-key names are not flagged solely for being public |
| `client-server-import` | Flags direct imports of known server-only modules in `use client` files: server-only, next/headers, fs/node:fs, pg and @prisma/client |
| `request-redirect` | Tracks request/query input into redirects and navigation through a router initialized by `useRouter`; ordinary array push and string replace are excluded |
| `server-action-access` | Manual authorization/input-validation review of file-level and inline Server Actions |
| `route-handler-access` | Manual access/input-validation review of App Router handlers and Pages API handlers |
| `shared-cache` | Manual user-isolation review of unstable_cache and use-cache functions |

The last three are INFO/Low advisory findings labeled **Review required**, with
messages explaining that a match does not prove missing authorization or leaked
data. Titles, explanations and the new finding messages support Thai and English.
The checklist uses persisted checked rule IDs, so plain Go/Python/React sources do
not acquire Next.js checks simply because the new profile exists.

## Limits and verification

These are focused static checks, not complete Next.js security verification.
Custom server-only module imports are not resolved across the entire dependency
graph. Taint checks recognize specific common source/sink/sanitizer forms; custom
wrappers and validators may require manual review. Public-variable checks inspect
names in source references, not `.env` values. Cache and permission correctness
must be assessed in application context. ESLint/TypeScript and dependency advisory
checks remain separate tools.

`TestSemgrepNextJS` runs the pinned real scanner against safe and unsafe fixtures,
including sanitized HTML, ordinary public variables, awaited App Router query
params, dynamic route paths, monorepo boundaries, server-only negative examples,
and review labels. `scripts/verify-scanner.ps1` and the database CI job include it.

The rule design follows the official [Next.js data security guide](https://nextjs.org/docs/app/guides/data-security)
and [Semgrep taint analysis](https://semgrep.dev/docs/writing-rules/data-flow/taint-mode/overview).

Verified locally on 2026-11-01: backend format/vet/tests/build, 82 frontend tests,
21 disposable database tests, real Semgrep fixture tests for v1/v2/v3, and the
Docker production build passed. Signed-in Chrome folder and ZIP uploads of the
Next.js fixture each recorded 12 checks and 11 expected findings; a plain React
negative fixture recorded five general checks and no findings. Browser checks
also verified Thai/English text, manual-review labels, dynamic-route coverage,
package isolation, and mobile layout. The local instance uses web/API ports
3001/8081 so ERP can continue using 3000/8080.
