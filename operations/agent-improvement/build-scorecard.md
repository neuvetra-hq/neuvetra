# Feature delivery scorecard

Features: 2 | Accepted or later: 2
First-review acceptance: 0/2
Measured actual USD lower bound: 0.0631382848 (6/6 calls measured; 0 unknown)

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

State: accepted | Owner: /root/pilot_runner | Milestone: AGENT-IMPROVEMENT

Problem: Cheaper build models have not been evaluated against Neuvetra-specific work.

Delivered: Completed six-request comparison and independent grading for $0.0631382848. Neither candidate qualified for numerical work; existing role defaults retained. Experiment completion is not model qualification.

Acceptance evidence: 3/3 applicable criteria passed (0 failed, 0 pending).

QA: 2 unique findings; 3 rounds (3 completed); 1 rework cycles; 0 post-acceptance findings.

Actual USD lower bound: 0.0631382848 (6/6 calls measured; 0 unknown).

Actual model identity: 6/6 calls measured; actual effort: 0/6.

| Call | Run | Requested | Actual |
| --- | --- | --- | --- |
| bf27e7b3c0f2bbe1973c9c2269451608b628fded4ab088feb42bfb5fb583d7d2 | None | minimax/minimax-m3/unknown | minimax/minimax-m3/unknown |
| 2b25fa72f7ba6a2b3e360aa0db7c5238d2c5e5820cf72c3b1ec23ca8ddac20b8 | None | minimax/minimax-m3/unknown | minimax/minimax-m3/unknown |
| 094ff1ce891a96ecc5d1280182c9d250f412d76b3bb775f441b9433e72333626 | None | minimax/minimax-m3/unknown | minimax/minimax-m3/unknown |
| 836c17a6e23cfe51fece3d9d01d3fd1d158b8c8ee7b61a190029b51cc475c409 | None | moonshotai/kimi-k2.7-code/unknown | moonshotai/kimi-k2.7-code/unknown |
| 70bde35f3908ff4f161ef13195cb0642d973fa2c97bb925b2f7f792a2be43f13 | None | moonshotai/kimi-k2.7-code/unknown | moonshotai/kimi-k2.7-code/unknown |
| 3c4b5e8966fd7915aa19b172b04383c67ce82d87deec0106fb6e2a4cc389e7d3 | None | moonshotai/kimi-k2.7-code/unknown | moonshotai/kimi-k2.7-code/unknown |

Native run records: 2/2 joined; observed model: 0/2; cost: 0/2 measured.

| Native run | Role | Requested | Observed | Reviewer / verdict | Cost USD |
| --- | --- | --- | --- | --- | ---: |
| OPS-PILOT-01 | software-engineering | gpt-5.6-sol/high | unknown/unknown | /root/metrics_qa / pass | unknown |
| OPS-METRICS-QA-01 | qa-lead | gpt-6-astra/high | unknown/unknown | /root / pass | unknown |

## Model performance review

Descriptive slices by actual route and comparable risk/complexity; features touched do not establish causality.

Calls with unknown actual model/effort: 6.

Limitation: Derived from supplied records only; unknown measurements remain unknown and actual spend is a measured lower bound.
