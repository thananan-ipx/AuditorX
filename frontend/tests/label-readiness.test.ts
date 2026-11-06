import assert from "node:assert/strict";
import { test } from "node:test";
import { labelReadiness } from "../features/scans/label-readiness";
import type { PriorityLabel } from "../features/scans/types";

test("training readiness includes labeled simulations while preserving human-confirmed counts", () => {
  const labels = [
    { review_status: "accepted", priority_label: "High", exposure: "public" },
    { review_status: "simulated", priority_label: "Low", exposure: "test_only" },
    { review_status: "needs_context", priority_label: "", exposure: "test_only" },
    { review_status: "excluded", priority_label: "", exposure: "test_only" },
    { review_status: "simulated", priority_label: "", exposure: "test_only" },
    { review_status: "simulated", priority_label: "High", exposure: "public" },
  ] as PriorityLabel[];
  assert.deepEqual(labelReadiness(labels), { human: 1, simulated: 1, ready: 2 });
  assert.deepEqual(labelReadiness(labels.slice(1)), { human: 0, simulated: 1, ready: 1 });
});
