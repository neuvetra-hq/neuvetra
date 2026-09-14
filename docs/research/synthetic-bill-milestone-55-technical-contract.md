# M55 technical contract proposal — one synthetic electricity bill

> **Integration disposition (CEO, 2026-09-13): Superseded as an implementation contract.** This pre-implementation proposal conflicts with the board-authorized CPO journey on fixture type and correction value: it proposes a UTF-8 text fixture and `12,300 kWh`, while the accepted product brief requires the fixed PDF and `12,345 → 12,346 kWh`. It also proposes a null cache, while the integrated candidate uses an RLS-protected, tenant/version-bound summary cache. The accepted product brief and [integrated milestone record](synthetic-bill-milestone-55.md) govern M55. This file remains as design history and does not define release acceptance.

**Status:** superseded pre-implementation proposal
**Date:** September 13, 2026
**Owner:** CTO, with data and security responsibilities
**Depends on:** accepted M54 company workspace foundation

## Decision and boundary

M55 will let an authenticated owner or administrator of the fixed M54 synthetic company intake one checked-in synthetic electricity bill, process it with deterministic local code, review one evidenced correction, and link the reviewed value to one draft inventory activity. The result remains a development demonstration. It does not calculate emissions, select a factor, approve an inventory, or establish customer readiness.

The implementation must extend M54 rather than bypass it. The company, facility, reporting boundary, membership roles, `auth.uid()` identity, composite tenant foreign keys, forced row-level security, local PGlite harness, fixed synthetic bearer identities, origin checks, and development/test startup guard remain authoritative.

Only local synthetic data is permitted. The implementation must not read environment credentials, call a remote service, accept customer files, invoke OCR or a model, deploy, merge, publish, or release. The production web build must continue to exclude the synthetic workspace and M55 bill surface.

### Fixed demonstration

The only accepted source is a checked-in UTF-8 text fixture with fixture ID `m55-electricity-bill-v1`. A text fixture is deliberate: it proves the evidence, extraction, review, linkage, tenancy, and failure contracts without adding a PDF library or implying OCR capability.

The fixture has exactly one billed quantity and one explicit adjustment note:

| Field | Fixed value | Meaning |
|---|---:|---|
| Document label | `NEUVETRA SYNTHETIC ELECTRICITY BILL v1` | Synthetic marker; required at byte zero |
| Bill reference | `M55-SYNTHETIC-ELECTRICITY-001` | Non-customer fixture identifier |
| Service start | `2023-01-01` | Inclusive |
| Service end | `2023-01-31` | Inclusive |
| Billed electricity | `12345 kWh` | Deterministic extraction candidate |
| Adjustment note | `12300 kWh` | Value an authorized reviewer may accept |

The exact fixture bytes, byte length, SHA-256 digest, media type, original filename, fixture schema version, and parser version must be pinned in a checked-in manifest. The values above are the content contract; their byte offsets, final digest, and byte length are established only after the fixture is created and frozen. The manifest and fixture must be reviewed together. Editing either creates a new fixture/version; an existing version is never overwritten.

## Stage invariants

| Stage | Required input | Durable output | Gate to next stage |
|---|---|---|---|
| 1. Resolve tenant | Authenticated user and workspace path | None | Workspace is visible through M54 RLS |
| 2. Verify fixture | Server-owned fixture ID | Verified bytes, digest, length and manifest metadata in memory | Exact digest, length, media type and UTF-8 preflight match |
| 3. Preserve original | Verified bytes and tenant | Immutable object, document and version rows | One atomic transaction succeeds |
| 4. Process | Persisted version and one queued job | Immutable extraction or a terminal failed job | Job owns the same company/version; one attempt only |
| 5. Review | Successful extraction | Append-only review revision | Owner/admin accepts the pinned adjustment with its source locator |
| 6. Link | Latest accepted review | One draft inventory activity | Facility and boundary belong to the same company; period is within 2023 |

