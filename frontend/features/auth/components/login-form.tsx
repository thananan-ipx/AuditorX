"use client";
import { Feedback } from "@/components/shared/feedback";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { authService } from "@/features/auth/service/auth-service";
import { useLanguage } from "@/lib/i18n";

type LoginFormProps = {
  next: string;
  initialStatus?: string;
};

export function LoginForm({ next, initialStatus }: LoginFormProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const [error, setError] = useState("");
  const [status, setStatus] = useState(initialStatus ?? "");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setStatus("");
    const form = new FormData(event.currentTarget);
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const action = submitter?.value === "sign-up" ? "sign-up" : "sign-in";

    try {
      const authenticate = action === "sign-up" ? authService.signUp : authService.signIn;
      await authenticate(form.get("email"), form.get("password"));
      const destination = next.startsWith("/") && !next.startsWith("//") ? next : "/";
      router.replace(destination);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Authentication failed."));
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      {error && <Feedback tone="error">{error}</Feedback>}
      {status && <Feedback tone="success">{status}</Feedback>}
      <FormField label={t("Email")} required type="email" name="email" autoComplete="email" placeholder="you@company.com" />
      <FormField label={t("Password")} required minLength={8} maxLength={128} type="password" name="password" autoComplete="current-password" placeholder={t("At least 8 characters")} />
      <Button type="submit" variant="default" name="action" value="sign-in" disabled={pending} className="w-full">{pending ? t("Please wait…") : t("Sign in")}</Button>
      <Button type="submit" variant="outline" name="action" value="sign-up" disabled={pending} className="w-full">{t("Create account")}</Button>
    </form>
  );
}
