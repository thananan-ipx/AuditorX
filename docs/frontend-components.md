# Frontend component conventions

The frontend uses shadcn/ui's New York components with Radix primitives and Tailwind CSS 4. Components are owned by this repository; they are not a separately hosted UI service.

## Where components belong

- `frontend/components/ui`: shadcn primitives and the shared `Typography` primitive. The shadcn files come from the official `new-york-v4` registry, with imports resolved to the local aliases and type styles adapted to the application scale. Keep these generic and free of API calls and business rules.
- `frontend/components/shared`: reusable application patterns built from those primitives: `FormField`, `Feedback`, `LoadingState`, `EmptyState`, `StatusBadge`, and `PagePagination`.
- `frontend/components/layout`: application navigation and layout. Mobile navigation uses shadcn Sheet for keyboard focus, Escape, and dismissal.
- `frontend/features/*/components`: domain behavior and composition. Import the common UI instead of copying markup or control styles.

## Usage

```tsx
import { FormField } from "@/components/shared/form-field";
import { Feedback } from "@/components/shared/feedback";
import { Button } from "@/components/ui/button";

<FormField
  id="repository-url"
  label={t("GitHub repository URL")}
  description={t("Use an HTTPS GitHub URL without credentials, query parameters or a file path.")}
  name="repository_url"
  type="url"
  required
/>
<Feedback tone="error">{errorMessage}</Feedback>
<Button type="submit" disabled={pending}>{t("Add repository")}</Button>
```

`FormField` connects the label, input, help text and error using unique IDs, and forwards input props and refs. Use `Field` with `Label` and `NativeSelect` to compose other control types; associate the label with the control using `htmlFor` and `id`.

Use `Button` variants (`default`, `outline`, `secondary`, `ghost`, `link`, `destructive`) and sizes. Navigation actions use `Button asChild` with Next.js `Link`. Specify `type="button"` for non-submit actions inside forms. Icon-only actions require a translated accessible name.

`Feedback` accepts `info`, `success`, `warning`, and `error`; errors announce as alerts and other feedback as status by default. Use `role="note"` for persistent contextual notices. `StatusBadge` maps the original English severity or scan status to a color; pass the translated display text as its children.

`PagePagination` uses **one-based** page numbers. Supply `pageCount` for a known total or `hasNext` for an API list with no total. Convert zero-based feature state at the boundary.

## Theme and maintenance

Change color tokens in `frontend/app/globals.css` and typography tokens in `frontend/app/typography.css` to update the system. Avoid repeating primary button colors and semantic status colors in feature pages. Use `Typography` or the `type-*` utilities for text; see [Typography standard](frontend-typography.md). Layout, charts and domain-specific content still use semantic HTML and Tailwind.

Add new shadcn components from the frontend directory with `npx shadcn@latest add <component>`. Review generated changes to existing components before accepting an overwrite, and resolve imports through `@/components/ui` and `@/lib/utils`.

ESLint prohibits raw form controls and buttons outside `components/ui`, including hidden upload inputs, to keep future screens on the common library. Run `npm run check` in `frontend` before delivering changes.
