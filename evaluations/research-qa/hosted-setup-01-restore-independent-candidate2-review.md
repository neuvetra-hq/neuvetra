# HOSTED-SETUP-RECOVERY-QA-02 — Candidate2 independent re-review

2026-09-26. **PASS for the bounded synthetic/local recovery helper, including resolution of RECOVERY-QA-F01 and F02. This does not authorize or prove a hosted backup, provider recovery, migration or deployment.**

Reviewer: `/root/hosted_recovery_qa`, independently dispatched Head of QA. No implementation authorship. Requested gpt-6-astra/high; inherited observed model/effort and resource usage unknown. Candidate1's FAIL and regression harness remain unchanged, with hashes verified below. The author’s Candidate2 handoff and frozen manifest were read; all eight manifest pins matched before testing and after review. Only the core helper changed among the four implementation files. QA edited only this new report and its new synthetic native probe.

## Findings resolved

**RECOVERY-QA-F01 — resolved for the supported stored numeric/JSONB representation.** In `tools/staging/hosted-setup-restore-core.ts:38-43`, recovery row digests are now derived from PostgreSQL `to_jsonb(t)::text` received as text. Lines 57-65 use the same lossless text for tenant-row hashes and separately extract company identifiers in SQL. Legacy inventory’s decoded content digests are replaced; shared historical inventory bytes remain unchanged. Independent native changes to numeric and JSONB integers from `9007199254740992` to `9007199254740993` now raise `HS_RECOVERY_PRESERVATION_MISMATCH`, and their tenant digests change. Exact text queries verified the integer mutations. Independent adjacent decimal changes from `0.123456789012345678901234567891` to `0.123456789012345678901234567892`, both in a numeric column and nested JSONB, also raise that exact refusal. Restoring original integer values restores a passing comparison. Author-native duplicate-row removal is also refused, preserving multiplicity; empty-table coverage remains exercised.

**RECOVERY-QA-F02 — resolved by explicit refusal, not view support.** `tools/staging/hosted-setup-restore-core.ts:29-33` inspects relation kinds and inheritance before calling the legacy inventory or querying application rows. Independent creation of the same granted owner-security view demonstrably returned one row to the outsider; both its original and altered definition now raise `HS_RECOVERY_UNSUPPORTED_RELATION_SURFACE`. A source-side view was independently rejected before the supplied dump callback ran. The author-native rerun additionally created and refused materialized, partitioned, inherited and foreign relations; the foreign wrapper has no handler or external connection. Source inspection corroborates the explicit unsupported-kind/inheritance gate. Even safe views are unsupported by this candidate.

**Old guarantees do not inherit the repair.** Profile is `neuvetra.hosted-setup.recovery.v2`; the state encoding is `postgres-jsonb-text.v1`. Independent probes unsealed only their own synthetic archive, produced an internally hash-consistent v1 snapshot/receipt, and observed `HS_RECOVERY_BOUNDARY_REFUSED`. A v1 receipt was rejected with `HS_RECOVERY_PAIRED_SOURCE_SNAPSHOT_REQUIRED` before attempting to read a deliberately nonexistent archive. A v2 bundle with correctly recomputed hashes but missing row encoding was rejected with `HS_RECOVERY_ROW_ENCODING_REFUSED`. Relevant lines: core 6, 96, 102-107 and unchanged restore entrypoint 11-15.

No new blocking finding was observed within this re-review scope.

## Execution evidence

Workdir: `C:/Users/nimab/.codex/worktrees/inventory-plan-delivery/Neuvetra`. Bun 1.3.12; independent server query returned PostgreSQL **17.11**. Execution used narrowly scoped local-synthetic escalation; no hosted or provider access.

| Executed command | Observed result |
| --- | --- |
| `bun test evaluations/research-qa/hosted-setup-01-restore-author-candidate2.test.ts` | 4 pass, 0 fail, 13 expectations |
| `bun evaluations/research-qa/hosted-setup-01-restore-author-candidate2-native.ts` | 29 named checks passed; actual exported-snapshot custom dump, CurrentUser DPAPI, absent-target restore, exact-row/catalog checks, precise numeric/JSONB and duplicate regressions, unsupported surfaces, pins, role drift, occupied target and replay |
| `bun evaluations/research-qa/hosted-setup-01-restore-independent-candidate2-native.ts` | Final frozen probe passed all 11 named checks below; fresh temporary cluster; actual paired dump/DPAPI/restore |

Independent final output: `status: independent-candidate2-pass`, `server: 17.11`, `hostedAccess: false`, `providerAccess: false`. Check names: `pristine-paired-dump-dpapi-actual-restore`, `numeric-integer`, `jsonb-integer`, `amount-fraction`, `payload-fraction`, `granted-view-leak-refused`, `changed-view-refused`, `source-view-before-dump`, `internally-pinned-v1-bundle`, `v1-receipt-before-nonexistent-archive-read`, `correctly-hashed-unversioned-state`.

