# Fresh restore binder — independent review

2026-09-26. Task `HOSTED-SETUP-FRESH-RESTORE-BINDER-QA-01`. **Bounded PASS for the frozen pure evidence binder.** Reviewer `/root/collection_backend` did not author the candidate. Candidate author: `/root/compose_qa`. Requested registered QA route `gpt-6-astra/high`; the reused follow-up context did not expose actual model or effort, so both remain unknown.

This verdict covers exact artifact binding, the documented application-only normalization, freshness and chronology, structured review identity, and runner-facing output semantics. It does not authenticate an operator or reviewer, establish that the hosted source is current, authorize migration, or replace the missing production producer for trusted policy and review envelopes.

## Frozen candidate

| File | SHA-256 |
| --- | --- |
| `tools/staging/hosted-setup-fresh-restore-binding.ts` | `4a7c434537916be019f1f1af80d258d170f92ba7d7d5ef171ca67ae364eb189e` |
| `tools/staging/hosted-setup-fresh-restore-binding.test.ts` | `79f894173b5fe1d179aa318e05896bcca97eb6c34b195d4cd54c8fb047ce7a91` |
| `evaluations/research-qa/hosted-setup-01-fresh-restore-binding-author.md` | `3d733b80501ec343f9ffc2f360430f6268ae2eeed0a3226565cffea786e7accd` |

All three hashes matched before testing. QA did not edit them.

## Independent native challenge

The new independent test built a disposable loopback PostgreSQL 17.11 cluster on dynamic port 50695. It created a schema-22 source with the exact first 22 migration receipts, one member and one outsider, lossless numeric/JSON content, RLS policies, a large sequence value, one application default ACL, and 27 external-schema default ACLs. It then performed a real custom-format `pg_dump`, DPAPI CurrentUser encryption and decryption, fresh-database `pg_restore --single-transaction`, preservation capture, and coherent fingerprint derivation before stopping the cluster.

The resulting archive was dynamic and distinct from the historical archive:

| Observation | Value |
| --- | --- |
| PostgreSQL server version | `170011` |
| Encrypted archive SHA-256 | `20e20f6fb738119970ae9915fc14da4c47be521264e99ec154cc6630bea24848` |
| Decrypted snapshot SHA-256 | `839b2ed178933511ff96f01fd2b73f17486b7f3a4c3606eaf2c020f96e3fa175` |
| Raw source-state SHA-256 | `c4f3452a4fa7badefc9209114eacacfcb2ac4e3cf0443197c697f6c70db33b49` |
| Raw restored-state SHA-256 | `2d779efbb04e85a6539fe03c182fb469a86308ab8da3678e3e63c4b07e514696` |
| Expected database fingerprint | `2475b58f9bf9180104cc3ad5c64ca6d456a9f6d116efa1e2418640ba080a1d73` |
| Retained stopped fixture | `C:\Users\nimab\AppData\Local\Temp\hosted-setup-fresh-binding-IJ9jWr` |

The DPAPI-unsealed bytes hashed exactly to the receipt's snapshot pin, and the contained dump hashed to the receipt's dump pin. The raw source and restored states intentionally differed because the source carried 27 provider/external-schema default ACL rows that the application-only restore excludes. `normalizedState(source)` and `normalizedState(restored)` matched exactly. A separately re-pinned application row-digest change still failed with `HS_RECOVERY_PRESERVATION_MISMATCH`, so the normalization did not hide application drift.

After the cluster stopped and the dynamic port refused connections, the verifier accepted the exact new chain and returned the expected runner binding. It refused:

- an external policy naming the operator as restore reviewer;
- a separately re-pinned review envelope whose reviewer claimed the operator identity;
- trusted time one millisecond beyond the configured maximum age; and
- coherently re-pinned restored-state application drift.

The QA fixture generated local review envelopes only after observing the native facts. Those envelopes demonstrate the binder's semantic contract; they are not production reviewer credentials or independent external issuance.

## Reproduced checks and preserved failures

- Frozen author suite: `10 passed, 0 failed, 113 expectations`.
- Frozen candidate plus author test strict TypeScript: exit 0.
- Final independent native test: `1 passed, 0 failed, 18 expectations` in 3.85 seconds.
- Independent test executable bundle: Bun build succeeded, 132 modules.

The first independent pre-run strict check found two mistakes in the new QA test: an optional-stdin type narrowing and string artifacts supplied where the fingerprint API requires bytes. QA fixed only its new test before native execution. That same strict command also exposed two pre-existing `TS18048` errors at `tools/staging/hosted-setup-restore-io.ts:9` because Bun types mark child stdin optional. After the QA fixes, those two frozen dependency errors were the only strict errors. This is not a binder failure; the candidate's own strict check passes and the independent Bun build and native execution pass.

Both native runs emitted pg 8.23's deprecation warning because the existing `captureState` uses concurrent `client.query()` calls on one client. Current pg queued them and all assertions passed. This is an existing shared capture-path compatibility warning for pg 9, outside the frozen binder and this task's ownership.

The first native run passed 17 expectations. QA then added the envelope-level operator-as-reviewer attack and reran; the final 18-expectation run passed. No candidate failure occurred, so the candidate's first review is PASS.

## Trust boundary and limits

The verifier proves integrity and relationships only relative to its `FreshRestorePolicy` input. It does not authenticate where that policy, trusted time, operator identity, reviewer identity, or review envelopes came from. A caller controlling all policy pins and both review envelopes can mint a self-consistent chain. That caller is expressly outside the declared trusted-host boundary. Production integration still needs an independently authenticated policy/review producer and must invoke the verifier with trusted current time immediately before use.

The binder itself does not decrypt the archive. The native QA independently proved the tested archive/snapshot pair through DPAPI; the binder binds their separate externally trusted hashes and requires a review explicitly attesting `archiveSnapshotPairVerified`. Without authenticated issuance, the boolean and identity strings are claims rather than authority.

The native fixture was entirely local and synthetic. The existing backup helper was invoked with its `hosted` source-mode branch against a loopback `postgres` database because its synthetic-local branch is fixed to the separately reserved port 55479; this does not establish hosted transport or TLS. No hosted database, provider, credential, Git state, migration, or deployment was accessed or changed. `sourceCurrentnessObserved` remains false, live hosted preflight remains required, provider recovery remains excluded, and the returned binding does not authorize schema 23 execution.

## Verdict

**PASS, material findings open: 0.** The exact frozen binder meets this scoped contract when its policy and review inputs actually come from the declared external trust boundary. The next owner must build and independently review that authenticated issuance/integration path; this PASS must not be used as evidence that such a path already exists.
