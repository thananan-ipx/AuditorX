# แผน AuditorX ที่เชื่อมกับบทเรียน

โจทย์: ใช้ Supervised Classification แนะนำ Priority (High / Medium / Low)
จากผลสแกนและบริบทโครงการ โดยให้ผู้ตรวจเป็นผู้ตัดสินใจสุดท้าย

## ขอบเขตและการเชื่อมบทเรียน

| บทเรียน | การทำงานใน AuditorX |
|---|---|
| ML Blueprint หน้า 3, 8: Supervised / Classification | หนึ่ง finding เป็นหนึ่งตัวอย่าง เป้าหมายคือ Priority |
| หน้า 4–7: Collect / Prepare | scan → review → simulated CSV → ตรวจ provenance / แปลงหมวดหมู่ |
| หน้า 11–13: Decision Tree / Gini | DecisionTreeClassifier criterion=gini จำกัด depth 1–3 |
| หน้า 14: Confusion Matrix | แสดงตารางทายจริงเทียบคำตอบทั้งสามคลาส |
| หน้า 4: Iterative Improvement | เก็บข้อมูลหลากหลายและประเมินรอบถัดไป |
| Pragmatic Blueprint หน้า 6, 14–15 | ประโยชน์คือช่วยจัดคิวตรวจ เลือกวิธีตามข้อจำกัดและวัดผล |

โมเดลหลักกำหนดล่วงหน้าเป็น Decision Tree เพื่ออธิบายต้นไม้ที่เรียนรู้ได้
เปรียบเทียบกับ severity เดิมและ Random Forest ไม่เปลี่ยนโมเดลหลักตามคะแนน test
เลือกความลึกเฉพาะ validation และเลือกต้นไม้ตื้นกว่าเมื่อคะแนนเท่ากัน

## รอบที่ทำเสร็จแล้ว: coursework-v1

- ใช้ CSV จริงที่ส่งออกจาก AuditorX scan d323821f จำนวน 12 simulated labels
- คัดออก 13 findings ที่ excluded โดยไม่เพิ่มจำนวนด้วยการทำสำเนา
- คง family split เดิม: train 6 / validation 3 / test 3
- ใช้ feature allowlist เท่านั้น ไม่ใช้เหตุผล label, path, fingerprint หรือ Priority เป็นข้อมูลเข้า
- ฝึก Decision Tree และ Random Forest บันทึกโมเดล, metrics, รายการทำนาย, ภาพต้นไม้ และ Confusion Matrix
- ผล test Macro F1: severity 0.333 / Decision Tree 0.222 / Random Forest 0.167
- ผลฝึกอยู่ที่ output/ml/coursework-v1/report.md และเชื่อมโมเดลทดลองกับหน้าลำดับแก้ไขอัตโนมัติแล้ว

ผลนี้ยังไม่สนับสนุนว่า ML ดีกว่า severity เดิม: test มีเพียง 3 รายการจาก lab เดียว
และเคยถูกตรวจในรอบก่อนแล้ว จึงไม่ใช่ blind benchmark ใหม่
บริบท criticality/exposure/impact ในชุดนี้คงที่ จึงยังเรียนรู้ความแตกต่างด้านบริบทไม่ได้
ข้อมูลเป็น label จำลอง ไม่ใช่ human-confirmed ground truth

## รอบเพิ่มข้อมูล: coursework-v2 (2026-11-06)

รวม 12 simulated labels เดิมกับ 3 simulated labels ล่าสุดจาก inventory-card
scan `1bd9fa83-605e-4463-ae8f-05c20f637b06` ซึ่งเจ้าของยืนยันว่าเป็นโปรเจกต์ทดลองใช้ข้อมูลทดสอบ
ทั้งสามเป็น Low จากการตรวจโค้ดโดยผู้ช่วย ไม่ใช่ human ground truth; excluded 8 รายการไม่ใช้ฝึก

- Train 9 / validation 3 / test 3; inventory-card ทั้งโปรเจกต์อยู่ train เท่านั้น
- คง validation/test เดิมแบบ byte-for-byte เพื่อเทียบกับ v1 ไม่ใช่ benchmark ใหม่
- Lab เดิมยังแบ่งตาม case family ภายในโปรเจกต์เดียว จึงไม่ใช่การวัดผลแบบแยกทั้งโปรเจกต์
- Decision Tree depth 1: test Macro-F1 0.222; Random Forest 0.167; severity baseline 0.333 เท่าเดิมทั้งหมด
- บันทึกโมเดล รายงาน และ service-model.json แยกใน `output/ml/coursework-v2`
- ตรวจ serving artifact เทียบ sklearn ครบ 15 ตัวอย่าง และตรวจคะแนนจากโมเดลที่บันทึกแล้ว
- ยังใช้ v1 บนเว็บ เพราะยังไม่พบผลดีขึ้นจากการเพิ่มข้อมูล

