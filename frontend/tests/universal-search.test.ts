import assert from "node:assert/strict";
import { test } from "node:test";
import { currentPage, navigationPages, searchPages } from "../components/layout/navigation";
import { repositorySearchHref, searchService } from "../features/search/service/search-service";

test("search and sidebar share implemented destinations and match both UI languages", () => {
  assert.deepEqual(searchPages("").map(page => page.href), navigationPages.map(page => page.href));
  assert.deepEqual(searchPages("คลังโค้ด").map(page => page.href), ["/repositories"]);
  assert.deepEqual(searchPages("  GITHUB ").map(page => page.href), ["/repositories"]);
  assert.equal(searchPages("Reports").length, 0);
  assert.equal(currentPage("/repositories/record")?.href, "/repositories");
  assert.equal(currentPage("/repositories-unrelated"), undefined);
});

test("repository search preserves cancellation, requests fresh results and encodes untrusted IDs", async t => {
  const fetch = t.mock.method(globalThis, "fetch", async () => Response.json({ data: { repositories: [] } }));
  const controller = new AbortController();
  await searchService.find(" owner/name & branch ", controller.signal);
  const [url, init] = fetch.mock.calls[0].arguments;
  assert.match(String(url), /q=owner%2Fname%20%26%20branch$/);
  assert.equal(init?.signal, controller.signal);
  assert.equal(init?.cache, "no-store");
  assert.equal(init?.credentials, "include");
  assert.equal(repositorySearchHref({ id: "a&next=https://evil.test" }), "/dashboard?repository=a%26next%3Dhttps%3A%2F%2Fevil.test");
});
