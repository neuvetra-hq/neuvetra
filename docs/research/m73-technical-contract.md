# M73 technical contract: one synthetic stationary natural-gas worksheet

Status: implementation proposal, frozen for coordinated authoring and independent review. M72 acceptance and the board's Scope 1 instruction supersede its saved feedback-wait pointer. Planning author: CTO function, actual context `/root/m72_ops` reused after `/root/m73_cto` dispatch failed with `agent thread limit reached`. Critical Astra/high was requested; observed settings are unknown. This author cannot independently approve this contract or its implementation.

## Decision and demonstrated reuse

Implement an annual 2025 synthetic stationary fossil-natural-gas worksheet, linked to an exact saved corporate coverage version. Keep M42's original fixed-asset validator and result contract unchanged. Add an M73 Python Decimal adapter with its own activity identity, policy and result contract, using the byte-pinned M42 factor/GWP definitions. No public calculation service, provider request, factor release, fuel expansion, therm/scf/LHV conversion, complete Scope 1 claim or corporate aggregation is part of this increment.

Inspected seams: `packages/neuvetra-database/src/m71-contract.ts`, `m71-validation.ts`, `m71.ts`, `workspace.ts`; `apps/site-api/src/workspace/m71-routes.ts`; `apps/site-web/src/components/CorporateCoverageRegister.tsx`; M42 `stationary_natural_gas.py` and its tests; `apps/site-api/src/staging/assets.ts`; `Dockerfile.staging`. M71 already permits an appended stationary source and matching source screening, forbids deletion/identity repurposing, and checks saved version/audit/request/export lineage. Its seed/UI currently creates electricity sources. Its fictional artifact supports corporate assertions and explicitly contains no activity measurements. M42 currently accepts only literal `Synthetic boiler 001`, `Owned stationary combustion source`, United States, MMBtu and calendar2025; this is not an arbitrary saved-source contract. M64 arithmetic is scaled-integer TypeScript and must not become the M73 numerical authority.

## 1. Register a source without rewriting history

Root adds **Add synthetic natural-gas source** to an editable M71 draft. Select an existing full-year California facility and enter its synthetic source name. Generate stable distinct source/screening UUIDs once for that draft; retain them across retries. Append:

- A source with that facility/entity, `domain: stationary_combustion`, exact full-year interval and empty `evidenceRefs`.
- Its one matching full-interval source coverage item: `disposition: missing`, `activityDataState: missing`, `evidenceState: missing`, `methodReadiness: candidate`, null quantity/unit/estimate, and empty evidence references.

Preserve all other entities, facilities, sources, screenings, requirements and IDs. Save through the existing M71 correction endpoint with the current expected version ID/hash, a correction reason and idempotency key. Do not silently save the draft or create a second detached source register. On a conflicting M71 head, reload and let the manager reconcile; never merge client snapshots automatically.

The manager must explicitly resolve the selected entity's boundary using existing M71 controls: full-year `included_activity`, nonempty rationale and the supported pinned fictional boundary reference. Current M72 parent `included_activity` with empty reason/references is insufficient for an M73 calculation. The supplied reference is evidence of a **fictional boundary assertion**, never a utility statement. For a subsidiary, each applicable relationship in its path must be full-year, wholly owned (`100`) with nonempty control facts and supported fictional references; absent controls block that source. The initial demonstration may use the parent facility to avoid inventing subsidiary control evidence. No unresolved company-wide gap is silently resolved by selecting an eligible source.

## 2. Eligibility and version pinning

New saves/corrections must bind the **current saved M71 head** by ID and SHA-256. Require the exact supported M71 profile, calendar2025, `operational_control`, a selected `stationary_combustion` source with a non-null existing facility, consistent entity IDs, US/CA entity and facility, full-year source/facility/entity intervals, and the boundary basis above. The input also explicitly declares fossil `Natural Gas`, stationary combustion and `HHV`; a source name alone does not establish its fuel. Reject excluded/not-applicable/unassessed boundaries, estimates, partial-year allocation, other fuels, other heat bases and other units.

