"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Typography } from "@/components/ui/typography";
import { EmptyState, LoadingState } from "@/components/shared/feedback";
import { FormField } from "@/components/shared/form-field";
import { SelectField } from "@/components/shared/select-field";
import { PagePagination } from "@/components/shared/page-pagination";
import { StatusBadge } from "@/components/shared/status-badge";
import { DataTable, FilterBar } from "@/components/shared/workspace-ui";
import { useLanguage } from "@/lib/i18n";
import { filterLocalProjects, type LocalProject } from "../local-projects";
import { dashboardHref, repositoryService } from "../service/repository-service";
import { WorkspaceError } from "./workspace-feedback";

type State = { kind: "loading" } | { kind: "error"; error: unknown }
  | { kind: "ready"; items: LocalProject[]; hasNext: boolean };

export function LocalProjects() {
  const { t, locale } = useLanguage();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  useEffect(() => {
    const controller = new AbortController();
    void repositoryService.localProjects(page, controller.signal)
      .then(result => { if (!controller.signal.aborted) setState({ kind: "ready", items: result.items, hasNext: result.hasNext }); })
      .catch((error: unknown) => { if (!controller.signal.aborted) setState({ kind: "error", error }); });
    return () => controller.abort();
  }, [page, revision]);
  const visible = useMemo(() => state.kind === "ready" ? filterLocalProjects(state.items, query, kind) : [], [state, query, kind]);
  const format = useMemo(() => new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en", { dateStyle: "medium", timeStyle: "short" }), [locale]);
  function retry() { setState({ kind: "loading" }); setRevision(value => value + 1); }
  return <section aria-labelledby="local-projects-title" className="space-y-4">
    <div className="space-y-1"><Typography variant="section-title" id="local-projects-title" className="flex items-center gap-2"><FolderOpen size={20} aria-hidden="true" />{t("Local projects")}</Typography>
      <p className="text-muted-foreground type-body-sm">{t("Folders and archives you have scanned. Each source shows its latest scan.")}</p></div>
    {state.kind === "loading" && <LoadingState>{t("Loading local projects…")}</LoadingState>}
    {state.kind === "error" && <WorkspaceError error={state.error} retry={retry} />}
    {state.kind === "ready" && <>
      {!state.items.length ? <EmptyState icon={FolderOpen} title={t("No local projects yet")}>{t("Scanned folders and archives appear here automatically.")}</EmptyState> : <>
        <FilterBar>
          <FormField label={t("Search local projects")} containerClassName="min-w-48 flex-1" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={t("Project name or source path")} />
          <SelectField label={t("Scan source")} className="w-full sm:w-48" value={kind} onValueChange={setKind} options={[["all", "All"], ["local", "Local path"], ["upload", "Folder or ZIP"]].map(([value, label]) => ({value, label:t(label)}))} />
        </FilterBar>
        <p role="status" className="text-muted-foreground type-caption">{visible.length} {t("of")} {state.items.length} {t("local projects on this page")}</p>
        {!visible.length ? <p className="rounded-xl border bg-card p-8 text-center text-muted-foreground type-body-sm">{t("No local projects match these filters.")}</p> : <DataTable caption={t("Local projects")}>
          <thead className="bg-muted/40 text-muted-foreground type-caption"><tr>
            <th scope="col" className="px-4 py-3 font-medium">{t("Project")}</th>
            <th scope="col" className="px-4 py-3 font-medium">{t("Latest scan")}</th>
            <th scope="col" className="hidden px-4 py-3 font-medium lg:table-cell">{t("Findings")}</th>
            <th scope="col" className="px-4 py-3 text-right font-medium"><span className="sr-only">{t("Actions")}</span></th>
          </tr></thead>
          <tbody className="divide-y">{visible.map(project => <tr key={project.scan_id} className="align-middle hover:bg-muted/30">
            <td className="max-w-xl px-4 py-3"><div className="flex flex-wrap items-center gap-2">
              <Link className="break-all type-label font-semibold hover:underline" href={dashboardHref(project.repository_id, project.scan_id)}>{project.name}</Link>
              <Badge variant="outline">{t(project.source_kind === "local" ? "Local path" : "Folder or ZIP")}</Badge>
            </div><p className="mt-1 break-all text-muted-foreground type-caption">{project.source_name}</p>
              <p className="mt-1 text-muted-foreground type-caption">{t("Workspace")}: {project.repository_name} · {t(project.access_level)} · {t("Scans")}: {project.scan_count}</p></td>
            <td className="px-4 py-3"><StatusBadge status={project.status}>{t(({queued:"Queued",running:"Running",completed:"Completed",failed:"Failed",cancelled:"Cancelled"} as const)[project.status])}</StatusBadge>
              <p className="mt-1 text-muted-foreground type-caption">{format.format(new Date(project.created_at))}</p></td>
            <td className="hidden px-4 py-3 lg:table-cell">{project.status === "completed" ? <div className="flex flex-wrap gap-1.5">
              <StatusBadge status="high">{t("High")} {project.high}</StatusBadge><StatusBadge status="medium">{t("Medium")} {project.medium}</StatusBadge><StatusBadge status="low">{t("Low")} {project.low}</StatusBadge>
            </div> : <span className="text-muted-foreground">—</span>}</td>
            <td className="px-4 py-3 text-right"><Button asChild variant="outline" size="sm"><Link href={dashboardHref(project.repository_id, project.scan_id)}>{t("Open")}<span className="sr-only"> {project.name}</span><ArrowRight size={14} aria-hidden="true" /></Link></Button></td>
          </tr>)}</tbody>
        </DataTable>}
      </>}
      {(page > 1 || state.hasNext) && <PagePagination page={page} hasNext={state.hasNext && page < 10000} onPageChange={next => { setState({kind:"loading"}); setPage(next); }} />}
    </>}
  </section>;
}
