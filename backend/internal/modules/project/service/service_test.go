package service

import (
	"context"
	"errors"
	"testing"

	"github.com/IProgressX/auditor-x/backend/internal/modules/project/entity"
	"github.com/IProgressX/auditor-x/backend/internal/shared/identity"
)

const alice = "11111111-1111-4111-8111-111111111111"

type recordingStore struct {
	actor         string
	input         entity.NewRepository
	limit, offset int
}

func (r *recordingStore) Create(_ context.Context, actor string, input entity.NewRepository) (entity.Repository, error) {
	r.actor, r.input = actor, input
	return entity.Repository{CreatedBy: actor}, nil
}
func (r *recordingStore) List(_ context.Context, actor string, limit, offset int) ([]entity.Repository, error) {
	r.actor, r.limit, r.offset = actor, limit, offset
	return []entity.Repository{}, nil
}
func (r *recordingStore) Get(_ context.Context, actor, id string) (entity.Repository, error) {
	r.actor = actor
	return entity.Repository{ID: id}, nil
}

func TestCreateUsesVerifiedActorAndCanonicalURL(t *testing.T) {
	store := &recordingStore{}
	_, err := New(store).Create(identity.WithUserID(context.Background(), alice), entity.CreateInput{URL: " https://github.com/IProgressX/Auditor-X.git/ "})
	if err != nil {
		t.Fatal(err)
	}
	if store.actor != alice || store.input.URL != "https://github.com/iprogressx/auditor-x" || store.input.Branch != "main" {
		t.Fatalf("unexpected store input: %+v", store)
	}
}

func TestRejectsInvalidURLsAndBranches(t *testing.T) {
	cases := []entity.CreateInput{
		{URL: "http://github.com/org/repo"}, {URL: "https://github.com.evil.test/org/repo"},
		{URL: "https://user:token@github.com/org/repo"}, {URL: "https://github.com:443/org/repo"},
		{URL: "https://github.com/org/repo/tree/main"}, {URL: "https://github.com/org/repo?token=secret"},
		{URL: "https://github.com/org/repo#main"}, {URL: "https://github.com/org/%2e%2e"},
		{URL: "file:///tmp/repo"}, {URL: "https://127.0.0.1/org/repo"},
		{URL: "https://github.com/org/repo", Branch: "--upload-pack=evil"},
		{URL: "https://github.com/org/repo", Branch: "feature/../main"},
		{URL: "https://github.com/org/repo", Branch: "feature/.private"},
		{URL: "https://github.com/org/repo", Branch: "feature/x.lock/y"},
		{URL: "https://github.com/org/repo", Branch: "main; touch file"},
	}
	for _, input := range cases {
		t.Run(input.URL+input.Branch, func(t *testing.T) {
			store := &recordingStore{}
			_, err := New(store).Create(identity.WithUserID(context.Background(), alice), input)
			if !errors.Is(err, entity.ErrInvalid) || store.actor != "" {
				t.Fatalf("expected invalid before store, got %v", err)
			}
		})
	}
}

func TestMissingIdentityNeverReachesStore(t *testing.T) {
	s := New(&recordingStore{})
	if _, err := s.Create(context.Background(), entity.CreateInput{}); !errors.Is(err, entity.ErrUnauthorized) {
		t.Fatal(err)
	}
	if _, err := s.List(context.Background(), 1, 20); !errors.Is(err, entity.ErrUnauthorized) {
		t.Fatal(err)
	}
	if _, err := s.Get(context.Background(), alice); !errors.Is(err, entity.ErrUnauthorized) {
		t.Fatal(err)
	}
}

func TestPaginationBoundedAndScoped(t *testing.T) {
	store := &recordingStore{}
	s := New(store)
	ctx := identity.WithUserID(context.Background(), alice)
	if _, err := s.List(ctx, 3, 10); err != nil {
		t.Fatal(err)
	}
	if store.actor != alice || store.limit != 10 || store.offset != 20 {
		t.Fatalf("bad pagination: %+v", store)
	}
	for _, pair := range [][2]int{{0, 20}, {1, 0}, {1, 101}, {10001, 20}} {
		if _, err := s.List(ctx, pair[0], pair[1]); !errors.Is(err, entity.ErrInvalid) {
			t.Fatal(err)
		}
	}
}
