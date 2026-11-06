export type LatestScan = {
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  created_at: string;
  high: number; medium: number; low: number;
};

export type Repository = {
  id: string;
  owner: string;
  name: string;
  branch: string;
  status: string;
  repository_url?: string;
  access_level?: "owner" | "editor" | "viewer";
  created_at?: string;
  /** Only returned by the list endpoint. */
  latest_scan?: LatestScan;
};

export type Capabilities = {
  repository_storage: "prototype" | "postgres";
  repository_creation: boolean;
  scan_execution: boolean;
  /** Queue availability, not a worker-health signal. Optional for older APIs. */
  scan_queue?: boolean;
};
