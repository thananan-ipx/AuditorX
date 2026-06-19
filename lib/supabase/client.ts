import { createClient } from "@supabase/supabase-js"

import { getRequiredEnv } from "@/lib/env"

export function createSupabaseBrowserClient() {
  return createClient(
    getRequiredEnv("SUPABASE_URL"),
    getRequiredEnv("SUPABASE_ANON_KEY"),
  )
}
