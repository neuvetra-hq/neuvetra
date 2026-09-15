# M72 independent rollout and recovery review

Reviewer: `/root/m72_security`, security/reliability review mode; sponsor QA/coordinator. Requested compute: `gpt-6-astra` / `high`; observed settings unknown. Reviewer did not author the application or operator implementation. Scope is the board-authorized existing-host synthetic coverage-register rollout; no assurance, source/method release, corporate MVP, paid RAG, new provider or subscription verdict.

**Current scoped verdict: PASS for exact application backup recovery, atomic hosted migration, authenticated API boundaries, prior-data preservation and post-restart exact readback. Fresh hosted visual verification remains pending. This is not a full milestone-completion or provider disaster-recovery verdict.** Earlier findings and provisional statuses below are chronological evidence.

## First findings, preserved

### F01 — old image is not a schema-15 rollback (2026-09-15)

Static inspection of historical `2a4dd4f` confirms `HostedWorkspaceDatabase.checkReadiness()` requires exactly its bundled migration manifest length (14). The staging server additionally requires `schemaVersion === 14`. Applying migration 0015 makes the historical image's readiness fail; restarting that image cannot initialize. An additive migration alone therefore does not prove executable old/new compatibility. The current application requires 15 and cannot start before migration.

Coordinator and operator author notified before operator artifacts were ready. Required disposition: explicit maintenance/downtime expectation and independently validated schema-15-compatible recovery deployment, or an explicit forward-recovery plan and its limitations. Never delete new tables or rewrite migration receipts to make the historical image pass.

### Inherited backup limitations

`tools/staging/backup-existing.ps1` verifies DPAPI decrypt/hash round-trip only and explicitly labels restore drill pending. Its application-only archive excludes Auth. PostgreSQL database dumps do not by themselves restore global roles. Historical local restore fixtures and synthetic Auth stubs are useful leads, not proof that the exact new encrypted hosted backup recovers the current application and its external identity dependencies.

`collectSourceManifest()` hashes application tables, four catalog groups and referenced role flags. It does not itself bind role memberships or default ACL definitions. M72 preservation/recovery evidence must address these dependencies separately.

## Prerelease verdict

**PENDING.** M72 operator artifacts, fresh hosted identity/schema/deployment observation, exact encrypted-archive restoration, post-restore fidelity, and recovery deployment evidence were not yet available at this first review. No hosted mutation was performed by this reviewer.

## Independent local preflight

### F02 — uncertain Auth session incorrectly reported closed

Independent review of new `tools/staging/check-m72-hosted.ts` found that `allCreatedAuthSessionsClosed = !logoutFailed` returns true if a sign-in request times out, its successful response is malformed JSON, or its token is too long to retain. Each case may have created a provider session without a usable cleanup token. Independent injected tests in `m72-security-hosted-helper.test.ts` reproduced **0 pass / 3 fail / 9 assertions** on the first candidate. No real provider request occurred. Author notified; preserve uncertainty rather than claiming clean session closure. This is an operator evidence defect, not an observed customer Auth exposure.

Coordinator expressly authorized a read-only dump of local synthetic `m68_qa` after verifying all fourteen canonical receipts, followed by restoration into new `m72_security`. Both receipt checks passed; actual `pg_restore --exit-on-error --single-transaction` succeeded. The local dump SHA-256 is `2c57a2d69169a862305fdef799bbe4453116b162df275204596ee4559eb982f1`. This binary is temporary local evidence and must not be published. No existing database or receipt was changed.

`bun test evaluations/research-qa/m72-security-migration.test.ts`: **1 pass / 8 assertions**. The real restricted connection/new application refuses schema 14. In the new isolated database, executed canonical 0015 and inserted its receipt inside a transaction, observed the new table, then forced a division-by-zero failure. All old rows, catalog hashes, roles, memberships, default ACLs and receipts equal the before state; all fourteen receipts remain and the new table is absent. This independently establishes PostgreSQL transactional rollback for these exact SQL bytes, not completion of the still-changing M72 operator or hosted execution.