No stage may infer success from a browser value, cache entry, log line, or object key alone. The database row protected by RLS and composite foreign keys is authoritative. A later stage must refuse if any preceding durable record is absent, foreign, nonterminal, failed, or inconsistent.

## Storage and database contract

The smallest local implementation stores the original bytes in PostgreSQL/PGlite as a `bytea` object. This is a local object-store substitute behind an interface, so the same tenant and immutability rules are executable now. It is not evidence that hosted object storage is configured or isolated.

Migration `0002_synthetic_bill_evidence.sql` is additive and creates the following tables in schema `neuvetra`.

| Table | Required columns and constraints | Mutation rule |
|---|---|---|
| `bill_evidence_objects` | `id`, `company_id`, server-generated `storage_key`, `sha256`, `byte_size`, `media_type`, `original_bytes`, `created_at`; unique `(company_id, sha256)` and `(id, company_id)`; byte length and digest format checks | Insert once through a narrow function; no authenticated update/delete |
| `bill_documents` | `id`, `company_id`, fixed `source_kind='synthetic_fixture'`, fixed `fixture_id`, `created_by`, `created_at`; unique `(id, company_id)` | Insert once; no authenticated update/delete |
| `bill_document_versions` | `id`, `company_id`, `document_id`, `object_id`, `version_number=1`, `fixture_schema_version=1`, `parser_version`, `original_filename`, pinned digest/length/media type, `intake_idempotency_key`, `created_by`, `created_at`; composite FKs to document and object; unique `(company_id, document_id, version_number)` and `(company_id, intake_idempotency_key)` | Insert once; no overwrite, update or delete |
| `bill_processing_jobs` | `id`, `company_id`, `document_version_id`, state `queued|running|succeeded|failed`, `attempt_count` constrained to `0..1`, bounded `failure_code`, timestamps, `created_by`; composite FK and one job per version/parser | State transitions only through a security-definer function; never store exception text or response content |
| `bill_extractions` | `id`, `company_id`, `document_version_id`, `job_id`, exact service dates, `candidate_kwh=12345`, optional `adjustment_kwh=12300`, fixed unit `kWh`, bill reference, parser version, typed source line/byte locators, `created_at`; composite FKs; one successful extraction per version/parser | Immutable insert after verified parsing; no authenticated update/delete |
| `bill_review_revisions` | `id`, `company_id`, `extraction_id`, monotonic `revision`, decision `accept_with_correction`, field `electricity_kwh`, `before_kwh=12345`, `after_kwh=12300`, reason code `fixture_adjustment_note`, exact adjustment locator, `review_idempotency_key`, `reviewed_by`, `reviewed_at`, `previous_revision_id`; composite self/extraction FKs and unique revision/idempotency constraints | Append only; owner/admin only through a function; no update/delete |
| `inventory_activity_drafts` | `id`, `company_id`, `facility_id`, `boundary_id`, `document_version_id`, `extraction_id`, `review_revision_id`, service dates, `quantity_kwh=12300`, classification `scope_2_purchased_electricity`, status `evidence_ready_method_pending`, `link_idempotency_key`, `created_by`, `created_at`; composite FKs to every parent; unique one activity for the reviewed bill and unique tenant/idempotency key | Insert once after accepted review; no emissions result or factor columns |
| `bill_audit_events` | `id`, `company_id`, `actor_user_id`, event code, subject type/id, bounded typed metadata, `created_at`; composite tenant relationship where applicable | Append only through the stage functions; readable under tenant RLS, never updated/deleted |

Every M55 table carries `company_id`, has `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY`, and uses the existing `is_company_member(company_id)` / `can_manage_company(company_id)` functions. Every tenant relationship uses a composite foreign key containing `company_id`; globally unique UUIDs are not accepted as a tenant boundary. All tables expose member reads only through RLS. Raw bytes, job transitions, reviews, draft linkage, and audit writes occur only through narrow functions with a fixed `search_path`, revoked `PUBLIC` execution, explicit `authenticated` grants, and an internal `auth.uid()` membership/role check.

