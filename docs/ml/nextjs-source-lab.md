# Next.js source lab

Current lecture-aligned plan: [coursework-plan.md](coursework-plan.md).
The new Decision Tree experiment uses the 12 explicit simulated labels exported
from AuditorX; see `output/ml/coursework-v1/report.md`. The earlier experiment
below is preserved as historical evidence, not replaced or promoted to production.

Project: `examples/nextjs-scan-lab` (Next.js 16.4.5, local-only dev port 3012).
The standalone app builds successfully; its dependencies reported zero npm audit
vulnerabilities at preparation time. Intentional source flaws remain for study.

There are 12 authored case families, each with an unsafe and a fixed source file.
`cases.json` records the primary expected rule, paired paths, grouping and
proposed scenario Priority. The app homepage lists the source pairs. Most examples
are runnable routes/actions; client/fs is explicitly scan-only, SQL uses a mock
sink, orders/profiles are fictional, and demo identity is fixed rather than a
production authentication implementation.

Actual AuditorX scan: `d323821f-2669-40d0-92fe-e5c2622e57f2`, baseline-v4,
Semgrep 1.175.0. Source digest:
`de247e47abd7e22c006fb4cbca83dccc115e918914480443cc38c628f320320d`.

The scan returned 25 findings. All have saved AI-assisted review reasons:

- 12 primary unsafe-file matches, with explicitly simulated scenario labels.
- 13 excluded fixed-file advisories or duplicate handler advisories.

The real scan does not turn fake credentials, mock SQL or unreachable fixtures
into proven production vulnerabilities. Proposed High/Medium/Low labels describe
authored teaching scenarios and have not been inserted as accepted human labels.
The synthetic 108-row dataset on /datasets remains a separate experiment.
The scan-label page counts these 12 simulated rows as ready for demo training,
shows human-confirmed and simulated counts separately, and can export just the
simulated rows as priority-simulated-dataset-v1 CSV. The operator human-label
export continues to select only accepted rows.

The real Semgrep regression `TestSemgrepNextLab` verifies all 12 primary matches,
absence of the corresponding security rule on fixed variants, and the expected
manual-review advisories on fixed actions/cache. The same cases may therefore
measure scanner behavior as well as supply review candidates.

For future dataset splitting, keep each unsafe/fixed pair and all derived copies
of the same family together. Do not claim 12 independent real projects or use
duplicate handler findings to inflate sample count. This small lab is a seed for
the pipeline, not a real-project generalization benchmark.

Open AuditorX Dashboard and select history `d323821f` to inspect the saved review.
To rescan, enter `auditor-x/examples/nextjs-scan-lab` in the local-path field.

Prepared artifacts:

- `artifacts/datasets/nextjs-scan-lab-source.zip`: standalone source and lockfile,
  excluding node_modules, build outputs and local environment files.
- `artifacts/datasets/nextjs-source-lab-v1/scan.json`: observed scan provenance and
  all 25 findings.
- `artifacts/datasets/nextjs-source-lab-v1/candidate-labels.csv`: the 12 primary
  matches joined to the authored cases, with proposed High=6 / Medium=3 / Low=3.
  The target is named proposed_priority; these are review candidates, not accepted
  human training labels.

## Tiny weak-label training demonstration

`tools/ml/train-source-lab.py` was run with the authored scenario priorities as
explicit weak/simulated labels. It does not promote any database review to
accepted, and uses only the six original scanner features rather than case IDs,
paths, proposal reasons or labels as inputs.

The 12 primary matches were split by case family: 6 train, 3 validation, 3 test.
Both candidate models were selected using validation; Logistic Regression was
chosen. Test Macro-F1 was 0.222222 versus Severity baseline 0.333333. With only
three test examples and fictional priorities, this is a pipeline smoke test,
not useful model-quality evidence or proof of real-project performance.

Weak-label CSV splits are under `artifacts/datasets/nextjs-source-lab-v1/`.
Model and metrics are under `.local/nextjs-source-lab-model-v1/`.
Reproducing this experiment requires new versioned output folders because the
script deliberately refuses to overwrite an existing model or split files.
