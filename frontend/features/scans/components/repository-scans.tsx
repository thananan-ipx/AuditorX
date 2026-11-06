"use client";
import { Typography } from "@/components/ui/typography";
import { StatusBadge } from "@/components/shared/status-badge";
import { PagePagination } from "@/components/shared/page-pagination";
import { Feedback, EmptyState, LoadingState } from "@/components/shared/feedback";
import { FormField } from "@/components/shared/form-field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { PageHeader, SectionCard, Disclosure, FilterBar, StatCard, Crumbs } from "@/components/shared/workspace-ui";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { SelectField } from "@/components/shared/select-field";

import { useEffect, useRef, useState, useSyncExternalStore, type ChangeEvent, type InputHTMLAttributes } from "react";
import { CheckCircle2, Clock3, FolderOpen, GitBranch, ListChecks, LoaderCircle, Play, RefreshCw, ShieldAlert, Square, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceError } from "@/features/repositories/components/workspace-feedback";
import { dashboardHref } from "@/features/repositories/service/repository-service";
import { useLanguage, type Locale } from "@/lib/i18n";
import type { Repository } from "@/features/repositories/types";
import { coverageRules, LANGUAGE_LABELS } from "../rule-catalog";
import { ScanController, type ScanState } from "../service/scan-controller";
import { DatasetLabeling } from "./dataset-labeling";
import { PriorityPredictions } from "./priority-predictions";
import type { PredictionContext } from "../service/prediction-service";
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
    case "SOURCE_UNAVAILABLE": return translate("Source could not be retrieved. Check repository access or that the local folder exists inside /scan-sources. Source size, path or symlink limits may also apply.");
    case "GITHUB_ACCESS_REQUIRED": return translate("Reconnect GitHub from Repositories and check the app's access, then start a new scan.");
    case "INVALID_COMMIT": return translate("The source commit could not be verified. No findings were published.");
    case "INVALID_SOURCE_DIGEST": return translate("The uploaded source could not be verified. No findings were published.");
    case "SCANNER_FAILED": return translate("The scanner could not produce valid results. Ask an administrator to check worker logs and scanner configuration.");
    case "SCAN_TIMEOUT": return translate("The scan exceeded its time limit. No partial findings were published.");
    case "ACCESS_REVOKED": return translate("The requesting user's repository access was revoked before the scan could complete.");
    case "RETRY_EXHAUSTED": return translate("The worker could not finish within the allowed attempts. Check worker availability before starting a new scan.");
    default: return translate("The scan did not complete. No findings were published; ask an administrator to check the worker.");
  }
}

export function RepositoryScans({ repository, initialScanID }: { repository: Repository; initialScanID?: string }) {
  const canWrite = repository.access_level === "owner" || repository.access_level === "editor";
  const [controller] = useState(() => new ScanController(repository.id, repository.branch, canWrite));
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => { controller.start(initialScanID); return controller.stop; }, [controller, initialScanID]);
  return <ScanWorkspace repository={repository} state={state} canWrite={canWrite}
    onStart={(context) => { void controller.enqueue(context); }} onCancel={() => { void controller.cancel(); }}
    onLocal={(path, context) => { void controller.local(path, context); }}
    onUpload={(source) => { void controller.upload(source); }}
    onSelect={controller.select} onRefresh={controller.retry} />;
}

