export type Repository = {
  id: string;
  owner: string;
  name: string;
  branch: string;
  status: string;
  repository_url?: string;
  access_level?: "owner" | "editor" | "viewer";
  created_at?: string;
};

export type Capabilities = {
  repository_storage: "prototype" | "postgres";
  repository_creation: boolean;
  scan_execution: boolean;
  /** Queue availability, not a worker-health signal. Optional for older APIs. */
  scan_queue?: boolean;
};
