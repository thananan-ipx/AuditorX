package githubconnect

import (
	"context"
	"crypto/sha256"
	"errors"
	"time"

	projectrepo "github.com/IProgressX/auditor-x/backend/internal/modules/project/repository"
	"github.com/IProgressX/auditor-x/backend/internal/shared/github"
	"github.com/jackc/pgx/v5"
)

type Store struct {
	DB  projectrepo.Beginner
	Key []byte
}
type oauthState struct {
	Actor    string
	Verifier string
	Next     string
}

func digest(s string) []byte { d := sha256.Sum256([]byte(s)); return d[:] }
func rollback(tx pgx.Tx) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = tx.Rollback(ctx)
}

func (s Store) SaveState(ctx context.Context, state, browser string, flow oauthState) error {
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollback(tx)
	if _, err = tx.Exec(ctx, `DELETE FROM auth.github_oauth_states WHERE expires_at<now()`); err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `INSERT INTO auth.github_oauth_states(state_hash,browser_hash,actor_id,verifier,next_path) VALUES($1,$2,nullif($3,'')::uuid,$4,$5)`, digest(state), digest(browser), flow.Actor, flow.Verifier, flow.Next)
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}
func (s Store) ConsumeState(ctx context.Context, state, browser string) (oauthState, error) {
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return oauthState{}, err
	}
	defer rollback(tx)
	var flow oauthState
	err = tx.QueryRow(ctx, `DELETE FROM auth.github_oauth_states WHERE state_hash=$1 AND browser_hash=$2 AND expires_at>now() RETURNING coalesce(actor_id::text,''),verifier,next_path`, digest(state), digest(browser)).Scan(&flow.Actor, &flow.Verifier, &flow.Next)
	if err != nil {
		return flow, err
	}
	return flow, tx.Commit(ctx)
}

type Connection struct {
	Connected bool       `json:"connected"`
	Login     string     `json:"login,omitempty"`
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
	Reconnect bool       `json:"reconnect"`
}

func (s Store) Connection(ctx context.Context, actor string) (Connection, error) {
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return Connection{}, err
	}
	defer rollback(tx)
	var c Connection
	err = tx.QueryRow(ctx, `SELECT login,token_expires_at FROM auth.github_accounts WHERE user_id=$1::uuid AND octet_length(token_ciphertext)>0`, actor).Scan(&c.Login, &c.ExpiresAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return c, nil
	}
	if err != nil {
		return c, err
	}
	c.Connected = true
	c.Reconnect = c.ExpiresAt != nil && time.Until(*c.ExpiresAt) < time.Minute
	return c, tx.Commit(ctx)
}
func (s Store) Token(ctx context.Context, actor string) (string, error) {
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer rollback(tx)
	var id int64
	var ciphertext []byte
	var expires *time.Time
	err = tx.QueryRow(ctx, `SELECT github_id,token_ciphertext,token_expires_at FROM auth.github_accounts WHERE user_id=$1::uuid`, actor).Scan(&id, &ciphertext, &expires)
	if err != nil || expires != nil && time.Until(*expires) < time.Minute {
		return "", github.ErrAccess
	}
	if err = tx.Commit(ctx); err != nil {
		return "", err
	}
	return github.Open(s.Key, ciphertext, id)
}
func (s Store) Disconnect(ctx context.Context, actor string) error {
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollback(tx)
	// Preserve the sign-in identity so GitHub-only accounts can sign in again.
	_, err = tx.Exec(ctx, `UPDATE auth.github_accounts SET token_ciphertext=''::bytea,token_expires_at=now() WHERE user_id=$1::uuid`, actor)
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}
