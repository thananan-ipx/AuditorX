import type { PriorityLabel } from "./types";

export function labelReadiness(labels: PriorityLabel[]) {
  const hasPriority = (label: PriorityLabel) => ["High", "Medium", "Low"].includes(label.priority_label);
  const human = labels.filter(label => label.review_status === "accepted" && hasPriority(label)).length;
  const simulated = labels.filter(label => label.review_status === "simulated" && label.exposure === "test_only" && hasPriority(label)).length;
  return { human, simulated, ready: human + simulated };
}
