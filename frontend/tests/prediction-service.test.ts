import assert from "node:assert/strict";
import { test } from "node:test";
import { predictScan } from "../features/scans/service/prediction-service";
import type { Scan } from "../features/scans/types";

test("prediction sends context only through the permission-scoped API and supports cancellation", async () => {
  const original = globalThis.fetch;
  const controller = new AbortController();
  const context = { repository_criticality: "low", exposure: "test_only", impact: "unknown" } as const;
  globalThis.fetch = async (url, init) => {
    assert.match(String(url), /repositories\/repo%2Fone\/scans\/scan%3Ftwo\/predictions$/);
    assert.equal(init?.method, "POST");
    assert.equal(init?.credentials, "include");
    assert.equal(init?.signal, controller.signal);
    assert.deepEqual(JSON.parse(String(init?.body)), context);
    return Response.json({ data: { experimental: true, predictions: [] } });
  };
  try {
    const result = await predictScan({ repository_id: "repo/one", id: "scan?two" } as Scan, context, controller.signal);
    assert.equal(result.experimental, true);
  } finally { globalThis.fetch = original; }
});
