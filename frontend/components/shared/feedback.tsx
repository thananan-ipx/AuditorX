import type { ComponentProps, ReactNode } from "react";
import { LoaderCircle, type LucideIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const tones = {
  info: "border-border bg-card text-card-foreground",
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
  error: "border-destructive/30 bg-destructive/10 text-destructive",
};

export function Feedback({ tone = "info", children, className, role, ...props }: ComponentProps<typeof Alert> & { tone?: keyof typeof tones }) {
  return <Alert {...props} variant={tone === "error" ? "destructive" : "default"} role={role ?? (tone === "error" ? "alert" : "status")} className={cn(tones[tone], className)}>
    <AlertDescription className="text-inherit">{children}</AlertDescription>
  </Alert>;
}

export function LoadingState({ children, className }: { children: ReactNode; className?: string }) {
  return <Feedback className={className}><span className="flex items-center gap-2"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" />{children}</span></Feedback>;
}

export function EmptyState({ icon: Icon, title, children, action }: { icon: LucideIcon; title: ReactNode; children: ReactNode; action?: ReactNode }) {
  return <Card><CardContent className="flex flex-col items-center gap-4 py-14 text-center">
    <Icon className="size-9 text-muted-foreground" aria-hidden="true" />
    <CardTitle>{title}</CardTitle>
    <CardDescription className="max-w-md">{children}</CardDescription>
    {action}
  </CardContent></Card>;
}
