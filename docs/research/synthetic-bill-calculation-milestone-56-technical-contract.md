# M56 technical contract — reviewed synthetic bill to draft location-based result

**Status:** implementation contract for one local, synthetic, development-only milestone  
**Owner:** CTO, with data and security boundaries; reporting to CEO  
**Depends on:** accepted M53 calculation authority, accepted M54 tenant workspace, accepted M55 reviewed bill lineage, and the M56 product brief  
**Release posture:** Stage 4 acceptance remains false; factor/method release and production acceptance remain false

## Decision

M56 will add one tenant-scoped integration path from the exact reviewed M55 bill version to one immutable draft calculation. The API resolves all calculation inputs from the database. A new M56 adapter performs the exact kWh-to-MWh normalization and multiplies the normalized quantity by the factor exposed by the accepted M53 one-MWh authority using Python `Decimal`. The browser supplies identifiers and an idempotency key only.

The accepted M53 file must remain byte-for-byte unchanged. Its independent review binds `apps/site-api/src/calculation/location_based_electricity.py` to SHA-256 `4ad28f3877d13f238bbbf7e8bfb1fc6241922b9def73712ec1b02fd80b51b82c`, and M53 replay deliberately rejects an implementation-hash change. M56 therefore uses a separate adapter and a separate result contract. It must not widen `validate_activity`, add a public M56 action to M53, or refactor M53 arithmetic in place.

The current working tree was observed to contain an unreviewed in-place M53 edit with SHA-256 `da65305672afe9d73d56bce8db83cce5d2dc2ebc4ad42c5ab440eb56c12b458f`. Those bytes are not an accepted authority and must be restored before M56 qualification. This observation describes implementation risk; it does not change M53's published status.

## Accepted authority and exact scope

| Boundary | Exact accepted value | Source of authority |
|---|---|---|
| Evidence bytes | `neuvetra-m55-synthetic-electricity-bill.pdf`, 4,605 bytes, SHA-256 `0a97cd0976c03af0776214fc19bdc3d4f0c00e9c835f3e116574a6f375c8e135` | M55 migration, parser, response decoder and independent review |
| Parser | `m55-fixed-pdf-v1`, completed extraction | M55 database and parser |
| Reviewed version | version 2; previous version 1; `12346.000 kWh`; reason `Synthetic review exercise` | M55 immutable version history |
| Facility | same-tenant `Synthetic California office`, explicit `US` / `CA` / `CAMX` | M54 facility plus M55 reviewed assignment |
| Service period | inclusive `2023-01-01` through `2023-01-31` | M55 evidence/version lineage |
| Activity | exact linked version-2 draft, `12.346000 MWh` | M55 `inventory_activity_versions` |
| Boundary | same-tenant reporting year 2023, operational control, draft, version 1; facility included | M54 boundary and `boundary_facilities` |
| Method | `scope2-location-based-egrid-subregion`, `2023-r2-camx-v1` | accepted M53 authority |
| Factor | `epa-egrid2023-r2-camx-total-output`, `eGRID2023-revision-2`, CAMX `SRL23!AI6`, `195.0402888 kg CO2e/MWh` | accepted M53 factor candidate |
| Factor digest | `8770ae6238df8525e5250850fab248c934be33f459ed19cc1fa24bd0718cb356` | M53 canonical SHA-256 of the factor object |
| Source digest | `3dfbbcf2f949d58d5b2dbee3aab8150bd04a0c8ebb730ba1cd37a013bd4450ab` | retained EPA workbook bound by M53 |
| GWP policy | `epa-egrid2023-ar5-100-year`, `egrid2023-technical-guide-v1`; SHA-256 `fd9fd8973012da1a232dad7fc00db3013194751a92b34ab21dfd4f7b2c5148c5` | accepted M53 GWP object |
| Classification | `development_candidate`, `not_released`, `release_eligible: false` | M53 review and M56 product brief |

M56 supports no other file, company, facility, bill/version, quantity, service period, reporting year, boundary state/version, subregion, method, factor, GWP policy or result. It performs no inference, factor lookup, annualization, prorating, OCR, model call, provider call or network request.

