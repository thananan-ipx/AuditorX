# AI Structured Output

> **Project:** AuditorX  
> **Status:** Draft

---

> **Implementation status: Not yet built.** This document describes planned AI functionality; no corresponding code exists in the repository as of 2026-09-12. All Semgrep scan results today are shown to users exactly as the scanner produces them, with no AI explanation, summary, or prioritization layer. The schema below remains valid planned design for future implementation.

---

## 1. Purpose

กำหนด schema เชิงตรรกะของ AI Analysis Output เพื่อให้ Backend สามารถ Validate, Persist และ Display ได้สม่ำเสมอ

---

## 2. Issue Analysis Schema

Conceptual JSON:

```json
{
  "summary": "Short explanation of the issue.",
  "root_cause": "Why the issue is present.",
  "impact": "What could happen if it remains.",
  "recommendation": "How the developer should address it.",
  "priority_explanation": "Why the supplied system priority is reasonable given the available context.",
  "confidence_note": "The recommendation is based only on the supplied code context."
}
```

---

## 3. Field Definitions

| Field | Required | Description |
|---|---|---|
| summary | Yes | Concise human-readable explanation |
| root_cause | Yes | Probable technical cause |
| impact | Yes | Potential consequence |
| recommendation | Yes | Remediation guidance |
| priority_explanation | Yes | Explanation of the supplied persisted Priority; must not create a new label |
| confidence_note | Yes | Context limitation / uncertainty |

---

## 4. Priority Boundary

The request supplies `predicted_priority`, `priority_source` and confidence/probabilities from the Priority Engine. The LLM returns only `priority_explanation`.

The LLM must not create a Priority Label, change the persisted Prediction, or overwrite deterministic Severity and Quality Score.

---

## 5. Validation Rules

- all required fields must exist
- output must be valid JSON/structured data
- string length should have reasonable backend limits
- priority_explanation must refer to the supplied Priority and must not invent another enum value
- response must not contain extra executable actions
- malformed result is `Failed`, not `Completed`

---

## 6. Repository Summary Schema

Concept:

```json
{
  "summary": "Overall repository quality summary.",
  "major_risks": [
    "..."
  ],
  "recommended_priorities": [
    "..."
  ],
  "positive_observations": [
    "..."
  ],
  "confidence_note": "..."
}
```

---

## 7. Storage Mapping

Issue output maps to `AIAnalysis`:

| Output | Entity Field |
|---|---|
| summary | `summary` |
| root_cause | `root_cause` |
| impact | `impact` |
| recommendation | `recommendation` |
| priority_explanation | `priority_explanation` |
| confidence_note | `confidence_note` |

Repository Summary output maps to `AIRepositorySummary`, with list fields stored as validated JSON arrays and linked by `scan_id`.

---

## 8. Provider Metadata

Store separately where useful:

- provider
- model
- prompt version
- response status
- creation time

Avoid storing sensitive raw prompts/responses unless explicitly required.

---

## 9. Failure State

Examples:

- invalid JSON
- missing required field
- priority explanation contradicts or replaces the supplied persisted Priority
- provider timeout
- provider refusal/error

Backend should:

```text
Mark AIAnalysis Failed
→ Preserve Issue
→ Allow Retry
```
