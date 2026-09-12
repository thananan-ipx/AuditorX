# Functional Requirements

> **Project:** AuditorX  
> **Document:** Functional Requirements  
> **Status:** Draft

## FR-AUTH — Authentication

### FR-AUTH-001 Registration
ระบบต้องรองรับการสร้างบัญชีด้วยชื่อ นามสกุล อีเมล และรหัสผ่าน

### FR-AUTH-002 Unique Email
ระบบต้องตรวจสอบว่าอีเมลไม่ซ้ำกับบัญชีอื่น

### FR-AUTH-003 Login
ระบบต้องอนุญาตให้ผู้ใช้งานเข้าสู่ระบบด้วยอีเมลและรหัสผ่านที่ถูกต้อง

### FR-AUTH-004 Logout
ระบบต้องอนุญาตให้ผู้ใช้งานออกจากระบบและยกเลิก Session หรือ Token

### FR-AUTH-005 Invalid Credential Handling
ระบบต้องแจ้งเตือนเมื่อข้อมูลเข้าสู่ระบบไม่ถูกต้อง

### FR-AUTH-006 Profile Management
ผู้ใช้งานต้องสามารถดูและแก้ไขข้อมูลโปรไฟล์พื้นฐานได้

### FR-AUTH-007 Role Assignment
Administrator ต้องสามารถกำหนดหรือเปลี่ยนบทบาทผู้ใช้งานได้

**Status: Not yet implemented** — ไม่มี global admin role-assignment endpoint; มีเฉพาะ per-repository membership role (owner/editor/viewer) ที่กำหนดตอนสร้าง Repository

---

## FR-REP — Repository Management

### FR-REP-001 Add Repository
ผู้ใช้งานที่มีสิทธิ์ต้องสามารถเพิ่ม Repository เข้าสู่ระบบได้

### FR-REP-002 Repository Metadata
ระบบต้องจัดเก็บชื่อ, URL, ภาษา, Branch, เจ้าของ Repository และ Repository Criticality แบบ controlled value

**Status: Partially implemented** — ปัจจุบันจัดเก็บเฉพาะ name, owner, url, branch และ status; ยังไม่มีการจัดเก็บ language หรือ criticality

### FR-REP-003 Repository Access Validation
ระบบต้องตรวจสอบสิทธิ์ก่อนเข้าถึง Repository

### FR-REP-004 Repository List
ระบบต้องแสดง Repository ที่ผู้ใช้งานมีสิทธิ์เข้าถึง

### FR-REP-005 Repository Search
ผู้ใช้งานต้องสามารถค้นหา Repository ได้

**Status: Not yet implemented**

### FR-REP-006 Edit Repository
ผู้ใช้งานที่มีสิทธิ์ต้องสามารถแก้ไขรายละเอียด Repository ได้

**Status: Not yet implemented**

### FR-REP-007 Delete Repository
ผู้ใช้งานที่มีสิทธิ์ต้องสามารถลบ Repository โดยมีการยืนยันก่อนดำเนินการ

**Status: Not yet implemented**

### FR-REP-008 Scan History
ระบบต้องแสดงประวัติการวิเคราะห์ของ Repository

---

## FR-SCAN — Source Code Analysis

### FR-SCAN-001 Start Scan
ผู้ใช้งานที่มีสิทธิ์ต้องสามารถเริ่ม Scan ได้

### FR-SCAN-002 Select Branch
ระบบต้องอนุญาตให้เลือก Branch ที่ต้องการวิเคราะห์

**Status: Not yet implemented** — Branch ที่ scan ถูกกำหนดตาย ตัวจาก Branch ที่ลงทะเบียนไว้กับ Repository ผู้ใช้งานยังเลือก Branch ต่อ Scan ไม่ได้

### FR-SCAN-003 Select Rule Set
ระบบต้องรองรับการเลือก Rule Set

**Status: Not yet implemented** — Rule profile ถูกกำหนดตายตัวเป็น "recommended" ฝั่ง server ผู้ใช้งานยังเลือก Rule Set เองไม่ได้

### FR-SCAN-004 Semgrep Analysis
ระบบต้องเรียกใช้ Semgrep เพื่อวิเคราะห์ Source Code

### FR-SCAN-005 Scan Status
ระบบต้องจัดเก็บสถานะ Pending, Running, Completed และ Failed

### FR-SCAN-006 Store Findings
ระบบต้องจัดเก็บ Rule ID, Message, File, Line, Severity และข้อมูลที่เกี่ยวข้อง

