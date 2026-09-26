# HOSTED-SETUP-FINGERPRINT-REPAIR-01 — Candidate 2 author handoff

2026-09-26. **Candidate 2 is frozen for independent QA of the bounded local derivation repair only. Candidate 1 remains independently rejected by `FINGERPRINT-QA-F01 [P1]`. This candidate does not establish current hosted state and does not authorize migration.**

Author: `/root/hosted_upgrade`, software-engineering role under CTO. Requested compute was gpt-5.6-sol/high; observed model, effort, token use and cost were not exposed. Work used only the rolling PR6 worktree and fresh synthetic PostgreSQL 17 fixtures on dynamically selected loopback ports excluding 55479. No hosted source, provider, actual archive, retained actual clone, secret, ENV export, Git, deployment, migration, shared status or board file was read or mutated.

## Candidate 1 finding preserved

The frozen independent review `evaluations/research-qa/hosted-setup-01-fingerprint-independent-review.md` remains a **FAIL** with `FINGERPRINT-QA-F01 [P1]`. Candidate 1 captured Candidate3 recovery state and the full upgrade fingerprint in separate repeatable-read transactions. An actual `ALTER POLICY` committed between those snapshots, and Candidate 1 adopted the changed policy catalog while returning `tenantControlsVerified:true` and `applicationCatalogEquivalent:true`.

Candidate 2 does not relabel or overwrite that evidence. The frozen review SHA-256 is `52ae7f3538e295228236fb6858ee75389a2e4b87f8397842039465a6c9d7c16c`; its regression SHA-256 is `d4c5c8d78eee9b9377f8ee46d20678417e51d898f7a7f58bb6696dca43b81ea7`.

## Repair boundary

`deriveExpectedHostedSetupFingerprint` now owns one outer database transaction for every local-clone observation. Its first statement is exactly `set transaction isolation level repeatable read read only`, before any injected capture seam, catalog read, row read, identity read or tenant probe.

Within that one transaction it:

1. captures the complete `HostedSetupFingerprint` through a transaction-bound `WorkspaceConnection` adapter;
2. optionally invokes the adversarial scheduling hook while the transaction and its relation locks remain open;
3. restores `row_security=on` after the privileged fingerprint capture used `row_security=off`;
4. captures Candidate3 recovery state and performs its tenant probes through the same `WorkspaceSql`; and
5. reads local database identity through that same snapshot before the transaction closes.

The adapter suppresses only the nested helper's duplicate, byte-equivalent isolation command. Every other query and statement reaches the caller-owned transaction. It cannot close the shared connection or open a nested transaction.

Candidate 1's broad capture replacements were removed. Test seams are transaction-scoped and cannot replace the outer transaction. A focused assertion proves one transaction is used, the isolation command occurs before the injected fingerprint capture, the adversarial hook runs between the fingerprint and recovery captures, and `row_security=on` is restored before recovery capture.

All Candidate 1 integrity boundaries remain: exact pinned snapshot/receipt/archive/restore-result bytes; Candidate3 bundle validation; schema 22, project, profile, PostgreSQL 17 loopback and database identity checks; exact first-22 receipts; lossless PostgreSQL `to_jsonb(t)::text` row hashes; role, membership and application/default ACL equivalence; sequence `last_value/is_called`; exactly 27 independently pinned external default ACL rows; and refusal of views, materialized views, foreign tables, partitions and inheritance.

## Native adversarial evidence

The native author fixture starts a real independent writer after the full fingerprint capture and attempts:

```sql
alter policy precise on neuvetra.precise_records using (true)
```

An independent observer proves that statement is waiting on a PostgreSQL lock while the shared derivation transaction remains active. Recovery capture then completes from the same historical snapshot. Candidate 2 returns exactly the pristine baseline fingerprint and retains `sourceCurrentnessObserved:false`.

After the shared transaction commits, the writer commits. A restricted outsider then reads one row, proving the policy mutation became effective only afterward. A fresh derivation refuses with `HS_RECOVERY_TENANT_PROBE_FAILED`; the fixture restores the original policy before continuing its existing sequence and unsupported-view cases.

