# M75 operator author evidence

Task `M75-OPERATORS`; author `/root/m75_cto`, security/reliability implementation role, root sponsor. Requested critical Astra/high; reused context, observed compute unknown. Author is not the independent reviewer. Root owns host/Git/shared records and reviews these operators independently. Author implementation is frozen with the final evidence below; this is not release acceptance. Earlier progress sections preserve the original outcomes and pending states rather than rewriting history.

## Final frozen author result

- Canonical migration18 pin: `76c8a17a46d96b40ed98213ceb3cf79caf564c5a639583197bd0adaf1c8a98f3`; raw LF migration hash: `5757db529a5e5671f6affaf6bf0682cf1ef7aa04ca250ee1ed4266f6c8997900`. Backend explicitly froze these bytes after direct-SQL review.
- Final operator/native checks:8 passed,98 assertions. Receipt `.tmp/m75-ops-1789539665453/author-result.json`, SHA256 `a3ab8483e8e77530d24d602538f1b2428fb0c3a720b1e68b74ba2bb61414c3b7`. Actual DPAPI seal/unseal passed for both schema17 and populated18 archives. Forced migration rollback, exact old83-table preservation, additive commit, repeat refusal, all recovery controls and runtime/frontend proof replay passed.
- Schema17 restore receipt hash `7c738688590e1fb1748e599e87a31603955902160fe815250e4eebeb2e4db794`; schema18 restore receipt hash `4fbff776da082e5528d2f37e2456c90b91652f92577037de621bfeed12043391`. Receipts and encrypted archives are in that same new output directory. Source17 remained unchanged. New populated18 source is `m75_ops_author_1789539665453`, restored18 is `m75_ops_forward18_1789539665453`, both loopback55463.
- Final18 replay:90 tables,194 retained content entries;11 gas versions,3 mobile versions,5 corporate exports,34 method downloads,115 legacy downloads,1 fleet version with4 export/statement/HTML/snapshot downloads,68 frontend register decodes and2 report-proof reads. Replay made no writes.
- Final complete local hosted-helper workflow:7 passed,98 assertions using new `m75_ops_journey_1789539699269`, cloned from the exact restored18 database. Journal `.tmp/m75-hosted-native-1789539699269.jsonl`. It repeated the two-vehicle scenario, four roster versions, three historical-proof-verified reports,22 expected application POSTs, zero-POST baseline/revisit and12 closed helper sessions on the final migration. Local identity and older legacy transports remain explicit stubs; no hosted claim is made.
- All owned source files are LF normalized. Exact author-file hashes are in `.tmp/m75-ops-1789539665453/author-files.sha256.json`. Root owns independent operator review, accounting QA owns separate restore reconstruction, and final hosted readiness/backup/writer-stop/run receipts remain separate gates. No Git or hosted action was performed by this author.

## Scope and files

New `tools/staging/m75-common.ts`, `m75-backup.ts`, `m75-seal-backup.ps1`, `m75-restore.ts`, `m75-recovery-manifest.ts`, `m75-apply.ts`, `m75-upgrade.ts`, `m75-replay.ts`, `m75-operators.test.ts` and `m75-operator-native.test.ts`. Backend owns the distinct `m75-backend-fixture.ts`. No older helper, migration, application file, host, common operational record or Git state was changed by this author.

Schema17 manifest pin: `d1f2674005b4be8f165313ea3669ad269570a053b4a6b400b9b0998a08fa393c`, computed from exact canonical first17 names/hash pairs. Backend supplied provisional SQL18 pin `0dbb040678905b322f3796df6e018db85087e0c1e145b4c9ce79119dcd908973`; this permits local rehearsal only, not a hosted approval claim. The seven additive controlled_fleet tables and their statement/export/report columns match the author-inspected candidate. Any backend repair requires repinning and targeted repetition.

The new recovery manifest calls the frozen M74 content reader at schema17 to retain its full electricity, corporate, gas and mobile byte coverage, then adds fleet statement/metadata, version export/dependencies and HTML/snapshot entries at18. No old content is discarded. M75 replay additionally uses existing corporate export and M73/M74 public download routes and authorities, plus M75 routes at18. Composed roster replay is not emissions recalculation by M75.

Backup uses one exported PostgreSQL repeatable-read snapshot for dump, inventory and byte manifest. Archive sealing uses Windows DPAPI CurrentUser, create-new files and roundtrip hash verification. Restore accepts only new `m75_ops_*`, `m75_qa_*` or `m75_security_*` databases on loopback55463/55472; no reset/drop/global role changes. 55472 requires exact cluster role flags/memberships. Existing and failed clones are retained.