### FR-SCAN-007 Supported Languages
ระบบต้นแบบต้องรองรับ JavaScript, TypeScript, Python และ Go ตาม Rule Set ที่กำหนด

**Status: Partially implemented** — scan ใหม่ใช้ Semgrep 14 rules ภายใต้ `baseline-v2` ครอบคลุม Python/JS/TS/Go และ worker ยังรองรับ `baseline-v1` สำหรับงานเก่า แต่ยังไม่ใช่ rule set ที่ผู้ใช้เลือกหรือกำหนดค่าได้

### FR-SCAN-008 Scan Error Handling
ระบบต้องบันทึกสาเหตุและแจ้งเมื่อ Scan ไม่สำเร็จ

### FR-SCAN-009 Re-scan
ผู้ใช้งานต้องสามารถวิเคราะห์ Repository เดิมซ้ำได้

### FR-SCAN-010 Cancel Scan
ผู้ใช้งานที่มีสิทธิ์ต้องสามารถยกเลิก Scan ที่อยู่ในสถานะ Pending หรือ Running ได้ โดยระบบต้องเปลี่ยนสถานะเป็น Cancelled และหยุดงานอย่างปลอดภัย

---

## FR-AI — AI Analysis

**Status: Not yet implemented (all FR-AI-\*)** — ปัจจุบันไม่มี AI/LLM integration ใด ๆ ในโค้ดฐาน (ไม่มีการเรียก OpenAI หรือ LLM provider อื่นใด) ข้อกำหนดในหมวดนี้ยังเป็น planned scope ทั้งหมด

### FR-AI-001 Send Finding Context
ระบบต้องสามารถส่งข้อมูล Finding และ Context ที่จำเป็นให้ LLM

### FR-AI-002 Explain Issue
ระบบต้องสร้างคำอธิบายสาเหตุของ Issue

### FR-AI-003 Analyze Impact
ระบบต้องแสดงผลกระทบที่อาจเกิดขึ้น

### FR-AI-004 Recommend Improvement
ระบบต้องเสนอแนวทางปรับปรุงโดยไม่แก้ไข Source Code อัตโนมัติ

### FR-AI-005 Prioritize Issues
LLM ต้องสามารถอธิบายเหตุผลประกอบ Priority ที่ระบบส่งให้ แต่ต้องไม่สร้างหรือเขียนทับ Priority Prediction

### FR-AI-006 Repository Summary
ระบบต้องสามารถสร้าง AI Summary ของ Repository

### FR-AI-007 AI Advisory Notice
ระบบต้องแจ้งว่าคำแนะนำจาก AI ต้องได้รับการตรวจสอบก่อนใช้งานจริง

### FR-AI-008 Re-analyze
ผู้ใช้งานต้องสามารถร้องขอ AI Analysis ใหม่ได้

### FR-AI-009 AI Failure Handling
หาก AI ใช้งานไม่ได้ ระบบต้องยังแสดงผลจาก Semgrep ได้

---

## FR-PRIO — Supervised Issue Prioritization

**Status: Not yet implemented (all FR-PRIO-\*)** — ยังไม่มี supervised ML / priority-prediction engine ในโค้ดฐาน (ไม่มี Python training code, ไม่มี model serving) ข้อกำหนดในหมวดนี้ยังเป็น planned scope ทั้งหมด

### FR-PRIO-001 Feature Extraction
ระบบต้องสร้าง versioned feature vector จาก Finding และ Repository metrics ที่อนุมัติ โดยไม่ใช้ LLM output เป็น feature สำหรับโมเดล MVP

### FR-PRIO-002 Priority Prediction
ระบบต้องใช้ supervised classification model ทำนาย Priority เป็น Critical, High, Medium หรือ Low

### FR-PRIO-003 Prediction Traceability
ทุก Prediction ต้องอ้างอิง Issue, model version, feature schema version, sanitized feature snapshot, probability/confidence และเวลาที่ทำนาย

### FR-PRIO-004 Baseline Fallback
หากโมเดลไม่พร้อมใช้งาน ระบบต้องใช้ versioned severity-based baseline และระบุแหล่งที่มาของ Priority อย่างชัดเจน

### FR-PRIO-005 Human-reviewed Labels
ผู้ใช้งานที่ได้รับสิทธิ์ต้องสามารถยืนยันหรือแก้ Priority Label เพื่อใช้เป็น Ground Truth สำหรับ training/evaluation รอบถัดไป

