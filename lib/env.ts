type EnvKey =
  | "NEXT_PUBLIC_APP_URL"
  | "SUPABASE_URL"
  | "SUPABASE_ANON_KEY"
  | "SUPABASE_SERVICE_ROLE_KEY"
  | "AUDITORX_API_TOKEN"
  | "AI_REVIEW_MODE"
  | "OPENAI_API_KEY"
  | "ANTHROPIC_API_KEY"

const serverEnvKeys: EnvKey[] = [
  "NEXT_PUBLIC_APP_URL",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "AUDITORX_API_TOKEN",
]

export function getEnv(key: EnvKey) {
  return process.env[key]
}

export function getRequiredEnv(key: EnvKey) {
  const value = getEnv(key)

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }

  return value
}

export function validateServerEnv() {
  const missing = serverEnvKeys.filter((key) => !getEnv(key))
  const usesMockAi = getEnv("AI_REVIEW_MODE") === "mock"
  const hasAiKey = Boolean(getEnv("OPENAI_API_KEY") || getEnv("ANTHROPIC_API_KEY"))

  return {
    ok: missing.length === 0 && (usesMockAi || hasAiKey),
    missing:
      usesMockAi || hasAiKey
        ? missing
        : [...missing, "OPENAI_API_KEY or ANTHROPIC_API_KEY"],
  }
}
