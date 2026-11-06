# เกณฑ์ติด Priority Label สำหรับการบ้าน AuditorX

Version: `priority-labels-3class-v1` · Dataset schema: `priority-dataset-v1`

## Label จำลองสำหรับการทดลอง

สถานะ `simulated` ใช้กับ label จากสถานการณ์ที่ตั้งใจสร้างสำหรับ lab/สาธิต โดยต้องมี
Priority และ exposure=`test_only` ระบบนับเป็นพร้อมทดลอง train พร้อมแสดงจำนวนแยกจาก
`accepted` ซึ่งหมายถึง label ที่คนตรวจรับรอง การใส่ simulated ไม่ได้ยืนยันว่าเป็นปัญหา
production และผู้บันทึกใน reviewer ไม่ได้ทำให้ label จำลองกลายเป็น human ground truth

ปุ่ม **ส่งออกชุด train จำลอง CSV** ส่งออกเฉพาะ simulated ที่มี Priority โดยใช้ schema
`priority-simulated-dataset-v1` และคง review_status=simulated พร้อม provenance ของ scan
rule_count_in_scan ยังคำนวณจากผลสแกนทั้งหมด ไม่ใช่เฉพาะแถวที่ส่งออก
CSV ทั่วไปยังส่งออกทุก finding พร้อมสถานะจริง ส่วน operator export เดิมด้านล่าง
ยังเลือกเฉพาะ accepted จึงไม่ปน label จำลองในชุด human labels

## การติด label บนระบบและบันทึกฐานข้อมูล

เข้า Dashboard เลือก completed scan แล้วเปิดแท็บ **ติด label** แยกจากแท็บผลสแกน
ค้นหา/กรองรายการแล้วกด **ตรวจรายการนี้** เพื่อเปิดฟอร์มทีละ finding
กรอกบริบทโปรเจกต์ ผลการตรวจ และเหตุผล แล้วกด **บันทึก label** หรือ
**บันทึกและไปข้อต่อไป** เพื่อเปิดรายการที่ยังไม่ตรวจถัดไป
ฟอร์มมีการยืนยันก่อนทิ้ง draft ที่ยังไม่บันทึก และ dropdown ใช้ shadcn Select
กลุ่มโปรเจกต์จะถูกเติมจาก label ที่มีอยู่เพื่อช่วยให้ใช้ชื่อเดียวกัน แต่ต้องตรวจให้ถูกต้อง
ทุก finding ของ scan เดียวกันต้องอยู่กลุ่มเดียวกัน

เจ้าของและ editor บันทึกได้ ส่วน viewer อ่านได้อย่างเดียว ระบบเก็บ reviewer จากบัญชี
และเวลาจากเซิร์ฟเวอร์ ทุกการบันทึกเป็นแถวใหม่ใน `public.priority_labels` ไม่แก้แถวเก่า
หน้าจอและ CSV แสดง revision ล่าสุดต่อ finding; การตรวจซ้ำหลายคนยังต้องทำตาม protocol
การมีหลาย revision ไม่ถือเป็นหลักฐานว่าได้ตรวจอย่างอิสระแล้ว

`GET /api/v1/repositories/{repo}/scans/{scan}/labels` อ่าน revision ล่าสุด
`POST /api/v1/repositories/{repo}/scans/{scan}/findings/{fingerprint}/labels` บันทึก revision
API ตรวจสิทธิ์และฐานข้อมูลบังคับ RLS/FK/enum อีกชั้น ไม่มี API ให้ train หรือเปิดใช้โมเดลในรอบนี้

ปุ่ม Export dataset CSV จะรวม label ที่บันทึกแล้ว ช่องที่ยังไม่ตรวจยังเป็นค่าว่าง
หากบันทึกแล้วเครือข่ายขาด ให้กด **โหลด label ใหม่** ก่อนลองอีกครั้ง เพราะการบันทึก
อาจสำเร็จที่เซิร์ฟเวอร์แล้ว การกดซ้ำสร้าง revision เพิ่มและไม่ใช่การ train

เมื่อพร้อมทำชุด train ให้ operator รันจาก repository นี้:

```powershell
./scripts/export-training-dataset.ps1 -OutputPath artifacts/datasets/priority-v1.csv
```

