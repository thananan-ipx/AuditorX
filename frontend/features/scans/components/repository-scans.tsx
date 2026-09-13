"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ChangeEvent, type InputHTMLAttributes } from "react";
import { CheckCircle2, Clock3, FolderOpen, GitBranch, ListChecks, LoaderCircle, Play, RefreshCw, ShieldAlert, Square, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceError } from "@/features/repositories/components/workspace-feedback";
import { dashboardHref } from "@/features/repositories/service/repository-service";
import { useLanguage, type Locale } from "@/lib/i18n";
import type { Repository } from "@/features/repositories/types";
import { RULE_CATALOG } from "../rule-catalog";
import { ScanController, type ScanState } from "../service/scan-controller";
import { isActive, type Finding, type Scan, type ScanStatus } from "../types";

const statusStyles: Record<ScanStatus, string> = {
  queued: "border-amber-200 bg-amber-50 text-amber-800",
  running: "border-sky-200 bg-sky-50 text-sky-800",
  completed: "border-lime-200 bg-lime-50 text-lime-800",
  failed: "border-red-200 bg-red-50 text-red-800",
  cancelled: "border-slate-200 bg-slate-50 text-slate-700",
};
const statusLabels: Record<ScanStatus, string> = {
  queued: "Queued", running: "Running", completed: "Completed", failed: "Failed", cancelled: "Cancelled",
};
const severityStyles = {
  High: "border-orange-200 bg-orange-50 text-orange-800",
  Medium: "border-amber-200 bg-amber-50 text-amber-800",
  Low: "border-sky-200 bg-sky-50 text-sky-800",
};

function timestamp(value: string | null, locale: Locale = "en", translate: (value: string) => string = (value) => value) {
  if (!value) return translate("Not recorded");
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? translate("Not recorded") : new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en", { dateStyle: "medium", timeStyle: "medium" }).format(date);
}

export function failureMessage(code: string | null, translate: (message: string) => string = (message) => message) {
  switch (code) {
    case "SOURCE_UNAVAILABLE": return translate("Source could not be retrieved. Check that the GitHub repository and registered branch are public and available; source size or path limits may also apply.");
    case "INVALID_COMMIT": return translate("The source commit could not be verified. No findings were published.");
    case "INVALID_SOURCE_DIGEST": return translate("The uploaded source could not be verified. No findings were published.");
    case "SCANNER_FAILED": return translate("The scanner could not produce valid results. Ask an administrator to check worker logs and scanner configuration.");
    case "SCAN_TIMEOUT": return translate("The scan exceeded its time limit. No partial findings were published.");
    case "ACCESS_REVOKED": return translate("The requesting user's repository access was revoked before the scan could complete.");
    case "RETRY_EXHAUSTED": return translate("The worker could not finish within the allowed attempts. Check worker availability before starting a new scan.");
    default: return translate("The scan did not complete. No findings were published; ask an administrator to check the worker.");
  }
}

export function RepositoryScans({ repository }: { repository: Repository }) {
  const canWrite = repository.access_level === "owner" || repository.access_level === "editor";
  const [controller] = useState(() => new ScanController(repository.id, repository.branch, canWrite));
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => { controller.start(); return controller.stop; }, [controller]);
  return <ScanWorkspace repository={repository} state={state} canWrite={canWrite}
    onStart={() => { void controller.enqueue(); }} onCancel={() => { void controller.cancel(); }}
    onUpload={(source) => { void controller.upload(source); }}
    onSelect={controller.select} onRefresh={controller.retry} />;
}

