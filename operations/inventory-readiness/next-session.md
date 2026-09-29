# Session handoff — 25 September 2026 (America/Los_Angeles)

The board requested notes updated and the session wrapped up. Stop new implementation; collect board feedback before advancing this workflow. This closes the interactive session, not a production-readiness milestone or unrelated product work.

## Achieved

- Connected seven-step company onboarding to dynamic activity collection and durable local storage. Industry labels do not invent activities or method eligibility.
- Added calculation-readiness review of saved inputs, with quantity/unit/date/coverage, evidence-reference, estimate, duplicate/overlap and location questions.
- Added 54 explicit candidate/unsupported mappings: 35 Scope 1 subtypes, four purchased-energy screens and all 15 Scope 3 categories. This is not universal industry calculation coverage.
- Added method-detail preparation, links back to the relevant activity, immutable server-computed review snapshots, history and JSON export. Snapshots retain exact input revision, catalog/registry and engine bytes with hashes. Client verdicts and stale saves are rejected.
- Preserved original Acme input at revision2 during migration to SQLite schema2. Browser tests used a separate database copy. No emissions totals or final reports are generated; calculation authorization remains false.

## Verification and delivery

75 automated cases passed plus intake checks; one Windows symlink test was skipped because the OS denied creation. Independent local review passed. Browser navigation, subtype save, method details/save/reload, snapshot history and historical read-only state were checked by root. JSON download via the browser and device/assistive-technology certification were not claimed. Final visual contrast was repaired and checked; original findings remain in the independent report.

Implementation commits: 8966f0e45 and 93edd0e8632d74cc3200c5604d39bae3d630f4a9. Remote branch codex/corporate-mvp at PR6 was verified at the latter hash. A publication hash check detected Git normalization of the review document; the follow-up commit preserves its exact bytes, and committed bundle/source hashes passed. GitHub checks remain unverified because the connector returned404; no claim of green remote CI or production deployment.

Evidence: prototypes/company-onboarding/readiness-review.md, READINESS.md, READINESS-DOMAIN.md, operations/inventory-readiness/verification.md, and frozen READY-*-LOCAL agent artifacts. Role record validation passed with281 records at delivery; requested versus observed compute remains distinguished and actual costs unknown.

## Resume here

1. Review board feedback on http://127.0.0.1:4319/readiness.html before extending the feature.
2. Recheck the rolling remote branch and CI; do not overwrite concurrent product work or infer approval from old notes.
3. Resolve production dependencies in a bounded integration plan: authenticated company identity/tenant authorization, production backup/restore and operational acceptance, approved source use, released method/factor applicability, and appropriate qualified accounting/release review. These remain unmet, not waived by passing local tests.
4. Do not present input preparation as a finalized calculation, complete corporate inventory, SB253 compliance or independent assurance.

## Local resources

Live preview is served from C:/Users/nimab/.codex/worktrees/inventory-plan-delivery/Neuvetra/prototypes/company-onboarding. The process was started on4319 with the database C:/Users/nimab/Documents/Codex/2026-09-25/neuvetra-inventory-data/workspace.sqlite3. Verify the current listener/command before any restart; do not trust an old process ID. Leave this checkout intact while the preview runs.

Backup before readiness migration: C:/Users/nimab/Documents/Codex/2026-09-25/neuvetra-inventory-data/workspace-before-readiness-20260925-184827.sqlite3. Integrity check passed. The isolated test server on4324 was stopped; its temporary test copy contains test-only revision4. The live browser was left open for the board. Local preview requires the computer/server to remain running; no automatic restart or background agent work was configured.

Original onboarding checkout f15e and the separate product workstream remain untouched. The older connected-inventory-plan checkout is attached and retained; the current live server uses inventory-plan-delivery. No worktree deletion, production deployment, PR merge, subscription or external social action occurred in this increment.
