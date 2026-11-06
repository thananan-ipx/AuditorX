"use client";

import { useEffect, useState } from "react";
import { GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Feedback } from "@/components/shared/feedback";
import { useLanguage } from "@/lib/i18n";
import { githubLoginErrors, githubService, githubStartHref } from "../service/github-service";

export function GitHubLogin({ next, error }: { next: string; error?: string }) {
  const { t } = useLanguage();
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void githubService.config(controller.signal).then(config => { if (!controller.signal.aborted) setAvailable(config.enabled); }).catch(() => {});
    return () => controller.abort();
  }, []);
  return <div className="space-y-3">
    {error && githubLoginErrors[error] && <Feedback tone="error">{t(githubLoginErrors[error])}</Feedback>}
    {available && <><div className="flex items-center gap-3 text-muted-foreground type-caption"><span className="h-px flex-1 bg-border" />{t("or")}<span className="h-px flex-1 bg-border" /></div><Button asChild variant="outline" className="w-full"><a href={githubStartHref("login", next)}><GitBranch className="size-4" aria-hidden="true" />{t("Continue with GitHub")}</a></Button></>}
  </div>;
}
