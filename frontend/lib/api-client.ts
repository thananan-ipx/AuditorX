import { API_URL } from "@/lib/api-url";

export class ApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly code?: string) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiClient<T>(path: string, init?: RequestInit): Promise<T> {
  return (await request<T>(path, init)).data;
}

/** Like apiClient, but also returns the response `meta` (e.g. total counts). */
export async function apiClientPage<T>(path: string, init?: RequestInit): Promise<{ data: T; meta: Record<string, unknown> }> {
  return request<T>(path, init);
}

async function request<T>(path: string, init?: RequestInit): Promise<{ data: T; meta: Record<string, unknown> }> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type") && !(init?.body instanceof FormData)) headers.set("Content-Type", "application/json");

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });

  if (!response.ok) {
    // Proxies may return HTML or an empty body. Do not expose those bodies.
    const payload = await response.json().catch(() => null);
    const message = payload?.error?.message;
    throw new ApiError(typeof message === "string" && message.trim()
      ? message
      : `API request failed (${response.status})`, response.status,
    typeof payload?.error?.code === "string" ? payload.error.code : undefined);
  }

  if (response.status === 204) return { data: null as T, meta: {} };
  const payload = await response.json();
  return { data: payload?.data as T, meta: payload?.meta && typeof payload.meta === "object" ? payload.meta : {} };
}
