# HOSTED-SETUP-UPGRADE-QA-01 — independent Candidate1 review

2026-09-26. **FAIL: two reproduced preservation/access blind spots. Do not use this candidate as an accepted hosted-upgrade gate.**

Independent Head of QA `/root/hosted_recovery_qa`; no author contribution to runner, author tests or runbook. Requested gpt-6-astra/high; inherited observed model/effort, tokens and cost unknown. Read the role prompt, leading current board/continuation records, board rebuild brief, frozen runner/tests/runbook and migration helper. The three supplied hashes matched before execution and after review. Only this report and the independent synthetic test were written. No hosted connection, ENV, credential, actual hosted archive, provider operation, Git mutation, shared-ledger edit or author-code change occurred.

## Material findings

### UPGRADE-QA-F01 — P1: actual sequence state is absent from the preservation fingerprint

Locations: `tools/staging/hosted-setup-upgrade.ts:111,128-138,218,240-241,247-249`.

The sequence query records definition, ownership and ACL, but never reads `last_value` or `is_called`. Sequence relations are absent from the ordinary-table row capture. The later sequence comparison therefore cannot establish sequence-state preservation, and the schema-22 preflight fingerprint cannot detect sequence drift since the accepted restore.

Independent reproduction used the actual first 22 migration files in local PGlite PostgreSQL, then the actual migration 23. The existing `neuvetra.fugitive_audit_sequence_seq` initially returned `{value: "1", is_called: false}`. After `setval(...,999,true)`, direct SQL returned `{value: "999", is_called: true}`, but `fingerprintSha256(snapshotHostedSetupDatabase(...))` was unchanged. Applying the actual migration 23 and inserting its real receipt still passed `verifyPostcommitPreservation` against the pre-change schema-22 fingerprint. No fabricated fingerprint or mock snapshot was involved.

Impact: a stale or changed audit sequence can pass both source binding and postcommit checks while the runner reports legacy preservation. The schema already has sequences; this is not merely a future-schema concern.

Required repair: include each supported sequence's exact text `last_value` and boolean `is_called`, retain definition/owner/ACL checks, and require equality for old sequences. Keep sequence observations within the separately enforced quiet interval, since sequence state does not receive ordinary MVCC snapshot guarantees. Test both `last_value` and `is_called` changes and a pristine actual migration.

### UPGRADE-QA-F02 — P1: view security-option drift changes outsider access without changing the fingerprint

Locations: `tools/staging/hosted-setup-upgrade.ts:103,137,205-208`; runbook gates 1 and execution step 6.

The relation fingerprint includes view definition, owner and ACL, but omits `pg_class.reloptions`, including `security_invoker`. The runner explicitly permits views, so a view's access semantics can change while its captured definition and grants stay identical.

Independent reproduction on the actual migrated schema added one synthetic company, its member and a separate outsider. A granted view over `neuvetra.companies` with `security_invoker=true` returned **0** rows under `neuvetra_runtime` with the outsider subject. After `ALTER VIEW ... SET (security_invoker=false)`, the same query returned **1** row. Default snapshots before/after had identical fingerprint hashes. The test uses actual SQL role switching and RLS, not only catalog-object mutation.

Required repair: either reject unsupported view/inheritance/partition surfaces consistently with the accepted recovery v2 helper, or include all relevant view security options and independently test access preservation. Align the runbook and fingerprint-derivation contract with the chosen boundary. The accepted recovery v2 refuses views, so no assertion is made that the current real source contains this view or has this exposure; this is a demonstrated unsafe surface currently accepted and advertised by this runner.

## Checks actually executed

Workdir: `C:/Users/nimab/.codex/worktrees/inventory-plan-delivery/Neuvetra`. Bun 1.3.12. Tests used local PGlite embedded PostgreSQL and synthetic data. No native external PostgreSQL server or hosted target was used in this upgrade review.

- `bun test tools/staging/hosted-setup-upgrade.test.ts packages/neuvetra-database/src/company-setup.test.ts`: **13 pass, 0 fail, 84 expectations** (7 runner tests plus 6 company-setup tests). Covered existing author preservation mutations, actual geography constraint definitions, numeric JSON-text hashing, verifier refusal, mocked runner sequencing, preflight/commit-unknown/postcommit/durability outcomes, journal exclusivity, schema23 persistence, tenant and revocation behavior.
- `bun test evaluations/research-qa/hosted-setup-01-upgrade-independent.test.ts`: final frozen diagnostic test **1 pass, 0 fail, 7 expectations**. The passing test asserts that the two defects reproduce; it is not an acceptance pass. Output status is `independent-upgrade-findings-reproduced`. It confirms direct sequence-state drift, unchanged source fingerprint, actual migration23 accepted after sequence drift, and outsider view access changing from 0 to 1 with an unchanged fingerprint.
- The first independent run reproduced sequence/view fingerprint omissions; the test was extended to verify the actual view access change, then rerun successfully. PGlite instances were closed in `finally`. No production/provider state exists in these fixtures.