The new independent harness adapts the preserved Candidate1 fixture: it first restores a supported source, then introduces the original adversarial mutations and requires exact error codes. The unchanged Candidate1 harness cannot proceed beyond its deliberately preexisting view under Candidate2; the new artifact preserves the original evidence rather than modifying it. A first new-harness run passed; its additional decimal probes were then strengthened to adjacent 30-place decimals and the complete final run passed again. Each native run stopped its own cluster in `finally`; synthetic temporary files are retained without deletion.

## Frozen versions

Candidate2 manifest SHA-256: `19b103a0c2595c1196c47ff924674f498a3a80cb1f68a0296ed883ed57b84aab`.

| File | SHA-256 |
| --- | --- |
| tools/staging/hosted-setup-restore-core.ts | 5fd5eff04e81d3179f2d39bfe6900b239c96b9f46613da83a70fdbaea5b0041b |
| tools/staging/hosted-setup-restore-io.ts | 6eb5f90da057e302bbc8ad91c81933e748ce8705b699bed53838aba5d451da71 |
| tools/staging/hosted-setup-restore.ts | abf30e15c57b865e43563c8ad4c0a8f6bc79167804493f3fe8338997ed3271f0 |
| tools/staging/hosted-setup-backup.ts | 24fdd727af8caa4ae0ccbe33b5a5d13e36322178becc0357f2cb50fcab5c219c |
| evaluations/research-qa/hosted-setup-01-restore-author-candidate2.test.ts | a820de079bcfd2b1033d435d4402bd6ccc175f91cf92d73d07bb9ac99bc2b072 |
| evaluations/research-qa/hosted-setup-01-restore-author-candidate2-native.ts | c69a57e1051448430038ecd2350d52b0d58dcc4563b29e7a192bcdc915cb9ff3 |
| evaluations/research-qa/hosted-setup-01-restore-author-candidate2.md | e25e1684dc3fa8a48dac62e6724fcf46e046e95774610b7e6317e68bea5f4e9c |
| tools/staging/m78-inventory.ts | ea93686812910082438bf8ecfd9ef8756dddd6048897d369a494e0fdd700f40a |
| evaluations/research-qa/hosted-setup-01-restore-independent-candidate2-native.ts | 96ab007308bc924459b348e3e6e6c481c09810701c7fa0ec8c72a7c48c622088 |
| evaluations/research-qa/hosted-setup-01-restore-independent-review.md (preserved Candidate1 FAIL) | baa496270a74ac24a9f1941114a0c66de53557bd7705cc55250db062d2acafe1 |
| evaluations/research-qa/hosted-setup-01-restore-independent-native.ts (preserved Candidate1 probe) | ec52026d2180420c1c19c7d7833d94f50fb5ec26bd0dbaa32276fc98f57c1dc2 |

## Limits and next owner

The unchanged operational boundaries in Candidate1's review continue to apply. This is a supported application-schema synthetic rehearsal, not a universal PostgreSQL backup validator. Original lexical JSON already normalized by PostgreSQL JSONB ingestion is not recovered by row hashing. Unsupported relation surfaces must be refused, not waived. The representation, PostgreSQL environment and actual supported schema must match the reviewed operational target.

Root must separately review the exact hosted SQL/pg_dump transport, same endpoint, verified TLS CA/hostname, pinned executable and source dependency bytes, unchanged snapshot token and application-only flags, approved private paths, sanitized errors, fresh source/stage evidence, quiet interval and durable no-replay reservation. Prepare and review the local roles/memberships plan separately. The retained old unpaired archive cannot acquire a v2 preservation guarantee. A fresh paired hosted archive must undergo actual absent-target local restoration and independent source comparison before a separately reviewed schema-23 upgrade.

CurrentUser DPAPI, source/Auth dependencies, local target checks and replay/occupied-target controls were unchanged and exercised through actual local backup/restore and author-native negative cases. Provider accounts, sessions, passwords, object storage and configuration remain excluded. The helper's timestamp is not a freshness policy; a consistent MVCC snapshot is not proof of current-world quiescence. Process-kill/disk-full/ambiguous-operation fault injection was not performed; started or uncertain attempts remain consumed pending reconciliation. Full API/storage/export/job isolation, hosted two-company sign-in and the board demonstration remain separate. The previously rejected hosted wrapper was not attempted or bypassed. No credentials, ENV, actual hosted archive, provider, Git or shared operations ledger were touched.

Return to root for acceptance of these exact reviewed bytes and the separate transport/local-role assignment. Candidate1's failed first review remains part of the evidence chain.
