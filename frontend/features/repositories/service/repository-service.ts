import { apiClient } from "@/lib/api-client";
import type { Capabilities, Repository } from "../types";

export const PAGE_SIZE = 20;

export const repositoryService = {
  capabilities: (signal?: AbortSignal) => apiClient<Capabilities>("/api/v1/capabilities", { signal, cache: "no-store" }),
  list: (page = 1, signal?: AbortSignal) => apiClient<Repository[]>(`/api/v1/repositories?page=${page}&page_size=${PAGE_SIZE}`, { signal, cache: "no-store" }),
  get: (id: string, signal?: AbortSignal) => apiClient<Repository>(`/api/v1/repositories/${encodeURIComponent(id)}`, { signal, cache: "no-store" }),
  create: (repositoryURL: string, branch: string) => apiClient<Repository>("/api/v1/repositories", {
    method: "POST",
    body: JSON.stringify({ repository_url: repositoryURL.trim(), branch: branch.trim() || "main" }),
  }),
};

export function dashboardHref(id: string) {
  return `/dashboard?repository=${encodeURIComponent(id)}`;
}
