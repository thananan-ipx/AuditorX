import type { Repository } from "./types";

export type ScanFilter = "all" | "never" | "active" | "completed" | "failed" | "high";
export type SortKey = "newest" | "name" | "last_scan" | "high";
export type ListFilters = { query: string; access: string; scan: ScanFilter; sort: SortKey };

export const defaultFilters: ListFilters = { query: "", access: "all", scan: "all", sort: "newest" };

const isActiveScan = (repository: Repository) => repository.latest_scan?.status === "queued" || repository.latest_scan?.status === "running";

export function matchesScan(repository: Repository, filter: ScanFilter) {
  const scan = repository.latest_scan;
  switch (filter) {
    case "never": return !scan;
    case "active": return isActiveScan(repository);
    case "completed": return scan?.status === "completed";
    case "failed": return scan?.status === "failed";
    case "high": return (scan?.status === "completed" ? scan.high : 0) > 0;
    default: return true;
  }
}

export function filterRepositories(items: Repository[], filters: ListFilters): Repository[] {
  const needle = filters.query.normalize("NFKC").trim().toLowerCase();
  const result = items.filter((repository) =>
    (!needle || `${repository.owner}/${repository.name} ${repository.branch}`.toLowerCase().includes(needle))
    && (filters.access === "all" || repository.access_level === filters.access)
    && matchesScan(repository, filters.scan));
  const name = (repository: Repository) => `${repository.owner}/${repository.name}`.toLowerCase();
  const time = (repository: Repository) => Date.parse(repository.latest_scan?.created_at ?? "") || 0;
  const created = (repository: Repository) => Date.parse(repository.created_at ?? "") || 0;
  switch (filters.sort) {
    case "name": return result.sort((a, b) => name(a).localeCompare(name(b)));
    case "last_scan": return result.sort((a, b) => time(b) - time(a) || name(a).localeCompare(name(b)));
    case "high": return result.sort((a, b) => (b.latest_scan?.high ?? 0) - (a.latest_scan?.high ?? 0) || name(a).localeCompare(name(b)));
    default: return result.sort((a, b) => created(b) - created(a));
  }
}

export function summarize(items: Repository[]) {
  return {
    loaded: items.length,
    scanning: items.filter(isActiveScan).length,
    neverScanned: items.filter((repository) => !repository.latest_scan).length,
    high: items.reduce((sum, repository) => sum + (repository.latest_scan?.status === "completed" ? repository.latest_scan.high : 0), 0),
  };
}
