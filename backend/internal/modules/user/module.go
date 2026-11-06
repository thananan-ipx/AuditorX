package user

import (
	"errors"
	"github.com/IProgressX/auditor-x/backend/internal/config"
	"github.com/IProgressX/auditor-x/backend/internal/modules/githubconnect"
	projectrepo "github.com/IProgressX/auditor-x/backend/internal/modules/project/repository"
	delivery "github.com/IProgressX/auditor-x/backend/internal/modules/user/delivery/http"
	"github.com/IProgressX/auditor-x/backend/internal/modules/user/repository"
	"github.com/IProgressX/auditor-x/backend/internal/modules/user/service"
	"github.com/IProgressX/auditor-x/backend/internal/shared/database"
	"github.com/IProgressX/auditor-x/backend/internal/shared/github"
)

func NewModule(cfg config.Config, pool *database.Pool) (*delivery.Handler, error) {
	if pool == nil {
		return nil, errors.New("local accounts require a database")
	}
	repo, err := repository.NewPostgresUserRepository(pool)
	if err != nil {
		return nil, err
	}
	h := delivery.NewHandler(service.New(repo), cfg.FrontendURL, cfg.CookieSecure, cfg.CookieDomain)
	gh := &githubconnect.Handler{Config: cfg.GitHub, FrontendURL: cfg.FrontendURL, CookieSecure: cfg.CookieSecure,
		Store: githubconnect.Store{DB: pool, Key: cfg.GitHub.EncryptionKey}, Client: github.NewClient(), Users: repo,
		Repositories: projectrepo.NewPostgres(pool), Authenticate: h.Authenticate, SetSession: h.SetSessionCookie}
	gh.LimitAuth = delivery.NewAuthLimiter()
	h.ExtraRoutes = gh.RegisterRoutes
	return h, nil
}
