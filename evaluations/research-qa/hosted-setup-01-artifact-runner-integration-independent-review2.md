# HOSTED-SETUP-ARTIFACT-RUNNER-INTEGRATION-REPAIR-QA-01 — targeted independent review

Date: 2026-09-26. Reviewer /root/compose_qa, Head of QA, independent of the runner/compose author. Requested registered route gpt-6-astra/high; observed model/effort unknown. QA role prompt and original FAIL refreshed. This report assesses only the frozen repair; no author, provider, database-hosted, Git or publication changes were made.

## Verdict

**PASS, bounded local repair. ARTIFACT-RUNNER-F01 is resolved.** The original direct lock type assignment now compiles; the real verify -> lock -> runner runtime chain commits successfully without a serialization shim. New malformed-result probes still roll back and preserve no-retry behavior. Fresh native PG17 composition and focused regressions pass.

Original FAIL report remains unchanged at SHA-256 f1a9c704431f231fe4d148823c3382b7771ccf863971bb242fa454c2de9b14be. Prior candidate failures and reviewer harness failures are not erased.

## Frozen versions

All assigned pins matched before and after execution.

| Artifact | SHA-256 |
| --- | --- |
| tools/staging/hosted-setup-transactional-upgrade.ts | e4819c88fd17b64c6f9e6e18149c6c8803d136cf388f9b69fb38af9698b30cc4 |
| tools/staging/hosted-setup-transactional-upgrade.test.ts | 9dc21cf9132120d439a19fa9b74356a850413d1d8e6143fc29bb4655921c0ae4 |
| tools/staging/hosted-setup-transaction-compose.ts | 8fcee47ec1275a315f63fd3fb2ce5f764e250c25029e37710ec1252e9e8a3159 |
| tools/staging/hosted-setup-transaction-compose.test.ts | 4eec7ab6b3fb500004b6063ad07efb80304b1240690ea1aefab2a9acaf073dca |
| tools/staging/hosted-setup-transaction-compose.child.ts | 20abad7a82e41d4923edc256b6d88da75ac4857c5223764c07f3536c3617706d |
| tools/staging/hosted-setup-artifact-source.ts | 3e1069aba42eca77a861f9c395c966269758a79a16207c53c19b15b6c8d4c691 |
| evaluations/research-qa/hosted-setup-01-artifact-runner-integration-author.md | 39b8d5736a2db2dfd8e66854f78275eccaea8fd6956caefff243f1b6e7103f86 |

The runner now derives HostedSetupArtifactSqlLock from Awaited<ReturnType<typeof lockHostedSetupArtifactSql>>. Its migration result boundary requires the exact object/row keys, privately copies/freezes the migration rows, and compares all returned names/digests with the pinned manifest. The mock composition now returns the same object contract as the real lock. No accepted artifact-source change was needed.

## Executed evidence

- Combined repository runner/native suite: **18 pass, 0 fail, 159 expectations**, Bun 1.3.12, 38.30 seconds. This includes 17 runner tests/103 expectations and one native test/56 expectations.
- Focused strict TypeScript over the five integration files **plus the unchanged original direct-lock type assignment**: **PASS**, exit 0, no diagnostics. The exact assignment that previously failed TS2322 is now valid.
- Original runtime probe rerun unchanged: **1 pass, 1 fail, 47 expectations**. Its instrumentation reported migration once, object result, no runner error, schema23 and the resolved commit journal. The old assertion still expected rollback to schema22 and correctly failed on actual schema23. This preserved output is not relabelled as a green test run.
- Successor independent runtime suite: **3 pass, 0 fail, 90 expectations**. The actual-lock probe differs from its preserved predecessor only in the expected committed schema/fingerprint outcome; a new malformed-result test was added.

