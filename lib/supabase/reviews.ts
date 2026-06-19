import "server-only"

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"
import type { AuditorReview } from "@/types/review"

export type SaveReviewInput = {
  pullRequestId: string
  review: AuditorReview
  rawAiResponse?: unknown
  githubCommentId?: number
}

export async function insertReview(input: SaveReviewInput) {
  const supabase = createSupabaseServiceRoleClient()

  const { data, error } = await supabase
    .from("reviews")
    .insert({
      pull_request_id: input.pullRequestId,
      score: input.review.score,
      risk_level: input.review.riskLevel,
      summary: input.review.summary,
      findings: input.review.findings,
      positive_notes: input.review.positiveNotes,
      raw_ai_response: input.rawAiResponse ?? input.review,
      github_comment_id: input.githubCommentId ?? null,
    })
    .select("id")
    .single()

  if (error) {
    throw error
  }

  return data
}
