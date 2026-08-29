package repository

import "github.com/IProgressX/auditor-x/backend/internal/modules/audit/entity"

type AuditRepository interface {
	Repositories() []entity.Repository
	Dashboard(repositoryID string) (entity.Dashboard, bool)
	Issues(severity string) []entity.Issue
}
