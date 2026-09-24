# M74 technical contract: one mobile diesel source workpaper

Status: proposed implementation boundary, 2026-09-15. Task `M74-CTO-BOUNDARIES`; CTO context `/root/m74_cto`, sponsor/root integrator `/root`. Requested critical `gpt-6-astra` / `high`; observed execution settings unknown. This planning author is not the independent implementation reviewer. Only this document is owned by this assignment; no implementation, Git, host, credentials or shared operational records were changed.

The current board instruction authorizes sequential bounded Scope 1 milestones without a routine feedback stop. It supersedes the historical M73 feedback-wait pointer, not accounting, independent QA, preservation, publication or hosted rollout gates. This contract is not a source/method release, implementation result or claim of complete Scope 1.

## 1. Decision and exact scope

CPO and accounting selected a new source family: one owned, operationally controlled on-road heavy-duty fossil-diesel distribution vehicle per source/workpaper. The proposed bounded profile is calendar 2025, a California entity/base facility, vehicle model year 2007–2022 inclusive, US gallons **consumed** and vehicle-miles **traveled**. All travel belonging to that vehicle enters its activity, including interstate travel; the California base is not a reason to omit out-of-state emissions. Final factor cells, category meaning, fuel specification and independent expectations belong to `m74-accounting-contract.md`; product criteria belong to `m74-product-brief.md`.

Do not extrapolate EPA vehicle-year rows to 2023–2025 vehicles. Reject pooled/mixed fleets, mixed vehicle classes, third-party haulage, non-road equipment, alternative units, estimated mileage, partial-year control, unverified fuel composition and biodiesel/renewable blends. Unsupported source screenings remain visible in M71; an ineligible source cannot be converted into a supported M74 calculation by renaming it. Fuel consumed is not automatically equal to fuel purchased.

Deliver a source subtotal and traceable workpaper. Do not sum M73 and M74, change M71 coverage to complete automatically, release methods, or claim that mobile combustion or company Scope 1 is complete. Additional stationary fuels, fugitives/refrigerants, process screening and final coverage reconciliation remain separately bounded work.

## 2. Observed reusable seams and protected contracts

Inspected actual current files:

- `packages/neuvetra-database/src/m71-contract.ts` and `m71-validation.ts`: `mobile_combustion` already exists; source/entity/facility/domain identities cannot be repurposed; a matching source screening can be appended through a correction.
- `packages/neuvetra-database/src/m73-contract.ts`, `m73-validation.ts`, `m73.ts`, `m73-report.ts` and `migrations/0016_stationary_natural_gas.sql`: company-scoped streams, immutable versions/statements/reviews/reports, contributor independence, current-coverage pinning, exact readback reconstruction and capacity limits.
- `apps/site-api/src/calculation/m73-authority.ts` and `m73_stationary_natural_gas.py`: bounded Python Decimal execution, pinned implementation/dependency hashes, canonical input/result replay.
- `apps/site-api/src/workspace/m73-routes.ts`: private route, verified actor, same-origin POST, exact resource routing, no-store downloads, finite refusal outcomes.
- `apps/site-api/src/staging/server.ts`, `assets.ts`, database `workspace.ts`, `hosted.ts`, `staging-migrations.ts`, `Dockerfile.staging` and `.github/workflows/verify.yml`: explicit schema16/readiness/image/native-driver integration points.
- `tools/staging/m73-common.ts`: exact migration receipts, role/catalog/row inventory and exclusive evidence artifacts. It is historically pinned to 15→16; it is not an M74 operator.

Reuse unchanged canonical JSON, UUID/text validation, verified-auth transactions, membership locking, immutable history mechanics, evidence reconstruction, API error conventions and actor-lifetime UI patterns. Do not silently generalize the M73 fuel/unit/profile validator, Python dependency, method object, SQL calculator or renderer: M73 historical reads compare these definitions and exact rendered bytes. M42/M73 sources and historical reports must retain their existing pins and labels.

Use separately named M74 contracts, authority, SQL functions, tables, renderer and routes. The implementation may share unchanged low-level helpers; extracting or changing accounting/history behavior is outside this milestone unless the integrator first scopes and independently tests its backward compatibility. SQL is a defense against forged stored results: it must reconstruct the same approved method and reject any supplied result disagreement. Python remains the application calculation authority; JavaScript must not calculate emissions.

## 3. Source and vehicle identity

