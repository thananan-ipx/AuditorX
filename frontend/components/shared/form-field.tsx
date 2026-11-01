"use client";

import { useId, type ComponentProps, type ReactNode } from "react";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/shared/password-input";

type FormFieldProps = ComponentProps<typeof Input> & {
  label: ReactNode;
  description?: ReactNode;
  error?: string;
  containerClassName?: string;
};

export function FormField({ id, label, description, error, containerClassName, ...props }: FormFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const Control = props.type === "password" ? PasswordInput : Input;
  const describedBy = [props["aria-describedby"], description && `${inputId}-help`, error && `${inputId}-error`].filter(Boolean).join(" ") || undefined;
  return <Field className={containerClassName} data-invalid={!!error}>
    <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
    <Control {...props} id={inputId} aria-invalid={error ? true : props["aria-invalid"]} aria-describedby={describedBy} />
    {description && <FieldDescription id={`${inputId}-help`}>{description}</FieldDescription>}
    {error && <FieldError id={`${inputId}-error`}>{error}</FieldError>}
  </Field>;
}