## Smallest architecture

| Component | Responsibility | Trust boundary |
|---|---|---|
| Workspace route | Authenticate, check origin, enforce exact body, authorize manager, and return finite errors | Does not accept calculation facts from the browser |
| Calculation service | Load a same-tenant snapshot, verify M54/M55 lineage, canonicalize and hash it, coalesce duplicate work, invoke the isolated adapter once, validate its complete response, and request an atomic database write | Only component allowed to compose database lineage with calculator output |
| M56 Python adapter | Verify the accepted M53 authority bytes and one-MWh record; perform exact conversion and Decimal multiplication; return one canonical M56 result | No HTTP, database, environment enumeration, credentials, filesystem writes, clock, network, logging or retry |
| Calculation store | Read through forced RLS; atomically recheck lineage and append one result plus one audit event | Browser cannot call the writer; no direct authenticated insert/update/delete grant |
| Web decoder/UI | Send opaque IDs and idempotency key; strictly decode the complete response; show draft and unreleased status | Never computes, selects or repairs a factor/result |

The workspace server calls the adapter directly as a bounded child process. It must not call the unauthenticated standalone `/calculation/run` demonstration over HTTP. The adapter receives a canonical server-built snapshot through stdin and returns one bounded JSON object through stdout. The launcher inherits only `PATH` and `PYTHONIOENCODING=utf-8`, enforces a 16 KiB request, 64 KiB response and two-second timeout, captures no stderr content in a client response, and never retries.

## M56 calculator boundary

The adapter is a quantity-enabled successor around the existing authority, not a second factor catalog. On every run it:

1. hashes the loaded M53 file and requires the accepted `4ad28f...` digest;
2. calls the unchanged M53 `calculate` with its exact accepted one-MWh fixture;
3. verifies that unit record's contract, method, factor, GWP, source, classification, rate and all recorded hashes;
4. validates the complete M56 lineage snapshot and its hash;
5. converts the reviewed bill quantity exactly and independently compares it with the linked M55 activity;
6. applies M53's published-total authority with `Decimal`, precision 96 and no intermediate rounding;
7. emits one `m56-linked-bill-calculation-result-v1` record and hashes the canonical payload;
8. fails with a finite code and no partial record if any check differs.

The accepted M53 result remains a one-MWh, full-year test fixture. The M56 result's activity period is the actual bill period, `2023-01-01` through `2023-01-31`. The adapter may retain the M53 authority-record hash in its method provenance, but it must not relabel M53's `2023-01-01` through `2023-12-31` fixture as the bill period.

```python
@dataclass(frozen=True)
class LinkedBillSnapshot:
    company_id: str
    evidence_id: str
    evidence_sha256: str
    extraction_id: str
    parser_version: str
    bill_version_id: str
    previous_bill_version_id: str
    bill_version: int
    electricity_kwh: str
    correction_reason: str
    service_period_start: str
    service_period_end: str
    activity_version_id: str
    activity_version: int
    quantity_mwh: str
    facility_id: str
    boundary_id: str
    boundary_version: int
    reporting_year: int
    boundary_approach: str
    boundary_status: str
    country: str
    state: str
    egrid_subregion: str
    input_snapshot_sha256: str

def calculate_linked_bill(snapshot: LinkedBillSnapshot) -> M56Result: ...
def replay_linked_bill(stored_record: M56Result, current_snapshot: LinkedBillSnapshot) -> ReplayResult: ...
```

`replay_linked_bill` first verifies the stored canonical payload hash, then verifies the current authorized lineage and all pinned authority/adapter hashes, then recomputes and requires byte equality. It never selects a newer method, rewrites a record or creates another calculation.

## Unit conversion and exact arithmetic

`exact-kwh-to-mwh-v1` is part of the method profile. It accepts only a non-negative plain decimal with exactly three fractional digits in the bounded database snapshot. It parses `12346.000` with `Decimal`, divides by the exact integer `1000`, and renders the result at six decimal places only after proving that this formatting discards no non-zero digit. The adapter then requires exact numeric and exact canonical-text equality with the stored activity `12.346000`. No binary float or JavaScript number participates.