Authenticated users receive no direct `UPDATE` or `DELETE` grant on evidence, extraction, review, activity, job, or audit tables. The migration must state grants table by table; it must not rely on M54's `grant select on all tables` ordering to grant future tables implicitly.

### Immutability and integrity

- The server computes SHA-256 from the actual bytes before persistence. It must then read the stored bytes and recompute the digest before processing. A manifest string or request value is never treated as proof of bytes.
- The database stores the same digest and byte length on the object and version. The insert function rejects disagreement.
- The storage key is generated from trusted values as `companies/{company_id}/bill-evidence/sha256/{sha256}`. Callers cannot supply a path, separator, URI, bucket, or tenant prefix.
- Document/version, extraction, review, and draft rows preserve lineage. Effective activity is derived from the accepted review revision; candidate values are not overwritten.
- Source locators are typed line and byte ranges within the verified object. The database or service rejects negative, reversed, or out-of-bounds ranges.
- Quantities are decimal/integer strings at the API boundary and exact numeric/integer values in the database. JavaScript binary floating-point is not used for accounting values.

## Deterministic extraction contract

Extraction is a pure local function in an isolated module:

```ts
interface VerifiedBillBytes {
  fixtureId: "m55-electricity-bill-v1"
  bytes: Uint8Array
  sha256: string
  byteSize: number
  mediaType: "text/plain; charset=utf-8"
  fixtureSchemaVersion: 1
}

interface SyntheticBillExtraction {
  billReference: "M55-SYNTHETIC-ELECTRICITY-001"
  serviceStart: "2023-01-01"
  serviceEnd: "2023-01-31"
  candidateKwh: "12345"
  adjustmentKwh: "12300"
  unit: "kWh"
  locators: {
    candidate: { startLine: number; endLine: number; startByte: number; endByte: number }
    adjustment: { startLine: number; endLine: number; startByte: number; endByte: number }
  }
  parserVersion: "m55-electricity-text-v1"
}

function extractSyntheticElectricityBill(input: VerifiedBillBytes): SyntheticBillExtraction
```

The parser accepts only the pinned digest and length, strict UTF-8, LF line endings, the exact header, exact field set and order, ISO dates, base-10 whole-number quantities, and literal unit `kWh`. It rejects a BOM, CRLF, duplicate or extra fields, alternate Unicode whitespace, thousands separators, signs, decimals, exponents, overflow, an end date before start, a date outside 2023, trailing content, or a locator outside the byte array. It has no filesystem, database, clock, environment, network, OCR, model, logging, retry, or tenant access.

The job runner receives a trusted `{actorUserId, companyId, documentVersionId, jobId}` context from the service. It reloads the version and object under that actor's RLS context, verifies bytes again, transitions exactly `queued -> running -> succeeded|failed`, and dispatches the parser once. It does not retry. A parser failure records only a finite code such as `hash_mismatch`, `unsupported_encoding`, `invalid_shape`, `invalid_value`, or `locator_invalid`; it creates no extraction, review, or activity.

## Review and draft linkage

The initial extraction is a candidate, not an inventory activity. The UI shows the billed `12345 kWh`, the fixture's `12300 kWh` adjustment note, their source locators, the original digest/version, and a pending-review state.

Only an M54 `owner` or `admin` may append the fixed correction. The service reloads the extraction and verified source bytes, confirms the submitted before/after values and adjustment locator match the extracted fields, and appends revision 1. A `member` may view tenant data but cannot review or link it. The actor ID comes only from authentication.

