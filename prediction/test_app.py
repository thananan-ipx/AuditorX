import copy
import csv
import json
from pathlib import Path
import pickle
import tempfile
import unittest

from fastapi.testclient import TestClient
from app import create_app, Features, TreeModel, FEATURES

ROOT = Path(__file__).resolve().parents[1]
MODEL = ROOT / "output/ml/coursework-v1/service-model.json"
ROW = dict(severity="High", rule_family="security.dynamic-eval", category="Security", language="typescript",
           file_type="ts", rule_count_in_scan=1, repository_criticality="low", exposure="test_only", impact="unknown")


class PredictionTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.path = Path(self.folder.name) / "model.json"
        self.data = dict(schema_version="auditorx-tree-v1", feature_contract="priority-features-v1",
                         features=FEATURES, encoded_features=["severity=High"], classes=["High", "Low", "Medium"],
                         human_ground_truth=False, dataset_kind="simulated_source_lab", model_version="unit-fixture",
                         training_rows=6, nodes=[dict(left=-1, right=-1, feature=-2, threshold=-2, values=[1, 0, 0])])
        self.path.write_text(json.dumps(self.data))
        self.addCleanup(self.folder.cleanup)

    def test_health_and_prediction_load_once(self):
        with TestClient(create_app(self.path)) as client:
            self.path.unlink()  # The loaded model remains usable across requests.
            self.assertEqual(client.get("/health").json()["training_rows"], 6)
            for _ in range(2):
                response = client.post("/predict", json={"items": [{"fingerprint": "a" * 64, "features": ROW}]})
                self.assertEqual(response.status_code, 200)
                self.assertTrue(response.json()["experimental"])
                self.assertEqual(response.json()["predictions"][0]["priority"], "High")

    def test_invalid_and_label_leaking_payloads(self):
        with TestClient(create_app(self.path)) as client:
            for features in ({**ROW, "priority_label": "High"}, {**ROW, "rule_count_in_scan": True},
                             {**ROW, "exposure": "anything"}, {**ROW, "label_reason": "Priority=High"}):
                self.assertEqual(client.post("/predict", json={"items": [{"fingerprint": "a" * 64, "features": features}]}).status_code, 422)
            item = {"fingerprint": "a" * 64, "features": ROW}
            for items in ([], [item, item], [item] * 1001):
                self.assertEqual(client.post("/predict", json={"items": items}).status_code, 422)
            self.assertEqual(client.post("/predict", content="x" * 1_048_577).status_code, 413)

    def test_missing_or_corrupt_model_fails_startup(self):
        with self.assertRaises(FileNotFoundError):
            with TestClient(create_app(Path(self.folder.name) / "missing.json")):
                pass
        invalid = copy.deepcopy(self.data)
        invalid["nodes"][0].update(left=0, right=0, feature=0)
        self.path.write_text(json.dumps(invalid))
        with self.assertRaises(ValueError):
            TreeModel(self.path)

    @unittest.skipUnless(MODEL.exists(), "Local coursework model not exported")
    def test_served_tree_matches_original_sklearn_pipeline(self):
        with (MODEL.parent / "decision_tree.pkl").open("rb") as handle:
            pipeline = pickle.load(handle)
        served = TreeModel(MODEL)
        rows = []
        for split in ("train", "validation", "test"):
            with (MODEL.parent / (split + ".csv")).open(encoding="utf-8-sig", newline="") as handle:
                rows += list(csv.DictReader(handle))
        features = []
        for row in rows:
            entry = {key: row[key] for key in FEATURES}
            entry["rule_count_in_scan"] = int(entry["rule_count_in_scan"])
            features.append(entry)
        self.assertEqual([served.predict(Features(**row)) for row in features], pipeline.predict(features).tolist())


if __name__ == "__main__":
    unittest.main()
