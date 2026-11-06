"""Operator-only local Docker workflow: real worker scans, simulated labels, CSV snapshot."""
import argparse
from collections import Counter
import csv
import hashlib
import json
from pathlib import Path
import subprocess
import time
from uuid import UUID

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "artifacts/datasets/priority-source-v3"


def quote(value):
    return "'" + str(value).replace("'", "''") + "'"


def query(sql):
    result = subprocess.run(["docker", "compose", "exec", "-T", "postgres", "psql", "-U", "postgres",
                             "-d", "auditorx", "-qAt", "-v", "ON_ERROR_STOP=1"],
                            cwd=ROOT, input=sql, text=True, capture_output=True, encoding="utf-8", timeout=30)
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout.strip()


def rubric(severity, criticality, impact):
    score = {"Low": 1, "Medium": 2, "High": 3}[severity]
    score += {"low": 0, "normal": 1, "high": 2}[criticality] + {"low": 0, "medium": 1, "high": 2}[impact]
    return ("High" if score >= 6 else "Medium" if score >= 4 else "Low"), score


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--actor", type=UUID, required=True)
    parser.add_argument("--repository", type=UUID, required=True)
    args = parser.parse_args()
    manifest = json.loads((DATA / "manifest.json").read_text())
    checkpoint = DATA / "scans.json"
    scans = json.loads(checkpoint.read_text()) if checkpoint.exists() else {}
    actor, repo = quote(args.actor), quote(args.repository)
    def as_actor(sql):
        return query(f"BEGIN; SET LOCAL ROLE authenticated; SET LOCAL \"request.jwt.claim.sub\"={actor}; {sql}; COMMIT;")
    all_rows = []
    for project in manifest["projects"]:
        name = project["name"]
        if name not in scans:
            scan_id = as_actor(f"INSERT INTO scan_jobs(repository_id,requested_by,branch,source_kind,source_name,prediction_context) "
                               f"SELECT id,{actor},default_branch,'local',{quote(project['local_scan_path'])},"
                               "'{\"repository_criticality\":\"unknown\",\"exposure\":\"test_only\",\"impact\":\"unknown\"}'::jsonb "
                               f"FROM repositories WHERE id={repo} RETURNING id")
            UUID(scan_id)
            scans[name] = scan_id
            checkpoint.write_text(json.dumps(scans, indent=2) + "\n")
        scan_id = scans[name]
        deadline = time.monotonic() + 180
        while True:
            job = json.loads(query(f"SELECT row_to_json(j) FROM scan_jobs j WHERE id={quote(scan_id)}"))
            if job["status"] == "completed":
                break
            if job["status"] in ("failed", "cancelled") or time.monotonic() > deadline:
                raise RuntimeError(f"Scan {name}: {job['status']} {job.get('error_code')}")
            time.sleep(2)
        findings = json.loads(query(f"SELECT coalesce(json_agg(f ORDER BY file_path,start_line),'[]'::json) FROM scan_findings f WHERE scan_id={quote(scan_id)}"))
        variants = {v["unsafe_file"]: v for v in project["variants"]}
        primary = [f for f in findings if f["file_path"] in variants and f["rule_id"] == project["expected_rule"]]
        if len(primary) != 9 or len({f['file_path'] for f in primary}) != 9:
            raise ValueError(f"Expected one primary match per context in {name}; got {len(primary)}")
        counts = Counter(f["rule_id"] for f in findings)
        labels = []
        for finding in findings:
            variant = variants.get(finding["file_path"])
            selected = variant is not None and finding["rule_id"] == project["expected_rule"]
            if selected:
                priority, score = rubric(finding["severity"], variant["repository_criticality"], variant["impact"])
                criticality, impact = variant["repository_criticality"], variant["impact"]
                reason = (f"SIMULATED source lab; assistant-authored rubric label, not human ground truth. "
                          f"Family={project['case_family']}; assumed criticality={criticality}, impact={impact}; "
                          f"actual exposure=test_only; rubric score={score}. {project['notes']} "
                          "Source variants are correlated copies kept in the same split; no deployed service or real data exists.")
                status = "simulated"
            else:
                priority, criticality, impact = None, "low", "low"
                status = "excluded"
                reason = ("Assistant source-fixture review: fixed/control source or overlapping advisory; excluded from training "
                          "to avoid counting the same scenario twice. Manual-review rules may intentionally match corrected code. "
                          "This is an authored test-only source fixture, not a production assessment.")
            labels.append((finding, status, priority, criticality, impact, reason))
        for finding, status, priority, criticality, impact, reason in labels:
            fields = [scan_id, finding["fingerprint"], str(args.repository), "source-v3-" + project["case_family"],
                      status, priority, criticality, "test_only", impact, reason, str(args.actor)]
            values = ",".join("NULL" if value is None else quote(value) for value in fields)
            as_actor("INSERT INTO priority_labels(scan_id,fingerprint,repository_id,repository_group,review_status,priority_label,"
                     "repository_criticality,exposure,impact,label_reason,reviewer) "
                     f"SELECT {values} WHERE NOT EXISTS(SELECT 1 FROM priority_labels WHERE scan_id={quote(scan_id)} "
                     f"AND fingerprint={quote(finding['fingerprint'])})")
        # Export saved labels, not the in-memory proposals; respect any later review revision.
        saved = json.loads(query("SELECT coalesce(json_agg(l),'[]'::json) FROM (SELECT DISTINCT ON(fingerprint) * FROM priority_labels "
                                 f"WHERE scan_id={quote(scan_id)} ORDER BY fingerprint,id DESC) l"))
        latest = {label["fingerprint"]: label for label in saved}
        for finding in primary:
            label = latest[finding["fingerprint"]]
            if label["review_status"] != "simulated" or label["exposure"] != "test_only":
                raise ValueError("A saved review changed; freeze a fresh experiment rather than overwrite it")
            rule = finding["rule_id"]
            row = {"schema_version": "priority-simulated-dataset-v1", "dataset_kind": "simulated_source_lab",
                   "human_ground_truth": "false", "label_source": "source_fixture_rubric_v1",
                   "case_family": project["case_family"], "clone_group": project["clone_group"], "split": project["split"],
                   "scan_id": scan_id, "repository_group": label["repository_group"], "source_revision": job["commit_sha"],
                   "rules_version": job["rules_version"], "scanner_version": job["scanner_version"],
                   "finding_fingerprint": finding["fingerprint"], "rule_id": rule,
                   "rule_family": rule.removeprefix("auditorx.javascript.").removeprefix("auditorx."),
                   "category": "Manual review" if ".review." in rule else "Coding standard" if ".coding-standard." in rule else "Security",
                   "severity": finding["severity"], "language": "typescript", "file_type": Path(finding["file_path"]).suffix[1:],
                   "file_path": finding["file_path"], "rule_count_in_scan": counts[rule],
                   **{key: label[key] for key in ("repository_criticality", "exposure", "impact", "review_status", "priority_label", "label_reason", "reviewer", "labeled_at")}}
            all_rows.append(row)
        print(f"{name}: scan completed; {len(primary)} simulated examples, {len(findings)-len(primary)} excluded", flush=True)
    target = DATA / "dataset.csv"
    if target.exists():
        raise ValueError("Preserve the existing snapshot; refusing to overwrite dataset.csv")
    with target.open("x", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(all_rows[0]))
        writer.writeheader(); writer.writerows(all_rows)
    summary = {"rows": len(all_rows), "scan_ids": scans, "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
               "splits": {split: dict(Counter(r["priority_label"] for r in all_rows if r["split"] == split))
                          for split in ("train", "validation", "test")}}
    (DATA / "snapshot.json").write_text(json.dumps(summary, indent=2) + "\n")
    print(json.dumps(summary, indent=2), flush=True)


if __name__ == "__main__":
    main()
