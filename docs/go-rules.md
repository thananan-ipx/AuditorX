# Go rule review — baseline-v4

New scans use baseline-v4. Historical v1/v2/v3 YAML and results retain their
original meaning. The four Go rule IDs and severities remain unchanged.

Changes from v3:

- Sensitive logging now requires a recognized logging method (Print/Printf,
  Info/Debug/Warn/Error and common variants), or fmt.Fprint/Fprintf/Fprintln.
  Passing a password to Login, Verify, Hash, or other arbitrary methods no longer
  counts as logging. Secret names are still heuristic; nested fields, wrappers,
  structured log attributes, and custom logging methods are not fully covered.
- Hardcoded secret matching also covers `const password = "..."` declarations.
  Names and literal length are heuristics; fixture/example values require review.
- JSON error matching includes explicit `_ = encoder.Encode(...)` and
  `_ = decoder.Decode(...)`. Assigned or returned errors are not reported;
  the rule does not prove that every assigned error is subsequently handled.
- TLS matching remains limited to tls.Config literals with
  InsecureSkipVerify: true; it does not cover every later field assignment.

Coverage is deliberately small. There are no Go-specific SQL injection,
authorization, path traversal, or shell command rules in this profile. Zero
findings is not evidence that those problems are absent. Findings require source
and context review before accepted Priority labels are assigned.

Regression fixtures: backend/internal/modules/scan/testdata/go-v4/checks.go.
TestSemgrepGoRulesV4 verifies exact rule IDs and source lines, including safe
authentication calls and checked/returned errors, with pinned Semgrep 1.175.0.
TestGoV4ScopeAndHistoricalRules verifies that non-Go rules match v3 verbatim.

The rule constraints use Semgrep pattern/metavariable operators documented at
https://semgrep.dev/docs/writing-rules/rule-syntax/.
