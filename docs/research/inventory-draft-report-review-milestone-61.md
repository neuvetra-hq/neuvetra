# M61 inventory draft-report review implementation record

Date: 2026-09-14

M61 adds one bounded, immutable second-manager decision for the exact M60 synthetic HTML report. It does not revise the report, release a factor or method, create assurance, create a filing, or make the incomplete inventory eligible for release.

## Demonstrated contract

- An owner or administrator other than the M60 report creator can record exactly one terminal decision: `accept_bounded_internal_draft` or `changes_requested`.
- Acceptance requires reason `exact_report_reviewed_for_bounded_internal_use` and the exact ordered acknowledgement of all fixed limitations: incomplete inventory, one estimated period, one excluded period, absent market-based Scope 2, unreleased factor and method, absent Scope 1 and Scope 3, and synthetic local work without assurance.
- A change request requires reason `report_revision_required`, exactly one bounded route code, and a trimmed 1–500 character note without control characters. The note is rendered by React as text.
- Every create and read freshly verifies the current M59 archive, reconstructs the evidence pack, regenerates the deterministic M60 report, compares the exact report bytes and metadata, and then compares every stored M61 binding.
- The stored review binds the report, inventory snapshot, archive, manifest and lineage-root SHA-256 values. It keeps `releaseEligible=false`.
- A canonical decision snapshot SHA-256 seals an explicitly ordered payload containing the tenant, report, decision, reason, acknowledgements, routed note, report hash and creator, every upstream hash, release state, and reviewer identity. TypeScript computes it before persistence, SQL independently recomputes it before insert, and every database and browser read recomputes it. The database timestamp is excluded because it is assigned after validation.
- Forced row-level security permits tenant-member reads. Only tenant managers can create. The report creator cannot review their own report. Outsiders receive no row; direct writes and mutation are denied.
- An exact replay converges on the existing decision. A changed replay, stale report hash, second terminal decision or coordinated stored-data corruption is refused.
- The review form is one labelled decision group with mutually exclusive radio choices. Only the inputs for the selected decision are shown, the change-note counter is programmatically linked to its field, and full report and decision hashes remain visible with wrapping.

## Development boundary

The API requires all M54–M61 flags, including `M61_SYNTHETIC_DRAFT_REPORT_REVIEW=enabled`, in development or test. The web demo additionally requires `VITE_SYNTHETIC_DRAFT_REPORT_REVIEW=synthetic-m61`. The ordinary production build excludes this workflow.

## Acceptance evidence

Independent QA passed after five material findings were repaired, including canonical decision hashing, complete report-creator binding, accessible decision controls and hash visibility, and exact decision-to-audit verification on every read. The final review artifact is `evaluations/research-qa/milestone61-inventory-draft-report-review-10.json`, SHA-256 `922bb010ad76191c64b4329d08704900a79cb6124bc44e1332ef226d82e01dc5`.

Focused checks passed database 3 tests / 19 assertions, API 4 / 131 and web 21 / 112. Full checks passed database 29 / 263, API 625 / 5,451, web 70 / 283, all ten type-check tasks, lint with zero errors, builds, the ordinary-production exclusion scan and 12 bounded Python calculation checks. The broader historical `test:ghg` collector remains blocked by three pre-existing `expected.value: TBD` fixtures in `ghg-kb/wiki/methodologies/scope-1-mobile-combustion.md`; M61 did not change that specification, loader or harness.

The clean browser journey accepted report SHA-256 `f013b628b101a1eb8fec991f3e45f83bd0d061e9a3468ed10846d68d964f28df` and displayed distinct decision snapshot SHA-256 `69a6520e52bf816df00a852abc0643e822dc02ad3b137f5968a58463232df865`. The read-only member saw the same immutable decision, another tenant received `Workspace not found`, and signed-out access required authentication. The demonstrated values remain fixed fictional data and are not release evidence.

## Deferred work

A `changes_requested` decision does not edit the immutable M60 report. Report revision and resubmission require a later versioned-report milestone. Hosted persistence, production identity validation, source/factor/method release, and independent accounting, security and legal review remain separate gates.
