import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { ApiError, apiClient } from "../lib/api-client";
import { dashboardHref, repositoryService } from "../features/repositories/service/repository-service";
import { dashboardService } from "../features/dashboard/service/dashboard-service";
import { loadDashboard } from "../features/dashboard/service/load-dashboard";

const repository = { id: "11111111-1111-4111-8111-111111111111", owner: "sample", name: "project", branch: "develop", status: "Connected", access_level: "owner" };
const postgres = { repository_storage: "postgres", repository_creation: true, scan_execution: false };
const prototype = { ...postgres, repository_storage: "prototype", repository_creation: false };
const listPath = "/api/v1/repositories?page=1&page_size=20";

function routes(t: TestContext, responses: Record<string, unknown | Response>) {
  const seen: { path: string; init?: RequestInit }[] = [];
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const path = url.pathname + url.search;
    seen.push({ path, init });
    assert.ok(path in responses, `Unexpected API request: ${path}`);
    init?.signal?.throwIfAborted();
    const value = responses[path];
    return value instanceof Response ? value : Response.json({ data: value });
  });
  return seen;
}

function apiError(status: number, code: string) {
  return Response.json({ error: { code, message: "A test error" } }, { status });
}

test("ApiError preserves HTTP status and business code", async (t) => {
  routes(t, { "/test": apiError(409, "SCAN_REQUIRED") });
  await assert.rejects(apiClient("/test"), (error) => error instanceof ApiError && error.status === 409 && error.code === "SCAN_REQUIRED");
});

test("empty persistent workspace never requests demo data", async (t) => {
  const seen = routes(t, { "/api/v1/capabilities": postgres, [listPath]: [] });
  assert.deepEqual(await loadDashboard(), { kind: "empty", capabilities: postgres });
  assert.equal(seen.length, 2);
});

test("enabled persistent queue routes to real scan UI without legacy sample endpoints", async (t) => {
  const capabilities = { ...postgres, scan_queue: true };
  const seen = routes(t, { "/api/v1/capabilities": capabilities, [`/api/v1/repositories/${repository.id}`]: repository });
  assert.deepEqual(await loadDashboard(repository.id), { kind: "scans", repository, capabilities });
  assert.equal(seen.length, 2);
});

test("deep link resolves directly beyond page one and shows unscanned state", async (t) => {
  const seen = routes(t, {
    "/api/v1/capabilities": postgres,
    [`/api/v1/repositories/${repository.id}`]: repository,
    [`/api/v1/repositories/${repository.id}/dashboard`]: apiError(409, "SCAN_REQUIRED"),
  });
  assert.deepEqual(await loadDashboard(repository.id), { kind: "unscanned", repository, capabilities: postgres });
  assert.equal(seen.length, 3);
  assert.ok(seen.every(({ init }) => init?.credentials === "include" && init?.cache === "no-store"));
});

test("default selection uses the first accessible repository and scopes issues to it", async (t) => {
  const dashboard = { repository };
  const issues = [{ id: "finding-1" }];
  routes(t, {
    "/api/v1/capabilities": postgres, [listPath]: [repository],
    [`/api/v1/repositories/${repository.id}/dashboard`]: dashboard,
    [`/api/v1/issues?repository_id=${repository.id}`]: issues,
  });
  assert.deepEqual(await loadDashboard(), { kind: "ready", repository, capabilities: postgres, dashboard, issues });
});

test("prototype resolves selected sample without calling persistent detail API", async (t) => {
  const demo = { ...repository, id: "sample-from-api" };
  routes(t, {
    "/api/v1/capabilities": prototype, [listPath]: [demo],
    "/api/v1/repositories/sample-from-api/dashboard": { repository: demo },
    "/api/v1/issues?repository_id=sample-from-api": [],
  });
  const result = await loadDashboard(demo.id);
  assert.equal(result.kind, "ready");
  if (result.kind === "ready") assert.equal(result.repository.id, demo.id);
});

