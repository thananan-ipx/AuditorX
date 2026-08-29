import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ApiError } from "../lib/api-client";
import { EmptyRepositories, errorMessage, ModeNotice, UnscannedRepository, WorkspaceError } from "../features/repositories/components/workspace-feedback";

test("unscanned repository renders no sample scores and disables scan action", () => {
  const html = renderToStaticMarkup(createElement(UnscannedRepository, { repository: { id: "real-id", owner: "owner", name: "project", branch: "main", status: "Connected" } }));
  assert.match(html, /Scan queue unavailable/);
  assert.match(html, /This page has not queued a scan/);
  assert.match(html, /disabled=""/);
  assert.doesNotMatch(html, /repo-001|Code quality score|AI analysis|Simulate scan/);
});

test("empty workspace offers create only when available", () => {
  const enabled = renderToStaticMarkup(createElement(EmptyRepositories, { canCreate: true }));
  const disabled = renderToStaticMarkup(createElement(EmptyRepositories, { canCreate: false }));
  assert.match(enabled, /href="\/repositories#add-repository"/);
  assert.doesNotMatch(disabled, /Add repository/);
});

test("mode notices distinguish sample results from saved metadata", () => {
  const demo = renderToStaticMarkup(createElement(ModeNotice, { capabilities: { repository_storage: "prototype", repository_creation: false, scan_execution: false } }));
  const live = renderToStaticMarkup(createElement(ModeNotice, { capabilities: { repository_storage: "postgres", repository_creation: true, scan_execution: false } }));
  assert.match(demo, /sample data/);
  assert.match(live, /does not connect GitHub or scan its code/);
});

test("expired session links back to selected dashboard after sign in", () => {
  const html = renderToStaticMarkup(createElement(WorkspaceError, { error: new ApiError("expired", 401), retry: () => {}, returnTo: "/dashboard?repository=real-id" }));
  assert.match(html, /role="alert"/);
  assert.match(html, /href="\/login\?next=%2Fdashboard%3Frepository%3Dreal-id"/);
  assert.doesNotMatch(html, /Try again/);
});

test("errors explain duplicate, unavailable scanner, permissions and connectivity", () => {
  assert.match(errorMessage(new ApiError("duplicate", 409, "REPOSITORY_EXISTS")), /already registered/);
  assert.match(errorMessage(new ApiError("scanner", 501, "SCANNER_NOT_READY")), /No scan was queued/);
  assert.match(errorMessage(new ApiError("private", 403)), /permission/);
  assert.match(errorMessage(new ApiError("private", 404)), /not found or is no longer accessible/);
  assert.match(errorMessage(new TypeError("failed fetch")), /connection/);
  assert.doesNotMatch(errorMessage(new ApiError("secret SQL credentials", 503)), /secret|SQL|credentials/);
});
