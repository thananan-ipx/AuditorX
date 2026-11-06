"""Export our trusted local sklearn tree to a data-only serving artifact."""
import argparse
import hashlib
import json
import pickle
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--experiment-dir", type=Path, default=Path("output/ml/coursework-v1"))
args = parser.parse_args()
folder = args.experiment_dir
metrics = json.loads((folder / "metrics.json").read_text(encoding="utf-8"))
if metrics["primary_model"] != "decision_tree" or metrics["human_ground_truth"] is not False:
    raise ValueError("Expected the local simulated Decision Tree experiment")
# Only the artifact produced by our own trainer is loaded, never a request upload.
raw = (folder / "decision_tree.pkl").read_bytes()
pipeline = pickle.loads(raw)
vectorizer, classifier = pipeline.steps[0][1], pipeline.steps[1][1]
tree = classifier.tree_
artifact = {
    "schema_version": "auditorx-tree-v1", "feature_contract": "priority-features-v1",
    "model_version": metrics["experiment"], "dataset_kind": metrics["dataset_kind"],
    "human_ground_truth": False, "source_model_sha256": hashlib.sha256(raw).hexdigest(),
    "features": metrics["features"], "encoded_features": vectorizer.get_feature_names_out().tolist(),
    "classes": classifier.classes_.tolist(), "training_rows": metrics["split_rows"]["train"],
    "nodes": [{"left": int(tree.children_left[i]), "right": int(tree.children_right[i]),
               "feature": int(tree.feature[i]), "threshold": float(tree.threshold[i]),
               "values": tree.value[i][0].tolist()} for i in range(tree.node_count)],
}
target = folder / "service-model.json"
if target.exists():
    raise ValueError("Serving artifact exists; preserve it or choose a new experiment directory")
target.write_text(json.dumps(artifact, indent=2) + "\n", encoding="utf-8")
print(target)
