// Human-readable explanations of reviewed server rules. Coverage comes from
// the selected scan's persisted checked_rule_ids, never the whole catalog.
export type SourceLanguage = "go" | "javascript" | "python" | "typescript";
export type RuleCatalogEntry = {
  id: string;
  category: "Security" | "Coding standard" | "Code quality" | "Manual review";
  framework?: "Next.js";
  review?: boolean;
  title: string;
  description: string;
  languages: SourceLanguage[];
};

const explanations = {
  eval: { category: "Security", title: "Running text as code", description: "Looks for eval(), which runs text as code. Untrusted input could make the program execute unwanted code." },
  tls: { category: "Security", title: "TLS certificate checks disabled", description: "Looks for disabled server certificate checks. This can let an attacker impersonate a trusted server." },
  secret: { category: "Security", title: "Passwords or tokens stored in code", description: "Looks for passwords, keys or access tokens written directly in source code, where others could read or reuse them." },
  shell: { category: "Security", title: "Running commands through a shell", description: "Looks for shell command execution. Untrusted input could change the command and run something unintended." },
  sql: { category: "Security", title: "SQL queries built from text", description: "Looks for SQL built by joining or inserting text instead of using query parameters. This can allow SQL injection." },
  logging: { category: "Coding standard", title: "Secrets written to logs", description: "Looks for passwords, keys or tokens passed directly to logging or print functions, where they could be exposed." },
  json: { category: "Code quality", title: "JSON errors left unchecked", description: "Looks for JSON encoding or decoding calls that ignore errors, so a failure could go unnoticed." },
} satisfies Record<string, Omit<RuleCatalogEntry, "id" | "languages">>;

function rule(id: string, explanation: keyof typeof explanations, languages: SourceLanguage[]): RuleCatalogEntry {
  return { id, ...explanations[explanation], languages };
}

export const RULE_CATALOG: Record<string, RuleCatalogEntry[]> = {
  "baseline-v1": [
    rule("auditorx.python.dynamic-eval", "eval", ["python"]),
    rule("auditorx.javascript.dynamic-eval", "eval", ["javascript", "typescript"]),
    rule("auditorx.go.tls-verification-disabled", "tls", ["go"]),
  ],
  "baseline-v2": [
    rule("auditorx.python.security.dynamic-eval", "eval", ["python"]),
    rule("auditorx.javascript.security.dynamic-eval", "eval", ["javascript", "typescript"]),
    rule("auditorx.go.security.tls-verification-disabled", "tls", ["go"]),
    rule("auditorx.python.security.hardcoded-secret", "secret", ["python"]),
    rule("auditorx.javascript.security.hardcoded-secret", "secret", ["javascript", "typescript"]),
    rule("auditorx.go.security.hardcoded-secret", "secret", ["go"]),
    rule("auditorx.python.security.shell-command-execution", "shell", ["python"]),
    rule("auditorx.javascript.security.shell-command-execution", "shell", ["javascript", "typescript"]),
    rule("auditorx.python.security.sql-string-construction", "sql", ["python"]),
    rule("auditorx.javascript.security.sql-template-interpolation", "sql", ["javascript", "typescript"]),
    rule("auditorx.python.coding-standard.sensitive-logging", "logging", ["python"]),
    rule("auditorx.javascript.coding-standard.sensitive-logging", "logging", ["javascript", "typescript"]),
    rule("auditorx.go.coding-standard.sensitive-logging", "logging", ["go"]),
    rule("auditorx.go.code-quality.unhandled-json-error", "json", ["go"]),
  ],
};

function nextRule(id: string, title: string, description: string, review = false): RuleCatalogEntry {
  return { id: `auditorx.nextjs.${review ? "review" : "security"}.${id}`, title, description, category: review ? "Manual review" : "Security", framework: "Next.js", review, languages: ["javascript", "typescript"] };
}

RULE_CATALOG["baseline-v3"] = [...RULE_CATALOG["baseline-v2"],
  nextRule("request-html", "Request data rendered as raw HTML", "Checks whether request data reaches dangerouslySetInnerHTML without a recognized HTML sanitizer. Untrusted HTML can run scripts in a visitor's browser."),
  nextRule("public-secret", "Secrets exposed through public environment variables", "Checks NEXT_PUBLIC_ variable names that indicate passwords or private tokens. Public API URLs and anonymous public keys are not flagged just for being public."),
  nextRule("client-server-import", "Server-only modules imported into a Client Component", "Checks direct imports of known server-only modules in files marked use client. It does not resolve every custom module across files."),
  nextRule("request-redirect", "Request data used as a redirect destination", "Checks query or request data flowing to redirects and Next.js router navigation. Review destination validation before accepting the finding."),
  nextRule("server-action-access", "Review access checks in Server Actions", "Lists Server Actions for a person to review authentication, permissions and input validation. A match does not mean these checks are missing.", true),
  nextRule("shared-cache", "Review user data in shared caches", "Lists shared cache calls for a person to check user isolation. A match does not prove that private data is exposed.", true),
  nextRule("route-handler-access", "Review access checks in API handlers", "Lists App Router handlers and Pages API handlers for a person to review permissions and input validation. Public endpoints may allow anonymous access intentionally.", true),
];

// v4 refines Go matches while retaining the same rule identities.
RULE_CATALOG["baseline-v4"] = [...RULE_CATALOG["baseline-v3"]];

export const LANGUAGE_LABELS: Record<SourceLanguage, string> = { go: "Go", javascript: "JavaScript", python: "Python", typescript: "TypeScript" };

export function coverageRules(version: string, checkedRuleIDs: string[], languages: SourceLanguage[]) {
  const checked = new Set(checkedRuleIDs);
  return (RULE_CATALOG[version] ?? []).filter(rule => checked.has(rule.id) && rule.languages.some(language => languages.includes(language)));
}
