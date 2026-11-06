# ชุดทดลอง source labs v3

วันที่ 2026-11-06: สร้าง source fixture projects 12 ชุดจากคู่ unsafe/fixed
ใน nextjs-scan-lab สแกนจริงผ่าน Go worker และ Semgrep baseline-v4 โดยไม่รันแอป
ติด label เป็น simulated ลงฐานข้อมูล AuditorX เท่านั้น ไม่มีการสร้าง human-confirmed labels

แต่ละ family มี 9 บริบทสมมติ (criticality 3 ค่า × impact 3 ค่า) รวม 108 ตัวอย่างหลัก
ทั้ง 9 บริบทเป็นโค้ดสำเนาในกลุ่มเดียวกัน ไม่ใช่โปรเจกต์อิสระ 9 โปรเจกต์
actual exposure เป็น test_only ทุกแถว; ค่า criticality/impact เป็นสมมติฐานเพื่อการเรียน
ไม่ใช่ข้อเท็จจริงของบริการที่ใช้งานจริง โฟลเดอร์เหล่านี้เป็น scan-only fixtures ไม่ใช่แอปที่พร้อม deploy

ผลจริง: สแกนหลัก 12 งาน completed, 108 simulated labels (High 21 / Medium 54 / Low 33),
117 findings ที่เป็นไฟล์คู่ควบคุมหรือ advisory ซ้ำถูก excluded ไม่ใช้ฝึก
ประวัติมี preflight เพิ่มหนึ่งสแกนที่ยังไม่มี Next.js package marker จึงไม่มี finding;
คงไว้ในประวัติและไม่นับเป็นข้อมูลทดลอง

## แบ่งข้อมูลก่อนฝึก

กำหนด split ใน manifest ตั้งแต่สร้าง source ก่อนสแกนหรือดูคะแนน
unsafe/fixed, บริบทสำเนา และ clone group อยู่ split เดียวกัน
ownership กับ status ใช้ clone group เดียวกันและอยู่ train ทั้งคู่
ตรวจ SHA-256 ของ source ไม่ให้ไฟล์ตัวอย่างที่เหมือนกันข้าม split
shared mock boilerplate ไม่ใช่ตัวอย่าง และไม่ถูกใช้เป็น feature

| Split | Families | Rows |
|---|---|---:|
| Train | html, public-secret, sql, ownership, status, redirect, credentials, client-boundary | 72 |
| Validation | logging, shell | 18 |
| Test | eval, cache | 18 |

เพิ่ม inventory-card 3 simulated labels เดิมเฉพาะ train รวมเป็น **75 / 18 / 18 = 111 แถว**
ไม่ได้รวม lab 12 แถวเดิมซ้ำอีก เพราะโค้ดต้นแบบถูกนำมาขยายบริบทในชุดใหม่นี้แล้ว
inventory-card ใช้เหตุผลจากการตรวจโค้ดโดยผู้ช่วย ส่วน lab ใช้ rubric จำลองที่ประกาศไว้;
ทั้งสองแหล่งไม่ใช่ human ground truth

Rubric ของ lab: severity (Low=1, Medium=2, High=3) + criticality (low=0, normal=1, high=2)
+ impact (low=0, medium=1, high=2); High เมื่อคะแนน >=6, Medium เมื่อ >=4, นอกนั้น Low
เกณฑ์นี้ตั้งไว้ก่อนฝึก ไม่ได้แก้ label หรือย้าย split เพื่อเพิ่มคะแนน
เพราะ target คำนวณจาก features คะแนนจึงวัดการเรียนรู้ rubric นี้เป็นหลัก

## ผลทดลอง

โมเดลหลักเป็น Decision Tree/Gini เช่นเดิม เลือก depth จาก 1–5 เฉพาะ validation
ได้ max_depth=5; เมื่อคะแนนเท่ากันเลือกต้นไม้ตื้นกว่า
Random Forest เป็นตัวเปรียบเทียบ ไม่ได้เลือกโมเดลหลักจากคะแนน test

