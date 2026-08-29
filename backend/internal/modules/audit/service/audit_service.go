package service

import (
	"strings"

	"github.com/IProgressX/auditor-x/backend/internal/modules/audit/entity"
	"github.com/IProgressX/auditor-x/backend/internal/modules/audit/repository"
)

type AuditService struct{ repository repository.AuditRepository }

func New(repo repository.AuditRepository) *AuditService   { return &AuditService{repository: repo} }
func (s *AuditService) Repositories() []entity.Repository { return s.repository.Repositories() }
func (s *AuditService) Dashboard(id string) (entity.Dashboard, bool) {
	return s.repository.Dashboard(id)
}
func (s *AuditService) Issues(severity string) []entity.Issue { return s.repository.Issues(severity) }
func (s *AuditService) StartScan(repositoryID, branch string) (entity.Scan, bool) {
	dashboard, ok := s.repository.Dashboard(repositoryID)
	if !ok {
		return entity.Scan{}, false
	}
	if strings.TrimSpace(branch) == "" {
		branch = dashboard.Repository.Branch
	}
	return entity.Scan{ID: "scan-prototype-025", Status: "Pending", Branch: branch, CommitSHA: "pending"}, true
}