### FR-PRIO-006 Model Registration
ระบบต้องเก็บ model version, algorithm, feature schema, training dataset version, metrics และสถานะของโมเดล

### FR-PRIO-007 Model Evaluation
ระบบต้องเปรียบเทียบ candidate model กับ severity-based baseline บน test set ที่แยกตาม Repository และรายงาน Macro-F1, per-class Precision/Recall/F1 และ Confusion Matrix

### FR-PRIO-008 Separation from Severity and Score
Priority Prediction ต้องไม่เขียนทับ Issue Severity และต้องไม่แก้ Code Quality Score โดยตรง

---

## FR-DASH — Dashboard

### FR-DASH-001 Repository Overview
ระบบต้องแสดงชื่อ Repository, Branch, ภาษา และ Scan ล่าสุด

**Status: Partially implemented** — ครอบคลุมบางส่วนโดยหน้า scan/findings จริง (ไม่มีฟิลด์ภาษา)

### FR-DASH-002 Code Quality Score
ระบบต้องแสดง Code Quality Score

**Status: Not yet implemented**

### FR-DASH-003 Issue Count
ระบบต้องแสดงจำนวน Issue รวมและแยกตาม Severity

**Status: Partially implemented** — ครอบคลุมบางส่วนโดยหน้า scan/findings จริง

### FR-DASH-004 Issue Categories
ระบบต้องแสดงจำนวนปัญหาแยกตามประเภท

**Status: Partially implemented** — ครอบคลุมบางส่วนโดยหน้า scan/findings จริง

### FR-DASH-005 Scan Trend
ระบบต้องแสดงประวัติหรือแนวโน้มผล Scan

**Status: Not yet implemented**

### FR-DASH-006 AI Summary
ระบบต้องแสดง AI Summary เมื่อมีข้อมูล

**Status: Not yet implemented**

### FR-DASH-007 Navigate to Issues
ผู้ใช้งานต้องสามารถนำทางจาก Dashboard ไปยัง Issue ที่เกี่ยวข้อง

**Status: Partially implemented** — ครอบคลุมบางส่วนโดยหน้า scan/findings จริง

### FR-DASH-008 Priority Overview
ระบบต้องแสดงจำนวน Issue แยกตาม predicted Priority และระบุ Active model/baseline version กับ fallback count

**Status: Not yet implemented**

> หมายเหตุ: AuditorX มีสองโหมดการทำงาน gated ผ่าน `GET /api/v1/capabilities` — "prototype" mode (ข้อมูล Dashboard เป็น sample/hardcoded, ไม่มี Repository จริง) และ "postgres" mode (Repository จริง; Scan ทำงานได้เมื่อ `SCAN_QUEUE_ENABLED=true` ด้วย) Frontend ระบุชัดเจนว่าข้อมูลใน prototype mode เป็น sample data

---

## FR-ISSUE — Issue Management

> หมายเหตุ: ปัจจุบันยังไม่มี persistent "Issue" entity แยกต่างหาก มีเฉพาะ "Finding" record ต่อ Scan เท่านั้น (ไม่มี status/note/status-history ผูกกับ Finding)

### FR-ISSUE-001 Issue List
ระบบต้องแสดงรายการ Issue

**Status: Implemented** (แสดงเป็น Finding รายการต่อ Scan)

### FR-ISSUE-002 Location
ระบบต้องแสดง File, Line และ Column หากมี

**Status: Implemented** (File, Line — ไม่มี Column)

### FR-ISSUE-003 Rule Information
ระบบต้องแสดง Rule ID และรายละเอียดกฎ

**Status: Implemented**

### FR-ISSUE-004 Code Snippet
ระบบต้องแสดง Code Snippet ที่เกี่ยวข้อง

**Status: Not yet implemented**

### FR-ISSUE-005 Severity
ระบบต้องแสดง Severity อย่างชัดเจน

**Status: Implemented** — ค่า Severity ปัจจุบันมีเพียง High/Medium/Low (ไม่มีระดับ Critical)

### FR-ISSUE-006 AI Detail
ระบบต้องแสดง Explanation, Impact และ Recommendation จาก AI

**Status: Not yet implemented**

### FR-ISSUE-007 Issue Status
ผู้ใช้งานที่มีสิทธิ์ต้องสามารถเปลี่ยน Issue Status

