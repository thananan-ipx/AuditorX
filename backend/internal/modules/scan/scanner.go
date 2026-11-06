package scan

import (
	"bytes"
	"context"
	"crypto/sha256"
	_ "embed"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

const currentRulesVersion = "baseline-v4"

//go:embed rules/baseline-v1.yaml
var baselineV1Rules []byte

//go:embed rules/baseline-v2.yaml
var baselineV2Rules []byte

//go:embed rules/nextjs-v1.yaml
var nextjsV1Rules []byte

//go:embed rules/baseline-v4.yaml
var baselineV4Rules []byte

var baselineV3Rules = []byte(strings.TrimSpace(strings.ReplaceAll(string(baselineV2Rules), "\r\n", "\n")) + "\n\n" + strings.TrimPrefix(strings.ReplaceAll(string(nextjsV1Rules), "\r\n", "\n"), "rules:\n"))

var rulesets = map[string][]byte{
	"baseline-v1": baselineV1Rules,
	"baseline-v2": baselineV2Rules,
	"baseline-v3": baselineV3Rules,
	"baseline-v4": baselineV4Rules,
}

func init() {
	allowedRules["baseline-v3"] = make(map[string]bool)
	for id := range allowedRules["baseline-v2"] {
		allowedRules["baseline-v3"][id] = true
	}
	for _, id := range []string{"request-html", "public-secret", "client-server-import", "request-redirect"} {
		allowedRules["baseline-v3"]["auditorx.nextjs.security."+id] = true
	}
	for _, id := range []string{"server-action-access", "shared-cache", "route-handler-access"} {
		allowedRules["baseline-v3"]["auditorx.nextjs.review."+id] = true
	}
	allowedRules["baseline-v4"] = make(map[string]bool)
	for id := range allowedRules["baseline-v3"] {
		allowedRules["baseline-v4"][id] = true
	}
}

var allowedRules = map[string]map[string]bool{
	"baseline-v1": {
		"auditorx.python.dynamic-eval":          true,
		"auditorx.javascript.dynamic-eval":      true,
		"auditorx.go.tls-verification-disabled": true,
	},
	"baseline-v2": {
		"auditorx.python.security.dynamic-eval":                   true,
		"auditorx.javascript.security.dynamic-eval":               true,
		"auditorx.go.security.tls-verification-disabled":          true,
		"auditorx.python.security.hardcoded-secret":               true,
		"auditorx.javascript.security.hardcoded-secret":           true,
		"auditorx.go.security.hardcoded-secret":                   true,
		"auditorx.python.security.shell-command-execution":        true,
		"auditorx.javascript.security.shell-command-execution":    true,
		"auditorx.python.security.sql-string-construction":        true,
		"auditorx.javascript.security.sql-template-interpolation": true,
		"auditorx.python.coding-standard.sensitive-logging":       true,
		"auditorx.javascript.coding-standard.sensitive-logging":   true,
		"auditorx.go.coding-standard.sensitive-logging":           true,
		"auditorx.go.code-quality.unhandled-json-error":           true,
	},
}

type Analyzer interface {
	Analyze(context.Context, string, string) (Result, error)
}
type Semgrep struct{ Executable string }
type boundedOutput struct {
	bytes.Buffer
	Limit int
}

func (b *boundedOutput) Write(p []byte) (int, error) {
	if b.Len()+len(p) > b.Limit {
		return 0, errors.New("scanner output exceeds limit")
	}
	return b.Buffer.Write(p)
}

func (s Semgrep) Analyze(ctx context.Context, source, rulesVersion string) (Result, error) {
	languages, err := sourceLanguages(ctx, source)
	if err != nil {
		return Result{}, err
	}
	var nextTargets []string
	if rulesVersion == "baseline-v3" || rulesVersion == "baseline-v4" {
		nextTargets, err = nextjsTargets(ctx, source)
		if err != nil {
			return Result{}, err
		}
	}
	rules, checkedRules, err := scopedRules(rulesVersion, languages, nextTargets...)
	if err != nil {
		return Result{}, err
	}
	executable, err := exec.LookPath(s.Executable)
	if err != nil {
		return Result{}, err
	}
	executable, err = filepath.Abs(executable)
	if err != nil {
		return Result{}, err
	}
	scratch, err := os.MkdirTemp("", "auditorx-semgrep-")
	if err != nil {
		return Result{}, err
	}
	defer os.RemoveAll(scratch)
	configPath := filepath.Join(scratch, rulesVersion+".yaml")
	if err = os.WriteFile(configPath, rules, 0600); err != nil {
		return Result{}, err
	}
	cmd := exec.CommandContext(ctx, executable, "scan", "--config", configPath, "--json", "--quiet", "--strict", "--oss-only", "--metrics=off", "--disable-version-check", "--no-git-ignore", "--no-rewrite-rule-ids", "--jobs=1", "--timeout=10", "--max-memory=512", "--max-target-bytes=1048576", ".")
	cmd.Dir = source
	// Do not pass database passwords, API tokens, Python overrides or user config.
	cmd.Env = []string{"SEMGREP_SEND_METRICS=off", "SEMGREP_ENABLE_VERSION_CHECK=0", "SEMGREP_SETTINGS_FILE=" + filepath.Join(scratch, "settings.yml"), "SEMGREP_LOG_FILE=" + filepath.Join(scratch, "semgrep.log"), "OTEL_SDK_DISABLED=true", "PYTHONUTF8=1", "HOME=" + scratch, "USERPROFILE=" + scratch, "TMP=" + scratch, "TEMP=" + scratch, "TMPDIR=" + scratch}
	for _, key := range []string{"SystemRoot", "WINDIR"} {
		if value := os.Getenv(key); value != "" {
			cmd.Env = append(cmd.Env, key+"="+value)
		}
	}
	scannerPath := filepath.Dir(executable)
	if runtime.GOOS != "windows" {
		// Semgrep's Linux engine invokes uname. Allow only fixed system paths,
		// never the caller's PATH or the uploaded source directory.
		scannerPath += string(os.PathListSeparator) + "/usr/bin" + string(os.PathListSeparator) + "/bin"
	}
	cmd.Env = append(cmd.Env, "PATH="+scannerPath)
	cmd.Env = append(cmd.Env, "XDG_CONFIG_HOME="+scratch, "XDG_CACHE_HOME="+scratch)
	cmd.WaitDelay = 5 * time.Second
	containProcess(cmd)
	output := &boundedOutput{Limit: 8 << 20}
	stderr := &boundedOutput{Limit: 1 << 20}
	cmd.Stdout = output
	cmd.Stderr = stderr
	if err = cmd.Run(); err != nil {
		var exitError *exec.ExitError
		// Semgrep uses exit 1 for findings/strict warnings and its Windows wrapper
		// may use exit 3 for warning-level partial parsing in an isolated profile.
		// Both remain gated on a complete, allowlisted JSON result below.
		if !errors.As(err, &exitError) || (exitError.ExitCode() != 1 && exitError.ExitCode() != 3) || ctx.Err() != nil {
			return Result{}, fmt.Errorf("semgrep process failed: %w", err)
		}
		if _, parseErr := parseFindings(output.Bytes(), rulesVersion); parseErr != nil {
			return Result{}, fmt.Errorf("semgrep failed: %w; diagnostics: %s", err, stderr.String())
		}
	}
	result, err := parseFindings(output.Bytes(), rulesVersion)
	if err != nil {
		return Result{}, err
	}
	selected := map[string]bool{}
	for _, id := range checkedRules {
		selected[id] = true
	}
	for _, finding := range result.Findings {
		if !selected[finding.RuleID] {
			return Result{}, errors.New("finding outside selected language rules")
		}
	}
	result.SourceLanguages = languages
	result.CheckedRuleIDs = checkedRules
	return result, nil
}

func parseFindings(data []byte, rulesVersion string) (Result, error) {
	knownRules, ok := allowedRules[rulesVersion]
	if !ok {
		return Result{}, errors.New("unsupported rules version")
	}
	var raw struct {
		Version string            `json:"version"`
		Errors  []json.RawMessage `json:"errors"`
		Results []struct {
			Rule  string `json:"check_id"`
			Path  string `json:"path"`
			Start struct {
				Line int `json:"line"`
			} `json:"start"`
			End struct {
				Line int `json:"line"`
			} `json:"end"`
			Extra struct {
				Message  string `json:"message"`
				Severity string `json:"severity"`
			} `json:"extra"`
		} `json:"results"`
	}
	if err := json.Unmarshal(data, &raw); err != nil {
		return Result{}, err
	}
	if raw.Version != "1.175.0" || raw.Results == nil || !onlyPartialParsingWarnings(raw.Errors) || len(raw.Results) > 1000 {
		return Result{}, errors.New("unsupported, incomplete or oversized scan result")
	}
	result := Result{ScannerVersion: raw.Version, Findings: []Finding{}}
	seen := map[string]bool{}
	for _, item := range raw.Results {
		file := strings.TrimPrefix(strings.ReplaceAll(item.Path, "\\", "/"), "./")
		if !filepath.IsLocal(filepath.FromSlash(file)) || strings.Contains(file, ":") || len(file) > 500 || item.Start.Line <= 0 || item.End.Line < item.Start.Line || len(item.Rule) > 200 || len(item.Extra.Message) > 2000 || item.Extra.Message == "" {
			return Result{}, errors.New("invalid finding")
		}
		// Only this reviewed ruleset may publish findings; never execute repository rules.
		if !knownRules[item.Rule] {
			return Result{}, errors.New("unknown rule")
		}
		severity := map[string]string{"ERROR": "High", "WARNING": "Medium", "INFO": "Low"}[item.Extra.Severity]
		if severity == "" {
			return Result{}, errors.New("unknown severity")
		}
		hash := sha256.Sum256([]byte(fmt.Sprintf("%s\x00%s\x00%s\x00%d\x00%d", rulesVersion, item.Rule, file, item.Start.Line, item.End.Line)))
		fingerprint := hex.EncodeToString(hash[:])
		if seen[fingerprint] {
			continue
		}
		seen[fingerprint] = true
		result.Findings = append(result.Findings, Finding{Fingerprint: fingerprint, RuleID: item.Rule, File: file, Line: item.Start.Line, EndLine: item.End.Line, Message: item.Extra.Message, Severity: severity})
	}
	return result, nil
}

// Semgrep reports recoverable parser gaps as level=warn PartialParsing entries.
// The remaining AST and findings are still usable; every other diagnostic stays
// fail-closed so engine/config/runtime failures cannot be mistaken for success.
func onlyPartialParsingWarnings(items []json.RawMessage) bool {
	for _, item := range items {
		var diagnostic struct {
			Code  int               `json:"code"`
			Level string            `json:"level"`
			Type  []json.RawMessage `json:"type"`
		}
		if err := json.Unmarshal(item, &diagnostic); err != nil || diagnostic.Code != 3 || diagnostic.Level != "warn" || len(diagnostic.Type) == 0 {
			return false
		}
		var kind string
		if err := json.Unmarshal(diagnostic.Type[0], &kind); err != nil || kind != "PartialParsing" {
			return false
		}
	}
	return true
}
