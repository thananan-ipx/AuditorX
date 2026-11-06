import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultFilters, filterRepositories, summarize } from "../features/repositories/repository-list";
import type { Repository } from "../features/repositories/types";

const base = { branch: "main", status: "Connected" };
const items: Repository[] = [
  { ...base, id: "1", owner: "acme", name: "api", access_level: "owner", created_at: "2026-01-01T00:00:00Z", latest_scan: { status: "completed", created_at: "2026-02-01T00:00:00Z", high: 3, medium: 1, low: 0 } },
  { ...base, id: "2", owner: "acme", name: "web", access_level: "viewer", created_at: "2026-03-01T00:00:00Z", latest_scan: { status: "running", created_at: "2026-03-02T00:00:00Z", high: 0, medium: 0, low: 0 } },
  { ...base, id: "3", owner: "zeta", name: "tools", branch: "dev", access_level: "editor", created_at: "2026-02-01T00:00:00Z" },
];
const ids = (list: Repository[]) => list.map((item) => item.id);

test("default order is newest added first", () => {
  assert.deepEqual(ids(filterRepositories(items, defaultFilters)), ["2", "3", "1"]);
});

test("search matches owner, name and branch", () => {
  assert.deepEqual(ids(filterRepositories(items, { ...defaultFilters, query: " ACME/we" })), ["2"]);
  assert.deepEqual(ids(filterRepositories(items, { ...defaultFilters, query: "dev" })), ["3"]);
});

test("access and scan filters combine", () => {
  assert.deepEqual(ids(filterRepositories(items, { ...defaultFilters, access: "owner" })), ["1"]);
  assert.deepEqual(ids(filterRepositories(items, { ...defaultFilters, scan: "never" })), ["3"]);
  assert.deepEqual(ids(filterRepositories(items, { ...defaultFilters, scan: "active" })), ["2"]);
  assert.deepEqual(ids(filterRepositories(items, { ...defaultFilters, scan: "high" })), ["1"]);
  assert.deepEqual(ids(filterRepositories(items, { ...defaultFilters, scan: "failed" })), []);
});

test("sorting by name, last scan and high findings", () => {
  assert.deepEqual(ids(filterRepositories(items, { ...defaultFilters, sort: "name" })), ["1", "2", "3"]);
  assert.deepEqual(ids(filterRepositories(items, { ...defaultFilters, sort: "last_scan" })), ["2", "1", "3"]);
  assert.deepEqual(ids(filterRepositories(items, { ...defaultFilters, sort: "high" })), ["1", "2", "3"]);
});

test("summary counts scanning, unscanned and completed high findings", () => {
  assert.deepEqual(summarize(items), { loaded: 3, scanning: 1, neverScanned: 1, high: 3 });
});
