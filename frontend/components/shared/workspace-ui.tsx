import { useId, type ComponentProps, type ReactNode } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Page-level hierarchy. Pass translated content, never feature-specific logic. */
export function PageHeader({ title, description, eyebrow, actions, icon: Icon }: {
  title: ReactNode; description?: ReactNode; eyebrow?: ReactNode; actions?: ReactNode; icon?: LucideIcon;
}) {
  return <div data-slot="page-header" className="flex flex-col gap-4 border-b pb-6 xl:flex-row xl:items-start xl:justify-between">
    <div className="min-w-0 max-w-3xl">
      {eyebrow && <div className="mb-2 type-caption text-muted-foreground">{eyebrow}</div>}
      <div className="flex items-center gap-3">{Icon && <span className="grid size-11 shrink-0 place-items-center rounded-xl border bg-card text-primary"><Icon className="size-5" aria-hidden="true" /></span>}<h1 className="type-page-title">{title}</h1></div>
      {description && <div className="mt-2 type-body-sm text-muted-foreground">{description}</div>}
    </div>
    {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
  </div>;
}

export function SectionCard({ title, description, action, children, className, id }: {
  title: ReactNode; description?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; id?: string;
}) {
  const heading = useId();
  return <Card id={id} className={cn("min-w-0", className)} aria-labelledby={heading}>
    <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1.5"><CardTitle id={heading}>{title}</CardTitle>{description && <CardDescription>{description}</CardDescription>}</div>
      {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
    </CardHeader>
    <CardContent className="space-y-4">{children}</CardContent>
  </Card>;
}

export function FilterBar({ children, className, ...props }: ComponentProps<"div">) {
  return <div data-slot="filter-bar" className={cn("flex min-w-0 flex-wrap items-end gap-3 rounded-xl border bg-muted/30 p-3 sm:p-4", className)} {...props}>{children}</div>;
}

export function StatCard({ label, value, hint, icon: Icon, className }: {
  label: ReactNode; value: ReactNode; hint?: ReactNode; icon?: LucideIcon; className?: string;
}) {
  return <div data-slot="stat-card" className={cn("min-w-0 rounded-xl border bg-card p-4 sm:p-5", className)}>
    <div className="flex items-center justify-between gap-3"><p className="type-label text-muted-foreground">{label}</p>{Icon && <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}</div>
    <div className="mt-2 type-metric">{value}</div>
    {hint && <div className="mt-2 type-caption text-muted-foreground">{hint}</div>}
  </div>;
}

export function FormSection({ title, description, children, className, ...props }: ComponentProps<"fieldset"> & { title: ReactNode; description?: ReactNode }) {
  return <fieldset className={cn("min-w-0 space-y-4 rounded-xl border p-4 sm:p-5", className)} {...props}>
    <legend className="px-1.5 type-label font-semibold">{title}</legend>
    {description && <p className="type-caption text-muted-foreground">{description}</p>}{children}
  </fieldset>;
}

/** Native disclosure preserves keyboard access and keeps secondary details out of the way. */
export function Disclosure({ title, description, children, className, ...props }: Omit<ComponentProps<"details">, "title"> & { title: ReactNode; description?: ReactNode }) {
  return <details data-slot="disclosure" className={cn("group/disclosure min-w-0 rounded-xl border bg-card", className)} {...props}>
    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-5 [&::-webkit-details-marker]:hidden"><span className="min-w-0"><span className="block type-label font-semibold">{title}</span>{description && <span className="mt-1 block type-caption text-muted-foreground">{description}</span>}</span><ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open/disclosure:rotate-180" aria-hidden="true" /></summary>
    <div className="min-w-0 border-t p-4 sm:p-5">{children}</div>
  </details>;
}

export function DataTable({ children, caption }: { children: ReactNode; caption: ReactNode }) {
  return <div data-slot="data-table" className="max-w-full overflow-x-auto rounded-xl border"><table className="w-full text-left type-body-sm"><caption className="sr-only">{caption}</caption>{children}</table></div>;
}