Retain the complete validated M71 version export bytes/hash and selected entity/facility/source/boundary IDs as immutable version lineage. Reconstruct them from the authoritative M71 version in the save transaction; never accept client labels, claimed boundary contents or findings as authority. Use the current head only for new saves. Earlier M73 versions/reports remain readable against their pinned M71 version after a coverage correction. Return a separate current-state finding `coverage_head_changed` and require relinking before a new M73 review/report; an old report remains downloadable without alteration. A correction may relink the same stable source to a newer coverage version but cannot change its source ID. Another eligible registered source creates a separate bounded stream. A newer coverage version is a pin, never a new physical source or a new counted stream. Company/facility labels are display metadata, not authorization or identity; no literal boiler/company label is required.

## 3. Shared public types

Backend owns these definitions in `packages/neuvetra-database/src/m73-contract.ts`; frontend imports/strictly decodes this contract. UUID and SHA-256 fields use the existing lowercase canonical formats. Exact object keys are mandatory; nullable fields remain explicit. Objects are canonicalized recursively with ASCII field names sorted, arrays in declared order, UTF-8 without BOM, and no JSON property-order dependence.

```ts
type M73Period = { start: "2025-01-01"; endExclusive: "2026-01-01" };
type M73BindingInput = {
  coverageVersionId: string; coverageVersionSha256: string;
  entityId: string; facilityId: string; sourceId: string; boundaryDecisionId: string;
};
type M73StatementInput = {
  issuer: string; reference: string; meterLabel: string;
  statedQuantityMmbtu: string; description: string;
  consumptionBasis: "dedicated_meter_consumed_no_adjustments";
};
type M73SaveInput = {
  profile: "synthetic-stationary-natural-gas-v1";
  binding: M73BindingInput; period: M73Period;
  fuel: "Natural Gas"; heatBasis: "HHV"; unit: "MMBtu";
  quantityMmbtu: string | null; statement: M73StatementInput | null;
  manualConfirmation: boolean;
  discrepancyReason: string | null; zeroReason: string | null;
  expectedVersionId: string | null; expectedVersionSha256: string | null;
  correctionReason: string | null; idempotencyKey: string;
};
type M73ReviewInput = {
  versionId: string; expectedVersionSha256: string;
  decision: "accepted_bounded_internal" | "changes_requested";
  note: string; acknowledgedLimitations: string[]; idempotencyKey: string;
};
type M73ReportInput = {
  versionId: string; expectedVersionSha256: string;
  expectedDecisionId: string | null; expectedDecisionSha256: string | null;
  idempotencyKey: string;
};
```

Quantity contract, agreed with accounting: nonnegative decimal **string**, at most12integer and3fractional digits, maximum `999999999999.999`. Accept plain forms such as `1`, `1.0`, `1.000` and canonicalize to `1.000` without floating point. Reject signs, exponent, commas, leading zeros, NaN, Infinity, JSON numbers, excess scale and out-of-range inputs. Canonical stored/request fingerprints use fixed3dp. Missing quantity is null, never blank or zero.

Labels are trimmed NFC text with no controls/lone surrogates: issuer/reference/meterLabel max120characters, description max2000, reasons/review note max500. Reject raw HTML interpretation and escape all text when rendering. A positive entered quantity, retained compatible statement and explicit `manualConfirmation:true` permit candidate calculation. Numeric input without either statement or confirmation is refused with422. Missing quantity can be saved as an explicitly incomplete version with `calculation: null` and a finite finding; its statement may be null and confirmation may be false. Zero requires a nonempty zero reason and a retained statement explicitly stating zero; a positive statement paired with zero is refused. If positive entered and stated quantities differ, require a discrepancy reason and retain `activity_statement_discrepancy`; calculating a proposed entered value does not clear that finding or validate the estimate.

