"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { CheckCheck, ChevronDown, ChevronRight, Download, HelpCircle, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { FormField } from "@/components/shared/form-field";
import { Feedback } from "@/components/shared/feedback";
import { Label } from "@/components/ui/label";
import { PagePagination } from "@/components/shared/page-pagination";
import { StatusBadge } from "@/components/shared/status-badge";
import { FilterBar, StatCard, FormSection } from "@/components/shared/workspace-ui";
import { SelectField } from "@/components/shared/select-field";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useLanguage } from "@/lib/i18n";
import { downloadDataset } from "../dataset-export";
import { labelReadiness } from "../label-readiness";
import { labelService } from "../service/label-service";
import type { Finding, LabelInput, PriorityLabel, Scan } from "../types";

export function DatasetLabeling({ scan, findings, canWrite }: { scan: Scan; findings: Finding[]; canWrite: boolean }) {
  const { t } = useLanguage();
  const [labels, setLabels] = useState<PriorityLabel[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [reload, setReload] = useState(0);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [notice, setNotice] = useState("");
  const [guide, setGuide] = useState(false);
  const alive = useRef(false);
  useEffect(() => {
    alive.current = true;
    const request = new AbortController();
    labelService.list(scan, request.signal).then(data => { if (!request.signal.aborted) { setLabels(data); setPhase("ready"); } }).catch(() => { if (!request.signal.aborted) setPhase("error"); });
    return () => { alive.current = false; request.abort(); };
  }, [scan, reload]);
  const byFinding = new Map(labels.map(label => [label.fingerprint, label]));
  const readiness = labelReadiness(labels);
  const reviewed = labels.filter(label => label.review_status !== "unreviewed").length;
  const visible = findings.filter(item => {
    const status = byFinding.get(item.fingerprint)?.review_status ?? "unreviewed";
    return (filter === "all" || filter === status) && `${item.file} ${item.rule_id} ${item.message}`.toLowerCase().includes(query.trim().toLowerCase());
  });
  const pageCount = Math.max(1, Math.ceil(visible.length / 20));
  const currentPage = Math.min(page, pageCount);
  const finding = findings.find(item => item.fingerprint === selected);
  const current = selected ? byFinding.get(selected) : undefined;
  function close() { setSelected(null); setDirty(false); setDiscard(false); }
  function requestClose() { if (!saving) { if (dirty) setDiscard(true); else close(); } }
  function open(fingerprint: string) { setSelected(fingerprint); setDirty(false); setDiscard(false); }
  function refresh() { setPhase("loading"); setReload(value => value + 1); }
  return <Card>
    <CardHeader className="gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1"><CardTitle>{t("Training labels")}</CardTitle><CardDescription>{t("Review one finding at a time. Your labels are saved to the database.")}</CardDescription></div>
        <div className="flex flex-wrap gap-2"><Button variant="ghost" size="sm" onClick={() => setGuide(true)}><HelpCircle size={16} />{t("Labeling guide")}</Button><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" disabled={phase !== "ready" || !findings.length}><Download size={16} />{t("Export labels")}<ChevronDown size={14} /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="max-w-[calc(100vw-2rem)]"><DropdownMenuItem disabled={!readiness.simulated} onSelect={() => downloadDataset(scan, findings, labels, "simulated")}>{t("Export simulated training CSV")}</DropdownMenuItem><DropdownMenuItem onSelect={() => downloadDataset(scan, findings, labels)}>{t("Export dataset CSV")}</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>
      </div>
      {phase === "ready" && <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label={t("Reviewed findings")} value={<>{reviewed}<span className="ml-1 text-muted-foreground type-body-sm">/ {findings.length}</span></>} hint={<Progress value={reviewed} max={Math.max(1, findings.length)} aria-label={t("Reviewed findings")} />} icon={ListChecks} />
        <StatCard label={t("Ready for training")} value={readiness.ready} hint={<>{t("Human-confirmed")}: {readiness.human} · {t("Simulated labels")}: {readiness.simulated}</>} icon={CheckCheck} className="border-success/25 bg-success/5" />
        <StatCard label={t("Not reviewed yet")} value={findings.length - reviewed} hint={t("Review each finding before exporting training data.")} />
      </div>}
    </CardHeader>
    <CardContent className="space-y-4">
      {notice && <Feedback>{notice}</Feedback>}
      {phase === "ready" && readiness.simulated > 0 && <Feedback>{t("Simulated labels are ready for demo training and are exported separately from human-confirmed labels.")}</Feedback>}
      {phase === "loading" && <p role="status" className="text-muted-foreground type-body-sm">{t("Loading saved labels…")}</p>}
      {phase === "error" && <Feedback tone="error">{t("Could not load saved labels.")} <Button variant="outline" onClick={refresh}>{t("Refresh labels")}</Button></Feedback>}
      {phase === "ready" && <>
        <FilterBar>
          <FormField containerClassName="min-w-0 flex-1 basis-52" label={t("Search review queue")} type="search" placeholder={t("File, rule or message")} value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} />
          <SelectField id="review-filter" className="w-full sm:w-56" label={t("Review status")} value={filter} onValueChange={value => { setFilter(value); setPage(1); }} options={["all", "unreviewed", "accepted", "simulated", "needs_context", "excluded"].map(value => ({value,label:t(value === "all" ? "All reviews" : value)}))} />
          <Button variant="outline" onClick={refresh}>{t("Refresh labels")}</Button>
        </FilterBar>
        {!canWrite && <p className="text-muted-foreground type-body-sm">{t("Only repository owners and editors can save labels.")}</p>}
        <p role="status" className="text-muted-foreground type-caption">{visible.length} {t("of")} {findings.length} {t("findings")}</p>
        {!visible.length ? <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground type-body-sm">{t("No findings in this review queue.")}</p> : <ul className="divide-y rounded-xl border">
          {visible.slice((currentPage - 1) * 20, currentPage * 20).map(item => {
            const label = byFinding.get(item.fingerprint);
            return <li key={item.fingerprint} className="flex flex-wrap items-start gap-3 p-4 transition-colors hover:bg-muted/30 sm:p-5">
              <div className="min-w-0 flex-1 basis-48"><p className="break-all type-code font-medium">{item.file}:{item.line}</p><p className="mt-2 line-clamp-2 break-words text-muted-foreground type-body-sm">{t(item.message)}</p><div className="mt-3 flex flex-wrap gap-2"><StatusBadge status={label?.review_status ?? "unreviewed"}>{t(label?.review_status ?? "unreviewed")}</StatusBadge>{label?.priority_label && <StatusBadge status={label.priority_label}>{t("Priority")}: {t(label.priority_label)}</StatusBadge>}</div></div>
              <Button variant="outline" onClick={() => open(item.fingerprint)}>{t(canWrite ? label ? "Edit review" : "Review finding" : "View review")}<ChevronRight size={15} /></Button>
            </li>;
          })}
        </ul>}
        {pageCount > 1 && <PagePagination page={currentPage} pageCount={pageCount} onPageChange={setPage} />}
      </>}
    </CardContent>
    <Dialog open={!!finding} onOpenChange={value => { if (!value) requestClose(); }}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl" showCloseButton={!saving}>
        <DialogHeader className="shrink-0 border-b px-6 py-5 pr-12"><DialogTitle>{t(canWrite ? "Review finding" : "View review")}</DialogTitle><DialogDescription className="break-all">{finding?.file}:{finding?.line}</DialogDescription></DialogHeader>
        {finding && <ReviewForm key={`${finding.fingerprint}-${current?.id ?? "new"}`} finding={finding} current={current} defaultGroup={labels[0]?.repository_group ?? ""} canWrite={canWrite} discard={discard} onKeep={() => setDiscard(false)} onClose={close} onRequestClose={requestClose} onDirty={() => setDirty(true)} onBusy={setSaving} onSave={async (input, next) => {
          const saved = await labelService.save(scan, finding.fingerprint, input);
          if (!alive.current) return;
          setLabels(previous => [...previous.filter(label => label.fingerprint !== saved.fingerprint), saved]);
          setDirty(false); setDiscard(false); setNotice(t("Label saved to the database."));
          const nextFinding = next ? findings.find(item => item.fingerprint !== finding.fingerprint && (!byFinding.has(item.fingerprint) || byFinding.get(item.fingerprint)?.review_status === "unreviewed")) : undefined;
          if (nextFinding) open(nextFinding.fingerprint); else close();
        }} />}
      </DialogContent>
    </Dialog>
    <Dialog open={guide} onOpenChange={setGuide}><DialogContent className="max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>{t("Labeling guide")}</DialogTitle><DialogDescription>{t("Priority describes what to work on first, not scanner severity.")}</DialogDescription></DialogHeader><ol className="list-decimal space-y-4 pl-5 type-body-sm"><li>{t("Use the same group for all scans of the same project.")}</li><li>{t("Inspect the code and record repository_criticality, exposure and impact. Mark accepted, excluded or needs_context in review_status.")}</li><li>{t("High: urgent material risk. Medium: actionable risk with limited impact or exposure. Low: minor improvement or non-urgent manual review. Use context, not severity alone.")}</li><li>{t("Accepted labels are human-reviewed. Simulated labels are for experiments only. Excluded and needs_context are not training examples.")}</li></ol></DialogContent></Dialog>
  </Card>;
}

