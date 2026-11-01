package user

import (
	"errors"
	"github.com/IProgressX/auditor-x/backend/internal/config"
	delivery "github.com/IProgressX/auditor-x/backend/internal/modules/user/delivery/http"
	"github.com/IProgressX/auditor-x/backend/internal/modules/user/repository"
	"github.com/IProgressX/auditor-x/backend/internal/modules/user/service"
	"github.com/IProgressX/auditor-x/backend/internal/shared/database"
)

func NewModule(cfg config.Config, pool *database.Pool) (*delivery.Handler, error) {
	if pool == nil {
		return nil, errors.New("local accounts require a database")
	}
	repo, err := repository.NewPostgresUserRepository(pool)
	if err != nil {
		return nil, err
	}
	return delivery.NewHandler(service.New(repo), cfg.FrontendURL, cfg.CookieSecure, cfg.CookieDomain), nil
}
