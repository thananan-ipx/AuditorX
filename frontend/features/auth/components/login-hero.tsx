"use client";

import { Code2, GitBranch, ShieldCheck } from "lucide-react";
import { Typography } from "@/components/ui/typography";
import { useLanguage } from "@/lib/i18n";

export function LoginHero() {
  const { t } = useLanguage();
  return <div aria-hidden="true" className="relative hidden overflow-hidden bg-primary p-10 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(164,202,81,0.3),transparent_60%)]" />
    <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-size-[40px_40px]" />
    <p className="relative type-overline text-white/70">AuditorX · {t("Code Intelligence")}</p>
    <div className="relative my-12 flex items-center justify-center gap-4">
      <div className="grid size-14 place-items-center rounded-2xl border border-white/15 bg-white/5"><GitBranch className="size-6" /></div><span className="h-px w-6 bg-white/25" /><div className="grid size-20 place-items-center rounded-2xl border border-white/20 bg-white/10 shadow-lg"><Code2 className="size-9 text-[#d9f69b]" /></div><span className="h-px w-6 bg-white/25" /><div className="grid size-14 place-items-center rounded-2xl border border-white/15 bg-white/5"><ShieldCheck className="size-6" /></div>
    </div>
    <div className="relative space-y-4"><Typography variant="section-title" as="p">{t("A clearer view of your code.")}</Typography><p className="max-w-sm type-body text-white/75">{t("Your repositories, scan history and findings in one workspace.")}</p></div>
  </div>;
}
