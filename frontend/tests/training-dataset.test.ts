import assert from "node:assert/strict";
import { test } from "node:test";
import { filterSamples, type DatasetSample } from "../features/datasets/types";
import { searchPages, currentPage } from "../components/layout/navigation";

test("dataset filters combine split, priority and search without changing the exported collection", () => {
  const rows = [
    { sample_id: "one", priority_label: "High", split: "train", language: "go", rule_family: "security.tls", repository_group: "a", scenario: "Sensitive service" },
    { sample_id: "two", priority_label: "Low", split: "test", language: "typescript", rule_family: "nextjs.review.status", repository_group: "b", scenario: "Sandbox" },
  ] as DatasetSample[];
  assert.deepEqual(filterSamples(rows, " SANDBOX ", "Low", "test").map(r => r.sample_id), ["two"]);
  assert.equal(filterSamples(rows, "go", "Low", "all").length, 0);
  assert.equal(filterSamples(rows, "", "all", "all").length, 2);
  assert.equal(rows.length, 2);
});

test("training dataset is reachable from the shared sidebar and global search", () => {
  assert.equal(currentPage("/datasets")?.label, "Training datasets");
  assert.deepEqual(searchPages("ชุดข้อมูล").map(p => p.href), ["/datasets"]);
});