export function ScanWorkspace({ repository, state, canWrite, onStart, onUpload, onCancel, onSelect, onRefresh }: {
  repository: Repository; state: ScanState; canWrite: boolean;
  onStart: () => void; onUpload: (source: FormData) => void; onCancel: () => void; onSelect: (id: string) => void; onRefresh: () => void;
}) {
  const { locale, t } = useLanguage();
  const active = state.jobs.find(isActive);
  return <div className="space-y-5">
    <section className="flex flex-wrap items-end justify-between gap-4">
      <div><h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t("Repository scans")}</h1>
        <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground"><GitBranch size={15} aria-hidden="true" /><span className="break-all">{repository.branch}</span> · {canWrite ? t("Write access") : t("Read-only access")}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={state.phase === "loading" || !!state.action} onClick={onRefresh}><RefreshCw size={14} aria-hidden="true" />{t("Refresh")}</Button>
        <Button disabled={!canWrite || state.phase !== "ready" || !!state.action || !!active} onClick={onStart} className="bg-[#18251e] text-white hover:bg-[#26392e]">
          {state.action === "start" ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
          {state.action === "start" ? t("Submitting…") : t("Start scan")}
        </Button>
      </div>
    </section>
    <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{t("Scans public GitHub source or a local upload using 14 focused rules for Python, JavaScript, TypeScript and Go. Uploaded code is deleted after processing. This is not a comprehensive security audit.")}</p>
    {canWrite && <LocalUploadControls disabled={state.phase !== "ready" || !!state.action || !!active} uploading={state.action === "upload"} onUpload={onUpload} />}
    {!canWrite && <p className="text-sm text-muted-foreground">{t("Only repository owners and editors can start or cancel scans.")}</p>}
    {state.notice && <p role="status" className="rounded-xl border bg-white p-4 text-sm">{state.notice}</p>}
    {state.phase === "error" ? <WorkspaceError error={state.error} retry={onRefresh} returnTo={dashboardHref(repository.id)} />
      : <>
        {state.phase === "loading" && <p role="status" className="flex items-center gap-2 rounded-xl border bg-white p-5 text-sm"><LoaderCircle className="animate-spin" size={17} aria-hidden="true" />{t("Loading scan history and results…")}</p>}
        {state.phase === "ready" && state.jobs.length === 0 && !state.selected && <Card><CardContent className="space-y-3 py-12 text-center">
          <Clock3 className="mx-auto text-slate-400" size={32} aria-hidden="true" /><h2 className="text-xl font-semibold">{t("No scans yet")}</h2>
          <p className="text-sm text-muted-foreground">{canWrite ? t("Start a scan to queue this branch for analysis.") : t("An owner or editor can start the first scan.")} {t("Results appear only after a scan completes.")}</p>
        </CardContent></Card>}
        {active && <p role="status" className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">{locale === "th" ? `มีการสแกนที่กำลังทำงานในสถานะ ${t(statusLabels[active.status])} ระบบจะรีเฟรชสถานะทุก 3 วินาทีขณะทำงาน และงานที่อยู่ในคิวไม่ได้ยืนยันว่าระบบประมวลผลออนไลน์` : `An active scan is ${statusLabels[active.status].toLowerCase()}. Status refreshes every 3 seconds while work is active. A queued job does not confirm that a worker is online.`}</p>}
        {(state.jobs.length > 0 || state.selected) && <div className="grid items-start gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
          <Card><CardHeader><CardTitle>{t("Scan history")}</CardTitle><CardDescription>{t("Latest 20 scans · newest first")}</CardDescription></CardHeader>
            <CardContent><ul className="max-h-[600px] space-y-2 overflow-y-auto">
              {state.jobs.map((scan) => <li key={scan.id}><button type="button" disabled={!!state.action} aria-pressed={state.selected?.id === scan.id} onClick={() => onSelect(scan.id)}
                className="w-full rounded-xl border p-3 text-left transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700 disabled:opacity-50 aria-pressed:border-lime-500 aria-pressed:bg-lime-50/60">
                <div className="flex items-center justify-between gap-2"><Badge className={statusStyles[scan.status]}>{t(statusLabels[scan.status])}</Badge><span className="font-mono text-xs text-muted-foreground">{scan.id.slice(0, 8)}</span></div>
                <time dateTime={scan.created_at} className="mt-2 block text-xs text-muted-foreground">{timestamp(scan.created_at, locale, t)}</time>
                <span className="mt-1 block break-all text-xs">{scan.source_kind === "upload" ? `${t("Local upload")}: ${scan.source_name}` : scan.branch}</span>
              </button></li>)}
            </ul></CardContent>
          </Card>
          {state.selected ? <div className="min-w-0 space-y-5">
            <ScanDetails scan={state.selected} canCancel={canWrite && isActive(state.selected)} cancelling={state.action === "cancel"} busy={!!state.action} onCancel={onCancel} />
            {state.selected.status === "completed" && state.findings !== null && <Findings key={state.selected.id} findings={state.findings} rulesVersion={state.selected.rules_version} />}
          </div> : <p className="p-5 text-sm text-muted-foreground">{t("Loading the selected scan…")}</p>}
        </div>}
      </>}
  </div>;
}

const supportedExtensions = [".py", ".js", ".jsx", ".ts", ".tsx", ".go"];

function LocalUploadControls({ disabled, uploading, onUpload }: { disabled: boolean; uploading: boolean; onUpload: (source: FormData) => void }) {
  const { t } = useLanguage();
  const zipInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");

  function uploadZip(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".zip") || file.size === 0 || file.size > 20 * 1024 * 1024) {
      setError(t("Choose a non-empty ZIP file up to 20 MiB."));
      return;
    }
    const data = new FormData();
    data.append("archive", file, file.name);
    setError("");
    onUpload(data);
  }

  function uploadFolder(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    const files = selected.filter((file) => {
      const parts = (file.webkitRelativePath || file.name).split("/");
      const directories = parts.slice(1, -1);
      return supportedExtensions.some((extension) => file.name.toLowerCase().endsWith(extension))
        && !directories.some((part) => part.startsWith(".") || part.toLowerCase() === "node_modules" || part.toLowerCase() === "vendor");
    });
    const total = files.reduce((sum, file) => sum + file.size, 0);
    if (files.length === 0 || files.length > 1000 || files.some((file) => file.size > 1024 * 1024) || total > 20 * 1024 * 1024) {
      setError(t("Choose a folder with up to 1,000 supported source files, 1 MiB per file and 20 MiB total."));
      return;
    }
    const data = new FormData();
    for (const file of files) {
      const parts = (file.webkitRelativePath || file.name).split("/");
      const relative = parts.length > 1 ? parts.slice(1).join("/") : parts[0];
      data.append(`file:${relative}`, file, file.name);
    }
    setError("");
    onUpload(data);
  }

  return <Card>
    <CardHeader><CardTitle>{t("Scan code from this computer")}</CardTitle><CardDescription>{t("Choose a project folder or ZIP archive. Only supported source files are uploaded, and the archive is deleted when processing finishes.")}</CardDescription></CardHeader>
    <CardContent className="flex flex-wrap items-center gap-3">
      <input ref={folderInput} type="file" multiple className="sr-only" onChange={uploadFolder} {...({ webkitdirectory: "", directory: "" } as InputHTMLAttributes<HTMLInputElement>)} />
      <input ref={zipInput} type="file" accept=".zip,application/zip" className="sr-only" onChange={uploadZip} />
      <Button type="button" variant="outline" disabled={disabled} onClick={() => folderInput.current?.click()}><FolderOpen size={15} aria-hidden="true" />{t("Choose folder")}</Button>
      <Button type="button" variant="outline" disabled={disabled} onClick={() => zipInput.current?.click()}><Upload size={15} aria-hidden="true" />{t("Choose ZIP")}</Button>
      {uploading && <span role="status" className="flex items-center gap-2 text-sm"><LoaderCircle size={15} className="animate-spin" aria-hidden="true" />{t("Uploading…")}</span>}
      {error && <p role="alert" className="w-full text-sm text-red-700">{error}</p>}
      <p className="w-full text-xs text-muted-foreground">{t("Limits: 20 MiB total, 1 MiB per file, up to 1,000 source files. Dependencies, hidden folders and repository configuration are ignored.")}</p>
    </CardContent>
  </Card>;
}