The existing-project server also checks readiness before every `/workspace-api/` request. Thus the unchanged historical schema-14 image's API becomes unavailable immediately after the migration, even without a process restart. Root acknowledged planned downtime and forward recovery; concrete reviewed execution evidence remains pending.

## Reviewed execution plan — evidence collection approved, migration pending

F02 was repaired by counting sign-in requests without a retained token as unaccounted. The independent three cases now pass. Reviewed the author's additional refusal to overwrite unreadable or differently bound receipts. Combined operator/helper checks: **14 pass / 60 assertions**. This includes four operator-author tests, seven journey-author tests and three independently authored failure cases, all executed by this reviewer. No live Auth call was made by this reviewer.

Inspected fresh root observation `.superpowers/m72-hosted-before.json` (SHA-256 `42f952f0d17c1c0f10604b1559dcc4aa6e7a98715d35ac7c7ce3db2a93b1ba64`), dated `2026-09-15T13:33:52.199Z`: schema14, 62 application tables /165 rows, 16 role records /22 memberships /27 default ACL entries, external foreign-key dependency `auth.users`. Runtime has no elevated flags/inheritance and zero memberships. This is root-executed metadata evidence, independently inspected; it does not establish backup recovery.

Root's private wrapper selects only DATABASE_URL for database operators and passes it over stdin. It does not import the export as an environment. The journey branch decrypts an existing private config and supplies the approved mode. Raw errors remain withheld; the approved children expose bounded results. Approval is scoped to the reviewed child scripts, not arbitrary scripts under its directory guard.

**PASS for baseline journey and private backup evidence collection** on the bytes below. Backup uses one exported repeatable-read snapshot for archive plus fingerprints, verified TLS, exclusive encrypted output and a DPAPI decrypt/hash check. No plaintext archive is written. The local restore preserves dump ownership and ACLs, refuses existing target databases, compares application rows/catalog, checks runtime flags/membership/effective privileges and tests unauthenticated runtime read refusal. Provider roles/default ACL differences remain explicit rather than silently relabeled identical. The backup/restore scripts still require actual execution before a migration gate can pass.

| Reviewed file | SHA-256 |
| --- | --- |
| `.superpowers/m72-private-run.ps1` (private local wrapper) | `462485b07b9f21f33b1a8b555cadcfaf95cbbb6078706545a2fa4c06123357d1` |
| `tools/staging/check-m72-hosted.ts` | `43c0f854025acda23453f4f6e28953ebfa2d8673ef5ae0cf4c59e7f941c054c5` |
| `tools/staging/m72-backup.ts` | `982dd9d50113d8111461b353913f3e52f21010e1b05a2dff079d9d9572cb4113` |
| `tools/staging/m72-common.ts` | `22924b55d8427ef6d9a526d301093b8617c79c6e99b46f8a06634b02a3cedb57` |
| `tools/staging/m72-seal.ps1` | `d6bef41e1c5a10aa8b81322f81e47e076cde4594090efaf82321a5bb007855a5` |
| `tools/staging/m72-restore.ts` | `87f144c6f8cb12bf2cd27a6454cfb9fa7c2c2fe0fbc43ba17edf3b6aa5a0c2d7` |
| `tools/staging/m72-restore.ps1` | `a40d4b16e3b290c28b46bb3d4f1744c44cbbb6c91412b9c1340784dc537376e0` |
| `tools/staging/upgrade-m72.ts` | `154cbd3836e794d6c46c9deaa56a8964670be3e2049d285d187dbd7ed456361f` |
| `docs/research/m72-rollout-plan.md` | `8f35cef69cac2dfd00aac8f87bb704d7ba20e46be9610e165cd8cfe6f0358dc5` |

Before hosted migration: independently restore the exact new sealed backup; verify archive/dump/receipt bindings and application/Auth UUID dependency fidelity; inspect any role/default ACL differences; record maintenance and a concrete schema15 deployment/fix-forward artifact and limitation; recheck the reviewed remote application commit. The operator then locks old tables, requires the entire fresh baseline equal the restored backup and applies only frozen0015 plus its receipt atomically. Postcommit receipt failure or uncertain commit must be reconciled by read-only inspection before retry. This review does not approve dropping new data or rolling back to the incompatible schema14 image.

