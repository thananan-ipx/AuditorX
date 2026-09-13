import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ScanWorkspace, failureMessage, filterFindings } from "../features/scans/components/repository-scans";
import type { ScanState } from "../features/scans/service/scan-controller";
import type { Scan, Finding } from "../features/scans/types";
import { ApiError } from "../lib/api-client";

const repository = { id: "repo-1", owner: "owner", name: "project", branch: "main", status: "Connected" };
const scan: Scan = { id: "scan-1", repository_id: repository.id, requested_by: "user-1", branch: "main", status: "completed", attempts: 1, commit_sha: "abc123", rules_version: "baseline-v1", scanner_version: "1.175.0", error_code: null, source_kind: "github", source_name: null, source_digest: null, created_at: "2026-08-28T09:00:00Z", started_at: null, finished_at: null };
const finding: Finding = { fingerprint: "fp1", rule_id: "eval-rule", severity: "High", file: "src/app.py", line: 4, end_line: 8, message: "Avoid eval <script>alert(1)</script>" };
const ready: ScanState = { phase: "ready", jobs: [scan], selected: scan, findings: [finding], action: null, error: null, notice: "" };
function render(state: ScanState, canWrite = true) {
  return renderToStaticMarkup(createElement(ScanWorkspace, { repository, state, canWrite, onStart() {}, onUpload() {}, onCancel() {}, onSelect() {}, onRefresh() {} }));
}

test("real completed results show file, line, rule, version and commit with escaped messages", () => {
  const html = render(ready);
  assert.match(html, /src\/app.py:4–8/);
  assert.match(html, /eval-rule/);
  assert.match(html, /baseline-v1/);
  assert.match(html, /abc123/);
  assert.match(html, /1.175.0/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>|Code quality score|AI analysis|Predicted priority|Simulate scan/);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /Latest 20 scans/);
});

test("owners can choose a local folder or ZIP and uploaded scan metadata is labeled", () => {
  const uploaded = { ...scan, source_kind: "upload" as const, source_name: "project.zip", source_digest: "a".repeat(64), commit_sha: "a".repeat(64) };
  const html = render({ ...ready, jobs: [uploaded], selected: uploaded });
  assert.match(html, /Scan code from this computer/);
  assert.match(html, /Choose folder/);
  assert.match(html, /Choose ZIP/);
  assert.match(html, /Local upload: project.zip/);
  assert.match(html, /Digest/);
});

test("zero completed findings is distinct from no scans and does not imply safety", () => {
  const html = render({ ...ready, findings: [] });
  assert.match(html, /No findings matched the configured rules/);
  assert.match(html, /does not mean the repository is free of vulnerabilities/);
  assert.doesNotMatch(html, /No scans yet/);
  const empty = render({ ...ready, jobs: [], selected: null, findings: null });
  assert.match(empty, /No scans yet/);
  assert.doesNotMatch(empty, /No findings matched/);
});

test("queued scan explains worker uncertainty and allows cancel but not a second scan", () => {
  const queued = { ...scan, status: "queued" as const };
  const html = render({ ...ready, jobs: [queued], selected: queued, findings: null });
  assert.match(html, /does not confirm that a worker is online/);
  assert.match(html, /no completion estimate/);
  assert.match(html, /Cancel scan/);
  assert.match(html, /<button[^>]*disabled=""[^>]*>[\s\S]*?Start scan/);
  assert.doesNotMatch(html, /src\/app.py/);
});

test("viewer sees read-only controls and cannot cancel", () => {
  const running = { ...scan, status: "running" as const };
  const html = render({ ...ready, jobs: [running], selected: running, findings: null }, false);
  assert.match(html, /Read-only access/);
  assert.match(html, /Only repository owners and editors/);
  assert.doesNotMatch(html, />Cancel scan</);
});

test("failed and cancelled scans never render findings or claim zero results", () => {
  for (const status of ["failed", "cancelled"] as const) {
    const selected = { ...scan, status, error_code: "SCAN_TIMEOUT" };
    const html = render({ ...ready, jobs: [selected], selected, findings: null });
    assert.doesNotMatch(html, /No findings matched|src\/app.py|Search findings/);
    assert.match(html, status === "failed" ? /exceeded its time limit/ : /may continue until it stops/);
  }
});

test("permission error hides even stale result props and preserves sign-in return URL", () => {
  const html = render({ ...ready, phase: "error", error: new ApiError("secret", 401) });
  assert.doesNotMatch(html, /src\/app.py|scan-1|secret/);
  assert.match(html, /login\?next=%2Fdashboard%3Frepository%3Drepo-1/);
});

test("finding filters combine severity and case-insensitive file/rule/message search", () => {
  const low = { ...finding, fingerprint: "fp2", severity: "Low" as const, file: "main.go", message: "TLS verification", rule_id: "tls-rule" };
  assert.deepEqual(filterFindings([finding, low], "All", " TLS "), [low]);
  assert.deepEqual(filterFindings([finding, low], "High", "SRC/"), [finding]);
  assert.deepEqual(filterFindings([finding, low], "High", "tls"), []);
  assert.equal(filterFindings([finding, low], "All", "").length, 2);
});

test("findings are paginated to 50 rows and all severity totals remain visible", () => {
  const findings = Array.from({ length: 51 }, (_, i) => ({ ...finding, fingerprint: `fp${i}`, file: `file-${i}.py` }));
  const html = render({ ...ready, findings });
  assert.match(html, /file-49.py/);
  assert.doesNotMatch(html, /file-50.py/);
  assert.match(html, /Page 1 of 2/);
  assert.match(html, /51 of 51 findings match/);
});

test("failure messages are bounded and unknown worker text is not reflected", () => {
  for (const code of ["SOURCE_UNAVAILABLE", "INVALID_COMMIT", "INVALID_SOURCE_DIGEST", "SCANNER_FAILED", "SCAN_TIMEOUT", "ACCESS_REVOKED", "RETRY_EXHAUSTED"]) assert.ok(failureMessage(code).length > 30);
  assert.doesNotMatch(failureMessage("secret SQL credentials"), /secret|SQL|credentials/);
});