```text
12346.000 kWh / 1000 = 12.346000 MWh
12.346000 MWh × 195.0402888 kg CO2e/MWh = 2407.9674055248 kg CO2e
display = ROUND_HALF_EVEN(unrounded, 4 places) = 2407.9674 kg CO2e
```

| Output | Exact canonical value |
|---|---:|
| CO2 mass and reference CO2e | `2399.4607843584` |
| CH4 mass | `0.14000364` |
| CH4 reference CO2e | `3.92010192` |
| N2O mass | `0.0168004368` |
| N2O reference CO2e | `4.452115752` |
| Rounded-column component sum | `2407.8330020304` |
| Published total minus component sum | `0.1344034944` |
| Authoritative unrounded total | `2407.9674055248` |
| Four-place display | `2407.9674` |

The authoritative total remains the published `AI6` rate multiplied by MWh. Gas-column values are an explicit reconciliation only.

## Canonical records and hash graph

Canonical JSON is UTF-8, Unicode preserved, object keys sorted lexicographically, arrays kept in defined order, no insignificant whitespace, and decimal quantities represented as strings. Timestamps and generated calculation/audit IDs are stored outside the deterministic result payload. A parse-and-recanonicalize operation must reproduce the exact stored text before it is admitted or returned.

| Digest | Canonical content |
|---|---|
| `bill_version_payload_sha256` | evidence ID/digest, parser/extraction ID, version-1 and version-2 IDs and values, correction reason, facility and service dates |
| `activity_version_payload_sha256` | company, activity/version, pinned bill version, facility, boundary, quantity/unit/status |
| `input_snapshot_sha256` | the complete server-resolved snapshot above, including both subordinate hashes and explicit US/CA/CAMX |
| `conversion_profile_sha256` | ID, exact `1000 kWh = 1 MWh` ratio, input/output scale and no-rounding rule |
| `authority_record_sha256` | accepted canonical M53 one-MWh result bytes |
| `method_profile_sha256` | method ID/version, accepted M53 implementation SHA, frozen M56 adapter SHA, Decimal/rounding policy and conversion-profile SHA |
| `factor_candidate_sha256` | accepted M53 factor object |
| `gwp_policy_sha256` | accepted M53 GWP object |
| `result_payload_sha256` | complete M56 result without the hash field itself, including input, method, factor, GWP, conversion, trace, totals and classifications |

The database stores canonical input and result text plus their hashes and typed summary columns. The service recomputes every digest before write and again before returning a stored record. The web decoder independently pins the static method/factor/GWP/source values and checks all exact output values and 64-lowercase-hex hash shapes. It does not treat internally consistent client-supplied JSON as proof.

The M56 adapter SHA is frozen only after implementation. The implementation and independent reviews must record it; the contract does not invent it in advance. Any change to M53, the M56 adapter, canonicalization, conversion, factor, GWP or method profile requires a new profile/version and must not make an old record replay under new bytes.

## Database migration and immutable result boundary

Add `packages/neuvetra-database/src/migrations/0003_synthetic_bill_calculation.sql` after accepted migrations 0001 and 0002. Do not edit those migrations.

### `neuvetra.inventory_calculation_versions`

| Column group | Required fields and constraints |
|---|---|
| Identity/version | `id`, `company_id`, `calculation_version = 1`, `previous_calculation_id is null`, `profile_id = 'm56-linked-bill-location-v1'`, unique `(id, company_id)` |
| Lineage | `evidence_id`, `extraction_id`, `bill_version_id`, `activity_version_id`, `facility_id`, `boundary_id`; same-company composite foreign keys |
| State | `status = 'draft'`, `classification = 'development_candidate'`, `release_eligible = false` |
| Quantities/results | typed `source_quantity_kwh = 12346.000`, `normalized_quantity_mwh = 12.346000`, `unrounded_kg_co2e = 2407.9674055248`, `display_kg_co2e = 2407.9674` |
| Authority | method/profile IDs and versions; M53 authority SHA; M56 adapter SHA; factor ID/version/candidate/source SHA; GWP ID/version/SHA; conversion ID/SHA |
| Canonical payloads | `input_snapshot_canonical`, `input_snapshot_sha256`, subordinate lineage hashes, `result_payload_canonical`, `result_payload_sha256` |
| Idempotency | `idempotency_key`, `operation_fingerprint`; unique `(company_id, idempotency_key)` and `(company_id, activity_version_id, profile_id)` |
| Audit metadata | `created_by`, `created_at`; excluded from the deterministic result payload |

