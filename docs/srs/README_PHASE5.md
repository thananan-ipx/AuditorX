# AuditorX Phase 5 — Core Quality & AI Logic

Included:

## Quality
- `08-quality/code-quality-score.md`
- `08-quality/semgrep-rules.md`
- `08-quality/coding-standard.md`

## AI
- `09-ai/ai-analysis-flow.md`
- `09-ai/prompts.md`
- `09-ai/structured-output.md`
- `09-ai/issue-prioritization.md`

These files use the current `FR-*`, `NFR-*`, `BR-*`, and `UC-*` identifiers. Versioned scoring and severity policies are defined in their respective quality documents.

Important draft decisions:
- Semgrep is the primary detection engine.
- AI explains/recommends and does not automatically modify source code.
- Code Quality Score is deterministic and versioned.
- Severity, deterministic Score, supervised Priority Prediction and human-reviewed Priority Label are separate concepts.
- LLM explains a persisted Priority but does not create its label.
