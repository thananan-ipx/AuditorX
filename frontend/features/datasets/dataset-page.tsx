"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Database, Download, FlaskConical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/shared/form-field";
import { PageHeader, FilterBar, StatCard, DataTable, Disclosure } from "@/components/shared/workspace-ui";
import { SelectField } from "@/components/shared/select-field";
import { StatusBadge } from "@/components/shared/status-badge";
import { PagePagination } from "@/components/shared/page-pagination";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Feedback } from "@/components/shared/feedback";
import { apiClient } from "@/lib/api-client";
import { API_URL } from "@/lib/api-url";
import { useLanguage } from "@/lib/i18n";
import { filterSamples, type DatasetSample, type TrainingDataset } from "./types";

const DATASET_ID = "synthetic-priority-v1";
const PAGE_SIZE = 20;

function Priority({ value }: { value: string }) {
  const { t } = useLanguage();
  return <StatusBadge status={value}>{t(value)}</StatusBadge>;
}

export default function DatasetPage() {
  const { t } = useLanguage();
  const [dataset, setDataset] = useState<TrainingDataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState("all");
  const [split, setSplit] = useState("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<DatasetSample | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void apiClient<TrainingDataset>(`/api/v1/datasets/${DATASET_ID}`, { cache: "no-store", signal: controller.signal })
      .then(value => { if (!controller.signal.aborted) { setDataset(value); setLoading(false); } })
      .catch(() => { if (!controller.signal.aborted) { setError("Could not load the training dataset."); setLoading(false); } });
    return () => controller.abort();
  }, [revision]);

  async function download() {
    if (downloading) return;
    setDownloading(true); setDownloadError("");
    try {
      const response = await fetch(`${API_URL}/api/v1/datasets/${DATASET_ID}/download`, { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error("Download failed");
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = "auditorx-synthetic-priority-v1.zip";
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setDownloadError("Could not download the dataset. Try again."); }
    finally { setDownloading(false); }
  }

  const rows = dataset ? filterSamples(dataset.samples, query, priority, split) : [];
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const visible = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const counts = (value: string) => dataset?.samples.filter(row => row.priority_label === value).length ?? 0;

  return <div className="space-y-6">
    <PageHeader title={t("Training datasets")} icon={Database} description={t("Browse labeled examples and export a dataset ready for a training experiment.")} actions={<Button asChild variant="outline"><Link href="/dashboard">{t("Review real scan labels")}</Link></Button>} />
    {loading && <Feedback tone="info">{t("Loading dataset…")}</Feedback>}
    {error && <Feedback tone="error">{t(error)} <Button variant="outline" size="sm" onClick={() => { setError(""); setLoading(true); setRevision(value => value + 1); }}>{t("Try again")}</Button></Feedback>}
    {dataset && <>
      <Card><CardContent className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4"><div className="space-y-2"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline"><FlaskConical className="mr-1 size-3.5" aria-hidden="true" />{t("Synthetic dataset")}</Badge><Badge className="bg-emerald-50 text-emerald-800 border-emerald-200">{t("Ready for a training demo")}</Badge></div><h2 className="text-xl font-semibold">{dataset.title}</h2><p className="type-body-sm text-muted-foreground">{dataset.manifest.rows} {t("labeled examples")} · {dataset.manifest.independent_scenario_families} {t("scenario families")}</p></div>
          <Button disabled={downloading} onClick={() => void download()}><Download className="mr-2 size-4" aria-hidden="true" />{t(downloading ? "Preparing download…" : "Download training dataset ZIP")}</Button></div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 type-body-sm text-amber-950">{t("These examples and labels are simulated using a declared rubric. They are not real scan findings or human-confirmed ground truth. Use them to demonstrate the training pipeline.")}</div>
        <p className="type-caption text-muted-foreground">{t("ZIP includes all examples, train / validation / test CSV files, the manifest and experiment metrics. Filters do not change the export.")}</p>
        {downloadError && <Feedback tone="error">{t(downloadError)}</Feedback>}
      </CardContent></Card>
      <div className="grid grid-cols-3 gap-3">{["High", "Medium", "Low"].map(label => <StatCard key={label} label={<Priority value={label} />} value={counts(label)} />)}</div>
      <Disclosure title={t("Dataset structure and experiment")} description={t("View split sizes, evaluation scores and limitations")}>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>{t("Dataset split")}</CardTitle></CardHeader><CardContent className="space-y-3">{(["train", "validation", "test"] as const).map(name => <div key={name} className="flex items-center justify-between gap-3 rounded-lg border p-3 type-body-sm"><span className="font-medium">{name}</span><span>{dataset.manifest.splits[name].rows} {t("examples")} · {dataset.manifest.splits[name].groups.length} {t("families")}</span></div>)}<p className="type-caption text-muted-foreground">{t("Each scenario family belongs to one split. Context variations are not independent real projects.")}</p></CardContent></Card>
        <Card><CardHeader><CardTitle>{t("Completed demo training")}</CardTitle></CardHeader><CardContent className="space-y-3 type-body-sm"><p>{t("Selected model")}: <strong>{dataset.metrics.selected_model === "logistic_regression" ? "Logistic Regression" : dataset.metrics.selected_model}</strong></p><div className="grid grid-cols-2 gap-3"><div className="rounded-lg border p-4"><p className="type-caption text-muted-foreground">{t("Test Macro-F1")}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{dataset.metrics.test_macro_f1.toFixed(3)}</p></div><div className="rounded-lg border p-4"><p className="type-caption text-muted-foreground">{t("Severity baseline")}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{dataset.metrics.severity_baseline_test_macro_f1.toFixed(3)}</p></div></div><p className="type-caption text-muted-foreground">{t("Scores measure learning the simulated rubric on 18 test examples, not performance on real projects.")}</p></CardContent></Card>
      </div>
      </Disclosure>
      <Card><CardHeader><CardTitle>{t("Labeled examples")}</CardTitle></CardHeader><CardContent className="space-y-4">
        <FilterBar><FormField containerClassName="min-w-0 flex-1 basis-52" label={t("Search examples")} id="dataset-search" type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder={t("Search rule, language or scenario")} />
          <SelectField id="dataset-priority" className="w-full sm:w-44" label={t("Dataset priority")} value={priority} onValueChange={value => { setPriority(value); setPage(1); }} options={["all", "High", "Medium", "Low"].map(value => ({value,label:value === "all" ? t("All priorities") : t(value)}))} />
          <SelectField id="dataset-split" className="w-full sm:w-44" label={t("Dataset split")} value={split} onValueChange={value => { setSplit(value); setPage(1); }} options={["all", "train", "validation", "test"].map(value => ({value,label:t(value === "all" ? "All splits" : value)}))} />
        </FilterBar>
        <p role="status" className="type-caption text-muted-foreground">{rows.length} / {dataset.samples.length} {t("examples")}</p>
        <DataTable caption={t("Labeled examples")}><thead className="bg-muted/50"><tr>{["Scenario", "Language", "Simulated severity", "Dataset priority", "Dataset split", "Details"].map(title => <th key={title} scope="col" className="whitespace-nowrap px-4 py-3 font-medium">{t(title)}</th>)}</tr></thead><tbody>{visible.map(sample => <tr key={sample.sample_id} className="border-t"><td className="max-w-sm px-4 py-3"><p className="font-medium">{sample.rule_family}</p><p className="mt-1 type-caption text-muted-foreground">{sample.repository_group} · {sample.exposure}</p></td><td className="px-4 py-3">{sample.language}</td><td className="px-4 py-3">{sample.severity}</td><td className="px-4 py-3"><Priority value={sample.priority_label} /></td><td className="px-4 py-3">{sample.split}</td><td className="px-4 py-3"><Button variant="outline" size="sm" onClick={() => setSelected(sample)} aria-label={`${t("View example")} ${sample.sample_id}`}>{t("View example")}</Button></td></tr>)}</tbody></DataTable>
        {rows.length === 0 && <p className="py-4 type-body-sm text-muted-foreground">{t("No examples match these filters.")}</p>}
        <PagePagination page={current} pageCount={pages} onPageChange={setPage} />
      </CardContent></Card>
      <Dialog open={selected !== null} onOpenChange={open => { if (!open) setSelected(null); }}><DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{t("Labeled example")}</DialogTitle><DialogDescription>{t("Simulated scenario and label from the teaching rubric.")}</DialogDescription></DialogHeader>{selected && <div className="space-y-4 type-body-sm"><div className="flex gap-2"><Priority value={selected.priority_label} /><Badge variant="outline">{selected.split}</Badge></div><p className="break-all font-medium">{selected.sample_id}</p><p>{selected.scenario}</p><dl className="grid grid-cols-2 gap-3">{[["Simulated severity", selected.severity], ["Repository criticality", selected.repository_criticality], ["Exposure", selected.exposure], ["Impact", selected.impact], ["Rubric score", selected.rubric_score], ["Label source", selected.label_source]].map(([title, value]) => <div key={title} className="rounded-lg border p-3"><dt className="type-caption text-muted-foreground">{t(title)}</dt><dd className="mt-1 break-all font-medium">{value}</dd></div>)}</dl><div className="rounded-lg bg-muted p-4"><p className="mb-1 font-medium">{t("Label reason")}</p><p>{selected.label_reason}</p></div><p className="type-caption text-muted-foreground">{t("High: score 8 or above. Medium: score 5–7. Low: score below 5. These are simulated labels.")}</p></div>}</DialogContent></Dialog>
    </>}
  </div>;
}
