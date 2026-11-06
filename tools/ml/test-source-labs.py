"""Ensure source-lab evaluation rejects leakage and invalid database snapshots."""
import copy
import csv
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("course", Path(__file__).with_name("train-coursework.py"))
course = importlib.util.module_from_spec(spec)
spec.loader.exec_module(course)


class SourceLabChecks(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.root = Path(self.folder.name)
        self.rows, projects, scans = [], [], {}
        for split in ("train", "validation", "test"):
            variants = []
            for i, label in enumerate(course.LABELS):
                variant = {"unsafe_file": f"{i}.ts", "repository_criticality": "low", "exposure": "test_only", "impact": "low"}
                variants.append(variant)
                self.rows.append({"case_family": split, "scan_id": split, "split": split, "clone_group": split,
                                  "schema_version": "priority-simulated-dataset-v1", "human_ground_truth": "false",
                                  "review_status": "simulated", "priority_label": label, "finding_fingerprint": f"{split}-{i}",
                                  "rule_id": "example", "file_path": variant["unsafe_file"], "rule_count_in_scan": "3",
                                  **{k:v for k,v in variant.items() if k != "unsafe_file"}})
            projects.append({"case_family": split, "name": split, "split": split, "clone_group": split,
                             "expected_rule": "example", "variants": variants})
            scans[split] = split
        self.manifest = {"schema_version": "priority-source-labs-v1", "human_ground_truth": False,
                         "primary_rows_expected": 9, "projects": projects}
        self.snapshot = {"scan_ids": scans}

    def tearDown(self):
        self.folder.cleanup()

    def load(self, rows=None, manifest=None, corrupt_hash=False):
        rows = self.rows if rows is None else rows
        path = self.root / "dataset.csv"
        with path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
            writer.writeheader(); writer.writerows(rows)
        snapshot = {**self.snapshot, "sha256": "bad" if corrupt_hash else hashlib.sha256(path.read_bytes()).hexdigest()}
        (self.root / "snapshot.json").write_text(json.dumps(snapshot))
        manifest_path = self.root / "manifest.json"
        manifest_path.write_text(json.dumps(self.manifest if manifest is None else manifest))
        return course.load_source_labs(path, manifest_path)

    def test_frozen_split_has_all_classes(self):
        splits,_ = self.load()
        self.assertEqual({s:len(rows) for s,rows in splits.items()}, {"train":3,"validation":3,"test":3})

    def test_reject_changed_snapshot_review_or_scenario(self):
        with self.assertRaises(ValueError):
            self.load(corrupt_hash=True)
        for key,value in (("review_status","accepted"),("split","test"),("impact","high"),("scan_id","other")):
            rows = copy.deepcopy(self.rows)
            rows[0][key] = value
            with self.subTest(key=key), self.assertRaises(ValueError):
                self.load(rows)

    def test_reject_duplicate_findings_and_cross_split_clones(self):
        rows = copy.deepcopy(self.rows)
        rows[1] = rows[0].copy()
        with self.assertRaises(ValueError):
            self.load(rows)
        rows = copy.deepcopy(self.rows)
        rows[1]["file_path"] = rows[0]["file_path"]
        with self.assertRaises(ValueError):
            self.load(rows)
        manifest, rows = copy.deepcopy(self.manifest), copy.deepcopy(self.rows)
        for p in manifest["projects"]:
            p["clone_group"] = "same-template"
        for row in rows:
            row["clone_group"] = "same-template"
        with self.assertRaises(ValueError):
            self.load(rows, manifest)


if __name__ == "__main__":
    unittest.main()
