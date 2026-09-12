"use client";

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
      const payload = await authenticate(form.get("email"), form.get("password"));
      if (payload?.requires_email_confirmation) {
        setStatus(t("Check your email to confirm your account, then sign in."));
        return;
      }
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
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {status && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{status}</p>}
      <label className="block text-sm font-medium">{t("Email")}<input required type="email" name="email" autoComplete="email" className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3 outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-200" placeholder="you@company.com" /></label>
      <label className="block text-sm font-medium">{t("Password")}<input required minLength={8} type="password" name="password" autoComplete="current-password" className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3 outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-200" placeholder={t("At least 8 characters")} /></label>
      <button name="action" value="sign-in" disabled={pending} className="h-11 w-full rounded-lg bg-[#18251e] text-sm font-semibold text-white transition hover:bg-[#26392e] disabled:opacity-60">{pending ? t("Please wait…") : t("Sign in")}</button>
      <button name="action" value="sign-up" disabled={pending} className="h-11 w-full rounded-lg border border-slate-300 bg-white text-sm font-semibold transition hover:bg-slate-50 disabled:opacity-60">{t("Create account")}</button>
    </form>
  );
}
