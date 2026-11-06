package scan

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"testing"
)

func TestNormalizeLocalPath(t *testing.T) {
	root := `C:\Users\thana\Documents\GitHub\IProgressX`
	for _, input := range []string{"crm-new-idea-front", root + `\crm-new-idea-front`, `"` + root + `\crm-new-idea-front"`, "c:/users/thana/documents/github/iprogressx/crm-new-idea-front"} {
		got, ok := normalizeLocalPath(input, root)
		if !ok || got != "crm-new-idea-front" {
			t.Fatalf("%q: %q %v", input, got, ok)
		}
	}
	for _, input := range []string{root + `-other\project`, `C:\elsewhere\project`, root + `\..\private`, `/etc/passwd`, `..\private`} {
		if _, ok := normalizeLocalPath(input, root); ok {
			t.Fatalf("accepted %q", input)
		}
	}
	if _, ok := normalizeLocalPath(root+`\project`, ""); ok {
		t.Fatal("absolute path accepted without configured mapping")
	}
}

func TestLocalSourceSnapshot(t *testing.T) {
	root := t.TempDir()
	project := filepath.Join(root, "project")
	if err := os.MkdirAll(filepath.Join(project, "node_modules"), 0700); err != nil {
		t.Fatal(err)
	}
	for name, data := range map[string]string{"app.ts": "eval(input)", "package.json": `{"dependencies":{"next":"1"},"scripts":{"postinstall":"bad"}}`, ".env": "SECRET=private", "node_modules/large.js": "ignored"} {
		if err := os.WriteFile(filepath.Join(project, filepath.FromSlash(name)), []byte(data), 0600); err != nil {
			t.Fatal(err)
		}
	}
	name := "project"
	dest := t.TempDir()
	digest, err := (LocalSource{Root: root}).Fetch(context.Background(), Job{SourceName: &name}, dest)
	if err != nil || !uploadDigestPattern.MatchString(digest) {
		t.Fatalf("digest %q: %v", digest, err)
	}
	if _, err := os.Stat(filepath.Join(dest, "app.ts")); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{".env", "node_modules/large.js"} {
		if _, err := os.Stat(filepath.Join(dest, name)); !os.IsNotExist(err) {
			t.Fatalf("copied excluded %s", name)
		}
	}
	data, _ := os.ReadFile(filepath.Join(dest, "package.json"))
	if string(data) != string(sanitizedManifest([]byte(`{"dependencies":{"next":"1"}}`))) {
		t.Fatalf("unsanitized manifest: %s", data)
	}
	again, err := (LocalSource{Root: root}).Fetch(context.Background(), Job{SourceName: &name}, t.TempDir())
	if err != nil || again != digest {
		t.Fatalf("unstable snapshot digest: %v", err)
	}
	for _, bad := range []string{"../project", "/project", `C:\project`, "project/../other", ".git", "node_modules", ""} {
		if _, err := (LocalSource{Root: root}).Fetch(context.Background(), Job{SourceName: &bad}, t.TempDir()); err == nil {
			t.Fatalf("accepted %q", bad)
		}
	}
}

func TestLocalSourceSymlinkEscape(t *testing.T) {
	root, outside := t.TempDir(), t.TempDir()
	if err := os.Symlink(outside, filepath.Join(root, "escape")); err != nil {
		t.Skip("symlink permission unavailable")
	}
	name := "escape"
	if _, err := (LocalSource{Root: root}).Fetch(context.Background(), Job{SourceName: &name}, t.TempDir()); err == nil {
		t.Fatal("accepted escaping symlink")
	}
}

func TestLocalSourceFileLimit(t *testing.T) {
	root := t.TempDir()
	if err := os.Mkdir(filepath.Join(root, "project"), 0700); err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 1135; i++ {
		if err := os.WriteFile(filepath.Join(root, "project", fmt.Sprintf("file%d.ts", i)), []byte("export {};"), 0600); err != nil {
			t.Fatal(err)
		}
	}
	name := "project"
	if _, err := (LocalSource{Root: root}).Fetch(context.Background(), Job{SourceName: &name}, t.TempDir()); err != nil {
		t.Fatalf("1135-file project rejected: %v", err)
	}
	for i := 1135; i < 2001; i++ {
		if err := os.WriteFile(filepath.Join(root, "project", fmt.Sprintf("file%d.ts", i)), []byte("export {};"), 0600); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := (LocalSource{Root: root}).Fetch(context.Background(), Job{SourceName: &name}, t.TempDir()); err == nil {
		t.Fatal("file limit was not enforced")
	}
}
