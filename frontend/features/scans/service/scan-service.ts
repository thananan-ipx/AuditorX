import { apiClient } from "@/lib/api-client";
import type { Finding, Scan } from "../types";

const base = (repositoryID: string) => `/api/v1/repositories/${encodeURIComponent(repositoryID)}/scans`;
const detail = (repositoryID: string, scanID: string) => `${base(repositoryID)}/${encodeURIComponent(scanID)}`;

export const scanService = {
  list(repositoryID: string, signal?: AbortSignal) {
    return apiClient<Scan[]>(base(repositoryID), { cache: "no-store", signal });
  },
  get(repositoryID: string, scanID: string, signal?: AbortSignal) {
    return apiClient<Scan>(detail(repositoryID, scanID), { cache: "no-store", signal });
  },
  findings(repositoryID: string, scanID: string, signal?: AbortSignal) {
    return apiClient<Finding[]>(`${detail(repositoryID, scanID)}/findings`, { cache: "no-store", signal });
  },
  start(repositoryID: string, branch: string, signal?: AbortSignal) {
    return apiClient<Scan>(base(repositoryID), {
      method: "POST", body: JSON.stringify({ branch, rule_profile: "recommended" }), signal,
    });
  },
  cancel(repositoryID: string, scanID: string, signal?: AbortSignal) {
    return apiClient<Scan>(`${detail(repositoryID, scanID)}/cancel`, { method: "POST", signal });
  },
};
