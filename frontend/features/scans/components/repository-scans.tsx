"use client";
import { Typography } from "@/components/ui/typography";
import { StatusBadge } from "@/components/shared/status-badge";
import { PagePagination } from "@/components/shared/page-pagination";
import { Feedback, EmptyState, LoadingState } from "@/components/shared/feedback";
import { FormField } from "@/components/shared/form-field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

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

const statusLabels: Record<ScanStatus, string> = {
  queued: "Queued", running: "Running", completed: "Completed", failed: "Failed", cancelled: "Cancelled",
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
      <div><Typography variant="page-title" as="h1">{t("Repository scans")}</Typography>
        <p className="mt-2 flex items-center gap-2 text-muted-foreground type-body-sm"><GitBranch size={15} aria-hidden="true" /><span className="break-all">{repository.branch}</span> · {canWrite ? t("Write access") : t("Read-only access")}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={state.phase === "loading" || !!state.action} onClick={onRefresh}><RefreshCw size={14} aria-hidden="true" />{t("Refresh")}</Button>
        <Button disabled={!canWrite || state.phase !== "ready" || !!state.action || !!active} onClick={onStart}>
          {state.action === "start" ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
          {state.action === "start" ? t("Submitting…") : t("Start scan")}
        </Button>
      </div>
    </section>
    <p className="max-w-3xl text-muted-foreground type-body-sm">{t("Scans public GitHub source or a local upload using 14 focused rules for Python, JavaScript, TypeScript and Go. Uploaded code is deleted after processing. This is not a comprehensive security audit.")}</p>
    {canWrite && <LocalUploadControls disabled={state.phase !== "ready" || !!state.action || !!active} uploading={state.action === "upload"} onUpload={onUpload} />}
    {!canWrite && <p className="text-muted-foreground type-body-sm">{t("Only repository owners and editors can start or cancel scans.")}</p>}
    {state.notice && <Feedback>{state.notice}</Feedback>}
    {state.phase === "error" ? <WorkspaceError error={state.error} retry={onRefresh} returnTo={dashboardHref(repository.id)} />
      : <>
        {state.phase === "loading" && <LoadingState>{t("Loading scan history and results…")}</LoadingState>}
        {state.phase === "ready" && state.jobs.length === 0 && !state.selected && <EmptyState icon={Clock3} title={t("No scans yet")}>{canWrite ? t("Start a scan to queue this branch for analysis.") : t("An owner or editor can start the first scan.")} {t("Results appear only after a scan completes.")}</EmptyState>}
        {active && <Feedback>{locale === "th" ? `มีการสแกนที่กำลังทำงานในสถานะ ${t(statusLabels[active.status])} ระบบจะรีเฟรชสถานะทุก 3 วินาทีขณะทำงาน และงานที่อยู่ในคิวไม่ได้ยืนยันว่าระบบประมวลผลออนไลน์` : `An active scan is ${statusLabels[active.status].toLowerCase()}. Status refreshes every 3 seconds while work is active. A queued job does not confirm that a worker is online.`}</Feedback>}
        {(state.jobs.length > 0 || state.selected) && <div className="grid items-start gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
          <Card><CardHeader><CardTitle>{t("Scan history")}</CardTitle><CardDescription>{t("Latest 20 scans · newest first")}</CardDescription></CardHeader>
            <CardContent><ul className="max-h-[600px] space-y-2 overflow-y-auto">
              {state.jobs.map((scan) => <li key={scan.id}><Button variant="outline" type="button" disabled={!!state.action} aria-pressed={state.selected?.id === scan.id} onClick={() => onSelect(scan.id)}
                className="h-auto w-full flex-col items-stretch whitespace-normal p-3 text-left aria-pressed:border-success aria-pressed:bg-success/10">
                <div className="flex items-center justify-between gap-2"><StatusBadge status={scan.status}>{t(statusLabels[scan.status])}</StatusBadge><span className="text-muted-foreground type-code">{scan.id.slice(0, 8)}</span></div>
                <time dateTime={scan.created_at} className="mt-2 block text-muted-foreground type-caption">{timestamp(scan.created_at, locale, t)}</time>
                <span className="mt-1 block break-all type-caption">{scan.source_kind === "upload" ? `${t("Local upload")}: ${scan.source_name}` : scan.branch}</span>
              </Button></li>)}
            </ul></CardContent>
          </Card>
          {state.selected ? <div className="min-w-0 space-y-5">
            <ScanDetails scan={state.selected} canCancel={canWrite && isActive(state.selected)} cancelling={state.action === "cancel"} busy={!!state.action} onCancel={onCancel} />
            {state.selected.status === "completed" && state.findings !== null && <Findings key={state.selected.id} findings={state.findings} rulesVersion={state.selected.rules_version} />}
          </div> : <p className="p-5 text-muted-foreground type-body-sm">{t("Loading the selected scan…")}</p>}
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
      <Input ref={folderInput} type="file" multiple className="sr-only" onChange={uploadFolder} {...({ webkitdirectory: "", directory: "" } as InputHTMLAttributes<HTMLInputElement>)} />
      <Input ref={zipInput} type="file" accept=".zip,application/zip" className="sr-only" onChange={uploadZip} />
      <Button type="button" variant="outline" disabled={disabled} onClick={() => folderInput.current?.click()}><FolderOpen size={15} aria-hidden="true" />{t("Choose folder")}</Button>
      <Button type="button" variant="outline" disabled={disabled} onClick={() => zipInput.current?.click()}><Upload size={15} aria-hidden="true" />{t("Choose ZIP")}</Button>
      {uploading && <span role="status" className="flex items-center gap-2 type-body-sm"><LoaderCircle size={15} className="animate-spin" aria-hidden="true" />{t("Uploading…")}</span>}
      {error && <Feedback tone="error">{error}</Feedback>}
      <p className="w-full text-muted-foreground type-caption">{t("Limits: 20 MiB total, 1 MiB per file, up to 1,000 source files. Dependencies, hidden folders and repository configuration are ignored.")}</p>
    </CardContent>
  </Card>;
}

function ScanDetails({ scan, canCancel, cancelling, busy, onCancel }: { scan: Scan; canCancel: boolean; cancelling: boolean; busy: boolean; onCancel: () => void }) {
  const { locale, t } = useLanguage();
  return <Card><CardHeader className="flex-row items-center justify-between gap-3"><div><CardTitle>{t("Scan details")}</CardTitle><CardDescription className="break-all type-code">{scan.id}</CardDescription></div><StatusBadge status={scan.status}>{t(statusLabels[scan.status])}</StatusBadge></CardHeader>
    <CardContent className="space-y-5">
      <p role="status" className="type-body-sm">{scan.status === "queued" ? t("Waiting for a worker. There is no completion estimate yet.")
        : scan.status === "running" ? locale === "th" ? `กำลังดึงซอร์สโค้ดหรือวิเคราะห์ (ครั้งที่ ${scan.attempts}) ผลตรวจทั้งหมดจะเผยแพร่พร้อมกันเมื่อการสแกนเสร็จสิ้น` : `Source retrieval or analysis is in progress (attempt ${scan.attempts}). Findings are published together when the scan completes.`
        : scan.status === "failed" ? failureMessage(scan.error_code, t)
        : scan.status === "cancelled" ? t("This scan was cancelled and cannot publish findings. An already-running analyzer may continue until it stops or times out.")
        : t("Analysis completed. The findings below belong to this scan and its recorded commit.")}</p>
      <dl className="grid gap-4 sm:grid-cols-2 type-body-sm">
        {[["Source", scan.source_kind === "upload" ? scan.source_name ?? t("Local upload") : scan.branch], [scan.source_kind === "upload" ? "Digest" : "Commit", scan.commit_sha ?? scan.source_digest ?? t("Not recorded")], ["Rules", scan.rules_version], ["Scanner", scan.scanner_version ?? t("Not recorded")], ["Queued", timestamp(scan.created_at, locale, t)], ["Started", timestamp(scan.started_at, locale, t)], ["Finished", timestamp(scan.finished_at, locale, t)]].map(([label, value]) => <div key={label}><dt className="text-muted-foreground type-caption">{t(label)}</dt><dd className="mt-1 break-all type-code">{value}</dd></div>)}
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
        <Typography variant="overline" as="h3" className="mb-2 text-muted-foreground">{t(category)}</Typography>
        <ul className="space-y-2">
          {catalog.filter((rule) => rule.category === category).map((rule) => {
            const count = counts.get(rule.id) ?? 0;
            return <li key={rule.id} className="flex items-start gap-3 rounded-lg border p-3">
              {count === 0
                ? <CheckCircle2 className="mt-0.5 shrink-0 text-lime-600" size={18} aria-hidden="true" />
                : <ShieldAlert className="mt-0.5 shrink-0 text-orange-600" size={18} aria-hidden="true" />}
              <div className="min-w-0 flex-1">
                <p className="type-label">{rule.title}</p>
                <p className="text-muted-foreground type-caption">{rule.description}</p>
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
      <div className="grid grid-cols-3 gap-3">{(["High", "Medium", "Low"] as const).map((level) => <div key={level} className="rounded-xl border bg-slate-50 p-3"><p className="text-muted-foreground type-caption">{t(level)}</p><p className="mt-1 type-metric-sm">{findings.filter((finding) => finding.severity === level).length}</p></div>)}</div>
      {findings.length === 0 ? <p className="rounded-xl border border-lime-200 bg-lime-50 p-4 type-body-sm">{t("No findings matched the configured rules. This does not mean the repository is free of vulnerabilities or that every file was analyzed.")}</p> : <>
        <div className="flex flex-wrap gap-3">
          <FormField containerClassName="min-w-48 flex-1" label={t("Search findings")} type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder={t("File, rule or message")} />
          <div className="space-y-2"><Label htmlFor="finding-severity">{t("Severity")}</Label><NativeSelect id="finding-severity" value={severity} onChange={(event) => { setSeverity(event.target.value); setPage(0); }}>{["All", "High", "Medium", "Low"].map((level) => <NativeSelectOption key={level} value={level}>{t(level)}</NativeSelectOption>)}</NativeSelect></div>
        </div>
        <p role="status" className="text-muted-foreground type-caption">{filtered.length} {t("of")} {findings.length} {t("findings match")}</p>
        {filtered.length === 0 ? <p className="py-6 text-center text-muted-foreground type-body-sm">{t("No findings match these filters.")}</p> : <ul className="divide-y">{filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize).map((finding) => <li key={finding.fingerprint} className="space-y-2 py-4 first:pt-0">
          <div className="flex items-start justify-between gap-3"><p className="break-words type-label">{finding.message}</p><StatusBadge status={finding.severity}>{t(finding.severity)}</StatusBadge></div>
          <p className="break-all text-muted-foreground type-code">{finding.file}:{finding.line}{finding.end_line > finding.line ? `–${finding.end_line}` : ""}</p>
          <p className="break-all text-muted-foreground type-caption">{t("Rule")}: {finding.rule_id}</p>
        </li>)}</ul>}
        {pageCount > 1 && <PagePagination page={currentPage + 1} pageCount={pageCount} onPageChange={(next) => setPage(next - 1)} />}
      </>}
    </CardContent>
  </Card>
  </div>;
}
