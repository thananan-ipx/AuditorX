package repository

import (
	"context"
	"github.com/IProgressX/auditor-x/backend/internal/modules/project/entity"
)

type Store interface {
	Create(context.Context, string, entity.NewRepository) (entity.Repository, error)
	List(context.Context, string, int, int) ([]entity.Repository, error)
	Get(context.Context, string, string) (entity.Repository, error)
}
