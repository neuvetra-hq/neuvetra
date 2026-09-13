---
id: 2026-09-12-neuvetra-m46-live-failure-and-m47-remediation
type: meeting
title: "M46 live failure and M47 offline remediation"
status: active
created: 2026-09-12
updated: 2026-09-12
tags: [neuvetra, ghg, rag, openrouter, incident, remediation]
related: [2026-09-11-neuvetra-m43-rag-pilot-readiness, 2026-09-12-neuvetra-m44-zero-activity-closure]
---

# M46 live failure and M47 offline remediation

## Board direction

The board approved the exact M46 H01-then-gated-H04 paid diagnostic and asked for publication only if everything went well. After M46 failed, the board directed the team to move forward with the bounded offline repair. The failed run is not publication authority.

## Demonstrated outcome

H01 passed the independent terminal gate. It correctly explained that a supplier product factor must represent all electricity delivered, including supplier generation and purchases. It used three settled stages, cost $0.247266 and completed in 63.891 seconds.

H04 safely withheld a factor and district-steam calculation. It returned `unsupported` / `action_out_of_scope` with empty claims, evidence and sources, used three stages, cost $0.295880 and completed in 86.333 seconds. It failed the frozen terminal contract because one additional gap was classified `context_required` for “Use this guidance to”; the contract required every H04 gap to be `action_out_of_scope`.

The frozen H04 permit issuer also failed twice with Windows/Bun `EEXIST` on the existing OneDrive ingress directory. A directly generated permit matched the schema and hashes and was consumed before expiry, but backend acceptance did not prove the approved issuer ran. Independent QA treated this as a release-blocking execution-provenance deviation.

## Closure and accounting

M46 used six stages with zero retries, carry, corrections, pending or uncertain events. Exact current-run settled cost is $0.543146. No provider request occurred after H04. The backend and frontend are stopped, ports 3012/3016/5174/5175 are closed, and the run is sealed as `evidence_integrity_failure` with no restart or carry.

Independent closure QA passed the emergency seal only. It did not accept the live milestone, pilot, publication, commit-as-success, merge, deployment or release. M46 is directional evidence and cannot be reused or relabeled as held-out success.

## Next milestone

M47 is offline-only remediation. It preserves M46 and creates a new provider-disabled path that:

- handles pre-existing OneDrive directories without losing exclusive one-use issuance;
- binds issuer provenance to a wrapper-generated one-use capability and refuses partial, manual, stale or replayed artifacts before provider access;
- repairs “this guidance” classification at the production boundary without weakening the terminal contract or breaking real missing-context behavior;
- rehearses the actual two-case lifecycle on the workspace filesystem with no credentials or external requests; and
- receives independent QA on stable final bytes.

Any later live successor must use a disjoint held-out case and a fresh board-approved, costed scope.
