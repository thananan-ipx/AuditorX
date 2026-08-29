import { apiClient } from "@/lib/api-client";

type AuthResponse = { requires_email_confirmation?: boolean } | null;

export const authService = {
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
