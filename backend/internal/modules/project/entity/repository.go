package entity

import (
	"errors"
	"time"
)

var (
	ErrUnauthorized = errors.New("verified user required")
	ErrNotFound     = errors.New("repository not found")
	ErrConflict     = errors.New("repository already exists")
	ErrInvalid      = errors.New("invalid repository input")
)

type Repository struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Owner       string    `json:"owner"`
	URL         string    `json:"repository_url"`
	Branch      string    `json:"branch"`
	Status      string    `json:"status"`
	CreatedBy   string    `json:"created_by"`
	AccessLevel string    `json:"access_level"`
	CreatedAt   time.Time `json:"created_at"`
}

type CreateInput struct {
	URL    string `json:"repository_url"`
	Branch string `json:"branch"`
}

// NewRepository has been validated by the service, including its canonical URL.
type NewRepository struct{ Name, Owner, URL, Branch string }
