"use client";
import { PagePagination } from "@/components/shared/page-pagination";
import { Feedback, LoadingState } from "@/components/shared/feedback";
import { FormField } from "@/components/shared/form-field";
import { SelectField } from "@/components/shared/select-field";
import { StatusBadge } from "@/components/shared/status-badge";
import { PageHeader, Disclosure, FilterBar, StatCard, DataTable } from "@/components/shared/workspace-ui";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Box, FolderGit2, GitBranch, Loader, Plus, RefreshCw, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ApiError } from "@/lib/api-client";
import { useLanguage } from "@/lib/i18n";
import { dashboardHref, repositoryService, TABLE_PAGE_SIZE } from "../service/repository-service";
import type { Capabilities, Repository } from "../types";
import { defaultFilters, filterRepositories, summarize, type ListFilters, type ScanFilter, type SortKey } from "../repository-list";
import { EmptyRepositories, errorMessage, ModeNotice, WorkspaceError } from "../components/workspace-feedback";
import { GitHubRepositories } from "@/features/github/components/github-repositories";

type ListState = { kind: "loading" } | { kind: "error"; error: unknown } | {
  kind: "ready"; capabilities: Capabilities; repositories: Repository[]; total: number | null;
};

export default function RepositoriesPage() {
  const { t } = useLanguage();
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<ListState>({ kind: "loading" });
  const [filters, setFilters] = useState<ListFilters>(defaultFilters);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([repositoryService.capabilities(controller.signal), repositoryService.listPage(page, controller.signal)])
      .then(([capabilities, result]) => {
        if (!controller.signal.aborted) setState({ kind: "ready", capabilities, repositories: result.items, total: result.total });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setState({ kind: "error", error });
      });
    return () => controller.abort();
  }, [page, revision]);

  // Older links point at #add-repository; open the dialog instead of scrolling.
  useEffect(() => {
    if (window.location.hash !== "#add-repository") return;
    const timer = window.setTimeout(() => setAddOpen(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  function reload() { setState({ kind: "loading" }); setRevision((value) => value + 1); }
  function navigatePage(next: number) { setState({ kind: "loading" }); setPage(next); }

  const ready = state.kind === "ready" ? state : null;
  const canCreate = !!ready?.capabilities.repository_creation;
  const visible = useMemo(() => ready ? filterRepositories(ready.repositories, filters) : [], [ready, filters]);
  const stats = useMemo(() => summarize(ready?.repositories ?? []), [ready]);
  const filtered = filters.query !== "" || filters.access !== "all" || filters.scan !== "all";

  return <div className="min-w-0 space-y-6">
    <PageHeader title={t("Repositories")} icon={GitBranch} description={t("Choose a repository to open its dashboard, or register a GitHub URL.")}
      actions={<>
        <Button variant="outline" onClick={reload} disabled={state.kind === "loading"}><RefreshCw size={14} aria-hidden="true" />{t("Refresh list")}</Button>
        {canCreate && <Button onClick={() => setAddOpen(true)}><Plus size={16} aria-hidden="true" />{t("Add repository")}</Button>}
      </>} />
    {state.kind === "loading" && <LoadingState>{t("Loading repositories…")}</LoadingState>}
    {state.kind === "error" && <WorkspaceError error={state.error} retry={reload} />}
    {ready && <>
      {ready.capabilities.repository_storage === "prototype" && <ModeNotice capabilities={ready.capabilities} />}
      {ready.repositories.length > 0 && <section aria-label={t("Summary")} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t("Repositories")} value={ready.total ?? stats.loaded} icon={FolderGit2} hint={ready.total !== null && ready.total > stats.loaded ? `${t("Showing")} ${stats.loaded}` : undefined} />
        <StatCard label={t("Scanning now")} value={stats.scanning} icon={Loader} />
        <StatCard label={t("High findings")} value={stats.high} icon={ShieldAlert} hint={t("Latest completed scans")} />
        <StatCard label={t("Never scanned")} value={stats.neverScanned} icon={Box} />
      </section>}
      <section aria-labelledby="repository-list-title" className="space-y-4">
        <h2 id="repository-list-title" className="sr-only">{t("Your repositories")}</h2>
        {ready.repositories.length === 0
          ? page === 1 ? <EmptyRepositories canCreate={ready.capabilities.repository_creation} onAdd={() => setAddOpen(true)} /> : <p className="rounded-xl border bg-card p-8 text-muted-foreground type-body-sm">{t("No more repositories. Go back to the previous page.")}</p>
          : <>
            <FilterBar>
              <FormField containerClassName="min-w-48 flex-1" label={t("Search repositories")} type="search" value={filters.query} onChange={(event) => setFilters({ ...filters, query: event.target.value })} placeholder={t("Owner, name or branch")} />
              <SelectField id="filter-access" className="w-full sm:w-40" label={t("Access")} value={filters.access} onValueChange={(access) => setFilters({ ...filters, access })}
                options={[["all", "All"], ["owner", "owner"], ["editor", "editor"], ["viewer", "viewer"]].map(([value, label]) => ({ value, label: t(label) }))} />
              <SelectField id="filter-scan" className="w-full sm:w-48" label={t("Scan status")} value={filters.scan} onValueChange={(scan) => setFilters({ ...filters, scan: scan as ScanFilter })}
                options={([["all", "All"], ["active", "Scanning"], ["completed", "Completed"], ["failed", "Failed"], ["high", "Has high findings"], ["never", "Never scanned"]] as const).map(([value, label]) => ({ value, label: t(label) }))} />
              <SelectField id="sort-repositories" className="w-full sm:w-48" label={t("Sort by")} value={filters.sort} onValueChange={(sort) => setFilters({ ...filters, sort: sort as SortKey })}
                options={([["newest", "Newest added"], ["name", "Name"], ["last_scan", "Last scanned"], ["high", "Most high findings"]] as const).map(([value, label]) => ({ value, label: t(label) }))} />
              {filtered && <Button variant="ghost" onClick={() => setFilters(defaultFilters)}>{t("Clear filters")}</Button>}
            </FilterBar>
            <p role="status" className="text-muted-foreground type-caption">{visible.length} {t("of")} {ready.repositories.length} {t("repositories shown")}</p>
            {visible.length === 0 ? <p className="rounded-xl border bg-card p-8 text-center text-muted-foreground type-body-sm">{t("No repositories match these filters.")}</p>
              : <RepositoryTable repositories={visible} demo={ready.capabilities.repository_storage === "prototype"} />}
          </>}
        {ready.capabilities.repository_storage === "postgres" && (page > 1 || ready.repositories.length >= TABLE_PAGE_SIZE) && <PagePagination page={page} hasNext={ready.repositories.length >= TABLE_PAGE_SIZE && page < 10000} onPageChange={navigatePage} />}
      </section>
    </>}
    <Dialog open={addOpen} onOpenChange={setAddOpen}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{t("Add repository")}</DialogTitle><DialogDescription>{t("Save a GitHub URL to organize its scans in your workspace.")}</DialogDescription></DialogHeader>
        <div className="min-w-0 space-y-4">
          <GitHubRepositories />
          <Disclosure title={t("Register a repository URL")} description={t("Use this when you do not want to connect GitHub.")} open={ready?.repositories.length === 0 ? true : undefined}><CreateRepositoryForm /></Disclosure>
        </div>
      </DialogContent>
    </Dialog>
  </div>;
}

const scanLabels = { queued: "Queued", running: "Running", completed: "Completed", failed: "Failed", cancelled: "Cancelled" } as const;

function RepositoryTable({ repositories, demo }: { repositories: Repository[]; demo: boolean }) {
  const { locale, t } = useLanguage();
  const format = useMemo(() => new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en", { dateStyle: "medium", timeStyle: "short" }), [locale]);
  return <DataTable caption={t("Your repositories")}>
    <thead className="bg-muted/40 text-muted-foreground type-caption"><tr>
      <th scope="col" className="px-4 py-3 font-medium">{t("Repository")}</th>
      <th scope="col" className="hidden px-4 py-3 font-medium md:table-cell">{t("Access")}</th>
      <th scope="col" className="px-4 py-3 font-medium">{t("Latest scan")}</th>
      <th scope="col" className="hidden px-4 py-3 font-medium lg:table-cell">{t("Findings")}</th>
      <th scope="col" className="px-4 py-3 text-right font-medium"><span className="sr-only">{t("Actions")}</span></th>
    </tr></thead>
    <tbody className="divide-y">{repositories.map((repository) => {
      const scan = repository.latest_scan;
      const name = `${repository.owner} / ${repository.name}`;
      return <tr key={repository.id} className="align-middle hover:bg-muted/30">
        <td className="min-w-0 px-4 py-3">
          <Link href={dashboardHref(repository.id)} className="break-all type-label font-semibold underline-offset-4 hover:underline">{name}</Link>
          <p className="mt-0.5 break-all text-muted-foreground type-caption">{t("Branch")}: {repository.branch}{demo && <> · {t("Sample data")}</>}</p>
        </td>
        <td className="hidden px-4 py-3 md:table-cell">{repository.access_level && <Badge variant="outline">{t(repository.access_level)}</Badge>}</td>
        <td className="px-4 py-3">{scan
          ? <div className="space-y-1"><StatusBadge status={scan.status}>{t(scanLabels[scan.status] ?? scan.status)}</StatusBadge><p className="text-muted-foreground type-caption">{format.format(new Date(scan.created_at))}</p></div>
          : <span className="text-muted-foreground type-body-sm">{t("Never scanned")}</span>}</td>
        <td className="hidden px-4 py-3 lg:table-cell">{scan?.status === "completed"
          ? <div className="flex flex-wrap gap-1.5"><StatusBadge status="high">{t("High")} {scan.high}</StatusBadge><StatusBadge status="medium">{t("Medium")} {scan.medium}</StatusBadge><StatusBadge status="low">{t("Low")} {scan.low}</StatusBadge></div>
          : <span className="text-muted-foreground">-</span>}</td>
        <td className="px-4 py-3 text-right"><Button asChild size="sm" variant="outline"><Link href={dashboardHref(repository.id)}>{t("Open")}<span className="sr-only"> {name}</span><ArrowRight size={14} aria-hidden="true" /></Link></Button></td>
      </tr>;
    })}</tbody>
  </DataTable>;
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

  return <form onSubmit={submit} className="space-y-4" aria-busy={submitting}>
    <p className="text-muted-foreground type-body-sm">{t("Save repository details to your workspace. No code is downloaded and no GitHub permission is requested.")}</p>
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
  </form>;
}
