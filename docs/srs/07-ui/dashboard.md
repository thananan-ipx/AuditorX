# Dashboard Specification

> **Project:** AuditorX  
> **Related Use Case:** `UC-005`  
> **Related Requirements:** `FR-DASH-*`  
> **Status:** Draft

---

## 1. Purpose

Dashboard แสดงภาพรวมคุณภาพของ Repository โดยสรุปผล Scan ล่าสุดและแนวโน้มในอดีต

**Implementation status:** The widgets below (Code Quality Score, Category Summary, Scan Trend, AI Summary) exist today only in a legacy "prototype" dashboard populated with fixed sample data (`frontend/features/dashboard/pages/dashboard-page-client.tsx`), rendered when `capabilities.repository_storage !== "postgres"`. When the workspace is backed by Postgres with the scan queue enabled (`repository_storage === "postgres" && scan_queue === true`), the app instead shows the real Scans workspace (`frontend/features/scans/components/repository-scans.tsx`) described in `docs/07-ui/screen-specifications.md`, which has no quality score, no AI summary, no category breakdown and no scan trend — only scan history, scan detail, and a read-only findings list. This document's widgets remain the target design for the real workspace and are not yet implemented there.

---

## 2. Required Widgets

### Repository Header
- Repository name
- Branch
- Primary language
- Latest scan date

### Code Quality Score

**Implementation status: Not yet built** for the real (Postgres) workspace — see `docs/08-quality/code-quality-score.md`. Currently rendered only in the sample-data prototype dashboard.

- Numeric score 0–100
- Quality level
- Score version if needed internally

### Issue Summary
- Total
- Critical
- High
- Medium
- Low

### Category Summary
- Security
- Code Quality
- Coding Standard
- Best Practice

### Scan Trend
- Scan time/date
- Quality Score
- Issue count

### AI Summary

**Implementation status: Not yet built.** No AI summary/explanation panel exists in the real workspace; only the sample-data prototype dashboard renders one.

- Major risks
- Recommended priorities
- Confidence/context note where appropriate

---

## 3. User Actions

- Filter Issue List by selected Severity — implemented today as a severity filter (High/Medium/Low, no Critical) on the Findings list within a completed scan, not a separate Issue List screen
- Filter Issue List by selected Category — **Not yet built.** No category field or filter exists on findings today
- Open Scan History — implemented: latest 20 scans, newest first
- Open latest scan — implemented via selecting a scan from Scan History
- Generate report — **Not yet built.** No report generation/export/download exists anywhere in the UI

---

## 4. No-data State

If repository has never been scanned:

```text
No scan data available.
Start a scan to generate quality metrics.
```

Do not fabricate zero-risk or perfect-score data.

---

## 5. AI-unavailable State

If static scan completed but AI analysis failed:

- Show static metrics normally
- Show AI section as unavailable
- Allow retry if user has permission

---

## 6. Data Source

Dashboard data is served by:

```text
GET /api/v1/repositories/{repository_id}/dashboard
```

This endpoint currently backs only the sample-data prototype dashboard. The real Scans workspace instead reads scan and finding data via `frontend/features/scans/service/scan-service.ts`.

---

## 7. Quality Score

Score is deterministic and defined in:

`docs/08-quality/code-quality-score.md`

AI does not directly calculate or overwrite numeric score.

**Implementation status: Not yet built.** No score is computed or stored anywhere in the codebase today; see `docs/08-quality/code-quality-score.md` for details.

---

## 8. Traceability

- `FR-DASH-001` Repository Overview
- `FR-DASH-002` Code Quality Score
- `FR-DASH-003` Issue Count
- `FR-DASH-004` Categories
- `FR-DASH-005` Scan Trend
- `FR-DASH-006` AI Summary
- `FR-DASH-007` Issue Navigation
