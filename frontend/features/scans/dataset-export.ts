import { RULE_CATALOG } from "./rule-catalog";
import type { Finding, PriorityLabel, Scan } from "./types";

export const DATASET_SCHEMA = "priority-dataset-v1";
export const LABEL_GUIDELINE = "priority-labels-3class-v1";
export const DATASET_COLUMNS = [
  "schema_version", "guideline_version", "repository_group", "repository_id", "scan_id",
  "source_kind", "source_revision", "rules_version", "scanner_version", "scan_completed_at",
  "finding_fingerprint", "rule_id", "rule_family", "category", "severity", "language",
  "file_type", "file_path", "start_line", "end_line", "message", "rule_count_in_scan",
  "repository_criticality", "exposure", "impact", "review_status", "priority_label",
  "label_reason", "reviewer", "labeled_at",
] as const;

/** Quoting handles CSV syntax; prefixing prevents spreadsheet formula execution. */
function cell(value: string | number) {
  let text = String(value);
  if (/^[\s\uFEFF]*[=+\-@]/u.test(text) || /^[\t\r\n]/u.test(text)) text = "'" + text;
  return `"${text.replaceAll('"', '""')}"`;
}

function language(file: string) {
  const extension = file.split(".").pop()?.toLowerCase();
  return ({ py: "python", js: "javascript", jsx: "javascript", ts: "typescript", tsx: "typescript", go: "go" } as Record<string, string>)[extension ?? ""] ?? "unknown";
}

/** Exports the complete selected scan, independently of table search/page filters. */
export function buildDatasetCSV(scan: Scan, findings: Finding[], labels: PriorityLabel[] = [], mode: "all" | "simulated" = "all") {
  if (scan.status !== "completed") throw new Error("Only completed scans can be exported.");
  const counts = new Map<string, number>();
  for (const finding of findings) counts.set(finding.rule_id, (counts.get(finding.rule_id) ?? 0) + 1);
  const catalog = RULE_CATALOG[scan.rules_version] ?? [];
  const latest = new Map(labels.map(label => [label.fingerprint, label]));
  const selected = mode === "all" ? findings : findings.filter(finding => {
    const label = latest.get(finding.fingerprint);
    return label?.review_status === "simulated" && label.exposure === "test_only" && !!label.priority_label;
  });
  const rows = selected.map(finding => {
    const label = latest.get(finding.fingerprint);
    const category = catalog.find(rule => rule.id === finding.rule_id)?.category ?? "unknown";
    const family = finding.rule_id.replace(/^auditorx\.(python|javascript|go)\./, "");
    return [mode === "simulated" ? "priority-simulated-dataset-v1" : DATASET_SCHEMA, label?.guideline_version ?? LABEL_GUIDELINE, label?.repository_group ?? "", scan.repository_id, scan.id,
      scan.source_kind, scan.commit_sha ?? scan.source_digest ?? "", scan.rules_version,
      scan.scanner_version ?? "", scan.finished_at ?? "", finding.fingerprint, finding.rule_id,
      family, category, finding.severity, language(finding.file), finding.file.split(".").pop()?.toLowerCase() ?? "",
      finding.file, finding.line, finding.end_line, finding.message, counts.get(finding.rule_id) ?? 0,
      label?.repository_criticality ?? "", label?.exposure ?? "", label?.impact ?? "", label?.review_status ?? "unreviewed",
      label?.priority_label ?? "", label?.label_reason ?? "", label?.reviewer ?? "", label?.labeled_at ?? ""];
  });
  // UTF-8 BOM preserves Thai text when opening directly in Excel.
  return "\uFEFF" + [DATASET_COLUMNS, ...rows].map(row => row.map(cell).join(",")).join("\r\n") + "\r\n";
}

export function downloadDataset(scan: Scan, findings: Finding[], labels: PriorityLabel[] = [], mode: "all" | "simulated" = "all") {
  const url = URL.createObjectURL(new Blob([buildDatasetCSV(scan, findings, labels, mode)], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `auditorx-${mode === "simulated" ? "simulated-training" : "priority"}-${scan.id.replace(/[^a-zA-Z0-9_-]/g, "_")}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Let the browser start the download before revoking its object URL.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