| วิธี | Test accuracy | Test Macro-F1 |
|---|---:|---:|
| Severity baseline | 0.500 | 0.417 |
| Decision Tree | 0.944 | 0.956 |
| Random Forest | 0.889 | 0.883 |

Decision Tree ทายถูก 17/18 รายการ พลาด Medium เป็น Low หนึ่งรายการ
ทาย High ถูก 3/3 รายการในชุดจำลองนี้ ไม่ใช่หลักฐานว่าไม่พลาด High บนข้อมูลจริง
**ห้ามเทียบ 0.956 กับ 0.222 ของ v2 ตรง ๆ เพราะชุดวัดผลและวิธีสร้าง target ต่างกัน**
templates เคยตรวจมาก่อน และแต่ละ project แตกมาจาก lab เดียว ไม่ใช่ blind benchmark ใหม่
ผลนี้ยังไม่รับรองการทำนายกับโปรเจกต์จริง โดยเฉพาะเมื่อบริบทเป็น unknown หรือ exposure อื่น
ไม่มีการปรับ hyperparameter ซ้ำหลังเห็นผล test รอบนี้

## ทำซ้ำและตรวจผล

ไฟล์ generated อยู่ใน artifacts/datasets/priority-source-v3 (ไม่ commit ข้อมูลทดลอง)
manifest.json ตรึง scenario/split, scans.json เชื่อม scan IDs, snapshot.json เก็บ checksum,
dataset.csv เป็น snapshot จาก label revision ล่าสุดในฐานข้อมูล
โมเดลและผลอยู่ output/ml/coursework-v3 พร้อม input, split CSVs, metrics, ภาพต้นไม้,
confusion matrix, service-model.json และ verification.json

```powershell
# สร้างครั้งเดียว สคริปต์ปฏิเสธการทับผลเดิม
.\.local\ml-demo-env\Scripts\python.exe tools/ml/prepare-priority-source-labs.py
# Operator ระบุบัญชีและ repository ที่มีสิทธิ์ สแกนผ่าน worker และเขียน label ผ่าน RLS
.\.local\ml-demo-env\Scripts\python.exe tools/ml/scan-priority-source-labs.py --actor <user-uuid> --repository <repository-uuid>
.\.local\ml-demo-env\Scripts\python.exe tools/ml/train-coursework.py --input artifacts/datasets/priority-source-v3/dataset.csv --source-manifest artifacts/datasets/priority-source-v3/manifest.json --additional-train artifacts/datasets/inventory-card-v1/simulated-labels.csv --experiment lecture_decision_tree_v3 --output-dir output/ml/coursework-v3
.\.local\ml-demo-env\Scripts\python.exe tools/ml/export-service-model.py --experiment-dir output/ml/coursework-v3
.\.local\ml-demo-env\Scripts\python.exe tools/ml/test-source-labs.py
.\.local\ml-demo-env\Scripts\python.exe tools/ml/test-coursework.py
```

สคริปต์สแกนใช้ PostgreSQL ใน Docker local เท่านั้น ต้องมี worker ที่อ่าน source root นี้ได้
หากหยุดระหว่างทางใช้ scans.json ทำต่อได้ ไม่ทับ label ที่มีอยู่; dataset.csv ที่สร้างเสร็จแล้วไม่ถูกเขียนทับ
ตัว loader ตรวจ checksum, scan/family/rule/path/context และ clone group รวมทั้งครบสามคลาสต่อ split
ปฏิเสธ accepted labels ในชุดจำลอง และใช้ feature allowlist เดิม ไม่ใช้ label_reason/path/identity เป็นข้อมูลเข้า

รอบนี้ export โมเดล v3 สำหรับ service แล้ว แต่ **ยังไม่เปลี่ยนโมเดลที่เว็บใช้**
การนำไปใช้เป็นขั้นแยก เพราะผลดีบน rubric จำลองยังต้องตรวจด้วย labels จากโปรเจกต์จริง
ผลทำนายที่เกิดอัตโนมัติระหว่างสแกนมาจากรุ่นเดิม และไม่ได้ถูกนำมาเป็น target ของ v3
