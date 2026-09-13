// Mirrors backend/internal/modules/scan/rules/baseline-v1.yaml and baseline-v2.yaml.
// Used only to render a coverage checklist; the server remains authoritative for findings.
export type RuleCatalogEntry = {
  id: string;
  category: "Security" | "Coding standard" | "Code quality";
  title: string;
  description: string;
};

export const RULE_CATALOG: Record<string, RuleCatalogEntry[]> = {
  "baseline-v1": [
    { id: "auditorx.python.dynamic-eval", category: "Security", title: "Dynamic code evaluation (Python)", description: "Checks for eval() calls that can execute arbitrary code from untrusted input." },
    { id: "auditorx.javascript.dynamic-eval", category: "Security", title: "Dynamic code evaluation (JavaScript/TypeScript)", description: "Checks for eval() calls that can execute arbitrary code from untrusted input." },
    { id: "auditorx.go.tls-verification-disabled", category: "Security", title: "TLS verification disabled (Go)", description: "Checks for tls.Config with InsecureSkipVerify set to true." },
  ],
  "baseline-v2": [
    { id: "auditorx.python.security.dynamic-eval", category: "Security", title: "Dynamic code evaluation (Python)", description: "Checks for eval() calls that can execute arbitrary code from untrusted input." },
    { id: "auditorx.javascript.security.dynamic-eval", category: "Security", title: "Dynamic code evaluation (JavaScript/TypeScript)", description: "Checks for eval() calls that can execute arbitrary code from untrusted input." },
    { id: "auditorx.go.security.tls-verification-disabled", category: "Security", title: "TLS verification disabled (Go)", description: "Checks for tls.Config with InsecureSkipVerify set to true." },
    { id: "auditorx.python.security.hardcoded-secret", category: "Security", title: "Hardcoded secret (Python)", description: "Checks for credentials or tokens assigned directly to a variable in tracked source." },
    { id: "auditorx.javascript.security.hardcoded-secret", category: "Security", title: "Hardcoded secret (JavaScript/TypeScript)", description: "Checks for credentials or tokens assigned directly to a variable in tracked source." },
    { id: "auditorx.go.security.hardcoded-secret", category: "Security", title: "Hardcoded secret (Go)", description: "Checks for credentials or tokens assigned directly to a variable in tracked source." },
    { id: "auditorx.python.security.shell-command-execution", category: "Security", title: "Shell command execution (Python)", description: "Checks for subprocess/os calls that run a command through a shell." },
    { id: "auditorx.javascript.security.shell-command-execution", category: "Security", title: "Shell command execution (JavaScript/TypeScript)", description: "Checks for child_process exec/execSync calls that run a command through a shell." },
    { id: "auditorx.python.security.sql-string-construction", category: "Security", title: "SQL built with string interpolation (Python)", description: "Checks for SQL statements built with f-strings, % formatting or concatenation instead of parameters." },
    { id: "auditorx.javascript.security.sql-template-interpolation", category: "Security", title: "SQL built with template interpolation (JavaScript/TypeScript)", description: "Checks for SQL statements built with template-literal interpolation instead of parameters." },
    { id: "auditorx.python.coding-standard.sensitive-logging", category: "Coding standard", title: "Sensitive value logged (Python)", description: "Checks for credentials or secrets passed directly to a log or print call." },
    { id: "auditorx.javascript.coding-standard.sensitive-logging", category: "Coding standard", title: "Sensitive value logged (JavaScript/TypeScript)", description: "Checks for credentials or secrets passed directly to a console or logger call." },
    { id: "auditorx.go.coding-standard.sensitive-logging", category: "Coding standard", title: "Sensitive value logged (Go)", description: "Checks for credentials or secrets passed directly to a log or Printf call." },
    { id: "auditorx.go.code-quality.unhandled-json-error", category: "Code quality", title: "Unhandled JSON error (Go)", description: "Checks for json.Encode/Decode calls whose returned error is not checked." },
  ],
};
