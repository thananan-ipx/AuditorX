package config

import (
	"os"
	"testing"
)

func TestLoadUsesDotEnvWithoutOverridingProcess(t *testing.T) {
	t.Setenv("SCAN_QUEUE_ENABLED", "false")
	t.Chdir(t.TempDir())
	t.Setenv("PORT", "9090")
	t.Setenv("REPOSITORY_STORAGE", "prototype")
	contents := "PORT=8080\nSUPABASE_URL=https://project.supabase.co\nSUPABASE_PUBLISHABLE_KEY=sb_publishable_test\n"
	if err := os.WriteFile(".env", []byte(contents), 0o600); err != nil {
		t.Fatalf("write .env: %v", err)
	}
	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if cfg.Port != "9090" {
		t.Fatalf("Port = %q, want process value 9090", cfg.Port)
	}
}

func TestRepositoryStorageConfiguration(t *testing.T) {
	t.Setenv("SCAN_QUEUE_ENABLED", "false")
	t.Chdir(t.TempDir())
	t.Setenv("SUPABASE_URL", "https://example.supabase.co")
	t.Setenv("SUPABASE_PUBLISHABLE_KEY", "test-key")
	t.Setenv("DATABASE_URL", "")
	t.Setenv("REPOSITORY_STORAGE", "")
	cfg, err := Load()
	if err != nil || cfg.RepositoryStorage != "prototype" {
		t.Fatalf("default: %+v %v", cfg, err)
	}
	t.Setenv("REPOSITORY_STORAGE", "postgres")
	if _, err := Load(); err == nil {
		t.Fatal("postgres without database accepted")
	}
	t.Setenv("DATABASE_URL", "postgresql://localhost/auditorx_test")
	if cfg, err := Load(); err != nil || cfg.RepositoryStorage != "postgres" {
		t.Fatalf("postgres: %v", err)
	}
	t.Setenv("REPOSITORY_STORAGE", "typo")
	if _, err := Load(); err == nil {
		t.Fatal("invalid mode accepted")
	}
}

func TestScanQueueOptIn(t *testing.T) {
	t.Chdir(t.TempDir())
	t.Setenv("SUPABASE_URL", "https://example.supabase.co")
	t.Setenv("SUPABASE_PUBLISHABLE_KEY", "test-key")
	t.Setenv("DATABASE_URL", "postgresql://localhost/example")
	t.Setenv("REPOSITORY_STORAGE", "prototype")
	t.Setenv("SCAN_QUEUE_ENABLED", "")
	cfg, err := Load()
	if err != nil || cfg.ScanQueueEnabled {
		t.Fatalf("default: %+v %v", cfg, err)
	}
	t.Setenv("SCAN_QUEUE_ENABLED", "true")
	if _, err = Load(); err == nil {
		t.Fatal("scan queue accepted in demo mode")
	}
	t.Setenv("REPOSITORY_STORAGE", "postgres")
	cfg, err = Load()
	if err != nil || !cfg.ScanQueueEnabled {
		t.Fatalf("opt-in: %+v %v", cfg, err)
	}
	t.Setenv("SCAN_QUEUE_ENABLED", "invalid")
	if _, err = Load(); err == nil {
		t.Fatal("invalid queue config accepted")
	}
}

func TestLoadRequiresSupabaseConfiguration(t *testing.T) {
	t.Chdir(t.TempDir())
	t.Setenv("SUPABASE_URL", "")
	t.Setenv("SUPABASE_PUBLISHABLE_KEY", "")
	if _, err := Load(); err == nil {
		t.Fatal("Load() expected missing Supabase configuration error")
	}
}
