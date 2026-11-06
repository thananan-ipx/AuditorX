package repository

import (
	"context"
	"errors"
	"net/mail"
	"strings"
	"time"

	"github.com/IProgressX/auditor-x/backend/internal/modules/user/entity"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// GitHubSession never links accounts by email. Linking requires the actor's
// existing verified session; sign-in resolves the immutable GitHub numeric ID.
func (r *PostgresUserRepository) GitHubSession(ctx context.Context, actor string, githubID int64, login, verifiedEmail string, ciphertext []byte, expires *time.Time) (entity.Session, error) {
	if githubID <= 0 || login == "" || len(login) > 100 || len(ciphertext) == 0 {
		return entity.Session{}, &AuthError{Status: 400, Message: "A valid GitHub identity is required."}
	}
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return entity.Session{}, err
	}
	defer rollbackAuth(tx)
	var user entity.User
	err = tx.QueryRow(ctx, `SELECT u.id::text,u.email FROM auth.github_accounts g JOIN auth.users u ON u.id=g.user_id WHERE g.github_id=$1`, githubID).Scan(&user.ID, &user.Email)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return entity.Session{}, err
	}
	if actor != "" {
		if err == nil && user.ID != actor {
			return entity.Session{}, &AuthError{Status: 409, Message: "This GitHub account is already connected to another account."}
		}
		// Serialize links without granting the API permission to update password hashes.
		if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, actor); err != nil {
			return entity.Session{}, err
		}
		if err = tx.QueryRow(ctx, `SELECT id::text,email FROM auth.users WHERE id=$1::uuid AND email IS NOT NULL`, actor).Scan(&user.ID, &user.Email); err != nil {
			return entity.Session{}, err
		}
		var existing int64
		e := tx.QueryRow(ctx, `SELECT github_id FROM auth.github_accounts WHERE user_id=$1::uuid`, actor).Scan(&existing)
		if e == nil && existing != githubID {
			return entity.Session{}, &AuthError{Status: 409, Message: "This account is linked to a different GitHub identity. Reconnect the original GitHub account."}
		}
		if e != nil && !errors.Is(e, pgx.ErrNoRows) {
			return entity.Session{}, e
		}
	} else if errors.Is(err, pgx.ErrNoRows) {
		email := strings.ToLower(strings.TrimSpace(verifiedEmail))
		address, emailError := mail.ParseAddress(email)
		if emailError != nil || address.Address != email || len(email) > 254 {
			return entity.Session{}, &AuthError{Status: 400, Message: "A verified GitHub email is required to create an account."}
		}
		err = tx.QueryRow(ctx, `INSERT INTO auth.users(email) VALUES($1) RETURNING id::text,email`, email).Scan(&user.ID, &user.Email)
		if err != nil {
			return entity.Session{}, githubAccountError(err)
		}
	}
	updated, err := tx.Exec(ctx, `INSERT INTO auth.github_accounts(user_id,github_id,login,token_ciphertext,token_expires_at) VALUES($1::uuid,$2,$3,$4,$5)
 ON CONFLICT(user_id) DO UPDATE SET login=excluded.login,token_ciphertext=excluded.token_ciphertext,token_expires_at=excluded.token_expires_at,connected_at=now() WHERE auth.github_accounts.github_id=excluded.github_id`, user.ID, githubID, login, ciphertext, expires)
	if err != nil {
		return entity.Session{}, githubAccountError(err)
	}
	if updated.RowsAffected() != 1 {
		return entity.Session{}, &AuthError{Status: 409, Message: "GitHub identity changed. Please sign in again."}
	}
	session, err := newSession(ctx, tx, user)
	if err != nil {
		return entity.Session{}, err
	}
	return session, tx.Commit(ctx)
}

func githubAccountError(err error) error {
	var p *pgconn.PgError
	if errors.As(err, &p) && p.Code == "23505" {
		return &AuthError{Status: 409, Message: "Sign in to your existing account and connect GitHub from Repositories."}
	}
	return err
}
