# AuditorX

> AI-Powered Source Code Quality Auditor

AuditorX เป็นระบบตรวจสอบและวิเคราะห์คุณภาพซอร์สโค้ดด้วยปัญญาประดิษฐ์ (AI-Powered Source Code Quality Auditor) ที่ถูกออกแบบมาเพื่อช่วยนักพัฒนาและองค์กรในการยกระดับคุณภาพของซอฟต์แวร์ โดยผสานการทำงานระหว่าง **Static Code Analysis** และ **Large Language Models (LLMs)**

ระบบมีเป้าหมายในการตรวจจับปัญหาด้านคุณภาพของซอร์สโค้ด พร้อมอธิบายสาเหตุ วิเคราะห์ผลกระทบ และเสนอแนวทางการปรับปรุงให้สอดคล้องกับหลักการ Software Engineering และ Coding Standards ขององค์กร

---

# Vision

สร้าง AI Assistant สำหรับ Software Engineering ที่สามารถ

* วิเคราะห์คุณภาพของซอร์สโค้ด
* อธิบายปัญหาเชิงลึก
* แนะนำแนวทางการ Refactor
* จัดลำดับความสำคัญของ Technical Debt
* เรียนรู้ Coding Standards ขององค์กร
* สนับสนุน AI Coding Assistant ผ่าน Model Context Protocol (MCP)

---

# Objectives

* ลดเวลาการ Code Review
* ลด Technical Debt
* เพิ่มมาตรฐานของ Source Code
* ช่วยให้นักพัฒนาเข้าใจสาเหตุของปัญหา
* เพิ่มคุณภาพของซอฟต์แวร์ที่สร้างโดย AI และมนุษย์

---

# Core Features

## Static Analysis

ใช้ Semgrep ตรวจสอบ

* Code Smell
* Security Vulnerabilities
* Best Practices
* Coding Standards
* Severity
* File Location
* Line Number

---

## AI Analysis

ใช้ Large Language Model

* Explain Issue
* Root Cause Analysis
* Recommendation
* Explain Persisted Priority
* Repository Summary
* Refactoring Suggestion

---

## Supervised Issue Prioritization

* Human-reviewed Priority Labels
* Versioned feature extraction
* Small supervised classifier
* Severity-based fallback baseline
* Repository-grouped evaluation
* Macro-F1 and Critical Recall comparison

---

## Dashboard

* Repository Overview
* Code Quality Score
* Issue List
* AI Recommendation
* Export Report

---

## AI Assistant

ผู้ใช้สามารถสอบถาม AI ได้ เช่น

* ทำไมโค้ดนี้ถึงผิด
* ควร Refactor อย่างไร
* ปัญหานี้มีผลกระทบอะไร
* ควรแก้อะไรก่อน

---

## MCP Integration (Prototype)

ศึกษาการเชื่อมต่อ Model Context Protocol

เพื่อให้ AI Coding Assistant

* เข้าใจ Coding Standards
* เข้าใจ Best Practices
* เข้าใจ Project Context
* Generate Code ตามมาตรฐานขององค์กร

---

# High-Level Architecture

```text
Repository
      │
      ▼
Semgrep
      │
      ▼
Rule-based Findings
      ├── Deterministic Quality Score
      ├── Supervised Priority Model / Baseline
      └── OpenAI GPT Explanation
      │
      ▼
Dashboard
```

---

# Technology Stack

Frontend

* Next.js
* React
* Tailwind CSS

Backend

* Golang

Database

* PostgreSQL

Static Analysis

* Semgrep Community Edition

AI

* OpenAI GPT API

Issue Prioritization / Evaluation

* Python
* scikit-learn

Container

* Docker

Documentation

* Markdown

Version Control

* GitHub

## Local database (Docker)

The local Supabase/PostgreSQL database is reproducible from the files committed under
`supabase/`. On a new computer, install Docker Desktop, Node.js 24, and PowerShell 7.4+, then run:

```powershell
pwsh ./scripts/database-local.ps1 start
```