test("unknown explicit demo selection never silently falls back to first repository", async (t) => {
  routes(t, { "/api/v1/capabilities": prototype, [listPath]: [repository] });
  await assert.rejects(loadDashboard("missing"), (error) => error instanceof ApiError && error.status === 404);
});

for (const status of [401, 403, 404, 503]) {
  test(`persistent detail error ${status} is preserved without demo fallback`, async (t) => {
    const seen = routes(t, { "/api/v1/capabilities": postgres, [`/api/v1/repositories/${repository.id}`]: apiError(status, "TEST_ERROR") });
    await assert.rejects(loadDashboard(repository.id), (error) => error instanceof ApiError && error.status === status);
    assert.equal(seen.length, 2);
  });
}

test("only SCAN_REQUIRED with 409 becomes an empty scan state", async (t) => {
  routes(t, {
    "/api/v1/capabilities": postgres, [listPath]: [repository],
    [`/api/v1/repositories/${repository.id}/dashboard`]: apiError(409, "OTHER_CONFLICT"),
  });
  await assert.rejects(loadDashboard(), (error) => error instanceof ApiError && error.code === "OTHER_CONFLICT");
});

test("issue permission failures are not presented as zero findings", async (t) => {
  routes(t, {
    "/api/v1/capabilities": postgres, [listPath]: [repository],
    [`/api/v1/repositories/${repository.id}/dashboard`]: { repository },
    [`/api/v1/issues?repository_id=${repository.id}`]: apiError(403, "INSUFFICIENT_ACCESS"),
  });
  await assert.rejects(loadDashboard(), (error) => error instanceof ApiError && error.status === 403);
});

test("all dashboard reads carry the same abort signal", async (t) => {
  const controller = new AbortController();
  const seen = routes(t, {
    "/api/v1/capabilities": postgres, [listPath]: [repository],
    [`/api/v1/repositories/${repository.id}/dashboard`]: { repository },
    [`/api/v1/issues?repository_id=${repository.id}`]: [],
  });
  await loadDashboard(undefined, controller.signal);
  assert.equal(seen.length, 4);
  assert.ok(seen.every(({ init }) => init?.signal === controller.signal));
});

test("aborted dashboard loading rejects without fallback", async (t) => {
  const controller = new AbortController();
  controller.abort();
  const seen = routes(t, { "/api/v1/capabilities": postgres });
  await assert.rejects(loadDashboard(undefined, controller.signal), { name: "AbortError" });
  assert.equal(seen.length, 1);
});

test("repository creation trims input, defaults branch, and sends no ownership fields", async (t) => {
  const seen = routes(t, { "/api/v1/repositories": repository });
  assert.deepEqual(await repositoryService.create(" https://github.com/owner/repo ", " "), repository);
  assert.equal(seen[0].init?.method, "POST");
  assert.deepEqual(JSON.parse(String(seen[0].init?.body)), { repository_url: "https://github.com/owner/repo", branch: "main" });
});

test("repository list preserves pagination", async (t) => {
  routes(t, { "/api/v1/repositories?page=3&page_size=20": [repository] });
  assert.deepEqual(await repositoryService.list(3), [repository]);
});

test("IDs cannot inject routes or query parameters", async (t) => {
  const id = "a/b?x=1&repository=other";
  const encoded = encodeURIComponent(id);
  assert.equal(dashboardHref(id), `/dashboard?repository=${encoded}`);
  routes(t, {
    [`/api/v1/repositories/${encoded}`]: repository,
    [`/api/v1/repositories/${encoded}/dashboard`]: {},
    [`/api/v1/issues?repository_id=${encoded}`]: [],
    [`/api/v1/repositories/${encoded}/scans`]: { status: "Pending" },
  });
  await repositoryService.get(id);
  await dashboardService.getDashboard(id);
  await dashboardService.getIssues(id);
  await dashboardService.startScan(id, "main");
});
