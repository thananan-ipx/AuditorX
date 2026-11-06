package scan

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// Regression against the authored source project, not a production vulnerability benchmark.
func TestSemgrepNextLab(t *testing.T) {
	executable := os.Getenv("AUDITORX_TEST_SEMGREP")
	if executable == "" {
		t.Skip("set AUDITORX_TEST_SEMGREP for the authored Next.js lab")
	}
	root, err := filepath.Abs("../../../../examples/nextjs-scan-lab")
	if err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(filepath.Join(root, "cases.json"))
	if err != nil {
		t.Fatal(err)
	}
	var catalog struct {
		Cases []struct {
			Family string `json:"family"`
			Rule   string `json:"expected_rule"`
			Unsafe string `json:"unsafe_file"`
			Fixed  string `json:"fixed_file"`
		} `json:"cases"`
	}
	if err = json.Unmarshal(data, &catalog); err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	result, err := (Semgrep{Executable: executable}).Analyze(ctx, root, currentRulesVersion)
	if err != nil {
		t.Fatal(err)
	}
	matched := map[string]bool{}
	for _, f := range result.Findings {
		matched[f.File+":"+f.RuleID] = true
	}
	for _, c := range catalog.Cases {
		if !matched[c.Unsafe+":"+c.Rule] {
			t.Errorf("missing primary match: %s %s", c.Family, c.Unsafe)
		}
		if matched[c.Fixed+":"+c.Rule] && !strings.Contains(c.Rule, ".review.") {
			t.Errorf("fixed source matched security rule: %s %s", c.Family, c.Fixed)
		}
		if strings.Contains(c.Rule, ".review.") && !matched[c.Fixed+":"+c.Rule] {
			t.Errorf("review advisory unexpectedly absent from fixed source: %s", c.Fixed)
		}
	}
	if len(catalog.Cases) != 12 {
		t.Fatal("missing authored case families")
	}
	if len(result.Findings) != 25 {
		t.Errorf("unexpected finding count: got %d, want 25", len(result.Findings))
	}
	t.Logf("%d source-case pairs checked; %d real Semgrep matches across %v", len(catalog.Cases), len(result.Findings), result.SourceLanguages)
}
