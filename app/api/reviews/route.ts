import { reviewPullRequestWithAI } from "@/lib/ai/reviewer"
import { getEnv } from "@/lib/env"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"
import { insertReview } from "@/lib/supabase/reviews"
import { hashProjectApiToken } from "@/lib/tokens"
import { formatReviewComment } from "@/lib/utils/format-review-comment"
import { truncateDiff } from "@/lib/utils/truncate-diff"

type ReviewRequestBody = {
  projectId?: unknown
  repoFullName?: unknown
  pullNumber?: unknown
  pullTitle?: unknown
  pullUrl?: unknown
  diffContent?: unknown
}

export async function GET() {
  return Response.json({
    ok: true,
    service: "AuditorX reviews API",
    accepts: "POST",
    auth: getEnv("AUDITORX_API_TOKEN") ? "required" : "not configured",
    aiMode: getEnv("AI_REVIEW_MODE") || "mock",
  })
}

export async function POST(req: Request) {
  let body: ReviewRequestBody

  try {
    body = await req.json()
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = parseReviewRequest(body)

  if (!parsed.ok) {
    return Response.json({ ok: false, error: parsed.error }, { status: 400 })
  }

  const projectAuth = await validateRequestAuth(req, parsed.value)

  if (!projectAuth.ok) {
    return Response.json({ ok: false, error: projectAuth.error }, { status: 401 })
  }

  const diff = truncateDiff(parsed.value.diffContent)
  const review = await reviewPullRequestWithAI({
    repoFullName: parsed.value.repoFullName,
    pullNumber: parsed.value.pullNumber,
    pullTitle: parsed.value.pullTitle,
    diffContent: diff.content,
  })
  const comment = formatReviewComment(review, { truncated: diff.truncated })

  try {
    await insertReview({
      projectId: projectAuth.projectId,
      repoFullName: parsed.value.repoFullName,
      pullNumber: parsed.value.pullNumber,
      pullTitle: parsed.value.pullTitle,
      pullUrl: parsed.value.pullUrl,
      review,
      rawAiResponse: review,
    })
  } catch (error) {
    console.error("Review insert failed", error)
  }

  return Response.json({
    ok: true,
    review,
    comment,
    truncated: diff.truncated,
  })
}

async function validateRequestAuth(
  req: Request,
  parsed: {
    projectId?: string
    repoFullName: string
  },
): Promise<{ ok: true; projectId?: string } | { ok: false; error: string }> {
  const authorization = req.headers.get("authorization")
  const token = authorization?.replace(/^Bearer\s+/i, "")

  if (parsed.projectId) {
    if (!token) {
      return { ok: false, error: "Missing project API token" }
    }

    const supabase = createSupabaseServiceRoleClient()
    const { data, error } = await supabase
      .from("projects")
      .select("id,repo_full_name,api_token_hash")
      .eq("id", parsed.projectId)
      .single()

    if (error || !data) {
      return { ok: false, error: "Project not found" }
    }

    if (data.repo_full_name !== parsed.repoFullName) {
      return { ok: false, error: "Repository does not match project" }
    }

    if (data.api_token_hash !== hashProjectApiToken(token)) {
      return { ok: false, error: "Invalid project API token" }
    }

    return { ok: true, projectId: data.id }
  }

  const expectedToken = getEnv("AUDITORX_API_TOKEN")
  if (!expectedToken) {
    return { ok: true }
  }

  if (token !== expectedToken) {
    return { ok: false, error: "Invalid AuditorX API token" }
  }

  return { ok: true }
}

function parseReviewRequest(body: ReviewRequestBody):
  | {
      ok: true
      value: {
        projectId?: string
        repoFullName: string
        pullNumber: number
        pullTitle: string
        pullUrl?: string
        diffContent: string
      }
    }
  | { ok: false; error: string } {
  if (body.projectId !== undefined && typeof body.projectId !== "string") {
    return { ok: false, error: "projectId must be a string when provided" }
  }

  if (typeof body.repoFullName !== "string" || !body.repoFullName.includes("/")) {
    return { ok: false, error: "repoFullName is required" }
  }

  if (typeof body.pullNumber !== "number" || !Number.isInteger(body.pullNumber)) {
    return { ok: false, error: "pullNumber must be an integer" }
  }

  if (typeof body.pullTitle !== "string" || !body.pullTitle.trim()) {
    return { ok: false, error: "pullTitle is required" }
  }

  if (typeof body.diffContent !== "string" || !body.diffContent.trim()) {
    return { ok: false, error: "diffContent is required" }
  }

  if (body.pullUrl !== undefined && typeof body.pullUrl !== "string") {
    return { ok: false, error: "pullUrl must be a string when provided" }
  }

  return {
    ok: true,
    value: {
      projectId: body.projectId,
      repoFullName: body.repoFullName,
      pullNumber: body.pullNumber,
      pullTitle: body.pullTitle,
      pullUrl: body.pullUrl,
      diffContent: body.diffContent,
    },
  }
}
