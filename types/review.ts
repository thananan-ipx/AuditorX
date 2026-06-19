export type RiskLevel = "low" | "medium" | "high" | "critical"

export type Severity = "info" | "low" | "medium" | "high" | "critical"

export type ReviewCategory =
  | "ai-smell"
  | "architecture"
  | "maintainability"
  | "security"
  | "performance"
  | "testing"

export type ReviewFinding = {
  severity: Severity
  category: ReviewCategory
  title: string
  description: string
  recommendation: string
  file: string | null
}

export type AuditorReview = {
  score: number
  riskLevel: RiskLevel
  summary: string
  findings: ReviewFinding[]
  positiveNotes: string[]
}
