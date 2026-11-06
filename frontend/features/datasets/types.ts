export type DatasetSample = {
  sample_id: string; repository_group: string; split: "train" | "validation" | "test";
  severity: string; rule_family: string; category: string; language: string; file_type: string;
  repository_criticality: string; exposure: string; impact: string;
  priority_label: "High" | "Medium" | "Low"; rubric_score: string;
  scenario: string; label_reason: string; label_source: string; human_reviewed: string;
};
export type TrainingDataset = {
  id: string; title: string; dataset_kind: "synthetic"; description: string;
  samples: DatasetSample[];
  manifest: {
    rows: number; independent_scenario_families: number; features: string[];
    splits: Record<"train" | "validation" | "test", { rows: number; groups: string[]; classes: Record<string, number> }>;
  };
  metrics: { selected_model: string; test_macro_f1: number; severity_baseline_test_macro_f1: number };
};

export function filterSamples(samples: DatasetSample[], query: string, priority: string, split: string) {
  const term = query.trim().toLocaleLowerCase();
  return samples.filter(sample => (priority === "all" || sample.priority_label === priority)
    && (split === "all" || sample.split === split)
    && (!term || [sample.sample_id, sample.repository_group, sample.rule_family, sample.scenario, sample.language].join(" ").toLocaleLowerCase().includes(term)));
}
