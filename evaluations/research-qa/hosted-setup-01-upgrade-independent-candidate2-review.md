# HOSTED-SETUP-UPGRADE-QA-02 — Candidate2 independent re-review

2026-09-26. **PASS for the bounded local upgrade-runner candidate. UPGRADE-QA-F01 and F02 are resolved. Concrete hosted recovery, immutable-source, publication and writer-gate integration remain open; no hosted execution or deployment is accepted by this review.**

Reviewer: `/root/hosted_recovery_qa`, independently dispatched Head of QA; no authorship of runner, author tests or runbook. Requested critical qa-lead gpt-6-astra/high; inherited observed model/effort and resource usage unknown. Read Candidate2 handoff, freeze manifest, complete changed runner/test/runbook, and preserved Candidate1 findings. All four frozen Candidate2 entries matched before execution and at completion. Candidate1's FAIL and diagnostic test are unchanged. QA wrote only this new report and its new independent synthetic test.

## Repair dispositions

**UPGRADE-QA-F01: resolved.** `tools/staging/hosted-setup-upgrade.ts:150-156` now records each supported sequence definition together with text `last_value` and boolean `is_called`, validating the catalog-derived name before querying. Line 235 compares the full old sequence record. Independent actual-schema checks repeated the original mutation of `fugitive_audit_sequence_seq` from `1/false` to `999/true`: the source fingerprint now changes. Resetting it restores the original fingerprint. Changing only `is_called` at the same value also changes the fingerprint. Actual migration23 with the original state passes preservation; independently changing only the postcommit value or only its called flag raises `Legacy sequences changed`. Sequences still require the continuously quiet writer interval; they are not ordinary MVCC row state.

**UPGRADE-QA-F02: resolved by refusing unsupported relations.** Lines 132-136 reject views, materialized/foreign/partitioned/inherited relations before row capture. The new boundary matches accepted recovery v2 and the revised runbook; it does not claim view support. The independent actual-schema regression creates the original `security_invoker=true` view and confirms zero outsider rows, changes it to false and confirms one outsider row, and now receives `Unsupported view, partition, inheritance or foreign relation` from the snapshot in **both** states. The exposure is exercised to establish that the regression remains meaningful; neither state receives a preservation fingerprint. No hosted view or hosted exposure was observed or claimed.

**Immutable-source execution is now a required, explicit integration dependency.** Publication validation requires manifest/source-closure digests at line 188. Lines 252-253 bind the complete normalized manifest, including SQL, to the publication verifier's digest before journaling or snapshot work. Lines 262-264 require `withImmutableMigrationSource` with no default and pass the reviewed head, manifest digest and source-closure digest. A guard prevents the supplied operation from invoking the migration more than once. The wrapper must be concretely implemented and independently reviewed; these changes do not establish that source bytes are actually immutable.

Independent synthetic adapter tests observed:

- Missing wrapper: migration count zero; terminal journal status `hosted_setup_upgrade_refused_no_retry_on_this_journal`.
- Wrapper refusal before operation: migration count zero and the same pre-migration refusal.
- Wrapper invokes its callback twice: migration count remains one; outcome is conservatively `hosted_setup_commit_outcome_unknown_do_not_retry`.
- Wrong published manifest digest: refused before journaling, snapshot or migration.
- Missing source-closure digest: refused before journaling, snapshot or migration.
- Valid synthetic wrapper: receives exactly the expected head/manifest/source pins, calls migration once, and produces the expected observed-schema23 receipt.

These adapter values and journal objects are explicit test fixtures, not concrete accepted hosted evidence. No new blocking issue was observed within this bounded re-review.

## Executed evidence

Workdir: `C:/Users/nimab/.codex/worktrees/inventory-plan-delivery/Neuvetra`. Bun 1.3.12; local PGlite PostgreSQL with synthetic data. No external native server, hosted target, ENV, credentials, actual archive, provider operation, Git mutation, shared-ledger edit or author-file edit was used.