The link operation accepts no quantity, period, classification, facility, boundary, company, source, factor, or emissions value from the browser. It derives the effective `12300 kWh`, inclusive service dates, fixed Scope 2 classification, M54 facility, and M54 draft boundary from server-side records. It verifies that the service period lies wholly within reporting year 2023 and that every referenced row belongs to the same company. The created status `evidence_ready_method_pending` means evidence is linked but a factor, calculation method, emissions result, uncertainty treatment, and approval are still absent.

## Application interfaces and routes

```ts
interface SyntheticBillStore {
  intake(userId: string, workspaceId: string, input: IntakeSyntheticBillInput): Promise<BillEvidenceView>
  find(userId: string, workspaceId: string, documentId: string): Promise<BillEvidenceView | null>
  review(userId: string, workspaceId: string, documentId: string, input: ReviewSyntheticBillInput): Promise<BillEvidenceView | null>
  linkDraft(userId: string, workspaceId: string, documentId: string, input: LinkSyntheticBillInput): Promise<BillEvidenceView | null>
}

interface BillObjectStore {
  putOriginal(context: TenantActorContext, input: VerifiedBillBytes): Promise<StoredBillObject>
  getOriginal(context: TenantActorContext, objectId: string): Promise<StoredBillObject | null>
}

interface BillJobRunner {
  processOnce(context: TenantActorContext, jobId: string): Promise<"succeeded" | "failed">
}

interface BillCache {
  // M55 implementation is NullBillCache: no reads, writes or retained values.
}

interface BillEventSink {
  write(event: {
    companyId: string
    actorUserId: string
    correlationId: string
    eventCode: BillEventCode
    subjectId: string
    outcome: "succeeded" | "refused" | "failed"
  }): void
}
```

`TenantActorContext` is constructed after authentication and tenant resolution. Route bodies never include it. The object-store implementation delegates to the RLS-protected database object functions; it does not expose generic keys or list operations. `NullBillCache` is mandatory for M55. It makes cache isolation explicit by retaining no raw bytes, extraction, review, activity, authorization result, or not-found result. A future cache is a new reviewed milestone and must include `companyId` in every key and authorization on every fill/read.

| Route | Exact accepted body | Success |
|---|---|---|
| `POST /workspace/:workspaceId/bills/synthetic` | `{ "fixtureId": "m55-electricity-bill-v1", "idempotencyKey": "<bounded UUID>" }` | `201` after original preservation and one terminal processing attempt; exact replay returns `200` with the same IDs |
| `GET /workspace/:workspaceId/bills/:documentId` | none | `200` tenant-safe summary; it does not return original bytes |
| `POST /workspace/:workspaceId/bills/:documentId/reviews` | `{ "extractionId": "<UUID>", "decision": "accept_with_correction", "field": "electricity_kwh", "beforeKwh": "12345", "afterKwh": "12300", "reasonCode": "fixture_adjustment_note", "locator": { ...exact extracted adjustment locator... }, "idempotencyKey": "<bounded UUID>" }` | `201` append-only revision; exact replay returns `200` |
| `POST /workspace/:workspaceId/bills/:documentId/draft-link` | `{ "idempotencyKey": "<bounded UUID>" }` | `201` one linked draft; exact replay returns `200` |

Each parser checks an exact key set, fixed literals, UUID format, and bounded string length. Extra keys fail. All write routes enforce the existing allowed-origin rule before authentication; reads reject an explicitly foreign origin while permitting an origin-less authenticated read, matching the repaired M54 behavior. Authentication precedes body parsing and resource lookup. The tenant is resolved under RLS before any object, job, extraction, review, or activity access.

The response decoder in the web app also checks an exact finite shape. It exposes metadata, digest, byte size, processing state, extracted candidate, correction history, effective quantity, source locators, and draft-link status. It never exposes the synthetic token, actor IDs, storage key, raw bytes, SQL/exception detail, or other-tenant identifiers.

## Duplicate, missing-data and error behavior

