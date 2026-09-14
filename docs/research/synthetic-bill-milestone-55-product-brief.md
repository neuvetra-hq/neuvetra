# M55 product brief — synthetic electricity bill intake and correction

**Status:** Board-authorized product brief for implementation and independent review
**Product owner:** CPO, reporting to CEO
**Milestone boundary:** One fixed synthetic electricity bill inside the accepted local M54 tenant boundary

## Intended user and outcome

The user is a signed-in owner or administrator of the M54 development workspace for **Synthetic Acme, Inc.** They need to turn one clearly fictional electricity bill for **Synthetic California office** into reviewed, versioned evidence that can be linked to the existing 2023 draft reporting boundary.

The successful demonstration ends with a **draft inventory evidence link**, not an emissions calculation. The user can see the original bill identity, deterministic extracted values, their review decision, any correction, the immutable history, and the exact evidence version linked to the draft. A member may view authorized records but cannot upload, correct, approve or link them. A signed-out or foreign user learns nothing about the record.

## Fixed fixture and supported scope

M55 supports one repository-owned fixture created only for this demonstration:

- Document label: **Synthetic California office — January 2023 electricity bill**
- Clearly fictional utility: **Synthetic Golden State Electric**
- Clearly synthetic account label: **SYNTHETIC-0001**
- Service period: **January 1–31, 2023**
- Electricity use: **12,345 kWh**
- Intended company: **Synthetic Acme, Inc.**
- Intended facility: **Synthetic California office**, US / CA / CAMX
- Intended boundary: the existing **2023 operational-control draft, version 1**

The fixture must have a fixed filename, media type, byte length and SHA-256 digest recorded in the implementation evidence. Only its exact supported structure is parsed. The parser is deterministic local code: the same bytes and parser version produce the same field values and statuses. No OCR, model, external provider, network service or free-form inference participates.

Facility assignment is never inferred from the bill. After extraction, the item remains **Needs review** until the user explicitly selects the authorized M54 facility, confirms the service period, use and unit, and records a review decision. The demonstration includes one deliberate correction: the reviewer changes the extracted use from `12,345 kWh` to `12,346 kWh` with reason **Synthetic review exercise**. The product labels this as a reviewer override; it does not claim that the override is more accurate than the document.

## User journey

1. The signed-in owner opens the existing company workspace and chooses **Add electricity bill**.
2. The user selects the fixed synthetic fixture. Before submission, the page names the company and explains that upload does not add emissions to an inventory.
3. Intake creates one immutable original record containing its tenant/company ownership, digest, filename, media type, byte length, upload time and actor. It creates a tenant-scoped deterministic extraction task.
4. The UI moves through understandable states: **Uploading**, **Extracting**, then **Needs review**. A failed intake or extraction never appears as ready or linked.
5. The review view presents document values beside editable reviewed values. It highlights the missing facility decision and any missing or invalid required field. The user selects **Synthetic California office**, confirms the dates and unit, changes use to `12,346`, enters the correction reason and saves.
6. Saving creates immutable evidence version 2. Version 1 remains the untouched parser result. The history identifies who changed what, when and why, without changing the original file metadata.
7. The user links version 2 to the 2023 draft boundary. The link names the company, facility, boundary version, evidence record and evidence version. It remains **Draft evidence — no emissions calculated**.
8. Revisiting the workspace reproduces the original, both versions, the correction reason and the exact pinned draft link. A later evidence version would not silently change that link.

## Product rules

### Intake and deterministic extraction

- Authorization is derived from the authenticated server/database context. A browser-supplied company, user, storage path, job owner or cache namespace cannot grant access.
- The server accepts only the fixed fixture contract and bounded request shape. Unsupported type, changed bytes, excessive size, malformed multipart data or unexpected fields produce a safe refusal before parsing.
- The original is write-once. Its digest, length and media type are verified after intake and again before extraction. A task is bound to the tenant, company, original digest and parser version.
- Extraction yields typed fields with source labels: service start, service end, use value, unit, utility label and account label. Decimal and date handling is deterministic; no locale guess or hidden default is allowed.
- Extraction never assigns a facility, boundary, factor, Scope 2 method or emissions value.

