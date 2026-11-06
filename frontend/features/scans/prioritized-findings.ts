import type { Finding, PriorityLabel } from "./types";
import type { PredictionResult } from "./service/prediction-service";

export function prioritizeFindings(findings: Finding[], result: PredictionResult | null, labels: PriorityLabel[]) {
  const predictions = new Map(result?.predictions.map(item => [item.fingerprint, item.priority]) ?? []);
  const reviews = new Map(labels.map(label => [label.fingerprint, label]));
  const order = { High: 0, Medium: 1, Low: 2 };
  return findings.map(finding => {
    const review = reviews.get(finding.fingerprint);
    const human = review?.review_status === "accepted" && review.priority_label ? review.priority_label : null;
    const priority = human ?? predictions.get(finding.fingerprint) ?? null;
    return { finding, review, priority, source: human ? "human" : priority ? "model" : "pending", excluded: review?.review_status === "excluded" };
  }).sort((a, b) => (a.priority ? order[a.priority] : 3) - (b.priority ? order[b.priority] : 3)
    || a.finding.file.localeCompare(b.finding.file, "en") || a.finding.line - b.finding.line
    || a.finding.fingerprint.localeCompare(b.finding.fingerprint, "en"));
}
