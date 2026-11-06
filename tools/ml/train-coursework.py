"""Lecture-aligned, explicitly simulated Priority classification experiment."""
import argparse
import csv
import hashlib
import json
import os
import pickle
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
os.environ.setdefault("MPLCONFIGDIR", str(ROOT / ".local/matplotlib-cache"))
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import sklearn
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_extraction import DictVectorizer
from sklearn.metrics import (ConfusionMatrixDisplay, accuracy_score,
                             classification_report, confusion_matrix, f1_score)
from sklearn.pipeline import make_pipeline
from sklearn.tree import DecisionTreeClassifier, export_text, plot_tree

DATA = ROOT / "artifacts/datasets/nextjs-source-lab-v1"
LABELS = ["High", "Medium", "Low"]
# Explicit allowlist: no reasons, paths, identities, case IDs or target values.
FEATURES = ["severity", "rule_family", "category", "language", "file_type",
            "rule_count_in_scan", "repository_criticality", "exposure", "impact"]
FAMILIES = {
    "train": {"html", "public-secret", "sql", "ownership", "redirect", "status"},
    "validation": {"shell", "logging", "credentials"},
    "test": {"eval", "cache", "client-boundary"},
}


def load_data(csv_path, candidates_path=DATA / "candidate-labels.csv"):
    with candidates_path.open(encoding="utf-8-sig", newline="") as f:
        cases = {r["fingerprint"]: r for r in csv.DictReader(f)}
    with csv_path.open(encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
    fingerprints = [r["finding_fingerprint"] for r in rows]
    if len(rows) != 12 or len(set(fingerprints)) != 12 or set(fingerprints) != set(cases):
        raise ValueError("Expected exactly the 12 distinct primary source-lab findings")
    splits = {s: [] for s in FAMILIES}
    for row in rows:
        if (row["schema_version"] != "priority-simulated-dataset-v1"
                or row["review_status"] != "simulated" or row["exposure"] != "test_only"
                or row["priority_label"] not in LABELS):
            raise ValueError("Only explicitly simulated test-only labels are allowed")
        case = cases[row["finding_fingerprint"]]
        if any(row[k] != case[k] for k in ("scan_id", "rule_id", "file_path")):
            raise ValueError("Scan provenance does not match source-lab candidates")
        split = next(s for s, families in FAMILIES.items() if case["case_family"] in families)
        splits[split].append({**row, "case_family": case["case_family"]})
    if any({r["priority_label"] for r in rows} != set(LABELS) for rows in splits.values()):
        raise ValueError("Each split must contain all three classes")
    return splits


def xy(rows):
    features = []
    for r in rows:
        feature = {k: (r[k] or "unknown") for k in FEATURES}
        feature["rule_count_in_scan"] = int(r["rule_count_in_scan"])
        features.append(feature)
    return features, [r["priority_label"] for r in rows]


def scores(actual, predicted):
    return {"accuracy": accuracy_score(actual, predicted),
            "macro_f1": f1_score(actual, predicted, labels=LABELS, average="macro", zero_division=0),
            "confusion_matrix": confusion_matrix(actual, predicted, labels=LABELS).tolist(),
            "classification_report": classification_report(actual, predicted, labels=LABELS,
                                                            output_dict=True, zero_division=0)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=DATA / "simulated-labels.csv")
    parser.add_argument("--output-dir", type=Path, default=ROOT / "output/ml/coursework-v1")
    args = parser.parse_args()
    if args.output_dir.exists():
        raise ValueError("Output exists; use a new versioned output directory")
    splits = load_data(args.input)
    train_x, train_y = xy(splits["train"])
    val_x, val_y = xy(splits["validation"])
    # Depth is chosen on validation only. Ties prefer the shallower tree.
    trees, validation = {}, {}
    for depth in (1, 2, 3):
        model = make_pipeline(DictVectorizer(), DecisionTreeClassifier(
            criterion="gini", max_depth=depth, class_weight="balanced", random_state=42))
        model.fit(train_x, train_y)
        trees[depth] = model
        validation[depth] = scores(val_y, model.predict(val_x))["macro_f1"]
    depth = max(validation, key=validation.get)
    forest = make_pipeline(DictVectorizer(), RandomForestClassifier(
        n_estimators=100, max_depth=3, class_weight="balanced", random_state=42, n_jobs=1))
    forest.fit(train_x, train_y)
    models = {"decision_tree": trees[depth], "random_forest": forest}
    # Decision Tree is the predeclared coursework model, not selected on test scores.
    test_x, test_y = xy(splits["test"])
    predictions = {"severity_baseline": [r["severity"] for r in splits["test"]]}
    predictions.update({name: model.predict(test_x).tolist() for name, model in models.items()})
    results = {name: scores(test_y, pred) for name, pred in predictions.items()}
    report = {
        "experiment": "lecture_decision_tree_v1", "dataset_kind": "simulated_source_lab",
        "human_ground_truth": False, "input_sha256": hashlib.sha256(args.input.read_bytes()).hexdigest(),
        "scan_ids": sorted({r["scan_id"] for rows in splits.values() for r in rows}),
        "source_revisions": sorted({r["source_revision"] for rows in splits.values() for r in rows}),
        "sklearn_version": sklearn.__version__, "features": FEATURES,
        "split_families": {s: sorted(f) for s, f in FAMILIES.items()},
        "split_rows": {s: len(r) for s, r in splits.items()},
        "primary_model": "decision_tree", "selected_max_depth": depth,
        "tree_validation_macro_f1": validation,
        "forest_validation_macro_f1": scores(val_y, forest.predict(val_x))["macro_f1"],
        "confusion_matrix_labels": LABELS, "test_results": results,
        "constant_features": [k for k in FEATURES if len({r[k] for rows in splits.values() for r in rows}) == 1],
        "limitations": ["Only 6 train, 3 validation and 3 test rows from one authored lab.",
                        "Simulated labels, not human-confirmed production priorities.",
                        "Test families were already examined in the earlier experiment; not a fresh blind benchmark.",
                        "Constant context features cannot teach context-dependent prioritization.",
                        "No claim of performance on unseen real projects."],
    }
    out = args.output_dir
    out.mkdir(parents=True)
    (out / "metrics.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    for name, model in models.items():
        with (out / (name + ".pkl")).open("xb") as f:
            pickle.dump(model, f)
    # Preserve exact input and split assignments for reproducibility.
    (out / "input.csv").write_bytes(args.input.read_bytes())
    for split, rows in splits.items():
        with (out / (split + ".csv")).open("x", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=list(rows[0])); writer.writeheader(); writer.writerows(rows)
    with (out / "test-predictions.csv").open("x", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["finding_fingerprint", "case_family", "actual", *predictions])
        writer.writeheader()
        for i, row in enumerate(splits["test"]):
            writer.writerow({"finding_fingerprint": row["finding_fingerprint"], "case_family": row["case_family"],
                             "actual": test_y[i], **{name: pred[i] for name, pred in predictions.items()}})
    vectorizer, tree = models["decision_tree"].steps[0][1], models["decision_tree"].steps[1][1]
    names = vectorizer.get_feature_names_out().tolist()
    (out / "decision-tree.txt").write_text(export_text(tree, feature_names=names), encoding="utf-8")
    fig, ax = plt.subplots(figsize=(15, 8))
    plot_tree(tree, feature_names=names, class_names=tree.classes_.tolist(), filled=True,
              rounded=True, precision=2, fontsize=10, ax=ax)
    ax.set_title("AuditorX Decision Tree | simulated labels | train n=6")
    fig.tight_layout(); fig.savefig(out / "decision-tree.png", dpi=160); plt.close(fig)
    fig, axes = plt.subplots(1, 3, figsize=(14, 4.5))
    for ax, (name, pred) in zip(axes, predictions.items()):
        ConfusionMatrixDisplay.from_predictions(test_y, pred, labels=LABELS, ax=ax, colorbar=False, cmap="Blues")
        ax.set_title(f"{name}\nMacro F1 = {results[name]['macro_f1']:.3f}")
    fig.suptitle("Simulated source lab | test n=3 | not real-world validation")
    fig.tight_layout(); fig.savefig(out / "confusion-matrices.png", dpi=160); plt.close(fig)
    lines = ["# AuditorX coursework experiment", "", "Primary model: Decision Tree (lecture-aligned).",
             "", "SIMULATED LABELS. This is a pipeline demonstration, not real-world validation.",
             "", "Train / validation / test: 6 / 3 / 3, grouped by authored case family.",
             f"Tree max_depth={depth}, selected on validation Macro F1, shallowest wins ties.",
             "", "| Method | Test accuracy | Test Macro F1 |", "|---|---:|---:|"]
    lines += [f"| {n} | {r['accuracy']:.3f} | {r['macro_f1']:.3f} |" for n, r in results.items()]
    lines += ["", "![Decision tree](decision-tree.png)", "", "![Confusion matrices](confusion-matrices.png)",
              "", "## Limitations", "", *["- " + s for s in report["limitations"]],
              "", "Constant features: " + ", ".join(report["constant_features"]),
              "", "Next: obtain diverse labeled projects/scenarios, freeze new group-held-out test data,",
              "then evaluate before integrating predictions into the dashboard."]
    (out / "report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(out), "depth": depth, "test_results": results}, indent=2))


if __name__ == "__main__":
    main()
