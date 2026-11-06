package scan

import (
	"context"
	"os"
	"path/filepath"
	"reflect"
	"strconv"
	"strings"
	"testing"
	"time"
)

func TestGoV4ScopeAndHistoricalRules(t *testing.T) {
	for _, version := range []string{"baseline-v2", "baseline-v3", "baseline-v4"} {
		config, ids, err := scopedRules(version, []string{"go"})
		if err != nil || len(ids) != 4 {
			t.Fatalf("%s: ids=%v error=%v", version, ids, err)
		}
		if strings.Contains(string(config), "const $KEY") != (version == "baseline-v4") {
			t.Fatalf("%s: historical constant-secret behavior changed", version)
		}
	}
	// Only Go changes in v4. Other languages retain v3's exact rule bodies.
	old, oldIDs, err := scopedRules("baseline-v3", []string{"python", "javascript", "typescript"}, "app/page.tsx")
	if err != nil {
		t.Fatal(err)
	}
	current, currentIDs, err := scopedRules("baseline-v4", []string{"python", "javascript", "typescript"}, "app/page.tsx")
	if err != nil || string(old) != string(current) || !reflect.DeepEqual(oldIDs, currentIDs) {
		t.Fatalf("non-Go rules changed: %v", err)
	}
}

func TestSemgrepGoRulesV4(t *testing.T) {
	executable := os.Getenv("AUDITORX_TEST_SEMGREP")
	if executable == "" {
		t.Skip("set AUDITORX_TEST_SEMGREP for real Go rule regression tests")
	}
	root, err := filepath.Abs("testdata/go-v4")
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	result, err := (Semgrep{Executable: executable}).Analyze(ctx, root, "baseline-v4")
	if err != nil {
		t.Fatal(err)
	}
	// Every match must sit immediately below its explicit ruleid annotation.
	data, err := os.ReadFile(filepath.Join(root, "checks.go"))
	if err != nil {
		t.Fatal(err)
	}
	lines := strings.Split(string(data), "\n")
	want := map[string]int{}
	for i, line := range lines {
		if _, id, found := strings.Cut(line, "// ruleid: "); found {
			want[id+":"+strconv.Itoa(i+2)]++
		}
	}
	got := map[string]int{}
	for _, f := range result.Findings {
		got[f.RuleID+":"+strconv.Itoa(f.Line)]++
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got %v; want %v", got, want)
	}
	if len(result.CheckedRuleIDs) != 4 {
		t.Fatalf("unexpected Go scope: %v", result.CheckedRuleIDs)
	}
}
