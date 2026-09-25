# OPS-GRAPH-01 acceptance and rollout

## Boundaries

Authorized by the board in the coordinator task after product work was paused for review. Temporary isolation branch `codex/agent-workflow-controller` starts at product commit `75d8ec4b16054a1bbfc1a51ddaec99000ee1efe2`. Reconcile accepted changes into rolling PR6; do not open a competing milestone PR. No migration, provider request, website deployment or beta acceptance is part of this change.

## Acceptance criteria

| ID | Required outcome |
| --- | --- |
| G01 | Reject invalid/cyclic graphs before reserving work; schedule only eligible dependencies within declared capacity. |
| G02 | Bind review to exact artifacts and consumed dependency versions; changed evidence cannot reuse old acceptance. |
| G03 | Route rejection to its owner, retain unrelated accepted work, and invalidate affected descendants. |
| G04 | Bound corrections and monetary reservations; unknown actual costs remain encumbered and unknown, not zero. |
| G05 | Persist attempt state across restart; pause prevents new work; uncertain execution requires explicit resolution. |
| G06 | Controller emits tickets only and cannot execute commands, call models or authorize production. |
| G07 | Independent review challenges public CLI behavior and the integrated example, preserving failed rounds. |
| G08 | Extend existing CI checks and give the coordinator a usable operating guide; keep role defaults and old evidence intact. |

## Assigned contexts and measurement

- Engineering: `/root/workflow_engineer`, software-engineering critical assignment; requested `gpt-5.6-sol` / `high` from the role registry.
- Independent QA: `/root/workflow_qa`, requested `gpt-6-astra` / `high` from the role registry; did not author the implementation.
- Coordinator: integration, documentation, demonstration and publication handoff.

Requested settings were supplied through dispatch arguments; independently observed execution settings, subscription token consumption and dollar cost are unknown. No external paid model experiment is authorized by this implementation. Offline demonstration monetary values are fixtures, not the costs of building this controller.

Final verdict and exact reviewed hashes belong in `qa-review.md`. No effectiveness or cost reduction is claimed from passing these functional checks. Compare later accepted tasks using existing feature metrics, including reviewer and coordinator effort, without double-counting reservations as expenditure.