The response `M73Worksheet` has fixed profile, companyId, worksheetId/headVersionId (null when empty), `synthetic:true`, `scope1Completeness:"incomplete"`, `corporateCompleteness:"incomplete"`, `releaseEligible:false`, `assurance:"none"`, ordered versions and limitations. The root GET returns `M73Register` with companyId, ordered `worksheets:M73Worksheet[]`, eligible saved source choices and limitations. Each worksheet stream is uniquely keyed by companyId + stable M71 sourceId + fuel + full-year period; the coverage version is not part of that uniqueness key. Support at most3streams/company, with40versions total across its streams. No aggregation across sources or predecessor versions. Each `M73Version` contains immutable UUID/sequence/predecessor ID+hash, author/time (UTC milliseconds), contributorIds, correctionReason, normalized activity, authoritative binding snapshot, statement ID/hash/byte length/text or null, calculation or null, findings, input/content/version hashes, and a separately loaded review or null. Current coverage-head drift is an envelope finding and must not mutate the historic version hash. A root GET lists compact stream metadata and may load complete history only for the explicitly selected worksheet; do not multiply a40-version history response by every stream.

## 4. Retained synthetic statement and numerical authority

Implement a server-owned `m73StatementText` factory, version `m73-synthetic-gas-statement-v1`. It renders a fixed-order UTF-8 text document starting `SYNTHETIC — NOT A UTILITY BILL`. It includes company/entity/facility/source names **and stable IDs**, exact coverage version/hash, annual start/endExclusive, issuer, reference, meter label, description, `Natural Gas`, `HHV`, `MMBtu`, canonical stated quantity, and the explicit `dedicated_meter_consumed_no_adjustments` declaration. The user must confirm that this fictional statement represents this source's consumed energy; shared meters, duplicate supplier/distributor billing, feedstock/stock/loss adjustments or contradictory facts are outside this profile and refuse calculation. Persist those exact bytes with SHA-256 and length in the save transaction. Derive the locator `m73-statement:<statement UUID>:annual-activity`; do not accept caller-defined artifact IDs, hashes or locators. The factory must work for the selected saved source; no global boiler alias or fixed text may substitute for that identity. Fields are manually entered fictional assertions; there is no upload, OCR or authentic third-party-document claim.

The entered quantity remains separate from statement-stated quantity. The backend reconstructs factory bytes during every read/export/report verification; merely agreeing stored bytes with a stored digest is insufficient. An evidence-only correction creates a new immutable statement/version even when the arithmetic is unchanged. Do not add these statement references to M71, whose evidence allowlist has different semantics. Prevent duplicate effective use across streams: serialize company writes, derive a meter/year key from company + canonical issuer/meter identity + period, and refuse the same key on a different source. Also refuse identical retained reference/issuer/year assigned to a second source. The current head of a stream owns those keys; a corrected prior version remains history, not additional consumption. These exact-key controls cannot prove that differently worded real meters are distinct; manual dedicated-meter assertions remain synthetic and unresolved outside the supported profile.

Add `apps/site-api/src/calculation/m73_stationary_natural_gas.py` with its own strict calculate/replay-batch contract and method version `m73-development-v1`. Import the frozen M42 factor/GWP definitions, verify their reviewed file/content pins, and perform the same exact Decimal gas math at precision96. Accept the **actual M73 source/boundary/evidence binding**, not M42's literal boiler activity. Never call the old validator with fabricated literal asset identity. The new implementation and old dependency hashes are both pinned by the M73 policy; old M42 bytes/tests remain unchanged.

All arithmetic operands/results remain strings. Calculate CO2, CH4 and N2O masses and weighted CO2e separately; no intermediate rounding; final display is4dp ROUND_HALF_EVEN. Accounting's frozen source/factor/GWP/policy contract supplies exact pins and vectors; no runtime latest-factor lookup. Return a complete authority record with normalized input/hash, engine+dependency hashes, factor/GWP/source locators and classifications, gas-level exact strings, total unrounded/display/unit/rounding and payload hash. Missing data yields no authority result. Python generates the numerical result; TS/browser never calculate emissions. PostgreSQL exact NUMERIC checks may independently reject forged stored-function inputs, but may not choose factors, return alternative arithmetic or use native `round()` as a half-even substitute.

