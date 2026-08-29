package database

import (
	"net/url"
	"testing"
)

func TestRequireTLSAddsSSLMode(t *testing.T) {
	connectionString, err := requireTLS("postgresql://postgres:secret@example.supabase.co:5432/postgres")
	if err != nil {
		t.Fatalf("requireTLS returned an error: %v", err)
	}
	parsed, _ := url.Parse(connectionString)
	if got := parsed.Query().Get("sslmode"); got != "require" {
		t.Fatalf("expected sslmode=require, got %q", got)
	}
}

func TestRequireTLSPreservesStricterMode(t *testing.T) {
	connectionString, err := requireTLS("postgresql://postgres:secret@example.supabase.co:5432/postgres?sslmode=verify-full")
	if err != nil {
		t.Fatalf("requireTLS returned an error: %v", err)
	}
	parsed, _ := url.Parse(connectionString)
	if got := parsed.Query().Get("sslmode"); got != "verify-full" {
		t.Fatalf("expected sslmode=verify-full, got %q", got)
	}
}

func TestRequireTLSRejectsInvalidScheme(t *testing.T) {
	if _, err := requireTLS("https://example.com/database"); err == nil {
		t.Fatal("expected invalid scheme to be rejected")
	}
}
