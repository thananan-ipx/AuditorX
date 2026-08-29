import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { apiClient } from "../lib/api-client";
import { API_URL } from "../lib/api-url";

function respond(t: TestContext, response: Response) {
  return t.mock.method(globalThis, "fetch", async () => response);
}

test("unwraps data and calls the configured API with session cookies", async (t) => {
  const fetch = respond(t, Response.json({ data: { id: "repo-001" } }));
  assert.deepEqual(await apiClient("/api/v1/repositories"), { id: "repo-001" });
  const [url, init] = fetch.mock.calls[0].arguments;
  assert.equal(url, `${API_URL}/api/v1/repositories`);
  assert.equal(init?.credentials, "include");
  assert.equal(new Headers(init?.headers).get("Content-Type"), "application/json");
});

test("preserves method, body and abort signal", async (t) => {
  const fetch = respond(t, Response.json({ data: { status: "Pending" } }, { status: 202 }));
  const controller = new AbortController();
  const body = JSON.stringify({ branch: "develop" });
  await apiClient("/api/v1/repositories/repo-001/scans", {
    method: "POST", body, signal: controller.signal,
  });
  const init = fetch.mock.calls[0].arguments[1];
  assert.equal(init?.method, "POST");
  assert.equal(init?.body, body);
  assert.equal(init?.signal, controller.signal);
});

for (const [name, headers] of [
  ["plain object", { "X-Request-ID": "test-request", "Content-Type": "application/custom+json" }],
  ["Headers object", new Headers({ "X-Request-ID": "test-request", "Content-Type": "application/custom+json" })],
  ["tuple array", [["X-Request-ID", "test-request"], ["Content-Type", "application/custom+json"]]],
] as [string, HeadersInit][]) {
  test(`accepts custom headers as a ${name}`, async (t) => {
    const fetch = respond(t, Response.json({ data: [] }));
    await apiClient("/api/v1/issues", { headers });
    const sent = new Headers(fetch.mock.calls[0].arguments[1]?.headers);
    assert.equal(sent.get("X-Request-ID"), "test-request");
    assert.equal(sent.get("Content-Type"), "application/custom+json");
  });
}

test("returns null for 204 without parsing an empty body", async (t) => {
  respond(t, new Response(null, { status: 204 }));
  assert.equal(await apiClient<null>("/api/v1/example", { method: "DELETE" }), null);
});

test("keeps the API's structured error message", async (t) => {
  respond(t, Response.json({ error: { message: "Repository not found" } }, { status: 404 }));
  await assert.rejects(apiClient("/api/v1/repositories/missing"), { message: "Repository not found" });
});

test("uses HTTP status when JSON has no error message", async (t) => {
  respond(t, Response.json({}, { status: 403 }));
  await assert.rejects(apiClient("/api/v1/issues"), { message: "API request failed (403)" });
});

test("handles an HTML gateway error without leaking the response body", async (t) => {
  respond(t, new Response("<html>internal gateway details</html>", { status: 502 }));
  await assert.rejects(apiClient("/api/v1/issues"), { message: "API request failed (502)" });
});

test("handles an empty error response", async (t) => {
  respond(t, new Response(null, { status: 503 }));
  await assert.rejects(apiClient("/api/v1/issues"), { message: "API request failed (503)" });
});

test("rejects malformed JSON in successful responses", async (t) => {
  respond(t, new Response("not JSON", { status: 200 }));
  await assert.rejects(apiClient("/api/v1/issues"), SyntaxError);
});

test("propagates network errors", async (t) => {
  const error = new TypeError("Network unavailable");
  t.mock.method(globalThis, "fetch", async () => { throw error; });
  await assert.rejects(apiClient("/api/v1/issues"), (actual) => actual === error);
});
