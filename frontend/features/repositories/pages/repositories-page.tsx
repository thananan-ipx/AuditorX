"use client";
import { Typography } from "@/components/ui/typography";
import { PagePagination } from "@/components/shared/page-pagination";
import { Feedback, LoadingState } from "@/components/shared/feedback";
import { FormField } from "@/components/shared/form-field";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, GitBranch, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError } from "@/lib/api-client";
import { useLanguage } from "@/lib/i18n";
import { dashboardHref, PAGE_SIZE, repositoryService } from "../service/repository-service";
import type { Capabilities, Repository } from "../types";
import { EmptyRepositories, errorMessage, ModeNotice, WorkspaceError } from "../components/workspace-feedback";

type ListState = { kind: "loading" } | { kind: "error"; error: unknown } | {
  kind: "ready"; capabilities: Capabilities; repositories: Repository[];
};

export default function RepositoriesPage() {
  const { t } = useLanguage();
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<ListState>({ kind: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([repositoryService.capabilities(controller.signal), repositoryService.list(page, controller.signal)])
      .then(([capabilities, repositories]) => {
        if (!controller.signal.aborted) setState({ kind: "ready", capabilities, repositories });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setState({ kind: "error", error });
      });
    return () => controller.abort();
  }, [page, revision]);

  function navigatePage(next: number) {
    setState({ kind: "loading" });
    setPage(next);
  }

  return <div className="min-w-0">
    <div className="mb-7">
      <p className="mb-2 text-muted-foreground type-body-sm">{t("Workspace / Repositories")}</p>
      <Typography variant="page-title" as="h1">{t("Repositories")}</Typography>
      <p className="mt-2 text-muted-foreground type-body-sm">{t("Choose a repository to open its dashboard, or register a GitHub URL.")}</p>
    </div>
    {state.kind === "loading" && <LoadingState>{t("Loading repositories…")}</LoadingState>}
    {state.kind === "error" && <WorkspaceError error={state.error} retry={() => { setState({ kind: "loading" }); setRevision((value) => value + 1); }} />}
    {state.kind === "ready" && <>
      <ModeNotice capabilities={state.capabilities} />
      {state.capabilities.repository_creation && <CreateRepositoryForm />}
      <section aria-labelledby="repository-list-title" className="mt-7">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Typography variant="section-title" as="h2" id="repository-list-title">{t("Your repositories")}</Typography>
          <Button variant="ghost" size="sm" onClick={() => { setState({ kind: "loading" }); setRevision((value) => value + 1); }}>{t("Refresh list")}</Button>
        </div>
        {state.repositories.length === 0
          ? page === 1 ? <EmptyRepositories canCreate={state.capabilities.repository_creation} /> : <p className="rounded-xl border bg-white p-8 text-muted-foreground type-body-sm">{t("No more repositories. Go back to the previous page.")}</p>
          : <div className="grid gap-4 xl:grid-cols-2">{state.repositories.map((repository) => <Card key={repository.id}>
            <CardContent className="p-5">
              <div className="mb-4 flex items-start gap-3">
                <div className="rounded-xl border bg-slate-50 p-3"><GitBranch size={20} aria-hidden="true" /></div>
                <div className="min-w-0 flex-1">
                  <Typography variant="card-title" as="h3" className="break-all">{repository.owner} / {repository.name}</Typography>
                  <p className="mt-1 break-all text-muted-foreground type-caption">{t("Branch")}: {repository.branch}</p>
                </div>
                {repository.access_level && <Badge>{repository.access_level}</Badge>}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                <Badge>{state.capabilities.repository_storage === "prototype" ? t("Sample data") : repository.status}</Badge>
                <Button asChild size="sm" variant="outline"><Link href={dashboardHref(repository.id)}>{t("Open dashboard")}<span className="sr-only"> for {repository.owner}/{repository.name}</span><ArrowRight size={14} aria-hidden="true" /></Link></Button>
              </div>
            </CardContent>
          </Card>)}</div>}
      </section>
      {state.capabilities.repository_storage === "postgres" && <PagePagination className="mt-5" page={page} hasNext={state.repositories.length >= PAGE_SIZE && page < 10000} onPageChange={navigatePage} />}
    </>}
  </div>;
}

function CreateRepositoryForm() {
  const { t } = useLanguage();
  const router = useRouter();
  const [url, setURL] = useState("");
  const [branch, setBranch] = useState("main");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [created, setCreated] = useState<Repository | null>(null);
  // Prevent two rapid submits before React commits the disabled state.
  const inFlight = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    setError(null);
    setCreated(null);
    try {
      const repository = await repositoryService.create(url, branch);
      setCreated(repository);
      setURL("");
      setBranch("main");
      router.push(dashboardHref(repository.id));
    } catch (error) {
      setError(error);
    } finally {
      setSubmitting(false);
      inFlight.current = false;
    }
  }

  return <Card id="add-repository" className="scroll-mt-24">
    <CardHeader><CardTitle>{t("Add repository")}</CardTitle><CardDescription>{t("Save repository details to your workspace. No code is downloaded and no GitHub permission is requested.")}</CardDescription></CardHeader>
    <CardContent>
      <form onSubmit={submit} className="space-y-4" aria-busy={submitting}>
        <fieldset disabled={submitting} className="grid gap-4 md:grid-cols-[1fr_220px]">
          <FormField label={t("GitHub repository URL")} id="repository-url" name="repository_url" type="url" required maxLength={2048} value={url} onChange={(event) => setURL(event.target.value)} placeholder="https://github.com/owner/repository" description={t("Use an HTTPS GitHub URL without credentials, query parameters or a file path.")} />
          <FormField label={t("Branch")} id="repository-branch" name="branch" maxLength={255} value={branch} onChange={(event) => setBranch(event.target.value)} placeholder="main" />
        </fieldset>
        {created && <Feedback tone="success">{t("Repository saved.")} <Link href={dashboardHref(created.id)} className="underline">{t("Open its dashboard")}</Link></Feedback>}
        {error != null && <Feedback tone="error">
          {errorMessage(error, t)}
          {error instanceof ApiError && error.status === 401 && <Link className="ml-2 underline" href="/login?next=%2Frepositories">{t("Sign in")}</Link>}
        </Feedback>}
        <Button type="submit" disabled={submitting}><Plus size={16} aria-hidden="true" />{submitting ? t("Saving repository…") : t("Add repository")}</Button>
        <p className="text-muted-foreground type-caption">{t("Blank branch defaults to main. Repository access and branch existence are not checked yet.")}</p>
      </form>
    </CardContent>
  </Card>;
}
