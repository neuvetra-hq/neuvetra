# HOSTED-SETUP-TRANSACTION-COMPOSE-QA-01 — independent review

Date: 2026-09-26. Reviewer execution context: /root/compose_qa, Head of QA reporting to the coordinator. I did not author the candidate, child, tests, or frozen dependencies. Requested registry route: gpt-6-astra / high; observed model and effort: unknown. QA role prompt SHA-256: 0b947520b2f109b5ffbfe2724cb4ea68ef5372150dacf67c34efa0e6bb48bd94. Applicable lessons: L02 (exact bytes and lineage), L04 (exercise actual boundary), L06 (composed lifecycle). Coordinator retains run/ledger ownership.

## Verdict

**PASS, bounded to local synthetic composition in fresh supervised one-shot processes.** The actual PG17 transaction, migration, preservation check, sequence fence, durable exclusive journal, and fresh-process reconciliation work together in the exercised cases. Independent native rerun: 1 pass, 0 fail, 56 expectations. Additional reviewer-derived native probes: 16 checks passed.

**No live upgrade, provider stop, publication, restore approval, or release acceptance follows.** The inner returned receipt has the production runner's shape and fixed hosted project identity even though approval callbacks are synthetic. It is not independently authenticating evidence and must never be substituted for real restore/publication/stop/source bindings. The local-only input profile, loopback client target, explicit source comments, author report, and this review define the evidence scope.

No candidate defect requiring repair was reproduced within that scope. The documented same-process client lifecycle issue and repeatable-read snapshot incompatibility remain limitations; this review does not erase their earlier failures.

## Reviewed bytes

All supplied hashes matched before testing and remained unchanged afterward.

| Artifact | SHA-256 |
| --- | --- |
| tools/staging/hosted-setup-transaction-compose.ts | a24833c1692d64074821be60124d9f43b2cb6994c02093fe7125d197eb6e5100 |
| tools/staging/hosted-setup-transaction-compose.child.ts | 20abad7a82e41d4923edc256b6d88da75ac4857c5223764c07f3536c3617706d |
| tools/staging/hosted-setup-transaction-compose.test.ts | 15d56924dd43af96ce4e3105d4052b45df4a06b723008f9d9e9af3ee80fe6610 |
| evaluations/research-qa/hosted-setup-01-transaction-compose-author.md | c5fc82da99062a8cf48749648a5572e97a57e9142f3efd1326493a8c401c1a32 |
| tools/staging/hosted-setup-dedicated-client.ts | 6305d5600551226d41b0c1597b67de20e988488705b38416434c55f36d712869 |
| tools/staging/hosted-setup-transactional-upgrade.ts | 1cd07dc9789aec7f42b19c3951fde8c52844ff556e888ba0618d9b028bf719a4 |
| tools/staging/hosted-setup-sequence-fence.ts | d48edfa567d847e55200fc6864ad20ad5d38de554c93ed0dd3c05109fc936876 |

Read current AGENTS/CLAUDE instructions, operating model, QA prompt, improvement workflow/registry/lessons/compute policy, leading continuation and board report, relevant status, corporate direction, local notes index and the September 25 hosted-rebuild brief. The authoritative current scope is local safety integration; old continuation sections are historical. No legal/accounting claim is assessed here.

## Native reproduction

Command: bun test tools/staging/hosted-setup-transaction-compose.test.ts, in the inventory-plan-delivery worktree. Runtime: Bun 1.3.12, PostgreSQL 17.11, new loopback port 64596 (not 55479). Result: 1 pass, 0 fail, 56 expectations, 23.17 seconds. No test skip occurred.

Retained stopped fixture: C:/Users/nimab/AppData/Local/Temp/hosted-setup-compose-DjNWvE. The native test independently initializes three schema-22 databases from the actual first 22 migrations, with real target/receipt rows, synthetic Auth, containment ACLs and company/member sentinel. It does not start from schema 23 or replay the author's fixture.

| Criterion | Independently observed evidence |
| --- | --- |
| Actual migration and marker | Commit backend 35128; actual migration called once; exactly eight new setup tables, 23 receipts, exact unique 0023_company_setup.sql marker d9f4a69bfcd0c6fe19201d2893c19bb8a0356edb647b522812c7fce51d62babb; company name and owner membership retained. |
| One physical transaction | Same backend at both under-lock observations with one session and held locks. Additional PostgreSQL server-log check below establishes BEGIN/COMMIT and physical XID rather than relying only on the receipt boolean. |
| Rollback | Backend 18532; injected final observer failure after migration; uncertain/no-retry response, no new setup tables, exactly 22 receipts and sentinel retained. Fresh resolver finds no marker only after sessions/locks disappear. |
| Deadline uncertainty | Backend 46484; adapter budget 3000 ms plus 250 ms grace, final observer delay 4500 ms. Uncertain/no-retry, no marker and schema22 remains. This is the local client deadline, not an exercised server transaction_timeout failure: runner resets the server setting to 180000 ms. |
| Journal lifecycle | Real external exclusive journal with chained, fsynced envelopes. Successful journal has reservation, locked verification, pending-commit verification, commit-resolved. Existing successful path replay refuses before migration. Additional probes cover rollback/timeout journal reuse. |
| Reconciliation ordering | New process per reconciliation. originalTransactionResolved:false refuses before marker read; true after actual observer cleanup resolves present and absent markers. The boolean in this harness is synthetic; future live resolution needs independent observed original-transaction completion. |
| Cleanup | Every test child exits; final compose-* sessions and their locks both zero; exact cluster stop succeeds. |