Read-only local source: `m74_ops_restore17_1789509920941` on55463. This is a historical synthetic test fixture, not fresh hosted backup evidence. Source unchanged assertions passed. Provider Auth accounts/sessions, credentials, configuration, storage and off-device disaster recovery are excluded; only UUID/uid dependency stubs are restored.

## Actual checks so far

- `bun test tools/staging/m75-operators.test.ts`: 5 passed, 2 SQL-pin-dependent gates skipped, 34 assertions. Target restriction, exact17 receipts, per-row hash lists despite matching aggregate count/digest (S01), UTF8/null/omission/duplicate manifest cases and import safety exercised.
- Native schema17 exact backup/restore/replay without DPAPI: 1 passed, 22 assertions. Receipt `.tmp/m75-ops-1789536517259/author-result.json`.
- Native schema17 test with actual DPAPI sealing/unsealing: 1 passed, 24 assertions. Receipt `.tmp/m75-ops-1789536693413/author-result.json`; fresh encrypted synthetic archive and restore receipt retained in that directory. All83 tables preserved; 181 content entries; 11 gas versions, 2 mobile versions, 4 corporate exports, 31 gas/mobile downloads and115 legacy downloads replayed. No writes during replay. Corrupt dump and incompatible55472 roles refused before database creation, existing target refused, stale inventory refused, transactional ACL mutation detection rolled back.
- Initial DPAPI attempts in the sandbox failed at `ProtectedData.Protect`; fresh known-synthetic probe confirmed that stage. An auto-review-approved user-profile execution passed Protect/Unprotect and the full encrypted synthetic restore. No private archive or secret was read. Earlier failed attempts remain recorded in conversation and their new output directories.

The schema17 results do not establish migration18 or populated fleet recovery. Those checks are pending the actual SQL18 pin and backend fixture. A subsequent note will preserve these original results and add the exact full-run receipts/hashes.

### Provisional schema18 rehearsal

After the provisional SQL pin arrived, unit gates passed7 tests/62 assertions with no skips. The first native migration rehearsal correctly refused before executing SQL because the new PostgreSQL clone's empty template `public` schema retained PUBLIC USAGE; that schema is outside the neuvetra-only archive. Evidence `.tmp/m75-ops-1789537062922/restore17.json`. The operator was repaired to revoke endpoint access to that fresh empty local schema only; no cluster role, old source database, historical helper or application bytes changed.

Fresh rehearsal `.tmp/m75-ops-1789537134153/author-result.json` passed1 test/26 assertions: actual migration SQL in a forced-rollback transaction, exact83-table state after rollback, successful17→18 migration with seven empty new tables/one receipt, exact old content/row multiplicity/catalog/roles, and repeat-migration refusal. It used `M75_OPERATORS_REHEARSAL_ONLY=enabled` and explicitly reports `populatedForwardRecoveryVerified:false`. Full populated18 recovery remains pending the backend fixture; this partial run is not the final operator acceptance.

### Provisional populated18 recovery and frontend proof replay

The first full run reached migration18, then refused to import the backend fixture because its project-reference regex lacked an opening slash. Evidence directory `.tmp/m75-ops-1789537386178` remains intact. The backend author corrected that owned fixture. No operator gate was bypassed.

The subsequent actual DPAPI/native run passed1 test/32 assertions in `.tmp/m75-ops-1789537585522/author-result.json`. It explicitly reports both `migrationExecuted:true` and `populatedForwardRecoveryVerified:true`; source17 was unchanged. Forward clone `m75_ops_forward18_1789537585522` on55463 has90 tables and194 content entries. It replayed11 gas versions,3 mobile versions,5 corporate exports,34 gas/mobile downloads,115 legacy downloads and one fleet version with its four export/statement/HTML/snapshot downloads. The additional mobile/corporate/fleet records belong to the new isolated fixture.

Root requested that recovery also exercise the new captured report-proof endpoint and actual frontend validation. The replay now routes serial GET-only frontend requests through the actual native M75 API handler; no external network or browser is simulated as a passed browser test. Supplemental receipt `.tmp/m75-ops-1789537585522/frontend-proof-replay.json` verifies68 current company-register decodes,4 fleet frontend downloads,2 report-proof reads and zero mutation. Historical captured and bound coverage are verified by the actual frontend decoder. Real signed-in browser rendering remains a separate root acceptance gate.

Latest unit result after operator/reviewer normalization and canonical UTC timestamp checks:7 passed/65 assertions, no skips. All these schema18 results use provisional migration `0dbb040...`; final SQL hardening may still require a new pin and fresh full run before this operator set is frozen.

### Hardening pin race refused

