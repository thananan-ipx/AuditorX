export type ScanStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export type Scan = {
  /** Null/missing on historical scans; never infer scope from findings. */
  source_languages?: import("./rule-catalog").SourceLanguage[] | null;
  checked_rule_ids?: string[] | null;
  id: string;
  repository_id: string;
  requested_by: string;
  branch: string;
  rules_version: string;
  status: ScanStatus;
  attempts: number;
  commit_sha: string | null;
  scanner_version: string | null;
  error_code: string | null;
  source_kind: "github" | "upload" | "local";
  source_name: string | null;
  source_digest: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
};

export type Finding = {
  fingerprint: string;
  rule_id: string;
  severity: "High" | "Medium" | "Low";
  file: string;
  line: number;
  end_line: number;
  message: string;
};

export type LabelInput = {
  repository_group: string;
  review_status: "unreviewed" | "accepted" | "simulated" | "excluded" | "needs_context";
  priority_label: "" | "High" | "Medium" | "Low";
  repository_criticality: "high" | "normal" | "low" | "unknown";
  exposure: "public" | "authenticated" | "internal" | "test_only" | "unknown";
  impact: "high" | "medium" | "low" | "unknown";
  label_reason: string;
};
export type PriorityLabel = LabelInput & {
  id: number; scan_id: string; fingerprint: string; reviewer: string;
  guideline_version: string; labeled_at: string;
};

export function isActive(scan: Scan) {
  return scan.status === "queued" || scan.status === "running";
}
