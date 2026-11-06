"""Create a small, explicitly simulated Priority dataset; never reads app data."""
import argparse
import csv
import hashlib
import json
import random
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SCHEMA = "priority-synthetic-v1"
FEATURES = ["severity", "rule_family", "category", "language", "file_type",
            "repository_criticality", "exposure", "impact"]

# Scenario families, not scanner results. Each family stays in a single split.
FAMILIES = [
    ("go-tls", "security.tls-verification-disabled", "Security", "High", "go", "go", "TLS verification disabled in an outbound client."),
    ("go-secret", "security.hardcoded-secret", "Security", "High", "go", "go", "A simulated credential is embedded in application source."),
    ("go-logging", "coding-standard.sensitive-logging", "Coding standard", "Medium", "go", "go", "A password variable is written to a log."),
    ("go-json", "code-quality.unhandled-json-error", "Code quality", "Medium", "go", "go", "A JSON write error is explicitly discarded."),
    ("js-eval", "security.dynamic-eval", "Security", "High", "javascript", "js", "Untrusted text is evaluated as code."),
    ("js-shell", "security.shell-command-execution", "Security", "High", "javascript", "js", "Request text is joined into a shell command."),
    ("js-sql", "security.sql-template-interpolation", "Security", "High", "typescript", "ts", "A query value is interpolated into SQL text."),
    ("py-sql", "security.sql-string-construction", "Security", "High", "python", "py", "A Python query concatenates untrusted input."),
    ("next-html", "nextjs.security.request-html", "Security", "High", "typescript", "tsx", "Untrusted request HTML is rendered without sanitization."),
    ("next-redirect", "nextjs.security.request-redirect", "Security", "Medium", "typescript", "ts", "A return URL is used without destination validation."),
    ("next-action", "nextjs.review.server-action-access", "Manual review", "Low", "typescript", "ts", "A hypothetical action lacks its required permission check."),
    ("next-status", "nextjs.review.status-validation", "Manual review", "Low", "typescript", "ts", "An owner-scoped action accepts arbitrary workflow status text."),
]

CONTEXTS = [
    ("sandbox", "low", "test_only", "low", "Isolated coursework sandbox with disposable test records."),
    ("internal-demo", "low", "internal", "low", "Internal demonstration with disposable records."),
    ("authenticated-demo", "low", "authenticated", "low", "Signed-in demo users; no real business records."),
    ("public-minor", "normal", "public", "low", "Public example endpoint with limited, non-sensitive effects."),
    ("internal-standard", "normal", "internal", "medium", "Internal business workflow with bounded operational effects."),
    ("authenticated-standard", "normal", "authenticated", "medium", "Signed-in business workflow with bounded effects."),
    ("public-sensitive", "high", "public", "high", "Hypothetical public service handling sensitive records."),
    ("authenticated-sensitive", "high", "authenticated", "high", "Hypothetical signed-in service with sensitive records."),
    ("internal-sensitive", "high", "internal", "high", "Hypothetical critical internal service with sensitive records."),
]


def simulated_priority(severity, criticality, exposure, impact):
    """Teaching rubric, not a validated security or business-risk model."""
    score = ({"Low": 1, "Medium": 2, "High": 3}[severity]
             + {"low": 0, "normal": 1, "high": 2}[criticality]
             + {"test_only": 0, "internal": 1, "authenticated": 2, "public": 3}[exposure]
             + {"low": 0, "medium": 1, "high": 2}[impact])
    return ("High" if score >= 8 else "Medium" if score >= 5 else "Low"), score


def make_rows(seed):
    families = [f[0] for f in FAMILIES]
    random.Random(seed).shuffle(families)
    split_for = {name: "train" if i < 8 else "validation" if i < 10 else "test"
                 for i, name in enumerate(families)}
    rows = []
    for family, rule, category, severity, language, extension, finding in FAMILIES:
        for context, criticality, exposure, impact, description in CONTEXTS:
            label, score = simulated_priority(severity, criticality, exposure, impact)
            rows.append({
                "schema_version": SCHEMA, "dataset_kind": "synthetic",
                "label_source": "simulated_rubric_v1", "human_reviewed": "false",
                "sample_id": f"{family}--{context}", "repository_group": f"synthetic-{family}",
                "split": split_for[family], "severity": severity, "rule_family": rule,
                "category": category, "language": language, "file_type": extension,
                "repository_criticality": criticality, "exposure": exposure, "impact": impact,
                "priority_label": label, "rubric_score": score,
                "scenario": f"SIMULATED: {finding} {description}",
                "label_reason": f"Simulated teaching rubric score={score}; this is not a human-confirmed finding.",
            })
    return rows


def validate(rows):
    if len({r["sample_id"] for r in rows}) != len(rows):
        raise ValueError("duplicate sample IDs")
    groups = {}
    for split in ("train", "validation", "test"):
        selected = [r for r in rows if r["split"] == split]
        if {r["priority_label"] for r in selected} != {"High", "Medium", "Low"}:
            raise ValueError(f"missing class in {split}")
        groups[split] = {r["repository_group"] for r in selected}
    if (groups["train"] & groups["validation"] or groups["train"] & groups["test"]
            or groups["validation"] & groups["test"]):
        raise ValueError("scenario family leaked across splits")
    return groups


def write_csv(path, rows):
    with path.open("x", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=ROOT / "artifacts/datasets/synthetic-priority-v1")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    rows = make_rows(args.seed)
    groups = validate(rows)
    output = args.output_dir.resolve()
    output.mkdir(parents=True, exist_ok=False)
    write_csv(output / "dataset.csv", rows)
    for split in ("train", "validation", "test"):
        write_csv(output / f"{split}.csv", [r for r in rows if r["split"] == split])
    manifest = {
        "schema_version": SCHEMA, "dataset_kind": "synthetic", "seed": args.seed,
        "rows": len(rows), "independent_scenario_families": len(FAMILIES),
        "features": FEATURES, "target": "priority_label", "group_column": "repository_group",
        "splits": {split: {"rows": sum(r["split"] == split for r in rows),
                            "groups": sorted(groups[split]),
                            "classes": dict(Counter(r["priority_label"] for r in rows if r["split"] == split))}
                   for split in ("train", "validation", "test")},
        "sha256": {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(output.glob("*.csv"))},
        "label_source": "Simulated score: severity 1..3 + criticality 0..2 + exposure 0..3 + impact 0..2; High>=8, Medium>=5, otherwise Low.",
        "limitations": ["Not real scanner output and not human ground truth.",
                        "108 rows are variations of 12 authored families, not 108 independent projects.",
                        "The target is computed from features: a model learns the simulator's rubric.",
                        "Context features must be available at inference; this differs from the real six-feature experiment.",
                        "Scores on this dataset do not establish performance on real projects."],
    }
    (output / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(output), "rows": len(rows), "splits": manifest["splits"]}, indent=2))


if __name__ == "__main__":
    main()
