# Non-Functional Requirements

> **Project:** AuditorX  
> **Status:** Draft

## Performance

### NFR-PERF-001
API สำหรับหน้าจอทั่วไปที่ไม่เรียก External Service ต้องตอบสนองที่ p95 ไม่เกิน 3 วินาที ภายใต้ test profile ที่มีผู้ใช้งานพร้อมกัน 20 ราย โดยต้องบันทึก Hardware, Dataset และ Network condition ที่ใช้ทดสอบ

### NFR-PERF-002
ระบบต้องแสดงสถานะเมื่อกระบวนการใช้เวลานาน

### NFR-PERF-003
Scan ของผู้ใช้งานหนึ่งรายต้องไม่ทำให้ผู้ใช้งานรายอื่นใช้งานระบบไม่ได้

### NFR-PERF-004
ระบบต้องบันทึก `started_at` และเวลาสิ้นสุดของทุก Scan พร้อมแสดงระยะเวลา โดย Performance Test ต้องรายงานผลแยกตามขนาด Repository, Rule Set และ External Service; MVP ไม่กำหนด Scan-duration SLA เดียวสำหรับทุกขนาด Repository

---

## Security

### NFR-SEC-001
ระบบต้องตรวจสอบตัวตนก่อนเข้าถึงข้อมูลที่ไม่ใช่สาธารณะ

### NFR-SEC-002
ระบบต้องตรวจสอบสิทธิ์ Repository ทุกครั้ง

### NFR-SEC-003
รหัสผ่านต้องเก็บในรูปแบบ Hash

### NFR-SEC-004
API Key และ Token ต้องไม่ถูกแสดงหรือบันทึกลง Log โดยตรง

### NFR-SEC-005
Production ต้องใช้การเชื่อมต่อที่เข้ารหัส

### NFR-SEC-006
ระบบต้อง Validate Input

### NFR-SEC-007
ระบบต้องส่ง Source Code ให้ AI เฉพาะส่วนที่จำเป็น

### NFR-SEC-008
Credential, Secret และ Sensitive Data ต้องไม่ถูกส่งให้ AI โดยไม่มีการควบคุม

---

## Usability

### NFR-USA-001
UI ต้องมีรูปแบบสม่ำเสมอและเข้าใจง่าย

### NFR-USA-002
Error Message ต้องเข้าใจได้

### NFR-USA-003
Severity ต้องแยกได้อย่างชัดเจนโดยไม่พึ่งพาสีอย่างเดียว

### NFR-USA-004
ผู้ใช้งานต้องเข้าถึง Issue Detail จาก Dashboard ได้ภายในไม่เกิน 2 navigation actions

### NFR-USA-005
หน้าจอหลักต้องใช้งานได้ตั้งแต่ viewport กว้าง 360 ถึง 1440 pixels โดยไม่เกิด horizontal page scrolling ยกเว้นภายใน Code Snippet หรือตารางที่มี scroll container เฉพาะ

---

## Reliability

### NFR-REL-001
AI Failure ต้องไม่ทำให้ผล Scan ที่เสร็จแล้วสูญหาย

### NFR-REL-002
ระบบต้องบันทึกสาเหตุเมื่อ Scan Failed

### NFR-REL-003
ระบบต้องป้องกันการบันทึกผลซ้ำจากคำขอเดียวกันโดยไม่จำเป็น

### NFR-REL-004
Repository, Scan และ Issue ต้องมีความสอดคล้องกันในฐานข้อมูล

### NFR-REL-005
Prediction เดิมต้องยังตีความย้อนหลังได้ด้วย model version, feature schema version และ dataset version ที่เกี่ยวข้อง

---

## Maintainability

### NFR-MAIN-001
Frontend, Backend, Static Analysis และ AI Analysis ต้องแยกความรับผิดชอบชัดเจน

### NFR-MAIN-002
Source Code ต้องปฏิบัติตาม Coding Standard ที่ทีมกำหนด

### NFR-MAIN-003
ส่วนสำคัญต้องมี Log เพื่อสนับสนุนการแก้ไขปัญหา

### NFR-MAIN-004
API และ Component สำคัญต้องมีเอกสารประกอบ

### NFR-MAIN-005
Training และ evaluation pipeline ต้อง reproducible จาก dataset version, split seed, feature schema, algorithm configuration และ source revision ที่บันทึกไว้

---

## Scalability and Extensibility

### NFR-SCALE-001
ระบบต้องเพิ่ม Semgrep Rule Set ได้โดยไม่เปลี่ยนโครงสร้างหลักทั้งหมด

### NFR-SCALE-002
ระบบต้องสามารถเพิ่มภาษาโปรแกรมในอนาคตได้

### NFR-SCALE-003
AI Integration ต้องแยกผ่าน provider interface เพื่อให้เปลี่ยนหรือเพิ่ม Model Provider ได้โดยไม่แก้ Issue domain model

### NFR-SCALE-004
ระบบต้องสามารถเพิ่ม Role หรือ Permission ใหม่ได้

---

## Compatibility

### NFR-COMP-001
Web Application ต้องทำงานบน Modern Browser ที่รองรับ JavaScript

### NFR-COMP-002
ระบบต้องทำงานใน Docker Environment ได้

### NFR-COMP-003
Semgrep Output ต้องสามารถแปลงเข้าสู่ Internal Data Model ของ AuditorX ได้