Add composite unique keys to the existing parents where PostgreSQL needs them, then bind the calculation with composite foreign keys that carry `company_id` and the related bill/facility/boundary IDs. A collection of independent `(id, company_id)` foreign keys is insufficient by itself because it does not prove that the activity's own bill, facility and boundary are the ones copied onto the result.

### `neuvetra.calculation_audit_log`

This append-only table contains `id`, `company_id`, `actor_user_id`, `calculation_id`, literal event type `calculation.created`, an allowlisted metadata object containing only activity ID, method profile and result hash, and `created_at`. One calculation has exactly one created event. Replay is read/compute verification and creates no durable event in M56, preserving the one-result/one-event invariant.

Both tables have enabled and forced RLS. Members may select rows for companies where `is_company_member(company_id)` is true. No authenticated role receives direct insert, update, truncate or delete. The narrow calculation writer has a fixed `search_path`, is revoked from `PUBLIC` and browser-facing `authenticated`, and is callable only from the trusted local API store. It revalidates the authenticated actor's owner/admin membership and all lineage in its transaction; actor/company values from request bodies are never accepted.

The writer locks the target activity and referenced bill/boundary rows, then repeats all acceptance predicates immediately before insert. The calculation and its audit event commit in one transaction. A stale row, missing relationship, hash mismatch or conflicting prior result rolls back both.

M56 adds no job queue and no cache. Calculation is bounded synchronous local CPU work. `bill_summary_cache` is not extended with results, failed responses are not cached, and no result or authorization decision is put in browser storage. Operational logs are non-authoritative and restricted to correlation ID, finite event code, outcome and latency bucket; they contain no token, raw evidence, canonical payload, tenant identifiers, hashes, quantities, SQL, stack, path or child stderr.

## Store and service interfaces

```ts
interface M56CalculationStore {
  loadSourceSnapshot(userId: string, companyId: string, evidenceId: string,
    activityVersionId: string, expectedBillVersionId: string): Promise<LinkedBillSnapshot | null>
  findByActivity(userId: string, companyId: string,
    activityVersionId: string): Promise<SyntheticDraftCalculation | null>
  appendVerifiedResult(input: VerifiedCalculationWrite): Promise<AppendOutcome>
}

interface VerifiedCalculationWrite {
  actorUserId: string
  companyId: string
  evidenceId: string
  expectedBillVersionId: string
  activityVersionId: string
  idempotencyKey: string
  operationFingerprint: string
  snapshotCanonical: string
  resultCanonical: string
}

type AppendOutcome =
  | { kind: "created"; calculationId: string }
  | { kind: "existing"; calculationId: string }
  | { kind: "stale" }
  | { kind: "conflict" }
```

`loadSourceSnapshot` executes under the authenticated actor's forced-RLS context. `appendVerifiedResult` is reachable only after service validation and performs its own transactional actor/tenant/lineage recheck. The public `WorkspaceStore` exposes only the bounded create/read/replay operations, never a generic result insert.

## API contract

| Route | Exact accepted body | Roles | Success |
|---|---|---|---|
| `POST /workspace/:workspaceId/bills/:evidenceId/calculations` | `{ "activityVersionId": "<UUID>", "expectedBillVersionId": "<UUID>", "idempotencyKey": "<UUID>" }` | owner/admin | `201` new; `200` exact existing |
| `GET /workspace/:workspaceId/bills/:evidenceId/calculations/:calculationId` | none | owner/admin/member | `200` after RLS and stored-record validation |
| `POST /workspace/:workspaceId/bills/:evidenceId/calculations/:calculationId/replay` | exact empty object `{}` | owner/admin | `200 { status: "matched", calculation: ... }` |

