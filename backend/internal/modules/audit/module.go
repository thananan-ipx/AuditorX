package audit

import (
	delivery "github.com/IProgressX/auditor-x/backend/internal/modules/audit/delivery/http"
	"github.com/IProgressX/auditor-x/backend/internal/modules/audit/repository"
	"github.com/IProgressX/auditor-x/backend/internal/modules/audit/service"
)

func NewModule() *delivery.Handler {
	return delivery.NewHandler(service.New(repository.NewMemoryAuditRepository()))
}
