// Shared by the React primitive and class merging so a role override stays atomic.
export const typographyStyles = {
  "page-title": "type-page-title",
  "section-title": "type-section-title",
  "card-title": "type-card-title",
  body: "type-body",
  "body-sm": "type-body-sm",
  label: "type-label",
  caption: "type-caption",
  overline: "type-overline",
  code: "type-code",
  metric: "type-metric",
  "metric-sm": "type-metric-sm",
} as const;

export type TypographyVariant = keyof typeof typographyStyles;
