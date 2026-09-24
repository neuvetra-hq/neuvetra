# M80 Scope 1 free beta technical contract

Date: 2026-09-24. Task `SCOPE1-BETA-TECHNICAL-20260924`; CTO role for CEO/root. Requested route `gpt-5.6-sol/high`; observed model and effort unavailable. Prompt SHA-256 `1368166de5ee8c4d399f3d3b4b26e94a92c99de2fd2ad6389fdf7b78f8a054f1`.

This is an implementation contract for the earliest safe M80 foundation after the verified PR5 merge at `e10012bc2b083283f99498ecb79c05d5536bbf52`. It does not authorize a database migration, deployment, invitation, customer contact, real-data upload, source/method release or production calculation. Root owns integration, Git, provider and shared records. Independent review of this exact candidate is pending.

## Current observed boundary

| Area | Current behavior inspected | Consequence for M80 |
| --- | --- | --- |
| Authentication | `apps/site-api/src/lib/auth.ts` validates every bearer token with Supabase `getUser`. `apps/site-api/src/staging/server.ts` then requires active staging access before dispatch and rate-limits by authenticated user. | Reuse the token-validation pattern. Do not treat a caller-supplied user, company, role or release flag as authority. |
| Tenant authorization | `packages/neuvetra-database/src/migrations/0009_private_staging.sql` binds `auth.uid()` to one active `staging_access` row and matching `company_members` row. Manager writes require `owner` or `admin`. The runtime role has an explicit function allowlist and no arbitrary table writes. | Every new read/write must enforce active access plus the requested `company_id` in the database, not only in UI routing. Add only named entrypoints to the runtime allowlist. |
| Deployment profile | Staging config and database receipts are fixed to `neuvetra.private-synthetic-staging.v1`; readiness currently requires schema 21. The HTTP body cap is 300,000 bytes. | The first slice stays synthetic-only. It must not smuggle real-document intake through the current JSON body path. Schema/readiness changes require a reviewed migration and explicit operator action. |
| Workspace creation | Migration 0001 hard-codes U.S./California, creates one facility, an operational-control boundary and company owner. Private staging later removes workspace/member creation from the runtime allowlist. | Existing workspace creation is not a real beta onboarding or invitation service. Do not expose it to customers. M80 needs a separate invitation/setup design before real users. |
| Scope 1 | `m78-contract.ts` fixes the period to calendar 2025, labels both profiles synthetic, keeps Scope 1 and corporate completeness incomplete, and fixes `releaseEligible:false`. `m78-policy.ts` lists four methods as an `accounting_reviewed_candidate`, also release-ineligible. | Preserve M78 as historical synthetic evidence. A beta path must be parallel and must resolve eligibility from a server-owned release record. It must not edit a caller flag or relabel M78 output as released. |
| Source methods | Four exact candidate profiles exist: stationary natural gas, controlled on-road diesel, stationary No. 2 distillate and stable serviced fugitive equipment. M79 maps 12 factor/GWP rows and seven retained originals. | These are the only calculation candidates to consider. Other fuels, vehicles, refrigerants, fire suppressants, process emissions and direct gases remain visible in the census but blocked or unsupported. |
| Numerical QA | M79 independently derived 18 cases across all 12 rows, checked seven engine boundaries and five application boundaries with 24 assertions; no discrepancy was observed. | Preserve the exact engines, units, half-even display rule and round-once aggregation. This is arithmetic compatibility, not release approval; independent numerical QA remains a Neuvetra gate. |
| Rights and release | All 21 source/use combinations across seven originals remain on product-release hold. Facts, independently expressed methods and outputs are distinguished from copied source expression, arrangement, excerpts and fulltext/RAG. No effective release record exists. | The foundation seeds all four profiles as held. No source text, tables, screenshots or fulltext enter a customer report or hosted corpus. A later release requires an immutable, source/use-specific owner decision. |
| Documents | The current workspace accepts only one fixed synthetic electricity PDF whose exact name, bytes and hash are checked. Scope 1 evidence is retained as synthetic statements, not uploaded real documents. | There is no reusable real-document upload path. Build it later as a separate storage/security slice; do not generalize the synthetic parser. |
| UI | The current private page truthfully says “Synthetic company records only.” The workspace has 13 peer navigation choices. The browser observation found 104 corporate findings, while Scope 1 separately showed 0 workflow, 11 release and 82 wider-corporate findings. | Keep synthetic/private labels until real-data gates pass. Present a focused Scope 1 journey and keep finding scopes distinct. The separately assigned navigation refinement may improve focus but does not establish beta readiness. |