Use a new bounded private transport module, not the loopback M42 server. Invoke Python with an argument array/no shell, isolated minimal environment, pinned executable configured by the existing application runtime, drained bounded stdout/stderr, timeout2seconds and at most2concurrent processes. Calculate input max128KiB; batch replay of up to40compact numerical records max512KiB; output max512KiB. Strip credentials/customer fields from the child environment. No stderr payloads in API errors. A timeout/pin mismatch/malformed output yields503 and no committed write. Replay only the compact authority records in one batch; do not send repeated full M71 snapshots to Python.

## 5. Additive0016 and transaction boundary

Migration `0016_stationary_natural_gas.sql` adds seven tenant-scoped tables; no historical migration, receipt, M71 row or electricity table is rewritten:

| Table | Key and immutable content |
| --- | --- |
| `stationary_gas_heads` | worksheet UUID primary key + company; stable source UUID/fuel/year; head version UUID/revision; unique(company,source,fuel,period); current meter/year and statement-reference duplicate keys unique within company when non-null. |
| `stationary_gas_statements` | UUID + company; exact retained statement bytes/text, hash and length; immutable normalized factory input/binding. |
| `stationary_gas_versions` | UUID + company; worksheet; sequence; previous version; coverage version; optional statement; native quantity NUMERIC(15,3) nullable; canonical payload/hashes; actor/time. Composite tenant FKs and unique(company,worksheet,version). |
| `stationary_gas_reviews` | UUID + company; exact version; one decision/version; payload/hash/reviewer/time. |
| `stationary_gas_reports` | UUID + company; exact version and nullable decision; exact HTML/JSON snapshot bytes, hashes, lengths; creator/time. |
| `stationary_gas_requests` | company + idempotency UUID primary key; actor/kind/canonical fingerprint/result UUID. |
| `stationary_gas_audit` | UUID + company; immutable save/review/report event binding record hash, actor and time; unique company/kind/record. |

All seven use enabled and forced RLS. Runtime is nonowner, no BYPASSRLS/inheritance/direct writes; SELECT is constrained by current staging admission and company membership. Grant only the necessary `SECURITY DEFINER` save/review/report procedures, with fixed `pg_catalog,neuvetra,pg_temp` search path and all author/tenant/role checks inside them. Revoke public/authenticated execution and table writes. Immutable tables have update/delete refusal triggers. No actor, timestamp, calculated value, method/classification or companyId from a public request is authoritative.

Use the demonstrated lock order: staging admission row -> company membership row -> company row -> corporate coverage head -> gas worksheet head. Admission/member locks must conflict correctly with revocation updates, and company/head locks serialize source-link CAS with M71 corrections. All M73 writers use the same order; verify against actual M71 SQL before implementation. Never hold a Python process open outside the bounded authority call. After acquiring authority locks, verify M71 bytes/lineage and source eligibility, invoke Python, then save statement/version/request/audit atomically; no orphan statement if calculation, CAS or validation fails. Database-layer procedures repeat authorization, canonical contract, source pin, method pins and exact-result checks so a direct runtime SQL call cannot bypass the API.

`WorkspaceDatabase` exposes find/save/review/createReport/readReport methods for this resource; hosted overrides continue deriving current actor from Auth and enforce admission transactionally. Inject an M73 authority interface into those methods/service composition (calculate + replayBatch), rather than importing an HTTP server or creating a second connection/credential in the database package. Readback loads related version/statement/request/audit/review/report rows in one consistent transaction snapshot, reconstructs canonical content, compares native columns and predecessor chains, regenerates statement/report bytes and batch replays numerical authority records before returning data. Verification failure withholds the affected resource; never return a stored total with an integrity warning attached.

Idempotency fingerprint includes operation, verified actor, company, worksheet, normalized request and all expected version/decision pins. Exact replay returns the original immutable result, before evaluating stale-head CAS, **after** current admission/membership. Same key with a changed actor/kind/payload returns409. Concurrent first saves for one source create one head; concurrent corrections to one predecessor yield one successor, one conflict. Source and meter/reference uniqueness spans coverage versions, so adding a newer M71 head cannot create a second effective stream or evade duplicate controls. Request scope is shared across save/review/report to prevent cross-operation key reuse. A correction needs a reason and change in the full effective tuple (binding, entered quantity, all statement fields, manual confirmation, zero/discrepancy rationale, correction reason); explanation-only, evidence-only and same-source coverage-binding-only corrections are valid. Exactly identical tuple is a no-op conflict. Preserve previous contributors, including linked M71 version contributors, in a sorted cumulative set.

