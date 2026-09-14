# M56 product brief — deterministic location-based result from reviewed bill evidence

**Status:** Product brief for a bounded local development milestone  
**Owner:** CPO, reporting to CEO  
**Outcome:** Turn one exact reviewed M55 bill version into one reproducible location-based Scope 2 draft calculation inside the M54 tenant boundary

## User and job

A signed-in owner or administrator of **Synthetic Acme, Inc.** has already completed the accepted M55 workflow. Evidence version 2 for **Synthetic California office** is reviewed, corrected, and linked to the existing 2023 operational-control draft as `12.346000 MWh` for January 1–31, 2023.

The user needs to calculate a traceable **draft location-based Scope 2 result** without re-entering the bill, choosing a factor, inferring geography, or invoking a model. They must be able to see exactly which evidence version, facility, boundary, method, factor and arithmetic produced the result and replay it later.

## Exact supported input and method

M56 accepts only this server-resolved lineage:

| Field | Required value |
| --- | --- |
| Company | Synthetic Acme, Inc. |
| Facility | Synthetic California office |
| Facility geography | United States / California / explicitly reviewed `CAMX` eGRID subregion |
| Reporting boundary | 2023 operational control, draft, version 1 |
| Evidence | M55 fixed synthetic PDF, original SHA-256 `0a97cd0976c03af0776214fc19bdc3d4f0c00e9c835f3e116574a6f375c8e135` |
| Evidence version | Reviewed M55 version 2; correction reason `Synthetic review exercise` |
| Service period | 2023-01-01 through 2023-01-31 |
| Activity | Grid-delivered purchased electricity consumed by the reporting company |
| Quantity | Exact decimal string `12.346000 MWh` |
| Method | M53 `scope2-location-based-egrid-subregion`, version `2023-r2-camx-v1` |
| Factor | EPA eGRID2023 revision 2, CAMX row 6, published total-output rate `195.0402888 kg CO2e/MWh` from `SRL23!AI6` |
| GWP disclosure | eGRID2023 technical-guide policy: 100-year AR5 without climate-carbon feedbacks; CO2 1, CH4 28, N2O 265 |

The system derives every calculation input from authorized M54/M55 records. The browser may identify the workspace and existing draft activity, but it may not submit a replacement quantity, unit, service period, facility, subregion, factor, method or result.

M53’s factor and method remain **development candidates**. Their bounded local behavior was independently accepted, but `release_eligible` remains false and no production factor or method release exists.

## Exact arithmetic and display

The calculator uses canonical decimal strings, Python `Decimal`, no intermediate rounding, and the M53 published-total authority:

```text
12.346000 MWh × 195.0402888 kg CO2e/MWh
= 2407.9674055248000 kg CO2e
```

The canonical unrounded result is `2407.9674055248 kg CO2e`. The ordinary display is **2,407.9674 kg CO2e**, using round-half-even at four decimal places.

The trace also preserves M53’s gas-column reconciliation:

| Trace item | Exact result |
| --- | ---: |
| CO2 mass and CO2e reference | `2399.4607843584 kg` |
| CH4 mass | `0.14000364 kg CH4` |
| CH4 CO2e reference | `3.92010192 kg CO2e` |
| N2O mass | `0.0168004368 kg N2O` |
| N2O CO2e reference | `4.452115752 kg CO2e` |
| Sum of published rounded gas columns | `2407.8330020304 kg CO2e` |
| Published-total minus component sum | `0.1344034944 kg CO2e` |

The product states that the published `AI6` total is authoritative for this method. It shows the component difference as a source-rounding reconciliation and never silently substitutes the resummed components for the total.

## Observable user journey