The create body rejects extra keys and does not accept company, facility, boundary, quantity, unit, date, geography, method, factor, GWP, conversion, total, result, actor or role. Origin is checked before authentication on writes. Authentication precedes lookup and body-dependent work. Explicitly foreign origins fail before state access. Origin-less authenticated reads match the accepted M54/M55 behavior.

The bill response may add one `draftCalculation` field, either `null` or one strict summary/full-record link. The API and web decoder must validate exact keys, IDs, tenant relationships, version/status/classification, all static pins, all exact numerical strings, trace/reconciliation, and hashes. Unknown and foreign evidence/calculation IDs return the same shape and status.

## Idempotency and concurrency

The server computes `operation_fingerprint` from the authenticated company, evidence ID, expected version-2 ID, activity version ID, current input snapshot hash and fixed M56 method profile. It is never accepted from the browser.

- Same idempotency key and same fingerprint returns the existing calculation with `200` and creates no event.
- Same key with another fingerprint returns `409` and performs no work.
- A new key for an already-calculated activity/profile returns the same existing calculation with `200`; it does not append another version or event.
- In the local single-server runtime, an in-flight map keyed by `company_id + activity_version_id + profile_id` coalesces identical calls into one adapter dispatch. The tenant is part of the key. The entry is removed in `finally`.
- The database unique constraints and locked transactional recheck are authoritative. Separate processes may duplicate deterministic CPU work, but they cannot create two rows or two audit events; the loser reads and returns the winner only if the complete canonical result and fingerprint agree.
- A timeout, malformed output, stale recheck or process crash creates no result, reservation, success audit or cached value. A later request may try again explicitly with the same key.

## Fail-closed outcomes

| Condition | External result | Side effects |
|---|---|---|
| Missing/invalid identity | `401 Authentication required.` | no parse, lookup, engine, write or tenant-bearing log |
| Foreign origin on write | `403 Forbidden.` | checked before auth/state |
| Own-company member attempts create/replay | `403 Insufficient company role.` | no engine, write or audit |
| Unknown/foreign workspace, evidence, activity, version or calculation | `404 Draft result not found.` | same shape; no relationship/timing oracle |
| Extra/missing body key or invalid UUID | `422 Invalid calculation request.` | no engine or write |
| Version 1, no version 2, missing reason, incomplete extraction or unlinked activity | `409 Review the bill before calculating.` | no engine or write |
| Requested bill version differs from activity pin; later version/activity exists | `409 The evidence link changed; review the current version.` | no implicit upgrade |
| Bill/activity quantity mismatch, wrong unit, conversion mismatch | `409 Reviewed activity does not match this demo.` | no hidden conversion or correction |
| Missing/foreign facility, CAMX, boundary inclusion or tenant relationship | `404 Draft result not found.` | foreign relationships remain absent |
| Dates missing/inverted/outside 2023; boundary not 2023/draft/version 1/operational control | `409 Bill period is outside this draft boundary.` | no prorating, annualization or state repair |
| M53/M56 implementation, authority record, method, factor, GWP, source or conversion pin differs | `409 Calculation method changed; this record was not run.` | no newest-version fallback |
| Same idempotency key, different operation | `409 Calculation request conflicts.` | no engine/write if conflict known before dispatch |
| Busy/timeout/nonzero child exit/malformed or oversized output | `503 No result produced.` | current transient total cleared; no internal detail, retry or persistence |
| Stored canonical text/hash mismatch or replay inequality | `409 Replay could not be verified.` | original stored history unchanged; no replacement |
| Database error after calculation | `503 No result produced.` | transaction rollback; no result/event |

## Proposed file ownership

