package entity

import "time"

type Repository struct {
	ID              string `json:"id"`
	Name            string `json:"name"`
	Owner           string `json:"owner"`
	Branch          string `json:"branch"`
	PrimaryLanguage string `json:"primary_language"`
	Status          string `json:"status"`
}
type Scan struct {
	ID          string    `json:"id"`
	Status      string    `json:"status"`
	Branch      string    `json:"branch"`
	CommitSHA   string    `json:"commit_sha"`
	CompletedAt time.Time `json:"completed_at"`
}
type QualityScore struct {
	Value        float64   `json:"value"`
	Version      string    `json:"version"`
	CalculatedAt time.Time `json:"calculated_at"`
}
type IssueBreakdown struct {
	Total      int            `json:"total"`
	BySeverity map[string]int `json:"by_severity"`
	ByPriority map[string]int `json:"by_priority"`
	ByCategory map[string]int `json:"by_category"`
}
type TrendPoint struct {
	Date         string  `json:"date"`
	QualityScore float64 `json:"quality_score"`
	IssueCount   int     `json:"issue_count"`
}
type AISummary struct {
	Status                string   `json:"status"`
	Summary               string   `json:"summary"`
	MajorRisks            []string `json:"major_risks"`
	RecommendedPriorities []string `json:"recommended_priorities"`
	PositiveObservations  []string `json:"positive_observations"`
	ConfidenceNote        string   `json:"confidence_note"`
}
type PriorityModel struct {
	Source        string `json:"source"`
	Version       string `json:"version"`
	FallbackCount int    `json:"fallback_count"`
}
type Dashboard struct {
	Repository    Repository     `json:"repository"`
	LatestScan    Scan           `json:"latest_scan"`
	QualityScore  QualityScore   `json:"quality_score"`
	Issues        IssueBreakdown `json:"issues"`
	Trend         []TrendPoint   `json:"trend"`
	AISummary     AISummary      `json:"ai_summary"`
	PriorityModel PriorityModel  `json:"priority_model"`
}
type Issue struct {
	ID         string  `json:"id"`
	Title      string  `json:"title"`
	RuleID     string  `json:"rule_id"`
	Severity   string  `json:"severity"`
	Priority   string  `json:"priority"`
	Category   string  `json:"category"`
	File       string  `json:"file"`
	Line       int     `json:"line"`
	Status     string  `json:"status"`
	Confidence float64 `json:"confidence"`
}
