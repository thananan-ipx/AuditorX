"use client";

import { Code2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Typography } from "@/components/ui/typography";
import { LanguageSwitcher } from "@/components/language-switcher";
import { LoginForm } from "@/features/auth/components/login-form";
import { LoginHero } from "@/features/auth/components/login-hero";
import { APP_NAME } from "@/lib/constants";
import { useLanguage } from "@/lib/i18n";

/** Reuses ERP's two-column authentication layout with AuditorX branding and auth. */
export function LoginCard({ next, initialStatus }: { next: string; initialStatus?: string }) {
  const { t } = useLanguage();
  return <div className="flex min-h-svh flex-col bg-background">
    <header className="flex justify-end px-4 pt-4 sm:px-8"><LanguageSwitcher /></header>
    <main className="flex flex-1 items-center justify-center p-4 sm:p-8">
      <Card className="grid w-full max-w-5xl gap-0 overflow-hidden rounded-2xl p-0 shadow-sm lg:min-h-175 lg:grid-cols-2">
        <section className="flex items-center justify-center p-6 sm:p-12">
          <div className="flex w-full max-w-sm flex-col gap-8">
            <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full bg-primary text-primary-foreground"><Code2 className="size-5" aria-hidden="true" /></span><Typography variant="card-title" as="p">{APP_NAME}</Typography></div>
            <div><Typography variant="page-title">{t("Welcome to AuditorX")}</Typography><p className="mt-2 type-body-sm text-muted-foreground">{t("Sign in to your workspace")}</p></div>
            <LoginForm next={next} initialStatus={initialStatus} />
          </div>
        </section>
        <LoginHero />
      </Card>
    </main>
    <footer className="flex flex-col items-center justify-between gap-2 px-6 py-4 type-caption text-muted-foreground sm:flex-row"><p>© {new Date().getFullYear()} {APP_NAME}</p><p>{t("Code intelligence workspace")}</p></footer>
  </div>;
}
