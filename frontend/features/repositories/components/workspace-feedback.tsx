"use client";

import Link from "next/link";
import { AlertTriangle, Box, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ApiError } from "@/lib/api-client";
import { useLanguage } from "@/lib/i18n";
import type { Capabilities, Repository } from "../types";

export function errorMessage(error: unknown, translate: (message: string) => string = (message) => message): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return translate("Your session has expired. Sign in again to continue.");
    if (error.status === 403) return translate("You do not have permission to perform this action.");
    if (error.status === 404) return translate("This repository was not found or is no longer accessible.");
    if (error.code === "REPOSITORY_EXISTS") return translate("This repository is already registered. Choose it from the list below.");
    if (error.code === "SCANNER_NOT_READY") return translate("The scan worker is not available yet. No scan was queued.");
    if (error.status === 400) return error.message;
    if (error.status >= 500) return translate("The API or repository storage is unavailable. Please try again later.");
  }
  return translate("The request could not be completed. Check your connection and try again.");
}

export function WorkspaceError({ error, retry, returnTo = "/repositories" }: { error: unknown; retry: () => void; returnTo?: string }) {
  const { t } = useLanguage();
  const expired = error instanceof ApiError && error.status === 401;
  return <Card role="alert"><CardContent className="space-y-4 p-6">
    <AlertTriangle className="text-orange-600" aria-hidden="true" />
    <h2 className="text-lg font-semibold">{expired ? t("Sign in required") : t("Unable to load workspace")}</h2>
    <p className="text-sm text-muted-foreground">{errorMessage(error, t)}</p>
    <div className="flex flex-wrap gap-2">
      {expired ? <Button asChild><Link href={`/login?next=${encodeURIComponent(returnTo)}`}>{t("Sign in")}</Link></Button> : <Button onClick={retry}>{t("Try again")}</Button>}
      <Button variant="outline" asChild><Link href="/repositories">{t("Repositories")}</Link></Button>
    </div>
  </CardContent></Card>;
}

export function ModeNotice({ capabilities }: { capabilities: Capabilities }) {
  const { t } = useLanguage();
  return capabilities.repository_storage === "prototype"
    ? <p role="note" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{t("Demo workspace — repositories, findings and scan responses are sample data. Adding repositories is unavailable in this mode.")}</p>
    : <p role="note" className="mb-5 rounded-xl border border-lime-200 bg-lime-50 px-4 py-3 text-sm text-lime-900">{t("Persistent workspace — only repositories you can access are listed. Registering a URL does not connect GitHub or scan its code.")}</p>;
}

export function EmptyRepositories({ canCreate }: { canCreate: boolean }) {
  const { t } = useLanguage();
  return <Card><CardContent className="space-y-4 py-14 text-center">
    <Box className="mx-auto text-slate-400" size={36} aria-hidden="true" />
    <h2 className="text-xl font-semibold">{t("No repositories yet")}</h2>
    <p className="text-sm text-muted-foreground">{canCreate ? t("Add a GitHub repository to start organizing your workspace.") : t("There are no repositories available in this workspace.")}</p>
    {canCreate && <Button asChild><Link href="/repositories#add-repository">{t("Add repository")}</Link></Button>}
  </CardContent></Card>;
}

export function UnscannedRepository({ repository }: { repository: Repository }) {
  const { t } = useLanguage();
  return <Card><CardContent className="space-y-4 py-14 text-center">
    <GitBranch className="mx-auto text-slate-400" size={36} aria-hidden="true" />
    <h2 className="text-xl font-semibold">{t("Scan queue unavailable")}</h2>
    <p className="text-sm text-muted-foreground">{repository.owner}/{repository.name} · {repository.branch}</p>
    <p className="mx-auto max-w-md text-sm leading-6 text-muted-foreground">{t("Your repository is saved. Scan controls and real results require the scan queue to be enabled on the API. This page has not queued a scan.")}</p>
    <Button disabled>{t("Scan queue unavailable")}</Button>
  </CardContent></Card>;
}