| Condition | Required result | Side-effect rule |
|---|---|---|
| Missing/invalid bearer identity | `401 Authentication required.` | No body parse, tenant lookup, storage, job, cache or audit payload |
| Explicit foreign origin | `403 Forbidden.` | Checked before authentication and all state access |
| Wrong fixture ID, extra/missing body key, invalid UUID/value | `422 Invalid synthetic bill request.` | No persistent write |
| Unknown or foreign workspace/document/extraction | Same `404 Bill evidence not found.` | No distinction, foreign metadata, downstream job or storage read |
| Exact idempotency replay with identical operation fingerprint | Existing result with `200` | No second object, version, job, revision, activity or success event |
| Reused idempotency key with different fingerprint | `409 Synthetic bill operation conflicts.` | No mutation |
| Same tenant/fixture/version submitted under a new key | `409 Synthetic bill already exists.` | No duplicate object/version/job |
| Fixture missing or manifest digest/length/media type mismatch before intake | `503 Synthetic bill is unavailable.` | No database/object/job row |
| Database/object transaction failure | `503 Synthetic bill is unavailable.` | Atomic rollback; no partial object metadata or job |
| Stored-byte digest mismatch or deterministic parse rejection during intake | `201` bill view with the preserved version and terminal `failed` job | Original/version remain immutable; no extraction/review/activity; one finite failure code |
| Job claimed twice, attempt already terminal, or attempt count would exceed one | Existing terminal state or `409 Processing state conflicts.` | No redispatch or retry |
| Review before successful extraction; locator/value does not match source | `409 Bill is not ready for review.` or `422 Invalid bill review.` | No revision or activity |
| Member attempts review/link | `403 Insufficient company role.` | No mutation; does not reveal foreign resources |
| Link before accepted review, missing facility/boundary, period outside boundary, or non-draft boundary | `409 Bill is not ready to link.` | No activity |
| Foreign IDs substituted into review/link body | `404 Bill evidence not found.` | Composite FKs and RLS prevent attachment/inference |
| Unexpected exception | Bounded `503 Bill evidence is unavailable.` | No exception, SQL, bytes, source text, path, stack or credential value in response/log |

The operation fingerprint is a server-computed digest of the route name, authenticated company, target IDs, and canonical validated input. It contains no raw bill bytes. Idempotency and uniqueness are enforced in the database, so concurrent identical requests cannot pass a check-then-insert race.

## Tenant behavior by layer

| Layer | M55 rule | Executable proof |
|---|---|---|
| Database | `company_id` on every row; forced RLS; composite tenant FKs; manager-only state changes | Two-company direct SQL tests for every table, function and relationship |
| Original storage | Database-backed immutable bytes; server-generated company-prefixed key; no generic list/path input | Foreign read/update/delete and cross-company version/object link fail |
| Job | DB-authoritative tenant/version binding; one attempt; no retries; finite failure code | Foreign claim and altered company/version fail; second dispatch does not call parser |
| Cache | `NullBillCache`; no retained entries | Spy shows zero cache reads/writes on success, refusal and failure paths |
| Audit history | Append-only `bill_audit_events` under RLS | Member sees own-company events only; outsider sees none; no update/delete grant |
| Operational logs | Internal structured allowlist requires company/correlation/event/outcome; never browser-readable | Captured sink contains no bytes, extracted source text, storage key, reason text, token, SQL or stack |
| Browser | Receives a bounded summary after API/RLS authorization | Foreign IDs yield the same absent state; local storage contains no bill data or token |

Operational logs are diagnostic signals, not authoritative audit history. The database event row is the durable history. Refused unauthenticated requests cannot safely name a company and therefore emit only a correlation ID plus a generic refusal code; no claimed tenant from a path/body is trusted in logs.

## File ownership proposal

Implementation is restricted to the following bounded areas. No dependency should be added; Bun, Web Crypto, Elysia, PGlite, React, and the current test stack are sufficient.

