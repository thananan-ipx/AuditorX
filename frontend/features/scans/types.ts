export type ScanStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export type Scan = {
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

export function isActive(scan: Scan) {
  return scan.status === "queued" || scan.status === "running";
}
