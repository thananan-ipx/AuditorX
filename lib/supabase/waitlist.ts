import "server-only"

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export type WaitlistInput = {
  email: string
  name?: string
  company?: string
  githubOrg?: string
}

export async function insertWaitlistEntry(input: WaitlistInput) {
  const supabase = createSupabaseServiceRoleClient()

  const { data, error } = await supabase
    .from("waitlist")
    .insert({
      email: input.email,
      name: input.name || null,
      company: input.company || null,
      github_org: input.githubOrg || null,
    })
    .select("id")
    .single()

  if (error) {
    throw error
  }

  return data
}