Add **Add synthetic diesel vehicle** to an editable corporate coverage draft. Append one `mobile_combustion` source with a stable UUID and matching full-year missing/candidate source screening; preserve all prior IDs and records. Select an existing eligible entity/base facility, enter a source label, and explicitly save the M71 correction with its current expected head ID/hash. Do not silently save or create a parallel corporate register.

New M74 saves bind the current saved M71 head ID/hash plus entity, facility, source and boundary-decision IDs. Reconstruct the complete pinned coverage version on the server inside the save transaction. Apply the same full-year included operational-control boundary and supported fictional boundary-reference rules as M73, with the mobile domain. Entity/base facility must be eligible for this profile. Changes to the corporate head require explicit relinking before new review/report; old downloads remain exact.

M74 additionally requires a stable synthetic vehicle asset identifier, vehicle class, model year, fossil-fuel declaration and consumption/distance basis. These are explicit fields; the source label never proves them. One stream represents one vehicle for one period. Fix the asset identity at stream creation and prevent its reassignment in corrections; discover a different vehicle as a different source. Canonicalize the vehicle identifier with a strict ASCII allowlist and fixed case to avoid ambiguous normalization. Require it even for a missing-activity first save.

Within a company, reserve normalized vehicle identity and period independently of the M71 source UUID, statement reference, coverage version and quantity. Enforce uniqueness in the database while holding the same company lock as M71/M73. Also enforce one M74 stream per stable source and reject duplicate issuer/reference/period evidence assigned to another vehicle. Retain reservations across corrections; removing evidence or changing a reference must not free a historical vehicle identity for another source. Test two different source UUIDs and concurrent first saves explicitly.

M71 immutable domains prevent the same source UUID from moving between gas and diesel. This does not establish universal duplicate detection across real evidence or renamed physical assets. No corporate aggregation is authorized until a later exact selection-set and cross-family reconciliation contract resolves those limitations.

## 4. Deterministic activity and method contract

The save envelope carries strict profile/version, binding, vehicle facts, period, `quantityGallons`, `distanceMiles`, separate fuel and mileage statements, separate confirmations/discrepancy explanations, zero explanation, predecessor ID/hash, correction reason and idempotency key. Quantities are decimal strings or null, never JSON floating-point values. Accounting accepted three decimal places and maximum `999999999999.999`, matching `numeric(15,3)` storage. Do not clamp, infer missing values, convert another unit or coerce a blank into zero.

Retain entered and stated quantities for **both** dimensions separately. Create two distinct retained artifacts: synthetic annual fuel statement and synthetic annual mileage statement. Each identifies the vehicle, full period, exact unit and applicable consumption/distance basis; the fuel artifact also identifies fossil-only fuel. Each has independent canonical original UTF-8 bytes/hash/length, ID/locator, manual confirmation and download. One artifact cannot satisfy both roles. These are synthetic evidence, not real receipts, extraction results or proof of fuel composition.

An incomplete workpaper may be saved, but there is no source total until both required activity dimensions and their evidence/confirmation are valid. If either dimension is missing, `calculation:null`; no partial CO2 diagnostic is implemented. Both zero requires matching zero statements and a nonblank no-operation/no-consumption explanation. Zero gallons with positive miles or positive gallons with zero miles remains an unresolved contradiction/idling-only profile with `calculation:null`; idling-only estimation requires a separate method. Positive entered-versus-stated mismatches require a separate reason for each affected dimension and remain visible unresolved findings. Acceptance of incomplete data is refused; a separate reviewer may request changes.

Proposed strict input field names supplied to root for interface coordination:

```ts
interface M74SaveInput {
  profile: 'synthetic-mobile-diesel-v1';
  binding: M73BindingInput; // Same six IDs/hash fields; new mobile eligibility resolver.
  period: {start:'2025-01-01'; endExclusive:'2026-01-01'};
  vehicle: {
    assetId: string;
    vehicleClass: 'Medium- and Heavy-Duty Vehicles';
    classificationBasis: string; // Nonblank synthetic facts supporting this class; not a label guess.
    modelYear: number; // Integer 2007..2022.
    fuel: 'Fossil Diesel';
    controlBasis: 'owned_operational_control_full_year';
  };
  quantityGallons: string | null;
  distanceMiles: string | null;
  fuelStatement: {
    issuer:string; reference:string; statedQuantityGallons:string; description:string;
    consumptionBasis:'dedicated_vehicle_consumed_no_adjustments';
  } | null;
  mileageStatement: {
    issuer:string; reference:string; statedDistanceMiles:string; description:string;
    distanceBasis:'dedicated_vehicle_annual_distance';
  } | null;
  fuelManualConfirmation:boolean;
  mileageManualConfirmation:boolean;
  fuelDiscrepancyReason:string | null;
  mileageDiscrepancyReason:string | null;
  zeroReason:string | null;
  expectedVersionId:string | null;
  expectedVersionSha256:string | null;
  correctionReason:string | null;
  idempotencyKey:string;
}
```

