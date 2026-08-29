package user

import (
	"github.com/IProgressX/auditor-x/backend/internal/config"
	delivery "github.com/IProgressX/auditor-x/backend/internal/modules/user/delivery/http"
	"github.com/IProgressX/auditor-x/backend/internal/modules/user/repository"
	"github.com/IProgressX/auditor-x/backend/internal/modules/user/service"
)

func NewModule(cfg config.Config) (*delivery.Handler, error) {
	repo, err := repository.NewSupabaseUserRepository(cfg.SupabaseURL, cfg.SupabasePublishableKey)
	if err != nil {
		return nil, err
	}
	return delivery.NewHandler(service.New(repo), cfg.FrontendURL, cfg.CookieSecure, cfg.CookieDomain), nil
}
