# M74 independent security and recovery review

2026-09-15. Reviewer `/root/m74_cto`; sponsor/root is QA coordinator. Critical Astra/high was requested; observed model/effort is unknown. This reused reviewer authored the M74 technical contract, earlier frontend QA and hosted-helper QA, but authored **no backend, migration, operator, frontend implementation or CSS** under this review. No worker was spawned.

## Verdict

**Pass for the reviewed bounded application security and recovery controls after S01 repair.** Independent native and operator-gate tests: **11 passed, 0 failed, 120 assertions**, 10.89 seconds. Strict TypeScript checking of all four new review/test scripts passed. Local application restores, replay and exact downloads were actually exercised; the hosted archive was reviewed through its separate local restored database. This is not authorization or evidence of hosted migration, deployment, customer factor release, complete Scope 1, provider recovery or external assurance.

## Finding and repair

**S01, P2, repaired:** `validateUpgradeGate` accepted a restore inventory containing an extra per-row digest while table count and aggregate digest remained unchanged. Its inherited exact `sameRows` comparison only checked count and aggregate digest. Independent mutation10 demonstrated acceptance of an internally inconsistent recovery receipt. The source baseline was separately rechecked before apply, so this did not demonstrate unauthorized application mutation.

Root repaired the M74 gate locally: every table requires a nonnegative integer count and a row-hash array of that exact length; backup and restore table inventories must match canonically. The unchanged original failing mutation and all 50 independent gate assertions pass. M73's pinned helper was not edited. Reviewed repair: `tools/staging/m74-upgrade.ts` SHA-256 `7f5ec5a6d260687b9af6b84a2f6d1430e50c162ba0dd72bfc7f826ce9fdee5da`; author tests `e4d8ff37402dbd0835adbfb3f622b9ba29fc2a2fcba99c16f6c92586752f521e`.

## Independent native security evidence

The reviewer cloned read-only `m74_author_backend_20260915c` into new `m74_security_native_*` databases. Final receipt: `.tmp/m74_security_native_1789510917893-receipt.json`. No source database, existing role, Git state, credentials or host was changed. All adversarial transactions rolled back; complete source and clone application inventories remained exact.

- All nine mobile tables denied anonymous and other-tenant rows; the runtime role could not issue direct table deletes, including a no-row delete.
- Direct save RPC refused missing identity, other-tenant identity and ordinary-member identity; an admitted manager's forged numerical result was refused by deterministic SQL validation.
- Actual membership removal and staging-access revocation immediately denied database reads/locks inside their test transactions.
- Corrections refused replacement of immutable vehicle identity and reuse of another stream's fuel or mileage evidence.
- A wrong numerical total, with recomputed result/content/version/export/audit hashes, failed native readback and Python replay. This exercises more than checking stale digests.
- Normal reservation deletion failed immutability enforcement. Privileged test-only reservation removal and mileage-text corruption each failed readback; both were rolled back.

This independent suite does not claim to repeat every author concurrency/capacity case. Author race results remain separately identified evidence.

## Independent application recovery

The new `m74-security-recovery.ts` independently reads actual source/report/statement/export/calculation bytes, hashes UTF-8/binary contents using a separate implementation, explicitly includes null calculations, reconstructs metadata entries, and compares the result against the operator manifest. It calls restricted native application readers and real Python replay, then downloads every retained method artifact and every earlier electricity source/report through application readers. It compares complete application inventory before and after these reads.

| Independent restore | Content entries | Byte checks | Gas versions replayed | Mobile versions replayed | Exact method downloads | Exact legacy downloads |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Synthetic schema16 | 164 | 328 | 11 | 0 | 23 | 115 |
| Populated synthetic schema17 | 181 | 362 | 11 | 2 | 31 | 115 |
| Actual hosted archive restored locally, schema16 | 29 | 58 | 2 | 0 | 6 | 14 |

Synthetic source databases `m74_ops_restore_1789509587655` and `m74_ops_restore17_1789509587655` were read-only. New restores are `m74_security_recovery16_1789510343379` and `m74_security_recovery17_1789510343379` on55463. Recovery source/restore content and application rows/catalogs match. The schema16 clone actually ran SQL17 inside a forced rollback, returned to the exact baseline, then committed SQL17 and refused a repeat apply. All original sources stayed unchanged. Evidence: `.tmp/m74-security-1789510343379/independent-result.json`.

The first migration attempt correctly refused the recovered template's public-schema usage grants. The application archive deliberately excludes provider/public configuration. Only the new test clone received `REVOKE ALL ON SCHEMA public FROM PUBLIC, anon, authenticated` before the migration rehearsal. No cluster role changed. This adaptation is explicit and is not evidence that provider recovery is complete.