export function ScanWorkspace({ repository, state, canWrite, onStart, onUpload, onLocal, onCancel, onSelect, onRefresh }: {
  repository: Repository; state: ScanState; canWrite: boolean; onLocal?: (path: string, context?: PredictionContext) => void;
  onStart: (context?: PredictionContext) => void; onUpload: (source: FormData) => void; onCancel: () => void; onSelect: (id: string) => void; onRefresh: () => void;
}) {
  const { locale, t } = useLanguage();
  const active = state.jobs.find(isActive);
  const [predictionContext, setPredictionContext] = useState<PredictionContext>({repository_criticality:"unknown",exposure:"unknown",impact:"unknown"});
  const [source, setSource] = useState(onLocal ? "local" : "upload");
  const [showScan, setShowScan] = useState<boolean | null>(null);
  const hasScans = state.jobs.length > 0 || !!state.selected;
  // First scan: setup is shown inline. Later scans open it in a dialog so results stay in view.
  const setupOpen = !active && (showScan ?? (state.phase === "ready" && !state.jobs.length));
  const busy = state.phase !== "ready" || !!state.action || !!active;
  const setup = <>
    <Disclosure title={t("Context for this scan")} description={t("Optional. Unknown values stay unknown; context is saved separately for each scan.")}>
      <div className="grid gap-4 sm:grid-cols-3">{([
        ["repository_criticality","Repository criticality",["unknown","high","normal","low"]],
        ["exposure","Exposure",["unknown","public","authenticated","internal","test_only"]],
        ["impact","Impact",["unknown","high","medium","low"]],
      ] as const).map(([key,label,values]) => <SelectField key={key} label={t(label)} value={predictionContext[key]} disabled={!!state.action || !!active} onValueChange={value => setPredictionContext(previous => ({...previous,[key]:value}))} options={values.map(value => ({value,label:t(value)}))} />)}</div>
    </Disclosure>
    <Tabs value={source} onValueChange={setSource}>
      <TabsList aria-label={t("Scan source")} className="h-auto w-full flex-wrap justify-start gap-1 sm:w-fit">
        {onLocal && <TabsTrigger value="local"><FolderOpen size={15} />{t("Local path")}</TabsTrigger>}
        <TabsTrigger value="upload"><Upload size={15} />{t("Folder or ZIP")}</TabsTrigger>
        <TabsTrigger value="github"><GitBranch size={15} />GitHub</TabsTrigger>
      </TabsList>
      {onLocal && <TabsContent value="local"><LocalPathControls disabled={busy} onScan={path => { setShowScan(false); onLocal(path, predictionContext); }} /></TabsContent>}
      <TabsContent value="upload"><LocalUploadControls disabled={busy} uploading={state.action === "upload"} onUpload={data => { data.set("prediction_context", JSON.stringify(predictionContext)); setShowScan(false); onUpload(data); }} /></TabsContent>
      <TabsContent value="github"><div className="space-y-4 rounded-lg bg-muted/40 p-4"><p className="type-body-sm">{repository.owner}/{repository.name} · {repository.branch}</p><p className="type-caption text-muted-foreground">{t("Scan the selected repository using its connected GitHub access.")}</p><Button disabled={busy} onClick={() => { setShowScan(false); onStart(predictionContext); }}><Play size={15} />{t(state.action === "start" ? "Submitting…" : "Start scan")}</Button></div></TabsContent>
    </Tabs>
    <p className="type-caption text-muted-foreground">{t("Selects checks for the Python, JavaScript, TypeScript and Go files found in each scan. Uploaded code is deleted after processing. This is not a comprehensive security audit.")}</p>
  </>;
  return <div className="space-y-5">
    <PageHeader title={repository.name} icon={GitBranch}
      description={t("Scan a project, review its findings, then prepare training labels.")}
      eyebrow={<Crumbs items={[{ label: t("Repositories"), href: "/repositories" }, { label: `${repository.owner} / ${repository.name}` }]} />}
      actions={<>
        <span className="flex flex-wrap items-center gap-2 type-caption text-muted-foreground"><Badge variant="outline">{repository.branch}</Badge>{canWrite ? t("Write access") : t("Read-only access")}</span>
        <Button variant="outline" disabled={state.phase === "loading" || !!state.action} onClick={onRefresh}><RefreshCw size={14} aria-hidden="true" />{t("Refresh")}</Button>
        {canWrite && <Button disabled={state.phase !== "ready" || !!state.action || !!active} onClick={() => setShowScan(!setupOpen)} aria-expanded={setupOpen} aria-haspopup={hasScans ? "dialog" : undefined} aria-controls="scan-source"><Play size={15} aria-hidden="true" />{t(setupOpen && !hasScans ? "Hide scan setup" : "New scan")}</Button>}
      </>} />
    {canWrite && setupOpen && !hasScans && <SectionCard id="scan-source" title={t("1. Choose a source")} description={t("Choose one way to provide the project you want to scan.")}>{setup}</SectionCard>}
    {canWrite && hasScans && <Dialog open={setupOpen} onOpenChange={setShowScan}>
      <DialogContent id="scan-source" className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{t("1. Choose a source")}</DialogTitle><DialogDescription>{t("Choose one way to provide the project you want to scan.")}</DialogDescription></DialogHeader>
        <div className="min-w-0 space-y-4">{setup}</div>
      </DialogContent>
    </Dialog>}
    {!canWrite && <p className="text-muted-foreground type-body-sm">{t("Only repository owners and editors can start or cancel scans.")}</p>}
    {state.notice && <Feedback>{state.notice}</Feedback>}
    {state.phase === "error" ? <WorkspaceError error={state.error} retry={onRefresh} returnTo={dashboardHref(repository.id)} />
      : <>
        {state.phase === "loading" && <LoadingState>{t("Loading scan history and results…")}</LoadingState>}
        {state.phase === "ready" && state.jobs.length === 0 && !state.selected && <EmptyState icon={Clock3} title={t("No scans yet")}>{canWrite ? t("Start a scan to queue this branch for analysis.") : t("An owner or editor can start the first scan.")} {t("Results appear only after a scan completes.")}</EmptyState>}
        {active && <Feedback>{t("An active scan is {status}. Status refreshes every 3 seconds while work is active. A queued job does not confirm that a worker is online.").replace("{status}", locale === "th" ? t(statusLabels[active.status]) : statusLabels[active.status].toLowerCase())}</Feedback>}
        {hasScans && <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(240px,300px)_minmax(0,1fr)] lg:items-start">
          <ScanHistory jobs={state.jobs} selectedID={state.selected?.id} disabled={!!state.action} onSelect={onSelect} />
          {state.selected ? <div className="min-w-0 space-y-5">
            <ScanDetails scan={state.selected} canCancel={canWrite && isActive(state.selected)} cancelling={state.action === "cancel"} busy={!!state.action} onCancel={onCancel} />
            {state.selected.status === "completed" && state.findings !== null && <ScanResults key={state.selected.id} findings={state.findings} scan={state.selected} canWrite={canWrite} />}
          </div> : <p className="p-5 text-muted-foreground type-body-sm">{t("Loading the selected scan…")}</p>}
        </div>}
      </>}
  </div>;
}