**Status: Not yet implemented** — ไม่มี status field บน Finding/Issue

### FR-ISSUE-008 Note
ผู้ใช้งานต้องสามารถเพิ่มหมายเหตุประกอบ Issue

**Status: Not yet implemented**

### FR-ISSUE-009 Status History
ระบบต้องบันทึกประวัติการเปลี่ยนสถานะ Issue

**Status: Not yet implemented**

---

## FR-FILTER — Search, Filter and Sort

### FR-FILTER-001 Search Issue
ค้นหาจาก Rule, File หรือข้อความที่เกี่ยวข้อง

**Status: Partially implemented** — มี text search บน Finding

### FR-FILTER-002 Filter by Severity
กรองตาม Severity

**Status: Implemented**

### FR-FILTER-003 Filter by Category
กรองตามประเภทปัญหา

**Status: Not yet implemented**

### FR-FILTER-004 Filter by Status
กรองตาม Issue Status

**Status: Not yet implemented**

### FR-FILTER-005 Filter by Language
กรองตามภาษาโปรแกรม

**Status: Not yet implemented**

### FR-FILTER-006 Sort
จัดเรียงตาม Severity, วันที่, File หรือ Status

**Status: Not yet implemented**

### FR-FILTER-007 Clear Filters
ล้างเงื่อนไขค้นหาและตัวกรองทั้งหมด

**Status: Not yet implemented**

### FR-FILTER-008 Filter by Predicted Priority
กรองตาม predicted Priority

**Status: Not yet implemented**

### FR-FILTER-009 Filter by Priority Source
กรองตาม model หรือ baseline source

**Status: Not yet implemented**

---

## FR-REPORT — Reporting

**Status: Not yet implemented (all FR-REPORT-\*)** — ยังไม่มี report generation หรือ download endpoint ใด ๆ ในระบบ

### FR-REPORT-001 Generate Report
ระบบต้องสามารถสร้างรายงานจากผล Scan

### FR-REPORT-002 Report Content
รายงานต้องมี Repository, วันที่, deterministic Score, Issue Summary, Priority distribution พร้อม predictor version/source และ AI Summary หากมี

### FR-REPORT-003 Issue Detail in Report
รายงานต้องแสดง File, Line, Severity และ Recommendation ของ Issue

### FR-REPORT-004 Export
ระบบต้องรองรับการส่งออกรายงานในรูปแบบที่กำหนด

### FR-REPORT-005 Download Existing Report
ผู้ใช้งานต้องสามารถดาวน์โหลด Report เดิมตามสิทธิ์

---

## FR-USER — User Management

### FR-USER-001 User List
Administrator ต้องดูรายการผู้ใช้งานทั้งหมดได้

**Status: Not yet implemented**

### FR-USER-002 User Search
Administrator ต้องค้นหาผู้ใช้งานได้

**Status: Not yet implemented**

### FR-USER-003 Account Status
Administrator ต้องเปิดใช้งานหรือระงับบัญชีได้

**Status: Not yet implemented**

### FR-USER-004 Role Management
Administrator ต้องกำหนดบทบาทได้

**Status: Not yet implemented** — ไม่มี global admin role-change endpoint

### FR-USER-005 Repository Permission
ระบบต้องรองรับการกำหนดสิทธิ์ Repository ต่อผู้ใช้งาน

**Status: Implemented** — ผ่าน per-repository membership role (owner/editor/viewer)

---

## FR-MCP — MCP Prototype

**Status: Not yet implemented (all FR-MCP-\*)** — ยังไม่มี MCP (Model Context Protocol) integration ใด ๆ ในโค้ดฐาน

### FR-MCP-001 Coding Standards Resource
MCP Prototype ต้องสามารถให้ AI Coding Assistant เข้าถึง Coding Standards หรือ Best Practices ที่กำหนด

### FR-MCP-002 Repository Context
MCP Prototype ต้องให้ Repository Context เฉพาะข้อมูลที่ผู้เรียกได้รับอนุญาตและอยู่ภายใน configured scope

### FR-MCP-003 MCP Authorization
ระบบต้องไม่ให้ MCP เข้าถึงข้อมูลที่ไม่มีสิทธิ์

### FR-MCP-004 MCP Logging
ระบบต้นแบบต้องบันทึกประวัติการเรียกใช้ MCP โดยไม่บันทึก Credential หรือ Source Context ที่ละเอียดอ่อนโดยตรง
