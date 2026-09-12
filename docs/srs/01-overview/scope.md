# Software Scope

> **Project:** AuditorX  
> **Status:** Draft

## 1. In Scope

AuditorX รุ่นต้นแบบครอบคลุมความสามารถดังต่อไปนี้

1. Authentication และ User Role
2. Repository Management
3. การเชื่อมต่อหรือรับ Repository เพื่อวิเคราะห์
4. รองรับ JavaScript, TypeScript, Python และ Go ตาม Rule Set ที่กำหนด
5. Static Code Analysis ด้วย Semgrep Community Edition
6. ตรวจจับ Code Smell
7. ตรวจจับ Security Vulnerability
8. ตรวจสอบ Coding Standards
9. ตรวจสอบ Best Practices
10. จัดเก็บ Scan Result และ Issue
11. AI Explanation
12. AI Impact Analysis
13. AI Recommendation
14. Dashboard
15. Code Quality Score
16. Severity
17. Issue Status
18. Search / Filter / Sort
19. Scan History
20. Report Generation
21. User Management
22. MCP Prototype
23. Supervised Issue Prioritization จาก feature ที่ระบบกำหนด
24. Human-reviewed Priority Label สำหรับ training/evaluation
25. Model versioning และ Prediction traceability
26. Evaluation เปรียบเทียบ severity baseline กับ supervised prioritizer
27. Evaluation เปรียบเทียบ Semgrep-only, LLM-only และ AuditorX Hybrid

## 2. Out of Scope

AuditorX รุ่นต้นแบบไม่ครอบคลุม

1. Automatic Code Refactoring
2. Automatic Commit
3. Automatic Pull Request
4. Runtime Performance Analysis
5. Dynamic Application Security Testing
6. Penetration Testing
7. CI/CD Platform
8. การรองรับทุกภาษาโปรแกรม
9. Custom LLM Training
10. Production-grade MCP Platform
11. การเชื่อมต่อ AI Coding Assistant ทุกแพลตฟอร์ม
12. การรับประกันการตรวจพบ Bug หรือ Vulnerability ทั้งหมด
13. Dependency License Compliance แบบเต็มรูปแบบ
14. Training หรือ Fine-tuning Large Language Model
15. การฝึกโมเดลจาก Source Code ดิบแบบ end-to-end
16. การใช้ LLM-generated label เป็น Ground Truth โดยไม่มี Human Review

## 3. Supported Languages

- JavaScript
- TypeScript
- Python
- Go

รายการภาษาอาจเปลี่ยนแปลงตามระยะเวลาและทรัพยากรของโครงการ

## 4. External Dependencies

- GitHub
- Semgrep
- OpenAI API
- Python / scikit-learn สำหรับ offline priority training และ evaluation
- PostgreSQL
- Docker
- MCP-compatible client สำหรับ Prototype

## 5. Constraints

- คุณภาพของ Static Analysis ขึ้นอยู่กับ Rule Set
- ผล AI อาจคลาดเคลื่อนและต้องได้รับการตรวจสอบ
- AI ต้องอาศัย API และ Internet
- เวลา Scan ขึ้นอยู่กับขนาด Repository และทรัพยากร
- Code Quality Score เป็นเกณฑ์ภายในโครงการ
- คุณภาพของ supervised prioritizer ขึ้นอยู่กับจำนวนและความสม่ำเสมอของ human-reviewed labels
- Dataset split ต้องแยกตาม Repository เพื่อป้องกันข้อมูลจากโครงการเดียวกันรั่วข้าม train/test