## Additional reviewer probes

Reviewer script and first attempts are retained outside the repository. Final script: C:/Users/nimab/AppData/Local/Temp/hosted-setup-compose-independent-probe-v3.ps1, SHA-256 d0d98adbd263fec277ab663c2588e7671db510489ca8d3595ea9052c1b24980b.

The reviewer restarted only this disposable cluster with PostgreSQL statement logging and PID/XID log prefixes, then created fresh database qa_compose from the untouched schema22 rollback database. Snapshot and commit ran through the unchanged one-shot child. This is a new local target, not an existing consumed transaction attempt. Evidence directory: C:/Users/nimab/AppData/Local/Temp/hosted-setup-compose-DjNWvE/qa-independent-v3.

Sixteen assertions passed:

- Schema22 starting point and real composed commit.
- All 126 preexisting nonreceipt table row sets unchanged, using independently generated sorted JSON row aggregates/counts and MD5 comparisons before/after; both exports retained. This comparison is an equality check on synthetic data, not cryptographic source attestation.
- Exact unique schema23 migration marker.
- PostgreSQL worker PID 35616 logged exactly one BEGIN and one COMMIT, no ROLLBACK. COMMIT's physical XID was 2730; all assigned nonzero XIDs for that worker were 2730. Sequence savepoints remained inside this transaction.
- Replaying each rollback and timeout journal in another child refused with zero migration calls; original journal bytes stayed identical.
- Wrong accepted fingerprint (64 zeroes) refused under lock before migration, consumed its fresh journal, and retained 22 receipts.
- Wrong expected marker digest (64 zeroes) could not reconcile an existing committed marker as success.
- Zero qa-compose-* backend sessions and zero locks attached to those sessions after probes.

Result JSON SHA-256: aee09f10ac1c82df09d46f04a7363ce38af93d20fce3cfb99eba5a6b907cd3d8. Filtered commit backend server-log SHA-256: 965d3d6b570a43482f06b93fda940ef830821c258c94b8bd31c707893a756639. All local inputs, per-child results, journals, prior-row exports and server logs are retained there. Final server log says database system is shut down; postmaster.pid is absent.

## Mock boundaries and remaining limits

The local composition supplies deterministic synthetic approval bytes, fixed product head, synthetic reviewer identities, fixed source closure, maintenance observations returning true, and an immutable-source callback that checks its local scalar values/single invocation. These do not authenticate restore approval, independent reviewers, current remote checks, real maintenance state or the runtime's loaded source graph. The dedicated client explicitly selects synthetic-loopback and rejects non-loopback host strings by source inspection. No credential export, hosted database, provider API, deployment, invitation or customer record was accessed.

The native fixture's prior schemas/controls are real, but its legacy data population is sparse: company/member sentinel plus migration-provided data. The 126-table comparison must not be described as a new actual-host-archive rehearsal or a populated M71/M78/M80 history preservation test. The runner's real preservation function compares all old rows, receipts, retained catalog properties and the explicitly allowed geography changes. Prior actual-archive acceptance remains separate.

No fault was injected after COMMIT was sent but before acknowledgment. The acknowledged commit, forced precommit failure, local deadline disconnection, journal replay refusals, and marker-present/absent/wrong-digest outcomes are covered. General transport-disconnect and sent-COMMIT uncertainty remain untested here. No concurrent hostile provider administrator, metadata maintenance race, storage/Auth recovery, or live two-company browser scenario was exercised. The sequence fence's stated no-concurrent-DDL/security-maintenance operating condition remains.

Snapshots use snapshotHostedSetupDatabaseInTransaction on an idle disposable clone. This does not prove the standalone repeatable-read snapshot helper works with an adapter that already queried after BEGIN. Every worker/reconciler was a fresh process; this does not fix or approve the known same-process second-client hang. The production process supervisor and exact-artifact launch boundary remain separate review responsibilities. Strict compile and separate frozen component suites were author evidence; this reviewer reran the integrated native boundary and targeted probes, not all unrelated regressions.

## Preserved initial failures

1. First native invocation under the sandbox failed before tests with EPERM reading the worktree (0 pass, 1 fail, 1 error). Authorized escalation allowed the unchanged test to execute on the disposable fixture; this is an environment failure, not a candidate test failure.
2. Reviewer probe v1 stalled at pg_ctl startup because inherited process output handles stayed open. The exact disposable data directory was stopped; subsequent cleanup reported QA_STOP because the process had already been stopped. Script and startup log remain.
3. Reviewer probe v2 redirected output but used Start-Process -Wait, which waited for the PostgreSQL descendant as well as its launcher. The same exact disposable cluster was stopped; cleanup again reported QA_STOP. Version3 waits for the launcher process directly, preserves prior directories, and passes all assertions.
4. Initial lookup used a nonexistent author-report filename; the actual author.md was located, read, and its supplied hash verified. No unavailable report was treated as evidence.

No candidate or frozen dependency was edited to make a test pass. No source/test/report hash changed. Only this new repository review was authored; temporary reviewer probes and disposable fixture evidence are outside the repository. No Git/ledger/provider mutation occurred.

Next owner: coordinator/CTO. Accept this bounded local composition result, preserve the limitations and earlier failures, and complete the independently reviewed real source/publication/restore/stop/authenticated-operation and supervision bindings before any hosted execution. Do not reuse any consumed journal.