| Owner | Proposed files | Responsibility |
|---|---|---|
| Data/database | `packages/neuvetra-database/src/migrations/0002_synthetic_bill_evidence.sql`, `packages/neuvetra-database/src/synthetic-bill.ts`, `packages/neuvetra-database/src/synthetic-bill.test.ts`, narrow exports in `src/index.ts` | Schema, RLS/functions/grants, immutable local object store, job transitions, lineage, two-tenant tests |
| API/backend | `apps/site-api/src/workspace/synthetic-bill-types.ts`, `synthetic-bill-fixture.ts`, `synthetic-bill-parser.ts`, `synthetic-bill-service.ts`, `synthetic-bill-routes.ts` and focused tests; narrow composition changes in `workspace/server.ts` | Manifest/byte verification, pure parser, orchestration, exact routes, safe errors, one-attempt runner, log allowlist, null cache |
| Synthetic evidence | `data/synthetic/m55-electricity-bill-v1.txt`, `data/synthetic/m55-electricity-bill-v1.manifest.json` | Reviewed immutable fixture and exact hash/version/length/media metadata |
| Web | `apps/site-web/src/components/SyntheticBillDemo.tsx` and test; bounded extensions to `src/lib/workspace-api.ts` and `CompanyWorkspaceDemo.tsx` | Development-only intake, review, lineage and link demonstration; strict response decoding and accessible states |
| QA | Focused integration test under the existing API/web/database test locations and independent review artifact | Adversarial tenant, mutation, duplicate, error, production-exclusion and regression evidence |

The implementation owner may adjust filenames to match package conventions, but must not spread bill logic into the legacy chat/provider pipeline. The parser must remain independent of HTTP, database and UI code.

## Migration and rollback

1. Add migration 0002 as one transaction after M54 migration 0001. There is no data backfill and no change to existing M54 rows or policies.
2. Create tables and constraints first, then functions, RLS policies, revocations and explicit grants. Fail migration if any function cannot use a fixed search path or any tenant table lacks forced RLS.
3. Update only the local `DevelopmentWorkspaceDatabase.create()` path to apply 0001 then 0002. Hosted migration, credentials and production schema compatibility remain untested and unauthorized.
4. For this memory-only milestone, rollback means stop the local server, close PGlite, remove the local fixture build output if any, and recreate from 0001. Do not run destructive SQL against a persistent database.
5. If a code rollback is needed after 0002 exists in a durable environment, disable the M55 route/surface and use a separately reviewed forward migration. Dropping evidence tables or deleting originals is outside M55 because no retention/deletion policy has been approved.

The M55 startup guard must be separate and explicit, for example `M55_SYNTHETIC_BILL=enabled`, in addition to the M54 synthetic workspace guard and `NODE_ENV` being exactly `development` or `test`. Any missing or contradictory value prevents the bill routes and fixture from loading. No server startup may enumerate OneDrive or create files outside the repository fixture and ordinary bounded build/test outputs.

## Acceptance checks

### Fixture and parser

- Recompute SHA-256 and byte length from checked-in bytes and match the manifest and persisted version.
- Golden parse proves every exact value and source byte/line locator.
- Table-driven invalid fixtures cover one-byte mutation, truncation, extension, BOM, CRLF, invalid UTF-8, duplicate/missing/extra/reordered fields, bad dates, reversed dates, wrong year, negative/decimal/exponent/overflow quantities, wrong/case-changed unit, Unicode whitespace, and trailing content.
- A parser spy proves one dispatch and no access to filesystem, environment, clock, network, database, logger, OCR, model or credentials.

### Database, storage and job