## First safe implementable slice: synthetic beta foundation

Implement a parallel, synthetic-only setup and eligibility register. It should let engineering and product exercise the proposed journey without admitting real data or producing a beta calculation.

### Data contract

Create the next additive migration as `packages/neuvetra-database/src/migrations/0022_scope1_beta_foundation.sql` only after rechecking that no concurrent `0022` exists. The repository and `STAGING_MIGRATIONS` currently end at `0021_scope1_inventory.sql`; this is an observed free slot, not a reservation. If another accepted change occupies it, use the next free number and update every reference before review.

The migration should add these bounded records:

1. `scope1_beta_release_records`: immutable server-owned rows for exact profile/method/engine/factor/GWP/source-use decisions, reporting-period bounds, effective/superseded dates, exclusions and decision-artifact hashes. Status is `held_candidate`, `released`, `blocked` or `superseded`. Seed the four current exact profiles as `held_candidate`; seed no `released` row. The web runtime receives `SELECT` only. No HTTP function may insert, update, delete or promote a release row.
2. `scope1_beta_fixture_admissions`: operator-owned bindings among one existing synthetic company, one exact fixture profile/version/hash and an active state. The HTTP runtime receives `SELECT` only. No company is admitted merely because it is in private staging or carries a caller-supplied synthetic label.
3. `scope1_beta_setup_heads`: one current stream per admitted synthetic company and reporting year, with an immutable-version pointer and revision used for compare-and-swap.
4. `scope1_beta_setup_versions`: append-only canonical payload, previous-version ID/hash, company, reporting year, consolidation approach, fixture entity/location IDs, control-state enums, source census, evidence-requirement metadata, completeness declaration, creator/time and content/version hashes. The first slice accepts only the exact admitted fixture profile and `dataClassification: synthetic_rehearsal`.
5. `scope1_beta_requests` and `scope1_beta_audit`: company-scoped idempotency and append-only event proof. Reusing an idempotency key with different content fails; concurrent writes from the same head permit one successor.

All tables use forced row-level security. Company-scoped reads require active staging access and membership. Writes use one security-definer entrypoint that checks `can_manage_company`, exact predecessor/hash, the synthetic target profile, the active fixture admission and exact fixture hash, payload size/cardinality and referential consistency. Direct runtime table mutation stays revoked. History and audit tables reject update/delete; only the head pointer changes under row lock. A restored schema-21 database must retain all 121 pre-existing table digests and old objects before schema 22 is admitted. Existing roles, memberships, default privileges, old grants and old object definitions remain exact; the only allowed authorization differences are the reviewed new schema-22 policies, `SELECT` grants and execute grant on the one new bounded entrypoint.

### Intake coverage

The setup payload records company/year/boundary proposals rather than assuming them. Calendar 2025 and operational control may be offered as proposed defaults because the current four engines are fixed to those facts; UI and stored status must say they are proposals until an authorized company preparer and qualified reviewer confirm them.

The foundation fixture supplies stable entity/location/source IDs and safe synthetic display labels. The stored payload references those IDs and records only closed enum/boolean/date/decimal states for country/region, ownership/control, active period and inclusion. Each source row needs an entity/location binding, category, subtype, fuel/gas or material when known, equipment/asset kind when applicable, activity-data kind/unit and evidence-requirement status. Evidence metadata is limited to a requirement type, coverage period, state and fixed fixture reference key; there is no document, filename, issuer, contact, URL, description or free-text evidence field in this slice. The census must offer at least:

- stationary combustion fuels, including a path to identify natural gas and No. 2 distillate plus an `other fuel` value;
- mobile combustion vehicles/equipment, including diesel plus other fuel, class/model year and gallons/miles availability;
- fugitive refrigerants, refrigeration, fixed HVAC, fire suppression and other direct gas releases, without narrowing unknown gases away;
- process-emission screening across current M78 categories and the seven gas groups; and
- `other direct Scope 1 source` for any source that does not fit the known categories.

Unknown, missing and unsupported values remain rows with named blockers. A source cannot be omitted merely because no calculator exists. Removing or changing a saved fixture source requires a successor with an enumerated correction/retirement reason; it never rewrites history.

### Server eligibility registry

