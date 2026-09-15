# M73 fresh 20:15 recovery and rollout-sequence review

Reviewer: `/root/m73_cpo`, reused as the independent security/reliability reviewer. Requested `gpt-6-astra` / `high`; actual model and effort are unknown. The reviewer authored M73 product criteria, but did not author the operator helpers, database migration or product implementation. The reviewer did not access hosted credentials, decrypt the archive, write hosted state, control Git or modify common records.

## Verdict

**PASS for the fresh schema15 recovery gate and the proposed controlled rollout sequence.** The 20:15 encrypted backup, isolated role-parity receipt, exact restore receipt, sealed archive, candidate3 operator snapshot, restored database state and restricted application-reader reconstruction form a consistent chain. No critical, high or medium recovery finding is open.

This verdict permits the exact reviewed schema15-to16 gate after the published commit passes all six required checks and the existing writer is placed in verified maintenance. It does not approve a different commit, migration, backup, restore, database baseline or operator bundle. After a confirmed schema16 commit, recovery is forward-only; the schema15 deployment must not return.

## Frozen evidence

| Artifact | SHA-256 | Observation |
| --- | --- | --- |
| `.superpowers/m73-backup-2015-receipt.json` | `408f025efae3d4cb1488c9c2548ba91294c374e65e25e655ec331d9c06d04dfb` | Schema15 backup created `2026-09-15T20:15:29.882Z`; 67 application tables and 176 rows. |
| `.tmp/m73-application-20260915-2015.dpapi` | `1c01d5f245fc09e24edfacdd37058966533a3e676f4cec05e4b066054f6bd245` | 1,185,046 encrypted bytes; exact archive hash in both backup and restore receipts. It was hashed without decryption. |
| Internal dump pinned by both receipts | `3ab86428aeebfc6f3e3cedc23975a7142ccff3818929789cde32823ce17b50de` | Backup/restore binding agrees. |
| `.superpowers/m73-bootstrap-2015-receipt.json` | `866e617f1b4886410bc4b40dd3973738e343d9260c20b5fa29ad43d27adaf286` | Existing isolated port55472 roles and memberships matched; `clusterMutated: false`; source receipt hash is exact. |
| `.superpowers/m73-restore-2015-receipt.json` | `8650a0c2bdb7a55b997426887f70c8d6ab088f05d8ae58a94dd12df4df46505d` | Exact archive restored to new `m73_qa_recovery_20260915_2015`, schema15 on port55472. |
| `operations/agent-improvement/snapshots/M73-OPERATORS-CANDIDATE3.json` | `6d9cc8f34b0299a6dfaca64aaafe8d33864057b35614f0bd41ff90ca5914d006` | All 11 listed filesystem hashes matched, including candidate3 migration `aa4968c63087f353b5bf80d64bced67270bc5ad17f715393b40313bb57f7f732`. |
| `evaluations/research-qa/m73-recovery-2015-runtime.test.ts` | `1b2591fa2059ab2f508aa84c66e2f80083422f9f287f7cdaa3363c13757c11b2` | Independent read-only receipt, catalog, role, archive and application-reader checks. |
| `evaluations/research-qa/m73-recovery-2015-result.json` | `83b0a84176855d5488f64d07c20990e122e9fbc5dc9b736d0f626435c9e2aa1f` | Canonical immutable reconstruction result. |

The receipt checks bind the bootstrap and restore to the exact fresh backup, confirm matching encrypted archive and internal dump hashes, and establish that the backup was under four hours old at review execution. Backup and restore preserve every application row, catalog fingerprint, role and membership. The restored application inventory has no default ACLs; this is the reviewed design because provider/global defaults are excluded from the application clone. The restore receipt separately preserves the complete source default-ACL list, and the helper reports application default ACLs exact. The first test run deliberately compared provider defaults as if they belonged in the clone and failed only on this documented exclusion; the corrected final test checks the intended boundary explicitly.

Independent catalog queries confirmed 67 of 67 application tables have enabled and forced RLS, the runtime role is non-superuser, non-bypass and non-inheriting, and it has no application-table DML privileges. The inventory before and after restricted reader execution remained exactly equal.

## Application reconstruction

The final run passed **1 test and 80 assertions** against the isolated schema15 database. It reconstructed:

| Surface | Preserved result |
| --- | ---: |
| M64 manual electricity | 4 versions |
| M65 manual reports | 2 reports |
| M66 evidence-bound electricity | 3 versions, 2 retained sources and 3 reports |
| M67 annual electricity | 4 versions and 3 reports |
| M68 annual evidence | 4 versions and 4 reports |
| M71 corporate coverage | 2 versions; head SHA-256 `38267951d79e0af02abcc9575df56f9c71f0520d324543513aa2b93047a69497` |

All **14 downloads totaling 133,998 bytes** matched their stored hashes; report lengths also matched their records. The clone remains schema15 with no stationary-gas tables. This proves the saved M64–M71 application records and downloads can be reconstructed through the runtime reader before migration.

## Rollout sequence disposition

The proposed sequence is sound with these evidence gates:

1. Keep automatic deployment paused. The coordinator reports the actual status as false; this reviewer did not inspect the host.
2. Publish the reviewed candidate on the same rolling PR, identify the exact remote commit, and require all six CI checks to pass for that commit. Any code or migration change requires new pins and affected review.
3. Enter maintenance through the existing reviewed writer mechanism. Verify the old deployment is unavailable and its writer is stopped before database mutation.
4. Bind the fresh backup/restore receipt bytes and hashes, exact candidate3 migration, exact reviewed commit and maintenance observation into the operator gate. Under the database lock, require the live schema15 rows, catalog, roles and memberships to equal this backup. Any intervening change must refuse the apply and requires a new recovery chain.
5. Apply only migration0016 in its reviewed transaction and preserve the started/committed receipt. A proven rollback may return to the exact schema15 deployment. An unknown outcome requires read-only inspection before any retry.
6. After a confirmed schema16 commit, deploy only the exact tested schema16-compatible commit. If deployment fails, repair forward; do not downgrade, remove tables or rewrite the migration receipt.
7. Run the hosted exercise, restart, then zero-write revisit. Require exact old outputs, new M73 outputs, closed Auth sessions and the reviewed journal behavior before declaring the hosted rollout demonstrated.

## Limits

DPAPI CurrentUser remains tied to this Windows identity and profile, so this is not off-device disaster recovery. The application archive excludes actual Auth accounts, passwords, sessions, provider configuration and storage objects. The review proves the recorded application backup/restore and reader behavior on the isolated clone. It does not prove provider recovery, hosted schema16 execution, deployment success, production readiness, complete Scope 1, factor release, legal compliance or assurance.
