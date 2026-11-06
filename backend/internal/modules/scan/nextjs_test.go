package scan

import (
	"context"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"
)

func TestNextDetectionUsesNearestManifest(t *testing.T) {
	root := t.TempDir()
	files := map[string]string{
		"package.json":                `{"workspaces":["apps/*"]}`,
		"apps/web/package.json":       `{"dependencies":{"next":"16.3.0"}}`,
		"apps/web/app/page.tsx":       "export default function Page() { return <p>ok</p> }",
		"apps/web/tools/package.json": `{"dependencies":{"react":"19"}}`,
		"apps/web/tools/check.ts":     "export const check = true;",
		"apps/react/package.json":     `{"dependencies":{"react":"19"}}`,
		"apps/react/page.tsx":         "export default function Page() { return <p>ok</p> }",
	}
	for name, data := range files {
		target := filepath.Join(root, filepath.FromSlash(name))
		if err := os.MkdirAll(filepath.Dir(target), 0700); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(target, []byte(data), 0600); err != nil {
			t.Fatal(err)
		}
	}
	targets, err := nextjsTargets(context.Background(), root)
	if err != nil || !reflect.DeepEqual(targets, []string{"apps/web/app/page.tsx"}) {
		t.Fatalf("targets=%v error=%v", targets, err)
	}
	config, ids, err := scopedRules("baseline-v3", []string{"typescript"}, targets...)
	if err != nil || len(ids) != 11 {
		t.Fatalf("rules=%v error=%v", ids, err)
	}
	if !strings.Contains(string(config), `- "apps/web/app/page.tsx"`) || strings.Contains(string(config), "apps/react/page.tsx") {
		t.Fatal("Next rules escaped package boundary")
	}
	_, ids, err = scopedRules("baseline-v3", []string{"typescript"})
	if err != nil || len(ids) != 5 {
		t.Fatal("React project enabled Next rules")
	}
}

func TestExtractionKeepsOnlySanitizedFrameworkMarkers(t *testing.T) {
	for _, wrapped := range []bool{false, true} {
		root := t.TempDir()
		files := map[string]string{"repo/package.json": `{"dependencies":{"next":"16.3.0"},"scripts":{"install":"DO_NOT_RUN"},"privateToken":"DO_NOT_KEEP"}`, "repo/page.tsx": "export default () => <p>ok</p>", "repo/node_modules/next/package.json": `{"name":"next"}`, "repo/.env": "DO_NOT_KEEP"}
		data := archive(t, files, false)
		var err error
		if wrapped {
			err = extractSource(data, root)
		} else {
			err = extractUploadedSource(data, root)
		}
		if err != nil {
			t.Fatal(err)
		}
		manifest, err := os.ReadFile(filepath.Join(root, "package.json"))
		if err != nil || !declaresNext(manifest) || strings.Contains(string(manifest), "DO_NOT") {
			t.Fatalf("unsafe or missing manifest: %s %v", manifest, err)
		}
	}
	if declaresNext([]byte(`{"name":"next","scripts":{"next":"next dev"}}`)) {
		t.Fatal("package name/script mistaken for dependency")
	}
	if declaresNext([]byte(`{"dependencies":{"next":false}}`)) {
		t.Fatal("invalid dependency mistaken for Next")
	}
	if err := extractUploadedSource(archive(t, map[string]string{"package.json": `{"dependencies":{"next":"16"}}`}, false), t.TempDir()); err == nil {
		t.Fatal("manifest-only upload accepted as source")
	}
}

func TestSemgrepNextJS(t *testing.T) {
	executable := os.Getenv("AUDITORX_TEST_SEMGREP")
	if executable == "" {
		t.Skip("set AUDITORX_TEST_SEMGREP for the real Next.js scanner test")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	root, err := filepath.Abs("testdata/nextjs")
	if err != nil {
		t.Fatal(err)
	}
	result, err := (Semgrep{Executable: executable}).Analyze(ctx, root, "baseline-v3")
	if err != nil {
		t.Fatal(err)
	}
	counts := map[string]int{}
	for _, finding := range result.Findings {
		if strings.HasPrefix(filepath.Base(finding.File), "safe") || strings.HasPrefix(finding.File, "react/") {
			t.Errorf("safe/non-Next file reported: %+v", finding)
		}
		if strings.HasPrefix(finding.RuleID, "auditorx.nextjs.") {
			counts[finding.RuleID]++
		}
	}
	for _, id := range []string{"request-html", "public-secret", "client-server-import", "request-redirect"} {
		if counts["auditorx.nextjs.security."+id] == 0 {
			t.Errorf("missing Next security rule: %s; got %v", id, counts)
		}
	}
	dynamic := false
	for _, finding := range result.Findings {
		if finding.File == "app/[id]/page.tsx" && finding.RuleID == "auditorx.nextjs.security.public-secret" {
			dynamic = true
		}
	}
	if !dynamic {
		t.Fatal("dynamic-route brackets prevented the Next rule from running")
	}
	for _, id := range []string{"request-html", "request-redirect"} {
		found := false
		for _, finding := range result.Findings {
			if finding.File == "app/query/page.tsx" && finding.RuleID == "auditorx.nextjs.security."+id {
				found = true
			}
		}
		if !found {
			t.Errorf("awaited App Router searchParams was not checked for %s", id)
		}
	}
	for _, id := range []string{"server-action-access", "shared-cache", "route-handler-access"} {
		if counts["auditorx.nextjs.review."+id] == 0 {
			t.Errorf("missing Next review: %s; got %v", id, counts)
		}
	}
	if len(result.CheckedRuleIDs) != 12 {
		t.Fatalf("Next rules were not recorded: %v", result.CheckedRuleIDs)
	}
}
