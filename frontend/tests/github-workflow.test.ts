import assert from "node:assert/strict";
import { test } from "node:test";
import { githubService, githubStartHref } from "../features/github/service/github-service";
import { failureMessage } from "../features/scans/components/repository-scans";

test("GitHub authorization encodes the return path and keeps credentials out of URLs", () => {
  const url = new URL(githubStartHref("connect", "/dashboard?repository=a&next=//other"));
  assert.equal(url.pathname, "/api/v1/auth/github/start");
  assert.equal(url.searchParams.get("mode"), "connect");
  assert.equal(url.searchParams.get("next"), "/dashboard?repository=a&next=//other");
  assert.equal(url.searchParams.has("token"), false);
});

test("GitHub directory reads are cancellable and never cached", async t => {
  const fetch = t.mock.method(globalThis, "fetch", async () => Response.json({ data: { repositories: [], total_count: 0 } }));
  const controller = new AbortController();
  await githubService.repositories(123, 2, controller.signal);
  const [url, init] = fetch.mock.calls[0].arguments;
  assert.match(String(url), /installation_id=123&page=2$/);
  assert.equal(init?.signal, controller.signal);
  assert.equal(init?.cache, "no-store");
  assert.equal(init?.credentials, "include");
});

test("import sends upstream IDs and branch without trusting a client repository URL", async t => {
  const fetch = t.mock.method(globalThis, "fetch", async () => Response.json({ data: { id: "local-repo" } }));
  await githubService.import(9001, 123, 2, "feature/review");
  const init = fetch.mock.calls[0].arguments[1];
  assert.equal(init?.method, "POST");
  assert.deepEqual(JSON.parse(String(init?.body)), { repository_id: 9001, installation_id: 123, page: 2, branch: "feature/review" });
});

test("failed connected scans explain how to restore GitHub access", () => {
  assert.match(failureMessage("GITHUB_ACCESS_REQUIRED"), /Reconnect GitHub from Repositories/);
});