function ScanHistory({ jobs, selectedID, disabled, onSelect }: { jobs: Scan[]; selectedID?: string; disabled: boolean; onSelect: (id: string) => void }) {
  const { locale, t } = useLanguage();
  const format = new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en", { dateStyle: "medium", timeStyle: "short" });
  return <SectionCard title={t("Scan history")} description={t("Latest 20 scans · newest first")} className="lg:sticky lg:top-20">
    <ul id="scan-history" aria-label={t("Scan history")} className="-mx-2 max-h-[28rem] space-y-1 overflow-y-auto px-2">
      {jobs.map((job) => {
        const selected = job.id === selectedID;
        return <li key={job.id}><Button type="button" variant="ghost" disabled={disabled} aria-current={selected ? "true" : undefined} onClick={() => onSelect(job.id)}
          className={cn("h-auto w-full min-w-0 flex-col items-stretch justify-start gap-0 whitespace-normal rounded-lg border px-3 py-2.5 text-left font-normal", selected ? "border-primary bg-primary/5" : "border-transparent")}>
          <span className="flex items-center justify-between gap-2"><span className="truncate type-label font-semibold">{job.source_name ?? job.branch}</span><StatusBadge status={job.status}>{t(statusLabels[job.status])}</StatusBadge></span>
          <span className="mt-1 block truncate type-caption text-muted-foreground">{format.format(new Date(job.created_at))} · <span className="type-code">{job.id.slice(0, 8)}</span></span>
        </Button></li>;
      })}
    </ul>
  </SectionCard>;
}

