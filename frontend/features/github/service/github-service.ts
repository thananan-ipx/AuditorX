import { apiClient } from "@/lib/api-client";
import { API_URL } from "@/lib/api-url";
import type { Repository } from "@/features/repositories/types";

export type GitHubInstallation = { id: number; account: { login: string } };
export type GitHubRepository = { id: number; name: string; full_name: string; private: boolean; default_branch: string; owner: { login: string } };
export type GitHubConnection = { connection: { connected: boolean; login?: string; expires_at?: string; reconnect: boolean }; installation_url: string };

export function githubStartHref(mode: "login" | "connect", next = "/repositories") {
  return `${API_URL}/api/v1/auth/github/start?${new URLSearchParams({ mode, next })}`;
}
export const githubService = {
  config: (signal?: AbortSignal) => apiClient<{ enabled: boolean }>("/api/v1/auth/github/config", { signal, cache: "no-store" }),
  connection: (signal?: AbortSignal) => apiClient<GitHubConnection>("/api/v1/github/connection", { signal, cache: "no-store" }),
  disconnect: () => apiClient<null>("/api/v1/github/disconnect", { method: "POST" }),
  installations: (page: number, signal?: AbortSignal) => apiClient<{ installations: GitHubInstallation[]; total_count: number }>(`/api/v1/github/installations?page=${page}`, { signal, cache: "no-store" }),
  repositories: (installation: number, page: number, signal?: AbortSignal) => apiClient<{ repositories: GitHubRepository[]; total_count: number }>(`/api/v1/github/repositories?installation_id=${installation}&page=${page}`, { signal, cache: "no-store" }),
  branches: (repository: number, page: number, signal?: AbortSignal) => apiClient<{ name: string }[]>(`/api/v1/github/branches?repository_id=${repository}&page=${page}`, { signal, cache: "no-store" }),
  import: (repository: number, installation: number, page: number, branch: string) => apiClient<Repository>("/api/v1/github/import", { method: "POST", body: JSON.stringify({ repository_id: repository, installation_id: installation, page, branch }) }),
};

export const githubLoginErrors: Record<string, string> = {
  github_state: "GitHub sign-in expired. Please try again.",
  github_denied: "GitHub authorization was cancelled. Please try again.",
  github_access: "GitHub sign-in failed. Please try again.",
  github_account_conflict: "Sign in to your existing account, then connect GitHub from Repositories. If GitHub is already linked elsewhere, use that account.",
  github_email: "Add a verified primary email to GitHub before creating an account, or sign in with email and connect GitHub.",
};