## Exact hosted backup recovery and final prerelease disposition

Root's first backup encryption attempt failed without an archive or database mutation. Reviewed the repair: explicit execution policy applies only to the known child sealing process, and stdin writes/closure are awaited; no persistent Windows policy changed. The final backup below succeeded. A new isolated cluster at loopback55472 reproduces **all16 source role flags and22 memberships/options/grantors**; shared55463 roles remain untouched. Source global/application default ACLs are absent;27 provider-schema default ACL entries remain explicitly outside the application restore. The local Auth stub grants minimal schema usage to the application owner, with no global privilege elevation, and includes referenced UUIDs plus the source `auth.uid()` definition. Provider credentials/sessions/configuration are not restored.

This reviewer directly executed the approved exact-archive restore into **new `m72_security_hosted_restore01`**, using the reviewed restore helper. First sandboxed invocation failed before database creation (independent catalog count0); the same Windows-identity invocation through approved escalation succeeded. The failed attempt is retained here. No existing database was reset and no receipt was overwritten.

- Sealed archive SHA-256: `1363f9bd0c4cc0dd007c7dcc3ff89db9c7cf1faa06826597a74c8c1ab8d46bfd`; independently hashed file equals the backup receipt.
- Exact internal PostgreSQL dump SHA-256: `9bb40e7ac1f6e871e462b26944bd218d78f3a421dab9ba15acf219d468aa05a2`.
- Backup receipt `.superpowers/m72-backup-receipt.json`, dated `2026-09-15T13:41:27.401Z`, SHA-256 `10517618c1bf765105801686f39d807b092430220ecd3213b7c933c732e8e9b0`.
- Independent [restore receipt](m72-security-hosted-restore.json), SHA-256 `e60de88d4c8182639e5896add7ec88d070c9fc36daf1e804a6695066cb10002e`: schema14 /62 tables /165 rows, exact rows/catalog and all role flags/memberships, no application default ACL discrepancy, no-claim runtime read denied, existing admitted actor read passed.
- Independent [restricted-runtime reconstruction](m72-security-restored-read.json): a separate real `neuvetra_runtime` connection reconstructs **9 M64–M68 response records and14 retained source/report downloads**, each equal to the live pre-rollout baseline hash/length. This is additional independent executable recovery evidence, beyond the restore helper's own assertions. The earlier baseline receipt SHA is `da769a6faa2a57bd1beefd27f6da1cddf1a1027e5189e8f10a37255c3b94c50e` (root executed49 stages, zero application POSTs and four tracked sessions closed).

**PASS for the bounded existing-host maintenance, atomic migration and exact reviewed schema15 deployment plan.** Actual hosting success remains pending. Root's concrete sequence: recheck current deployment `314fed59-b935-46ff-94b5-20b1394e81f2`, remove only that deployment to stop the container, verify inactive plus unavailable origin readiness, then set the maintenance gate. Apply0015 using the exact independent restore receipt above. Deploy explicit reviewed commit `ecfedcbfb27b18a1ebebfd960314d68299cb4a28` with `serviceInstanceDeployV2`; verify resulting deployment commit/digest and schema15 readiness. A transient failure permits retrying that same reviewed schema15 commit with writes stopped; a code repair requires new independent review. The schema14 image cannot serve as fallback.

Backup actually preceded maintenance. The plan was corrected to describe this truthfully: an exported snapshot keeps backup internally consistent, and the transaction's locked full-state comparison rejects any intervening write. Do not assert maintenance was active before backup. A later service source-branch correction can automatically deploy; inspect the final resulting deployment before QA exercise and repeat persistence/readback after any subsequent rollout.

Final reviewed operator bytes (supersede earlier preparation hashes only; SQL0015 remains unchanged):

