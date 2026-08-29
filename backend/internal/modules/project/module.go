// Package project owns persisted repository metadata and repository membership.
package project

import (
	delivery "github.com/IProgressX/auditor-x/backend/internal/modules/project/delivery/http"
	"github.com/IProgressX/auditor-x/backend/internal/modules/project/repository"
	"github.com/IProgressX/auditor-x/backend/internal/modules/project/service"
)

func NewModule(db repository.Beginner) *delivery.Handler {
	return delivery.NewHandler(service.New(repository.NewPostgres(db)))
}
