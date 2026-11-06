# AuditorX UI conventions

The shared UI lives in `frontend/components/ui` (shadcn/Radix primitives) and
`frontend/components/shared` (application patterns). Features supply data,
translated copy and callbacks; shared components do not call feature APIs.

## Page and task hierarchy

- One page title (`h1`) with `PageHeader`, short description and primary action.
- Use `SectionCard` for a task with a title, supporting text and optional actions.
- Use `Disclosure` for secondary metadata, rule coverage or experiment details.
- Keep the main result visible. Scan setup opens from New scan and presents one
  source method at a time. Existing history is selected with `SelectField`.
- Sidebar contains implemented destinations only. Do not add disabled placeholder menus.
- Repository lists precede connection/registration forms. Dataset samples precede
  optional technical explanation in visual priority.

## Shared components

| Component | Purpose | Used in |
|---|---|---|
| PageHeader | Consistent page title, context, description and actions | scans, repositories, datasets, workspace empty states |
| SectionCard | Accessible heading-linked task container | scan setup and history |
| StatCard | Label, value, optional hint and icon | finding severity, label readiness, dataset priority |
| FilterBar | Responsive container for search, selectors and refresh | findings, labels, dataset samples |
| SelectField | Labeled shadcn Select with optional description | all scan/review/dataset/GitHub selectors |
| FormField | Input/password label, help and error association | authentication, scan paths, registration, search |
| FormSection | Fieldset/legend for related form controls | project context and review decision |
| Disclosure | Keyboard-accessible native details/summary | scan metadata, coverage, registration, dataset experiments |
| DataTable | Caption and contained horizontal overflow | dataset samples |
| StatusBadge | Shared semantic colors plus visible text | severity, review state and dataset priority |
| Feedback / LoadingState / EmptyState | Consistent feedback patterns | workspace and feature states |
| PagePagination | One-based pages and optional unknown totals | scan results, labels, repositories and datasets |

## Visual rules

- Use CSS color tokens from `app/globals.css` and type scale from `app/typography.css`.
- Primary actions use Button default; secondary actions outline; contextual help ghost.
- Forms use 40px controls, shared focus rings and visible labels. Do not introduce
  feature-specific native selects or custom dropdown implementations.
- Search and filters wrap on small screens. Use min-w-0 for nested content and
  break-all for hashes/paths. Tables scroll within their own wrapper.
- Text is required on statuses; color alone must not carry meaning.
- Accepted and simulated labels remain visually and semantically distinct.
  A readiness total always includes separate human-confirmed and simulated counts.
- Export labels uses one menu with explicit all-data and simulated-training choices.
- Review dialogs retain dirty-change protection and a fixed action footer with
  independently scrolling form content. UI cleanup must not change saved label semantics.
- Pass all new copy through `t()` with a Thai translation in `lib/i18n.tsx`.

## Validation

Run `npm run check` in frontend. Review desktop and mobile layouts in the browser,
including source tabs, history selection, label filters/dialog, export menu,
repository registration and dataset detail/filter/pagination. Verify that read-only
permissions, empty/error/loading states and unsaved label protection remain intact.

This UI refresh does not add a prediction service or alter training labels.
