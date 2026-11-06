# ชุดข้อมูลทดลอง Priority แบบง่าย

ชุดนี้ใช้ทดลอง supervised training สำหรับการบ้าน โดยเป็น **ข้อมูลจำลองทั้งหมด**
ไม่ใช่ผลสแกนจริง ไม่ใช่ human ground truth และไม่เปลี่ยน accepted labels ในฐานข้อมูล
สถานการณ์ที่กล่าวถึง production/ข้อมูลอ่อนไหวเป็นเรื่องสมมติ ไม่ใช่บริบทของ HRX จริง

## เปิดจากเว็บ AuditorX

เปิด `http://localhost:3001/datasets` หรือเลือกเมนู **ชุดข้อมูลเทรน** ด้านซ้าย
หน้าเว็บอ่านชุดข้อมูลและ label 108 แถวที่บันทึกในฐานข้อมูล local ผ่าน migration
`00013_synthetic_training_dataset.sql` เป็นชุดสาธิตแบบอ่านอย่างเดียวสำหรับผู้เข้าสู่ระบบ
สามารถค้นหา กรอง Priority/ชุดแบ่งข้อมูล เปิดดูบริบทและเหตุผลของแต่ละตัวอย่าง
ดูคะแนนทดลอง และกด **ดาวน์โหลดชุดข้อมูลเทรน ZIP** ได้โดยตรง

ZIP ที่ได้มีข้อมูลเดิมครบทุกแถวพร้อม train/validation/test, manifest และ metrics
ไม่ขึ้นกับตัวกรองบนหน้าจอ และเก็บ bytes เดิมเพื่อให้ checksum ของ trainer ตรงกัน
ชุดนี้แสดงแยกจาก label ของผลสแกนจริง ซึ่งยังดูได้จาก Dashboard → ติด label
หน้าเว็บยังไม่เรียก train job ใหม่; ปุ่มดาวน์โหลดเตรียมไฟล์สำหรับสคริปต์ด้านล่าง

มี 12 กลุ่มสถานการณ์ × 9 บริบท รวม 108 แถว แบ่งตามกลุ่มสถานการณ์เป็น train 72,
validation 18 และ test 18 แถว ทุกชุดมี High / Medium / Low กลุ่มต้นแบบเดียวกัน
จะไม่ข้ามชุด แต่ 108 แถวนี้ไม่ได้หมายถึง 108 โปรเจกต์อิสระ

Label มาจากเกณฑ์จำลองที่ประกาศไว้:

- Severity: Low=1, Medium=2, High=3
- ความสำคัญระบบ: low=0, normal=1, high=2
- การเข้าถึง: test_only=0, internal=1, authenticated=2, public=3
- ผลกระทบ: low=0, medium=1, high=2
- รวมคะแนน ≥8 เป็น High, ≥5 เป็น Medium, ที่เหลือเป็น Low

นี่เป็นเกณฑ์สำหรับสาธิต ไม่ใช่สูตรจัดความเสี่ยงที่ผ่านการรับรอง โมเดลที่ฝึกจะเรียนรู้
สูตรจำลองนี้ คะแนนที่ได้ใช้ยืนยันว่า pipeline ทำงานเท่านั้น ยังสรุปผลกับโปรเจกต์จริงไม่ได้

ไฟล์อยู่ที่ `artifacts/datasets/synthetic-priority-v1/`:

- dataset.csv: ข้อมูลทั้งหมด พร้อมที่มาของ label และคำอธิบายสถานการณ์
- train.csv, validation.csv, test.csv: ชุดที่แบ่งแล้ว
- manifest.json: รายชื่อ features, การกระจายคลาส, กลุ่ม, seed และ SHA-256

## รันจากโฟลเดอร์ auditor-x ด้วย PowerShell

สร้าง dataset อีกครั้งในโฟลเดอร์ใหม่:

```powershell
tools/scanner-env/Scripts/python.exe tools/ml/prepare-demo-dataset.py --output-dir artifacts/datasets/synthetic-priority-v2
```

เตรียม Python environment แยกสำหรับ ML แล้ว train:

```powershell
tools/scanner-env/Scripts/python.exe -m venv .local/ml-demo-env
.local/ml-demo-env/Scripts/python.exe -m pip install -r tools/ml/demo-requirements.lock.txt
.local/ml-demo-env/Scripts/python.exe tools/ml/train-demo.py
```

สคริปต์เทียบ Logistic Regression กับ Random Forest โดยเลือกจาก validation แล้วจึง
เปิด test เปรียบเทียบกับ Severity baseline บันทึก model, Macro-F1, per-class metrics
และ confusion matrix ใน `.local/ml-demo-result-v1/` ถ้ารันซ้ำต้องใช้ output folder ใหม่
เพื่อไม่เขียนทับผลเก่า

Features ใช้ severity, rule_family, category, language, file_type และบริบท 3 ช่อง
จึงต่างจากการทดลองข้อมูลจริงเดิมที่ใช้ 6 features และต้องมีบริบทแบบเดียวกันตอนทำนาย
ไม่ใช้ sample ID, group, scenario, label_reason, rubric_score หรือ Priority เป็น features
Preprocessing fit บน train เท่านั้น ตามแนวทาง
[scikit-learn](https://scikit-learn.org/stable/common_pitfalls.html)

ข้อความสำหรับรายงาน: “ทดลอง supervised classification บนชุดข้อมูลจำลอง 108 แถว
จาก 12 กลุ่มสถานการณ์ โดย label ถูกสร้างจาก rubric ที่กำหนด ผลนี้แสดงการทำงานของ
pipeline และการเรียนรู้ rubric เท่านั้น ยังไม่ได้ประเมินความแม่นยำกับ findings จริง”

## ผลทดลองที่รันแล้ว

- Train 72 แถว, validation 18 แถว, test 18 แถว; ต้นแบบไม่ข้ามชุด
- รวม Low 31, Medium 48, High 29 แถว
- เลือก Logistic Regression จาก validation
- Test Macro-F1 = 0.890993; Severity baseline = 0.331624
- Python 3.12 และ scikit-learn 1.7.2; dependencies ที่ติดตั้งจริงเก็บใน lock file
- Model: `.local/ml-demo-result-v1/synthetic-demo-model.pkl`
- Metrics/confusion matrix: `.local/ml-demo-result-v1/metrics.json`

คะแนนนี้เป็นผลของข้อมูลจำลองที่ target ถูกคำนวณจาก features ตามสูตร จึงไม่ใช่
หลักฐานว่าโมเดลจัด Priority ในโปรเจกต์จริงได้ดี และ test มีเพียง 18 แถว