Candidate `9f13cfd461f84389e7b12a0b62e9e68b610c5a0de102046aab020b270a2e23ec` was pinned for a fresh native run. During backup/restore, the backend candidate advanced to `0fd4c59f42bf96a75693e758b59b0a916cf1618745616981ff240ede14325a68`. The exact migration gate refused before applying SQL; `.tmp/m75-ops-1789538835035` preserves the new backup/restore receipts and clone. The native test failed its expected-migration-reached assertion, rather than claiming a passed rehearsal. No receipt was rewritten. Final native rerun waits for an explicit backend freeze.

### Hosted journey author scope extension

Root separately assigned `M75-HOSTED-JOURNEY`, limited to the new `tools/staging/check-m75-hosted.ts` and `check-m75-hosted.test.ts`. No hosted execution is authorized to this author. The helper uses four existing supplied accounts; manager1 contributes, manager2 reviews, member and signed-out mutations are denied. Review activity alone does not add a contributor. The bounded scenario uses two vehicle streams, four roster versions and three reports: independent roster missing the second workpaper, changes requested, completion and acceptance, workpaper correction and review reset, then fresh acceptance. It rereads historical gas/legacy evidence after changes and uses current/historical proof-aware frontend report decoders. Baseline17 and revisit18 allow zero application POSTs. A durable hash-chained journal refuses unresolved requests or sessions instead of blind retry.

Offline tests pass6/86 assertions: destination/route restrictions, baseline17 preservation, revisit18 current proof decoding, unknown-schema/evidence-drift refusal, logout failures, interrupted/uncertain journals and tampering. An opt-in full local route test is present and pending a stable schema18 candidate. Its initial seed omitted the fictional boundary reason; the local test fixture was corrected. Its next fresh clone correctly refused provisioning after the backend manifest advanced again. These failed local clones remain retained. This is author test evidence, not independent review or a hosted demonstration.

The full local route journey subsequently passed7 tests/98 assertions against new `m75_ops_journey_1789539384951` cloned from `m75_author_final4` (candidate SQL18 `1f959943a885da0a1dc151ac0805c47bed5845e57bc4f6877db76706bc33b181`). Actual M71/M74/M75 routes handled22 application POSTs including expected denials, preserved both historical M74 versions and two historical reports, produced four roster versions/three proof-verified reports, and ended with two matched/reviewed rows. Baseline and revisit made zero application POSTs; all12 helper-created local auth sessions closed. Durable local journal: `.tmp/m75-hosted-native-1789539384951.jsonl`. Identity and the older legacy journey were deterministic offline transports; this does not replace the actual hosted legacy/readiness checks or independent review. Reproduce by setting `M75_HOSTED_NATIVE_SOURCE` to an approved isolated current-schema template and running `bun test tools/staging/check-m75-hosted.test.ts`; the test creates and retains a fresh `m75_ops_journey_*` clone.

## Reproduce locally

From repository root, with the existing local PostgreSQL clusters already available:

```powershell
bun test tools/staging/m75-operators.test.ts
$env:M75_OPERATORS_NATIVE='enabled'
$env:M75_OPERATORS_DPAPI='enabled'
bun test tools/staging/m75-operator-native.test.ts
```

DPAPI requires the Windows user profile that creates the fresh archive. No service or cluster is started by these commands. Native fixture paths point to the retained synthetic baseline, and each execution chooses fresh target names and exclusive receipt paths. Do not substitute hosted credentials or existing target names into this test.

## Root review and operational handoff

The upgrade gate accepts only the fixed existing project, distinct operator/reviewer identities, exact backup/restore/independent-recovery/forward-recovery byte pins, current maintenance observed within15minutes, backup/restore/recovery/forward proof within4hours, monotonic evidence chronology, exact83-table schema17 inventory and an independently reviewed populated18 forward recovery. It validates each row-hash list, not only table aggregates. Receipt files are loaded and byte-hashed before use; human review attestations are not cryptographic identities.

Apply18 uses an exclusive migration advisory lock, locks existing tables, compares exact baseline rows/catalog/roles/content, validates the17 receipts and target, executes only the pinned migration18, verifies one new receipt/seven empty tables and exact old-row multiplicity, then writes a durable result. The outer execution journal is exclusive and distinguishes attempted/committed/uncertain commit outcomes. Never blindly reapply after an unresolved journal.

Root must independently review exact final bytes, populate and recover18, and produce fresh actual-host17 backup/recovery plus stopped-writer evidence before any authorized hosted change. This author has no hosted execution authority and has performed no hosted actions. After18, only18-compatible forward recovery is supported; older operators stay frozen and should refuse the newer manifest in root-owned legacy regression tests.
