import { ApiError } from "@/lib/api-client";
import { repositoryService } from "@/features/repositories/service/repository-service";
import type { Capabilities, Repository } from "@/features/repositories/types";
import type { Dashboard, Issue } from "../types";
import { dashboardService } from "./dashboard-service";

type RepositoryContext = { capabilities: Capabilities; repository: Repository };
export type DashboardResult =
  | { kind: "empty"; capabilities: Capabilities }
  | ({ kind: "unscanned" } & RepositoryContext)
  | ({ kind: "scans" } & RepositoryContext)
  | ({ kind: "ready"; dashboard: Dashboard; issues: Issue[] } & RepositoryContext);

export async function loadDashboard(id?: string, signal?: AbortSignal): Promise<DashboardResult> {
  const capabilities = await repositoryService.capabilities(signal);
  let repository: Repository | undefined;
  if (id && capabilities.repository_storage === "postgres") {
    // A deep link may point outside the first list page. The server checks membership.
    repository = await repositoryService.get(id, signal);
  } else {
    const repositories = await repositoryService.list(1, signal);
    repository = id ? repositories.find((item) => item.id === id) : repositories[0];
  }
  if (!repository) {
    if (id) throw new ApiError("Repository was not found or is no longer accessible.", 404, "RESOURCE_NOT_FOUND");
    return { kind: "empty", capabilities };
  }

  if (capabilities.repository_storage === "postgres" && capabilities.scan_queue === true) {
    return { kind: "scans", repository, capabilities };
  }

  let dashboard: Dashboard;
  try {
    dashboard = await dashboardService.getDashboard(repository.id, signal);
  } catch (error) {
    if (error instanceof ApiError && error.status === 409 && error.code === "SCAN_REQUIRED") {
      return { kind: "unscanned", repository, capabilities };
    }
    throw error;
  }
  const issues = await dashboardService.getIssues(repository.id, signal);
  return { kind: "ready", repository, capabilities, dashboard, issues };
}
