package scan

import (
	"context"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

func TestLanguageScopeUsesSourceFilesNotFindings(t *testing.T) {
	for _, test := range []struct {
		name      string
		files     []string
		languages []string
		count     int
	}{
		{"go-only", []string{"main.go"}, []string{"go"}, 4},
		{"python-without-findings", []string{"app.py"}, []string{"python"}, 5},
		{"typescript-only", []string{"src/view.tsx"}, []string{"typescript"}, 5},
		{"javascript-only", []string{"src/view.jsx"}, []string{"javascript"}, 5},
		{"mixed", []string{"main.go", "scripts/app.py"}, []string{"go", "python"}, 9},
	} {
		t.Run(test.name, func(t *testing.T) {
			root := t.TempDir()
			for _, name := range append(test.files, "node_modules/ignore.js", "vendor/ignore.py", ".git/ignore.ts") {
				target := filepath.Join(root, filepath.FromSlash(name))
				if err := os.MkdirAll(filepath.Dir(target), 0700); err != nil {
					t.Fatal(err)
				}
				if err := os.WriteFile(target, []byte("// static fixture"), 0600); err != nil {
					t.Fatal(err)
				}
			}
			languages, err := sourceLanguages(context.Background(), root)
			if err != nil || !reflect.DeepEqual(languages, test.languages) {
				t.Fatalf("languages=%v err=%v", languages, err)
			}
			config, ids, err := scopedRules("baseline-v2", languages)
			if err != nil || len(ids) != test.count {
				t.Fatalf("selected rules=%v err=%v", ids, err)
			}
			for _, language := range []string{"go", "python", "javascript", "typescript"} {
				want := false
				for _, actual := range test.languages {
					want = want || actual == language
				}
				if strings.Contains(string(config), "languages: ["+language+"]") != want {
					t.Fatalf("unexpected %s config:\n%s", language, config)
				}
			}
			if test.name == "go-only" && (strings.Contains(string(config), "auditorx.python.") || strings.Contains(string(config), "auditorx.javascript.")) {
				t.Fatal("unrelated rules sent to Semgrep")
			}
		})
	}
}
func TestScopeRequiresSupportedSourceAndReviewedRules(t *testing.T) {
	if _, err := sourceLanguages(context.Background(), t.TempDir()); err == nil {
		t.Fatal("empty source accepted")
	}
	if _, _, err := scopedRules("unknown", []string{"go"}); err == nil {
		t.Fatal("unknown version accepted")
	}
	if _, _, err := scopedRules("baseline-v2", []string{"ruby"}); err == nil {
		t.Fatal("unsupported language accepted")
	}
	_, ids, err := scopedRules("baseline-v1", []string{"go"})
	if err != nil || !reflect.DeepEqual(ids, []string{"auditorx.go.tls-verification-disabled"}) {
		t.Fatalf("historical rules: %v %v", ids, err)
	}
}
