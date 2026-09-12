# AuditorX

> AI-Powered Source Code Quality Auditor

AuditorX เป็นระบบตรวจสอบและวิเคราะห์คุณภาพซอร์สโค้ดด้วยปัญญาประดิษฐ์ โดยผสานการทำงานระหว่าง Static Code Analysis และ Large Language Model (LLM) เพื่อช่วยตรวจจับปัญหา อธิบายสาเหตุ วิเคราะห์ผลกระทบ และเสนอแนวทางปรับปรุงซอร์สโค้ด

## Project Goals

- วิเคราะห์คุณภาพของซอร์สโค้ด
- ตรวจจับ Code Smell และ Security Vulnerability
- ตรวจสอบ Coding Standards และ Best Practices
- ใช้ AI อธิบายและให้คำแนะนำต่อผลจาก Static Analysis
- แสดงผลผ่าน Dashboard และ Report
- รองรับการติดตาม Scan History และ Issue Status
- ศึกษา MCP Prototype สำหรับเชื่อมต่อ AI Coding Assistant

## Core Technology

- Frontend: Next.js, React, Tailwind CSS
- Backend: Go
- Database: PostgreSQL
- Static Analysis: Semgrep Community Edition
- AI: OpenAI GPT API
- Issue Prioritization / Evaluation: Python, scikit-learn
- Container: Docker
- Version Control: Git / GitHub
- AI Integration Prototype: Model Context Protocol (MCP)

## Documentation Structure

```text
docs/srs/
├── 01-overview/
├── 02-requirements/
├── 03-analysis/
├── 04-architecture/
├── 05-database/
├── 06-api/
├── 07-ui/
├── 08-quality/
├── 09-ai/
└── 10-testing/
```

แต่ละหมวดเก็บรายละเอียดตามชื่อหัวข้อ และไฟล์ `02-requirements/traceability.md` เป็นจุดเริ่มต้นสำหรับตรวจความเชื่อมโยงระหว่าง Requirement, Use Case, Diagram และ Test Case

> **หมายเหตุสถานะการ implement:** เนื้อหาในเอกสารชุดนี้เป็น target/planned scope ของโปรเจกต์ ส่วนที่ implement จริงแล้ว ณ ปัจจุบันมีเฉพาะ Semgrep scan pipeline (repository registration, scan queue, findings) — ยังไม่มี AI/LLM, priority engine หรือ MCP ดูสถานะแบบละเอียดต่อ requirement ได้ที่ [`01-overview/project-overview.md`](01-overview/project-overview.md) และ [`02-requirements/traceability.md`](02-requirements/traceability.md)

## Documentation Rules

- Requirement IDs ต้องตรงกันทุกเอกสาร
- Use Case IDs ต้องตรงกันทุกเอกสาร
- หาก SRS และ Markdown ไม่ตรงกัน ให้ยึด SRS ฉบับที่ได้รับการอนุมัติล่าสุด
- Markdown ใช้สำหรับรายละเอียดเชิงเทคนิคและ AI-ready documentation
