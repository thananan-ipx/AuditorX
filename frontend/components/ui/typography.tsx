import type { HTMLAttributes } from "react";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";
import { typographyStyles, type TypographyVariant } from "@/lib/typography";
type TypographyTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p" | "span" | "div" | "code";
const defaultTags: Record<TypographyVariant, TypographyTag> = {
  "page-title": "h1",
  "section-title": "h2",
  "card-title": "h3",
  body: "p",
  "body-sm": "p",
  label: "span",
  caption: "span",
  overline: "p",
  code: "code",
  metric: "span",
  "metric-sm": "span",
};

type TypographyProps = HTMLAttributes<HTMLElement> & {
  variant?: TypographyVariant;
  as?: TypographyTag;
  asChild?: boolean;
};

// Like Button, this uses Radix Slot when the caller supplies the semantic element.
// Visual hierarchy and document heading level can be selected independently.
function Typography({ variant = "body", as, asChild = false, className, ...props }: TypographyProps) {
  const Component = asChild ? Slot.Root : (as ?? defaultTags[variant]);
  return <Component data-slot="typography" data-variant={variant} className={cn(typographyStyles[variant], className)} {...props} />;
}

export { Typography, typographyStyles, type TypographyVariant, type TypographyProps };
