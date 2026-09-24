# M72 independent hosted product QA

Date: 2026-09-15. Reviewer: `/root/m72_qa`, QA lead. Requested model/effort gpt-6-astra/high; observed settings unknown. This reviewer did not author the M71 product or migration and performed no hosted request or credential operation. Root executes hosted actions; this review independently inspects their retained evidence. This reviewer authored the M72 journey helper and author tests; separate `/root/m72_security` independently reviewed that helper and contributed failure tests. This is internal product QA, not accredited external assurance.

## Reviewed boundary

Existing private application at `https://www.neuvetra.ai`, existing Supabase project `icockcoguyadhryzydvl`, approved fictional roster/workspace only. Product source `ecfedcbfb27b18a1ebebfd960314d68299cb4a28`; canonical 0015 migration SHA-256 `2766561decde3ea64bf56f30b1b67a9144318e14b6efecaa71e05e8ae6351d19`. Actual successful Railway deployment `da0a050a-7ce0-42b3-acfc-900c8416b56b` records branch `codex/corporate-mvp`, that exact commit and image digest `sha256:7e8d7e0549ba1ed66f7414f1f227c01bba77a51a43e0120fba8a58ea3aa44799`. Evidence: [deployment observation](m72-railway-deployments.json).

The [acceptance contract](m72-qa-acceptance.md) governs this review. The published/local M71 browser evidence does not substitute for fresh hosted visual acceptance. No full corporate MVP, corporate emissions total, legal conclusion, released method or assurance result is implied.

## Evidence independently assessed

### Preservation and recovery — passed within application scope

The baseline journey passed 49 stages with zero application POSTs and all four acquired Auth sessions closed. It captures current M63–M68 response hashes, downloads and reviews rather than assuming historical version counts. The helper remains the separately reviewed bytes: SHA-256 `43c0f854025acda23453f4f6e28953ebfa2d8673ef5ae0cf4c59e7f941c054c5`.

Independently compared actual [migration receipt](m72-migration-receipt.json) before/after data, not just boolean success labels. Every one of the 165 original row hashes is preserved with multiplicity across 62 original tables. Five new corporate tables were empty immediately after migration; roles, memberships, default ACLs and external dependencies are identical before/after. Migration receipt records committed schema 15 at `2026-09-15T13:46:59.802Z`, the canonical SQL hash and exact reviewed commit.

Compared the independent [hosted-archive restore](m72-security-hosted-restore.json) with the migration's before state: application table rows/catalog, all 16 role records, all 22 memberships and dependencies match. Provider-schema default ACLs differ because those schemas were expressly outside the application restore; the [security review](m72-security-review.md) discloses that boundary. The [separate restricted-runtime reconstruction](m72-security-restored-read.json) passed 9 M64–M68 response checks and 14 retained source/report downloads against the pre-rollout hosted baseline. Its independently executed no-claim denial and admitted-actor read support application recovery. Provider credentials, Auth sessions and full Supabase recovery were not restored, and off-device DPAPI recovery was not demonstrated.

### Hosted API journey — passed

Actual exercise receipt passes 108 recorded stages. Twelve application POST attempts include refused actions and idempotent retries; they are not twelve new saved records. All four acquired Auth sessions closed. Independently decoded the retained register through the real frontend decoder and recomputed canonical export hashes and UTF-8 lengths for both versions. All 17 legacy response hashes and 16 earlier downloads equal the fresh baseline. The journey also checks those legacy records after its attempted writes.

- Version 1 SHA-256 `4cc1decfaaf7e1734697dc39b762003461ab2db2f91c12d8773adb3174391387`: original fictional company label, unreviewed, exact retained export unchanged after correction/review.
- Version 2 SHA-256 `38267951d79e0af02abcc9575df56f9c71f0520d324543513aa2b93047a69497`: appended hosted label correction, accepted for bounded internal use by an actor absent from contributor history.
- Both versions retain all 15 Scope 3 categories and 86 findings, `emissionsTotals: null`, `assurance: none`, incomplete corporate coverage and no release eligibility. The finding count documents the observed seed; it does not measure assurance quality.
- Save, correction and review exact retries passed. Changed retry and contributor review returned 409; member save/review returned 403; outsider read/write/export returned 403; signed-out read/write/export returned 401. Member read and exact exports passed.

Independently compared the [post-exercise inventory](m72-hosted-after.json) to the before-migration observation. The before-migration observation's table, catalog, access and dependency fields equal the [backup inventory](m72-backup-receipt.json). All 165 original row hashes/multiplicity remain after the exercise. The only addition to an old table is migration receipt 15; new corporate tables contain one head, two versions, one review, three request rows and three audit rows. Total is 176 rows across 67 application tables. Roles, memberships, default ACLs and dependencies remain unchanged. This verifies durable row preservation after the actual mutations in addition to API-level hashes.

### Restart and exact readback — passed

Root operated an actual `deploymentRestart` of deployment `da0a050a-7ce0-42b3-acfc-900c8416b56b`, which returned true; the retained [provider observation](m72-railway-restart.json) shows the same successful deployment/commit/digest. Subsequent readiness and read-only revisit passed 57 stages at `2026-09-15T13:58:59.715Z`, with zero application POSTs and all four acquired sessions closed. This reviewer independently decoded the revisit register and compared its entire canonical history/reviews and export hashes to exercise, and every legacy response/download hash to the baseline; all match.

Final reviewed [journey receipt](m72-hosted-journey.json) SHA-256: `091ec754a83735f82b91e8eec9fd23a1eb5d476c7493d1f9510bc139e8a8f2ea`. It retains baseline 49 stages, exercise 108 stages and restart revisit 57 stages. A later deployment or write requires a new observation; this verdict binds the recorded state above.

### Fresh hosted browser demonstration — blocked

Fresh browser verification is blocked by the Chrome extension's open UI pausing automation. Root observed an existing signed-in old M68 view, but reload was blocked. There is no fresh hosted M71 screenshot, empty/saved-register visual verification, actual browser download, keyboard/narrow-layout result or post-restart browser observation. Do not relabel API decoder tests or prior local browser passes as those missing checks.

## Findings and final scoped verdict

Initial harness F02 is preserved: three independently injected sign-in timeout/malformed/oversized-token cases failed by falsely claiming session closure. The repaired unknown-session accounting passes those three cases; author and independent helper checks total 10 passed /47 assertions, and targeted TypeScript passed. Unreadable or differently bound receipts are also preserved rather than overwritten. No product defect has been established by these harness findings.

**PASS for bounded hosted migration preservation, application recovery, authenticated API behavior and exact persistence after restart. INSUFFICIENT EVIDENCE for full hosted visual acceptance.** Fresh hosted browser demonstration remains blocked as described above. This is an outstanding product acceptance item, not an observed product failure. Root may report the completed deployment/API/recovery outcomes while explicitly retaining that demonstration gate. Publication and final remote-head checks remain coordinator-owned; a documentation-triggered redeployment must be freshly observed and revisited before extending this verdict to it.
