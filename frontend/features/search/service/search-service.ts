import { apiClient } from "@/lib/api-client";
import { dashboardHref } from "@/features/repositories/service/repository-service";

export type RepositoryHit = { id: string; title: string; description: string };
export type SearchResult = { repositories: RepositoryHit[] };
export const searchService = {
  find: (query: string, signal: AbortSignal) => apiClient<SearchResult>(`/api/v1/search?q=${encodeURIComponent(query.trim())}`, { signal, cache: "no-store" }),
};

// Route destinations are owned by the client; API results cannot inject URLs.
export const repositorySearchHref = (hit: Pick<RepositoryHit, "id">) => dashboardHref(hit.id);