สคริปต์อ่านฐานข้อมูล PostgreSQL ใน local Docker โดยตรง ไม่ใช้ CSV ที่แก้ด้วยมือเป็น
แหล่งข้อมูลหลัก เลือก label ล่าสุดที่เป็น accepted พร้อม Priority และหนึ่ง scan ล่าสุด
ที่มี accepted labels ต่อ repository_group เก็บ feature/provenance และเขียน manifest
พร้อมจำนวนตัวอย่าง จำนวนกลุ่ม class distribution และ SHA-256 ไม่เขียนทับ dataset เดิม
และปฏิเสธการส่งออกถ้า scan เดียวกันมีหลาย group ให้แก้ latest labels ให้ตรงกันก่อน
สคริปต์นี้เป็นเครื่องมือ operator ที่อ่านข้อมูลทุก workspace ใน local database
ไฟล์เป็น raw research CSV สำหรับ pipeline; หากเปิดใน spreadsheet ให้ import คอลัมน์
ข้อความเป็น text เพื่อไม่ตีความค่าที่คนกรอกเป็นสูตร ปุ่ม CSV บนเว็บป้องกัน formula แยกอยู่แล้ว

การส่งออกไม่รับรองว่า dataset พร้อม train: ยังต้องตรวจจำนวนกลุ่ม/คลาส ความครบถ้วน
และข้อมูลซ้ำตามขั้นตอนท้ายคู่มือ ผลจาก query นี้ยังไม่ถูกแบ่ง train/validation/test

ขอบเขตการทดลองนี้ลดจาก SRS เดิม 4 คลาสเป็น **High / Medium / Low** เพื่อเริ่ม
supervised classification ขนาดเล็ก โดยไม่มี LLM training ส่วน Critical และ online
model registry ใน SRS เดิมยังเป็นงานอนาคต ห้ามรวมผลคนละ guideline version เข้าด้วยกัน
โดยไม่ประกาศวิธีแปลง label และประเมินใหม่

## คำถามที่ต้องการตอบ

โมเดลเรียนรู้การจัดลำดับงานแก้ไขจาก findings และบริบทที่คนตรวจแล้วได้ดีกว่าการใช้
Severity ตรง ๆ หรือไม่ บนโปรเจกต์ที่ไม่เคยใช้ train?

หน่วยข้อมูลคือหนึ่ง finding ในหนึ่ง snapshot ของโปรเจกต์ Priority คือความเร่งด่วน
ของงานแก้ไขหรือการตรวจเพิ่มเติม ไม่ใช่หลักฐานยืนยันช่องโหว่ และไม่ใช่คะแนนคุณภาพโค้ด

## วิธีเก็บข้อมูล

1. สแกน JS/TS หรือ Next.js จากหลายโปรเจกต์ เลือกหนึ่ง completed scan ต่อโปรเจกต์
   สำหรับ dataset รุ่นแรก บันทึกเหตุผลการเลือก repo และ rule profile ที่ใช้
2. กด **ส่งออก Dataset CSV** ใน Findings ปุ่มส่งออกทุก finding ใน scan ที่เลือก
   โดยไม่สนใจตัวกรองหรือหน้าปัจจุบัน ไม่ส่งออกโค้ดต้นฉบับหรือ credential
   แต่ file_path/message อาจมีข้อมูลภายใน ให้ตรวจและปกปิดก่อนเผยแพร่ dataset
3. เปิด CSV เป็น UTF-8 ใน Excel หรือโปรแกรมที่รองรับ ห้ามแก้ข้อมูลผลสแกนเดิม
   เก็บไฟล์ export ต้นฉบับแยกจากไฟล์ที่ติด label
4. กรอก `repository_group` เป็นรหัสคงที่ เช่น `crm-front` ให้ repo เดียวกัน รวมทั้ง
   clone, fork หรือโค้ดที่เหมือนกันมาก อยู่กลุ่มเดียวกัน แม้ import ต่าง ID หรือเปลี่ยน path
   ห้ามใช้ `repository_id` แทนกลุ่มโดยอัตโนมัติ เพราะ local source อาจเลือกต่างโปรเจกต์
   ภายใต้ workspace เดียวกันได้
5. ตรวจโค้ดบริเวณที่พบและเส้นทางเรียกใช้จริงก่อนติด label ไม่ตัดสินจากข้อความเตือนอย่างเดียว

