# Business Rules

> **Project:** AuditorX  
> **Status:** Draft

## BR-001 Unique Email
อีเมลผู้ใช้งานต้องไม่ซ้ำกัน

## BR-002 Authentication Required
ผู้ใช้งานต้องเข้าสู่ระบบก่อนเข้าถึงข้อมูลที่ไม่ใช่ข้อมูลสาธารณะ

## BR-003 Repository Authorization
ผู้ใช้งานเข้าถึงได้เฉพาะ Repository ที่เป็นเจ้าของหรือได้รับสิทธิ์

## BR-004 Scan Traceability
Scan แต่ละครั้งต้องเชื่อมโยงกับ Repository และ Branch

## BR-005 Scan History
ผล Scan แต่ละครั้งต้องถูกจัดเก็บแยกจากกัน

## BR-006 Severity Source
Severity เริ่มต้นต้องอ้างอิงจาก Semgrep หรือ Mapping Rule ที่ AuditorX กำหนด

## BR-007 Quality Score Consistency
Code Quality Score ต้องใช้สูตรเดียวกันภายใต้ Version ของเกณฑ์เดียวกัน

## BR-008 False Positive
Issue ที่เป็น False Positive ต้องไม่ถูกนับเป็นปัญหาที่ยังต้องแก้ไขในผลสรุปปัจจุบัน แต่ต้องเก็บประวัติ

## BR-009 Resolved History
Issue ที่ Resolved แล้วต้องไม่ถูกลบจากประวัติ

## BR-010 AI Advisory
AI Recommendation เป็นข้อมูลสนับสนุนการตัดสินใจ ไม่ใช่ผลลัพธ์ที่รับประกันความถูกต้อง

## BR-011 No Automatic Source Modification
AuditorX ต้องไม่แก้ไขหรือ Commit Source Code อัตโนมัติ

## BR-012 Static Analysis Survives AI Failure
หาก AI ไม่พร้อมใช้งาน ผล Semgrep ต้องยังแสดงได้

## BR-013 Minimum Necessary AI Context
ข้อมูลที่ส่งให้ AI ต้องจำกัดเฉพาะข้อมูลที่จำเป็น

## BR-014 Admin-only Role Management
เฉพาะ Administrator เท่านั้นที่กำหนดบทบาทหรือระงับบัญชีผู้ใช้งานได้

**Status: Not yet implemented** — ปัจจุบันไม่มี global admin role/account management endpoint ใด ๆ; มีเพียง per-repository membership role (owner/editor/viewer) ที่กำหนดตอนสร้าง Repository เท่านั้น

## BR-015 Priority Separation
Issue Severity, deterministic Code Quality Score และ predicted Priority เป็นคนละแนวคิดและต้องไม่เขียนทับกัน

## BR-016 Human Ground Truth
Priority Label ที่ใช้เป็น Ground Truth ต้องผ่าน Human Review; LLM output ห้ามถูกใช้เป็น Ground Truth โดยอัตโนมัติ

## BR-017 Repository-grouped Split
ตัวอย่างจาก Repository เดียวกันต้องไม่อยู่ข้าม train, validation และ test partitions ใน evaluation run เดียวกัน

## BR-018 Model Promotion
Candidate model จะเป็น Active ได้เมื่อผ่าน evaluation protocol ที่บันทึกไว้และมี Macro-F1 บน test set ไม่ต่ำกว่า severity-based baseline

## BR-019 Prediction Fallback
เมื่อ Active model ใช้งานไม่ได้ ระบบต้องใช้ versioned severity baseline และแสดง `priority_source` ให้ผู้ใช้ทราบ
