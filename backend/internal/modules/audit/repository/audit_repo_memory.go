package repository

import (
	"strings"
	"time"

	"github.com/IProgressX/auditor-x/backend/internal/modules/audit/entity"
)

type MemoryAuditRepository struct {
	repositories []entity.Repository
	dashboards   map[string]entity.Dashboard
	issues       []entity.Issue
}

func NewMemoryAuditRepository() *MemoryAuditRepository {
	now := time.Date(2026, time.August, 10, 4, 28, 0, 0, time.UTC)
	repo := entity.Repository{ID: "repo-001", Name: "auditor-x", Owner: "IProgressX", Branch: "main", PrimaryLanguage: "TypeScript", Status: "Healthy"}
	return &MemoryAuditRepository{
		repositories: []entity.Repository{repo},
		dashboards: map[string]entity.Dashboard{repo.ID: {
			Repository:    repo,
			LatestScan:    entity.Scan{ID: "scan-024", Status: "Completed", Branch: "main", CommitSHA: "a7c91f2", CompletedAt: now.Add(-42 * time.Minute)},
			QualityScore:  entity.QualityScore{Value: 82.5, Version: "quality-v1", CalculatedAt: now.Add(-41 * time.Minute)},
			Issues:        entity.IssueBreakdown{Total: 17, BySeverity: map[string]int{"Critical": 0, "High": 2, "Medium": 7, "Low": 8}, ByPriority: map[string]int{"Critical": 1, "High": 4, "Medium": 8, "Low": 4}, ByCategory: map[string]int{"Security": 4, "Code quality": 6, "Coding standard": 3, "Best practice": 4}},
			Trend:         []entity.TrendPoint{{Date: "Jul 14", QualityScore: 68, IssueCount: 31}, {Date: "Jul 21", QualityScore: 72, IssueCount: 27}, {Date: "Jul 28", QualityScore: 75, IssueCount: 24}, {Date: "Aug 04", QualityScore: 79, IssueCount: 20}, {Date: "Aug 10", QualityScore: 82.5, IssueCount: 17}},
			AISummary:     entity.AISummary{Status: "Completed", Summary: "Repository quality is improving. Authentication boundaries need the most immediate attention, while recent refactoring has reduced maintainability findings.", MajorRisks: []string{"User-controlled redirect is not restricted to trusted hosts", "Two handlers bypass the shared authorization middleware"}, RecommendedPriorities: []string{"Fix open redirect before the next release", "Consolidate permission checks in the repository service"}, PositiveObservations: []string{"Issue count decreased 15% since the previous scan", "No critical-severity static findings were detected"}, ConfidenceNote: "Based on the latest completed scan and persisted priority predictions."},
			PriorityModel: entity.PriorityModel{Source: "model", Version: "priority-model-v1", FallbackCount: 1},
		}},
		issues: []entity.Issue{
			{ID: "issue-101", Title: "Unvalidated redirect target", RuleID: "security.open-redirect", Severity: "High", Priority: "Critical", Category: "Security", File: "internal/auth/callback.go", Line: 84, Status: "Open", Confidence: 0.94},
			{ID: "issue-102", Title: "Authorization middleware is bypassed", RuleID: "auth.missing-guard", Severity: "High", Priority: "High", Category: "Security", File: "internal/report/handler.go", Line: 42, Status: "Open", Confidence: 0.88},
			{ID: "issue-103", Title: "Function exceeds complexity threshold", RuleID: "quality.cyclomatic-complexity", Severity: "Medium", Priority: "High", Category: "Code quality", File: "internal/scan/service.go", Line: 117, Status: "In progress", Confidence: 0.81},
			{ID: "issue-104", Title: "Error return value is ignored", RuleID: "go.unchecked-error", Severity: "Medium", Priority: "Medium", Category: "Best practice", File: "internal/repository/clone.go", Line: 63, Status: "Open", Confidence: 0.76},
			{ID: "issue-105", Title: "Duplicate validation logic", RuleID: "quality.duplicate-branch", Severity: "Low", Priority: "Medium", Category: "Code quality", File: "internal/user/service.go", Line: 95, Status: "Open", Confidence: 0.71},
		},
	}
}

func (r *MemoryAuditRepository) Repositories() []entity.Repository {
	return append([]entity.Repository(nil), r.repositories...)
}
func (r *MemoryAuditRepository) Dashboard(id string) (entity.Dashboard, bool) {
	dashboard, ok := r.dashboards[id]
	return dashboard, ok
}
func (r *MemoryAuditRepository) Issues(severity string) []entity.Issue {
	severity = strings.ToLower(strings.TrimSpace(severity))
	filtered := make([]entity.Issue, 0, len(r.issues))
	for _, issue := range r.issues {
		if severity == "" || strings.ToLower(issue.Severity) == severity {
			filtered = append(filtered, issue)
		}
	}
	return filtered
}