function ScanDetails({ scan, canCancel, cancelling, busy, onCancel }: { scan: Scan; canCancel: boolean; cancelling: boolean; busy: boolean; onCancel: () => void }) {
  const { locale, t } = useLanguage();
  return <Card><CardHeader className="flex-row items-center justify-between gap-3"><div><CardTitle>{t("Scan details")}</CardTitle><CardDescription className="break-all font-mono">{scan.id}</CardDescription></div><Badge className={statusStyles[scan.status]}>{t(statusLabels[scan.status])}</Badge></CardHeader>
    <CardContent className="space-y-5">
      <p role="status" className="text-sm leading-6">{scan.status === "queued" ? t("Waiting for a worker. There is no completion estimate yet.")
        : scan.status === "running" ? locale === "th" ? `กำลังดึงซอร์สโค้ดหรือวิเคราะห์ (ครั้งที่ ${scan.attempts}) ผลตรวจทั้งหมดจะเผยแพร่พร้อมกันเมื่อการสแกนเสร็จสิ้น` : `Source retrieval or analysis is in progress (attempt ${scan.attempts}). Findings are published together when the scan completes.`
        : scan.status === "failed" ? failureMessage(scan.error_code, t)
        : scan.status === "cancelled" ? t("This scan was cancelled and cannot publish findings. An already-running analyzer may continue until it stops or times out.")
        : t("Analysis completed. The findings below belong to this scan and its recorded commit.")}</p>
      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        {[["Source", scan.source_kind === "upload" ? scan.source_name ?? t("Local upload") : scan.branch], [scan.source_kind === "upload" ? "Digest" : "Commit", scan.commit_sha ?? scan.source_digest ?? t("Not recorded")], ["Rules", scan.rules_version], ["Scanner", scan.scanner_version ?? t("Not recorded")], ["Queued", timestamp(scan.created_at, locale, t)], ["Started", timestamp(scan.started_at, locale, t)], ["Finished", timestamp(scan.finished_at, locale, t)]].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{t(label)}</dt><dd className="mt-1 break-all font-mono text-xs">{value}</dd></div>)}
      </dl>
      {canCancel && <Button variant="outline" disabled={busy} onClick={onCancel}><Square size={13} aria-hidden="true" />{cancelling ? t("Cancelling…") : t("Cancel scan")}</Button>}
    </CardContent>
  </Card>;
}