function LocalPathControls({ disabled, onScan }: { disabled: boolean; onScan: (path: string) => void }) {
  const { t } = useLanguage();
  const [path, setPath] = useState("");
  return <div className="space-y-4">
    <p className="type-body-sm text-muted-foreground">{t("Enter a project name or paste its full Windows path inside the mounted folder. Quoted paths copied from File Explorer are accepted. No browser upload is needed.")}</p>
    <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); if (!disabled && path.trim()) onScan(path.trim()); }}>
      <FormField containerClassName="min-w-0 flex-1" label={t("Local path")} value={path} onChange={event => setPath(event.target.value)} placeholder="auditor-x" maxLength={255} required disabled={disabled} />
      <Button type="submit" disabled={disabled || !path.trim()}><FolderOpen size={15} aria-hidden="true" />{t("Scan local path")}</Button>
      <p className="w-full text-muted-foreground type-caption">{t("Only projects inside the mounted folder are accessible. Use forward slashes for subfolders. Symlinks are rejected; source files are copied to a temporary scan snapshot without changing your project.")}</p>
    </form>
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
      return (supportedExtensions.some((extension) => file.name.toLowerCase().endsWith(extension)) || file.name === "package.json")
        && !directories.some((part) => part.startsWith(".") || part.toLowerCase() === "node_modules" || part.toLowerCase() === "vendor");
    });
    const total = files.reduce((sum, file) => sum + file.size, 0);
    if (files.some(file => file.name === "package.json" && file.size > 64 * 1024)) {
      setError(t("Each package.json must be at most 64 KiB."));
      return;
    }
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

  return <div className="space-y-4">
    <p className="type-body-sm text-muted-foreground">{t("Choose a project folder or ZIP. Supported source files and package.json are uploaded so Next.js can be identified. No package scripts are run, and uploads are deleted after processing.")}</p>
    <div className="flex flex-wrap items-center gap-3">
      <Input ref={folderInput} type="file" multiple className="hidden" onChange={uploadFolder} {...({ webkitdirectory: "", directory: "" } as InputHTMLAttributes<HTMLInputElement>)} />
      <Input ref={zipInput} type="file" accept=".zip,application/zip" className="hidden" onChange={uploadZip} />
      <Button type="button" variant="outline" disabled={disabled} onClick={() => folderInput.current?.click()}><FolderOpen size={15} aria-hidden="true" />{t("Choose folder")}</Button>
      <Button type="button" variant="outline" disabled={disabled} onClick={() => zipInput.current?.click()}><Upload size={15} aria-hidden="true" />{t("Choose ZIP")}</Button>
      {uploading && <span role="status" className="flex items-center gap-2 type-body-sm"><LoaderCircle size={15} className="animate-spin" aria-hidden="true" />{t("Uploading…")}</span>}
      {error && <Feedback tone="error">{error}</Feedback>}
      <p className="w-full text-muted-foreground type-caption">{t("Limits: 20 MiB total, 1 MiB per file, up to 1,000 source files. Dependencies, hidden folders and repository configuration are ignored.")}</p>
    </div>
  </div>;
}

function ScanDetails({ scan, canCancel, cancelling, busy, onCancel }: { scan: Scan; canCancel: boolean; cancelling: boolean; busy: boolean; onCancel: () => void }) {
  const { locale, t } = useLanguage();
  return <Card><CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0 space-y-1"><CardTitle className="break-all">{scan.source_name ?? scan.branch}</CardTitle><CardDescription className="flex flex-wrap items-center gap-2"><span className="type-code">{scan.id.slice(0,8)}</span><span>· {timestamp(scan.created_at, locale, t)}</span></CardDescription></div><StatusBadge status={scan.status}>{t(statusLabels[scan.status])}</StatusBadge></CardHeader>
    <CardContent className="space-y-5">
      <p role="status" className="type-body-sm">{scan.status === "queued" ? t("Waiting for a worker. There is no completion estimate yet.")
        : scan.status === "running" ? t("Source retrieval or analysis is in progress (attempt {attempt}). Findings are published together when the scan completes.").replace("{attempt}", String(scan.attempts))
        : scan.status === "failed" ? failureMessage(scan.error_code, t)
        : scan.status === "cancelled" ? t("This scan was cancelled and cannot publish findings. An already-running analyzer may continue until it stops or times out.")
        : t("Analysis completed. The findings below belong to this scan and its recorded commit.")}</p>
      <Disclosure title={t("Scan details")} description={t("Source, versions and timestamps")}>
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 type-body-sm">
        {[["Source", scan.source_kind !== "github" ? scan.source_name ?? t("Local upload") : scan.branch], [scan.source_kind !== "github" ? "Digest" : "Commit", scan.commit_sha ?? scan.source_digest ?? t("Not recorded")], ["Rules", scan.rules_version], ["Scanner", scan.scanner_version ?? t("Not recorded")], ["Queued", timestamp(scan.created_at, locale, t)], ["Started", timestamp(scan.started_at, locale, t)], ["Finished", timestamp(scan.finished_at, locale, t)]].map(([label, value]) => <div key={label}><dt className="text-muted-foreground type-caption">{t(label)}</dt><dd className="mt-1 break-all type-code">{value}</dd></div>)}
      </dl>
      </Disclosure>
      {canCancel && <Button variant="outline" disabled={busy} onClick={onCancel}><Square size={13} aria-hidden="true" />{cancelling ? t("Cancelling…") : t("Cancel scan")}</Button>}
    </CardContent>
  </Card>;
}

