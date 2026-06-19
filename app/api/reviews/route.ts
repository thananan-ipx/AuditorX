import { reviewPullRequestWithAI } from "@/lib/ai/reviewer"
import { getEnv } from "@/lib/env"
import { insertReview } from "@/lib/supabase/reviews"
import { formatReviewComment } from "@/lib/utils/format-review-comment"
import { truncateDiff } from "@/lib/utils/truncate-diff"

type ReviewRequestBody = {
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
  const authError = validateRequestAuth(req)

  if (authError) {
    return Response.json({ ok: false, error: authError }, { status: 401 })
  }

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

function validateRequestAuth(req: Request) {
  const expectedToken = getEnv("AUDITORX_API_TOKEN")

  if (!expectedToken) {
    return null
  }

  const authorization = req.headers.get("authorization")
  const token = authorization?.replace(/^Bearer\s+/i, "")

  if (token !== expectedToken) {
    return "Invalid AuditorX API token"
  }

  return null
}

function parseReviewRequest(body: ReviewRequestBody):
  | {
      ok: true
      value: {
        repoFullName: string
        pullNumber: number
        pullTitle: string
        pullUrl?: string
        diffContent: string
      }
    }
  | { ok: false; error: string } {
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
      repoFullName: body.repoFullName,
      pullNumber: body.pullNumber,
      pullTitle: body.pullTitle,
      pullUrl: body.pullUrl,
      diffContent: body.diffContent,
    },
  }
}
