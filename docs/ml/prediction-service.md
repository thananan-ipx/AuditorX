# Python prediction service

AuditorX serves the existing coursework Decision Tree through FastAPI. It loads
one read-only model at startup using [lifespan](https://fastapi.tiangolo.com/advanced/events/).
No training happens during a scan or prediction request.

## Start

The local coursework experiment must already exist. Export the trusted trained
pipeline to a data-only JSON tree (the HTTP service never loads pickle files):

```powershell
.\.local\ml-demo-env\Scripts\python.exe tools/ml/export-service-model.py
docker compose up -d --build --wait
```

The exporter preserves an existing service-model.json; use a new experiment
directory for a new version (`--experiment-dir`). It records the original model
SHA256. The serving service reports the JSON artifact SHA256 and experiment version.
The artifact stays under ignored output/, alongside the original trained model.

Compose mounts `output/ml/coursework-v1/service-model.json` read-only, configurable
through AUDITORX_MODEL_FILE. A missing or corrupt artifact prevents prediction
startup rather than producing placeholder results. Existing scans and labels
continue to work if prediction is unavailable.

## Automatic priority after scanning

Migration 00015 queues a durable prediction in the same transaction that marks a
scan completed. The scan worker processes it through Python, independent of the
browser. It also queues an initial run for historical completed scans. Predictions
are stored in priority_prediction_runs, separate from priority_labels.

The worker leases each run for 30 seconds, retries inference failures up to three
attempts with a 15-second delay, and fences stale completion tokens. Restarting
the worker reclaims expired work. An unavailable model never changes a completed
scan to failed or removes its findings. Empty scans complete without calling Python.

Context is snapshotted per scan, since different local projects can share one
repository workspace. The optional prediction_context object is accepted on
GitHub/local JSON scan requests, or as a JSON prediction_context multipart field
for uploads. It contains the three context enums. Omitted context defaults to
unknown; no public exposure or real-world impact is inferred.

## Use on the website

1. Start a scan; optionally expand Context for this scan before submitting.
2. On completion the default **ลำดับแก้ไข / Fix order** tab loads saved predictions.
3. The page polls while prediction is queued/running and orders High, Medium, Low.
4. Review priority opens the existing label form for that exact finding.
5. An accepted human label takes precedence in the displayed queue. Simulated
   labels remain separate and do not count as human confirmation.
6. Excluded findings are hidden by default; choose Include excluded findings to see them.

Within a priority group, file/line ordering is deterministic, not an additional
model ranking. Scanner severity stays visible and unchanged. Failed/missing
predictions stay unknown rather than being replaced with fake model output.

Saved context applies to the entire scan and is shown alongside model version.
Prediction runs retain the result, model SHA256, version and timestamps. Editors
can Recompute suggestions; one active run per scan prevents duplicate active work.
Completed history is retained when recomputing. Loading/reloading a page only reads
stored results; it does not call Python or write a label. UI polling stops on
unmount but background work continues. Up to 1,000 findings are predicted with
50 displayed per page. Filters on other tabs do not affect inference counts.

## Endpoints and permissions

- `GET http://localhost:8090/health`: readiness, version, artifact hash and experimental provenance.
- `POST http://localhost:8090/predict`: internal feature batch; localhost-only host port.
- `POST /api/v1/repositories/{repositoryID}/scans/{scanID}/predictions`: public Go API,
  authenticated and scoped to accessible repository/scan. Viewers may preview.
  Body contains only repository_criticality, exposure and impact using label enums.
- `GET /api/v1/repositories/{repositoryID}/scans/{scanID}/predictions`: latest stored
  run for an accessible completed scan, including queued/running/completed/failed status.
- `POST .../predictions/retry`: editor/owner only, queues a run using the scan's
  context snapshot. Returns the existing active run if already queued/running.

The original POST predictions endpoint is retained as a read-only preview API.
The primary website workflow uses persisted automatic runs, not preview requests.

Go reads completed findings from the database and derives the feature contract:
severity, rule_family, category, language, file_type, full-scan rule count and the
three context fields. Source code, messages, file paths, label reasons, target
labels and user identities are not sent to Python. Fingerprints correlate results.
The Go HTTP client enforces a five-second timeout, bounded responses and verifies
model metadata, count, unique fingerprints and allowed priorities. Inference
failures produce a bounded 503 without exposing internal errors. No labels are written.

For Go running outside Docker, set PREDICTION_SERVICE_URL=http://127.0.0.1:8090.
For direct Python development:

```powershell
python -m pip install -r prediction/requirements-test.txt
$env:MODEL_PATH = (Resolve-Path output/ml/coursework-v1/service-model.json).Path
python -m uvicorn app:app --app-dir prediction --host 127.0.0.1 --port 8090
```

Interactive request schema is available at http://localhost:8090/docs.

## Evaluation and limitations

This is the same simulated-source-lab tree: 6 training examples, 3 validation,
3 test. Original test Macro F1 = 0.222 versus severity baseline = 0.333.
Context features were constant in training. Serving does not improve model quality,
and no production performance or calibrated confidence is claimed.

Tests check startup failure, strict request validation, duplicate/oversized batches,
load-once behavior, permission enforcement, feature extraction, upstream response
validation and parity with the original sklearn pipeline on all 12 local examples.

```powershell
python -m unittest discover -s prediction -v
cd backend
go test ./internal/modules/scan ./internal/config ./cmd/api
```

The parity check skips when the ignored local coursework artifacts are absent;
the other tests use an isolated test fixture. No real labels are changed by tests.