## บริบทที่ต้องบันทึกก่อนตัดสิน Priority

ใช้ค่าต่อไปนี้ให้สม่ำเสมอ และกรอก `unknown` หากยังพิสูจน์ไม่ได้

| คอลัมน์ | ค่าที่ใช้ | ความหมาย |
|---|---|---|
| repository_criticality | high / normal / low / unknown | high: ระบบสำคัญหรือข้อมูลอ่อนไหว; normal: แอปทั่วไป; low: demo/ทดลอง |
| exposure | public / authenticated / internal / test_only / unknown | ใครหรือเส้นทางใดเข้าถึงโค้ดนี้ได้จริง |
| impact | high / medium / low / unknown | high: ข้อมูลอ่อนไหว สิทธิ์ หรือบริการหลัก; medium: ฟังก์ชันจำกัด; low: เล็กน้อย |
| review_status | unreviewed / accepted / excluded / needs_context | accepted: เป็นงานที่ควรจัดลำดับ; excluded: false positive/ซ้ำ/ไม่อยู่ scope; needs_context: ข้อมูลไม่พอ |

Repository criticality ต้องอิงคำอธิบายโปรเจกต์ ไม่เปลี่ยนตาม Priority ที่อยากได้
impact และ exposure ต้องอิงหลักฐานก่อนติด label และต้องเก็บวิธีได้ข้อมูลไว้ให้ตรวจซ้ำได้
หากจะใช้เป็น features ในโมเดล ระบบ inference ต้องได้รับข้อมูลชนิดเดียวกันด้วย

## เกณฑ์ Priority

| Label | เกณฑ์ตัดสิน | ตัวอย่าง |
|---|---|---|
| High | มีผลกระทบสำคัญและมีเส้นทางเกิดปัญหาที่เป็นไปได้จริง ควรแก้ก่อนงานทั่วไป | รับค่าจาก public request ไป eval โดยไม่มี validation; log ข้อมูลส่วนบุคคลจริงใน production |
| Medium | เป็นงานที่ควรแก้ แต่การเข้าถึง ผลกระทบ หรือโอกาสเกิดถูกจำกัด และยังมีมาตรการลดความเสี่ยงบางส่วน | log ข้อมูลภายในที่ไม่อ่อนไหวในระบบจำกัดสิทธิ์; งานตรวจสิทธิ์ที่มีความเสี่ยงจำกัดจากบริบทที่ตรวจแล้ว |
| Low | ปรับปรุงเล็กน้อยหรือทบทวนที่ไม่เร่งด่วน มีหลักฐานว่าผลกระทบต่ำ | จัดการข้อผิดพลาดในเครื่องมือ demo ที่ไม่แตะข้อมูลสำคัญ; ทบทวน cache ของข้อมูลสาธารณะที่ไม่แยกตามผู้ใช้ |

Severity สูงอาจได้ Priority ต่ำ หากโค้ดเป็น test-only และผลกระทบต่ำจริง แต่ false
positive ให้ `excluded` ไม่ใช่ Low ส่วน Severity ต่ำอาจได้ Priority สูงเมื่อบริบท
ชี้ว่าต้องตรวจ/แก้เร่งด่วน ห้ามสร้าง label ให้ต่าง Severity เพียงเพื่อให้โมเดลมีตัวอย่าง

สำหรับ Next.js advisory เช่น Server Action / Route Handler / Shared Cache การ match
ไม่ได้พิสูจน์ว่าขาด authorization หรือข้อมูลรั่ว ให้ตรวจบริบทก่อน ถ้าปลอดภัยและไม่มีงาน
ที่ต้องทำให้ excluded ถ้าบริบทไม่พอให้ needs_context และเว้น label

## ช่องที่คนตรวจต้องกรอก

- `priority_label`: High / Medium / Low เฉพาะรายการ accepted
- `label_reason`: ผลกระทบ, แหล่งข้อมูล/ผู้ที่เข้าถึงได้, มาตรการป้องกัน และเหตุผลความเร่งด่วน
  ตัวอย่าง: "public route รับ query ไป eval โดยไม่มี allowlist กระทบข้อมูลลูกค้า จึง High"