Canonical unit labels are fixed by the profile and retained per dimension; clients cannot choose alternative units. `classificationBasis` is required, nonblank bounded canonical text and retained in both evidence context and the report; a class label alone is insufficient. The generated fuel statement explicitly describes fuel consumed rather than merely purchased, dedicated vehicle attribution, no tank-balance adjustment and no separate auxiliary-engine allocation. The generated mileage statement explicitly includes all trip locations, including interstate operation. Manual confirmation acknowledges these exact synthetic assumptions; it does not assert real evidence was verified. The strict source register continues to store M71 source facts only; typed vehicle/class/year/fuel facts reside in M74 rather than adding unknown fields to historical M71 payloads. Each dimension has a server-derived status (`missing`, `evidence_missing`, `unconfirmed`, `explicit_zero`, `entered`, or `discrepancy`) and joint compatibility findings. Status is not client-supplied authority. Backend and frontend must freeze these names together before parallel implementation.

### Shared read types: first backend deliverable

Deliver `m74-contract.ts` before implementation proceeds concurrently with root's UI. Keep the existing M73 lifecycle field names where semantics are unchanged, with these explicit replacements:

- `M74Activity = Omit<M74SaveInput, 'expectedVersionId'|'expectedVersionSha256'|'correctionReason'|'idempotencyKey'>`.
- `M74FuelStatement` contains `id`, `profile:'m74-synthetic-fuel-statement-v1'`, `input:NonNullable<M74SaveInput['fuelStatement']>`, `locator`, `text`, `sha256`, `byteLength`. `M74MileageStatement` has the same fields with `profile:'m74-synthetic-mileage-statement-v1'` and its own mileage input type. These are distinct stored records; download route and artifact identity cannot interchange them.
- `M74AuthorityInput` contains `binding`, `period`, `vehicle`, non-null canonical `quantityGallons`, non-null canonical `distanceMiles`, `fuelStatementSha256` and `mileageStatementSha256`. Input units are fixed by profile; result trace carries them explicitly.
- `M74Method` contains `id:'mobile-diesel-combustion'`, `version:'m74-development-v1'`, `engineSha256`, `sourceSha256`, `factorSha256`, `gwpSha256`, `sourceTitle`, `sourceSheet`, `factorCells`, `gwpCells`, `noteCells`, `co2KgPerGallon`, `ch4GramsPerMile`, `n2oGramsPerMile`, `ch4Gwp`, `n2oGwp`, `gwpAssessment`, `status:'development_candidate_not_released'`, `releaseEligible:false` and `rights:'unresolved_for_factor_release'`. Include a dependency hash only if a separately pinned calculation dependency actually exists. Source notes/PDF corroboration and any additional pins come from the accounting contract before this object is frozen.
- `M74Calculation` contains `profile:'m74-decimal-result-v1'`, `input:M74AuthorityInput`, `inputSha256`, `method:M74Method`, `gasResults:{co2:M73Gas,ch4:M73Gas,n2o:M73Gas}`, `total:{unrounded:string,display:string,unit:'kg CO2e',rounding:'half_even_4dp'}` and `resultSha256`. Reuse the gas result structural type, not the M73 calculator/factors.
- `M74Version` preserves M73 IDs, predecessor/contributor/timestamp/correction fields, pinned `coverageVersion`, hashes, flags and separate `review`. Replace `activity` and `calculation` with M74 types, replace `statement` with `fuelStatement:M74FuelStatement|null` and `mileageStatement:M74MileageStatement|null`, and add `activityStatus:{fuel:M74DimensionStatus,mileage:M74DimensionStatus}`. Status and findings are derived from the complete effective input and included in the content hash.
- `M74Review`, review input and report input preserve the M73 shapes with M74 limitations. `M74Report` preserves the M73 shape with `rendererVersion:'m74-mobile-source-report-v1'`. `M74Worksheet` preserves the shape with M74 profile/types and explicit immutable `vehicleAssetId`. `M74Register` preserves `profile`, `companyId`, `coverageHeadVersionId`, `worksheets`, `sources`, `coverageFindings`, `limitations` and the same incomplete/synthetic/release/assurance flags. A source choice uses the six-field binding and company/entity/facility/source labels plus eligibility/findings; vehicle facts are collected on first M74 save.

