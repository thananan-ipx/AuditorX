# Code Quality Score

> **Project:** AuditorX  
> **Document:** Code Quality Score Design  
> **Status:** Draft  
> **Related Requirements:** `FR-DASH-002`, `BR-007`

---

## 1. Purpose

เอกสารนี้กำหนดแนวทางคำนวณ Code Quality Score ของ AuditorX สำหรับสรุปคุณภาพของ Repository จากผล Static Analysis

คะแนนนี้เป็น **Project-specific metric** และไม่ถือเป็นมาตรฐานสากลหรือการรับรองว่าซอฟต์แวร์ปราศจากข้อผิดพลาด

**Implementation status: Not yet built.** No deterministic or versioned Code Quality Score is computed or stored anywhere in the current codebase. The only quality signal that exists today is the raw findings/severity counts returned per completed scan (High/Medium/Low, capped at 1,000 findings), surfaced in the Scans workspace UI (`frontend/features/scans/components/repository-scans.tsx`); these counts are not rolled up into a single score. A numeric score, `score_version`, and score levels do appear in the legacy sample-data prototype dashboard (`frontend/features/dashboard/pages/dashboard-page-client.tsx`), but that dashboard uses fixed demo values rather than a real, deterministic calculation — it does not implement the formula below. Everything in this document remains the planned target design.

---

## 2. Goals

- ให้คะแนนที่เข้าใจง่ายในช่วง 0–100
- ให้ Severity มีผลต่อคะแนนอย่างชัดเจน
- ลดผลกระทบจาก Issue ที่เป็น False Positive
- รองรับการเปรียบเทียบ Scan History
- รองรับ Versioning ของสูตร

---

## 3. Severity Weights

Initial proposed weights:

These weights apply after Semgrep severity has been normalized using the versioned mapping in `docs/08-quality/semgrep-rules.md`.

| Severity | Weight |
|---|---:|
| Critical | 10 |
| High | 6 |
| Medium | 3 |
| Low | 1 |

> Weight นี้เป็นค่าเริ่มต้นสำหรับ POC และสามารถปรับจากผลการทดลอง

---

## 4. Active Issue Rules

Issue ที่ถูกนับในการคำนวณ:

- Open
- In Progress
- Accepted Risk

Issue ที่ไม่นับเป็น Active Finding:

- Resolved
- False Positive

`Accepted Risk` ยังถูกนับ เนื่องจากความเสี่ยงยังคงอยู่ แม้ทีมยอมรับความเสี่ยงแล้ว

**Implementation status: Not yet built.** Findings have no status field at all today — the Findings list in the Scans workspace is read-only (no Open/In Progress/Accepted Risk/Resolved/False Positive workflow), so there is currently no way to distinguish "active" from "inactive" findings for a score calculation.

---

## 5. Base Penalty

```text
Penalty =
(Critical × 10)
+ (High × 6)
+ (Medium × 3)
+ (Low × 1)
```

---

## 6. Repository Size Normalization

จำนวน Issue อย่างเดียวอาจทำให้ Repository ขนาดใหญ่เสียเปรียบ

สำหรับ POC แนะนำให้ Normalize ด้วยจำนวนพันบรรทัดของโค้ด (KLOC) หากสามารถวัดได้อย่างสม่ำเสมอ

```text
Normalized Penalty = Penalty / max(KLOC, 1)
```

ถ้า MVP ยังไม่มี LOC metric ให้ใช้ Penalty แบบไม่ Normalize ก่อน และระบุ `score_version`

---

## 7. Proposed MVP Formula

Simple initial formula:

```text
Score = max(0, 100 - Penalty)
```

Example:

```text
Critical = 1
High = 2
Medium = 3
Low = 5

Penalty
= (1×10) + (2×6) + (3×3) + (5×1)
= 36

Score = 64
```

---

## 8. Score Levels

Initial interpretation:

| Score | Level |
|---:|---|
| 90–100 | Excellent |
| 80–89 | Good |
| 60–79 | Needs Improvement |
| 0–59 | Poor |

These thresholds are provisional and should be validated during POC testing.

---

## 9. Score Versioning

Every Scan should be associated with a score formula version.

Example:

```text
score_version = "v1"
```

If formula changes in future, historical scores remain interpretable.

---

## 10. AI and Quality Score

AI must not directly invent or modify the numeric Code Quality Score.

The score must be calculated deterministically from system rules.

Supervised Priority Prediction and human-reviewed Priority Label must also not modify the score directly. If a future score formula uses Priority, it requires a new approved `score_version`; it is out of scope for MVP `v1`.

AI may:

- explain why the score is low
- summarize major contributors
- recommend what to fix first

---

## 11. Future Extensions

Potential future factors:

- finding density per KLOC
- category weights
- repeated issue patterns
- unresolved age
- repository criticality
- trend improvement
- custom organization policy

---

## 12. Traceability

Related:

- `FR-DASH-002`
- `FR-DASH-003`
- `BR-007`
- `BR-015`
- `UC-005`
- `UC-010`