export function filterFindings(findings: Finding[], severity: string, query: string) {
  const needle = query.trim().toLowerCase();
  return findings.filter((finding) => (severity === "All" || finding.severity === severity)
    && `${finding.file} ${finding.rule_id} ${finding.message}`.toLowerCase().includes(needle));
}

function RuleCoverage({ rulesVersion, findings }: { rulesVersion: string; findings: Finding[] }) {
  const { t } = useLanguage();
  const catalog = RULE_CATALOG[rulesVersion];
  if (!catalog || catalog.length === 0) return null;
  const counts = new Map<string, number>();
  for (const finding of findings) counts.set(finding.rule_id, (counts.get(finding.rule_id) ?? 0) + 1);
  const categories = Array.from(new Set(catalog.map((rule) => rule.category)));
  return <Card>
    <CardHeader><CardTitle className="flex items-center gap-2"><ListChecks size={18} aria-hidden="true" />{t("What this scan checked")}</CardTitle>
      <CardDescription>{t("Every rule below ran against this commit. A checkmark means the rule found nothing, not that the file was free of that whole category of risk.")}</CardDescription>
    </CardHeader>
    <CardContent className="space-y-5">
      {categories.map((category) => <div key={category}>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t(category)}</h3>
        <ul className="space-y-2">
          {catalog.filter((rule) => rule.category === category).map((rule) => {
            const count = counts.get(rule.id) ?? 0;
            return <li key={rule.id} className="flex items-start gap-3 rounded-lg border p-3">
              {count === 0
                ? <CheckCircle2 className="mt-0.5 shrink-0 text-lime-600" size={18} aria-hidden="true" />
                : <ShieldAlert className="mt-0.5 shrink-0 text-orange-600" size={18} aria-hidden="true" />}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{rule.title}</p>
                <p className="text-xs text-muted-foreground">{rule.description}</p>
              </div>
              <Badge className={count === 0 ? "border-lime-200 bg-lime-50 text-lime-800" : "border-orange-200 bg-orange-50 text-orange-800"}>
                {count === 0 ? t("No matches") : `${count} ${count === 1 ? t("match") : t("matches")}`}
              </Badge>
            </li>;
          })}
        </ul>
      </div>)}
    </CardContent>
  </Card>;
}