| Owner | Minimal allowed files | Responsibility |
|---|---|---|
| Calculation/API | new `apps/site-api/src/calculation/location_based_electricity_bill.py` and focused Python test; new `apps/site-api/src/workspace/synthetic-bill-calculation-service.ts` and tests; bounded extensions to workspace `types.ts`, `routes.ts`, `server.ts` and their existing tests | M53 authority adapter, exact Decimal result, orchestration, public contract and safe process lifecycle |
| Data/database | new `packages/neuvetra-database/src/migrations/0003_synthetic_bill_calculation.sql`; bounded extensions to `src/index.ts`, `src/index.test.ts` and `src/synthetic-bill-security.test.ts` | result/audit schema, RLS, writer, transactional stale/idempotency checks, record mapping |
| Web | bounded extensions to `apps/site-web/src/lib/workspace-api.ts`, its tests, `CompanyWorkspaceDemo.tsx`, its tests and existing workspace styles | strict decoder and accessible create/result/replay journey |
| Evidence/QA | milestone record and independent review artifacts after implementation | exact file/hash manifest, accounting, security and product challenge |

No implementation change is allowed in M53's `location_based_electricity.py`, its M53 test fixture, the public standalone calculation route, migrations 0001/0002, the PDF/manifest or provider/research pipeline. No dependency is required.

## Migration and rollback

1. Restore and verify the accepted M53 implementation hash before building M56.
2. Apply additive migration 0003 after 0001/0002 in the memory-only PGlite runtime. It creates the two M56 tables, composite constraints, RLS, policies and narrow writer in one transaction; there is no backfill.
3. Fail startup if any M56 table lacks enabled and forced RLS, the writer is executable by `PUBLIC`/browser `authenticated`, a required parent binding is absent, or the three explicit feature guards are not set.
4. Gate server and UI composition on `NODE_ENV` exactly `development` or `test`, `M54_SYNTHETIC_WORKSPACE=enabled`, `M55_SYNTHETIC_BILL=enabled`, and `M56_SYNTHETIC_BILL_CALCULATION=enabled`.
5. Local rollback is to stop listeners, close the in-memory database and recreate from the accepted migrations. Do not edit applied migration bytes or issue destructive SQL against a persistent database.
6. If these schema objects ever reach a durable environment, disable the M56 composition first and use a separately reviewed forward migration. Dropping calculation/audit history is outside this milestone.

Engine or API rollback leaves accepted M53/M55 behavior intact because the M56 adapter, route composition and schema are additive. A stale or failed M56 result is never rewritten; a successor method uses a new profile and calculation version.

## Acceptance checks

### Authority, conversion and calculation

- Hash the clean M53 file and require the accepted `4ad28f...` bytes; the complete existing M53 test/replay suite remains unchanged and green.
- Golden M56 adapter test independently obtains all exact values in the arithmetic table and a byte-stable result hash.
- Verify exact `12346.000 kWh / 1000 = 12.346000 MWh`, with no discarded non-zero digit and no float use. Reject `12346`, `12346.00`, exponent/sign/comma forms, alternate unit/case, negative/non-finite/overflow, and every value other than the reviewed snapshot.
- Mutation tests alter each lineage ID/value, service date, geography, authority hash, factor/GWP field, conversion rule, trace item, total, classification and result hash. Each refuses without a partial record.
- Replay verifies canonical bytes and current authorized lineage, rejects a recomputed outer hash over fabricated content, and never upgrades an old record.

### Database, RLS and concurrency

- Apply 0001–0003 from a clean database; inspect both M56 tables for enabled/forced RLS, fixed-search-path writer, exact grants and all composite relationships.
- Two-tenant tests substitute every evidence, version, activity, facility, boundary, calculation and audit ID independently and in combinations. All reads are absent and all writes fail without a row/event.
- Owner/admin can create; member can read but cannot call the writer/create/replay; outsider, unknown, revoked and signed-out identities reveal nothing.
- Direct authenticated insert/update/delete/truncate and direct writer execution fail. Calculation and audit rows are append-only.
- Stale and invalid cases cover version 1, missing/later version, missing correction, extraction mismatch, activity not pinned to v2, wrong quantities/unit, missing boundary-facility inclusion, non-draft/wrong boundary version/year/approach, and missing/foreign CAMX.
- Parallel identical calls produce one adapter dispatch in the supported local server, one calculation ID, one result hash and one `calculation.created` event. Different-key and same-key conflicts follow the idempotency table. An injected failure between result and audit proves atomic rollback.
- Stored canonical text is byte-equivalent after parse/recanonicalization; every stored digest is recomputed before response. A database payload/hash canary is refused rather than displayed.

