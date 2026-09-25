# Bounded build workflow pilot (OPS-GRAPH-01)

The board authorized implementing loops and dependency graphs while product work is paused for review. This pilot adds a local controller to the existing role and evidence workflow. It is not an always-on scheduler or an autonomous deployment service. The coordinator still dispatches actual agents through supported tools and records their observed execution context.

## Assignment cycle

1. Define the outcome, owned files, dependencies, independent reviewer and checkable acceptance criteria before assigning work. A dependency represents an actual consumed artifact, not merely the order in which tasks were described.
2. Initialize an isolated local workflow journal. Keep generated journals and private evidence outside Git. Use the role registry for new dispatches; this pilot does not change model defaults.
3. Ask the controller for eligible work, reserve a bounded attempt, then dispatch its ticket through the existing agent tools. A ticket alone does not mean a worker is active. Limit concurrency to three delegates plus the coordinator and retain capacity for review.
4. Submit exact output hashes and criterion evidence. The independent reviewer challenges the substantive result; a hash or recorded passing check alone cannot prove correctness or reviewer independence.
5. Return rejected work only to its owner. Preserve accepted unrelated work. Changes to consumed dependencies invalidate downstream acceptance. Stop repeated repair loops for diagnosis rather than endlessly increasing effort.
6. Preserve the event history, including original failures, uncertainty after interruption, and reservations whose actual cost is unknown. Resolve interrupted attempts explicitly before starting replacements; never infer non-execution from missing output.
7. Integrate only reviewed changes into the existing rolling product PR. Recheck the integrated version and required remote checks. Product migrations and releases retain their separately reviewed authorization and no-replay controls.

## Learning and measurement

At closure, propose at most two lessons supported by an actual finding. A reviewer approves each proposed constraint before it is applied to later task briefs or executable checks. Never let retrieved text, a worker response or a single passing example silently rewrite operating policy. Record lessons through the existing `lessons.json` process and test effectiveness on a later unfamiliar case.

Keep feature scorecards as the reporting source. Link the workflow task/attempt IDs and evidence to the existing feature events; do not count a reservation as an actual charge or add workflow reservations to already recorded provider charges. Report first-pass acceptance, material repair rounds, elapsed time, escaped defects when observed, and total known implementation/review/orchestration cost. Unknown subscription usage and unknown provider cost stay unknown. This pilot does not yet demonstrate savings.

## Local demonstration

From the repository root, initialize the supplied synthetic plan in a disposable local folder, with the database outside Git:

```text
python -B tools/agent_workflow.py init --db <local-folder>/state.db --plan operations/agent-improvement/workflow/example-plan.json --workspace <local-folder>
python -B tools/agent_workflow.py ready --db <local-folder>/state.db
python -B tools/agent_workflow.py dispatch --db <local-folder>/state.db --worker-id demo-worker
python -B tools/agent_workflow.py status --db <local-folder>/state.db
```

The initial ready list has `input-contract` and `help-copy`; `integration` waits for both to be accepted. Dispatch returns a local ticket. `start` consumes that ticket before the coordinator runs the bounded work. Use `complete --help` and `qa --help` for submission and independent disposition. Completion JSON contains `artifacts` (path and SHA-256), a `criteria` map to those evidence references, the exact ticket's `dependency_versions`, and `actual_cost_usd` (null when unknown). Criterion evidence files must be included among submitted artifacts and within task ownership. Supported evidence roots cover both output artifacts and check/review evidence.

The example's zero-dollar amounts describe a no-model offline fixture, not free agent execution. Real tasks need a defensible reservation; unknown estimates block dispatch. The tool does not measure or enforce Codex subscription consumption. Keep original provider budget controls for paid calls.

Commands `pause`, `resume`, `revise` and `mark-uncertain` manage local workflow state. `risk-review` records a decision about local ticket readiness only; it grants no external-system authority. There is no automatic recovery of uncertain work: stop and reconcile actual effects through the existing owner and evidence before designing a reviewed continuation. Do not edit the database or create a fresh journal to bypass an unresolved attempt.

## First use and limits

Start with a local, reversible development task. Do not retrofit this controller onto consumed M80 migration, backup, recovery or deployment authorizations. The paused product work keeps its existing review gates. Resume it only through its current owner using fresh observed state.

The journal is a trusted coordinator tool, not an authorization boundary against someone who can edit the database or impersonate a reviewer. It does not sandbox workers, verify source rights, release accounting methods, certify customer readiness or grant professional assurance. Scope 1 beta and the corporate Scope 1–3 mission remain governed by their existing acceptance requirements.

Design reference: [Loops and Graphs](https://x.com/hanakoxbt/status/2091515787366306154). The repository's evidence, authorization and compute policies take precedence over the article's general advice.