export function filterFindings(findings: Finding[], severity: string, query: string) {
  const needle = query.trim().toLowerCase();
  return findings.filter((finding) => (severity === "All" || finding.severity === severity)
    && `${finding.file} ${finding.rule_id} ${finding.message}`.toLowerCase().includes(needle));
}

export function RuleCoverage({ scan, findings, embedded = false }: { scan: Scan; findings: Finding[]; embedded?: boolean }) {
  const { t } = useLanguage();
  const languages = scan.source_languages;
  const recordedRules = scan.checked_rule_ids;
  const catalog = languages && recordedRules ? coverageRules(scan.rules_version, recordedRules, languages) : [];
  const known = !!languages?.length && !!recordedRules?.length && catalog.length === recordedRules.length;
  const counts = new Map<string, number>();
  for (const finding of findings) counts.set(finding.rule_id, (counts.get(finding.rule_id) ?? 0) + 1);
  const categories = Array.from(new Set(catalog.map((rule) => rule.category)));
  return <Card className={embedded ? "border-0 py-0 shadow-none sm:py-0" : undefined}>
    <CardHeader className={embedded ? "px-0 sm:px-0" : undefined}>{!embedded && <CardTitle className="flex items-center gap-2"><ListChecks size={18} aria-hidden="true" />{t("What this scan checked")}</CardTitle>}
      <CardDescription>{t(known ? "Only rules for languages found in this scan's source are listed. No matches means the rule reported no issue; it does not guarantee that every file was fully analyzed or free of risk." : "This scan did not record its language and rule coverage. Run a new scan to see the checks used for your source languages.")}</CardDescription>
    </CardHeader>
    {known && <CardContent className={embedded ? "space-y-5 px-0 sm:px-0" : "space-y-5"}>
      <div className="flex flex-wrap items-center gap-2 type-body-sm"><span className="text-muted-foreground">{t("Languages in this scan")}:</span>{languages.map(language => <Badge key={language}>{LANGUAGE_LABELS[language]}</Badge>)}<span className="text-muted-foreground">· {catalog.length} {t("checks")}</span></div>
      {catalog.some(rule => rule.framework === "Next.js") && <div className="flex flex-wrap items-center gap-2 type-body-sm"><Badge>Next.js</Badge><span className="text-muted-foreground">{t("Framework checks apply only to packages that declare Next.js.")}</span></div>}
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
                <p className="type-label">{t(rule.title)}</p>
                {rule.review && <Badge className="mt-1">{t("Review required")}</Badge>}
                <p className="mt-1 text-muted-foreground type-body-sm">{t(rule.description)}</p>
                <p className="mt-1 text-muted-foreground type-caption">{rule.languages.filter(language => languages.includes(language)).map(language => LANGUAGE_LABELS[language]).join(", ")}</p>
              </div>
              <Badge className={count === 0 ? "border-lime-200 bg-lime-50 text-lime-800" : "border-orange-200 bg-orange-50 text-orange-800"}>
                {count === 0 ? t("No matches") : `${count} ${count === 1 ? t("match") : t("matches")}`}
              </Badge>
            </li>;
          })}
        </ul>
      </div>)}
    </CardContent>}
  </Card>;
}

