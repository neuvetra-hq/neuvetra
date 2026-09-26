# Hosted setup rebuild — board direction and execution boundary

Board brief: `C:\Users\nimab\Neuvetra\notes\briefs\2026-09-25-hosted-setup-rebuild-brief.md` (2026-09-25). The corporate Scope 1, 2 and 3 inventory and assurance target in `docs/corporate-reporting-direction.md` remains the product direction.

The local `prototypes/company-onboarding` app is a frozen behavior reference. Its SQLite database and Acme draft are not transfer sources. Do not build the `CONVERGENCE.md` export/import/cutover route or extend `convergence-export.cjs`. The board will re-enter Acme manually after the hosted journey works.

Use one general company-scoped setup flow on hosted Postgres. Preserve the M71, M78 and M80 synthetic histories as historical records; the M80 fixture flow may remain reachable for old records while the general setup becomes the primary journey. Unknown answers, explicit No with reason, and not-applicable are distinct. Corrections append versions. No method, factor or emissions calculation is released by setup answers.

Delivery stays on rolling PR #6 in three increments:

1. General schema, tenant/member boundary, versioned seven-step setup and synthetic-company admission; independent native/API/UI review. A staging demonstration requires a fresh backup, actual restore rehearsal, preservation comparison, reviewed schema-23 upgrade and deployment. A local test pass is not a hosted result.
2. Shared collection logic, general activities/records and company-scoped evidence storage with original-byte download, deduplication, orphan recovery and source screening. Validate exact Bayline feedback items and tenant isolation.
3. Customer facts, readiness derivation, saved review/history and download; returning-user persistence and full two-company browser walkthrough.

The board requested one short local handoff in `C:\Users\nimab\Neuvetra\notes\reviews\` at each demonstrated increment. A dependent increment starts after the prior working demonstration and board feedback. Only a step that deletes or replaces hosted data, adds paid/recurring cost or touches real customer data requires a separate board decision. All users and records in this milestone remain synthetic.

Current local evidence: `evaluations/research-qa/hosted-setup-01-independent-review.md` accepted the schema/API on native PostgreSQL, including 125 unchanged legacy tables. `evaluations/research-qa/hosted-setup-01-ui-independent-review.md` accepted the corrected UI/client after React/Chrome and native integration checks. Live provider identity, full browser parity, backup/restore and hosted publication remain separate open gates.
