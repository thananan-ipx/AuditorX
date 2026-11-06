"use client";

import { useId, type ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type SelectOption = { value: string; label: ReactNode; disabled?: boolean };

export function SelectField({ id, label, description, placeholder, value, onValueChange, options, disabled, className }: {
  id?: string; label: ReactNode; description?: ReactNode; placeholder?: string; value: string;
  onValueChange: (value: string) => void; options: SelectOption[]; disabled?: boolean; className?: string;
}) {
  const generated = useId();
  const control = id ?? generated;
  return <div className={cn("min-w-0 space-y-2", className)}>
    <Label htmlFor={control}>{label}</Label>
    <Select disabled={disabled} value={value} onValueChange={onValueChange}>
      <SelectTrigger id={control} aria-describedby={description ? `${control}-help` : undefined}><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>{options.map(option => <SelectItem key={option.value} value={option.value} disabled={option.disabled}>{option.label}</SelectItem>)}</SelectContent>
    </Select>
    {description && <p id={`${control}-help`} className="type-caption text-muted-foreground">{description}</p>}
  </div>;
}