1. The authorized user revisits the M55 bill. The page shows **Reviewed version 2**, `12.346000 MWh`, January 2023, the selected California facility, and **Draft evidence — no emissions calculated**.
2. The user chooses **Create location-based draft result**. A pre-calculation summary names the exact evidence version, 2023 boundary, explicit CAMX subregion, M53 method and unreleased development factor. No editable calculation input is shown.
3. The server reauthorizes the user, loads the evidence link and all referenced records within one tenant scope, verifies that version 2 is reviewed and current for this link, and validates the facility/boundary/period relationship.
4. The deterministic engine calculates once and stores one immutable draft calculation record. The visible status becomes **Draft location-based result — development method and factor not released**.
5. The user sees `2,407.9674 kg CO2e`, the unrounded total, quantity and unit, service period, facility/CAMX, factor cell and data year, method/GWP identity, evidence version, and calculation timestamp.
6. **How this was calculated** expands the arithmetic, gas references, rounding reconciliation and all source/method/input/result hashes.
7. **Replay record** reauthorizes and deterministically recomputes the record. Exact byte-equivalent input and result produce **Replay matched**. Drift or tampering clears no stored history and produces a refusal instead of a replacement result.
8. Revisiting the workspace shows the same immutable calculation and its link to the same draft activity. Repeating the create command is idempotent and returns the existing calculation ID.

## Role behavior

- **Owner and administrator:** may create the calculation from the exact reviewed draft activity, view it, replay it and download its bounded record.
- **Member:** may view the authorized bill lineage and calculation but may not create, replace, relink or otherwise mutate a calculation.
- **Signed-out, foreign, unknown or revoked identity:** receives the existing M54/M55 safe behavior. Foreign and unknown identifiers are externally indistinguishable and disclose no calculation, evidence, factor-selection or timing metadata.

The browser cannot assert a role. Authorization and company scope come from the authenticated database request, forced RLS and composite tenant relationships.

## Lineage and replay contract

The immutable calculation record must bind:

- company, facility, reporting boundary ID and boundary version;
- M55 original digest, evidence ID, exact version-2 ID and canonical version payload hash;
- January 2023 service period, correction lineage and exact `12.346000 MWh` draft activity;
- explicit US / CA / CAMX geography already stored for the authorized facility;
- method ID/version/implementation hash;
- factor ID/version/data year, workbook hash, candidate hash, sheet/cell locators and `release_eligible: false`;
- GWP policy ID/version/hash;
- canonical input snapshot hash, exact trace, total, rounding policy and result payload hash;
- actor, creation time, status `draft`, and an append-only calculation-created audit event.

The calculation record is never updated in place. Its input snapshot is canonical and tenant-scoped. Replay accepts only the complete stored/exported M56 record, verifies its result hash, reloads the referenced authorized lineage, recomputes with the pinned implementation and requires full equality. An altered record, changed implementation/factor/method, missing evidence version or unauthorized lineage returns a finite refusal. Replay never “upgrades” a historical record to new bytes.

## Required refusal behavior

| Condition | User-visible outcome | Product requirement |
| --- | --- | --- |
| Evidence version 1 or any unreviewed version | **Review the bill before calculating** | No calculation row, audit event or cached result is created. |
| Requested version is not the exact version pinned by the draft activity | **The evidence link changed; review the current version** | Treat as stale; do not calculate from a newer or older version implicitly. |
| Quantity/unit differs from `12.346000 MWh` | **Reviewed activity does not match this demo** | Refuse; no browser override or hidden conversion. |
| Facility lacks explicit CAMX or belongs to another company | **Calculation context is unavailable** | Never infer CAMX from California; foreign records behave as absent. |
| Service dates are missing, inverted, outside 2023, or outside the linked boundary | **Bill period is outside this draft boundary** | No prorating, annualization, date repair or factor substitution. |
| Boundary is foreign, another version, excludes the facility, or is no longer draft | **Draft boundary is unavailable** | No calculation and no relationship metadata leaked. |
| Method/factor/GWP/source or implementation hash differs | **Calculation method changed; this record was not run** | Fail closed. Do not select “latest” or another subregion automatically. |
| Duplicate create command | Existing calculation shown | Exactly one calculation and audit event; idempotent response. |
| Concurrent create commands | One canonical result | Commands converge on the same immutable calculation ID. |
| Tampered replay record or stale lineage | **Replay could not be verified** | Preserve original; return no replacement total. |
| Calculator busy, timeout or malformed engine output | **No result produced** | Clear any transient displayed total, persist no successful record, and expose no internal error detail. |
| Member attempts create/replay mutation | **You can view this draft but cannot change it** | No write, job or audit event. |
| Foreign/unknown calculation or evidence ID | **Draft result not found** | Same status/shape and no timing/content oracle. |
| Signed-out request | **Authentication required** | No calculation, cache, job or audit event. |