Backend may refine type naming before publishing its first shared contract, but must message root with the exact frozen interface before root binds frontend decoding. No silent post-dispatch shape changes. Factor/fixture completion gates arithmetic implementation and acceptance; it does not block authoring these strict lifecycle types.

M74 gets a new Python Decimal adapter with strict-key input and batch replay. The input/result hash binds both dimensions, all eligibility facts, exact coverage binding, statement hash and method snapshot. Pin the retained primary workbook bytes, exact source cells/notes, extracted factor object, GWP object, adapter bytes and any dependency bytes. Carry factor **units**: CO2 is fuel-based while CH4/N2O are distance-based. Never reuse stationary CH4/N2O factors or infer miles from gallons. Emit each gas mass, gas CO2e, exact unrounded total, display total and explicit half-even rounding policy. Cross-language canonical JSON and exact decimal strings must agree.

Require the same method object in Python, TypeScript and SQL and validate it independently against primary evidence. Accounting identified candidate workbook SHA-256 `43afb91d79b2ae765b3a447549d9e1021a144a407cec5eb804be9fcf69a668a7`, CO2 cell `D107` and model-year/factor cells `E256:G256`. The published displayed decimals `10.21`, `0.0095` and `0.0431` govern; raw XML binary floating-point tails are not extra factor precision. The exact class is `Medium- and Heavy-Duty Vehicles`; do not replace it with an invented EPA category. The new adapter is not a wrapper that edits M73 profile strings. Bound process time/output/concurrency and pin packaged bytes at readiness; failure returns an unavailable result, never a stale/default total.

## 5. Immutable lifecycle and authority

Use additive `0017_mobile_diesel.sql` with M74-named tables for heads, versions, statements, reviews, reports, requests and audit plus any bounded identity-reservation structure needed by section 3. Composite company/record foreign keys, forced RLS and server/data-layer actor checks apply to every derived object. Runtime receives narrowly scoped select/function execution; no arbitrary table writes, mutable history, privileged-role grants, public functions or broad definer search paths.

Save obtains authority and company/coverage/head locks in the established order. Validate current membership/manager status inside the locked transaction, not only in the HTTP handler. The SQL function validates the complete request, current coverage pin and predecessor, reconstructs statement/method/result, and rejects forged values. Idempotency fingerprints include actor, company, operation, stream and full effective request. Same-key retries return the original result; a changed request/actor conflicts. No-op checks compare the full permitted effective tuple, including descriptions, reasons and source binding.

Every version freezes coverage, evidence, vehicle/activity, calculation, findings, predecessor, contributor set, actor, timestamps and exact canonical export. The contributor set includes coverage and prior-version contributors. A separate current manager outside that set can make one immutable decision on an exact version; a correction has no inherited approval. A report freezes the exact version and explicitly selected decision or unreviewed state, plus its deterministic renderer version and bytes. Later decisions create new snapshots; never re-render old reports with a new template.

Readback revalidates lineage, native decimal columns, statement reconstruction, method/calculation replay, audit/request correspondence, contributor/decision independence, report snapshot and exact renderer output. Tampered bytes plus forged matching hashes are still refused. A stored authority failure yields 503; outside-tenant resources yield 404. Normalize database timestamps to the canonical format and compare semantic JSON without property-order dependence.

Proposed private route root: `/workspace/:companyId/mobile-diesel`, with stream-version, statement download, review, report and report download routes matching the actual M73 route shape. Strictly reject extra segments; GET never creates reports. Same-origin POST, verified bearer actor, duplicate-key JSON refusal, bounded input, no-store responses, download escaping/CSP and current manager checks are required. Preserve 401/403/404/409/422/503 meanings.

Retain the demonstrated bounded capacity envelope for M74 unless measured evidence requires a reviewed adjustment: three mobile streams and forty mobile versions per company, 100 KiB canonical version, 128 KiB report, two report states per version, 3,800,000-byte retained history and 4,000,000-byte response envelope. All limits are checked transactionally; refusals preserve history access. These are demonstration limits, not customer-scale claims. Combined-page/API loading must not concatenate gas and mobile histories into an unbounded response.

## 6. Method release and completeness are separate gates

