package repository

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"net/mail"
	"strings"
	"time"

	"github.com/IProgressX/auditor-x/backend/internal/modules/user/entity"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

const sessionLifetime = 30 * 24 * time.Hour

type authDatabase interface {
	Begin(context.Context) (pgx.Tx, error)
}

type PostgresUserRepository struct {
	db        authDatabase
	dummyHash string
}

func NewPostgresUserRepository(db authDatabase) (*PostgresUserRepository, error) {
	dummy, err := hashPassword(context.Background(), rand.Text())
	if err != nil {
		return nil, err
	}
	return &PostgresUserRepository{db: db, dummyHash: dummy}, nil
}

func normalizedCredentials(email, password string) (string, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	if err := validateCredentials(email, password); err != nil {
		return "", err
	}
	address, err := mail.ParseAddress(email)
	if err != nil || address.Address != email {
		return "", &AuthError{Status: 400, Message: "Enter a valid email address."}
	}
	return email, nil
}

func rollbackAuth(tx pgx.Tx) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = tx.Rollback(ctx)
}

func (r *PostgresUserRepository) SignUp(ctx context.Context, email, password string) (entity.Session, error) {
	email, err := normalizedCredentials(email, password)
	if err != nil {
		return entity.Session{}, err
	}
	hash, err := hashPassword(ctx, password)
	if err != nil {
		return entity.Session{}, err
	}
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return entity.Session{}, err
	}
	defer rollbackAuth(tx)
	var user entity.User
	err = tx.QueryRow(ctx, `INSERT INTO auth.users (email,password_hash) VALUES ($1,$2) RETURNING id::text,email`, email, hash).Scan(&user.ID, &user.Email)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return entity.Session{}, &AuthError{Status: 409, Message: "An account with this email already exists."}
		}
		return entity.Session{}, err
	}
	session, err := newSession(ctx, tx, user)
	if err != nil {
		return entity.Session{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return entity.Session{}, err
	}
	return session, nil
}

func (r *PostgresUserRepository) SignIn(ctx context.Context, email, password string) (entity.Session, error) {
	email, err := normalizedCredentials(email, password)
	if err != nil {
		return entity.Session{}, err
	}
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return entity.Session{}, err
	}
	defer rollbackAuth(tx)
	var user entity.User
	var hash string
	err = tx.QueryRow(ctx, `SELECT id::text,email,password_hash FROM auth.users WHERE email=$1 AND password_hash IS NOT NULL`, email).Scan(&user.ID, &user.Email, &hash)
	if errors.Is(err, pgx.ErrNoRows) {
		_ = tx.Rollback(ctx)
		checkPassword(ctx, r.dummyHash, password)
		return entity.Session{}, invalidCredentials()
	}
	if err != nil {
		return entity.Session{}, err
	}
	// Release the database connection while performing expensive password work.
	if err := tx.Commit(ctx); err != nil {
		return entity.Session{}, err
	}
	if !checkPassword(ctx, hash, password) {
		return entity.Session{}, invalidCredentials()
	}
	tx, err = r.db.Begin(ctx)
	if err != nil {
		return entity.Session{}, err
	}
	defer rollbackAuth(tx)
	if _, err := tx.Exec(ctx, `DELETE FROM auth.sessions WHERE user_id=$1::uuid AND expires_at <= now()`, user.ID); err != nil {
		return entity.Session{}, err
	}
	session, err := newSession(ctx, tx, user)
	if err != nil {
		return entity.Session{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return entity.Session{}, err
	}
	return session, nil
}

func newSession(ctx context.Context, tx pgx.Tx, user entity.User) (entity.Session, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return entity.Session{}, err
	}
	token := base64.RawURLEncoding.EncodeToString(bytes)
	digest := sha256.Sum256([]byte(token))
	_, err := tx.Exec(ctx, `INSERT INTO auth.sessions(token_hash,user_id,expires_at) VALUES ($1,$2::uuid,$3)`, digest[:], user.ID, time.Now().Add(sessionLifetime))
	return entity.Session{AccessToken: token, ExpiresIn: int(sessionLifetime.Seconds()), User: user}, err
}

func tokenHash(token string) ([]byte, error) {
	decoded, err := base64.RawURLEncoding.DecodeString(token)
	if err != nil || len(decoded) != 32 {
		return nil, invalidCredentials()
	}
	digest := sha256.Sum256([]byte(token))
	return digest[:], nil
}

func sessionUser(ctx context.Context, tx pgx.Tx, token string) (entity.User, error) {
	hash, err := tokenHash(token)
	if err != nil {
		return entity.User{}, err
	}
	query := `SELECT u.id::text,u.email FROM auth.sessions s JOIN auth.users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.password_hash IS NOT NULL`
	var user entity.User
	err = tx.QueryRow(ctx, query, hash).Scan(&user.ID, &user.Email)
	if errors.Is(err, pgx.ErrNoRows) {
		return entity.User{}, invalidCredentials()
	}
	return user, err
}

func (r *PostgresUserRepository) User(ctx context.Context, token string) (entity.User, error) {
	if _, err := tokenHash(token); err != nil {
		return entity.User{}, err
	}
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return entity.User{}, err
	}
	defer rollbackAuth(tx)
	user, err := sessionUser(ctx, tx, token)
	if err != nil {
		return entity.User{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return entity.User{}, err
	}
	return user, nil
}

func (r *PostgresUserRepository) Refresh(ctx context.Context, token string) (entity.Session, error) {
	hash, err := tokenHash(token)
	if err != nil {
		return entity.Session{}, err
	}
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return entity.Session{}, err
	}
	defer rollbackAuth(tx)
	// DELETE acquires the row lock and consumes the old session atomically.
	// A concurrent refresh cannot reuse it, and no UPDATE grant is needed.
	var user entity.User
	err = tx.QueryRow(ctx, `WITH removed AS (
        DELETE FROM auth.sessions WHERE token_hash=$1 AND expires_at>now() RETURNING user_id
    ) SELECT u.id::text,u.email FROM removed s JOIN auth.users u ON u.id=s.user_id WHERE u.password_hash IS NOT NULL`, hash).Scan(&user.ID, &user.Email)
	if errors.Is(err, pgx.ErrNoRows) {
		return entity.Session{}, invalidCredentials()
	}
	if err != nil {
		return entity.Session{}, err
	}
	session, err := newSession(ctx, tx, user)
	if err != nil {
		return entity.Session{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return entity.Session{}, err
	}
	return session, nil
}

func (r *PostgresUserRepository) SignOut(ctx context.Context, token string) error {
	hash, err := tokenHash(token)
	if err != nil {
		return nil
	}
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollbackAuth(tx)
	if _, err := tx.Exec(ctx, `DELETE FROM auth.sessions WHERE token_hash=$1`, hash); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
