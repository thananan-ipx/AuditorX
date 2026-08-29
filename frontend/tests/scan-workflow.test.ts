import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError } from "../lib/api-client";
import { ScanController } from "../features/scans/service/scan-controller";
import { scanService } from "../features/scans/service/scan-service";
import type { Finding, Scan } from "../features/scans/types";

const job = (status: Scan["status"] = "queued", id = "scan-1"): Scan => ({
  id, repository_id: "repo-1", requested_by: "user-1", branch: "main", rules_version: "baseline-v1", status,
  attempts: status === "queued" ? 0 : 1, commit_sha: status === "completed" ? "abc123" : null,
  scanner_version: status === "completed" ? "1.175.0" : null, error_code: null,
  created_at: "2026-08-28T09:00:00Z", started_at: null, finished_at: null,
});
const finding: Finding = { fingerprint: "fp-1", rule_id: "eval", severity: "High", file: "app.py", line: 2, end_line: 2, message: "Dynamic eval" };
const settle = () => new Promise<void>((resolve) => setImmediate(resolve));
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function harness(overrides: Partial<typeof scanService> = {}, canWrite = true) {
  let callback: (() => void) | undefined;
  const delays: number[] = [];
  const calls = { list: 0, get: 0, findings: 0, start: 0, cancel: 0 };
  const api: typeof scanService = {
    list: async () => { calls.list++; return [job()]; },
    get: async (_repo, id) => { calls.get++; return job("queued", id); },
    findings: async () => { calls.findings++; return [finding]; },
    start: async () => { calls.start++; return job(); },
    cancel: async () => { calls.cancel++; return job("cancelled"); },
    ...overrides,
  };
  const controller = new ScanController("repo-1", "main", canWrite, api, {
    schedule(fn, delay) { callback = fn; delays.push(delay); return () => { if (callback === fn) callback = undefined; }; },
  });
  return { controller, calls, delays, pending: () => !!callback,
    tick: () => { const fn = callback; callback = undefined; fn?.(); } };
}

test("scan service encodes IDs, sends cookies, no-store reads and abort signals", async (t) => {
  const seen: { path: string; init?: RequestInit }[] = [];
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    seen.push({ path: new URL(String(input)).pathname, init });
    return Response.json({ data: [] });
  });
  const signal = new AbortController().signal;
  const repo = "repo/with?query", scan = "scan/other?x=1";
  const root = `/api/v1/repositories/${encodeURIComponent(repo)}/scans`;
  await scanService.list(repo, signal);
  await scanService.get(repo, scan, signal);
  await scanService.findings(repo, scan, signal);
  await scanService.start(repo, "develop", signal);
  await scanService.cancel(repo, scan, signal);
  assert.deepEqual(seen.map((item) => item.path), [root, `${root}/${encodeURIComponent(scan)}`, `${root}/${encodeURIComponent(scan)}/findings`, root, `${root}/${encodeURIComponent(scan)}/cancel`]);
  assert.ok(seen.every(({ init }) => init?.credentials === "include" && init.signal === signal));
  assert.ok(seen.slice(0, 3).every(({ init }) => init?.cache === "no-store"));
  assert.equal(seen[3].init?.method, "POST");
  assert.deepEqual(JSON.parse(String(seen[3].init?.body)), { branch: "develop", rule_profile: "recommended" });
  assert.equal(seen[4].init?.method, "POST");
  assert.equal(seen[4].init?.body, undefined);
});

test("polls queued/running scans, loads findings only on completion and stops polling", async (t) => {
  let current = job();
  const h = harness({ list: async () => [current], get: async () => current });
  t.after(h.controller.stop);
  h.controller.start(); await settle();
  assert.equal(h.controller.getSnapshot().selected?.status, "queued");
  assert.equal(h.calls.findings, 0);
  assert.deepEqual(h.delays, [3000]);
  current = job("running"); h.tick(); await settle();
  assert.equal(h.controller.getSnapshot().selected?.status, "running");
  assert.equal(h.calls.findings, 0);
  current = job("completed"); h.tick(); await settle();
  assert.deepEqual(h.controller.getSnapshot().findings, [finding]);
  assert.equal(h.pending(), false);
});

test("completed detail overrides older queued list and stops polling", async (t) => {
  const h = harness({ get: async () => job("completed"), findings: async () => [] });
  t.after(h.controller.stop);
  h.controller.start(); await settle();
  assert.equal(h.controller.getSnapshot().jobs[0].status, "completed");
  assert.deepEqual(h.controller.getSnapshot().findings, []);
  assert.equal(h.pending(), false);
});