Add `packages/neuvetra-database/src/m80-contract.ts`, `m80-validation.ts`, `m80-fixture.ts` and `m80.ts` plus exports in `index.ts`. Add database adapters in `workspace.ts`. Add `apps/site-api/src/workspace/m80-beta-routes.ts` and mount it in `apps/site-api/src/staging/server.ts` only after focused review. `m80-fixture.ts` contains the canonical safe fixture template and hash; the operator-owned admission binds the hosted synthetic company to those exact bytes.

The server derives one of four states for every census row:

- `released_supported`: exactly one effective release row matches all validated company/year/source facts;
- `held_candidate`: an exact candidate exists but no effective release is authorized;
- `unsupported`: the source facts are understood and no released profile applies; or
- `missing_facts`: eligibility cannot be determined from the submitted facts.

The caller cannot send `releaseEligible`, a factor, a GWP, a method hash or an eligibility result. If supplied, reject the request rather than ignore it. Multiple matching releases, corrupt hashes, expired/superseded rows or an unavailable registry fail closed. The first slice must always return zero `released_supported` rows because all four seeds are held. It exposes required next facts/evidence and produces no calculation, subtotal, report or complete-company state.

### UI boundary

After the independent navigation change lands, add `apps/site-web/src/lib/m80-beta-api.ts` and a focused `Scope1BetaSetup.tsx` entry without editing the navigation files owned by that concurrent worker. The screen order is company/year and boundary proposal, locations, source census, evidence requirements, then a prioritized eligibility summary. It keeps the global synthetic/private-staging notice and labels all saved facts as synthetic rehearsal data. Advanced M71-M78 registers remain available through secondary links; old components and routes remain mounted until separately retired.

## First-slice acceptance and security tests

The implementation writer should provide these exact checks; test counts alone are insufficient.

1. **Migration and preservation:** schema 21 upgrades once to the reviewed migration; exact migration name/hash is receipted; a second run is a no-op; an occupied or changed migration refuses; all pre-22 table schemas/content/roles/memberships/default ACLs remain exact. No live migration is run without root authorization.
2. **Tenant isolation:** owner/admin of company A can save A; member can read A but cannot write; inactive access, no membership and company B actor cannot read, infer, save, download or enumerate A. Swap valid company/version/source IDs between tenants and require indistinguishable denial/not-found behavior.
3. **Database authority:** direct runtime writes to release/setup/history/audit tables fail. Only the bounded setup function can append a version. Security-definer search paths are fixed; caller IDs are not trusted; every company reference is composite-bound.
4. **Synthetic-only gate:** save requires an active operator-owned admission for the requested company and the exact bundled fixture profile/hash. The strict closed schema contains no company/person/contact/document/filename/free-text evidence fields and rejects all unknown fields, bytes/base64 and invite/calculate/export requests. This does not claim software can recognize arbitrary real data; the technical control only permits exact admitted fixture IDs/templates, and the explicit operating rule remains “no real data.” UI retains the synthetic-only notice. Logs contain fixture IDs and safe error codes, not payloads or evidence content.
5. **Release fail-closed behavior:** all four current candidates resolve `held_candidate`; other known facts resolve `unsupported`; insufficient facts resolve `missing_facts`; none returns a number. Caller-supplied release/factor/GWP/method fields fail validation. A corrupted, duplicated, expired or superseded release test fails closed.
6. **Census completeness:** fixtures cover stationary natural gas, stationary diesel, mobile diesel, supported and unsupported refrigerants/fire suppression, process screening, direct gas and an unclassified source. Unknowns survive save/read in this slice. A future export must preserve those unknowns, but export is not implemented or accepted here. No industry shortcut hides a row or turns unknown into not applicable/zero.
7. **Versioning and concurrency:** correction creates a successor and preserves the old bytes; stale predecessor/hash fails; same idempotency key plus same content returns the same record; different content fails; two concurrent successors yield one winner.
8. **API/UI decoding:** origin, bearer, active-access and body-size failures remain enforced. Strict decoders reject added/changed authority fields. Keyboard and narrow-screen checks cover the focused sequence, error recovery and plain-language blocker groups without conflating corporate, release and workflow counts.
9. **Independent review:** security challenges tenant swaps and the release registry; accounting checks that the census never calculates or narrows unsupported sources; product QA checks claims and synthetic labels on the exact frozen candidate.

Rollback for this additive slice is application rollback plus leaving append-only schema/data dormant. Do not delete schema-22 records or rewrite the migration. A destructive database rollback requires a separately authorized restored backup/clone procedure.

## Smallest M79-to-M80 critical path

