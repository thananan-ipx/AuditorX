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
