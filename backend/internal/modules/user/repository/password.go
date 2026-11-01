package repository

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"strings"
	"unicode/utf8"

	"golang.org/x/crypto/argon2"
)

const passwordPrefix = "$argon2id$v=19$m=19456,t=2,p=1$"

// Bound concurrent password work to ~76 MiB per API process.
var passwordSlots = make(chan struct{}, 4)

func hashPassword(ctx context.Context, password string) (string, error) {
	select {
	case passwordSlots <- struct{}{}:
		defer func() { <-passwordSlots }()
	case <-ctx.Done():
		return "", ctx.Err()
	}
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	key := argon2.IDKey([]byte(password), salt, 2, 19456, 1, 32)
	return passwordPrefix + base64.RawStdEncoding.EncodeToString(salt) + "$" + base64.RawStdEncoding.EncodeToString(key), nil
}

func checkPassword(ctx context.Context, encoded, password string) bool {
	// Only accept our bounded cost profile; malformed database values cannot
	// request unbounded memory or CPU through arbitrary PHC parameters.
	if !strings.HasPrefix(encoded, passwordPrefix) {
		return false
	}
	parts := strings.Split(strings.TrimPrefix(encoded, passwordPrefix), "$")
	if len(parts) != 2 {
		return false
	}
	salt, err := base64.RawStdEncoding.DecodeString(parts[0])
	if err != nil || len(salt) != 16 {
		return false
	}
	expected, err := base64.RawStdEncoding.DecodeString(parts[1])
	if err != nil || len(expected) != 32 {
		return false
	}
	select {
	case passwordSlots <- struct{}{}:
		defer func() { <-passwordSlots }()
	case <-ctx.Done():
		return false
	}
	actual := argon2.IDKey([]byte(password), salt, 2, 19456, 1, 32)
	return subtle.ConstantTimeCompare(actual, expected) == 1
}

func invalidCredentials() error {
	return &AuthError{Status: 401, Message: "Invalid email or password."}
}

func validateCredentials(email, password string) error {
	length := utf8.RuneCountInString(password)
	if email == "" || len(email) > 254 || length < 8 || length > 128 || len(password) > 512 {
		return &AuthError{Status: 400, Message: "Enter a valid email and a password between 8 and 128 characters."}
	}
	return nil
}
