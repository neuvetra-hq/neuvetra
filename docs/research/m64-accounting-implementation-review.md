# M64 independent accounting implementation review

September 14, 2026. Reviewer: M64 accounting-validation execution, requested `gpt-6-astra/high`, observed runtime settings unknown. Scope: numerical implementation, strict input policy, persisted corrections and frontend accounting claims. The reviewer authored the prior accounting contract and expectations, but authored no M64 product implementation. This is independent implementation validation against the disclosed contract, not an independent review of the reviewer's own contract and not professional assurance.

**Disposition: accepted for bounded synthetic accounting implementation after one material repair.** Initial review failed because SQL arithmetic lost the final exact decimal digit for supported fractional inputs. The repaired bytes below pass the scoped recheck. Full integrated QA, actual hosted PostgreSQL/browser acceptance, publication and board demonstration remain separate gates.

## Reviewed artifact versions

| Artifact | SHA-256 |
| --- | --- |
| `packages/neuvetra-database/src/m64.ts` | `722ee2e14e4d37330a5f37a36feb07fca2f974a191a624ed6ddb183c9d6f3dda` |
| `packages/neuvetra-database/src/migrations/0010_manual_electricity_worksheet.sql` | `6aa262079d4b3b9867b62b723a155105c4ad46cfc0564556f802e5dc42c65890` |
| `apps/site-web/src/lib/m64-api.ts` | `ded475e119a841301670e3ba0fce222bf0021622e425edb95e7bbc795badb070` |
| `apps/site-web/src/components/ElectricityWorksheet.tsx` | `16f9f9be2464819eac7ab70a1d8db707b36d4376e65da74a6e98cb6650684b4a` |
| `packages/neuvetra-database/src/m64.test.ts` | `4b886c4c57b5c2d402ed885bbe9768ed76d94b87bb2f924b4d62fc0ddb0903e6` |
| `apps/site-api/src/workspace/m64-routes.test.ts` | `664a073d9888f9e73aaa9f66cc26dc55eca1e1356909c526ccdd5f2cbe1b9b3f` |

Unchanged accounting authority: `docs/research/m64-accounting-contract.md`, SHA-256 `168b89553fa980bf4e590b646576a103334e277c305146a4bd04a77b959b9030`; `evaluations/research-qa/m64-accounting-cases.json`, SHA-256 `35a4b359d8845c41c141785667123629f9e97ab95b841cae75d752dee20acab8`. Original evidence checks and candidate-normalization disclosure are recorded in that contract. No current-source or factor scope was added during implementation review.

## First-review finding retained

**M64-ACC-F01 — material, repaired: SQL division rounded the exact result before serialization.** Initial `scaled / 10000000000000` used PostgreSQL numeric division's selected result scale. Casting that already rounded quotient to `numeric(20,13)` could not restore the missing digit. For `62499.999 kWh`, direct execution returned `12190.017854959711`, then `12190.0178549597110` after the cast; the independent expected total is `12190.0178549597112`. For `999999.999 kWh`, the initial result was `195040.2886049597110`, versus exact `195040.2886049597112`.

The actual PGlite worksheet save/read boundary failed at the first affected input with `Stored worksheet could not be verified`, because the TypeScript BigInt recalculation correctly disagreed. The previous tests exercised both exact half-even ties, but those integer-kWh inputs did not expose this fractional precision failure. The version transaction refused rather than returning an incorrect verified subtotal.

CTO repaired the SQL implementation to multiply by exact decimal powers: `raw_quantity * 0.001` for MWh, `scaled * 0.0000000000001` for exact emissions, and `q * 0.0001` for display conversion. The display quotient now uses `div(scaled,1000000000)` with exact remainder and parity logic. An author regression was added to persist every independent quantity, beyond the original in-memory TypeScript check. This repair does not change the approved factor, input range or rounding policy.

The initial raw SQL diagnostic was executed in an isolated in-memory PGlite instance, using literal synthetic values. No hosted database, customer data or production migration was changed by the reviewer. The first attempted diagnostic could not resolve the PGlite package from the root directory; rerunning from its owning package succeeded. That tooling failure did not affect the reproduced application defect.

