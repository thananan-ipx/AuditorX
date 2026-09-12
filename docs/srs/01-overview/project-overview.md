# Project Overview

> **Project:** AuditorX  
> **Document:** Project Overview  
> **Status:** Draft

## 1. Overview

AuditorX เป็นระบบตรวจสอบและวิเคราะห์คุณภาพซอร์สโค้ดด้วยปัญญาประดิษฐ์ (AI-Powered Source Code Quality Auditor) ที่ออกแบบมาเพื่อช่วยนักพัฒนาและทีมซอฟต์แวร์ตรวจสอบคุณภาพของ Repository อย่างเป็นระบบ

ระบบใช้ Semgrep เป็น Static Code Analysis Engine สำหรับตรวจจับปัญหาตามกฎ คำนวณ Code Quality Score ด้วยสูตร deterministic ใช้ supervised model ขนาดเล็กเพื่อจัดลำดับความสำคัญของ Issue และใช้ Large Language Model (LLM) เพื่ออธิบายสาเหตุ วิเคราะห์ผลกระทบ และเสนอแนวทางปรับปรุง

> **Status: ปัจจุบันมีเฉพาะ Semgrep static analysis pipeline ที่ implement แล้ว (scan/start, findings, error handling, cancel/re-scan)** ส่วน Code Quality Score, Supervised Issue Prioritization (FR-PRIO-*), LLM Explanation (FR-AI-*), MCP (FR-MCP-*) และ Reporting (FR-REPORT-*) ยังเป็น planned scope ที่ยังไม่มีโค้ด implementation ในระบบจริง (ไม่มี AI/LLM integration, ไม่มี ML training/serving code, ไม่มี MCP server ใด ๆ ในโค้ดฐานปัจจุบัน)

## 2. Problem Statement

การตรวจสอบซอร์สโค้ดด้วยบุคคลใช้เวลาและขึ้นอยู่กับประสบการณ์ของผู้ตรวจสอบ ขณะที่ผลจาก Static Analysis Tool มักเป็นข้อมูลเชิงเทคนิคที่ผู้ใช้งานบางกลุ่มเข้าใจได้ยาก

AuditorX จึงรวมผล Static Analysis และ AI Explanation ไว้ในระบบเดียว พร้อม Dashboard, Issue Management และ Report

## 3. Objectives

1. วิเคราะห์คุณภาพของซอร์สโค้ดด้วย Semgrep
2. ใช้ AI อธิบายและเสนอแนวทางปรับปรุง
3. แสดงผลผ่าน Dashboard
4. จัดลำดับและติดตาม Issue
5. เก็บ Scan History
6. สร้าง Report
7. ศึกษา MCP Prototype สำหรับ Coding Standards
8. ประเมินว่า supervised Issue Prioritization ให้ผลดีกว่า severity-based baseline หรือไม่
9. เปรียบเทียบประโยชน์ของ Semgrep-only, LLM-only และ AuditorX Hybrid ด้วยเกณฑ์ที่กำหนดล่วงหน้า

## 4. Primary Users

- Administrator
- Project Manager / Reviewer
- Developer

## 5. High-Level Flow

```text
User
  ↓
AuditorX
  ↓
Repository
  ↓
Semgrep
  ↓
Findings
  ├── Deterministic Quality Score
  ├── Supervised Issue Prioritization
  └── LLM Explanation
  ↓
Dashboard / Issue / Report
```

## 6. Architectural Principles

- Separation of Concerns
- Least Privilege
- AI as Advisory
- Graceful Degradation
- Traceability
- Minimum Necessary Context for AI
- Human-reviewed Ground Truth
- Reproducible Model Evaluation

## 6.1 Current Implementation Note

เอกสารนี้ยังคงรายละเอียด Objectives และ Architectural Principles ทั้งหมดไว้ตามขอบเขตที่ตั้งใจไว้ (planned scope) แต่โค้ดปัจจุบันมีเพียง repository management, scan pipeline ด้วย Semgrep, และ authentication ผ่าน Supabase Auth เท่านั้นที่ทำงานได้จริง ดูรายละเอียดสถานะ implementation ต่อ requirement ใน `../02-requirements/requirements.md` และ `../02-requirements/traceability.md`

## 7. Related Documents

- `scope.md`
- `glossary.md`
- `../02-requirements/requirements.md`
- `../02-requirements/business-rules.md`
- `../02-requirements/non-functional-requirements.md`
- `../02-requirements/traceability.md`
