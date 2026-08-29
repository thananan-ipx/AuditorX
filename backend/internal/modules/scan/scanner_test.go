package scan

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func archive(t *testing.T, files map[string]string, symlink bool) []byte {
	t.Helper()
	var output bytes.Buffer
	writer := zip.NewWriter(&output)
	for name, content := range files {
		header := &zip.FileHeader{Name: name, Method: zip.Deflate}
		if symlink {
			header.SetMode(os.ModeSymlink | 0777)
		}
		entry, err := writer.CreateHeader(header)
		if err != nil {
			t.Fatal(err)
		}
		if _, err = entry.Write([]byte(content)); err != nil {
			t.Fatal(err)
		}
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	return output.Bytes()
}
func TestExtractSource(t *testing.T) {
	root := t.TempDir()
	data := archive(t, map[string]string{"repo/app.py": "eval('x')", "repo/.semgrepignore": "*", "repo/node_modules/a.js": "eval(x)"}, false)
	if err := extractSource(data, root); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(root, "app.py")); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(root, ".semgrepignore")); !os.IsNotExist(err) {
		t.Fatal("repository config copied")
	}
	if _, err := os.Stat(filepath.Join(root, "node_modules")); !os.IsNotExist(err) {
		t.Fatal("dependency files copied")
	}
}
func TestExtractRejectsUnsafeArchives(t *testing.T) {
	for _, name := range []string{"../escape.py", "/absolute.py", "repo/../../escape.py", "repo/a\\b.py", "repo/C:evil.py", "repo/CON.py", "repo/dir./a.py"} {
		t.Run(name, func(t *testing.T) {
			if err := extractSource(archive(t, map[string]string{name: "x"}, false), t.TempDir()); err == nil {
				t.Fatal("unsafe archive accepted")
			}
		})
	}
	for name, files := range map[string]map[string]string{
		"duplicate":   {"repo/A.py": "x", "repo/a.py": "y"},
		"roots":       {"repo/a.py": "x", "other/b.py": "y"},
		"oversize":    {"repo/big.py": strings.Repeat("x", maxFileBytes+1)},
		"unsupported": {"repo/readme.txt": "nothing"},
	} {
		t.Run(name, func(t *testing.T) {
			if err := extractSource(archive(t, files, false), t.TempDir()); err == nil {
				t.Fatal("invalid archive accepted")
			}
		})
	}
	if err := extractSource(archive(t, map[string]string{"repo/link.py": "/outside"}, true), t.TempDir()); err == nil {
		t.Fatal("symlink accepted")
	}
}

func TestSemgrepParser(t *testing.T) {
	finding := map[string]any{"check_id": "auditorx.python.dynamic-eval", "path": "app.py", "start": map[string]int{"line": 3}, "end": map[string]int{"line": 3}, "extra": map[string]string{"message": "Avoid dynamic eval", "severity": "ERROR"}}
	encode := func(version string, items []any, errs []any) []byte {
		data, _ := json.Marshal(map[string]any{"version": version, "results": items, "errors": errs})
		return data
	}
	result, err := parseFindings(encode("1.175.0", []any{finding, finding}, []any{}))
	if err != nil || len(result.Findings) != 1 || result.Findings[0].Severity != "High" {
		t.Fatalf("%+v %v", result, err)
	}
	for _, data := range [][]byte{[]byte(`{}`), []byte(`bad json`), encode("old", []any{}, nil), encode("1.175.0", []any{}, []any{"parse failure"})} {
		if _, err := parseFindings(data); err == nil {
			t.Fatal("invalid result accepted")
		}
	}
	finding["path"] = "../secret.py"
	if _, err := parseFindings(encode("1.175.0", []any{finding}, nil)); err == nil {
		t.Fatal("path escape accepted")
	}
}

func TestSemgrepFixture(t *testing.T) {
	executable := os.Getenv("AUDITORX_TEST_SEMGREP")
	if executable == "" {
		t.Skip("set AUDITORX_TEST_SEMGREP to installed Semgrep 1.175.0 executable")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()
	fixture, err := filepath.Abs("testdata/fixture")
	if err != nil {
		t.Fatal(err)
	}
	result, err := (Semgrep{Executable: executable}).Analyze(ctx, fixture)
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Findings) != 1 || result.Findings[0].RuleID != "auditorx.python.dynamic-eval" || result.Findings[0].File != "app.py" || result.Findings[0].Line != 3 {
		t.Fatalf("unexpected real result: %+v", result)
	}
	t.Logf("Semgrep %s found %s at %s:%d", result.ScannerVersion, result.Findings[0].RuleID, result.Findings[0].File, result.Findings[0].Line)
}
