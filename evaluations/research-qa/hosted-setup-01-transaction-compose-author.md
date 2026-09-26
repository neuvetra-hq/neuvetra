# HOSTED-SETUP-TRANSACTION-COMPOSE-01 — author result

Date: 2026-09-26. Role: software engineering under CTO. Requested critical route: `gpt-5.6-sol` / `high`; observed model and effort unavailable. Dispatch prompt SHA-256: `a9ab5574fe2ef1e940cb1950e6ae69da008ff71ba1f857b6a63b45d53240a52b`.

## Disposition

**Local composed candidate PASS, bounded to fresh supervised processes and synthetic external attestations.** The frozen transactional runner, frozen dedicated `pg.Client`, actual PostgreSQL 17 sequence fence, actual 23-file manifest, actual schema-23 migration function, actual database fingerprint/preservation checks and actual exclusive external journal were composed without editing any dependency. The new files are an inert local-only launcher, a one-shot child entry point and a native test. They contain no provider URL, credential, ENV loader, deployment path or live authorization.

The final native run initialized PostgreSQL 17.11 on dynamic loopback port 59615, excluding port 55479. Three databases were independently built from the exact first 22 migration files, exact receipts and target identity. Each included local synthetic Auth prerequisites, one company/member preservation sentinel and the legacy-project containment revocations required by the real migration gate. Migration 23 was never pre-applied.

## Demonstrated composed behavior

- **Commit:** one adapter backend PID (`42520`) was observed at both under-lock phases with one adapter session and live locks. The runner applied the real migration once, retained the exact company and member sentinel, added exactly the eight setup tables, and committed the exact migration-23 marker SHA-256 `d9f4a69bfcd0c6fe19201d2893c19bb8a0356edb647b522812c7fce51d62babb`. The external journal contained reservation, locked-schema-22, verified-pending-commit and commit-resolved envelopes in order.
- **Original-transaction resolution:** only after the observer found zero original adapter sessions and locks, a fresh reconciliation process returned `hosted_setup_commit_marker_present_after_resolution`. A separate premature resolver with `originalTransactionResolved:false` refused before reading the marker.
- **Replay:** a fresh process using the already-consumed journal refused before opening a database transaction. Schema 23 and the unique marker remained unchanged; no second migration ran.
- **Rollback:** a local-only maintenance observer injected a callback failure after migration and preservation checks but before commit. One backend PID (`36284`) held both lock phases. The runner returned its uncertain/no-retry outcome, PostgreSQL rolled the transaction back to exact schema 22, the migration-23 marker remained absent, the sentinel remained, and a fresh post-resolution reconciler returned `hosted_setup_no_commit_marker_after_resolution`.
- **Forced deadline:** a separate one-shot adapter used a 3,000 ms client transaction budget plus 250 ms grace while the runner retained its production 180,000 ms PostgreSQL setting. The local-only final maintenance observation waited 4,500 ms. One backend PID (`28308`) was observed at both lock phases; the adapter deadline revoked/terminated the connection, the runner returned uncertain/no-retry, PostgreSQL rolled back to schema 22, and fresh post-resolution reconciliation found no marker. This proves the composed local deadline path. It is not relabeled as a PostgreSQL server `transaction_timeout`; the dedicated-adapter native suite separately proves server SQLSTATE `25P04`.
- Every snapshot, commit, replay, rollback, timeout and reconciliation adapter ran in a fresh supervised Bun process. The final cluster-wide observation found zero `compose-*` sessions and zero locks. Exact cluster stop succeeded, and no PostgreSQL or composition Bun process remained.

The final concise native receipt was:

```json
{"profile":"neuvetra.hosted-setup.transaction-compose.native-result.v1","postgres":"17.11","port":59615,"commitPid":"42520","rollbackPid":"36284","timeoutPid":"28308","migrationSha256":"d9f4a69bfcd0c6fe19201d2893c19bb8a0356edb647b522812c7fce51d62babb","commit":"marker_present","rollback":"marker_absent","timeout":"marker_absent","replay":"refused_before_transaction","finalComposeSessions":0,"finalComposeLocks":0,"localOnly":true}
```

The final disposable fixture, database files, journals and server log are retained at `C:\Users\nimab\AppData\Local\Temp\hosted-setup-compose-9seM2A` with the server stopped.

## Mocked external boundaries

