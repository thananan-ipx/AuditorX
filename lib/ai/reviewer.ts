import type { AuditorReview } from "@/types/review"

type ReviewPullRequestInput = {
  repoFullName: string
  pullNumber: number
  pullTitle: string
  diffContent: string
}

export async function reviewPullRequestWithAI(
  input: ReviewPullRequestInput,
): Promise<AuditorReview> {
  if (process.env.AI_REVIEW_MODE !== "mock") {
    // Keep the MVP cost-safe until the real provider implementation is added.
    console.warn("AI_REVIEW_MODE is not mock, falling back to mock reviewer.")
  }

  return createMockReview(input)
}

function createMockReview(input: ReviewPullRequestInput): AuditorReview {
  const hasTests = /test|spec|__tests__|describe\(|it\(/i.test(input.diffContent)
  const hasSequentialAwait = /for\s*\([^)]*\)\s*{[\s\S]{0,400}await\s/i.test(
    input.diffContent,
  )
  const hasDangerousHtml = /dangerouslySetInnerHTML|innerHTML\s*=/i.test(
    input.diffContent,
  )

  const findings: AuditorReview["findings"] = []

  if (!hasTests) {
    findings.push({
      severity: "medium",
      category: "testing",
      title: "No obvious test coverage in the reviewed diff",
      description:
        "The diff does not appear to include tests near the changed behavior. This can make AI-generated regressions harder to catch before merge.",
      recommendation:
        "Add focused tests for the main success path and one failure or edge path touched by this PR.",
      file: null,
    })
  }

  if (hasSequentialAwait) {
    findings.push({
      severity: "medium",
      category: "performance",
      title: "Possible sequential await inside a loop",
      description:
        "The diff includes a loop with an await nearby, which can turn independent work into a slow serial operation.",
      recommendation:
        "If each operation is independent, collect promises and await them with Promise.all or add an explicit concurrency limit.",
      file: null,
    })
  }

  if (hasDangerousHtml) {
    findings.push({
      severity: "high",
      category: "security",
      title: "Unsafe HTML rendering pattern detected",
      description:
        "The diff references direct HTML injection. This can create cross-site scripting risk if the content is not sanitized.",
      recommendation:
        "Avoid direct HTML injection, or sanitize trusted content at the boundary before rendering.",
      file: null,
    })
  }

  const score = Math.max(55, 90 - findings.length * 12)
  const riskLevel = score >= 75 ? "low" : score >= 50 ? "medium" : "high"

  return {
    score,
    riskLevel,
    summary: `Mock review for ${input.repoFullName} PR #${input.pullNumber}: ${input.pullTitle}. AuditorX reviewed the submitted diff for MVP risk signals.`,
    findings,
    positiveNotes: [
      "The PR diff was small enough for the MVP review path.",
      "This mock mode lets the team test the GitHub Action flow without AI API cost.",
    ],
  }
}
