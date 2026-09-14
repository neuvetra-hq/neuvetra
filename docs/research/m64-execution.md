# M64 execution — guided synthetic worksheet

September 14, 2026. Board authorized M64 after accepting M63. The immutable planning artifact remains historical planning evidence; this record tracks execution. Same rolling draft PR4, no merge and no new hosting subscription.

## Implemented scope

The default staging view offers fictional company/facility labels and manual January 2023 CAMX kWh entry. A separate saved-example view retains M63. Server/database arithmetic uses the approved exact decimal policy, immutable versions, required correction reasons, two-manager review and exact audit bindings. Every version remains synthetic, incomplete, unreleased and without assurance. No new accounting coverage, customer data, uploads, billing or annual-report integration.

Accounting independently approved 18 expected values and input boundaries before implementation. Root authored the frontend and scoped operator tools. CTO authored database/API changes. Independent technical QA reused `/root/m63_data` after the runtime refused a new thread; this context authored earlier M63 infrastructure but no M64 code. Its M64 delta review is independent; inherited M63 infrastructure receives regression testing. Requested critical model routes are Astra/high. Actual runtime settings, token totals and cost remain unobserved; no savings claim is made.

## Findings and verification

- M64-ACC-F01: SQL division lost exact precision for valid fractional input; server verification refused the inconsistent record. Repaired using exact decimal multiplication and integer quotient arithmetic. Independent accounting retested persisted values and frontend decoding.
- M64-QA-F01: real PostgreSQL driver serialized a pre-serialized JSON value as a scalar. Repaired with an explicit text-to-JSONB SQL parameter contract. A dedicated PostgreSQL CI job now runs the native driver and full staged API regression, avoiding reliance on embedded database tests alone.
- QA corrected two operator exercise expectations before execution: include the required Origin header; self-review refuses with conflict409. These were test-helper defects, not live failures.
- Root `bun run check` passed typechecks, lint, unit tests and normal builds. Explicit staging build passed. New frontend decoder tests pass5/27, including property-order equivalence, corrupt payload refusals and session cancellation. Native PostgreSQL initialization/boundary suite passes9/124; full staged API including M64 passes1/57. Operator scripts typecheck.
- Independent QA has separately exercised native PostgreSQL, exact arithmetic, distinct tenant access, race/idempotency behavior and preservation of original records. See the independent QA record for the final evidence and artifact bindings.

## Controlled deployment sequence

Existing Railway Site-Web and Supabase project only. Current pre-M64 deployed head is `b395b1ec61b537f331101436dc5e6a4320822f21`, deployment `40cd23b6-6b15-453c-811b-7626773b5faa` observed SUCCESS. Apply only reviewed migration0010 after local independent acceptance and publication checks. M63 runtime requires exactly nine migrations; M64 requires ten. The additive upgrade intentionally creates a short readiness503 maintenance window until the M64 image is promoted. Do not weaken migration verification to conceal this transition. Rollback after migration requires a schema10-compatible image or a separately controlled restoration; an arbitrary M63 image is not compatible.

Fresh encrypted application backup verified at `20260914T203506Z`:317154bytes, SHA256 `560e8142f1ba711e9169e5b27acf3c9a822c179422896c40a358d8a4347db6c5`, external recovery path `C:/Users/nimab/Neuvetra/m63-runtime/recovery/m63-application-20260914T203506Z.dump.dpapi`. This proves decryption/hash integrity, not a new restore drill. Existing M63 restore evidence remains historical. Provider Auth and portable off-device recovery remain gaps.

Live migration, remote checks, hosted exercise, actual browser demonstration and final board feedback are pending in this execution snapshot. They must be recorded from observations before milestone completion. No customer release or professional assurance follows from this milestone.
