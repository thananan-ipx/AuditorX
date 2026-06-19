import type { AuditorReview } from "@/types/review"

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function formatReviewComment(
  review: AuditorReview,
  options: { truncated?: boolean } = {},
) {
  const findings =
    review.findings.length > 0
      ? review.findings
          .map((finding, index) => {
            const file = finding.file ? `\n\nFile: \`${finding.file}\`` : ""

            return `#### ${index + 1}. ${titleCase(finding.severity)} / ${titleCase(
              finding.category,
            )} / ${finding.title}${file}

${finding.description}

Recommendation:
${finding.recommendation}`
          })
          .join("\n\n")
      : "No high-signal findings in the reviewed diff."

  const positiveNotes =
    review.positiveNotes.length > 0
      ? review.positiveNotes.map((note) => `- ${note}`).join("\n")
      : "- The PR was reviewed against AuditorX MVP risk categories."

  const truncationWarning = options.truncated
    ? "\n\n> Large PR detected. AuditorX reviewed a limited subset of changed files."
    : ""

  return `## AuditorX Review

**AI Smell Score:** ${review.score}/100  
**Risk Level:** ${titleCase(review.riskLevel)}

${review.summary}${truncationWarning}

### Findings

${findings}

### Positive Notes

${positiveNotes}

---

AuditorX is an AI-powered technical debt auditor for vibe coding teams.`
}