Actual hosted-archive review used **only** local `m74_security_hosted_20260915c1` on55472. All application table rows, per-row hashes, catalog entries, roles/membership and dependency evidence matched backup and actual restored state. Source provider public default ACLs were excluded as documented; neither side contained global/application default ACLs. Restricted no-claim access was denied; reads and downloads caused no mutation.

Independent gate receipts:

- `.superpowers/m74-security-hosted-recovery-candidate1.json`, SHA-256 `21cb39a60aec8a2b87c0c8805c277acdc834a84fe092532ac888cbf1ba0e834e`.
- `.tmp/m74-security-1789510343379/independent-forward17-candidate1.json`, SHA-256 `36f1c0f3d5ec44f353139bc132576747a5f25230cc6c0173a0b2a62a66acf2dd`.

Both bind reviewer `/root/m74_cto`. The forward receipt retains the original observation timestamp/hash. It covers populated schema17 with both statement types, calculation, captured reports and preserved gas/legacy artifacts. The reviewer did not decrypt any private archive or connect to the host.

## Operator gate and recovery limits

Independent tests challenge exact 15-minute maintenance and four-hour backup boundaries, schema16/17 state and migration pin, recovery receipt binding, strict boolean observation fields, missing recovery identity fields, content omissions and duplicate entries, absent fuel/mileage/calculation/report forward evidence, chronology, old function changes, unsafe permissions and row-hash consistency. They use a self-contained synthetic fixture and do not manufacture hosted approval.

Review verified the durable exclusive started receipt before mutation, state recheck under locks, exact additive tables, and explicit uncertain-commit/do-not-reapply outcomes. Actual hosted execution and uncertainty following a real network loss remain root/operator responsibilities. Auth UUID stubs are dependencies, not recovered accounts; sessions/passwords/provider configuration/off-device recovery are excluded.

Root's actual same-Windows-identity synthetic DPAPI rehearsal is separately observed evidence: `.tmp/m74-ops-1789509920941/author-result.json` SHA-256 `ea32736572da20021e99559841779e125d833a2d4a1a1e47436817fabaf65392`; `dpapi-restore16.json` SHA-256 `aa7e0043fdab32004d882c8d9874eb9991dba3288c53879cdaa467983da890e3`. The reviewer inspected these receipts; the reviewer did not execute that DPAPI roundtrip. The earlier restricted-identity failure remains recorded.

## Supplemental visual and print review

Root separately requested inspection of the narrow-screen CSS repair. `apps/site-web/src/staging.css` SHA-256 `128338ac9896f84cacfb0cf9768f9b3ef1a2ac23e8025803bb771e6b656a673d` scopes width/wrapping/grid changes to `.mobile-diesel`. Independent image inspection found controls inside the viewport, readable vehicle identity and subtotal, wrapped factor JSON and contained gas-table cells. No new visual defect was found in these two captures; this is screenshot inspection, not a reviewer-operated browser journey.

- `m74-browser-vehicle-narrow-fixed.png`: `98f61e65542a6bfe2437138c637db50fbce99e201b04d68e6f155342de971045`.
- `m74-browser-trace-narrow.png`: `ef5f28383003c433b5b25a7cc14a7734f39d65d51d32f897a8b63864c686a265`.

**M74-P09 bounded entry acceptance:** root invoked the actual report Print control; the board directly answered yes that the native print window appeared. Native screenshot capture timed out/reset. No physical printing, PDF output, pagination or print-layout verification is claimed.

## Reproduction, failures and exact byte binding

Run `bun run evaluations/research-qa/m74-security-recovery.ts` for new synthetic restore/migration clones. Run `M74_SECURITY_NATIVE=enabled bun test --timeout 120000 evaluations/research-qa/m74-security-native.test.ts evaluations/research-qa/m74-security-operator-gate.test.ts` for native/gate checks. The hosted recovery script is intentionally bound to the coordinator's exact local restore and exclusive receipt path; a new archive requires a separately bound review.

Initial native test runs hung in Bun's promise `.rejects` assertion around driver transactions; explicit caught-error assertions resolved the harness behavior, with no product changes. Initial strict TypeScript checking found an unknown-type export string in the reviewer script; an explicit type narrowed it. The public-schema restore refusal and S01 first failing gate are preserved above. Failed clones are retained, not dropped.

Exact current reviewed hashes are in `m74-security-reviewed-files.json`. Core pins: migration `4486f83e2f2f6e5cb8db5991575a74f540b891eefd1ff65317801545c5b6c071`; database reader `494eb69227a8d18ac5068fcc5225daab1edbc88979fa3694f3f89981898bced9`; Python engine `1dc0bb7249d91e854004a8cadd34068be3fc03ecdd6e10b4cf297d375d7f52a6`. Subsequent implementation changes require scoped re-review; this report does not approve unseen later bytes.
