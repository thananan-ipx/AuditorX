# Supervised Issue Prioritization

> **Project:** AuditorX  
> **Status:** Draft  
> **Scope:** Small supervised classifier; no LLM training

---

> **Implementation status: Not yet built.** This document describes planned AI functionality; no corresponding code exists in the repository as of 2026-09-12 (no ML service, feature extraction, model registry, or trained classifier). All Semgrep scan results today are shown to users exactly as the scanner produces them, with no AI explanation, summary, or prioritization layer. The design below remains valid planned design for future implementation.

---

## 1. Purpose

กำหนดวิธีจัดลำดับความสำคัญของ Issue ด้วย supervised learning โดยแยกจาก Semgrep Severity, deterministic Code Quality Score และ LLM Explanation

## 2. Output

โมเดลทำนายหนึ่งในสี่คลาส:

- Critical
- High
- Medium
- Low

ทุกผลลัพธ์ต้องมี `priority_source`, `model_version`, `feature_schema_version`, class probabilities, predicted time และ fallback information หากมี

## 3. Ground Truth

Ground Truth มาจาก Priority Label ที่ Reviewer หรือ Administrator ซึ่งได้รับสิทธิ์ตรวจทานแล้วเท่านั้น

Labeling guideline ต้องพิจารณา:

- ผลกระทบหากไม่แก้
- ความเร่งด่วนต่อ release หรือ operation
- ความสามารถในการถูกโจมตีหรือเกิด failure
- ขอบเขตผู้ใช้/ระบบที่ได้รับผลกระทบ
- ความถี่หรือการเกิดซ้ำ
- Repository criticality ที่กำหนดไว้

LLM อาจช่วยสรุปข้อมูลให้ Reviewer แต่ห้ามสร้าง Ground Truth โดยอัตโนมัติ

## 4. MVP Feature Schema

Feature ที่อนุญาตใน `priority-features-v1`:

- normalized severity
- rule ID หรือ stable rule family
- issue category
- programming language
- repository criticality
- affected-file type
- finding frequency within the Scan
- repeated rule count across previous Scans
- code-complexity metric หากคำนวณได้อย่างสม่ำเสมอ
- issue age สำหรับ Issue ที่เชื่อมโยงข้าม Scan ได้

MVP ไม่ใช้ LLM explanation, recommendation หรือ confidence เป็น input feature เพื่อป้องกันวงจรพึ่งพาและทำให้ inference ใช้งานได้เมื่อ LLM ล้มเหลว

## 5. Baseline

`severity-priority-v1` เป็น non-learning baseline:

| AuditorX Severity | Baseline Priority |
|---|---|
| Critical | Critical |
| High | High |
| Medium | Medium |
| Low | Low |

Baseline ต้องผ่าน pipeline เดียวกับ candidate model และประเมินบน test set เดียวกัน

## 6. Candidate Models

MVP เปรียบเทียบอย่างน้อย:

1. Multinomial Logistic Regression เพื่อเป็น interpretable learned baseline
2. Random Forest หรือ Gradient-boosted Trees เพื่อทดสอบ nonlinear relationships

Hyperparameter selection ใช้ validation partition เท่านั้น Test partition ใช้ครั้งเดียวสำหรับ final evaluation ของ model version ที่เลือก

## 7. Dataset Split

Dataset แบ่งเป็น train, validation และ test โดย group ตาม Repository ห้าม Issue จาก Repository เดียวกันอยู่ข้าม partition

Evaluation run ต้องบันทึก:

- dataset version
- repository IDs หรือ anonymized group IDs ในแต่ละ partition
- split seed
- label distribution
- feature schema version
- source revision ของ training pipeline

## 8. Metrics

Primary metric คือ Macro-F1 เพื่อไม่ให้คลาสที่มีจำนวนมากครอบงำผล

รายงานเพิ่มเติม:

- per-class Precision, Recall และ F1
- Confusion Matrix
- accuracy
- class distribution
- coverage และ fallback rate
- calibration metric เมื่อใช้ probability เป็น confidence

## 9. Model Promotion

Candidate model จะเป็น Active ได้เมื่อ:

1. evaluation artifacts ครบถ้วนและ reproducible
2. ไม่มี Repository leakage
3. Macro-F1 บน test set ไม่ต่ำกว่า `severity-priority-v1`
4. Recall ของ Critical ไม่ต่ำกว่า baseline
5. Model, feature schema และ dataset version ถูก register

หากไม่มี candidate ผ่านเกณฑ์ ระบบใช้ baseline ต่อไปและรายงานผลเชิงลบอย่างตรงไปตรงมา

## 10. Online Inference

```text
Normalized Finding
→ Versioned Feature Extraction
→ Active Priority Model
→ Validate Prediction
→ Persist Prediction + Probabilities + Versions
→ Optional LLM Explanation of the Persisted Priority
```

เมื่อ model service ล้มเหลว ระบบใช้ `severity-priority-v1` และกำหนด `priority_source = "baseline"`

## 11. Human Feedback

ผู้มีสิทธิ์สามารถยืนยันหรือแก้ Priority ได้ การแก้ไขสร้าง Priority Label ใหม่พร้อมผู้ให้ label, เหตุผล, เวลา และ guideline version โดยไม่แก้ Prediction เดิม

Label ใหม่จะเข้าสู่ dataset version ถัดไปหลังผ่าน review และต้องไม่ทำให้ test set เดิมปนกับ training set โดยไม่ประกาศ evaluation run ใหม่

## 12. Traceability

Related:

- `FR-PRIO-*`
- `FR-AI-005`
- `BR-015`–`BR-019`
- `NFR-REL-005`
- `NFR-MAIN-005`
- `UC-006`
- `UC-012`