test("slow polls do not overlap or schedule before completion", async (t) => {
  const response = deferred<Scan[]>();
  let reads = 0;
  const h = harness({ list: async () => { reads++; return reads === 1 ? [job()] : response.promise; } });
  t.after(h.controller.stop);
  h.controller.start(); await settle(); h.tick();
  assert.equal(h.pending(), false);
  h.tick(); h.tick();
  assert.equal(reads, 2);
  response.resolve([job()]); await settle();
  assert.equal(h.pending(), true);
});

test("switching history clears old findings and ignores late responses even if transport ignores abort", async (t) => {
  const slow = deferred<Finding[]>();
  let signal: AbortSignal | undefined;
  const h = harness({
    list: async () => [job("completed", "new"), job("completed", "old")],
    get: async (_repo, id) => job("completed", id),
    findings: async (_repo, id, abort) => { if (id === "old") { signal = abort; return slow.promise; } return [finding]; },
  });
  t.after(h.controller.stop);
  h.controller.start(); await settle();
  h.controller.select("old");
  assert.equal(h.controller.getSnapshot().findings, null);
  await settle();
  h.controller.select("new"); await settle();
  assert.equal(signal?.aborted, true);
  slow.resolve([{ ...finding, file: "wrong-old.py" }]); await settle();
  assert.equal(h.controller.getSnapshot().selected?.id, "new");
  assert.deepEqual(h.controller.getSnapshot().findings, [finding]);
});

test("active scan continues polling while an older completed scan is selected", async (t) => {
  const h = harness({ list: async () => [job("running"), job("completed", "old")], get: async (_repo, id) => job(id === "old" ? "completed" : "running", id) });
  t.after(h.controller.stop);
  h.controller.start(); await settle(); h.controller.select("old"); await settle();
  assert.equal(h.controller.getSnapshot().selected?.id, "old");
  assert.equal(h.pending(), true);
  h.tick(); await settle();
  assert.equal(h.controller.getSnapshot().selected?.id, "old");
});

for (const status of ["failed", "cancelled"] as const) {
  test(`${status} scan never loads findings or schedules another poll`, async (t) => {
    const h = harness({ list: async () => [job(status)], get: async () => job(status) });
    t.after(h.controller.stop);
    h.controller.start(); await settle();
    assert.equal(h.controller.getSnapshot().findings, null);
    assert.equal(h.calls.findings, 0);
    assert.equal(h.pending(), false);
  });
}

for (const status of [401, 403, 404, 503]) {
  test(`poll error ${status} hides prior findings and pauses until a read-only retry`, async (t) => {
    let fail = false;
    const h = harness({ list: async () => { if (fail) throw new ApiError("private details", status); return [job("completed")]; }, get: async () => job("completed") });
    t.after(h.controller.stop);
    h.controller.start(); await settle();
    fail = true; await h.controller.refresh();
    assert.equal(h.controller.getSnapshot().phase, "error");
    assert.deepEqual(h.controller.getSnapshot().jobs, []);
    assert.equal(h.controller.getSnapshot().findings, null);
    assert.equal(h.controller.getSnapshot().selected, null);
    assert.equal(h.pending(), false);
    fail = false; h.controller.retry(); await settle();
    assert.equal(h.controller.getSnapshot().phase, "ready");
    assert.equal(h.calls.start, 0);
  });
}

test("finding retrieval errors are not presented as zero findings", async (t) => {
  const h = harness({ get: async () => job("completed"), findings: async () => { throw new ApiError("not complete", 409, "SCAN_NOT_COMPLETED"); } });
  t.after(h.controller.stop);
  h.controller.start(); await settle();
  assert.equal(h.controller.getSnapshot().phase, "error");
  assert.equal(h.controller.getSnapshot().findings, null);
});

test("enqueue guards duplicate clicks and selects returned job", async (t) => {
  const response = deferred<Scan>();
  let posts = 0, created = false;
  const h = harness({ list: async () => created ? [job()] : [], start: async (repo, branch) => { assert.equal(repo, "repo-1"); assert.equal(branch, "main"); posts++; return response.promise; } });
  t.after(h.controller.stop);
  h.controller.start(); await settle();
  const first = h.controller.enqueue();
  await h.controller.enqueue();
  assert.equal(posts, 1);
  assert.equal(h.controller.getSnapshot().action, "start");
  created = true; response.resolve(job()); await first;
  assert.equal(h.controller.getSnapshot().selected?.id, "scan-1");
  assert.equal(h.controller.getSnapshot().action, null);
  assert.equal(h.pending(), true);
  await h.controller.enqueue(); assert.equal(posts, 1);
});

