# M73 integration observations

Coordinator working record, 2026-09-15. This is an implementation record, not release acceptance. The current scope is the synthetic stationary-natural-gas workflow in the M73 product, accounting and technical contracts. M72 remains the hosted baseline until separately verified deployment.

## Implemented interface

- Corporate coverage can append a stationary gas source and missing/candidate screening to a selected full-year California facility through the existing saved correction path. Boundary rationale and its fictional reference remain explicit preparer actions.
- The new stationary-natural-gas view supports separate source streams, entered versus stated amounts, missing activity, compatible explicit zero, discrepancy explanations, corrections, separate review, exact statement/calculation downloads and retained HTML reports.
- An unsaved edit hides the saved calculated subtotal. Common quantity/evidence mistakes have field-linked explanations. The server remains authoritative for source eligibility, calculation and admission.
- The browser decoder validates canonical activity, pinned coverage, cumulative contributors, immutable lineage, known factor/method pins, hashes and regenerated statement/report contents. It does no emissions arithmetic. Report viewing uses a script-disabled modal frame; session/component cleanup removes it. Print invokes the frame's actual print action.

## Checks observed so far

- Site-web typecheck and lint passed after resolving compatibility and lint findings in new interface code.
- Staging production build passed. Existing bundle-size advisory remains; no build failure.
- Combined staging boundary and M73 frontend suite: 11 tests, 84 assertions passed. The seven pre-existing staging tests cover configuration, Auth/current membership, origin/body/path limits, readiness and static-file confinement. The four new frontend tests run the actual Python engine, check representative/max quantities and opposite rounding ties, reject self-consistent tampering of method/statement/report contents, and refuse aborted/private error responses.
- Initial test fixture failed because an appended synthetic M71 source was not canonicalized before hashing. The fixture now uses the production snapshot normalization before deriving hashes; the normal decoder remained strict.
- A new isolated native browser database `m73_ui_20260915` was restored from a read-only dump of local `m71_author_release`. At creation it retained the canonical 15-migration baseline and fictional local Auth roster. The source database was not changed. This is not a hosted backup or hosted verification.

## Pending gates

Actual native M73 persistence and concurrency evidence; integrated independent accounting/security/QA; browser source creation, save/correction/review, original-byte downloads and print/narrow/keyboard checks; independent fresh recovery; final source/asset/migration pins; exact rolling PR head and checks; and any existing-host schema/deployment/revisit proof. No completed corporate inventory, released factor/method, filing conclusion or assurance is claimed.

The operator suite is a separate bounded author assignment, with independent operator review required. A fresh source archive and restore receipt must precede any schema-16 hosted change. Historical M42/M71/M72 evidence and accepted snapshots remain unchanged.

## Current checkpoint, 2026-09-15

The preceding pending list is historical. Candidate3 now has fresh backend3tests/85assertions and operator6tests/51assertions. Candidate2 independently passed accounting447checks plus reviewer-authored5tests/46assertions, security native41/authority6/pure45 assertions, and actual recovery reconstruction49assertions. Candidate3 changes only report CSS wrapping in TS/SQL; its uniquely pinned native output is `.tmp/m73-native-fixture-m73_author_13.json`. Independent targeted accounting acceptance passed62 checks in the separately frozen candidate3 appendix. The hosted helper's independent13tests/180assertions closed HJ-F01 by validating successful records before journaling and retaining only hashes/lengths for refusal text.

Actual candidate2 browser save, separate review, correction/discrepancy refusal, exact original HTML downloads, source evidence download, keyboard history,390px worksheet and actual restart/readback passed. V-F01 narrow-report horizontal overflow was subsequently found and repaired in candidate3. Actual fresh candidate3 browser report creation and390px report/identifier wrapping passed independent visual artifact review. Candidate2 failure screenshots and all older local databases are retained. See `evaluations/research-qa/m73-browser-verification.md`, `m73-browser-candidate3-followup.md` and `m73-visual-review.md`.

Actual hosted baseline at schema15 passed with zero application POSTs and all created Auth sessions closed. The final journal **file** SHA is `22e92d0bac2d73acd585983872895e95173f2c2a33845d1cf3579ade1cc04bd8`; its terminal event SHA is `3c5909e39274511dd9bb765903a8cecc856c50fd81deedf4f810518bd11060a4`. These are distinct hashes. Fresh encrypted backup and isolated55472 restore preserve67tables/176rows; independent reconstruction reproduced14downloads/133998bytes. DPAPI initially failed under the restricted execution identity before creating a database; same Windows identity execution succeeded. This is same-machine application recovery, with provider/Auth and off-device recovery excluded.

The latest staging build passed with694.17kB JavaScript and the existing bundle-size advisory. Site-web typecheck/lint and15targeted frontend/staging/operator tests110assertions also passed. Docker is unavailable locally; the clean remote image/native gates remain required after publication. The role-record validator passed before final closure records are added and must be rerun for the final checkpoint.

Remaining blocker: the actual Print report action opened its frame and paused controls in that tab, but native preview appearance/pagination is not observable. The board was asked whether it appeared and to close it; no answer or waiver is inferred. Other browser work continued in a separate tab. The independent visual reviewer explicitly keeps the print criterion pending. No M73 hosted migration, maintenance, push, deployment or complete milestone claim has occurred. Finish the print gate, then perform the already-authorized controlled rollout with fresh evidence, exact16-compatible forward recovery and the same rolling PR5. Recheck backup age under four hours and locked baseline equality; a later session must create new backup/restore paths if the current copy is stale.
