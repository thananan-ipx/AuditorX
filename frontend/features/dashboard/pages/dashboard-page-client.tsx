"use client";
import { Typography } from "@/components/ui/typography";
import { StatusBadge } from "@/components/shared/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Feedback } from "@/components/shared/feedback";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, Bot, Check, CircleDot, Clock3, Code2,
  GitBranch, Play, Settings, ShieldCheck, Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { dashboardService } from "@/features/dashboard/service/dashboard-service";
import { loadDashboard, type DashboardResult } from "@/features/dashboard/service/load-dashboard";
import { dashboardHref } from "@/features/repositories/service/repository-service";
import { EmptyRepositories, errorMessage, ModeNotice, UnscannedRepository, WorkspaceError } from "@/features/repositories/components/workspace-feedback";
import type { Dashboard, Issue } from "@/features/dashboard/types";
import { cn } from "@/lib/utils";
import { RepositoryScans } from "@/features/scans/components/repository-scans";
import { useLanguage } from "@/lib/i18n";


type PageState = { kind: "loading" } | { kind: "error"; error: unknown } | DashboardResult;

export default function DashboardPage({ repositoryID }: { repositoryID?: string }) {
  const { t } = useLanguage();
  const [state, setState] = useState<PageState>({ kind: "loading" });
  const [revision, setRevision] = useState(0);
  const [scanStatus, setScanStatus] = useState("");
  const [scanBusy, setScanBusy] = useState(false);
  const scanInFlight = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    void loadDashboard(repositoryID, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setState(result);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setState({ kind: "error", error });
      });
    return () => controller.abort();
  }, [repositoryID, revision]);

  const startScan = async () => {
    if (state.kind !== "ready" || scanInFlight.current || state.capabilities.repository_storage !== "prototype") return;
    scanInFlight.current = true;
    setScanBusy(true);
    setScanStatus("");
    try {
      await dashboardService.startScan(state.repository.id, state.repository.branch);
      setScanStatus(t("Demo request accepted. No code was scanned and these sample results have not changed."));
    } catch (error) { setScanStatus(errorMessage(error, t)); }
    finally { scanInFlight.current = false; setScanBusy(false); }
  };

  return (
    <div className="min-w-0">
      {state.kind === "loading" ? <DashboardSkeleton /> : state.kind === "error"
        ? <WorkspaceError error={state.error} returnTo={repositoryID ? dashboardHref(repositoryID) : "/dashboard"} retry={() => { setState({ kind: "loading" }); setRevision((value) => value + 1); }} />
        : <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-muted-foreground type-body-sm">{state.kind === "empty" ? t("Workspace overview") : `${state.repository.owner} / ${state.repository.name}`}</p>
            <Button asChild variant="outline"><Link href="/repositories">{t("Choose repository")} <ArrowRight size={14} /></Link></Button>
          </div>
          <ModeNotice capabilities={state.capabilities} />
          {state.kind === "empty" ? <EmptyRepositories canCreate={state.capabilities.repository_creation} />
            : state.kind === "unscanned" ? <><Typography variant="page-title" as="h1" className="mb-5">{t("Repository overview")}</Typography><UnscannedRepository repository={state.repository} /></>
            : state.kind === "scans" ? <RepositoryScans key={state.repository.id} repository={state.repository} />
            : <>
              {scanStatus && <Feedback>{scanStatus}</Feedback>}
              <DashboardContent dashboard={state.dashboard} issues={state.issues} scanBusy={scanBusy} demo={state.capabilities.repository_storage === "prototype"} startScan={startScan} />
            </>}
        </>}
    </div>
  );
}