test("cancel guards duplicate clicks and stops terminal polling", async (t) => {
  const response = deferred<Scan>();
  let current = job("running"), posts = 0;
  const h = harness({ list: async () => [current], get: async () => current, cancel: async () => { posts++; return response.promise; } });
  t.after(h.controller.stop);
  h.controller.start(); await settle();
  const first = h.controller.cancel(); await h.controller.cancel();
  assert.equal(posts, 1); assert.equal(h.pending(), false);
  current = job("cancelled"); response.resolve(current); await first;
  assert.equal(h.controller.getSnapshot().selected?.status, "cancelled");
  assert.equal(h.pending(), false);
  assert.match(h.controller.getSnapshot().notice, /analyzer may take time/);
});

test("viewers cannot submit either mutation", async (t) => {
  const h = harness({}, false); t.after(h.controller.stop);
  h.controller.start(); await settle();
  await h.controller.enqueue(); await h.controller.cancel();
  assert.equal(h.calls.start + h.calls.cancel, 0);
});

test("409 enqueue conflict reloads latest job without resubmitting", async (t) => {
  let created = false, posts = 0;
  const h = harness({ list: async () => created ? [job()] : [], start: async () => { posts++; created = true; throw new ApiError("active", 409, "SCAN_CONFLICT"); } });
  t.after(h.controller.stop); h.controller.start(); await settle();
  await h.controller.enqueue();
  assert.equal(posts, 1);
  assert.equal(h.controller.getSnapshot().selected?.id, "scan-1");
  assert.match(h.controller.getSnapshot().notice, /another request/);
});

test("409 cancellation conflict shows completed results without another cancellation", async (t) => {
  let current = job(), posts = 0;
  const h = harness({ list: async () => [current], get: async () => current, cancel: async () => { posts++; current = job("completed"); throw new ApiError("finished", 409, "SCAN_CONFLICT"); } });
  t.after(h.controller.stop); h.controller.start(); await settle();
  await h.controller.cancel();
  assert.equal(posts, 1);
  assert.deepEqual(h.controller.getSnapshot().findings, [finding]);
  assert.equal(h.pending(), false);
});

test("uncertain enqueue outcome offers read-only retry and discovers accepted job", async (t) => {
  let accepted = false, posts = 0;
  const h = harness({ list: async () => accepted ? [job()] : [], start: async () => { posts++; accepted = true; throw new TypeError("connection lost"); } });
  t.after(h.controller.stop); h.controller.start(); await settle();
  await h.controller.enqueue();
  assert.equal(h.controller.getSnapshot().phase, "error");
  assert.match(h.controller.getSnapshot().notice, /does not submit/);
  h.controller.retry(); await settle();
  assert.equal(posts, 1);
  assert.equal(h.controller.getSnapshot().selected?.id, "scan-1");
});

test("unmount aborts requests and ignores late work; restart is safe", async (t) => {
  const response = deferred<Scan[]>(); let signal: AbortSignal | undefined, reads = 0;
  const h = harness({ list: async (_repo, abort) => { signal = abort; reads++; return reads === 1 ? response.promise : []; } });
  t.after(h.controller.stop); h.controller.start();
  h.controller.stop();
  assert.equal(signal?.aborted, true);
  response.resolve([job()]); await settle();
  assert.equal(h.controller.getSnapshot().selected, null);
  assert.equal(h.pending(), false);
  h.controller.start(); await settle();
  assert.equal(h.controller.getSnapshot().phase, "ready");
  assert.deepEqual(h.controller.getSnapshot().jobs, []);
});

test("unmount during mutation ignores its late response and never queues a refresh", async (t) => {
  const response = deferred<Scan>(); let reads = 0;
  const h = harness({ list: async () => { reads++; return []; }, start: async () => response.promise });
  t.after(h.controller.stop); h.controller.start(); await settle();
  const request = h.controller.enqueue(); h.controller.stop();
  response.resolve(job()); await request;
  assert.equal(reads, 1);
  assert.equal(h.pending(), false);
});
