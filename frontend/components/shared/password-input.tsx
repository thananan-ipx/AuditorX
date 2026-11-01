"use client";

import { useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** ERP's password visibility pattern, adapted to AuditorX's field primitive. */
export function PasswordInput({ className, ...props }: Omit<ComponentProps<typeof Input>, "type">) {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  return <div className="relative">
    <Input {...props} type={visible ? "text" : "password"} className={cn("pr-11", className)} />
    <Button type="button" variant="ghost" size="icon-sm" className="absolute right-1 top-1 text-muted-foreground" disabled={props.disabled} aria-label={t(visible ? "Hide password" : "Show password")} aria-controls={props.id} aria-pressed={visible} onClick={() => setVisible(previous => !previous)}>
      {visible ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
    </Button>
  </div>;
}