function Findings({ findings, rulesVersion }: { findings: Finding[]; rulesVersion: string }) {
  const { t } = useLanguage();
  const [severity, setSeverity] = useState("All");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const filtered = filterFindings(findings, severity, query);
  const pageSize = 50;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  return <div className="space-y-5">
  <RuleCoverage rulesVersion={rulesVersion} findings={findings} />
  <Card><CardHeader><CardTitle>{t("Findings")} <span className="ml-2 text-muted-foreground">{findings.length}</span></CardTitle><CardDescription>{t("Rule matches for the selected scan · up to 1,000 findings")}</CardDescription></CardHeader>
    <CardContent className="space-y-5">
      <div className="grid grid-cols-3 gap-3">{(["High", "Medium", "Low"] as const).map((level) => <div key={level} className="rounded-xl border bg-slate-50 p-3"><p className="text-xs text-muted-foreground">{t(level)}</p><p className="mt-1 text-xl font-semibold">{findings.filter((finding) => finding.severity === level).length}</p></div>)}</div>
      {findings.length === 0 ? <p className="rounded-xl border border-lime-200 bg-lime-50 p-4 text-sm leading-6">{t("No findings matched the configured rules. This does not mean the repository is free of vulnerabilities or that every file was analyzed.")}</p> : <>
        <div className="flex flex-wrap gap-3">
          <label className="flex-1 text-xs font-medium">{t("Search findings")}<input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder={t("File, rule or message")} className="mt-1 block w-full min-w-48 rounded-lg border bg-white px-3 py-2 text-sm outline-offset-2" /></label>
          <label className="text-xs font-medium">{t("Severity")}<select value={severity} onChange={(event) => { setSeverity(event.target.value); setPage(0); }} className="mt-1 block rounded-lg border bg-white px-3 py-2 text-sm">{["All", "High", "Medium", "Low"].map((level) => <option key={level} value={level}>{t(level)}</option>)}</select></label>
        </div>
        <p role="status" className="text-xs text-muted-foreground">{filtered.length} {t("of")} {findings.length} {t("findings match")}</p>
        {filtered.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">{t("No findings match these filters.")}</p> : <ul className="divide-y">{filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize).map((finding) => <li key={finding.fingerprint} className="space-y-2 py-4 first:pt-0">
          <div className="flex items-start justify-between gap-3"><p className="break-words text-sm font-medium">{finding.message}</p><Badge className={severityStyles[finding.severity]}>{finding.severity}</Badge></div>
          <p className="break-all font-mono text-xs text-muted-foreground">{finding.file}:{finding.line}{finding.end_line > finding.line ? `–${finding.end_line}` : ""}</p>
          <p className="break-all text-xs text-muted-foreground">{t("Rule")}: {finding.rule_id}</p>
        </li>)}</ul>}
        {pageCount > 1 && <div className="flex items-center justify-between gap-3"><Button variant="outline" size="sm" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>{t("Previous")}</Button><p className="text-xs">{t("Page")} {currentPage + 1} {t("of")} {pageCount}</p><Button variant="outline" size="sm" disabled={currentPage + 1 >= pageCount} onClick={() => setPage(currentPage + 1)}>{t("Next")}</Button></div>}
      </>}
    </CardContent>
  </Card>
  </div>;
}