The accepted-restore, independent fingerprint review, reviewed product publication and reviewed maintenance-stop artifacts are deterministic local-only bytes. Their verifier callbacks return exact scalar bindings but do not authenticate real reviewers or provider evidence. The immutable-source callback enforces one invocation and exact local manifest/head/closure values but does not replace the external runtime attestor or the independently reviewed source-lock ceremony. Maintenance observations return serialized `true`; a separate `psql` process records the adapter PID/session/lock evidence. Current product head is a fixed local value. These mocks exercise the runner's exact binding shapes and database behavior only.

The actual source-lock module, restore acceptance, maintenance-stop implementation, external journal storage authority, provider primary and publication evidence remain separate gates. This result does not authorize a live migration.

## Preserved failures and limitations

1. The first harness piped `pg_ctl` output. The PostgreSQL child inherited those handles, so the 45-second test bound expired before fixture setup continued. Retained fixture `hosted-setup-compose-a8OQsG` was stopped by its exact data directory. Cluster controls now use ignored streams.
2. The first local fingerprint process called `snapshotHostedSetupDatabase`, which tries to change to `REPEATABLE READ READ ONLY` inside the dedicated adapter callback. The adapter has already performed its post-BEGIN verification query, so PostgreSQL correctly refused the later isolation change with SQLSTATE `25001`. The local fixture now calls `snapshotHostedSetupDatabaseInTransaction` on an otherwise idle disposable schema-22 clone. The real accepted-restore fingerprint remains an external reviewed artifact. Any future standalone snapshot process needing repeatable-read isolation must establish that isolation before its first query; this composition does not claim the dedicated adapter supports the root snapshot helper.
3. The first complete runner attempt used the exact first 22 migrations but omitted the existing-project containment state. The real migration gate refused with `Confirmed existing project reuse and verified legacy containment required`; migration had entered and the transaction rolled back. The final fixture applies the catalog revocations required by the real containment audit rather than bypassing the gate.
4. An initial test decoded immutable journal envelopes as though `status` were top-level. Inspection showed the actual `data.status` chain; only the test assertion changed.

No network disconnect was injected during a sent COMMIT. The successful acknowledged COMMIT, pre-commit callback failure, local deadline termination, consumed-journal replay refusal and both marker reconciliation outcomes are covered. A sent-COMMIT/disconnect test still requires a separate deterministic transport fault boundary and must retain the no-retry rule.

## Validation

- Strict targeted TypeScript compile for all three composition files: PASS.
- `bun test tools/staging/hosted-setup-transaction-compose.test.ts --timeout 120000`: **1 pass, 0 fail, 56 expectations**, 23.38 seconds.
- Frozen adapter regression: **2 pass, 0 fail, 27 expectations**, including PostgreSQL server timeout SQLSTATE `25P04`.
- Frozen runner regression: **15 pass, 0 fail, 89 expectations**.
- Scoped `git diff --check`: PASS.
- Final process inspection: no PostgreSQL process and no composition Bun child remained.

## Frozen hashes

| Artifact | SHA-256 |
| --- | --- |
| `tools/staging/hosted-setup-transaction-compose.ts` | `a24833c1692d64074821be60124d9f43b2cb6994c02093fe7125d197eb6e5100` |
| `tools/staging/hosted-setup-transaction-compose.child.ts` | `20abad7a82e41d4923edc256b6d88da75ac4857c5223764c07f3536c3617706d` |
| `tools/staging/hosted-setup-transaction-compose.test.ts` | `15d56924dd43af96ce4e3105d4052b45df4a06b723008f9d9e9af3ee80fe6610` |
| frozen `tools/staging/hosted-setup-dedicated-client.ts` | `6305d5600551226d41b0c1597b67de20e988488705b38416434c55f36d712869` |
| frozen `tools/staging/hosted-setup-transactional-upgrade.ts` | `1cd07dc9789aec7f42b19c3951fde8c52844ff556e888ba0618d9b028bf719a4` |
| frozen `tools/staging/hosted-setup-sequence-fence.ts` | `d48edfa567d847e55200fc6864ad20ad5d38de554c93ed0dd3c05109fc936876` |

Independent QA should rerun the native test, inspect the local-only verifier boundaries, challenge journal replay and resolution ordering, and preserve the repeatable-read incompatibility and same-process pg/Bun lifecycle limitation from the dedicated-adapter author report. No live provider or release conclusion follows from this result.
