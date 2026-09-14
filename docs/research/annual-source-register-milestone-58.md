# M58 — annual location-based electricity register

Date: September 13, 2026

## Outcome

M58 completes one bounded, local and fictional 2023 electricity workflow for the existing Neuvetra company workspace. It carries the approved M57 January line into an immutable twelve-period register, resolves the remaining periods without treating missing or excluded activity as zero, seals inventory version 2, and records a second-manager review.

The final register contains ten reported periods, one estimated period and one excluded period:

- Reported: `126.788000 MWh` and `24,728.7681 kg CO2e` displayed.
- Estimated November: `12.493000 MWh` and `2,436.6383 kg CO2e`, calculated as the exact mean of September and October.
- Excluded December: no quantity and no emissions because operational control ended November 30, 2023.
- Included annual draft subtotal: `139.281000 MWh` and `27,165.4065 kg CO2e` displayed.

The product keeps the annual register's period resolution separate from overall inventory completeness. All twelve expected periods are resolved, while the adjacent inventory status remains **incomplete** and release eligibility remains false.

## Controls demonstrated

The initial register is version 1: January is reported from the exact M56 calculation result and February through December are explicitly missing. Completion creates immutable register version 2 with pinned evidence locators, a disclosed November estimation formula and a December exclusion reason. Inventory version 2 binds the exact M57 predecessor, boundary, facility, register identifier and register snapshot.

Owner and administrator mutations are permitted; a member can read but cannot mutate; another tenant receives no record. Forced row-level security covers annual registers, inventories, decisions and audit history. The submitter cannot review their own inventory. Repeated and concurrent create, complete and seal commands converge on one logical result, while changed lineage, sparse and non-sparse payload tampering, direct authenticated writes and historical mutation refuse.

The browser boundary validates exact accounting values and every lineage identifier supplied by the request. Database timestamps are normalized to the browser's ISO contract, and canonical JSON property ordering cannot alter validation.

## Verification

The complete automated suite passes across the deterministic calculation, database, API and browser layers: database 21 tests / 186 assertions, API 625 / 5,399, browser 63 / 253 and Python 12. Focused tests cover exact integer arithmetic, fixed source bytes, row-level security, immutable history, full-payload validation, idempotent concurrency, two-person review, browser lineage binding and production-bundle exclusion. The live local browser journey passed from fictional bill intake through the independent M58 decision and visibly demonstrated the final counts, totals, exception treatment and incomplete status.

Independent QA `f39e6a9513823ca68b85ee5665cc031f71b3e788991787f837aa38369c9c8491` is recorded in [milestone58-annual-register-10.json](../../evaluations/research-qa/milestone58-annual-register-10.json). The review binds the exact implementation files and keeps release acceptance false.

## Limits

M58 uses fictional local data and PGlite. It does not establish hosted PostgreSQL or Supabase behavior, customer-data authorization, production authentication, market-based Scope 2, Scope 1, Scope 3, released factors or methods, filing readiness, assurance, deployment or release.

## CEO recommendation

M59 should create a deterministic inventory evidence pack from the sealed M58 result: the inventory snapshot, source-register versions, period evidence and exception reasons, calculation lineage, review decisions and integrity hashes in one reproducible export. Acceptance should require replay verification and an independent reviewer to reconstruct the displayed subtotal from the package. The evidence pack remains local and synthetic; publication, filing, assurance, hosted persistence and production release stay separate gates.
