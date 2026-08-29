import type { Dashboard, Issue } from "@/features/dashboard/types";
import { apiClient } from "@/lib/api-client";

export const dashboardService = {
  getDashboard: (repositoryID: string, signal?: AbortSignal) => apiClient<Dashboard>(`/api/v1/repositories/${encodeURIComponent(repositoryID)}/dashboard`, { signal, cache: "no-store" }),
  getIssues: (repositoryID: string, signal?: AbortSignal) => apiClient<Issue[]>(`/api/v1/issues?repository_id=${encodeURIComponent(repositoryID)}`, { signal, cache: "no-store" }),
  startScan: (repositoryID: string, branch: string) => apiClient<{ id: string; status: string }>(`/api/v1/repositories/${encodeURIComponent(repositoryID)}/scans`, {
    method: "POST",
    body: JSON.stringify({ branch, rule_profile: "recommended" }),
  }),
};