M73's method remains `development_candidate_not_released`, `releaseEligible:false` with unresolved factor-release rights. Its historical flags must not change when a future method is approved. An approved research-answer source/corpus is not factor approval; copying its commercial-runtime flag into this calculator would be invalid.

M74 also starts as a development candidate. A future production milestone must introduce immutable, authorized factor/method release records that name exact source/rights review, factor/GWP/method pins, applicable profile/year/geography, approval evidence and effective status. New-save admission checks the current authorized release eligibility; historical replay checks the exact retained method/release snapshot. Withdrawal prevents new calculations under that release without rewriting historical calculations or opinions. Unknown release ID, changed bytes or unsupported profile fails closed. This future release system is a separate deliverable, not functionality created by this document.

Maintain a supported-profile completion matrix with at least these dimensions: organizational control/period, source family and physical identity, fuel/technology/model-year/unit support, evidence sufficiency, complete activity dimensions, source-method eligibility, review findings, duplicate reconciliation and all in-boundary sources. A calculated source, three populated streams or accepted internal review does not satisfy the matrix. Mark each requirement supported, missing, unsupported, excluded with documented basis, or not applicable with evidence; never substitute a source count for completion. Corporate Scope 2 and all 15 Scope 3 categories remain visible as outside this increment.

Future aggregation must freeze an exact set of included source **version IDs and hashes**, the boundary version, common reporting period/GWP basis, findings and a rule selecting only one version per physical source/period. Sum unrounded gas totals before final display rounding. Refuse incompatible periods/methods, overlap, duplicate identities, missing required gas results and unsupported completeness claims. Do not implement aggregation in M74.

## 7. Concrete non-overlapping workstreams

Root approves dispatch ownership before any shared-file edits. Suggested sequence accommodates four concurrent contexts and reserves a nonauthor reviewer:

| Workstream | Owned paths/actions | Dependencies and evidence |
| --- | --- | --- |
| Accounting | `docs/research/m74-accounting-contract.md`, independently derived M74 fixtures and source review; no production implementation | Exact source cells/units/applicability, null/zero cases and expected per-gas results frozen before calculator authoring; final acceptance by a nonauthor reviewer |
| Backend/calculation specialist | New `packages/neuvetra-database/src/m74-contract.ts`, `m74-validation.ts`, `m74.ts`, `m74-report.ts`, `migrations/0017_mobile_diesel.sql`; new `apps/site-api/src/workspace/m74-routes.ts`, `m74-postgres.test.ts`; new `apps/site-api/src/calculation/m74_mobile_diesel.py`, `m74-authority.ts` and their tests; root-authorized shared server wiring in database `workspace.ts`/exports, `hosted.ts` (including readiness version) and staging `server.ts` | CPO/accounting/CTO contract agreement; owns the coupled SQL/Python/storage result boundary; root's exact shared-file touch list in backend dispatch governs |
| Root UI/integration | New `apps/site-web/src/components/MobileDiesel.tsx`, `src/lib/m74-api.ts`/tests; bounded edits to `CorporateCoverageRegister.tsx`, `StagingWorkspace.tsx` and styles; database `staging-migrations.ts` manifest, staging `assets.ts`, `Dockerfile.staging`, `.github/workflows/verify.yml` | Backend strict contracts first; root owns frontend, packaging/CI, operators, local/hosted demo harness, operational records, Git and rollout; no concurrent backend edits to root-owned files |
| Independent QA/security/accounting review | New M74 review artifacts/tests under `evaluations/research-qa/`; no edits to production implementation being reviewed | Frozen integrated candidate; actual native PostgreSQL and browser boundaries, source evidence and adversarial cases; defects return to author, original first verdict retained |

If root explicitly delegates operators, name a distinct owner for **new** `tools/staging/m74-*` files; do not let that worker edit M73 operators or root's harness simultaneously. Root remains sole host/Git/ledger writer. Implementation author cannot supply the sole release verdict. Requirements authorship must be disclosed by any later reviewer.

## 8. Acceptance mapped to actual boundaries