### Review, correction and history

- Parsed values are proposals until explicitly reviewed. The UI and API distinguish `needs_review`, `reviewed` and `linked_draft`; extraction completion alone cannot set a review state.
- Required review fields are facility, service dates, use, unit and reviewer decision. Missing or invalid values identify the affected field and block linking.
- A correction requires a nonblank reason. Saving creates a new immutable version with the prior version ID, actor, timestamp and field-level change record. It never updates or deletes prior version bytes.
- Identical retries of the same correction request are idempotent. Concurrent edits against an old version are refused with a visible **This record changed; review the latest version** state rather than silently winning.
- History is append-only for this milestone. The demonstration offers no delete, replace, purge or history-rewrite action.

### Draft inventory linkage

- The selected facility must belong to the same company and be included in the selected reporting boundary. Composite database relationships enforce this; an opaque ID is not authorization.
- The bill service period must fall within the 2023 boundary. A missing, inverted or outside-period date blocks linkage and explains why.
- A draft link pins the exact evidence version. Re-review or correction creates another version and does not mutate an existing link.
- Duplicate links of the same evidence version to the same draft/facility are idempotent. A different tenant's evidence, facility or boundary is indistinguishable from an unknown record.
- The link carries activity evidence only. M55 does not choose an eGRID factor, calculate CO2, CH4, N2O or CO2e, classify market-based instruments, approve the boundary or submit a report.

## Meaningful states and recovery

| Trigger | User-visible outcome | Required system behavior |
| --- | --- | --- |
| Exact fixture uploaded once | Uploading → Extracting → Needs review | Preserve immutable original and one extraction version; no inventory link yet. |
| Exact same bytes uploaded again in the same company | **Already uploaded** with a link to the existing item | Create no second original, task or version. The response is idempotent and names no other tenant. |
| Same digest exists only in another tenant | Behave like a first upload for the authorized tenant | Do not reveal cross-tenant existence, identifiers, timing or metadata; never reuse the other tenant's record. |
| Facility has not been selected | **Facility required** | Preserve extracted values, block review completion and linkage, and focus/associate the facility error. |
| Use, unit or service date is absent or invalid in a controlled parser test | **Review required** on the affected field | Do not default a value, geography or period; allow an authorized reviewer to supply a value with a reason in a new version. |
| Unsupported, modified or malformed file | **This file cannot be processed in this demo** | Create no accepted extraction or draft link; retain only the minimum safe refusal evidence required for review. |
| Extraction task fails or its digest/parser binding changes | **Extraction failed — no inventory data added** | Fail closed, allow a bounded local retry only if implementation scope explicitly includes idempotent retry, and never interpret logs or partial rows as success. |
| Correction is missing its reason | **Explain why this value changed** | Reject the save without creating a version. |
| Stale concurrent edit | **This record changed; review the latest version** | Create no partial version and show the current version after acknowledgement. |
| Foreign or unknown bill/version/link ID | **Evidence not found** | Return the same status and response shape with no foreign metadata. |
| Signed-out request | **Authentication required** | Create no original, task, version, cache entry or link. |

## Tenant and data-boundary acceptance

The M54 forced-RLS and authenticated-request behavior remains the root. M55 extends the same company scope to originals, extraction tasks, extraction versions, corrections, audit events and draft links.

Acceptance requires executable positive and negative cases for every M55 surface:

- owner/admin upload, review, correct and link; authorized member read only;
- outsider, signed-out and revoked/invalid identity refusal;
- guessed foreign original, task, version, facility, boundary and link IDs;
- attempted cross-company facility/boundary/evidence relationships rejected by database constraints and RLS;
- storage paths and signed/local read handles scoped to company and actor;
- task execution revalidates tenant and immutable input binding rather than trusting queued metadata;
- cache keys include tenant and evidence version, with no global private fallback;
- ordinary logs contain status and synthetic identifiers needed for diagnosis, but no document bytes, extracted account label, correction text, bearer identity or foreign record data;
- duplicate detection is tenant-scoped and cannot become a cross-tenant existence oracle.

## Ordinary accessible UI acceptance