The independent actual-lock runtime proof uses an authentic in-process inspection from the accepted verifier, the real accepted lock and actual migration SQL on a disposable PGlite fixture. A counting wrapper preserves the real migrate return object unchanged. Unlike the author's focused test, this independent test uses actual schema/table/function ACL preparation and does not intercept the containment catalog queries. Publication approval and at-rest artifact files remain synthetic.

Observed actual-lock result:

```json
{"probe":"actual_lock_integration","calls":1,"resultType":"object","returnedKeys":["schemaVersion","migrations"],"failure":"","schemaAfter":23,"rollbackExact":false,"journal":["hosted_setup_transaction_reserved","hosted_setup_schema22_locked_and_verified","hosted_setup_transaction_verified_pending_commit","hosted_setup_schema23_commit_resolved"]}
```

rollbackExact:false is expected after successful additive migration. The committed result matches the success receipt, and reentering the consumed real lock refuses.

The independent mutation matrix still refuses all 14 publication/binding changes before any transaction or journal event. New return-value challenges cover legacy JSON-string output, an extra result field, wrong schema version, a changed first migration digest and a missing migration row. Every case rolls back to the exact schema22 fingerprint, records uncertain/do-not-retry and produces no commit-resolved event.

## Fresh native composition

New PostgreSQL 17.11 cluster: loopback port 62766, retained stopped fixture C:/Users/nimab/AppData/Local/Temp/hosted-setup-compose-Z9nAm1.

Commit backend PID 1636; rollback PID 32872; timeout PID 20928. Each has one matching backend at both lock phases, held locks and one migration call. Commit has the exact migration23 marker d9f4a69bfcd0c6fe19201d2893c19bb8a0356edb647b522812c7fce51d62babb and eight new setup tables; rollback/timeout have no marker and preserve schema22/sentinel. Journal replay refuses before transaction, fresh reconciliation returns marker-present/absent only after original-session resolution, and final compose sessions/locks are both zero. postmaster.pid is absent after stop.

The native run still uses the local synthetic artifact lock, now with the corrected real result shape. The authentic lock integration ran on PGlite separately. This review does not claim a single native authentic-lock execution or fresh server statement-log proof; the matching backend observations, transaction wrapper regression, real sequence fence and one-transaction code path provide the exercised evidence. Forced timeout remains the local client deadline path, not a new server-timeout test.

## Retained independent files

Under C:/Users/nimab/AppData/Local/Temp/:

| File | SHA-256 |
| --- | --- |
| artifact-runner-independent-repair.test.ts | 63742d1a2a1dd2d4179745739a39364a7a7984f1431cc1671cf3174efe97d5a9 |
| artifact-runner-independent-repair.result.txt | efbd3ef9fb333d89c10b9e63a4f50517008218dd38ab22ed841accbe37aa17c3 |
| artifact-runner-original-on-repair.result.txt | 8e76492d756366a47137a92800ad1e0e381b7a465b8ff3780f90d810642dbdc6 |

The original direct type probe and prior failing runtime fixtures/outputs remain retained under their earlier names. No candidate changed to make a test pass.

## Limits and next owner

This is local integration acceptance only. Synthetic publication/restore/maintenance approvals and artifact files do not authenticate a live release or launch. The trusted publication binder and real supervisor must preserve the authentic inspection/lock pairing and provide current independently reviewed evidence. runtimeLoadedCodeAttested:false and launchAuthorized:false remain required. The fixed old deployment/commit cannot attest a future bridge-image stop; reviewed exact-target integration remains separate.

No provider CLI, live database, credential export, deployment, stop, migration or Git action occurred. Sent-COMMIT network uncertainty was not newly fault-injected. Fresh supervised processes remain required for the dedicated client; separate reconciliation and durable consumed journals remain authoritative. Earlier same-process lifecycle and repeatable-read snapshot limits remain.

Coordinator/CTO owns acceptance, immutable review packaging and subsequent integration. A separate QA run record is supplied with this completed technical verdict; its administrative independent root review/closure remains pending, without modifying the author's run record.
