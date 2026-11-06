# โปรเจกต์และพาธสำหรับเดโม AuditorX

ตรวจเมื่อ 2026-11-06 ใช้เว็บ http://localhost:3001/repositories
พาธด้านล่างอยู่ใน volume ที่ worker อ่านได้แล้ว ไม่ต้องอัปโหลดหรือตั้ง volume ใหม่
ใช้สแกนซอร์สได้โดยไม่ต้องเปิดแอปเป้าหมาย ติดตั้ง dependency หรือเชื่อมฐานข้อมูลของโปรเจกต์นั้น

## 1. เดโมหลัก: Next.js Scan Lab

พาธสำหรับวางในช่อง Local path:

```text
C:\Users\thana\Documents\GitHub\IProgressX\auditor-x\examples\nextjs-scan-lab
```

มีโค้ดตัวอย่างก่อนและหลังแก้ 12 กลุ่ม ใช้ข้อมูลปลอมทั้งหมด
สแกนที่ตรวจไว้พบ 25 findings; สแกนที่ติด label ครบมี simulated 12 และ excluded 13
Priority ของ simulated: High 6 / Medium 3 / Low 3

[เปิดสแกนที่มี label ครบ](http://localhost:3001/dashboard?repository=40e909da-d88d-42ad-b7e8-ada89b13c289&scan=d323821f-2669-40d0-92fe-e5c2622e57f2)

เหมาะสำหรับโชว์ผลสแกน → เปิดไฟล์และเหตุผล → ติด label → ส่งออก CSV
มีสแกนใหม่กว่าของพาธนี้ที่ยังไม่มี label; ใช้ลิงก์ข้างบนเมื่อต้องการโชว์ข้อมูลที่เตรียมแล้ว

## 2. โปรเจกต์ที่ผู้ใช้พัฒนาเอง: inventory-card

```text
C:\Users\thana\Documents\GitHub\IProgressX\inventory-card
```

สแกนที่ตรวจไว้พบ 11 findings: simulated Low 3 / excluded 8
เจ้าของยืนยันว่าเป็นโปรเจกต์ทดลองและใช้ข้อมูลทดสอบ

[เปิดผล inventory-card](http://localhost:3001/dashboard?repository=40e909da-d88d-42ad-b7e8-ada89b13c289&scan=1bd9fa83-605e-4463-ae8f-05c20f637b06)

เหมาะสำหรับอธิบายการตรวจผลแจ้งผิด: เรียก login หรือ bcrypt ไม่ได้แปลว่ามีการ log รหัสผ่าน
สาม label ทดลองที่เหลือเป็นงาน validation ฝั่งเซิร์ฟเวอร์

## 3. เคสสแกนแล้วไม่พบรายการ: kk-town-gang-planner

```text
C:\Users\thana\Documents\GitHub\IProgressX\kk-town-gang-planner
```

สแกนที่ตรวจไว้ completed และพบ 0 findings

[เปิดผล kk-town-gang-planner](http://localhost:3001/dashboard?repository=40e909da-d88d-42ad-b7e8-ada89b13c289&scan=7032183f-5d0b-4ea7-a4e9-b9838c60c8d2)

ใช้โชว์หน้าผลสแกนที่ไม่มีรายการ ไม่ใช่หลักฐานรับรองว่าโค้ดปลอดภัยหรือไม่มีบั๊ก

## 4. สำรอง: label จำลองสามระดับใน family เดียว

```text
C:\Users\thana\Documents\GitHub\IProgressX\auditor-x\artifacts\datasets\priority-source-v3\projects\lab-html
```

[เปิดผล lab-html](http://localhost:3001/dashboard?repository=40e909da-d88d-42ad-b7e8-ada89b13c289&scan=eb07d145-b189-4fb4-aa43-5f6c69b1fd43)

มี 9 findings และ simulated labels 9: High 3 / Medium 5 / Low 1
เป็น source fixture ที่สำเนาโค้ดเพื่อเปลี่ยนบริบทสมมติ ไม่ใช่ 9 ปัญหาจากโปรเจกต์อิสระ
เหมาะสำหรับอธิบายว่าปัญหาแบบเดียวกันอาจถูกกำหนด Priority ต่างกันตามเกณฑ์และบริบท

## ลำดับเดโมประมาณ 5 นาที

1. เปิด Repositories → โปรเจกต์จากเครื่อง แสดงชื่อ พาธ สถานะ และจำนวน findings
2. เปิด Next.js Scan Lab ด้วยลิงก์สแกนที่มี label ครบข้างบน
3. โชว์ผลสแกนและ Severity แล้วเปิดแท็บติด label เพื่ออธิบาย Priority และ simulated/excluded
4. เปิด inventory-card เพื่ออธิบายการตรวจผลแจ้งผิดและเหตุผลที่คัดออกจากชุดเทรน
5. ส่งออก simulated training CSV จากสแกน lab ที่เตรียมไว้
6. เปิดรายงาน output/ml/coursework-v3/report.md เพื่อโชว์การฝึกและผลเทียบ baseline
7. หากจะสแกนสด เลือก Local path แล้ววางพาธข้อ 1 หรือข้อ 2 และรอจน scan/prediction เสร็จ

label ผูกกับ scan snapshot: สแกนใหม่จะได้ผลและคำทำนายใหม่ แต่ไม่คัดลอก label เก่ามารับรองอัตโนมัติ
ตัวเลข finding อ้างอิงสแกนที่ตรวจไว้ หากเปลี่ยนโค้ดหรือ rules ผลสแกนใหม่อาจต่างออกไป

## อธิบายโมเดลให้ตรงกับการทำงานจริง

โมเดลที่ export ล่าสุดคือ v3 จาก simulated data 111 แถว (train 75 / validation 18 / test 18)
Decision Tree Macro-F1 0.956 เทียบ baseline 0.417 บน test ชุดเดียวกัน
คะแนนนี้วัดการเรียนรู้ rubric จำลอง ยังไม่ยืนยันความแม่นยำบนโปรเจกต์จริง

เว็บยังใช้โมเดลทดลอง v1 ตามการตั้งค่าปัจจุบัน; ไฟล์ v3 ที่ฝึกไว้ยังไม่ได้เปิดใช้ใน service
High/Medium/Low ที่เตรียมในแท็บ label เป็นข้อมูลจำลองสำหรับฝึก ไม่ใช่คำทำนายของ v3 บนเว็บ
สแกนอย่างเดียวไม่ทำให้โมเดลเรียนรู้เพิ่ม ต้องตรวจ label แล้วเทรนและประเมินรุ่นใหม่เป็นขั้นแยก