1. **Focused navigation refinement, already separately assigned:** default to Scope 1, group the 13 controls accessibly, preserve every old mount and the synthetic/private labels. This is a usability increment only.
2. **Synthetic beta foundation above:** database/backend writer implements the release registry and complete source census with every current profile held. Frontend writer consumes the frozen API contract. Independent security/accounting/product review follows. This work can start now and does not wait for rights or domain approval.
3. **Release decisions for a narrow subset:** qualified accounting/domain owner and Neuvetra rights owner record row-specific decisions for only profiles proposed for rehearsal. Numerical QA independently re-runs exact fixtures. A separate authorized release owner freezes effective immutable records. Hosted fulltext/RAG remains held; customer reports use only separately approved source/value/citation acts.
4. **Invitation and tenant setup:** add single-use hashed-token invitations bound to verified email, intended company, expiry and role; redeem in one transaction; prevent reuse/enumeration. Invitation issuance is an operator/control-plane action, not an ordinary tenant endpoint. Test two tenants. No real invite is issued without the named-recipient authorization.
5. **Real-document control plane:** use tenant-scoped object storage separate from PostgreSQL request bodies. Predeclare MIME/size/type limits; stream with server-side byte limit, content sniffing and malware quarantine; encrypt at rest; store immutable SHA-256/provenance and authorized retrieval audit; use short-lived downloads; define retention/deletion and backups. Structured values remain untrusted proposals until user confirmation and validation. Unsupported/ambiguous documents never feed a calculation.
6. **Released-profile calculation and draft:** only the server selects an effective release. Bind the exact release, inputs, evidence, engine and independent expected result into immutable calculation records. Aggregate only compatible released rows; name every missing/held/unsupported item. Title output `2025 Scope 1 draft — known-source subtotal` until company completeness passes. Preserve old drafts after correction.
7. **Two-tenant hosted rehearsal:** use safe representative documents and one released profile, one missing source, one unsupported source and one correction. Independently verify numbers, tenant/document isolation, restart/recovery, export gaps, desktop/mobile/keyboard flow and support/feedback. A frozen QA verdict can establish technical invitation readiness; it does not send an invitation or establish complete Scope 1, SB 253 applicability, filing readiness or assurance.

## Exact missing decisions

These are real gates, not prerequisites for starting the synthetic foundation:

1. **Product envelope:** CPO/root must freeze the public source envelope and plain-language claims. The 2025/operational-control envelope is a proposal derived from current engines, not a board-selected customer fact. No industry cohort is currently selected.
2. **Domain release:** a qualified accounting/domain reviewer must approve or block each exact profile, factor route, GWP basis, unit/heat basis, estimate/zero rule, reporting period and supersession behavior.
3. **Rights release:** Neuvetra's rights owner must decide the exact numerical/derived-value act and exact report citation/excerpt act for each source. Counsel is needed only where the classified act and legal basis require interpretation. Fulltext/RAG remains separately held.
4. **Release authority:** root/authorized release owner must approve the immutable release record. Neither M79 preparation, numerical pass, hashes nor a database row authored by an application caller grants release.
5. **Real-data boundary:** each selected company must authorize users, legal company/year boundary, evidence types, providers/storage region, retention/deletion and support access before any real document is accepted.
6. **Invitation package:** board/delegated owner must name the two or three companies and recipients and approve the exact invitation text. No company, recipient, invitation or introduction through the possible Aveda contact is authorized here.
7. **Operational ownership:** before invitation readiness, assign support/privacy incident ownership, feedback triage, backup/recovery evidence and the stop/escalation procedure.

## Evidence and limits

Inspected current sources include `AGENTS.md`, `operations/agents/README.md`, `operations/agents/cto.md`, `operations/agent-improvement/README.md`, `docs/corporate-reporting-direction.md`, the leading current section of `operations/next-session.md`, `docs/research/m80-beta-ux-observation-2026-09-24.md`, the three accepted M79 dossiers and run records, the authentication/staging server, migrations 0001/0009/0015-0021, the M78 contract/policy/routes, the database workspace adapter and the current private-staging/Scope 1 UI.

This task performed no application edits, database action, migration, hosted request, deployment, invitation, customer-data access, paid model run, Git action or M78 replay. It did not independently recalculate M79 numerical fixtures, inspect a live provider, re-run the merged CI checks, or validate a future storage vendor. Current live deployment state beyond the supplied verified merge is therefore unverified here. Root and independent reviewers must review exact implementation bytes before any integration or migration.
