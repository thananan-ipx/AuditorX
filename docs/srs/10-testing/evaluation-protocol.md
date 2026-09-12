# Evaluation Protocol

> **Project:** AuditorX  
> **Status:** Draft  
> **Goal:** Evaluate prioritization quality and the usefulness of AI-assisted explanations

> **Implementation status: Not yet built.** This entire document describes a planned research/evaluation protocol for AI-assisted explanations and a supervised priority model; no corresponding code exists in the repository as of 2026-09-12 — there is no LLM integration, no priority model, no feature extraction, and no labeled dataset to evaluate. **Not applicable yet — no AI/priority-engine code exists to test.** The real, currently runnable verification for AuditorX today is the scan/repository/auth pipeline's test suite described in `docs/scan-pipeline.md`'s "Repeatable verification" section (Go unit/integration tests, a PGlite-backed database integration suite, `scripts/verify.ps1`, `scripts/verify-scanner.ps1`, and frontend service/controller/markup tests) — that suite validates queueing, locking, findings persistence and the UI, not any AI or ML behavior. Everything below remains valid planned design for when the AI/priority-engine functionality is built.

## 1. Research Questions

### RQ-001 Priority Prediction

Does a supervised Issue Prioritization model outperform the versioned severity-based baseline on unseen Repositories?

### RQ-002 Explanation Usefulness

Does the AuditorX Hybrid presentation help users understand and act on findings better than Semgrep-only or LLM-only presentation?

### RQ-003 Reliability

Can AuditorX preserve useful static findings, deterministic scores and baseline priority when the LLM or priority model is unavailable?

## 2. Study A — Priority Model Evaluation

### Dataset

- normalized Semgrep findings from supported languages
- human-reviewed Priority Labels
- repository-grouped train/validation/test split
- immutable dataset and labeling-guideline versions

### Compared Methods

1. `severity-priority-v1`
2. Multinomial Logistic Regression
3. Random Forest or Gradient-boosted Trees

### Primary Metric

- Macro-F1 on the untouched test partition

### Secondary Metrics

- per-class Precision, Recall and F1
- Critical-class Recall
- Confusion Matrix
- accuracy
- fallback/coverage rate
- probability calibration when available

### Required Reporting

- repository counts and label distribution per partition
- split seed and grouping method
- feature schema and dataset versions
- candidate configurations
- validation-selection procedure
- final test metrics for baseline and selected candidate
- error analysis with representative false positives/false negatives

## 3. Study B — Explanation Evaluation

Use the same balanced set of representative Issue samples across three conditions:

| Condition | Information shown |
|---|---|
| Semgrep-only | Raw/normalized finding without generated explanation |
| LLM-only | LLM analysis of the same code snippet without Semgrep rule/severity metadata |
| AuditorX Hybrid | Semgrep finding, deterministic context, persisted priority and LLM explanation |

Participants must not know which condition is expected to perform best. Presentation order should be randomized or counterbalanced.

Issue samples must be selected before participant testing and stratified across supported language, Severity and category. Samples used to tune prompts or build expert reference answers must be disclosed.

### Measures

- primary: user comprehension score
- primary: expert-rated technical correctness (1–5)
- secondary: time to reach a decision
- secondary: actionable recommendation quality (1–5)
- secondary: user confidence (1–5)
- safety: hallucination rate
- safety: unsafe or unsupported recommendation count

The analysis plan, exclusion rules and target sample size must be written before viewing comparative results. Use confidence intervals and an appropriate paired/repeated-measures test when the same participant evaluates multiple conditions; report effect size alongside p-values.

Technical correctness and hallucination judgments require an expert reference answer prepared independently of the evaluated LLM output.

## 4. Study C — Graceful Degradation

Inject controlled failures for:

- LLM unavailable
- malformed LLM structured output
- Active priority model unavailable
- invalid feature vector

Verify that Semgrep findings and deterministic Quality Score remain available, while priority falls back to the versioned baseline with a visible source indicator.

## 5. Label Quality

At least two reviewers should label an overlapping subset. Report agreement using Cohen's kappa for two reviewers or Fleiss' kappa for more than two reviewers.

Disagreements must be adjudicated and the final label must preserve reviewer identities, guideline version and rationale.

## 6. Leakage Controls

- group dataset partitions by Repository
- fit encoders/scalers on training data only
- perform hyperparameter selection on validation data only
- do not use test results to choose a model
- do not place duplicate or near-duplicate findings across partitions without documenting the handling method

## 7. Minimum Success Criteria

The prioritizer is successful when:

1. Macro-F1 is not lower than the severity baseline
2. Critical Recall is not lower than the baseline
3. evaluation is reproducible from recorded versions/configuration
4. no Repository leakage is found

The explanation layer is successful when AuditorX Hybrid improves at least one primary usability measure over Semgrep-only without a worse expert-rated correctness or hallucination rate. Statistical tests and confidence intervals must be reported; practical effect size is reported alongside p-values.

## 8. Limitations

- Results apply only to represented languages, repositories and rule profiles
- Human labels contain judgment and may not generalize across organizations
- LLM results vary by provider/model/prompt version
- A non-significant or negative result must be reported and must not be hidden by changing metrics after evaluation

## 9. Reproducibility Package

Each reported experiment should export:

- anonymized dataset/split manifest or a reproducible access procedure
- labeling guideline and adjudication record
- feature schema
- model configuration and dependency lock information
- prompt, provider and model versions
- random seeds
- raw per-sample predictions/ratings with sensitive data removed
- metric-generation script and final machine-readable result

## 10. Traceability

Related: `FR-PRIO-007`, `BR-016`–`BR-018`, `NFR-MAIN-005`, `TC-PRIO-*`, `AC-018`, `AC-019`
