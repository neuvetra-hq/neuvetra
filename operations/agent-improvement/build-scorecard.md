# Feature delivery scorecard

Features: 2 | Accepted or later: 1
First-review acceptance: 0/2
Measured actual USD lower bound: unknown (0/0 calls measured; 0 unknown)

## OPS-METRICS-01 — Feature delivery scorecards

State: accepted | Owner: /root/feature_metrics | Milestone: AGENT-IMPROVEMENT

Problem: Agent run records do not provide a joined feature-level QA and cost history.

Delivered: Local deterministic feature scorecards join QA history and native run records, preserve failures and unknown costs, and reject stale acceptance or overwritten inputs.

Acceptance evidence: 3/3 applicable criteria passed (0 failed, 0 pending).

QA: 4 unique findings; 3 rounds (3 completed); 2 rework cycles; 0 post-acceptance findings.

Actual USD lower bound: unknown (0/0 calls measured; 0 unknown).

Actual model identity: 0/0 calls measured; actual effort: 0/0.

Native run records: 2/2 joined; observed model: 0/2; cost: 0/2 measured.

| Native run | Role | Requested | Observed | Reviewer / verdict | Cost USD |
| --- | --- | --- | --- | --- | ---: |
| OPS-METRICS-01 | software-engineering | gpt-5.6-sol/high | unknown/unknown | /root/metrics_qa / pass | unknown |
| OPS-METRICS-QA-01 | qa-lead | gpt-6-astra/high | unknown/unknown | /root / pass | unknown |

## OPS-PILOT-01 — Capped model comparison

State: blocked | Owner: /root/pilot_runner | Milestone: AGENT-IMPROVEMENT

Problem: Cheaper build models have not been evaluated against Neuvetra-specific work.

Delivered: Offline adapter independently accepted after one repair cycle; live comparison waits for secure OpenRouter credential.

Acceptance evidence: 1/3 applicable criteria passed (0 failed, 2 pending).

QA: 2 unique findings; 2 rounds (2 completed); 1 rework cycles; 0 post-acceptance findings.

Actual USD lower bound: unknown (0/0 calls measured; 0 unknown).

Actual model identity: 0/0 calls measured; actual effort: 0/0.

Native run records: 2/2 joined; observed model: 0/2; cost: 0/2 measured.

| Native run | Role | Requested | Observed | Reviewer / verdict | Cost USD |
| --- | --- | --- | --- | --- | ---: |
| OPS-PILOT-01 | software-engineering | gpt-5.6-sol/high | unknown/unknown | /root/metrics_qa / pass | unknown |
| OPS-METRICS-QA-01 | qa-lead | gpt-6-astra/high | unknown/unknown | /root / pass | unknown |

## Model performance review

Descriptive slices by actual route and comparable risk/complexity; features touched do not establish causality.

Calls with unknown actual model/effort: 0.

Limitation: Derived from supplied records only; unknown measurements remain unknown and actual spend is a measured lower bound.
