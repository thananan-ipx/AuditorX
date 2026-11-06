# AuditorX coursework experiment

Primary model: Decision Tree (lecture-aligned).

SIMULATED LABELS. This is a pipeline demonstration, not real-world validation.

Train / validation / test: 6 / 3 / 3, grouped by authored case family.
Tree max_depth=1, selected on validation Macro F1, shallowest wins ties.

| Method | Test accuracy | Test Macro F1 |
|---|---:|---:|
| severity_baseline | 0.333 | 0.333 |
| decision_tree | 0.333 | 0.222 |
| random_forest | 0.333 | 0.167 |

![Decision tree](decision-tree.png)

![Confusion matrices](confusion-matrices.png)

## Limitations

- Only 6 train, 3 validation and 3 test rows from one authored lab.
- Simulated labels, not human-confirmed production priorities.
- Test families were already examined in the earlier experiment; not a fresh blind benchmark.
- Constant context features cannot teach context-dependent prioritization.
- No claim of performance on unseen real projects.

Constant features: language, repository_criticality, exposure, impact

Next: obtain diverse labeled projects/scenarios, freeze new group-held-out test data,
then evaluate before integrating predictions into the dashboard.