## Accessible UI acceptance

- The bill-to-result relationship is expressed with semantic headings and plain text, not color alone: **Reviewed bill**, **Draft activity**, **Draft location-based result**, **Development factor not released**.
- All controls work by keyboard with visible focus. The create action receives a clear accessible name; pending state disables repeat submission and announces progress once.
- Result and refusal changes use appropriate polite status or alert semantics. A refusal removes any transient prior total from the current view.
- The result summary reads coherently in screen-reader order: value, unit, method, development status and evidence version. `CO2e` has a useful accessible expansion or nearby definition.
- The trace uses semantic lists/tables, meaningful row headings and full text for hashes through accessible labels. Shortened visual hashes retain the complete value for assistive technology.
- The flow remains usable at 200% zoom and a 390-pixel viewport without horizontal page overflow. Long hashes and source locators wrap or scroll inside their own bounded region.
- Focus moves to the result heading after success and to an error summary after refusal; returning to the action remains predictable.

## Observable acceptance criteria

M56 passes only if independent product, accounting and tenant-security reviewers can reproduce all of the following against one exact frozen candidate:

1. From the accepted M55 version-2 draft link, create exactly one immutable calculation with the exact lineage above.
2. Independently recompute the decimal arithmetic and obtain unrounded `2407.9674055248`, displayed `2,407.9674 kg CO2e`, component sum `2407.8330020304` and reconciliation delta `0.1344034944`.
3. Resolve every factor locator and hash to M53’s pinned eGRID2023 revision-2 CAMX development candidate and preserve the published-total authority and AR5 disclosure.
4. Show that the browser sends only opaque workspace/draft identifiers and cannot override quantity, dates, facility, subregion, method, factor or result.
5. Revisit, download and replay the exact record with full equality; reject mutations to any evidence, lineage, arithmetic, factor, method, implementation, classification or hash field.
6. Demonstrate owner/admin create and view, member view-only, and signed-out/foreign/unknown/revoked refusal across API and database boundaries.
7. Demonstrate unreviewed, stale version, wrong quantity/unit, missing or foreign CAMX, outside-boundary period, excluded facility, non-draft boundary and method/factor drift all refuse before a result or success audit event exists.
8. Demonstrate duplicate and concurrent create requests converge on one calculation, one result hash and one audit event.
9. Verify calculation rows, audit events, cache/job inputs and read paths remain tenant-scoped; no foreign evidence or calculation data appears in logs or error responses.
10. Complete keyboard, screen-reader semantics, status/error announcement, 200% zoom and narrow-viewport checks for the exact ordinary browser journey.
11. Pass the relevant database, API, Python and web regression suites, type checks, lint/build and production-bundle exclusion. The M56 fixture, route, flags and result values must be absent or unreachable in production mode.

## Claims and exclusions

### What a passing demonstration proves

A pass proves that the exact reviewed M55 synthetic bill version can produce one deterministic, tenant-scoped, replayable **location-based draft** using the exact M53 CAMX development method. It proves the stated arithmetic, lineage, role behavior, refusal states and accessible local UI for those frozen bytes.

### What it does not prove

It does not establish that the factor or method is released for customer or production use. It does not prove compatibility with hosted Supabase, durable production jobs/storage, real authentication, arbitrary bills, customer data, other quantities, other periods, another facility/subregion, another factor edition or general inventory completeness. It is not assurance, verification, a filing, a legal conclusion or an approved inventory.

M56 produces **no market-based result** and makes no claim about contracts, RECs, supplier factors, residual mix or dual reporting. It performs no source expansion, OCR/model/provider call, factor lookup, customer-data processing, deployment, merge, publication or release.

**Stage 4 acceptance remains false. Release acceptance remains false.** A passing M56 closes only this local synthetic integration slice. Any next milestone requires a separate board decision after the working demonstration and independent review.

## Handoff

The CTO should implement the smallest tenant-scoped integration from the existing M55 draft activity to a quantity-enabled successor of the single M53 calculation authority, without creating a competing engine. Accounting QA must derive the expected values independently and challenge factor/method lineage. Data/security QA must challenge every cross-tenant and stale-lineage path. Product QA must reproduce the ordinary browser journey and refusal/accessibility criteria. The CEO alone updates shared operational state after evidence and review are complete.
