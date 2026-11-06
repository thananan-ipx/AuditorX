"""Tiny source-to-scan-to-training demonstration using authored scenario labels."""
import csv
import json
import pickle
from collections import Counter
from pathlib import Path

import sklearn
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_extraction import DictVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, confusion_matrix, f1_score
from sklearn.pipeline import make_pipeline

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "artifacts/datasets/nextjs-source-lab-v1"
OUT = ROOT / ".local/nextjs-source-lab-model-v1"
FEATURES = ["severity", "rule_family", "category", "language", "file_type", "rule_count_in_scan"]
LABELS = ["High", "Medium", "Low"]
FAMILIES = {
    "train": {"html", "public-secret", "sql", "ownership", "redirect", "status"},
    "validation": {"shell", "logging", "credentials"},
    "test": {"eval", "cache", "client-boundary"},
}


def main():
    if OUT.exists():
        raise ValueError("Model output already exists; preserve experiment history.")
    with (DATA / "candidate-labels.csv").open(encoding="utf-8-sig", newline="") as handle:
        candidates = list(csv.DictReader(handle))
    scan = json.loads((DATA / "scan.json").read_text(encoding="utf-8"))
    counts = Counter(f["rule_id"] for f in scan["findings"])
    splits = {}
    for split, families in FAMILIES.items():
        rows = []
        for c in candidates:
            if c["case_family"] not in families:
                continue
            rule = c["rule_id"]
            row = {**c, "split": split, "priority_label": c["proposed_priority"],
                   "training_label_source": "authored_source_lab_scenario_v1",
                   "rule_family": rule.removeprefix("auditorx.javascript.").removeprefix("auditorx."),
                   "category": "Manual review" if ".review." in rule else "Coding standard" if ".coding-standard." in rule else "Security",
                   "language": "typescript", "file_type": Path(c["file_path"]).suffix[1:],
                   "rule_count_in_scan": counts[rule]}
            rows.append(row)
        if {r["priority_label"] for r in rows} != set(LABELS):
            raise ValueError(f"Missing class in {split}")
        splits[split] = rows
    if any(FAMILIES[a] & FAMILIES[b] for a, b in [("train", "validation"), ("train", "test"), ("validation", "test")]):
        raise ValueError("Case-family leakage")
    if sum(map(len, splits.values())) != 12:
        raise ValueError("Expected 12 primary scan matches")
    for split, rows in splits.items():
        with (DATA / f"{split}-weak-labels.csv").open("x", encoding="utf-8-sig", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
            writer.writeheader(); writer.writerows(rows)
    def xy(split):
        return ([{f: r[f] for f in FEATURES} for r in splits[split]], [r["priority_label"] for r in splits[split]])
    train_x, train_y = xy("train")
    val_x, val_y = xy("validation")
    models = {
        "logistic_regression": make_pipeline(DictVectorizer(), LogisticRegression(max_iter=2000, class_weight="balanced", random_state=42)),
        "random_forest": make_pipeline(DictVectorizer(), RandomForestClassifier(n_estimators=100, class_weight="balanced", random_state=42, n_jobs=1)),
    }
    scores = {}
    for name, model in models.items():
        model.fit(train_x, train_y)
        scores[name] = f1_score(val_y, model.predict(val_x), labels=LABELS, average="macro", zero_division=0)
    selected = max(scores, key=scores.get)
    test_x, test_y = xy("test")
    predictions = models[selected].predict(test_x)
    report = {
        "dataset_kind": "authored_source_lab", "label_source": "authored_source_lab_scenario_v1",
        "human_ground_truth": False, "scan_id": scan["scan_id"], "source_digest": scan["source_digest"],
        "sklearn_version": sklearn.__version__, "features": FEATURES,
        "split_rows": {key: len(value) for key, value in splits.items()},
        "split_families": {key: sorted(value) for key, value in FAMILIES.items()},
        "validation_macro_f1": scores, "selected_model": selected,
        "test_macro_f1": f1_score(test_y, predictions, labels=LABELS, average="macro", zero_division=0),
        "severity_baseline_test_macro_f1": f1_score(test_y, [r["severity"] for r in test_x], labels=LABELS, average="macro", zero_division=0),
        "confusion_matrix_labels": LABELS, "test_confusion_matrix": confusion_matrix(test_y, predictions, labels=LABELS).tolist(),
        "test_classification_report": classification_report(test_y, predictions, labels=LABELS, output_dict=True, zero_division=0),
        "limitations": ["Only 6 train, 3 validation and 3 test examples.", "Labels are authored hypothetical scenarios, not confirmed production priorities.", "Family holdout within one lab, not a real-project holdout.", "No real-project generalization claim is supported."],
    }
    OUT.mkdir(parents=True)
    with (OUT / "source-lab-model.pkl").open("xb") as handle:
        pickle.dump(models[selected], handle)
    (OUT / "metrics.json").write_text(json.dumps(report, indent=2)+"\n", encoding="utf-8")
    print(json.dumps({k: report[k] for k in ["scan_id", "split_rows", "selected_model", "test_macro_f1", "severity_baseline_test_macro_f1", "human_ground_truth"]}, indent=2))


if __name__ == "__main__":
    main()