| Command | Observed result |
| --- | --- |
| `bun test tools/staging/hosted-setup-upgrade.test.ts packages/neuvetra-database/src/company-setup.test.ts` | 13 pass, 0 fail, 96 expectations; seven runner and six schema23 tests |
| `bun test evaluations/research-qa/hosted-setup-01-upgrade-independent-candidate2.test.ts` | 1 pass, 0 fail, 34 expectations; independent original sequence/view regressions, actual migration baseline and source-gate bypass checks |

Author suite rerun additionally covers exact geography deltas, lossless numeric JSON text, row/catalog mutations, verifier refusals, single-migration ordering, three write-gate checks, commit-unknown/postcommit classifications, journal-write failure, exclusive journal reuse refusal and hash-chain ordering. The existing schema23 tests cover tenant/revocation behavior and immutable histories. PGlite instances were closed in `finally`.

The new independent test adapts the preserved original real-schema fixture and reverses only the expected outcomes of the repaired cases, then adds independent source-gate checks. The unchanged old test intentionally asserts Candidate1's defects and would stop at its old equality assertion under the repaired code; it was not relabeled or edited. Its original failure report remains authoritative historical evidence.

## Frozen versions

Candidate2 manifest SHA-256: `287e6cd3a0b5c0cbac819fd07318c1c9390db8196191d227e330666335283075`.

| File | SHA-256 |
| --- | --- |
| tools/staging/hosted-setup-upgrade.ts | 2eb3445b725a7c6547486ccac8ed1e6e1b52730b26ebe13fa99dcf1d5a6e9e2c |
| tools/staging/hosted-setup-upgrade.test.ts | c4073fcb2d5e08e1c08ed14a4736fc492ea7bc55cc5ddf4ef738a201ec0940da |
| operations/hosted-setup/upgrade-runbook.md | 1ec86c3cb387142b2c4c6a9a236eb6e8b98ec570622a721a273d8c0ff11da17c |
| evaluations/research-qa/hosted-setup-01-upgrade-author-candidate2.md | 29284e0220ce4cdbd7ad8cc37933822ebaa4e719d9a350b2a6bbd6f2481e4109 |
| evaluations/research-qa/hosted-setup-01-upgrade-independent-candidate2.test.ts | 241815b0e7aec551e5ad553c0387138b1b6429f84ac305f2d77cf30aa5f1398c |
| evaluations/research-qa/hosted-setup-01-upgrade-independent-review.md (preserved FAIL) | 96fa8db8f867867189c1560533b77685331726b9c8a142b11426edb84e875a3d |
| evaluations/research-qa/hosted-setup-01-upgrade-independent.test.ts (preserved diagnostic) | a5bd64fcd603305d3b1733290da1adbea45306f363b1d4039c5e6239b4d7bd7d |

## Remaining gates and limitations

Root must separately implement and independently review the recovery-v2 receipt verifier and source/restored fingerprint derivation; concrete exact-head publication/current-source observation; the immutable executable-source wrapper; exact hosted endpoint/transport; durable private journal placement; and a continuously held gate over all writers, jobs and relevant operator connections. The source wrapper must bind the actual published normalized migration bytes and complete executable dependency closure and prevent or refuse changing bytes while `migratePrivateStaging` rereads and executes them. Its declared hash is not implementation evidence. No dirty-source/racing-file mutation against a concrete wrapper was possible in this candidate.

Three matching write-gate observations do not by themselves establish continuous quiescence. Snapshot consistency and sequence state must be assessed under the actual gate. A fresh paired hosted backup and actual absent-target local restoration must receive independent review; an old unpaired or v1 artifact cannot be upgraded by renaming its receipt. Preserve unknown and consumed attempts. Physically injected process termination, disk-full and network-loss tests were not run, and no actual unknown hosted commit was reconciled.

The comparator validates supported old rows/catalog and the bounded additive shape. Exact reviewed migration bytes plus separate schema/API tests remain necessary for new function bodies and new-table access behavior. This review does not substitute for full API/storage/export/job isolation, live synthetic sign-in, two-company walkthrough or board feedback. Provider Auth accounts, sessions, passwords and object storage remain outside application-schema recovery. No blind downgrade, automatic archive restore or replay is authorized. Keep deployment and synthetic admission behind independent actual migration-receipt acceptance.

Return to root for acceptance of these exact local candidate bytes and the separate integration workstream. Preserve Candidate1's failed first review and the author repair history.