function ScanResults({ findings, scan, canWrite }: { findings: Finding[]; scan: Scan; canWrite: boolean }) {
  const { t } = useLanguage();
  const [tab, setTab] = useState("priority");
  const [reviewFingerprint, setReviewFingerprint] = useState<string>();
  return <Tabs value={tab} onValueChange={value => {setReviewFingerprint(undefined);setTab(value);}}>
    <TabsList aria-label={t("Scan results")} className="h-auto max-w-full flex-wrap justify-start"><TabsTrigger value="priority">{t("Fix order")}</TabsTrigger><TabsTrigger value="findings">{t("Findings")}</TabsTrigger><TabsTrigger value="labels">{t("Training labels")}</TabsTrigger></TabsList>
    <TabsContent value="priority"><PriorityPredictions scan={scan} findings={findings} canWrite={canWrite} onReview={fingerprint => {setReviewFingerprint(fingerprint);setTab("labels");}} /></TabsContent>
    <TabsContent value="findings"><Findings findings={findings} scan={scan} /></TabsContent>
    <TabsContent value="labels"><div className="space-y-4"><Button variant="outline" onClick={() => setTab("priority")}>{t("Back to fix order")}</Button><DatasetLabeling scan={scan} findings={findings} canWrite={canWrite} initialFingerprint={reviewFingerprint} /></div></TabsContent>
  </Tabs>;
}

function Findings({ findings, scan }: { findings: Finding[]; scan: Scan }) {
  const { t } = useLanguage();
  const [severity, setSeverity] = useState("All");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const filtered = filterFindings(findings, severity, query);
  const pageSize = 50;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  return <div className="space-y-5">
  <Card><CardHeader><CardTitle>{t("Findings")} <span className="ml-2 text-muted-foreground">{findings.length}</span></CardTitle><CardDescription>{t("Rule matches for the selected scan · up to 1,000 findings")}</CardDescription></CardHeader>
    <CardContent className="space-y-5">
      <div className="grid grid-cols-3 gap-3">{(["High", "Medium", "Low"] as const).map((level) => <StatCard key={level} label={<StatusBadge status={level}>{t(level)}</StatusBadge>} value={findings.filter((finding) => finding.severity === level).length} />)}</div>
      {findings.length === 0 ? <p className="rounded-xl border border-lime-200 bg-lime-50 p-4 type-body-sm">{t("No findings matched the configured rules. This does not mean the repository is free of vulnerabilities or that every file was analyzed.")}</p> : <>
        <FilterBar>
          <FormField containerClassName="min-w-48 flex-1" label={t("Search findings")} type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder={t("File, rule or message")} />
          <SelectField id="finding-severity" className="w-full sm:w-44" label={t("Severity")} value={severity} onValueChange={value => { setSeverity(value); setPage(0); }} options={["All", "High", "Medium", "Low"].map(value => ({value,label:t(value)}))} />
        </FilterBar>
        <p role="status" className="text-muted-foreground type-caption">{filtered.length} {t("of")} {findings.length} {t("findings match")}</p>
        {filtered.length === 0 ? <p className="py-6 text-center text-muted-foreground type-body-sm">{t("No findings match these filters.")}</p> : <ul className="divide-y">{filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize).map((finding) => <li key={finding.fingerprint} className="space-y-2 py-4 first:pt-0">
          <div className="flex items-start justify-between gap-3"><p className="break-words type-label">{t(finding.message)}</p><StatusBadge status={finding.severity}>{t(finding.severity)}</StatusBadge></div>
          {finding.rule_id.startsWith("auditorx.nextjs.review.") && <Badge>{t("Review required")}</Badge>}
          <p className="break-all text-muted-foreground type-code">{finding.file}:{finding.line}{finding.end_line > finding.line ? `–${finding.end_line}` : ""}</p>
          <p className="break-all text-muted-foreground type-caption">{t("Rule")}: {finding.rule_id}</p>
        </li>)}</ul>}
        {pageCount > 1 && <PagePagination page={currentPage + 1} pageCount={pageCount} onPageChange={(next) => setPage(next - 1)} />}
      </>}
    </CardContent>
  </Card>
  <Disclosure title={t("What this scan checked")} description={t("View the rules and coverage for this scan")}><RuleCoverage scan={scan} findings={findings} embedded /></Disclosure>
  </div>;
}
