import { createBrowserClient } from "@supabase/ssr"

import { getRequiredEnv } from "@/lib/env"

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    getRequiredEnv("SUPABASE_URL"),
    getRequiredEnv("SUPABASE_ANON_KEY"),
  )
}