The two material findings mean the standard-suite pass is insufficient for acceptance. The separate schema23 application tests remain useful within their stated scope; this review does not invalidate them or establish a defect in migration23 itself.

## Boundary assessment and integration gates

Source inspection confirms that imports are inert, there is no live CLI, and restore/publication/write-gate verifiers plus a current-head observer are required dependencies with no permissive defaults. Artifact bytes are rehashed, fixed project/profile/schema22 and exact prefix receipts are checked, and verifier bindings include source/archive/state/derivation/review pins and separate operator/reviewer identifiers. These are interfaces, not evidence that any actual receipt or reviewer statement has been validated. Fingerprint derivation from accepted recovery v2 is still absent and must be independently implemented and checked. Its source/restored normalization and encoding semantics must match; merely assigning a digest from a note is insufficient.

Journal and failure classification are conservatively structured: exclusive synced reservation before snapshot, synced preflight, one migration call, postcommit observation, and no retry on the consumed journal. Once migration is entered, an exception yields commit-outcome-unknown; after return, verification or receipt durability failure yields postcommit reconciliation required. The author tests reproduced these paths. A second journal open is refused. Process termination, disk-full and network-loss faults were not physically injected. The external integration must preserve consumed journals and reconcile uncertain operations rather than select a fresh path to bypass them.

Concurrent writes and continuity are not enforced by an internal database maintenance lock spanning the two snapshots. The runner calls `verifyHeldWriteGate` three times and compares the returned bindings. The integration must implement an actual continuously held gate over every writer, job and relevant operator connection; three repeated historical receipt reads are not continuity proof. A before/after match cannot prove that a write and reversal did not occur between observations, and sequence behavior specifically exposes the present F01 gap. Keep the gate held through independent reconciliation and deployment decision.

Execution-time source pinning remains a required integration gate. The current-head callback provides a commit string; it does not itself prove clean/frozen working files. The runner reads a manifest at line 235, while default `migratePrivateStaging` rereads migration files later (`packages/neuvetra-database/src/staging-migrations.ts:38` and following). The concrete executor must bind the exact migration/source bytes to the accepted published head and prevent or refuse changed executable inputs **before** mutation. A postcommit mismatch cannot undo an unauthorized migration already executed. No dirty-source or concurrent-file-mutation test was performed here; do not treat the commit-string equality alone as sufficient integration acceptance.

Default snapshots preserve numeric/JSONB row text without JavaScript number parsing and retain duplicate row hashes and empty tables. They compare old catalog/rows and exactly eight new empty table names plus four exact geography constraint definitions. They are not a fresh end-to-end runtime tenant test. Newly added function bodies and table security still depend on the exact reviewed migration bytes and separate schema/API testing; do not claim an arbitrary modified post-state is fully validated by this comparator.

The runbook correctly separates migration observation from accepted migration, deployment, new synthetic admission and board demonstration. It prohibits blind table/receipt deletion or downgrade and treats archive restore as a separate reviewed decision that can discard post-backup data and excludes provider state. Those distinctions remain necessary after code repair. No automatic rollback, retry, deploy or provider action was exercised.

## Frozen evidence

| File | SHA-256 |
| --- | --- |
| tools/staging/hosted-setup-upgrade.ts | 71478031923b8e45f1ab34a1c9bb913db53c9636853b11b694092b41a675c827 |
| tools/staging/hosted-setup-upgrade.test.ts | d70132f8e3294c398054dd836fb36f148699aedab7aebee7d33564031708c287 |
| operations/hosted-setup/upgrade-runbook.md | daadc4646a6dffc0b1bbf040592036f58218a520f14a09b209ef8f1208c73d1a |
| evaluations/research-qa/hosted-setup-01-upgrade-independent.test.ts | a5bd64fcd603305d3b1733290da1adbea45306f363b1d4039c5e6239b4d7bd7d |

Return to root: preserve this first FAIL, route the two concrete fixes to the author, freeze a new candidate and obtain targeted independent re-review. Then separately implement/review the concrete accepted-restore derivation, publication/current-source pinning, exact endpoint and continuous writer-gate integration before any hosted use. Root owns status and publication.