## 6. Review, reports and API seams

GET/list/version/export/report requires current authenticated membership. Save/correct/review/report creation requires a current manager. Reviewer must be outside the cumulative M73 and linked-boundary contributor set. Review requires exact current worksheet version and unchanged current M71 binding; reject incomplete calculation or stale linkage for acceptance. `changes_requested` may identify missing data. A discrepancy remains an open finding even after bounded acceptance. Every decision requires a note and the exact limitations acknowledgment; no decision establishes assurance or completeness.

Private routes under `/workspace/:companyId/stationary-natural-gas`:

| Route | Contract |
| --- | --- |
| GET root | Validated register listing the company's streams and eligible saved source choices, including empty state and eligibility/drift findings. |
| POST root | First save for the selected stable source; expected version fields/correction reason null; source/duplicate/capacity uniqueness enforced. |
| POST `/:worksheetId/versions` | Correction; exact predecessor ID/hash and nonempty reason. |
| GET `/:worksheetId/versions/:versionId` | Selected immutable version plus separate decision. |
| GET `/:worksheetId/versions/:versionId/calculation-export` | Exact retained canonical JSON; missing version still exports its incomplete record without fabricated arithmetic. |
| GET `/:worksheetId/statements/:statementId/download` | Exact retained UTF-8 statement bytes bound to a version in this tenant/stream. |
| POST `/:worksheetId/reviews` | M73ReviewInput. |
| POST `/:worksheetId/reports` | M73ReportInput; freezes selected version and the explicitly pinned current decision or null. |
| GET `/:worksheetId/reports/:reportId/download` | Exact retained standalone HTML bytes. |

Use same-origin POST enforcement, bearer-token verification, duplicate-key rejection, no-store responses, UUID validation and unauthorized-resource404 as M71. Finite failures:422 invalid/unsupported/incomplete contract;409 stale/linkage/idempotency/no-op conflict;403 current authenticated nonmanager/reviewer conflict;401 missing/invalid Auth;503 unverifiable stored data or authority unavailable. Route parsing must reject extra segments. GET never writes or generates a new report.

Reports contain source/facility/entity/boundary identity and pinned M71 version; entered versus stated quantity and exact synthetic statement; gas-level calculation trace and method/source/GWP pins; missing/zero/discrepancy explanations; immutable correction chain; exact review snapshot or prominent unreviewed state; and readable outstanding coverage gaps (mobile, process, fugitives, other sources/facilities/periods, Scope2 and all15Scope3 categories). Label the number **Synthetic stationary natural-gas source subtotal**. No reported corporate total, automatic M71 coverage edit or upstream allocation. The report renderer is deterministic and escapes all supplied strings. Persist its version and implementation pin; future renderer changes must retain the earlier verifier/renderer so old immutable bytes remain valid. Do not retroactively regenerate old reports with a newer template. Later review creates a new report snapshot; it never rewrites the old HTML or calculation export.

Limits:3source streams/company and40versions total/company; each canonical version/export max100KiB, retained report max128KiB; at most two report states/version (unreviewed and the one explicit decision); total retained response/export/report history capped3,800,000bytes, API envelope max4,000,000bytes. Check limits transactionally before creating any rows. Capacity refusals preserve all earlier download/history access. These are demonstration limits, not customer-scale architecture.

## 7. One writer per implementation workstream

