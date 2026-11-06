"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronRight, ListOrdered, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Feedback, LoadingState } from "@/components/shared/feedback";
import { Disclosure, SectionCard, FilterBar, StatCard } from "@/components/shared/workspace-ui";
import { FormField } from "@/components/shared/form-field";
import { SelectField } from "@/components/shared/select-field";
import { StatusBadge } from "@/components/shared/status-badge";
import { PagePagination } from "@/components/shared/page-pagination";
import { useLanguage } from "@/lib/i18n";
import { predictionService, type PredictionRun } from "../service/prediction-service";
import { labelService } from "../service/label-service";
import { prioritizeFindings } from "../prioritized-findings";
import type { Finding, PriorityLabel, Scan } from "../types";

export function PriorityPredictions({ scan, findings, canWrite, onReview }: {
  scan: Scan; findings: Finding[]; canWrite: boolean; onReview: (fingerprint: string) => void;
}) {
  const { t } = useLanguage();
  const [run, setRun] = useState<PredictionRun | null>(null);
  const [labels, setLabels] = useState<PriorityLabel[]>([]);
  const [phase, setPhase] = useState("loading");
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState("all");
  const [scope, setScope] = useState("active");
  const [page, setPage] = useState(1);
  const mutation = useRef<AbortController | null>(null);
  useEffect(() => () => mutation.current?.abort(), []);
  useEffect(() => {
    const request = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function refresh() {
      try {
        const [next, reviews] = await Promise.all([predictionService.latest(scan, request.signal), labelService.list(scan, request.signal)]);
        if (request.signal.aborted) return;
        setRun(next); setLabels(reviews); setPhase("ready"); setError("");
        if (next?.status === "queued" || next?.status === "running") timer = setTimeout(() => void refresh(), 3000);
      } catch {
        if (!request.signal.aborted) { setRun(null); setLabels([]); setPhase("error"); }
      }
    }
    void refresh();
    return () => { request.abort(); if (timer) clearTimeout(timer); };
  }, [scan, revision]);
  async function retry() {
    if (!canWrite || (mutation.current && !mutation.current.signal.aborted)) return;
    const request = new AbortController(); mutation.current = request; setBusy(true); setError("");
    try {
      const next = await predictionService.retry(scan, request.signal);
      if (!request.signal.aborted) { setRun(next); setRevision(value => value + 1); }
    } catch { if (!request.signal.aborted) setError(t("Could not confirm the prediction request. Reload results before retrying.")); }
    finally { if (!request.signal.aborted) { setBusy(false); mutation.current = null; } }
  }
  const result = run?.status === "completed" ? run.result : null;
  const ordered = prioritizeFindings(findings, result, labels);
  const active = ordered.filter(item => !item.excluded);
  const visible = ordered.filter(item => (scope === "all" || !item.excluded)
    && (priority === "all" || (item.priority ?? "pending") === priority)
    && `${item.finding.file} ${item.finding.rule_id} ${item.finding.message}`.toLowerCase().includes(query.trim().toLowerCase()));
  const pages = Math.max(1, Math.ceil(visible.length / 50));
  const current = Math.min(page, pages);
  const pending = run?.status === "queued" || run?.status === "running";
  const context = run?.context ?? scan.prediction_context;
  return <SectionCard title={<span className="flex items-center gap-2"><ListOrdered className="size-5" aria-hidden="true" />{t("What to fix first")}</span>}
    description={t("Priority is suggested automatically after scanning. High comes first, followed by Medium and Low.")}
    action={<><Button variant="ghost" size="sm" onClick={() => setRevision(value => value + 1)}>{t("Reload results")}</Button>{canWrite && <Button variant="outline" size="sm" disabled={busy || pending || phase !== "ready" || !findings.length} onClick={() => void retry()}><RefreshCw className="size-4" />{t(busy ? "Submitting…" : "Recompute suggestions")}</Button>}</>}>
    {phase === "loading" && <LoadingState>{t("Loading saved priorities…")}</LoadingState>}
    {phase === "error" && <Feedback tone="error">{t("Could not load saved priorities and reviews. Reload results to try again.")}</Feedback>}
    {error && <Feedback tone="error">{error}</Feedback>}
    {pending && <LoadingState>{t("The scan is complete. Priority prediction is running in the background; this page refreshes automatically.")}</LoadingState>}
    {run?.status === "failed" && <Feedback tone="warning">{t("Scanning succeeded, but priority prediction is unavailable. Your findings and labels are preserved. Retry prediction when the service is ready.")}</Feedback>}
    {phase === "ready" && !run && findings.length > 0 && <Feedback>{t("No saved prediction exists for this scan yet. An editor can request suggestions.")}</Feedback>}
    {findings.length > 0 && <>
      <Feedback tone="warning">{t("Experimental suggestions from simulated training data. Confirm or correct them after inspecting the code; scanning alone does not retrain the model.")}</Feedback>
      <div className="grid grid-cols-3 gap-3">{(["High", "Medium", "Low"] as const).map(level => <StatCard key={level} label={<StatusBadge status={level}>{t(level)}</StatusBadge>} value={active.filter(item => item.priority === level).length} />)}</div>
      <Disclosure title={t("Prediction context and model")} description={t("The saved context and model version used for this scan")}>
        <dl className="grid gap-4 sm:grid-cols-3 type-body-sm">{[["Repository criticality", context?.repository_criticality ?? "unknown"], ["Exposure", context?.exposure ?? "unknown"], ["Impact", context?.impact ?? "unknown"]].map(([key, value]) => <div key={key}><dt className="type-caption text-muted-foreground">{t(key)}</dt><dd className="mt-1">{t(value)}</dd></div>)}</dl>
        {(!context || Object.values(context).some(value => value === "unknown")) && <p className="mt-3 type-caption text-muted-foreground">{t("Some context is unknown. These suggestions need additional review.")}</p>}
        {result?.model_version && <p className="mt-3 type-caption text-muted-foreground">{t("Experimental model")}: {result.model_version} · {t("Training examples")}: {result.training_rows}</p>}
        <p className="mt-3 type-caption text-muted-foreground">{t("Items with the same priority are ordered by file and line, not by a finer model ranking.")}</p>
      </Disclosure>
      <FilterBar><FormField containerClassName="min-w-0 flex-1 basis-52" label={t("Search findings")} type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder={t("File, rule or message")} />
        <SelectField className="w-full sm:w-44" label={t("Priority")} value={priority} onValueChange={value => { setPriority(value); setPage(1); }} options={["all", "High", "Medium", "Low", "pending"].map(value => ({value,label:t(value === "all" ? "All priorities" : value === "pending" ? "Awaiting suggestion" : value)}))} />
        <SelectField className="w-full sm:w-52" label={t("Review queue")} value={scope} onValueChange={value => { setScope(value); setPage(1); }} options={[{value:"active",label:t("Actionable findings")},{value:"all",label:t("Include excluded findings")}]} />
      </FilterBar>
      <p role="status" className="type-caption text-muted-foreground">{visible.length} {t("of")} {findings.length} {t("findings match")} · {t("Excluded")}: {ordered.length - active.length}</p>
      <ul className="divide-y rounded-xl border">{visible.slice((current - 1) * 50, current * 50).map(({finding, priority, source, excluded}) => <li key={finding.fingerprint} className="flex flex-wrap items-start gap-4 p-4 sm:p-5">
        <div className="min-w-0 flex-1 basis-52"><p className="break-all type-code">{finding.file}:{finding.line}{finding.end_line > finding.line ? `–${finding.end_line}` : ""}</p><p className="mt-2 break-words type-body-sm">{t(finding.message)}</p><p className="mt-1 break-all type-caption text-muted-foreground">{t("Rule")}: {finding.rule_id}</p><div className="mt-2 flex flex-wrap items-center gap-2 type-caption text-muted-foreground"><span>{t("Scanner severity")}</span><StatusBadge status={finding.severity}>{t(finding.severity)}</StatusBadge>{finding.rule_id.startsWith("auditorx.nextjs.review.") && <StatusBadge status="needs_context">{t("Review required")}</StatusBadge>}{excluded && <StatusBadge status="excluded">{t("excluded")}</StatusBadge>}</div></div>
        <div className="space-y-2"><p className="type-caption text-muted-foreground">{t(source === "human" ? "Confirmed priority" : "Suggested priority")}</p>{priority ? <StatusBadge status={priority}>{t(priority)}</StatusBadge> : <span className="block type-caption text-muted-foreground">{t("Awaiting suggestion")}</span>}<Button variant="outline" size="sm" className="flex" onClick={() => onReview(finding.fingerprint)}>{t(canWrite ? "Review priority" : "View review")}<ChevronRight className="size-4" /></Button></div>
      </li>)}</ul>
      {!visible.length && <Feedback>{t("No findings match these filters.")}</Feedback>}
      {pages > 1 && <PagePagination page={current} pageCount={pages} onPageChange={setPage} />}
    </>}
    {!findings.length && <Feedback>{t("No findings matched the configured rules. This does not mean the repository is free of vulnerabilities or that every file was analyzed.")}</Feedback>}
  </SectionCard>;
}
