# ERP New Idea UI reuse

The reference frontend lives in the sibling checkout `crm-new-idea-front`, whose
package name is `erp-new-idea-front`. This adaptation reuses its interface patterns
in AuditorX; it does not import the ERP runtime, mock accounts or domain stores.

## Adapted patterns

- Login: `features/auth/pages/login-page.tsx` and `components/login-hero.tsx`
  supplied the two-column card, mobile layout, brand/hero treatment and footer.
  The password visibility control follows ERP's `PasswordInput` pattern. AuditorX
  retains its local PostgreSQL authentication, translations and `Typography` roles.
- Sidebar/header: `components/layout/app-sidebar.tsx` and `app-header.tsx`
  supplied the inset shell, icon collapse, groups, current destination and account
  menu. The AuditorX navigation registry owns supported routes and is shared with
  search. Unimplemented modules remain disabled and do not appear as search links.
- Universal search: ERP's trigger and command-dialog pattern supplied Ctrl/Cmd+K,
  lazy loading, immediate menu matches, 250ms record-query delay, cancellation,
  keyboard selection and focus restoration. API failures leave menu navigation
  available while clearly reporting that repository search failed.

ERP uses shadcn Base UI; AuditorX uses shadcn Radix. The adapted components use the
local Radix `asChild` APIs and standard primitives rather than copying ERP's
`render` props or adding a second UI framework. `cmdk` is the same palette engine
used by ERP. Font sizes and colors remain controlled by AuditorX's existing tokens.

## Sidebar behavior

The sidebar supports icon collapse on desktop and a Sheet on mobile. Clicking a
mobile destination closes the drawer. Ctrl/Cmd+B toggles navigation. Its local UI
preference is stored in `auditorx_sidebar_state`; the server reads it at layout
render time. It contains only a boolean and is separate from the session cookie.
The account menu displays the current authenticated email and signs out through
the existing local API.

## Search scope and access

`GET /api/v1/search?q=...` searches repository owner/name and default branch.
Queries contain 2–100 Unicode characters, reject controls and use parameterized
literal substring matching. Results are bounded to five repositories, with exact
name and name-prefix matches ranked first. Every query uses the same verified
actor, membership checks and forced RLS as repository list/detail.

Only repository ID, display title and branch are returned. The frontend generates
encoded dashboard destinations itself; the server cannot provide arbitrary URLs.
Search does not index uploaded source, finding messages or planned modules.
Responses are `no-store`, request cancellation propagates into PostgreSQL, and
the dialog hides results from a previous query while a new query is pending.

## Maintenance

Add supported pages to `frontend/components/layout/navigation.ts` so the sidebar,
header and palette stay consistent. Add new searchable data through its owning
backend module's permission-scoped directory rather than loading every list into
the sidebar. Keep the ERP checkout unchanged; these are application-specific
adaptations, not a shared package with automatic cross-repository updates.