| Owner | Allowed implementation paths |
| --- | --- |
| Backend specialist under CTO/root | NEW `packages/neuvetra-database/src/m73-contract.ts`, `m73-validation.ts`, `m73.ts`, migration0016; bounded exports/workspace methods/hosted readiness+manifest integration; NEW `apps/site-api/src/workspace/m73-routes.ts`, route/native tests; NEW calculation adapter/transport/tests; NEW deterministic `m73-report.ts` and synthetic statement factory with tests. Root approves exact shared-file touch list before dispatch. |
| Root UI/integration | `CorporateCoverageRegister.tsx` gas-source draft action; NEW frontend m73 decoder/tests/component; workspace navigation/styles; staging-server route/authority composition; asset pin list; Docker context/allowlists; operators, demo harness, documentation/shared records, Git/publication. Backend must not edit these. |
| Accounting specialist | Frozen accounting contract and independently derived fixture expectations, followed by review in a nonauthor arrangement. No production implementation. |
| Independent QA/security | Native/API/frontend/browser review artifacts and adversarial fixtures; cannot be the sole author of reviewed implementation. |

Before deployment, add the new adapter **and frozen M42 dependency** to the private staging image allowlist and verify pins at readiness. Ordinary public application builds remain unaffected. The dedicated native regression must include0016 and the actual PostgreSQL driver. This task is planning only: no hosted migration/deployment is authorized by this contract; root separately owns any later fresh backup/recovery/deployment gate and rollingPR5 publication.

## 8. Meaningful acceptance evidence

1. Real M71 add-source/save correction survives restart, preserves every earlier export/row, and retries/stale corrections do not duplicate or repurpose identities. Current missing boundary rationale/reference blocks calculation until explicitly saved.
2. Independent accounting vectors through Python -> actual PostgreSQL -> API -> frontend:1.000MMBtu yields53.1145kgCO2e;0.100/0.300 exercise opposite half-even ties; maximum bound, explicit zero, missing quantity, wrongunit/year/heatbasis/fuel, and entered/stated discrepancies. Compare gas masses, unrounded total, display and pins, not only final number. L07 requires native driver persistence; mocks are insufficient.
3. Direct SQL attempts as restricted runtime cannot forge calculated values, factor pins, statement bindings, coverage versions or actors. Revocation/save race, member demotion, outside-tenant reads and cross-company IDs fail safely. Concurrent duplicate keys, first saves, corrections and review-vs-correction test actual locks; duplicate source streams or same meter/reference/year under different sources are refused across both concurrent requests and newer M71 versions.
4. Tamper combinations include coordinated bytes/hash/length mutation; statement source ID swap; native numeric/payload disagreement; changed source/coverage hash; wrong predecessor/contributor/request/audit; report tied to another review. Readback/export refuse all of them. Compare canonical values under reordered equivalent JSON and UTC timestamp normalization (L02/L03).
5. Persist quantity-only, evidence-only, description-only, reason-only and source-binding-only successors through the real frontend decoder. Earlier contributor cannot review the successor; an eligible distinct manager can. Missing-data acceptance is refused; changes-requested remains available. Whole effective-tuple equality rejects only actual no-ops (L06).
6. Exercise actual browser actor changes and late-response suppression (L01); blank/unsupported input clears any newly proposed total while explicitly selected saved history remains identifiable. Browser selection, actual source/JSON/HTML download, exact retained bytes, print entry, print presentation, keyboard and narrow layout are separate checks. API success alone is not browser acceptance (L04).
7. Independent isolated restore of canonical15 baseline, additive0016 and all historic rows plus new M73 version/statement/review/report rows; exact earlier source/report bytes and runtime role safety after restart. Immutable snapshots and review hashes must match staged and committed LF Git blobs, not merely filesystem hashes (L02).

Accounting agreement: `m73-accounting-contract.md` SHA-256 `925ddba8b37048cd0949361528f41e6b9e90e388cb3270797e89d45f45597d29`; fixture SHA-256 `acd47a6a1ec8387b95c825e0d4b8a8d791f5abab8016151f330005a22a7bb655`. Retained M42 LF implementation pin: `eebade88f291cec281f38efe09597a107ce24904f28782d51405e739c4d37603`. These dependencies must be checked again against exact staged/committed bytes before implementation acceptance.

The accountable release claim is a bounded private synthetic source workflow. Qualified source/method release, complete corporate Scope1/2/3 inventory and external human assurance remain outstanding.