function DashboardContent({ dashboard, issues, scanBusy, demo, startScan }: { dashboard: Dashboard; issues: Issue[]; scanBusy: boolean; demo: boolean; startScan: () => void }) {
  const { locale, t } = useLanguage();
  const latestTime = useMemo(() => new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(dashboard.latest_scan.completed_at)), [dashboard.latest_scan.completed_at, locale]);
  const maxIssue = Math.max(1, ...dashboard.trend.map((point) => point.issue_count));
  return (
    <>
      <section className="mb-7 flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-muted-foreground type-body-sm"><span>{t("Workspace")}</span><span>/</span><span>{dashboard.repository.owner}</span></div>
          <Typography variant="page-title" as="h1" className="break-all text-slate-950">{dashboard.repository.name} {t("Overview").toLowerCase()}</Typography>
          <p className="mt-1.5 text-muted-foreground type-body-sm">{t("Here’s what changed in your codebase since the last scan.")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={startScan} disabled={scanBusy || !demo}><Play size={15} fill="currentColor" /> {scanBusy ? t("Simulating…") : demo ? t("Simulate scan") : t("Scanner not available yet")}</Button>
        </div>
      </section>

      <Card className="mb-5 overflow-hidden">
        <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center">
          <div className="grid size-11 place-items-center rounded-xl border bg-slate-50"><GitBranch size={21} /></div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><Typography variant="section-title" as="h2">{dashboard.repository.owner} / {dashboard.repository.name}</Typography><Badge className="border-emerald-200 bg-emerald-50 text-emerald-700"><Check size={12} className="mr-1" />{dashboard.repository.status}</Badge></div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground type-caption"><span>{dashboard.repository.branch}</span><span>{dashboard.repository.primary_language}</span><span className="flex items-center gap-1"><Clock3 size={12} /> {t("Last scanned")} {latestTime}</span><span className="type-code">{dashboard.latest_scan.commit_sha}</span></div>
          </div>
          <Button variant="ghost" size="sm" asChild><Link href="/repositories">{t("Repositories")} <ArrowRight size={15} /></Link></Button>
        </div>
      </Card>

      <section className="mb-5 grid gap-5 xl:grid-cols-[1.08fr_1fr_1fr]">
        <QualityCard score={dashboard.quality_score.value} />
        <IssueSummary data={dashboard.issues.by_severity} total={dashboard.issues.total} />
        <PrioritySummary data={dashboard.issues.by_priority} model={dashboard.priority_model} />
      </section>

      <section className="mb-5 grid gap-5 xl:grid-cols-[1.45fr_1fr]">
        <Card>
          <CardHeader className="flex-row items-start justify-between">
            <div><CardTitle>{t("Quality trend")}</CardTitle><CardDescription>{t("Score and open issues across the last five scans")}</CardDescription></div>
            <Badge className="border-slate-200 bg-slate-50 text-slate-600">{t("Last 30 days")}</Badge>
          </CardHeader>
          <CardContent>
            <div className="relative flex h-56 items-end gap-3 border-b border-l border-slate-200 px-4 pb-0 pt-4 md:gap-6">
              <div className="pointer-events-none absolute inset-0 flex flex-col justify-between pb-0 text-slate-300 type-caption"><span className="border-t border-dashed" /><span className="border-t border-dashed" /><span className="border-t border-dashed" /><span /></div>
              {dashboard.trend.map((point, index) => (
                <div key={point.date} className="relative z-10 flex h-full flex-1 flex-col items-center justify-end gap-2">
                  <span className="font-semibold text-slate-700 type-caption">{point.quality_score}</span>
                  <div className="group relative flex w-full max-w-14 items-end justify-center">
                    <div className="w-full rounded-t-md bg-[#c9f060] transition-all group-hover:bg-[#b9df53]" style={{ height: `${(point.quality_score / 100) * 150}px` }} />
                    <div className="absolute bottom-0 w-2 rounded-t bg-[#20332a]" style={{ height: `${(point.issue_count / maxIssue) * 90}px` }} />
                  </div>
                  <span className="absolute -bottom-6 whitespace-nowrap text-muted-foreground type-caption">{point.date}</span>
                  {index === dashboard.trend.length - 1 && <span className="absolute right-0 top-1 rounded bg-[#20332a] px-2 py-1 text-white type-caption">{t("Latest")}</span>}
                </div>
              ))}
            </div>
            <div className="mt-9 flex gap-5 text-muted-foreground type-caption"><span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-[#c9f060]" />{t("Quality score")}</span><span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-[#20332a]" />{t("Open issues")}</span></div>
          </CardContent>
        </Card>
        <AISummaryCard dashboard={dashboard} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.45fr_1fr]">
        <RecentIssues issues={issues} />
        <CategoryBreakdown data={dashboard.issues.by_category} total={dashboard.issues.total} />
      </section>
    </>
  );
}

