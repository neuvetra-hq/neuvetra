# HOSTED-SETUP-SCHEMA-BRIDGE-QA-01

2026-09-26. Independent security/CTO reviewer `/root/upgrade_boundary_review`, sponsored by `/root`. Requested critical security route `gpt-6-astra/high`; observed model/effort, token use and cost unknown. Reviewer did not author the bridge or its tests. Existing source/role guidance and independent-review ownership apply. Only this new repository report and synthetic temporary probes were written.

## Verdict

**Bounded PASS for the exact schema-22 readiness bridge below.** The pinned existing synthetic project can start the reviewed image on exact contained schema 22, while general company setup remains closed. Independent checks found no new material defect in the changed boundary. Schema 23 is recognized by the same runtime only after the explicit migration commits.

This is a local code/native-fixture acceptance. It does not establish that the bridge image is published or live, that hosted receipts/containment match, or that the current maintenance-stop and transactional controls identify that image. The dynamic stop/image binding remains a separate pending requirement.

## Accepted boundary

`validateHostedSchemaReceipts` accepts exactly 23 receipts generally, or exactly 22 only for `icockcoguyadhryzydvl` with primitive `reuseExistingProject === true`. Both cases require a complete 23-entry image manifest and equality of every ordered receipt name/hash with its corresponding manifest entry. The runtime separately enforces exact target metadata, profile, restricted role, forced RLS/no direct writes and existing-project containment before accepting readiness. The pure helper is not itself a target/containment authenticator.

The bridge calls no migration function on startup or readiness. Independent native observation confirmed that checking schema-22 readiness did not change receipt rows/timestamps or the application relation inventory, and no `company_setup_versions` table existed before the explicit test-only operator migration.

The server accepts schema-22 readiness only with the pinned existing project, reuse confirmation and strict-true containment. For general setup, the outer authentication and current staging-access checks still precede the schema gate. A healthy schema-22 runtime returns 401 for missing/invalid authentication, 403 for revoked staging access or a foreign mutation origin, and controlled 503 for admitted setup callers. Current, version-history and POST setup paths did not invoke any setup database method on schema 22. Existing config/session and M80 route dispatch remain available through their existing controls.

A valid schema-23 observation enables the existing setup router rather than bypassing its authorization or membership rules. In the independent HTTP stub probe, the first schema-23 request reached `findCompanySetup` and returned its ordinary not-found 404; that is dispatch evidence, not proof of a real company's setup permissions or a live UI demonstration.

## Independent challenges

The reviewer-written receipt/API probe passed **47 explicit checks**:

- Exact schema22 and ordinary schema23 positive controls.
- Receipt counts 0, 9, 21 and 24; changed first/middle/last prefix hashes; reordered and duplicate prefixes; missing/nonboolean reuse; unrelated project22; and image manifests of length22 or24 all refused.
- `/ready`, public config and authenticated session succeeded on the controlled schema22 stub.
- Missing/invalid authentication and revoked staging access retained 401/403 precedence for current and version setup paths; admitted setup/current/history/POST returned503 with zero setup method calls. Foreign-origin POST returned403.
- A schema22 M80 request reached its legacy method. Encoded/malformed/nonmatching setup paths did not reach general setup methods.
- Startup refused unrelated project22, missing reuse, string-valued containment and schema24, and closed each failed database dependency.
- Loss of containment closed subsequent setup and readiness requests. Unknown schema24 also closed setup dispatch.

### Transition race

I held an authenticated setup request after its request-level readiness observation returned22, advanced the stub to23, and then released authentication. That in-flight request remained503 with no setup method call. The next request observed23 and dispatched exactly once. This is a conservative temporary refusal, not a path that opens setup from a stale22 result.

The separate native PostgreSQL probe held migration23 and its receipt inside an uncommitted operator transaction. Restricted-runtime readiness still returned22. After that transaction committed, the same runtime object returned23 and the setup table was present. This verifies the intended forward transition and committed receipt visibility; it is not a general fence against administrative schema downgrades or concurrent security changes. The actual schema upgrade must still use the separately reviewed maintenance/transaction mechanism.

## Native database checks

I first independently reran the existing native legacy suite on a fresh PostgreSQL 17 fixture: **10 passed, 0 failed, 133 assertions**. It includes the schema22-to23 runtime transition and subsequent legacy/tenant/shared-adapter regression coverage. Those later legacy tests run after23; they are not represented here as full native execution of every legacy route while still on22.