This result closes the specific inter-snapshot false acceptance. It does not prove that the restored clone or hosted source remains unchanged after capture. PostgreSQL sequence state is not MVCC transactional: the two in-transaction sequence observations are compared and drift between them is refused, but a change after the final observation remains a currentness issue. Derivation and the later live preflight still require a continuously held and independently evidenced write gate.

## Final execution evidence

| Execution | Result |
| --- | --- |
| `bun test tools/staging/hosted-setup-fingerprint-derivation.test.ts` | 6 pass, 0 fail, 1 native skip, 20 expectations |
| Same suite with `HOSTED_SETUP_FINGERPRINT_NATIVE=1` | 7 pass, 0 fail, 39 expectations, 4.32 seconds |
| Focused TypeScript compilation of implementation and test | pass, no diagnostics |

The native run used PostgreSQL 17, the actual Candidate3 synthetic backup/restore path, a dynamic port that rejects 55479, one synthetic company, an outsider, high-precision numeric/JSONB data, 27 external default ACL rows, `fugitive_audit_sequence_seq`, the policy writer interleaving, sequence drift and an outsider-readable view refusal. The final fixture stopped its cluster in `finally`; no matching running temporary cluster remained afterward.

One intermediate repair run reached the correct stronger post-mutation refusal `HS_RECOVERY_TENANT_PROBE_FAILED` while its assertion still expected the later preservation-mismatch code. The assertion was corrected to the observed earlier fail-closed boundary. A subsequent refactor made the outer transaction non-bypassable by all seams; focused, type and native checks above were rerun after that refactor.

## Exact Candidate 2 bytes

| File | SHA-256 |
| --- | --- |
| `tools/staging/hosted-setup-fingerprint-derivation.ts` | `c771648829ccf84d0136530534940e8215f8b865f1ec5e2b742eb608f070fb5b` |
| `tools/staging/hosted-setup-fingerprint-derivation.test.ts` | `7e3add3959b2a727066768d0751cf5ae926388e5be2eaba782a72d749cad0ec3` |

Reviewed dependencies observed unchanged for this candidate:

| Dependency | SHA-256 |
| --- | --- |
| `tools/staging/hosted-setup-restore-core.ts` | `3add141768b2bde620627148bba5311c8689f19cf078ad8b23fe51417d92fc6b` |
| `tools/staging/hosted-setup-backup.ts` | `4ceeddd0f8e1021e5f65492b30ee08dc21fab409b5b01f8e40cbf26c5f74e66f` |
| `tools/staging/hosted-setup-restore-io.ts` | `6eb5f90da057e302bbc8ad91c81933e748ce8705b699bed53838aba5d451da71` |
| `tools/staging/hosted-setup-upgrade.ts` | `2eb3445b725a7c6547486ccac8ed1e6e1b52730b26ebe13fa99dcf1d5a6e9e2c` |
| `tools/staging/m78-inventory.ts` | `ea93686812910082438bf8ecfd9ef8756dddd6048897d369a494e0fdd700f40a` |

## Open integration and QA gates

Independent QA must rerun the repaired native interleaving, inspect the shared transaction adapter and challenge transaction timing, lock release, row-security reset, sequence non-transactionality and unsupported relation refusal. The frozen Candidate 1 independent test intentionally targets Candidate 1's former seams; it remains preserved evidence rather than being rewritten into an author-controlled pass.

The derived fingerprint remains historical evidence. The future operator path must bind its accepted bytes to the corrected actual-restore v2 observation and independent review, then compare a fresh full hosted fingerprint under the continuously held live write gate. The result continues to say `sourceCurrentnessObserved:false`, `liveHostedPreflightRequired:true`, `independentReviewRequired:true` and `upgradeAuthorized:false`.

Migration-source immutability remains owned by the separate source-lock workstream. Provider/Auth/storage exclusions, exact reviewed publication head, no-retry journal, postcommit reconciliation and deployment ordering also remain separate gates. No migration or publication action is authorized by this handoff.
