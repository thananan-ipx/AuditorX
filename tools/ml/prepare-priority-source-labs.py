"""Generate scan-only source projects and freeze a simulated experiment before training."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / "examples/nextjs-scan-lab"
OUT = ROOT / "artifacts/datasets/priority-source-v3"
SPLITS = {
    "train": {"html", "public-secret", "sql", "ownership", "status", "redirect", "credentials", "client-boundary"},
    "validation": {"logging", "shell"},
    "test": {"eval", "cache"},
}


def main():
    if OUT.exists():
        raise ValueError("Preserve existing experiment; output already exists")
    cases = json.loads((BASE / "cases.json").read_text())["cases"]
    projects, hashes = [], {}
    for case in cases:
        family = case["family"]
        split = next(s for s, families in SPLITS.items() if family in families)
        project = OUT / "projects" / ("lab-" + family)
        project.mkdir(parents=True)
        (project / "package.json").write_text(json.dumps({"name": "auditorx-lab-" + family,
                                                         "private": True, "dependencies": {"next": "16.4.5"}}, indent=2) + "\n")
        variants = []
        for criticality in ("low", "normal", "high"):
            for impact in ("low", "medium", "high"):
                variant = f"criticality-{criticality}-impact-{impact}"
                paths = {}
                for kind in ("unsafe", "fixed"):
                    source = BASE / case[kind + "_file"]
                    relative = Path("variants") / variant / case[kind + "_file"]
                    destination = project / relative
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    raw = source.read_bytes()
                    destination.write_bytes(raw)
                    paths[kind + "_file"] = relative.as_posix()
                    digest = hashlib.sha256(raw).hexdigest()
                    hashes.setdefault(digest, set()).add(split)
                variants.append({**paths, "repository_criticality": criticality,
                                 "exposure": "test_only", "impact": impact})
        # Shared mock dependencies remain data-only; no app/server is started.
        destination = project / "lib/demo-data.ts"
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes((BASE / "lib/demo-data.ts").read_bytes())
        record = {"name": "lab-" + family, "case_family": family, "split": split,
                  "clone_group": "server-action" if family in {"ownership", "status"} else family,
                  "expected_rule": case["expected_rule"], "notes": case["notes"],
                  "local_scan_path": project.relative_to(ROOT.parent).as_posix(), "variants": variants}
        (project / "scenario.json").write_text(json.dumps(record, indent=2) + "\n")
        (project / "README.txt").write_text(
            "SCAN-ONLY SOURCE LAB. Not a deployable application. Fictional data only.\n"
            "Derived from nextjs-scan-lab; nine copies are context scenarios, not independent projects.\n"
            "Do not run unsafe fixtures. Imports are analyzed statically; dependencies are not installed.\n"
            "Criticality and impact are hypothetical teaching assumptions. Actual exposure is test_only.\n")
        projects.append(record)
    if any(len(splits) > 1 for splits in hashes.values()):
        raise ValueError("Identical case source crossed an evaluation split")
    manifest = {
        "schema_version": "priority-source-labs-v1", "dataset_kind": "simulated_source_lab",
        "human_ground_truth": False, "projects": projects,
        "project_count": len(projects), "primary_rows_expected": sum(len(p["variants"]) for p in projects),
        "frozen_split": {s: sorted(families) for s, families in SPLITS.items()},
        "rubric": "score = severity(Low=1,Medium=2,High=3) + criticality(low=0,normal=1,high=2) + impact(low=0,medium=1,high=2); High>=6, Medium>=4, otherwise Low",
        "predeclared_tree_depths": [1, 2, 3, 4, 5],
        "limitations": ["Twelve derived source fixture projects, not twelve independently developed production apps.",
                        "Nine context copies per family are correlated; families and unsafe/fixed pairs stay in one split.",
                        "Shared mock boilerplate is not an example and is never used as a model feature.",
                        "Labels come from a declared simulator rubric, not human ground truth.",
                        "Family templates were examined previously; evaluation is not a new blind real-project benchmark.",
                        "Scores measure reproduction of the rubric, not real-world vulnerability severity or repair value."],
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps({k: manifest[k] for k in ("project_count", "primary_rows_expected", "frozen_split")}, indent=2))


if __name__ == "__main__":
    main()