1. **Eligibility:** register/save/reload a mobile source without changing earlier coverage records. Unsupported year/class/fuel/unit, unresolved control, excluded/partial-year source and stale coverage fail through API and restricted SQL. Travel outside California is retained in the source activity, not automatically excluded.
2. **Accounting:** independently derived normal, minimum, maximum, exact-zero, missing-one-dimension and half-even boundary cases run Python → native PostgreSQL driver → API → real frontend decoder. Assert every gas mass/CO2e, exact total, display, units and pins. Changing mileage alone changes only distance-based components; changing gallons alone changes only fuel-based CO2. A source row typo or stationary-factor substitution must fail.
3. **Duplicates/concurrency:** concurrent same source and different-source/same-vehicle first saves, corrected evidence identity, newer coverage head, duplicate reference, same-key replay and conflicting-key content. Assert one authoritative history and no double reservation or freed historical vehicle identity. Cross-family same-source domain swapping fails. No aggregation result is exposed.
4. **Corrections/review:** quantity-only, mileage-only, statement-only, explanation-only, model-year-within-profile, description-only and coverage-relink successors survive actual persistence/decoder. Full-tuple no-op refusal; true vehicle-identity replacement refused. Prior author/coverage contributor cannot review a successor. Eligible distinct manager can request changes and accept only a valid complete bounded workpaper. Unreviewed and reviewed reports retain exact earlier bytes.
5. **Security:** role demotion/revocation versus save/review race, tenant changes and late responses, outside-tenant IDs/downloads, body-claimed actor, direct restricted SQL forged calculation/statement/coverage, malicious labels and extra route segments. Coordinated content/hash/length tamper and cross-record audit/review swaps fail on read. No stored object can grant authority.
6. **Preservation and recovery:** exact old M71/M73 and electricity exports/reports/statements still replay after 0017, restart and isolated restore. Compare baseline rows, catalog/roles, receipt lineage and byte hashes; account for explicitly allowed additive objects. New mobile exports/reports restore exactly. Do not accept row counts alone as preservation proof.
7. **Browser:** actual source registration, both inputs, missing/unsupported-state behavior, corrections, actor switch, independent review, history and real downloads at desktop and 390px width. Unsaved/invalid edits clear a proposed result while clearly selected history remains labeled. Verify actual print entry point separately from print styling; physical/PDF/pagination fidelity needs its own evidence and must not be inferred.
8. **Publication:** freeze exact reviewed files and compare staged/committed LF bytes with accepted hashes; run relevant application/type checks, dedicated native PostgreSQL regression and image smoke with the real M74 Python authority. Extend existing CI so this new path is actually invoked; a test file merely present in the tree is insufficient. Root verifies remote head and all required checks on rolling PR5 before claiming publication.

Primary recurring lessons applied: L03 canonical values across boundaries and L06 composed correction/lifecycle validation. L01/L02/L04/L07 remain established security, byte-preservation and native-driver acceptance controls.

## 9. Migration, rollout and forward recovery

Schema16 is the observed repository baseline; re-observe the actual host before action. Do not change 0016 bytes, delete receipts or run the M73 15→16 operator with substituted names. A new 16→17 operator must pin the canonical first sixteen receipts and exact reviewed 0017 hash, reject unexpected schema/catalog state, preserve all earlier rows/roles and use exclusive operation journals with unresolved-write detection.

Before hosted mutation: fresh existing-service/head/image/readiness observations; encrypted application backup and independent isolated restore of the actual schema16 baseline; exact historical downloads and roles reconstructed; rehearsed 16→17 transition and tested schema17-compatible forward recovery. Reuse the previous under-four-hour backup admission only with fresh state checks; it is not a claim that an old M73 archive still qualifies. Provider/Auth and off-device disaster recovery remain excluded unless separately tested.

Stop and verify the current writer under the established controlled rollout, then apply only independently reviewed SQL, deploy the exact tested commit/image, exercise the hosted journey, perform a real restart, and revisit with zero application writes to prove retained history. Verify actual frontend decoding and browser readback. Restore the prior automatic-deployment state and close created verification sessions. After committed17, never deploy schema16-only code; use verified17-compatible fix-forward. Preserve failed attempts, historic archives and journals.

## 10. Smallest next demonstration and handoff

Show an existing saved natural-gas history unchanged alongside one newly registered diesel vehicle: enter synthetic consumed gallons and vehicle-miles, save, inspect gas-level calculation and pinned evidence, correct mileage only, show the earlier exact report, and have a distinct eligible manager review the corrected version. Then clear mileage on a new draft and show that no source total is fabricated. A second attempted source for the same vehicle must be refused. End with a readable mobile source report and the still-open Scope 1 family/coverage matrix.

This assignment performed code/contract inspection and cross-role coordination only; no runtime tests, migration rehearsal, legal verification, deployment or implementation acceptance is claimed. Next owner: root accepts the bounded contracts, freezes source/accounting dependencies and dispatches the backend implementation; independent review follows the integrated candidate.
