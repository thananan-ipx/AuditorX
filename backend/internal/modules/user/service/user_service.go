package service

import (
	"context"

	"github.com/IProgressX/auditor-x/backend/internal/modules/user/entity"
	"github.com/IProgressX/auditor-x/backend/internal/modules/user/repository"
)

type UserService struct{ repository repository.UserRepository }

func New(repo repository.UserRepository) *UserService { return &UserService{repository: repo} }
func (s *UserService) SignIn(ctx context.Context, email, password string) (entity.Session, error) {
	return s.repository.SignIn(ctx, email, password)
}
func (s *UserService) SignUp(ctx context.Context, email, password string) (entity.Session, error) {
	return s.repository.SignUp(ctx, email, password)
}
func (s *UserService) Refresh(ctx context.Context, refreshToken string) (entity.Session, error) {
	return s.repository.Refresh(ctx, refreshToken)
}
func (s *UserService) User(ctx context.Context, accessToken string) (entity.User, error) {
	return s.repository.User(ctx, accessToken)
}
func (s *UserService) SignOut(ctx context.Context, accessToken string) error {
	return s.repository.SignOut(ctx, accessToken)
}
