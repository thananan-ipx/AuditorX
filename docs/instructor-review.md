# เริ่มตรวจโค้ด AuditorX

โค้ด Frontend, Go API/worker, Python inference service, การเทรนและชุดทดสอบอยู่ใน repository นี้
ชุดข้อมูลและโปรเจกต์เดโมที่แนบเป็นข้อมูลจำลอง ไม่มี credential จริงหรือฐานข้อมูลผู้ใช้แนบมาด้วย

## จุดเริ่มอ่าน

| ส่วน | ตำแหน่ง |
|---|---|
| Python FastAPI, strict feature schema, JSON Decision Tree inference | prediction/app.py |
| Python dependencies และ service tests | prediction/requirements*.txt, prediction/test_app.py |
| ฝึก Decision Tree/Gini และเปรียบเทียบ Random Forest กับ baseline | tools/ml/train-coursework.py |
| ส่งออกโมเดลจาก trusted local pipeline เป็น JSON สำหรับ service | tools/ml/export-service-model.py |
| สร้าง source labs และสแกน/บันทึก simulated labels | tools/ml/prepare-priority-source-labs.py, tools/ml/scan-priority-source-labs.py |
| ตรวจ split, provenance, ป้องกันข้อมูลซ้ำ | tools/ml/test-coursework.py, tools/ml/test-source-labs.py |
| ตรวจโมเดลที่แนบ คะแนนที่บันทึก SHA256 และ HTTP inference ตรงกับ sklearn | tools/ml/verify-experiment.py |
| Go scanner, queue, prediction worker และ RLS-scoped persistence | backend/internal/modules/scan/ |
| Database schema, permissions, durable jobs | backend/migrations/ |
| หน้ารายการโปรเจกต์และหน้าผลสแกน/ติด label | frontend/features/repositories/, frontend/features/scans/ |

## ข้อมูลและผลทดลองที่แนบ

- artifacts/datasets/nextjs-source-lab-v1: 12 simulated labels เดิมและ candidate mapping
- artifacts/datasets/inventory-card-v1: simulated labels จากการตรวจโค้ดโดยผู้ช่วย 3 แถว
- artifacts/datasets/priority-source-v3: 12 source lab projects, 108 simulated labels และ frozen split/provenance
- output/ml/coursework-v1, coursework-v2, coursework-v3: input/split CSV, metrics, diagrams, reports และโมเดล

v3 ใช้ train 75 / validation 18 / test 18; source family/clone group ไม่ข้าม split
Macro-F1 0.956 เทียบ baseline 0.417 วัดบน rubric จำลอง ไม่ใช่ผลรับรองกับโปรเจกต์จริง
v2 ใช้ชุดวัดผลคนละชุด จึงห้ามเทียบตัวเลข v2 กับ v3 ตรง ๆ
UUID และ scan IDs ใน snapshot เป็น provenance จากเครื่องที่ทำทดลอง ไม่ได้สร้าง records ในฐานข้อมูลเครื่องใหม่

โมเดล .pkl เป็น artifact ที่สร้างโดย trainer ในโครงการนี้; โหลดเฉพาะไฟล์ที่เชื่อถือได้
Python HTTP service อ่าน service-model.json เท่านั้น ไม่รับไฟล์ pickle จากผู้ใช้
ไฟล์ .gitattributes คง bytes ของ snapshot เพื่อให้ SHA256 ตรงกันข้ามระบบปฏิบัติการ

## รัน Python tests และเทรนซ้ำ

ตัวอย่าง PowerShell ใช้ Python 3.12 และ virtual environment ใหม่ ไม่ต้องใช้ venv ของผู้พัฒนา:

```powershell
python -m venv .local/review-env
.\.local\review-env\Scripts\python.exe -m pip install -r tools/ml/coursework-requirements.lock.txt -r prediction/requirements-test.txt
.\.local\review-env\Scripts\python.exe tools/ml/test-coursework.py
.\.local\review-env\Scripts\python.exe tools/ml/test-source-labs.py
.\.local\review-env\Scripts\python.exe -m unittest discover -s prediction -v
.\.local\review-env\Scripts\python.exe tools/ml/verify-experiment.py --experiment-dir output/ml/coursework-v3
.\.local\review-env\Scripts\python.exe tools/ml/train-coursework.py --input artifacts/datasets/priority-source-v3/dataset.csv --source-manifest artifacts/datasets/priority-source-v3/manifest.json --additional-train artifacts/datasets/inventory-card-v1/simulated-labels.csv --experiment instructor_review_v3 --output-dir output/ml/instructor-review-v3
.\.local\review-env\Scripts\python.exe tools/ml/export-service-model.py --experiment-dir output/ml/instructor-review-v3
```

ไม่ต้องต่อฐานข้อมูลเพื่อฝึกจาก frozen CSV; trainer ไม่เขียนทับ experiment directory ที่มีอยู่แล้ว
การสแกน source ใหม่และบันทึก label ต้องใช้ฐานข้อมูลและสิทธิ์ตามขั้นตอนใน docs/ml/source-labs-v3.md

## เปิดระบบด้วย Docker

```powershell
docker compose up -d --build --wait
```

ค่าเริ่มต้นเว็บคือ localhost:3000; เครื่องเดโมใช้ AUDITORX_WEB_PORT=3001 และ AUDITORX_API_PORT=8081
ค่า AUDITORX_LOCAL_SOURCE_ROOT ต้องเป็นโฟลเดอร์ GitHub/source root ที่มีอยู่จริงบนเครื่องผู้ตรวจ
ค่า default ของ source root ใน Compose เป็นพาธเครื่องผู้พัฒนา จึงต้องปรับบนเครื่องอื่นก่อนเริ่ม worker
โมเดล JSON v1 ที่ Compose ใช้เป็นค่าเริ่มต้นแนบไว้แล้ว ส่วน v3 เป็น candidate ที่ยังไม่ได้เปิดใช้
ฐานข้อมูลเริ่มใหม่ต้องสมัครบัญชีและสร้าง workspace; snapshot CSV ไม่ใช่ database dump

ดูขั้นตอนเดโมและพาธเครื่องผู้พัฒนาใน [demo-guide.md](demo-guide.md)
ดูข้อจำกัดการทดลองใน [ml/source-labs-v3.md](ml/source-labs-v3.md)
