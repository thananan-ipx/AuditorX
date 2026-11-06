import type { ComponentProps } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const tones: Record<string, string> = {
  critical: "border-destructive/30 bg-destructive/10 text-destructive",
  high: "border-orange-200 bg-orange-50 text-orange-800",
  medium: "border-warning/30 bg-warning/10 text-warning",
  low: "border-sky-200 bg-sky-50 text-sky-800",
  queued: "border-warning/30 bg-warning/10 text-warning",
  running: "border-sky-200 bg-sky-50 text-sky-800",
  completed: "border-success/30 bg-success/10 text-success",
  failed: "border-destructive/30 bg-destructive/10 text-destructive",
  cancelled: "border-border bg-muted text-muted-foreground",
  accepted: "border-success/30 bg-success/10 text-success",
  simulated: "border-violet-200 bg-violet-50 text-violet-800",
  needs_context: "border-warning/30 bg-warning/10 text-warning",
  excluded: "border-border bg-muted text-muted-foreground",
  unreviewed: "border-border bg-card text-muted-foreground",
};

export function StatusBadge({ status, children, className, ...props }: ComponentProps<typeof Badge> & { status: string }) {
  return <Badge {...props} variant="outline" className={cn(tones[status.toLowerCase()], className)}>{children ?? status}</Badge>;
}
