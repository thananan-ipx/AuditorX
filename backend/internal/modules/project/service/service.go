package service

import (
	"context"
	"fmt"
	"net/url"
	"regexp"
	"strings"

	"github.com/IProgressX/auditor-x/backend/internal/modules/project/entity"
	"github.com/IProgressX/auditor-x/backend/internal/modules/project/repository"
	"github.com/IProgressX/auditor-x/backend/internal/shared/identity"
)

var uuidPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)
var ownerPattern = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9-]{0,38}$`)
var namePattern = regexp.MustCompile(`^[a-zA-Z0-9_.-]{1,100}$`)
var branchPattern = regexp.MustCompile(`^[a-zA-Z0-9_][a-zA-Z0-9_./-]{0,254}$`)

type Service struct{ store repository.Store }

func New(store repository.Store) *Service { return &Service{store: store} }

func actor(ctx context.Context) (string, error) {
	id := identity.UserID(ctx)
	if !uuidPattern.MatchString(id) || id == "00000000-0000-0000-0000-000000000000" {
		return "", entity.ErrUnauthorized
	}
	return strings.ToLower(id), nil
}

func (s *Service) Create(ctx context.Context, input entity.CreateInput) (entity.Repository, error) {
	userID, err := actor(ctx)
	if err != nil {
		return entity.Repository{}, err
	}
	data, err := validate(input)
	if err != nil {
		return entity.Repository{}, err
	}
	return s.store.Create(ctx, userID, data)
}

func (s *Service) List(ctx context.Context, page, pageSize int) ([]entity.Repository, error) {
	userID, err := actor(ctx)
	if err != nil {
		return nil, err
	}
	if page < 1 || page > 10000 || pageSize < 1 || pageSize > 100 {
		return nil, fmt.Errorf("%w: page must be 1..10000 and page_size 1..100", entity.ErrInvalid)
	}
	return s.store.List(ctx, userID, pageSize, (page-1)*pageSize)
}

func (s *Service) Get(ctx context.Context, id string) (entity.Repository, error) {
	userID, err := actor(ctx)
	if err != nil {
		return entity.Repository{}, err
	}
	// Do not disclose whether another user's repository exists.
	if !uuidPattern.MatchString(id) {
		return entity.Repository{}, entity.ErrNotFound
	}
	return s.store.Get(ctx, userID, id)
}

func validate(input entity.CreateInput) (entity.NewRepository, error) {
	fail := func(message string) (entity.NewRepository, error) {
		return entity.NewRepository{}, fmt.Errorf("%w: %s", entity.ErrInvalid, message)
	}
	raw := strings.TrimSpace(input.URL)
	if len(raw) > 300 {
		return fail("repository_url is too long")
	}
	u, err := url.Parse(raw)
	if err != nil || u.Scheme != "https" || strings.ToLower(u.Host) != "github.com" || u.User != nil || u.RawQuery != "" || u.ForceQuery || u.Fragment != "" || u.RawPath != "" {
		return fail("use an HTTPS github.com owner/repository URL without credentials, query or fragment")
	}
	parts := strings.Split(strings.TrimSuffix(strings.TrimPrefix(u.Path, "/"), "/"), "/")
	if len(parts) != 2 {
		return fail("use a repository URL, not a branch or file URL")
	}
	owner, name := strings.ToLower(parts[0]), strings.TrimSuffix(strings.ToLower(parts[1]), ".git")
	if !ownerPattern.MatchString(owner) || strings.HasSuffix(owner, "-") || !namePattern.MatchString(name) || name == "." || name == ".." {
		return fail("invalid GitHub owner or repository name")
	}
	branch := strings.TrimSpace(input.Branch)
	if branch == "" {
		branch = "main"
	}
	if !branchPattern.MatchString(branch) || strings.Contains(branch, "..") || strings.Contains(branch, "//") || strings.HasSuffix(branch, ".") || strings.HasSuffix(branch, "/") {
		return fail("invalid branch name")
	}
	for _, part := range strings.Split(branch, "/") {
		if strings.HasPrefix(part, ".") || strings.HasSuffix(part, ".lock") {
			return fail("invalid branch name")
		}
	}
	return entity.NewRepository{Name: name, Owner: owner, URL: "https://github.com/" + owner + "/" + name, Branch: branch}, nil
}

// ValidateInput shares canonical URL and branch validation with GitHub imports.
func ValidateInput(input entity.CreateInput) (entity.NewRepository, error) { return validate(input) }
