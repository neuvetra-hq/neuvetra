# M56 — reviewed synthetic bill to deterministic draft calculation

**Date:** 2026-09-13  
**Status:** complete, independently accepted and published to the existing PR at `8d3b2f0ac43d0c0175ef88e5d07675d9c59af348`
**Scope:** one fixed fictional January 2023 electricity bill in the local M54/M55 tenant workspace

## Demonstrated outcome

M56 connects the exact reviewed M55 version-2 bill to a new immutable location-based draft calculation. The authenticated server resolves the company, evidence, extraction, correction, activity, facility and reporting-boundary lineage. The browser sends an idempotency key only when creating the result; it cannot submit a quantity, unit, period, geography, method, factor or result. Replay sends the complete exported immutable record plus a new idempotency key.

The separate M56 Python adapter leaves the accepted M53 calculator byte-for-byte unchanged. It first runs and verifies M53's one-MWh authority, independently converts `12346.000 kWh` to the linked `12.346000 MWh`, then uses Python `Decimal` and the same EPA eGRID2023 revision-2 CAMX `SRL23!AI6` development factor.

```text
12346.000 kWh / 1000 = 12.346000 MWh
12.346000 MWh × 195.0402888 kg CO2e/MWh
= 2407.9674055248 kg CO2e
display = 2407.9674 kg CO2e (ROUND_HALF_EVEN, four places)
```

The result also preserves the independently reproduced component sum `2407.8330020304 kg CO2e` and the published-rate reconciliation delta `0.1344034944 kg CO2e`. The published AI6 total remains authoritative.

## Integrity and tenant boundary

- Accepted M53 implementation SHA-256 remains `4ad28f3877d13f238bbbf7e8bfb1fc6241922b9def73712ec1b02fd80b51b82c`.
- M56 adapter SHA-256 is `ae03b9146060187c63b6f3b8a253fbd61cd4f97a9aa97905481904eca45b061e`.
- The adapter verifies the M53 authority record SHA-256 `9c63b2cb12fa2708f35d394e537ca5803e27f91c4647f33376abf75a6fb72b91` before scaling.
- The persisted canonical result binds dynamic tenant and row IDs, extraction/parser, prior and reviewed bill versions, a canonical version-payload hash, correction, January service period, draft activity and boundary, facility/CAMX, factor/source/GWP hashes, both implementation hashes, exact trace, input/result hashes, actor and creation time.
- The calculation and audit tables use composite tenant foreign keys, forced RLS and read-only member policies. Authenticated database clients have no direct writer grant; the trusted local store calls the narrow fixed-search-path security-definer function after server validation.
- The database transaction locks and rechecks the complete linked lineage. Direct authenticated mutations are denied. Owner and administrator creation succeeds, a member remains view-only, and foreign or signed-out access refuses without exposing the row.
- Identical concurrent commands share one in-flight calculation and converge on one database result. Stored idempotency keys and operation fingerprints enforce same-operation reuse and conflicting-operation refusal. Database uniqueness guarantees one result per activity/method profile and one creation audit event. Replay submits the complete exported record, reauthorizes, checks exact equality and recomputes the same canonical result; mutations refuse instead of replacing history.

## Product proof

The local browser journey completed from workspace creation through fixed-PDF intake, explicit facility review, immutable version-2 correction, activity link, calculation, expanded lineage and replay. The page visibly showed:

- `Draft calculation · development factor · not released`;
- `2,407.9674 kg CO2e`;
- reviewed activity `12.346000 MWh`;
- CAMX and 2023 factor data;
- bill version 2 and January 2023;
- eGRID2023 revision 2 `SRL23!AI6`, exact unrounded total, component reconciliation, and full input/result hashes;
- `Replay matched the same authorized lineage and exact deterministic result.`

At a 390-pixel viewport, `innerWidth` and document `scrollWidth` both measured `390`, the result remained present, and the browser console had no warnings or errors. The development page and API used loopback only. Temporary listeners were closed after review.

## Verification

- Independent repair review `85fc46d5a63531e09b40351e210929ad3728911fad1a8c8ac8f93a87bf39b2a7` passed all 20 exact candidate bindings with no open finding. The earlier failing review is retained as the repair record.
- Python: existing M53 `4/4`; M56 adapter `2/2`.
- Focused API: `21` tests / `85` assertions; focused web: `8` / `33`.
- API: `625` tests passed with `5,362` assertions, including unreviewed, override, member, concurrency, exact-record replay mutation, bounded execution failure and foreign-access paths.
- Web: `57` tests passed with `207` assertions, including strict nested M56 response decoding and idempotency-only create input.
- Database: `19` tests passed with `120` assertions; all nine M55/M56 evidence, derived, calculation and audit tables have forced RLS, deny direct authenticated mutation, and directly exercise the calculation writer, idempotency, audit, tenant and tamper rollback contracts.
- API, database and web TypeScript checks passed; web lint passed; production build passed; `git diff --check` passed.
- The ordinary production bundle excludes the M56 result, bill digest, fixed quantity, method/factor identifiers, feature flag and synthetic PDF. A stray `M56` byte sequence occurs only inside the pre-existing DankMono font asset and is not product code or content.

## Limits

This demonstrates one local PGlite-backed fictional bill only. It does not establish a released factor or method, hosted PostgreSQL/Supabase behavior, production authentication, customer-document processing, arbitrary quantities, other facilities/subregions/years, market-based Scope 2, complete inventories, filing or assurance. No model/provider request, credential, customer data, source expansion, deployment, merge or release occurred. Stage 4 and release acceptance remain false.

The accepted M56 implementation was published to the existing PR at `8d3b2f0ac43d0c0175ef88e5d07675d9c59af348`; this record reflects that publication. Stage 4, merge, deployment and release remain separate decisions.
