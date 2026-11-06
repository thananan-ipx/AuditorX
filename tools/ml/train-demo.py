"""Train a coursework smoke test on the explicitly synthetic Priority dataset."""
import argparse
import csv
import hashlib
import json
import pickle
import platform
from pathlib import Path

import sklearn
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_extraction import DictVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, confusion_matrix, f1_score
from sklearn.pipeline import make_pipeline


ROOT = Path(__file__).resolve().parents[2]
LABELS = ["High", "Medium", "Low"]
FEATURES = ["severity", "rule_family", "category", "language", "file_type",
            "repository_criticality", "exposure", "impact"]


def load_splits(directory):
    manifest = json.loads((directory / "manifest.json").read_text(encoding="utf-8"))
    if manifest.get("schema_version") != "priority-synthetic-v1" or manifest.get("dataset_kind") != "synthetic":
        raise ValueError("This demo trainer only accepts the synthetic dataset.")
    if manifest.get("features") != FEATURES:
        raise ValueError("Unexpected feature list; never train on rubric_score or label_reason.")
    splits, groups = {}, {}
    for split in ("train", "validation", "test"):
        path = directory / f"{split}.csv"
        if hashlib.sha256(path.read_bytes()).hexdigest() != manifest["sha256"][path.name]:
            raise ValueError(f"Checksum mismatch: {path.name}")
        with path.open(encoding="utf-8-sig", newline="") as handle:
            rows = list(csv.DictReader(handle))
        if not rows or any(r["dataset_kind"] != "synthetic" or r["split"] != split for r in rows):
            raise ValueError(f"Invalid provenance/split: {split}")
        if {r["priority_label"] for r in rows} != set(LABELS):
            raise ValueError(f"Missing class: {split}")
        groups[split] = {r["repository_group"] for r in rows}
        splits[split] = ([{f: r[f] for f in FEATURES} for r in rows],
                         [r["priority_label"] for r in rows])
    if (groups["train"] & groups["validation"] or groups["train"] & groups["test"]
            or groups["validation"] & groups["test"]):
        raise ValueError("Group leakage across train/validation/test")
    return manifest, splits


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset-dir", type=Path, default=ROOT / "artifacts/datasets/synthetic-priority-v1")
    parser.add_argument("--output-dir", type=Path, default=ROOT / ".local/ml-demo-result-v1")
    args = parser.parse_args()
    if args.output_dir.exists():
        raise ValueError("Output exists. Use a new --output-dir to preserve the experiment.")
    manifest, splits = load_splits(args.dataset_dir)
    train_x, train_y = splits["train"]
    val_x, val_y = splits["validation"]
    candidates = {
        "logistic_regression": make_pipeline(DictVectorizer(), LogisticRegression(max_iter=2000, random_state=42)),
        "random_forest": make_pipeline(DictVectorizer(), RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=1)),
    }
    validation = {}
    for name, model in candidates.items():
        model.fit(train_x, train_y)
        validation[name] = f1_score(val_y, model.predict(val_x), labels=LABELS, average="macro", zero_division=0)
    selected = max(validation, key=validation.get)
    # Test is evaluated after model selection; do not tune using these results.
    test_x, test_y = splits["test"]
    predictions = candidates[selected].predict(test_x)
    severity_predictions = [r["severity"] for r in test_x]
    report = {
        "dataset_kind": "synthetic", "not_real_world_validation": True,
        "label_source": "simulated_rubric_v1", "features": FEATURES,
        "python_version": platform.python_version(), "sklearn_version": sklearn.__version__,
        "validation_macro_f1": validation, "selected_model": selected,
        "test_macro_f1": f1_score(test_y, predictions, labels=LABELS, average="macro", zero_division=0),
        "severity_baseline_test_macro_f1": f1_score(test_y, severity_predictions, labels=LABELS, average="macro", zero_division=0),
        "test_confusion_matrix_labels": LABELS,
        "test_confusion_matrix": confusion_matrix(test_y, predictions, labels=LABELS).tolist(),
        "test_classification_report": classification_report(test_y, predictions, labels=LABELS, output_dict=True, zero_division=0),
        "dataset_checksums": manifest["sha256"], "limitations": manifest["limitations"],
    }
    args.output_dir.mkdir(parents=True)
    with (args.output_dir / "synthetic-demo-model.pkl").open("xb") as handle:
        pickle.dump(candidates[selected], handle)
    (args.output_dir / "metrics.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: report[k] for k in ["dataset_kind", "selected_model", "test_macro_f1", "severity_baseline_test_macro_f1"]}, indent=2))
    print(f"Saved demo model and metrics to {args.output_dir}")


if __name__ == "__main__":
    main()