- Migration and schema inspection prove all eight tables have enabled and forced RLS, explicit grants, expected constraints, and fixed-search-path functions with `PUBLIC` revoked.
- Owner/admin/member/outsider tests cover reads and every write function. Direct authenticated update/delete of originals, extractions, reviews, drafts and audit events fails.
- A two-company matrix attempts foreign reads on every table and cross-company object/version/job/extraction/review/facility/boundary/activity links. Each returns no row or raises a bounded authorization/integrity failure without committing.
- Stored bytes are read back and rehashed. A mutated stored object, metadata mismatch, foreign key substitution, invalid locator, and absent parent all fail closed.
- Parallel duplicate intake/review/link calls create exactly one version, job, review and activity. Exact key replay returns the same IDs; conflicting reuse and a new key for the same fixture refuse.
- Job tests prove only `queued -> running -> terminal`, one parser call, attempt count at most one, no retry after thrown or validation errors, finite safe failure codes, and no downstream rows after failure.

### API, cache, logs and UI

- Route tests cover exact request/response shapes, status codes in the failure table, origin-before-auth ordering, auth-before-lookup ordering, role checks, missing/foreign indistinguishability, and bounded thrown-error responses.
- Request bodies containing `companyId`, `userId`, facility/boundary overrides, quantity overrides, bytes, paths, URLs, factors, emissions, or extra keys return 422.
- `NullBillCache` spies show no cache retention on success, replay, refusal or failure.
- Captured operational and audit events contain only allowed fields; seeded tokens, raw fixture lines, correction reason prose, storage keys, SQL messages, stack traces and exception canaries never appear.
- UI tests cover intake, pending review, accepted correction history, source locator display, effective quantity, linked draft, signed-out state, member role refusal, foreign record absence, processing failure, and keyboard/screen-reader status updates.
- Browser storage inspection shows no bearer token, raw bill, extraction, review, activity or foreign ID persisted.
- Production build inspection finds none of the M55 component, fixture ID, fixed values, synthetic tokens, route strings, manifest content or feature flag.

### Regression and review

- Existing M54 database/API/web tests remain green, followed by relevant type checks, lint and the production build.
- The integrated local demonstration starts from a clean database, creates the M54 workspace, intakes and verifies the original, processes once, appends the reviewed correction, links the draft, revisits it, and reproduces signed-out/foreign/member refusals.
- Independent QA reviews the exact fixture/manifest/code bytes and challenges RLS, storage, job, error, duplicate, correction and linkage behavior. The author cannot be the sole reviewer.

## Material risks and explicit limitations

| Risk or limitation | Consequence | M55 treatment |
|---|---|---|
| PGlite and database-backed bytes are local substitutes | Hosted PostgreSQL and object-storage policy compatibility are unproved | State this in UI/evidence; defer hosted rehearsal |
| UTF-8 fixture is not a PDF/image | OCR, PDF parsing, malware scanning and arbitrary upload safety are unproved | Reject all other fixture IDs/media; treat PDF intake as a later milestone |
| Fixed parser recognizes one document | It does not generalize to utility formats | Fail closed on any byte/shape change |
| Review correction is synthetic | It is workflow evidence, not professional verification | Preserve candidate, source note, actor and revision; label synthetic throughout |
| No factor or calculation | Linked kWh is not an emissions result | Use `evidence_ready_method_pending`; expose no CO2e field |
| Local synchronous job execution | Queue durability, leasing and multi-worker behavior are unproved | One DB-authoritative attempt; no retry; defer durable workers |
| No retained cache | Performance behavior is unmeasured | Use `NullBillCache`; require a separate cache-isolation milestone before enabling |
| Audit/log retention and operator access are undefined | Production governance is incomplete | Keep audit append-only locally; do not claim a production retention policy |
| Original deletion is intentionally absent | Privacy/retention deletion lifecycle is unproved | Synthetic-only bytes; no customer intake until policy and deletion are designed/tested |
| Inclusive service-end semantics may differ from future importers | Later integrations could double-count dates | Store and label inclusive dates; require explicit conversion at future adapter boundaries |

M55 is complete only when the bounded local demonstration and all checks above pass against the exact reviewed fixture bytes. A schema file, fixture hash, UI screenshot, or happy-path test alone is insufficient.
