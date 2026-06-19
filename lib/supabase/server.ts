import "server-only"

import { createClient } from "@supabase/supabase-js"

import { getRequiredEnv } from "@/lib/env"

export function createSupabaseServerClient() {
  return createClient(
    getRequiredEnv("SUPABASE_URL"),
    getRequiredEnv("SUPABASE_ANON_KEY"),
    {
      auth: {
        persistSession: false,
      },
    },
  )
}

export function createSupabaseServiceRoleClient() {
  return createClient(
    getRequiredEnv("SUPABASE_URL"),
    getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        persistSession: false,
      },
    },
  )
}
