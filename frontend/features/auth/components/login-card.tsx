"use client";

import { Code2, LockKeyhole } from "lucide-react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { LoginForm } from "@/features/auth/components/login-form";
import { useLanguage } from "@/lib/i18n";

export function LoginCard({ next, initialStatus }: { next: string; initialStatus?: string }) {
  const { t } = useLanguage();

  return (
    <main className="relative grid min-h-screen place-items-center bg-[#0d1720] px-4 py-10 text-slate-950">
      <div className="absolute right-4 top-4 sm:right-7 sm:top-7"><LanguageSwitcher inverse /></div>
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-white p-7 shadow-2xl shadow-black/30 sm:p-9">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-xl bg-[#c9f060] text-[#0d1720]"><Code2 size={22} strokeWidth={2.6} /></div>
          <div><h1 className="text-xl font-bold tracking-tight">AuditorX</h1><p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t("Code Intelligence")}</p></div>
        </div>
        <div className="mb-6">
          <div className="mb-3 grid size-10 place-items-center rounded-full bg-slate-100"><LockKeyhole size={18} /></div>
          <h2 className="text-2xl font-bold tracking-tight">{t("Sign in to your workspace")}</h2>
          <p className="mt-2 text-sm text-slate-500">{t("Use your email and password, or create an account.")}</p>
        </div>
        <LoginForm next={next} initialStatus={initialStatus} />
      </section>
    </main>
  );
}