คำสั่งทำซ้ำ (ต้องใช้ output directory ใหม่หากมีอยู่แล้ว):

```powershell
.\.local\ml-demo-env\Scripts\python.exe tools/ml/train-coursework.py --additional-train artifacts/datasets/inventory-card-v1/simulated-labels.csv --experiment lecture_decision_tree_v2 --output-dir output/ml/coursework-v2
.\.local\ml-demo-env\Scripts\python.exe tools/ml/export-service-model.py --experiment-dir output/ml/coursework-v2
```

`--additional-train` รับเฉพาะ simulated/test_only ของกลุ่มโปรเจกต์ใหม่ ห้าม fingerprint ซ้ำ
และใช้ได้หนึ่ง scan snapshot ต่อกลุ่ม โดยไม่ย้ายข้อมูล validation/test เดิม
การตรวจ clone/near-duplicate ระหว่างโปรเจกต์ยังต้องทำโดยผู้เตรียมชุดข้อมูล

## รอบเพิ่ม source labs: coursework-v3

สร้าง source lab 12 โปรเจกต์ × 9 บริบทสมมติ สแกนจริงและบันทึก 108 simulated labels
รวม inventory-card อีก 3 แถวเป็น 111 แถว (train 75 / validation 18 / test 18)
Decision Tree ได้ Macro-F1 0.956 เทียบ severity baseline 0.417 บน test ชุดเดียวกัน
ผลนี้วัดการเรียนรู้ rubric จำลอง ไม่ใช่ความแม่นยำกับโปรเจกต์จริง และเทียบคะแนนกับ v2 ตรง ๆ ไม่ได้
ยังไม่เปลี่ยนโมเดลของเว็บ รายละเอียด provenance/split/ข้อจำกัดและวิธีทำซ้ำอยู่ใน
[source-labs-v3.md](source-labs-v3.md)

## ทำซ้ำ

ใช้ Python virtual environment และติดตั้ง tools/ml/coursework-requirements.txt
มี coursework-requirements.lock.txt สำหรับรุ่นที่ใช้จริงในรอบนี้

```powershell
.\.local\ml-demo-env\Scripts\python.exe tools/ml/train-coursework.py --output-dir output/ml/coursework-v2
.\.local\ml-demo-env\Scripts\python.exe tools/ml/test-coursework.py
```

คำสั่ง train ปฏิเสธการเขียนทับผลเดิม ค่า default input คือ
artifacts/datasets/nextjs-source-lab-v1/simulated-labels.csv
สามารถระบุ --input เป็น CSV export ใหม่ของ lab เดิมได้
test-coursework ตรวจ artifact อ้างอิง coursework-v1

## รอบต่อไปก่อนนำผลไปใช้

เพิ่ม service ทดลอง predict และแท็บทดลองบน Dashboard แล้ว ดูวิธีเริ่มและข้อจำกัดใน
[prediction-service.md](prediction-service.md) ผลเป็นคำแนะนำชั่วคราว ไม่ถูกบันทึกเป็น training label

1. เก็บตัวอย่างที่มีบริบทต่างกัน พร้อมเกณฑ์ label ที่สอดคล้องกัน ตั้งเป้าทำงานเบื้องต้น 100–200 รายการ
   จำนวนนี้ไม่ใช่เกณฑ์รับประกันคุณภาพ และต้องแยก simulated / human-confirmed
2. แยกทั้งโปรเจกต์และกลุ่มสถานการณ์ รวมสำเนาหรือ unsafe/fixed คู่เดียวกันไว้ชุดเดียวกัน
3. ตรึงชุด test ใหม่ก่อนทดลองเพิ่ม ไม่ปรับโมเดลจากผล test
4. เปรียบเทียบ baseline และดูความผิดพลาดรายคลาส โดยเฉพาะ High ที่ทายต่ำ
5. API / UI แสดง Priority อัตโนมัติพร้อมรุ่นโมเดลและให้คนแก้ label ได้แล้ว แต่ต้องประเมินข้อมูลใหม่ก่อนอ้างคุณภาพ
6. ทดลองวัดเวลา review ก่อนอ้างว่าระบบช่วยลดเวลาทำงาน

แผนนี้เชื่อมกับเนื้อหาสอน ยังไม่ได้รับรองว่าครบ rubric เนื่องจากไม่มีโจทย์ให้คะแนน