function ReviewForm({ finding, current, defaultGroup, canWrite, discard, onKeep, onClose, onRequestClose, onDirty, onBusy, onSave }: {
  finding: Finding; current?: PriorityLabel; defaultGroup: string; canWrite: boolean; discard: boolean;
  onKeep: () => void; onClose: () => void; onRequestClose: () => void; onDirty: () => void; onBusy: (busy: boolean) => void;
  onSave: (input: LabelInput, next: boolean) => Promise<void>;
}) {
  const { t, locale } = useLanguage();
  const [value, setValue] = useState<LabelInput>(() => current ?? { repository_group: defaultGroup, review_status: "needs_context", priority_label: "", repository_criticality: "unknown", exposure: "unknown", impact: "unknown", label_reason: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const locked = useRef(false);
  function update<K extends keyof LabelInput>(key: K, content: LabelInput[K]) { setValue(previous => ({ ...previous, [key]: content, ...(key === "review_status" && content === "simulated" ? { exposure: "test_only" as const } : {}) })); onDirty(); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (locked.current || !canWrite) return;
    locked.current = true; setBusy(true); onBusy(true); setError("");
    const next = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("name") === "next";
    const input: LabelInput = { repository_group: value.repository_group, review_status: value.review_status, priority_label: ["accepted", "simulated"].includes(value.review_status) ? value.priority_label : "", repository_criticality: value.repository_criticality, exposure: value.exposure, impact: value.impact, label_reason: value.label_reason };
    try { await onSave(input, next); } catch { setError(t("Could not confirm the saved label. Reload labels before trying again.")); }
    finally { locked.current = false; setBusy(false); onBusy(false); }
  }
  function select<K extends keyof LabelInput>(key: K, title: string, options: string[]) {
    return <SelectField id={`label-${key}`} label={t(title)} placeholder={t("Select priority")} disabled={busy || !canWrite} value={value[key]} onValueChange={content => update(key, content as LabelInput[K])} options={options.map(option => ({value:option,label:t(option)}))} />;
  }
  return <form onSubmit={event => { void submit(event); }} className="flex min-h-0 flex-col overflow-hidden">
    <div className="min-h-0 space-y-6 overflow-y-auto p-6">
      <div className="space-y-2 rounded-lg bg-muted/40 p-4"><div className="flex items-center gap-2"><span className="text-muted-foreground type-caption">{t("Scanner severity")}</span><StatusBadge status={finding.severity}>{t(finding.severity)}</StatusBadge></div><p className="break-words type-body-sm">{t(finding.message)}</p><p className="break-all text-muted-foreground type-code">{finding.rule_id}</p></div>
      <FormSection disabled={busy || !canWrite} title={t("1. Project context")}>
        <FormField label={t("Project group")} value={value.repository_group} onChange={event => update("repository_group", event.target.value)} placeholder="crm-front" required maxLength={100} description={t("Use the same group for all scans of the same project.")} />
        <div className="grid gap-4 sm:grid-cols-3">{select("repository_criticality", "Repository criticality", ["unknown", "high", "normal", "low"])}{select("exposure", "Exposure", ["unknown", "public", "authenticated", "internal", "test_only"])}{select("impact", "Impact", ["unknown", "high", "medium", "low"])}</div>
      </FormSection>
      <FormSection disabled={busy || !canWrite} title={t("2. Review decision")}><div className="grid gap-4 sm:grid-cols-2">{select("review_status", "Review status", ["needs_context", "accepted", "simulated", "excluded", "unreviewed"])}{["accepted", "simulated"].includes(value.review_status) && select("priority_label", value.review_status === "simulated" ? "Simulated priority label" : "Priority label", ["High", "Medium", "Low"])}</div><p className="text-muted-foreground type-caption">{t("Accepted labels are human-reviewed. Simulated labels are for experiments only. Excluded and needs_context are not training examples.")}</p></FormSection>
      <div className="space-y-2"><Label htmlFor="label-reason">{t("3. Reason for this decision")}</Label><Textarea id="label-reason" required maxLength={2000} disabled={busy || !canWrite} value={value.label_reason} placeholder={t("Explain the impact, who can reach this code, and why this priority is appropriate.")} onChange={event => update("label_reason", event.target.value)} /></div>
      {current && <p className="text-muted-foreground type-caption">{t("Last saved")}: {new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en", {dateStyle:"medium",timeStyle:"short"}).format(new Date(current.labeled_at))}</p>}
      {error && <Feedback tone="error">{error}</Feedback>}
    </div>
    <div className="shrink-0 space-y-3 border-t bg-background px-6 py-4">
      {discard && <Feedback><p>{t("You have unsaved changes. Discard them?")}</p><div className="mt-2 flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={onKeep}>{t("Keep editing")}</Button><Button type="button" variant="destructive" onClick={onClose}>{t("Discard changes")}</Button></div></Feedback>}
    <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={onRequestClose}>{t("Close")}</Button>{canWrite && <><Button type="submit" disabled={busy || (["accepted", "simulated"].includes(value.review_status) && !value.priority_label)}>{t(busy ? "Saving…" : "Save label")}</Button><Button type="submit" name="next" variant="secondary" disabled={busy || (["accepted", "simulated"].includes(value.review_status) && !value.priority_label)}>{t("Save and next")}<ChevronRight size={15} /></Button></>}</div></div>
  </form>;
}