This downloads the pinned local tooling when needed and creates the database from the
versioned migrations and safe seed file. See [Local database in Docker](docs/local-database.md)
for reset, stop, data-backup, and secret-handling details.

Future Prototype

* Model Context Protocol (MCP)

---

# Future Product Roadmap

Product Stage 1

* Static Analysis Dashboard

Product Stage 2

* AI Recommendation Engine

Product Stage 3

* AI Chat Assistant

Product Stage 4

* AI Coding Governance

Product Stage 5

* MCP Server

---

# License

Prototype for Academic Project.

---

# Prototype Quick Start

The first runnable prototype includes a responsive dashboard, shadcn/ui-style
components, and a Go REST API with representative AuditorX scan data.

Requirements: Node.js 24+, npm 11+, and Go 1.25+.

Start the API:

```powershell
cd backend
Copy-Item .env.example .env
# Edit .env with your Supabase project URL, publishable key, and database URL.
go run ./cmd/api
```

The API loads `backend/.env` automatically for local development without
overriding variables already set by the operating system or deployment. Keep
the real database password only in the ignored local `.env` file or deployment
secret store. Special characters in the password must be URL-encoded. Without
`DATABASE_URL`, the API starts in prototype-data mode and reports the database
as `not_configured` from `/health`.

Backend code is organized by domain module. Each module owns its HTTP delivery,
service, repository, and entity layers under `backend/internal/modules`.
Cross-cutting infrastructure lives under `backend/internal/shared`, application
configuration lives under `backend/internal/config`, and container files live
under `backend/docker`.

In a second terminal, start the web application:

```powershell
cd frontend
Copy-Item .env.example .env.local
npm ci
npm run dev
```

Open `http://localhost:3000`. The API health endpoint is available at
`http://localhost:8080/health`.

To run all current checks from the repository root:

```powershell
npm --prefix tools/database-tests ci
./scripts/verify.ps1
```

This runs Go formatting checks, vet, tests and build, isolated database tests, followed by frontend lint,
type checks, unit tests and production build. Use `-Target backend` or
`-Target frontend` or `-Target database` to verify one part. GitHub Actions runs the same script,
with the Go race detector enabled on Linux, after the workflow is pushed.

See [development baseline](docs/development-baseline.md) for the implementation
backlog and verification details, and [current API contract](docs/api-contract.md)
for the routes that actually exist. The default demo dashboard's scan, AI and prioritization
data are samples; they are not evidence of a completed repository analysis.

The full academic requirements/design document set (SRS: overview, requirements,
analysis, architecture, database, API, UI, quality, AI, testing) lives under
[`docs/srs/`](docs/srs/README.md). Every requirement, use case and design section there
is annotated with its real implementation status against the current codebase — use it
as the target scope, not as a description of what already ships today.

Repository metadata persistence and membership checks are now available behind
`REPOSITORY_STORAGE=postgres`. The default remains `prototype`; migrations are never
applied automatically. See [repository persistence](docs/repository-persistence.md)
before enabling it. The `/repositories` page now supports creation and selection, and
`/dashboard?repository={id}` opens the selected repository with explicit empty/error states.
Prototype mode is visibly labeled and remains read-only for repository registration.
Restart the API with this revision so the frontend can read the authenticated `/api/v1/capabilities` endpoint.

A real Semgrep backend pipeline is available behind the separate `SCAN_QUEUE_ENABLED=true`
opt-in. It includes a durable queue, an independently configured worker, cancellation and scan-specific
result APIs. The dashboard now connects start/cancel controls, active status polling, the latest 20 scans
and actual findings with severity/search filters. New scans use 14 reviewed `baseline-v2` rules across
Python, JavaScript/TypeScript and Go; historical `baseline-v1` jobs remain executable. It does not show
invented quality scores or AI results.
The real fixture-to-database-to-API flow is tested; full-stack signed-in browser validation and production
isolation remain pending. See [scan pipeline setup and limits](docs/scan-pipeline.md) before enabling it.
