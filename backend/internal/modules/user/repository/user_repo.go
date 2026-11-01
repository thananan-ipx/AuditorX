package repository

import (
	"context"

	"github.com/IProgressX/auditor-x/backend/internal/modules/user/entity"
)

type UserRepository interface {
	SignIn(context.Context, string, string) (entity.Session, error)
	SignUp(context.Context, string, string) (entity.Session, error)
	Refresh(context.Context, string) (entity.Session, error)
	User(context.Context, string) (entity.User, error)
	SignOut(context.Context, string) error
}

type AuthError struct {
	Status  int
	Message string
}

func (e *AuthError) Error() string { return e.Message }