- Every input has a persistent programmatic label and useful instructions; required fields and error messages are associated with their controls.
- The entire workflow works by keyboard in a logical order. Visible focus is preserved, and focus moves to the error summary only after a rejected submit.
- Upload, extraction, review, save and link status changes are announced through an appropriate live region without repeated or conflicting announcements.
- Pending actions expose text, disable duplicate submission and prevent identity/workspace switching until the request settles.
- Status, missing data, corrections and version differences are not communicated by color alone. Plain language distinguishes **Extracted**, **Needs review**, **Reviewer corrected** and **Draft linked**.
- The original metadata, extracted/reviewed comparison and version history use semantic headings, lists or tables with accessible names. Dates, `12,345 kWh`, `12,346 kWh` and version numbers remain understandable at narrow viewport and 200% zoom.
- Error recovery preserves the selected file or reviewed values when safe; it never reports success while a task, version or link is absent.

## Observable acceptance criteria

M55 passes only when an independent reviewer can reproduce all of the following on the exact candidate:

1. Create/revisit the M54 workspace, upload the exact fixture and observe one immutable original whose digest and metadata match the frozen fixture.
2. Run extraction twice from the same frozen input in isolated test state and obtain byte-equivalent typed values and the same parser version, with no network/provider/credential activity.
3. Observe `Needs review`; confirm that extraction alone cannot create a reviewed version or draft link.
4. Resolve the missing facility decision, save the specified `12,346 kWh` correction with its reason, and observe version 1 and version 2 unchanged and individually addressable.
5. Link version 2 to the exact 2023 boundary/facility and revisit it with full version identity and the label **Draft evidence — no emissions calculated**.
6. Prove same-tenant duplicate intake and duplicate link are idempotent, while an equal digest in a second tenant reveals nothing and creates an independent tenant-owned record only when that tenant uploads it.
7. Prove missing facility, invalid/missing use/unit/date, malformed file, extraction failure, absent correction reason and stale concurrent edit all block linkage without a false success or partial version.
8. Prove cross-tenant reads, writes and links fail across database, storage, task, cache and log boundaries; unknown and foreign identifiers have the same external behavior.
9. Reproduce owner/admin success, member read-only behavior, signed-out refusal and foreign-user refusal in the ordinary browser UI using keyboard and accessible status/error inspection.
10. Pass the relevant database, API and web tests, type checks, lint/build and a production-bundle exclusion check. The M55 synthetic fixture, synthetic identities and development routes must remain unavailable in production mode.
11. Obtain independent product, data/security and software QA against the exact frozen implementation and fixture hashes. Any author-only test result remains author evidence, not independent acceptance.

## Demo claim boundary

### What a passing demo proves

A pass proves that one fixed fake electricity bill can traverse a local, development-only, tenant-scoped evidence workflow: immutable intake, deterministic extraction, explicit human correction, append-only versions and a version-pinned link to one existing draft inventory boundary. It also proves the tested duplicate, missing-data, error, accessibility and cross-tenant refusal behaviors for the exact local candidate.

### What it does not prove

A pass does not prove accuracy or coverage for other bill layouts, utilities, scans, languages, units, date formats or file types. It does not prove real OCR or model extraction, hosted storage, Supabase compatibility, durable production tasks, production authentication, scale, disaster recovery, deletion, retention compliance or customer readiness. It does not calculate emissions, select or approve a factor, establish inventory completeness, approve a reporting boundary, provide accounting/legal assurance, file a report, or authorize a customer pilot.

M55 does not authorize customer data, real utility records, OCR/model providers, hosted production services, external network calls, deployment, merge, publication or release. Those require separate bounded decisions and evidence.

## Implementation and review handoff

The CTO should define the smallest schema/API/task/UI change that preserves M54's forced-RLS root and makes every original, version, task and link company-scoped. The implementation owner should freeze the fixture and parser contract before integration. Data/security QA should challenge cross-tenant storage, task, cache, log and duplicate behavior; product QA should reproduce the complete browser journey and all user-visible states. The CEO remains the only writer for shared operational status and reports the exact demonstration, review disposition and remaining limits to the board.
