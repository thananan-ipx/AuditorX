import { apiClient } from "@/lib/api-client";

export type AuthUser = { id: string; email: string };
type AuthResponse = { user: AuthUser } | null;

export const authService = {
  me: (signal?: AbortSignal) => apiClient<{ user: AuthUser }>("/api/v1/auth/me", { signal, cache: "no-store" }),
  signIn: (email: FormDataEntryValue | null, password: FormDataEntryValue | null) =>
    apiClient<AuthResponse>("/api/v1/auth/sign-in", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  signUp: (email: FormDataEntryValue | null, password: FormDataEntryValue | null) =>
    apiClient<AuthResponse>("/api/v1/auth/sign-up", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  signOut: () => apiClient<null>("/api/v1/auth/sign-out", { method: "POST" }),
};
