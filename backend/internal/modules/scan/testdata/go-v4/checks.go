package fixture

import (
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"log/slog"
	"os"
)

func check(auth interface {
	Login(string, string)
	Verify(string)
}, value any) error {
	password := os.Getenv("PASSWORD")
	// ok: auditorx.go.coding-standard.sensitive-logging
	auth.Login("user", password)
	// ok: auditorx.go.coding-standard.sensitive-logging
	auth.Verify(password)
	// ok: auditorx.go.coding-standard.sensitive-logging
	log.Print("signed in")
	// ruleid: auditorx.go.coding-standard.sensitive-logging
	log.Printf("credential: %s", password)
	// ruleid: auditorx.go.coding-standard.sensitive-logging
	slog.Info("credential", "password", password)
	// ruleid: auditorx.go.coding-standard.sensitive-logging
	fmt.Fprintf(os.Stdout, "%s", password)
	// ruleid: auditorx.go.security.hardcoded-secret
	const apiKey = "fixture-not-real-key"
	_ = apiKey
	// ruleid: auditorx.go.security.tls-verification-disabled
	_ = tls.Config{InsecureSkipVerify: true}
	// ok: auditorx.go.security.tls-verification-disabled
	_ = tls.Config{InsecureSkipVerify: false}
	// ruleid: auditorx.go.code-quality.unhandled-json-error
	json.NewEncoder(os.Stdout).Encode(value)
	// ruleid: auditorx.go.code-quality.unhandled-json-error
	_ = json.NewEncoder(os.Stdout).Encode(value)
	// ruleid: auditorx.go.code-quality.unhandled-json-error
	_ = json.NewDecoder(os.Stdin).Decode(&value)
	// ok: auditorx.go.code-quality.unhandled-json-error
	if err := json.NewDecoder(os.Stdin).Decode(&value); err != nil {
		return err
	}
	// ok: auditorx.go.code-quality.unhandled-json-error
	err := json.NewEncoder(os.Stdout).Encode(value)
	if err != nil {
		return err
	}
	// ok: auditorx.go.code-quality.unhandled-json-error
	return json.NewEncoder(io.Discard).Encode(value)
}
