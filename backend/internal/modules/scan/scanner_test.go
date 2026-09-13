package scan

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
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
	data := archive(t, map[string]string{"repo/app.py": "eval('x')", "repo/view.jsx": "eval(x)", "repo/page.tsx": "eval(x)", "repo/.semgrepignore": "*", "repo/node_modules/a.js": "eval(x)"}, false)
	if err := extractSource(data, root); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(root, "app.py")); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"view.jsx", "page.tsx"} {
		if _, err := os.Stat(filepath.Join(root, name)); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := os.Stat(filepath.Join(root, ".semgrepignore")); !os.IsNotExist(err) {
		t.Fatal("repository config copied")
	}
	if _, err := os.Stat(filepath.Join(root, "node_modules")); !os.IsNotExist(err) {
		t.Fatal("dependency files copied")
	}
}

func TestExtractUploadedSourceAndDigest(t *testing.T) {
	for name, files := range map[string]map[string]string{
		"rootless": {"app.py": "print('safe')", "src/view.tsx": "export const View = () => <div />"},
		"wrapped":  {"project/app.py": "print('safe')"},
	} {
		t.Run(name, func(t *testing.T) {
			data := archive(t, files, false)
			root := t.TempDir()
			if err := extractUploadedSource(data, root); err != nil {
				t.Fatal(err)
			}
			if _, err := os.Stat(filepath.Join(root, "app.py")); err != nil {
				t.Fatal(err)
			}
			digestBytes := sha256.Sum256(data)
			digest := hex.EncodeToString(digestBytes[:])
			job := Job{SourceKind: "upload", SourceDigest: &digest, Archive: data}
			if got, err := (JobSource{}).Fetch(context.Background(), job, t.TempDir()); err != nil || got != digest {
				t.Fatalf("digest/source=%q/%v", got, err)
			}
			job.Archive = append([]byte(nil), data...)
			job.Archive[len(job.Archive)-1] ^= 1
			if _, err := (JobSource{}).Fetch(context.Background(), job, t.TempDir()); err == nil {
				t.Fatal("tampered upload accepted")
			}
		})
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
	result, err := parseFindings(encode("1.175.0", []any{finding, finding}, []any{}), "baseline-v1")
	if err != nil || len(result.Findings) != 1 || result.Findings[0].Severity != "High" {
		t.Fatalf("%+v %v", result, err)
	}
	for _, data := range [][]byte{[]byte(`{}`), []byte(`bad json`), encode("old", []any{}, nil), encode("1.175.0", []any{}, []any{"parse failure"})} {
		if _, err := parseFindings(data, "baseline-v1"); err == nil {
			t.Fatal("invalid result accepted")
		}
	}
	partialParsing := map[string]any{
		"code":  3,
		"level": "warn",
		"type":  []any{"PartialParsing", []any{map[string]any{"path": "view.tsx"}}},
	}
	if _, err := parseFindings(encode("1.175.0", []any{}, []any{partialParsing}), "baseline-v2"); err != nil {
		t.Fatalf("warning-level partial parsing rejected: %v", err)
	}
	for _, diagnostic := range []any{
		map[string]any{"code": 3, "level": "error", "type": []any{"PartialParsing"}},
		map[string]any{"code": 3, "level": "warn", "type": []any{"OtherWarning"}},
	} {
		if _, err := parseFindings(encode("1.175.0", []any{}, []any{diagnostic}), "baseline-v2"); err == nil {
			t.Fatal("non-recoverable scanner diagnostic accepted")
		}
	}
	finding["path"] = "../secret.py"
	if _, err := parseFindings(encode("1.175.0", []any{finding}, nil), "baseline-v1"); err == nil {
		t.Fatal("path escape accepted")
	}
	if _, err := parseFindings(encode("1.175.0", []any{}, nil), "unknown"); err == nil {
		t.Fatal("unknown rules version accepted")
	}
	warning := map[string]any{"check_id": "auditorx.go.code-quality.unhandled-json-error", "path": "app.go", "start": map[string]int{"line": 8}, "end": map[string]int{"line": 8}, "extra": map[string]string{"message": "Handle the error", "severity": "WARNING"}}
	result, err = parseFindings(encode("1.175.0", []any{warning}, nil), "baseline-v2")
	if err != nil || len(result.Findings) != 1 || result.Findings[0].Severity != "Medium" {
		t.Fatalf("warning mapping: %+v %v", result, err)
	}
	warning["check_id"] = "auditorx.unreviewed-rule"
	if _, err := parseFindings(encode("1.175.0", []any{warning}, nil), "baseline-v2"); err == nil {
		t.Fatal("unreviewed baseline-v2 rule accepted")
	}
}

func TestSemgrepFixture(t *testing.T) {
	executable := os.Getenv("AUDITORX_TEST_SEMGREP")
	if executable == "" {
		t.Skip("set AUDITORX_TEST_SEMGREP to installed Semgrep 1.175.0 executable")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	fixture, err := filepath.Abs("testdata/fixture")
	if err != nil {
		t.Fatal(err)
	}
	for version, rule := range map[string]string{
		"baseline-v1": "auditorx.python.dynamic-eval",
		"baseline-v2": "auditorx.python.security.dynamic-eval",
	} {
		result, analyzeErr := (Semgrep{Executable: executable}).Analyze(ctx, fixture, version)
		if analyzeErr != nil {
			t.Fatal(analyzeErr)
		}
		if len(result.Findings) != 1 || result.Findings[0].RuleID != rule || result.Findings[0].File != "app.py" || result.Findings[0].Line != 3 {
			t.Fatalf("unexpected %s result: %+v", version, result)
		}
		t.Logf("Semgrep %s ran %s and found %s at %s:%d", result.ScannerVersion, version, result.Findings[0].RuleID, result.Findings[0].File, result.Findings[0].Line)
	}
}

func TestSemgrepRuleCatalog(t *testing.T) {
	executable := os.Getenv("AUDITORX_TEST_SEMGREP")
	if executable == "" {
		t.Skip("set AUDITORX_TEST_SEMGREP to installed Semgrep 1.175.0 executable")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()
	fixture, err := filepath.Abs("testdata/rules")
	if err != nil {
		t.Fatal(err)
	}
	result, err := (Semgrep{Executable: executable}).Analyze(ctx, fixture, currentRulesVersion)
	if err != nil {
		t.Fatal(err)
	}
	want := map[string]int{
		"auditorx.python.security.dynamic-eval":                   1,
		"auditorx.javascript.security.dynamic-eval":               1,
		"auditorx.go.security.tls-verification-disabled":          1,
		"auditorx.python.security.hardcoded-secret":               1,
		"auditorx.javascript.security.hardcoded-secret":           1,
		"auditorx.go.security.hardcoded-secret":                   1,
		"auditorx.python.security.shell-command-execution":        1,
		"auditorx.javascript.security.shell-command-execution":    1,
		"auditorx.python.security.sql-string-construction":        1,
		"auditorx.javascript.security.sql-template-interpolation": 1,
		"auditorx.python.coding-standard.sensitive-logging":       1,
		"auditorx.javascript.coding-standard.sensitive-logging":   1,
		"auditorx.go.coding-standard.sensitive-logging":           1,
		"auditorx.go.code-quality.unhandled-json-error":           1,
	}
	got := map[string]int{}
	for _, finding := range result.Findings {
		got[finding.RuleID]++
	}
	if len(got) != len(want) {
		t.Fatalf("unexpected rule set: got=%v want=%v", got, want)
	}
	for rule, count := range want {
		if got[rule] != count {
			t.Errorf("%s: got %d findings, want %d", rule, got[rule], count)
		}
	}
}
