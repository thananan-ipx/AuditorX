# AuditorX Next.js Scan Lab

โปรเจกต์ Next.js ที่ตั้งใจใส่ข้อบกพร่อง 12 กลุ่ม พร้อมไฟล์คู่แก้แล้ว 12 ไฟล์
ใช้ข้อมูลและ credential ปลอมทั้งหมด สำหรับทดลอง scanner และเก็บชุดข้อมูลจากซอร์ส
อย่านำโปรเจกต์นี้ไป deploy เป็นบริการจริง; dev/start ผูกเฉพาะ 127.0.0.1:3012

## ใช้งาน

```powershell
npm ci
npm run build
npm run dev
```

หน้าแรกแสดงรายชื่อ source pairs โปรเจกต์นี้ไม่มี external database/account
orders/profiles อยู่ในหน่วยความจำ และ demo actor ถูกกำหนดเป็น Alice สำหรับเทียบ ownership
SQL เป็น mock sink ที่ไม่ execute SQL; client-boundary เป็น fixture นอก app import graph
จึงเป็นการทดสอบรูปแบบโค้ด ไม่ได้ยืนยันว่าแต่ละ finding exploit ได้จริง

## สแกนจาก AuditorX

ใส่พาธ `auditor-x/examples/nextjs-scan-lab` ใน Dashboard → สแกนจากพาธ
worker อ่าน source ผ่าน volume เดิม ไม่ต้องอัปโหลดหรือรันแอปนี้

`cases.json` ระบุ expected rule, source คู่ unsafe/fixed, group และ proposed priority
ข้อเสนอ High/Medium/Low อิงสถานการณ์สอนที่สมมติ ไม่ใช่ human ground truth และไม่ใช่
การจัดความเสี่ยง production ของแอป local นี้ ต้องคง provenance นี้เมื่อทำ dataset

กฎ Manual review ต้องแจ้งทั้ง unsafe และ fixed ได้ ให้ตรวจโค้ดแล้ว excluded ฝั่ง fixed
API handler advisory อาจซ้ำกับ security finding ใน route เดียวกัน ห้ามนับซ้ำเพื่อเพิ่มข้อมูล
ให้ group คู่ก่อน/หลังแก้และโค้ดที่แตกมาจากต้นแบบเดียวกันไว้ split เดียวกัน
12 กลุ่มในโปรเจกต์เดียวนี้มีไว้ทดสอบ pipeline ยังไม่พออ้าง generalization กับโปรเจกต์จริง
