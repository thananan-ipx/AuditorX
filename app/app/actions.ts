"use server"

import { revalidatePath } from "next/cache"

import { requireUser } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createProjectApiToken, hashProjectApiToken } from "@/lib/tokens"

export type ProjectActionState = {
  ok: boolean
  message: string
  projectId?: string
  projectName?: string
  repoFullName?: string
  apiToken?: string
}

export async function createProject(
  _state: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const user = await requireUser()
  const name = String(formData.get("name") ?? "").trim()
  const repoFullName = String(formData.get("repoFullName") ?? "").trim()

  if (!name || !repoFullName.includes("/")) {
    return {
      ok: false,
      message: "Project name and repo full name like owner/repo are required.",
    }
  }

  const apiToken = createProjectApiToken()
  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from("projects")
    .insert({
      owner_user_id: user.id,
      name,
      repo_full_name: repoFullName,
      api_token_hash: hashProjectApiToken(apiToken),
    })
    .select("id,name,repo_full_name")
    .single()

  if (error) {
    return {
      ok: false,
      message: error.message,
    }
  }

  await supabase.from("project_members").insert({
    project_id: data.id,
    user_id: user.id,
    role: "owner",
  })

  revalidatePath("/app/projects")

  return {
    ok: true,
    message: "Project created. Copy this token now; it will not be shown again.",
    projectId: data.id,
    projectName: data.name,
    repoFullName: data.repo_full_name,
    apiToken,
  }
}

export async function rotateProjectToken(
  _state: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  await requireUser()
  const projectId = String(formData.get("projectId") ?? "")
  const apiToken = createProjectApiToken()
  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from("projects")
    .update({ api_token_hash: hashProjectApiToken(apiToken) })
    .eq("id", projectId)
    .select("id,name,repo_full_name")
    .single()

  if (error) {
    return { ok: false, message: error.message }
  }

  return {
    ok: true,
    message: "New token generated. Update the GitHub secret with this value.",
    projectId: data.id,
    projectName: data.name,
    repoFullName: data.repo_full_name,
    apiToken,
  }
}
