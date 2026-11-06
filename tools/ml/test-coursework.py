"""Dataset safety and saved-model round-trip checks for the coursework run."""
import csv
import importlib.util
import json
import pickle
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("coursework", Path(__file__).with_name("train-coursework.py"))
course = importlib.util.module_from_spec(spec)
spec.loader.exec_module(course)


class CourseworkChecks(unittest.TestCase):
    def setUp(self):
        self.path = course.DATA / "simulated-labels.csv"
        with self.path.open(encoding="utf-8-sig", newline="") as f:
            self.rows = list(csv.DictReader(f))

    def reject(self, rows):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "input.csv"
            with path.open("w", encoding="utf-8", newline="") as f:
                writer = csv.DictWriter(f, fieldnames=list(rows[0])); writer.writeheader(); writer.writerows(rows)
            with self.assertRaises(ValueError):
                course.load_data(path)

    def test_reject_duplicate_findings(self):
        self.rows[-1] = self.rows[0].copy()
        self.reject(self.rows)

    def test_reject_human_or_public_labels(self):
        for key, value in (("review_status", "accepted"), ("exposure", "public")):
            rows = [r.copy() for r in self.rows]
            rows[0][key] = value
            self.reject(rows)

    def test_split_and_no_target_leakage(self):
        splits = course.load_data(self.path)
        groups = [{r["case_family"] for r in rows} for rows in splits.values()]
        self.assertFalse(groups[0] & groups[1] or groups[0] & groups[2] or groups[1] & groups[2])
        rows = splits["train"]
        before = course.xy(rows)
        for r in rows:
            r["label_reason"] = "Priority=Low High Medium"
            r["file_path"] = "target-answer"
        self.assertEqual(before, course.xy(rows))

    def test_saved_model_predictions_match_report(self):
        out = course.ROOT / "output/ml/coursework-v1"
        splits = course.load_data(self.path)
        x, y = course.xy(splits["test"])
        metrics = json.loads((out / "metrics.json").read_text())
        for name in ("decision_tree", "random_forest"):
            # Only locally generated artifacts are loaded.
            with (out / (name + ".pkl")).open("rb") as f:
                model = pickle.load(f)
            self.assertEqual(course.scores(y, model.predict(x)), metrics["test_results"][name])


if __name__ == "__main__":
    unittest.main()