### API, process, UI and production exclusion

- Route tests prove origin-before-auth, auth-before-lookup/body work, exact request bodies, role behavior, foreign/unknown indistinguishability, bounded status/messages and no transient stale total.
- Spies prove one child dispatch, two-second termination, size caps, no retry, no network/credential/environment access, no child stderr or payload in logs, and no database write on every failure.
- Browser tests cover linked bill to result, revisit, full trace, download, exact replay, member view-only, signed-out/foreign refusal, focus/status/alert semantics, keyboard path, 200% zoom and 390-pixel width.
- Browser storage contains only the existing synthetic workspace/evidence pointers; it contains no token, calculation, result, hash, quantity or foreign identifier.
- Production API and web builds exclude the M56 service/component/route, feature flag, fixture values, method/factor strings and result. Production entry points do not import the adapter, migration runner or synthetic calculation service.
- Run focused Python, database, API and web suites, both TypeScript checks, lint, production build and existing M53–M55 regressions. Independent accounting and tenant-security reviewers challenge the exact frozen file manifest; the implementation author is not the sole reviewer.

M56 is complete only when the ordinary local browser journey and all refusal, replay, concurrency, RLS, hash and production-exclusion checks pass against one exact candidate. A correct number, a schema row or a screenshot alone is insufficient.

## Material risks and limitations

| Risk | Consequence | Required treatment |
|---|---|---|
| In-place changes to M53 alter its self-hash | Previously accepted M53 replay and review binding become invalid | Restore M53; put all quantity/conversion work in the M56 adapter; pin both hashes |
| Browser or API supplies a ready-made result | An authorized user could forge a calculation and audit trail | Accept opaque IDs only; trusted service builds and verifies canonical result; writer is not browser-callable |
| Independent same-tenant foreign keys do not bind one lineage | A result may combine valid rows that were never related | Add composite parent keys/FKs and transactional joins/rechecks |
| Hardcoded global input hash omits randomized row IDs | Results from different lineages appear equivalent | Compute the input hash per authorized snapshot and bind all IDs, versions and subordinate hashes |
| JSONB equality is not canonical byte equality | Whitespace/key-order variants and lying hashes can enter storage | Store canonical text; parse/recanonicalize/re-hash on write/read; pin typed fields |
| Annual M53 fixture period is copied into M56 | January evidence is misrepresented | Keep M53 only as authority probe; use January dates in M56 input/result and verify they fall in 2023 |
| In-memory single-flight is not distributed coordination | Multiple future servers could calculate twice, although DB uniqueness prevents duplicate rows | Claim only single-server local behavior; require a durable job/lock design before production |
| PGlite is not hosted PostgreSQL | Hosted roles, RLS, transactions and extension behavior remain unproved | Keep local-only; require a later hosted security rehearsal |
| Fixed result and fixed factor remain development candidates | Correct mechanics could be mistaken for an approved inventory | Show `draft`, `not_released`, `release_eligible=false` everywhere; exclude production |
| Replay depends on retained exact implementation bytes | Deleting or silently replacing adapters makes history unverifiable | Preserve versioned bytes/pins; fail closed; design retention before customer use |
| Audit/log retention and qualified accounting approval are absent | M56 is not assurance or a filing-ready control | State the limitation and require separate governance/accounting review before release |

This contract authorizes only the described local synthetic implementation and validation. It does not authorize customer data, arbitrary bills, factor/source expansion, hosted services, production credentials, deployment, merge, publication, filing, assurance or release.
