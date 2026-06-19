import "server-only"

import { createSupabaseServerClient } from "@/lib/supabase/server"

export type Project = {
  id: string
  name: string
  repo_full_name: string
  created_at: string
}

export type ProjectReview = {
  id: string
  project_id: string | null
  repo_full_name: string
  pull_number: number
  pull_title: string | null
  pull_url: string | null
  score: number | null
  risk_level: string | null
  summary: string | null
  findings: unknown
  positive_notes: unknown
  created_at: string
}

export async function listProjectsForCurrentUser() {
  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from("projects")
    .select("id,name,repo_full_name,created_at")
    .order("created_at", { ascending: false })

  if (error) {
    throw error
  }

  return data satisfies Project[]
}

export async function getProjectForCurrentUser(projectId: string) {
  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from("projects")
    .select("id,name,repo_full_name,created_at")
    .eq("id", projectId)
    .single()

  if (error) {
    return null
  }

  return data as Project
}

export async function listReviewsForProject(projectId: string) {
  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from("reviews")
    .select(
      "id,project_id,repo_full_name,pull_number,pull_title,pull_url,score,risk_level,summary,findings,positive_notes,created_at",
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(25)

  if (error) {
    throw error
  }

  return data as ProjectReview[]
}