function QualityCard({ score }: { score: number }) {
  const { t } = useLanguage();
  return <Card><CardHeader><CardDescription>{t("Code quality score")}</CardDescription></CardHeader><CardContent className="flex items-center gap-5"><div className="relative grid size-28 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(#98c93c ${score * 3.6}deg, #e9ede4 0)` }}><div className="grid size-[86px] place-items-center rounded-full bg-white"><div className="text-center"><div className="type-metric">{score}</div><div className="text-muted-foreground type-caption">{t("out of 100")}</div></div></div></div><div><Badge className="mb-3 border-lime-200 bg-lime-50 text-lime-800">{t("Good")}</Badge><p className="type-label">+3.5 points</p><p className="mt-1 text-muted-foreground type-caption">{t("Improved since the previous scan. Keep addressing high-priority findings.")}</p></div></CardContent></Card>;
}

function IssueSummary({ data, total }: { data: Record<string, number>; total: number }) {
  const { t } = useLanguage();
  return <Card><CardHeader><div className="flex items-center justify-between"><CardDescription>{t("Issues by severity")}</CardDescription><span className="type-metric">{total}</span></div></CardHeader><CardContent><div className="mb-5 flex h-2.5 overflow-hidden rounded-full bg-muted">{Object.entries(data).map(([key, value]) => <div key={key} className={cn(key === "Critical" && "bg-red-500", key === "High" && "bg-orange-500", key === "Medium" && "bg-amber-400", key === "Low" && "bg-sky-400")} style={{ width: `${(value / total) * 100}%` }} />)}</div><div className="grid grid-cols-2 gap-3">{Object.entries(data).map(([key, value]) => <div key={key} className="flex items-center justify-between rounded-lg border bg-slate-50/60 px-3 py-2"><span className="flex items-center gap-2 text-muted-foreground type-caption"><span className={cn("size-2 rounded-full", key === "Critical" && "bg-red-500", key === "High" && "bg-orange-500", key === "Medium" && "bg-amber-400", key === "Low" && "bg-sky-400")} />{t(key)}</span><strong className="type-body-sm">{value}</strong></div>)}</div></CardContent></Card>;
}

function PrioritySummary({ data, model }: { data: Record<string, number>; model: Dashboard["priority_model"] }) {
  const { t } = useLanguage();
  return <Card><CardHeader><div className="flex items-center justify-between"><CardDescription>{t("Predicted priority")}</CardDescription><Badge className="border-violet-200 bg-violet-50 text-violet-700"><Sparkles size={11} className="mr-1" />{t("AI model")}</Badge></div></CardHeader><CardContent><div className="space-y-3">{Object.entries(data).map(([key, value]) => <div key={key} className="grid grid-cols-[62px_1fr_24px] items-center gap-2"><span className="text-muted-foreground type-caption">{t(key)}</span><Progress value={value * 10} className="h-1.5 [&>div]:bg-violet-500" /><span className="text-right font-semibold type-caption">{value}</span></div>)}</div><div className="mt-5 flex items-center justify-between border-t pt-3 text-muted-foreground type-caption"><span>{model.version}</span><span>{model.fallback_count} {t("fallback")}</span></div></CardContent></Card>;
}

