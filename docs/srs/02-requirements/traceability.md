# Requirements Traceability

> **Project:** AuditorX  
> **Status:** Draft

## 1. Purpose

เอกสารนี้ใช้ติดตามความสัมพันธ์ระหว่าง Requirement, Use Case, Design และ Test Case

## 2. Master Use Case Mapping

| Requirement Group | Use Case ID | Use Case |
|---|---|---|
| `FR-AUTH-*` | `UC-001` | เข้าสู่ระบบ |
| `FR-REP-*` | `UC-002` | จัดการ Repository |
| `FR-SCAN-*` | `UC-003` | วิเคราะห์ซอร์สโค้ด |
| `FR-AI-*` | `UC-004` | วิเคราะห์ผลด้วยปัญญาประดิษฐ์ |
| `FR-DASH-*` | `UC-005` | ดู Dashboard |
| `FR-ISSUE-*` | `UC-006` | ตรวจสอบและจัดการรายละเอียด Issue |
| `FR-PRIO-001`–`FR-PRIO-005`, `FR-PRIO-008` | `UC-006` | ดู Prediction และบันทึก Human-reviewed Priority Label |
| `FR-PRIO-006`, `FR-PRIO-007` | `UC-012` | ประเมินและเปิดใช้ Priority Model |
| `FR-FILTER-*` | `UC-007` | ค้นหา กรอง และจัดเรียง Issue |
| `FR-REPORT-*` | `UC-008` | สร้างและดาวน์โหลดรายงาน |
| `FR-USER-*` | `UC-009` | จัดการผู้ใช้งานและสิทธิ์ |
| `FR-REP-008`, `FR-SCAN-009` | `UC-010` | ดูประวัติการวิเคราะห์ |
| `FR-MCP-*` | `UC-011` | เข้าถึง Coding Standards ผ่าน MCP |

## 3. Traceability Convention

ตัวอย่าง:

```text
FR-SCAN-001
    ↓
UC-003
    ↓
AD-003
    ↓
SD-003
    ↓
TC-SCAN-001
```

## 4. Initial Traceability Matrix

| Requirement ID | Use Case | Activity Diagram | Sequence Diagram | Test Case | Status | Implementation |
|---|---|---|---|---|---|---|
| FR-AUTH-003 | UC-001 | AD-001 | SD-001 | TC-AUTH-001 | Mapped | Implemented |
| FR-REP-001 | UC-002 | AD-002 | SD-002 | TC-REP-001 | Mapped | Implemented |
| FR-SCAN-001 | UC-003 | AD-003 | SD-003 | TC-SCAN-001 | Mapped | Partially implemented (branch/rule set fixed, not user-selectable) |
| FR-SCAN-006 | UC-003 | AD-003 | SD-003 | TC-SCAN-002 | Mapped | Implemented |
| FR-SCAN-009 | UC-003, UC-010 | AD-003, AD-010 | SD-003, SD-010 | TC-SCAN-005 | Mapped | Implemented |
| FR-SCAN-010 | UC-003 | AD-003 | SD-003 | TC-SCAN-006 | Mapped | Implemented |
| FR-AI-002 | UC-004 | AD-004 | SD-004 | TC-AI-001 | Mapped | Not implemented |
| FR-AI-004 | UC-004 | AD-004 | SD-004 | TC-AI-001 | Mapped | Not implemented |
| FR-AI-005 | UC-004 | AD-004 | SD-004 | TC-AI-001 | Mapped | Not implemented |
| FR-AI-008 | UC-004 | AD-004 | SD-004 | TC-AI-003 | Mapped | Not implemented |
| FR-AI-006 | UC-004 | AD-004 | SD-004 | TC-AI-004 | Mapped | Not implemented |
| FR-DASH-002 | UC-005 | AD-005 | SD-005 | TC-DASH-001 | Mapped | Not implemented |
| FR-DASH-008 | UC-005 | AD-005 | SD-005 | TC-DASH-003 | Mapped | Not implemented |
| FR-ISSUE-002 | UC-006 | AD-006 | SD-006 | TC-ISSUE-001 | Mapped | Implemented |
| FR-ISSUE-007 | UC-006 | AD-006 | SD-006 | TC-ISSUE-002 | Mapped | Not implemented |
| FR-PRIO-002 | UC-006 | AD-006 | SD-006 | TC-PRIO-001 | Mapped | Not implemented |
| FR-PRIO-003 | UC-006 | AD-006 | SD-006 | TC-PRIO-002 | Mapped | Not implemented |
| FR-PRIO-004 | UC-006 | AD-006 | SD-006 | TC-PRIO-003 | Mapped | Not implemented |
| FR-PRIO-005 | UC-006 | AD-006 | SD-006 | TC-PRIO-004 | Mapped | Not implemented |
| FR-PRIO-006, FR-PRIO-007 | UC-012 | AD-012 | SD-012 | TC-PRIO-005 | Mapped | Not implemented |
| FR-PRIO-008 | UC-006 | AD-006 | SD-006 | TC-PRIO-006 | Mapped | Not implemented |
| FR-FILTER-002 | UC-007 | AD-007 | N/A (query-only) | TC-FILTER-001 | Mapped | Implemented |
| FR-FILTER-007 | UC-007 | AD-007 | N/A (query-only) | TC-FILTER-002 | Mapped | Not implemented |
| FR-FILTER-008, FR-FILTER-009 | UC-007 | AD-007 | N/A (query-only) | TC-FILTER-003 | Mapped | Not implemented |
| FR-REPORT-001 | UC-008 | AD-008 | SD-008 | TC-REPORT-001 | Mapped | Not implemented |
| FR-USER-004 | UC-009 | AD-009 | SD-009 | TC-USER-001 | Mapped | Not implemented |
| FR-REP-008 | UC-010 | AD-010 | SD-010 | TC-HISTORY-001 | Mapped | Implemented |
| FR-MCP-001 | UC-011 | AD-011 | SD-011 | TC-MCP-001 | Mapped | Not implemented |

> "Status" หมายถึงการทำ documentation traceability mapping ให้ครบ (Mapped) ส่วน "Implementation" หมายถึงสถานะโค้ดจริงในระบบ ณ ปัจจุบัน (ดูรายละเอียดเพิ่มเติมต่อ Requirement ใน `requirements.md`)

## 5. Rules

1. Requirement ID ต้องไม่เปลี่ยนโดยไม่มีการอัปเดตเอกสารที่เกี่ยวข้อง
2. Use Case ID ต้องตรงกับ Master Use Case List
3. Test Case ต้องอ้างอิง Requirement หรือ Use Case ที่ทดสอบ
4. Diagram ID ควรสัมพันธ์กับ Use Case เมื่อเป็นกระบวนการเดียวกัน
5. หาก SRS และ Markdown ไม่ตรงกัน ให้ยึด SRS ฉบับที่ได้รับการอนุมัติล่าสุด
6. ตารางนี้เป็นชุดการเชื่อมโยงหลักสำหรับ critical flows ไม่ใช่รายการ coverage ของ Requirement ทุกข้อ; coverage ฉบับสมบูรณ์ต้องเพิ่มแถวสำหรับ Requirement ที่เหลือก่อนอนุมัติเอกสาร
