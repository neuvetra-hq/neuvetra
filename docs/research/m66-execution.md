# M66 — supporting bills linked to saved worksheet reports

The board authorized finishing this milestone before full-year electricity coverage (queued as M67). The initial annual interpretation was corrected before any annual migration or deployment. M66 uses the existing hosting and synthetic tenant; no new subscription or PR is needed.

## Implemented candidate

An authorized manager retains either approved fictional January 2023 PDF, downloads its exact bytes, manually confirms page 1 and an entered quantity, and saves a source-bound calculation. A discrepancy from the printed 12,345.000 kWh requires its own explanation. Corrections bind the full effective input, including source, labels and explanation; replacing a source creates a new version needing fresh review. A different manager can record bounded acceptance or a change request. Readable HTML snapshots retain the exact source and captured review state.

M63–M65 are preserved. New migration 0012 is additive, with tenant authorization, immutable source bytes and versions, idempotency, audit and report verification. Supported content is established by approved PDF byte identity; Bun may normalize multipart MIME metadata, so strict original wire-MIME rejection is not claimed. These are synthetic, incomplete, unreleased drafts, without assurance or automated document verification.

## Local verification

- Full repository typecheck, lint, unit tests and builds passed after old readiness-test expectations were updated from schema 11 to 12. Initial failures remain in the local check log.
- Independent QA: 17 native PostgreSQL tests / 295 assertions and 11 frontend/renderer tests / 258 assertions. The browser decoder initially rejected explanation-only corrections; its full-input predicate was repaired and independently retested.
- Accounting: both PDF fixtures inspected and approved; 22 rendered cases and explanation-only correction verified. Review qualifiers, integrity wording and confirmation-reset fixes are recorded in the accounting review.
- Actual local dump/restore preserved 48 table hashes and 1,488 test records; restricted reads reconstructed 43 versions, 12 PDFs and 39 reports. This is not provider Auth or off-device recovery proof.
- Actual Chrome print rendering: normal and long-text examples, five pages each, all ten pages inspected. No overlap or clipping; occasional label/value page splits remain readable. This is not a native print-dialog claim.

## Publication gates

Before activation, independent candidate review, exact remote head and CI/image checks must pass. The live schema-11 baseline captured the four M64 versions, two M65 reports and original M63 report/review without application writes. A fresh encrypted application-only backup was verified at 2026-09-14T23:39:46Z (398,709 archive bytes, SHA-256 `518f1921a1c166503676dc6237015aeefb8278601161174fc63e35b8735d2cfb`).

Hosted upgrade, source-to-report exercise, browser test, restart/readback and final handoff remain pending at this checkpoint. Old strict-schema images fail closed after the additive upgrade until the matching schema-12 image is active; no zero-downtime claim. Keep draft PR4 unmerged. Board demonstration and feedback precede dependent M67 implementation.

## Roles

CTO/backend: `/root/m64_cto`; independent accounting: `/root/m64_accounting`; independent QA: `/root/m63_data`; root: UI, operators, integration and deployment. Historical context names do not change the current bounded assignments. Requested critical compute is recorded separately from unknown observed settings and cost. These are task-scoped workers, not persistent agents.

## Hosted follow-through

Implementation63791ac4d6628651fc53c3de79f7db4791b48114 passed all six CI checks and deployed as56c457f9-2c27-4f68-bd62-3eec6d1687f7. Migration12 committed at2026-09-14T23:54:57.971Z. The37-stage hosted exercise and28-stage zero-write post-restart revisit passed, preserving M63–M65 and three M66versions/twoPDFs/threeHTMLreports. The browser uploaded/downloaded fixtureA, saved version3 with an explicit discrepancy, created/downloaded its report and opened its print view. Exact values and limitations are in m66-hosted-verification.json. Board milestone feedback remains the next gate.