## Verification actually performed

The reviewer ran a standalone read-only-to-repository Bun script importing the delivered TypeScript calculator, validator, development database boundary and actual frontend decoder. It read the approved JSON expectations, without modifying them:

- All 18 approved quantity spellings matched canonical kWh/MWh, exact total and four-place display.
- All 30 rejected quantity examples refused through `validateWorksheetInput`, including an absent field, null, number, boolean, array, object, blank, trailing newline, Unicode digits, negative zero, excess precision and the first value above the ceiling.
- Eight unsupported context variants refused through the same validator: different month, different/missing subregion, MWh/lowercase unit, client `synthetic=false`, changed factor and an extra date field. These were direct validator checks, not eight independently exercised HTTP requests.
- The actual repaired SQL writer, server read/recalculation and actual frontend decoder passed 15 successive distinct canonical quantities. They included explicit zero, minimum positive quantity, `12345.678`, `62499.999`, both half-even ties, `62500.001`, `999999.999` and the ceiling. The three adjacent equivalent spellings correctly refused as no-op corrections. Each saved result remained unreviewed, incomplete and release-ineligible.
- `bun test packages/neuvetra-database/src/m64.test.ts apps/site-api/src/workspace/m64-routes.test.ts` passed: **4 tests, 90 assertions, 0 failures**. These additionally exercised immutable history, a distinct manager's exact-version review, no self-review, prior-review preservation after correction, correction to zero, stale-base refusal, canonical duplicate convergence and bounded HTTP input/role behavior.

The runtime was Bun 1.3.12. All database execution by this reviewer used local PGlite with actual application migrations and public application writer/read methods. It does not substitute for the separate QA agent's PostgreSQL or hosted-browser checks. No renderer/browser was operated by this accounting reviewer; presentation findings below come from source review and real decoder execution.

## Numerical and presentation disposition

The SQL/TypeScript pair is accepted as an exact equivalent for this bounded worksheet: SQL numeric multiplication persists authoritative results and TypeScript BigInt independently verifies every read. Three-place kWh and six-place MWh are canonical strings. Full-string numeric validation includes an explicit non-digit/dot exclusion, preventing the JavaScript terminal-newline anchor exception. Zero is represented as exact `0` and display `0.0000`; missingness never enters the calculator as zero. No-op canonical corrections refuse and changed quantities do not inherit historical reviews.

The unchanged method/factor/version, source workbook/cell, factor candidate digest, GWP digest, reviewed legacy engine digest and M64 policy/profile are bound in method metadata and result hashes. The legacy engine digest denotes the reviewed authority; the new worksheet actually uses the reviewed SQL/BigInt arithmetic. This review's artifact hashes identify those new implementations. M64 returns a total-only worksheet; it does not expose gas component totals or substitute a component sum for AI6.

Frontend source displays server-returned canonical quantity, converted MWh, exact subtotal and rounded subtotal as strings. It states annual 2023 factor applied to January consumption, one fictional facility, operational control/location-based Scope 2, incomplete other months/sources, synthetic manual input without bill evidence, candidate/unreleased status and no assurance. The exact details label half-even rounding and distinguish decimal precision from measurement certainty. While editing, the previous result is explicitly labeled as saved and unsaved edits are not calculated.

Review requires a different manager and the exact current version; the UI states historical acceptance remains bounded/incomplete/unreleased. Scope 1/3, market-based electricity and filing/assurance are not silently included. Source inspection found no accounting-claim blocker in the reviewed frontend bytes.

## Remaining limits and handoff

No open material numerical finding remains for these reviewed bytes. Any change to a bound artifact requires targeted re-review. Broad security, real PostgreSQL authorization/concurrency, hosted persistence, actual browser rendering, M63 report/review regression, deployment and publication are not certified here. Existing synthetic-only, incomplete, candidate-factor, unreleased and no-assurance qualifications remain mandatory. Independent QA was informed of the original failure and the repair so the first-review defect remains in the operational record.