I then ran a separate reviewer-written PostgreSQL probe in another fresh isolated cluster, with **10 explicit checks passed**:

1. Actual restricted `neuvetra_runtime` readiness accepted contained schema22.
2. Readiness left receipt data/timestamps and application relation inventory unchanged.
3. Missing reuse refused.
4. Wrong expected project refused.
5. A changed real schema receipt refused.
6. A real grant exposing public-schema usage to `anon` caused containment refusal.
7. Restoring the fixture containment restored schema22 readiness.
8. Uncommitted migration23 never produced readiness23; observed result was22.
9. The same runtime observed23 after explicit migration commit.
10. The setup table existed only after the explicit upgrade.

These fixtures use the real migration SQL and restricted PostgreSQL login, with a test-only constructor path to bypass Supabase provider URL/TLS targeting for localhost. They do not exercise hosted TLS, provider identity or credentials. No real customer data was present.

## Tests, cleanup and evidence

- Focused source tests: **13 passed, 9 opt-in native entries skipped, 0 failed, 110 assertions**. The skipped native entries were separately exercised by the native harness below; they are not counted as passes in the focused run.
- Database-package and API-package installed TypeScript checks: **PASS**, no diagnostics, no installation.
- Native legacy harness fixture: `C:/Users/nimab/AppData/Local/Temp/shared-adapter-legacy-54dd73bcf96a41e8923a57ac9fbb1f83`, port55948. Tests exit0, stop exit0, final status3/no server running.
- Independent receipt/API probe: `C:/Users/nimab/AppData/Local/Temp/schema-bridge-independent-f759f879cfbd4e7181c85d9ca2e7cea8/probe.ts`. Synthetic stubs only, no network listener or database.
- Independent native fixture/probe: `C:/Users/nimab/AppData/Local/Temp/schema-bridge-native-qa-ba573d7bdacb48c285acec97f915b48f`, port63621. `probe.out` retains the ten observations; probe exit0, stop exit0, final status3/no server running. No reviewer-owned database remains active.
- The legacy native suite repeated the documented `pg@8.23.0` deprecation warning concerning overlapping queries on a client during the legacy inventory regression. No failure or leakage was observed. The bridge does not alter that adapter dispatch implementation or establish compatibility with a future major driver version.
- Source/test hashes rechecked after every test group completed; all remained at the assigned values. No implementation, ledger, Git, provider, hosted database or earlier review was changed.

## Exact reviewed bytes and provenance correction

| Artifact | SHA-256 |
| --- | --- |
| `packages/neuvetra-database/src/hosted.ts` | `1af0a88b08c37ee0f73ca8dd2f56ce96e54ee5d145a6902ee86753f7d740b1ff` |
| `packages/neuvetra-database/src/hosted.test.ts` | `b4a64f8b4f756febdf09a5e5d97c6609074b138c0e27bf047b5a2e24f8a905a2` |
| `apps/site-api/src/staging/server.ts` | `4375613c62e40ecd34a592d5f06622143c1a196780d92b99fb859b6b44651b2d` |
| `apps/site-api/src/staging/server.test.ts` | `e1a56099c53ce05681c7cd9ecb091d811f761aeee22d3a6cb7483910425d6bda` |
| `evaluations/research-qa/hosted-setup-01-schema-bridge-author.md` | `844ccadbeb946f14717d1f0da88456a6cdc01c1d070e5643e2acfca8de03bff4` |

The dispatch supplied a 63-character author-report digest ending `3bff`; direct hashing showed the complete digest above, ending `3bff4`. I informed root immediately. All four implementation/test pins matched exactly before work, so the review proceeded against those frozen candidates. This correction is recorded rather than treating the truncated supplied string as a valid SHA-256 pin. The author report itself was not edited.

## Remaining execution boundary

This bridge is deliberately temporary and fixed to a23 image manifest with a22 exception. A future image manifest length must be separately reviewed; it does not inherit this exception automatically. A health response establishes observed readiness, not deployment identity or preservation.

Root must publish/revalidate the exact reviewed image, authenticate that image's actual schema22/containment readiness, and independently bind maintenance stop/restart plus the one-shot transaction to the newly observed deployment/image. The old deployment's fixed stop identifiers do not automatically follow the bridge image. Backup/restore, pinned migration, durable journal, uncertain-COMMIT handling, independent actual-result review and the hosted board demonstration remain their existing separate gates. This local PASS does not authorize retry or supply any missing live evidence.