| File | SHA-256 |
| --- | --- |
| `tools/staging/m72-common.ts` | `c2d8c85e3f9cd8259e9ba649fb7e81273bd7960afb0215faf0580e12edb5c6ac` |
| `tools/staging/m72-apply.ts` | `f64e42630d80df23d7a2219cab055216571ae62cf429025cc40afcdfcfba9c98` |
| `tools/staging/m72-backup.ts` | `5792a10d9f608abcbe0b7b857ee6d7a5b905f6f4abedf7a119bc6b590a9ccadf` |
| `tools/staging/m72-bootstrap.ps1` | `71a1d2249a54236ee3616aa703c6078c9e18f3774b21faf1a375561342d7ac5a` |
| `tools/staging/m72-bootstrap.ts` | `bc76c11319d8c463e693db21da57525497f33a57fcf01dc6d112efdb8dc02a9d` |
| `tools/staging/m72-restore.ts` | `0db4d50daacdae6a924f7ec53d48f07967c413aced69d9508b4b07acbe2140f4` |
| `tools/staging/m72-restore.ps1` | `7b545c8e266ce02ba9e09b840ddc182a18edf7e613583f4b5c8f5ab687bb6ccb` |
| `tools/staging/upgrade-m72.ts` | `bd52bf3cbcc77c86c3d12a4d184d39a5fd97de32b59d47abbcfed5e4eace589d` |
| `docs/research/m72-rollout-plan.md` | `228b278f7a6d9f0ddafd25c11333284bdfdb473ee2a6b495156ee69eeac7da2d` |

No assertion of full Supabase/provider disaster recovery, off-device DPAPI recovery, corporate completeness, legal compliance or independent external assurance follows from these checks.

Final targeted rerun with `M72_SECURITY_NATIVE=enabled`: **15 pass /68 assertions**, zero failures/skips, across the independent migration/helper tests plus author operator/journey tests. The local-only migration fixture requires this explicit opt-in so a normal checkout does not contact a review database.

Recovery distinction sent to root and operator author: after a refused or rolled-back APPLY, read-only proof of unchanged canonical14 permits redeploying the exact prior schema14 commit/image. Once15 commits, only schema15-compatible fix-forward is valid. An uncertain commit requires inspection before choosing either branch.

## Hosted migration evidence assessed

Root reports maintenance verified by removal of only the current deployment, an empty `activeDeployments` result and origin `/ready` HTTP404. The [local gate](../../.superpowers/m72-gate.json), SHA-256 `18a4e08905ca1dc16acd33f8eff3d73e2da8b7c2561e9f4a5cf1bbc8e491895e`, records that observation and binds the exact independent backup/restore receipts above. This reviewer did not operate the host.

Root's migration receipt, dated `2026-09-15T13:46:59.802Z`, SHA-256 `cb6f6def249a28065068a3d19b4954be7f77f0c746c2afad980f1950e9f2b54a`, records committed canonical15. Independently compared receipt contents rather than relying on success flags: before inventory equals the restored backup exactly; all **165 original row hashes including multiplicity across62 old tables** remain; the only additional old-table row is migration15's receipt; five new corporate tables are empty; roles, memberships and default ACL arrays are identical before/after. **PASS for hosted migration preservation** on that evidence. Deployment and hosted workflow/restart success remain pending at this stage.

## Publication candidate byte reconciliation

**PASS** for normalized operator snapshot [M72-OPERATORS](../../operations/agent-improvement/snapshots/M72-OPERATORS.json), SHA-256 `979c6da0da1e0fa54f8883fb0667ac157e346193dce2ab5dc3da7859f479d3dd`. Independently checked all15 embedded text entries against actual files and their SHA-256 values; all are LF-only. Earlier execution hashes above remain historical. Most reproduce either unchanged bytes or a CRLF rendering of current text. For restore/upgrade, earlier mixed-line-ending/intermediate bytes cannot be reconstructed from hashes alone, so this reviewer re-read their entire current sources instead of asserting blanket byte identity. The upgrade explicitly requires the restored no-claim refusal and admitted-actor read flags; this is an appropriate gate consistent with the already executed restoration.

Reviewed the two author-only drill entry points included in the snapshot: fixed loopback targets with `m72_ops_` prefix, no hosted connection, explicit local evidence labels. Re-ran the four targeted suites after normalization: **15 pass /68 assertions**, zero failures/skips with native opt-in. This validates the reviewed publication candidate's scoped local boundaries; hosted exercise/restart remains separate actual evidence.