function AISummaryCard({ dashboard }: { dashboard: Dashboard }) {
  const { t } = useLanguage();
  const ai = dashboard.ai_summary;
  return <Card className="overflow-hidden border-[#dbe9bd] bg-[#f4f8e9]"><CardHeader className="border-b border-[#dbe9bd]"><div className="flex items-center gap-3"><div className="grid size-9 place-items-center rounded-lg bg-[#20332a] text-[#c9f060]"><Bot size={18} /></div><div><CardTitle>{t("AI analysis")}</CardTitle><CardDescription>{t("Grounded in scan")} {dashboard.latest_scan.id}</CardDescription></div><Badge className="ml-auto border-emerald-200 bg-white/60 text-emerald-700"><span className="mr-1.5 size-1.5 rounded-full bg-emerald-500" />{t("Ready")}</Badge></div></CardHeader><CardContent className="pt-5"><p className="text-slate-700 type-body-sm">{ai.summary}</p><div className="mt-4 rounded-xl border border-[#dbe9bd] bg-white/60 p-3.5"><p className="mb-2 flex items-center gap-2 text-slate-700 type-overline"><ShieldCheck size={14} />{t("Top recommendation")}</p><p className="text-slate-900 type-label">{ai.recommended_priorities[0]}</p></div><Button variant="link" className="mt-4 flex items-center gap-1.5 font-semibold text-slate-800 type-caption">{t("Open full AI analysis")} <ArrowRight size={13} /></Button></CardContent></Card>;
}

function RecentIssues({ issues }: { issues: Issue[] }) {
  const { t } = useLanguage();
  return <Card><CardHeader className="flex-row items-center justify-between"><div><CardTitle>{t("Priority issues")}</CardTitle><CardDescription>{t("Findings that need your attention first")}</CardDescription></div><Button variant="ghost" size="sm">{t("View all")} <ArrowRight size={14} /></Button></CardHeader><CardContent><div className="divide-y">{issues.slice(0, 4).map((issue) => <Button variant="ghost" key={issue.id} className="grid h-auto w-full whitespace-normal grid-cols-[1fr_auto] gap-3 py-3.5 text-left first:pt-0 last:pb-0 md:grid-cols-[1fr_90px_90px]"><div className="min-w-0"><p className="truncate text-slate-900 type-label">{issue.title}</p><p className="mt-1 truncate text-muted-foreground type-code">{issue.file}:{issue.line}</p></div><StatusBadge status={issue.severity} className="h-fit justify-self-end">{t(issue.severity)}</StatusBadge><div className="hidden items-center justify-end gap-1.5 text-muted-foreground md:flex type-caption"><span className="size-1.5 rounded-full bg-violet-500" />{t(issue.priority)}</div></Button>)}</div></CardContent></Card>;
}

function CategoryBreakdown({ data, total }: { data: Record<string, number>; total: number }) {
  const { t } = useLanguage();
  const icons = [ShieldCheck, Code2, Settings, Check];
  return <Card><CardHeader><CardTitle>{t("Finding categories")}</CardTitle><CardDescription>{t("Where the current issues are concentrated")}</CardDescription></CardHeader><CardContent className="space-y-4">{Object.entries(data).map(([name, value], index) => { const Icon = icons[index] ?? CircleDot; return <div key={name}><div className="mb-2 flex items-center justify-between type-body-sm"><span className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-md bg-slate-100"><Icon size={14} /></span>{t(name)}</span><strong>{value}</strong></div><Progress value={(value / total) * 100} className="h-1.5 [&>div]:bg-slate-700" /></div>; })}</CardContent></Card>;
}

function DashboardSkeleton() {
  return <div className="animate-pulse"><Skeleton className="mb-8 h-20" /><Skeleton className="mb-5 h-24" /><div className="grid gap-5 md:grid-cols-3">{[1,2,3].map((item) => <Skeleton key={item} className="h-56" />)}</div></div>;
}
