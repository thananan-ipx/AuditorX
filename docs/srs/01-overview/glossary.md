# Glossary

> **Project:** AuditorX  
> **Status:** Draft

| Term | Definition |
|---|---|
| AuditorX | ระบบตรวจสอบและวิเคราะห์คุณภาพซอร์สโค้ดด้วย AI |
| AI | Artificial Intelligence |
| LLM | Large Language Model |
| Source Code | ชุดคำสั่งของโปรแกรมที่เขียนด้วยภาษาโปรแกรม |
| Repository | แหล่งจัดเก็บซอร์สโค้ดและประวัติการเปลี่ยนแปลง |
| Branch | แนวการพัฒนาหนึ่งภายใน Repository |
| Commit | Snapshot ของการเปลี่ยนแปลงใน Repository |
| Static Code Analysis | การวิเคราะห์ซอร์สโค้ดโดยไม่ต้องรันโปรแกรม |
| Semgrep | Static Analysis Tool หลักของ AuditorX |
| Rule | กฎที่ใช้ค้นหารูปแบบปัญหาใน Source Code |
| Rule Set | กลุ่ม Rule ที่ใช้ในการ Scan |
| Finding | ผลการตรวจพบจาก Static Analysis Engine |
| Issue | ปัญหาที่ AuditorX จัดเก็บและนำเสนอแก่ผู้ใช้งาน |
| Code Smell | ลักษณะของโค้ดที่อาจทำให้บำรุงรักษายาก |
| Security Vulnerability | ช่องโหว่ที่อาจถูกนำไปใช้โจมตีระบบ |
| Coding Standard | มาตรฐานหรือแนวทางในการเขียนโค้ด |
| Best Practice | แนวปฏิบัติที่ช่วยเพิ่มคุณภาพของซอฟต์แวร์ |
| Severity | ระดับความรุนแรงของ Finding ตาม Semgrep หรือ versioned mapping |
| Code Quality Score | คะแนนที่ AuditorX ใช้สรุปคุณภาพของ Repository |
| Issue Priority | ลำดับความเร่งด่วนในการแก้ Issue ซึ่งแยกจาก Severity |
| Priority Label | Ground-truth priority ที่มนุษย์ผู้มีสิทธิ์ตรวจทานและยืนยัน |
| Priority Prediction | Priority ที่ supervised model ทำนายพร้อม model version และ confidence |
| Baseline | วิธีอ้างอิงแบบไม่เรียนรู้ เช่น mapping จาก Severity เพื่อใช้เปรียบเทียบโมเดล |
| Macro-F1 | ค่าเฉลี่ย F1 ของทุกคลาสโดยให้น้ำหนักแต่ละคลาสเท่ากัน |
| Data Leakage | การที่ข้อมูลจาก train ปรากฏหรือสัมพันธ์ใกล้เกินไปกับ validation/test จนผลประเมินสูงเกินจริง |
| Dashboard | หน้าสรุปข้อมูลคุณภาพและผลการวิเคราะห์ |
| Scan | กระบวนการวิเคราะห์ Repository หนึ่งครั้ง |
| Scan History | ประวัติการ Scan ของ Repository |
| AI Analysis | การใช้ LLM วิเคราะห์ผลจาก Static Analysis |
| AI Recommendation | คำแนะนำจาก AI สำหรับปรับปรุง Source Code |
| False Positive | Finding ที่ตรวจพบแต่ไม่ถือเป็นปัญหาจริงในบริบทนั้น |
| Accepted Risk | Issue ที่รับทราบความเสี่ยงและยังไม่แก้ไข |
| RESTful API | รูปแบบ API ที่สื่อสารผ่าน HTTP |
| MCP | Model Context Protocol |
| AI Coding Assistant | เครื่องมือ AI ที่ช่วยสร้าง แก้ไข หรืออธิบายโค้ด |
| Traceability | ความสามารถในการติดตามความสัมพันธ์ระหว่าง Requirement, Use Case, Design และ Test |