- `reviewer`: รหัสผู้ตรวจ เช่น reviewer-01 ไม่จำเป็นต้องใส่ชื่อจริง
- `labeled_at`: ISO 8601 พร้อม timezone เช่น `2026-11-02T20:00:00+07:00`
- รายการ excluded ให้ใส่เหตุผล รายการ needs_context ให้ระบุข้อมูลที่ขาด ทั้งสองกรณีเว้น priority_label

ห้ามใช้ LLM สร้าง Ground Truth อัตโนมัติ หากทำได้ให้ผู้ตรวจสองคนติด label ชุดย่อย
ที่ซ้อนกันอย่างอิสระ แล้วรายงาน agreement และข้อยุติ หากมีผู้ตรวจคนเดียวให้ระบุข้อจำกัดนี้

## ข้อมูลจากระบบและข้อจำกัด

CSV มี scan/repository IDs, snapshot digest หรือ commit, rules/scanner version,
finding fingerprint, rule ID/family, category, Severity, language, extension,
file/line/message และ `rule_count_in_scan` ซึ่งนับ rule เดียวกันทั้ง scan
คอลัมน์ภาษาอนุมานจากนามสกุลไฟล์ และ file_type เป็นนามสกุล ไม่ใช่ semantic role
Category เป็น unknown ถ้าไม่มี catalog ของ rules version นั้น

Priority และบริบทเริ่มเป็นช่องว่าง ระบบไม่ใช้ Severity เติม label ให้
CSV มี UTF-8 BOM และ quote ตามรูปแบบ CSV พร้อม prefix `'` ให้ข้อความที่อาจกลายเป็น
spreadsheet formula เพื่อความปลอดภัย เก็บ raw export นี้ไว้ การ train ใช้เฉพาะ features
ที่ระบุ ไม่ควรนำ message/reason หรือทั้งแถวไป train อัตโนมัติ

## ขั้นต่อไปหลังติด label

1. ตรวจ schema/version, ค่าที่อนุญาต, ช่องบังคับ และ label distribution ของ accepted rows
   ตัด excluded/needs_context/unreviewed ออกจาก supervised training
2. เลือกหนึ่ง snapshot ต่อ repository_group ตรวจ finding ซ้ำและ clone/near-duplicate
   ก่อนแบ่งข้อมูล ไม่ใช้ scan ซ้ำเพื่อเพิ่มจำนวนตัวอย่าง
3. แบ่ง train/validation/test ตาม repository_group บันทึก seed และ split manifest
   ต้องมีหลายกลุ่มพอให้แยกทั้งสามชุดได้ หากข้อมูลไม่พอให้เก็บเพิ่มและไม่อ้างผลทั่วไป
4. Features เริ่มต้น: severity, rule_family, category, language, file_type,
   rule_count_in_scan เท่านั้น Fit encoder/scaler บน train เท่านั้น
   บริบทที่คนกรอกเก็บไว้สำหรับ labeling/error analysis ก่อน; การเพิ่มเป็น features
   เป็นการทดลองแยกที่ต้องบอกว่าต้องอาศัย human input ตอน inference
5. ห้ามใช้ priority_label, label_reason, review_status, reviewer, labeled_at,
   repository/scan IDs, fingerprint หรือ file_path เป็น features ในการทดลองเริ่มต้น
6. เทียบ severity baseline (High→High, Medium→Medium, Low→Low), Logistic Regression,
   Random Forest เลือก configuration ด้วย validation และเปิด test เมื่อเลือกเสร็จแล้ว
7. รายงาน Macro-F1, per-class precision/recall/F1, confusion matrix, จำนวนข้อมูล/กลุ่ม
   แต่ละ split และตัวอย่างที่ผิด ถ้าคลาสใดไม่มีใน test ให้รายงานข้อจำกัดตรง ๆ
   ผลที่ไม่ชนะ baseline ยังเป็นผลทดลองที่รายงานได้ ห้ามปรับ label หรือ split ตามผล test

ตอนนี้ติด label บนเว็บและเก็บ human labels เป็น revision ในฐานข้อมูลได้แล้ว รวมทั้ง
ส่งออกชุด train พร้อม manifest ได้ ยังไม่มีการ train โมเดลหรือสรุปว่า supervised
model ทำงานดีกว่า baseline
