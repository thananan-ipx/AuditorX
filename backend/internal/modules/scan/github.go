package scan

import (
	"context"
	"errors"
	"net/url"
	"strconv"
	"time"

	"github.com/IProgressX/auditor-x/backend/internal/shared/github"
)

// ConnectedGitHubSource uses the requester's GitHub App user token, never an
// installation-wide credential. Both GitHub and AuditorX must grant access.
type ConnectedGitHubSource struct {
	Store  *Store
	Client *github.Client
	Key    []byte
}

func (s ConnectedGitHubSource) Fetch(ctx context.Context, j Job, destination string) (string, error) {
	tx, err := s.Store.begin(ctx, "", true)
	if err != nil {
		return "", err
	}
	defer rollback(tx)
	var repoID, installationID int64
	var accountID *int64
	var encrypted []byte
	var expires *time.Time
	err = tx.QueryRow(ctx, `SELECT github_id,installation_id,account_id,token_ciphertext,token_expires_at FROM public.github_scan_credential($1::uuid,$2::uuid)`, j.ID, j.LeaseToken).Scan(&repoID, &installationID, &accountID, &encrypted, &expires)
	if err != nil {
		return "", err
	}
	if err = tx.Commit(ctx); err != nil {
		return "", err
	}
	if repoID == 0 {
		return (GitHubSource{}).Fetch(ctx, j, destination)
	}
	if accountID == nil || len(encrypted) == 0 || expires != nil && time.Until(*expires) < time.Minute || len(s.Key) != 32 {
		return "", github.ErrAccess
	}
	token, err := github.Open(s.Key, encrypted, *accountID)
	if err != nil {
		return "", github.ErrAccess
	}
	// Revalidate installation selection on every scan, including public repos.
	found := false
	for page := 1; page <= 100 && !found; page++ {
		var out struct {
			Repositories []github.Repository `json:"repositories"`
		}
		err = s.Client.Get(ctx, token, "/user/installations/"+strconv.FormatInt(installationID, 10)+"/repositories?per_page=100&page="+strconv.Itoa(page), &out)
		if err != nil {
			return "", err
		}
		for _, repo := range out.Repositories {
			if repo.ID == repoID {
				found = true
				break
			}
		}
		if len(out.Repositories) < 100 {
			break
		}
	}
	if !found {
		return "", github.ErrAccess
	}
	repo, err := s.Client.Repository(ctx, token, repoID)
	if err != nil {
		return "", err
	}
	path, err := repo.Path()
	if err != nil {
		return "", err
	}
	// Numeric upstream identity prevents a renamed/recreated URL from replacing
	// the imported repository. Branch and commit are resolved afresh for each job.
	if !sourceBranchPattern.MatchString(j.Branch) {
		return "", errors.New("invalid source branch")
	}
	var commit struct {
		SHA string `json:"sha"`
	}
	if err = s.Client.Get(ctx, token, path+"/commits/"+url.PathEscape(j.Branch), &commit); err != nil || !shaPattern.MatchString(commit.SHA) {
		return "", github.ErrAccess
	}
	archive, err := s.Client.Archive(ctx, token, path, commit.SHA, maxArchiveBytes)
	if err != nil {
		return "", err
	}
	if err = extractSource(archive, destination); err != nil {
		return "", err
	}
	return commit.SHA, nil
}
