# AuditorX typography standard

## Font and scale

Use **Noto Sans Thai** for both Thai and English. The existing Next.js font loader
provides the variable font; no second UI font or extra font download is added.
Use the system monospace stack only for code, paths, commit hashes and identifiers.

The values below assume the browser's default 16px root size. Implementation uses
`rem` and respects browser text preferences. Desktop sizes begin at 48rem (768px).

| Role / variant | Mobile → desktop | Weight | Line height | Use |
| --- | --- | --- | --- | --- |
| `page-title` | 28 → 32px | 700 | 1.5 | Page heading |
| `section-title` | 22 → 24px | 600 | 1.5 | Major section |
| `card-title` | 18px | 600 | 1.5 | Card, repository name, dialog title |
| `body` | 16px | 400 | 1.75 | Main text, explanatory content |
| `body-sm` | 14px | 400 | 1.65 | Compact UI copy and descriptions |
| `label` | 14px | 500 | 1.65 | Form labels, navigation, row titles |
| `caption` | 12px | 400 | 1.65 | Supporting metadata and chart labels |
| `overline` | 12px | 600 | 1.65 | Small group headings |
| `code` | 13px | 400 | 1.65 | Paths, IDs and code, in monospace |
| `metric` | 32px | 600 | 1.25 | Main numeric value |
| `metric-sm` | 24px | 600 | 1.25 | Compact numeric total |

Buttons use `type-control`: 14px / 500 / 1.5. Badges use the 12px caption scale with
medium weight. Text inputs and selects remain 16px at all widths, with 40px default
height; the compact select is 14px / 36px. Inputs are not reduced below 16px on mobile.

## Rules

- Use normal letter spacing for both languages. Do not compress Thai headings or
  add wide tracking to translated labels. Group headings retain their original case.
- Use only 400, 500, 600 and 700 weights. Use 600 or 700 to emphasize a heading,
  and 500 for labels; avoid making entire body paragraphs bold.
- Supporting text never goes below 12px. Do not use 10px or 11px metadata.
- Keep text size independent of heading level. Each page has one meaningful `h1`;
  the Login page's `h1` describes the sign-in task rather than the product brand.
  `CardTitle` renders an `h2`. Use the appropriate level for nested subsections.
- `metric` and `code` use tabular numerals to keep values aligned.
- Main text uses `text-foreground`; supporting text uses `text-muted-foreground`.
  Status colors describe state, while font size describes information hierarchy.
- Keep long explanatory text to about 65–75 characters per line where the layout
  permits. Let headings and text wrap; use `truncate` only for compact rows that
  have a separate way to inspect the complete value. Keep file paths breakable.
- Do not add `leading-none`, arbitrary sizes or per-page tracking. Check Thai
  vowels, tone marks, English descenders, multiline errors and 200% zoom when
  visually reviewing a new screen. This checklist is guidance, not a claim that
  every browser or zoom level has already been visually verified.

## Components and utilities

```tsx
import { Typography } from "@/components/ui/typography";

<Typography variant="page-title">{t("Repositories")}</Typography>
<Typography variant="body-sm" className="mt-2 text-muted-foreground">
  {description}
</Typography>

// Preserve heading hierarchy even when the visual size is a card title.
<Typography variant="card-title" as="h2">{title}</Typography>

// Slot composition avoids nesting a paragraph inside another element.
<Typography variant="code" asChild>
  <dd className="break-all">{commitSHA}</dd>
</Typography>
```

`label` is a text style, not a form-label replacement. Forms continue to use
`FormField`, `FieldLabel` or shadcn `Label` with a correctly associated input.

Use `className="type-caption text-muted-foreground"` on existing semantic markup
when a wrapper component would add no value. Both APIs use the same CSS roles.
Use one role per element; do not stack `type-body` and `type-caption` or override
the role with a raw size utility. Layout and colors remain ordinary Tailwind classes.

## Source of truth

- `frontend/app/typography.css`: font sizes, responsive scale, weights and line heights.
- `frontend/components/ui/typography.tsx`: typed variants and semantic default tags.
- `frontend/lib/typography.ts` and `frontend/lib/utils.ts`: one role map and atomic
  class merging, so `type-code` can replace a component's default `type-body-sm`.
- shadcn primitives: consume the same roles for buttons, fields, cards and feedback.
- ESLint: rejects arbitrary numeric text sizes and tracking outside UI primitives.

When adding a role, update these sources and this table together. Typography changes
must pass `npm run check` and be rebuilt into Docker before checking the running app.
