import assert from "node:assert/strict";
import { test } from "node:test";
import { buildDatasetCSV, DATASET_COLUMNS } from "../features/scans/dataset-export";
import type { Finding, PriorityLabel, Scan } from "../features/scans/types";

const scan = { id: "scan-1", repository_id: "repo-1", status: "completed", source_kind: "local", commit_sha: "digest", rules_version: "baseline-v3", finished_at: "2026-11-02T12:00:00Z" } as Scan;
const finding: Finding = { fingerprint: "fp-1", rule_id: "auditorx.javascript.security.dynamic-eval", severity: "High", file: "app/api/route.ts", line: 4, end_line: 5, message: "ข้อความ, \"quoted\"\nnext line" };

// Small independent CSV reader checks embedded quotes/newlines and column alignment.
function parse(csv: string) {
  const rows: string[][] = []; let row: string[] = [], value = "", quoted = false;
  const input = csv.replace(/^\uFEFF/, "");
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === '"') { if (quoted && input[i + 1] === '"') { value += '"'; i++; } else quoted = !quoted; }
    else if (char === "," && !quoted) { row.push(value); value = ""; }
    else if (char === "\r" && input[i+1] === "\n" && !quoted) { row.push(value); rows.push(row); row = []; value = ""; i++; }
    else value += char;
  }
  return rows;
}

test("dataset export preserves Thai/CSV fields, provenance and blank human labels", () => {
  const csv = buildDatasetCSV(scan, [finding, { ...finding, fingerprint: "fp-2", file: "other.jsx" }]);
  assert.ok(csv.startsWith("\uFEFF"));
  const [header, ...rows] = parse(csv);
  assert.deepEqual(header, DATASET_COLUMNS);
  assert.equal(rows.length, 2);
  const record = Object.fromEntries(header.map((key, i) => [key, rows[0][i]]));
  assert.equal(record.message, finding.message);
  assert.equal(record.source_revision, "digest");
  assert.equal(record.language, "typescript");
  assert.equal(record.rule_family, "security.dynamic-eval");
  assert.equal(record.rule_count_in_scan, "2");
  assert.equal(record.review_status, "unreviewed");
  for (const key of ["repository_group", "priority_label", "label_reason", "reviewer", "repository_criticality", "impact", "exposure"]) assert.equal(record[key], "");
  assert.ok(rows.every(row => row.length === header.length));
});

test("CSV neutralizes spreadsheet formulas and keeps the original finding unchanged", () => {
  for (const message of ["=HYPERLINK(\"bad\")", "+cmd", "-cmd", "@SUM(A1)", "  =cmd", "\tcmd", "\ncmd"]) {
    const item = { ...finding, message };
    const rows = parse(buildDatasetCSV(scan, [item]));
    assert.equal(rows[1][DATASET_COLUMNS.indexOf("message")], "'" + message);
    assert.equal(item.message, message);
  }
});

test("empty completed scans produce headers; unfinished scans cannot be exported", () => {
  assert.equal(parse(buildDatasetCSV(scan, [])).length, 1);
  assert.throws(() => buildDatasetCSV({ ...scan, status: "running" }, [finding]), /completed/);
});

test("dataset export uses saved human labels and server provenance without replacing severity", () => {
  const label: PriorityLabel = { id: 1, scan_id: scan.id, fingerprint: finding.fingerprint,
    repository_group: "crm", review_status: "accepted", priority_label: "Low", repository_criticality: "low",
    exposure: "test_only", impact: "low", label_reason: "Reviewed test-only use", reviewer: "reviewer-1",
    guideline_version: "priority-labels-3class-v1", labeled_at: "2026-11-02T12:00:00Z" };
  const [header, row] = parse(buildDatasetCSV(scan, [finding], [label]));
  const record = Object.fromEntries(header.map((key, i) => [key, row[i]]));
  assert.equal(record.priority_label, "Low"); assert.equal(record.severity, "High");
  assert.equal(record.repository_group, "crm"); assert.equal(record.review_status, "accepted");
  assert.equal(record.reviewer, "reviewer-1"); assert.equal(record.labeled_at, label.labeled_at);
});

test("simulated training export includes only simulated labels and preserves full-scan rule counts", () => {
  const label = { id: 1, scan_id: scan.id, fingerprint: finding.fingerprint, repository_group: "lab", review_status: "simulated", priority_label: "Medium", repository_criticality: "low", exposure: "test_only", impact: "unknown", label_reason: "Authored scenario, not human ground truth", reviewer: "reviewer-1", guideline_version: "priority-labels-3class-v1", labeled_at: "2026-11-05T12:00:00Z" } as PriorityLabel;
  const other = { ...finding, fingerprint: "other" };
  const human = { ...label, fingerprint: "other", review_status: "accepted" } as PriorityLabel;
  const [header, ...rows] = parse(buildDatasetCSV(scan, [finding, other], [label, human], "simulated"));
  assert.equal(rows.length, 1);
  const record = Object.fromEntries(header.map((key, i) => [key, rows[0][i]]));
  assert.equal(record.schema_version, "priority-simulated-dataset-v1");
  assert.equal(record.review_status, "simulated");
  assert.equal(record.priority_label, "Medium");
  assert.equal(record.rule_count_in_scan, "2");
  assert.equal(parse(buildDatasetCSV(scan, [finding], [], "simulated")).length, 1);
});