## Hosted authenticated API exercise

Independently inspected root-executed `.superpowers/m72-hosted-journey.json`, exercise-stage SHA-256 `cbd2cefa2059e6c33ff0467e71637086a8fadf5998925d9adbee508de20cc87f`: **108 recorded stages /12 application POST attempts**, including refusals/retries, with all four acquired Auth sessions closed. Actual signed-out reads/writes/exports return401, outsider/member write boundaries return403, changed retry and contributor review return409. Two immutable versions are saved, version2 has a distinct non-contributor review, exact prior exports remain equal, and the complete earlier M63–M68 baseline remains unchanged. Both versions remain synthetic/incomplete, without emissions totals, release eligibility or external assurance.

Provider deployment evidence saved by root shows `da0a050a-7ce0-42b3-acfc-900c8416b56b` successful on corrected source branch `codex/corporate-mvp`, exact reviewed commit `ecfedcbfb27b18a1ebebfd960314d68299cb4a28`, image `sha256:7e8d7e0549ba1ed66f7414f1f227c01bba77a51a43e0120fba8a58ea3aa44799`. These are root-executed observations independently inspected; this reviewer did not operate the provider.

**PASS for the scoped deployed Auth/API security exercise.** Root reports an actual deployment restart; the subsequent exact readback remains pending at this stage. New hosted visual/browser verification remains pending because the Chrome control extension is unavailable; no browser interaction or visual sign-off is claimed by this reviewer. Publication should retain that outstanding product acceptance item rather than relabeling API checks as visual verification.

Independently compared post-exercise `.superpowers/m72-hosted-after.json`, SHA-256 `9b6fe90da9c042789c0ceedf550dfa175ee978e33b60f32329cdf174d5d17ada`, with the pre-migration backup. Schema15 has67 tables /176 rows. All165 original row hashes/multiplicity remain; the only added old-table row is receipt15. New corporate tables contain one head, two versions, one review, three request records and three audit records. Roles, memberships and default ACLs are still identical. This confirms expected durable changes and preservation after the real hosted exercise rather than only at migration commit.

## Final scoped assessment

**PASS — application recovery, migration preservation, hosted Auth/API security and restart persistence.** The final [hosted journey](m72-hosted-journey.json), SHA-256 `091ec754a83735f82b91e8eec9fd23a1eb5d476c7493d1f9510bc139e8a8f2ea`, preserves baseline49 stages, exercise108 stages and post-restart revisit57 stages. Revisit made zero application POSTs, closed all four acquired sessions and reached `restart_exact_saved_register`. This reviewer additionally compared the exercise/revisit corporate register objects, export hash/length maps and legacy record/download maps: all equal. The root executed the actual provider restart and authenticated HTTP requests; this reviewer independently checked the receipts and earlier local recovery/runtime behavior. No fresh browser action was executed by this reviewer.

F01 is resolved operationally by explicit maintenance and schema15 fix-forward; the incompatible schema14 image is not used after migration. F02 is repaired and independently retested. No remaining defect was observed within these scoped controls. The final operating candidate is bound to the15-file `M72-OPERATORS` snapshot above; unchanged M71 application code is bound to its previously reviewed and deployed commit.

**Outstanding product acceptance:** fresh hosted visual/browser verification and board feedback. Root reports Chrome control paused while an extension panel is open. API success is not visual success; earlier local M71 browser evidence remains historical. Subsequent publication-triggered automatic deployments must be inspected and revisited on the final active image before being reported as verified.

Reviewable evidence copies are [backup](m72-backup-receipt.json), [migration gate](m72-gate.json), [migration](m72-migration-receipt.json), [post-exercise inventory](m72-hosted-after.json), [deployment](m72-railway-deployments.json), [restart observation](m72-railway-restart.json), [independent restore](m72-security-hosted-restore.json) and [independent runtime reconstruction](m72-security-restored-read.json). Original local receipt references and stage-specific hashes remain above as historical evidence. Provider Auth/session recovery, provider storage/configuration, role passwords and off-device DPAPI recovery remain unverified/excluded; no customer readiness, full corporate inventory, legal compliance or external assurance claim is made.
