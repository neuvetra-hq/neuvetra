# Local planning to hosted data convergence

Status: architecture decision and offline handoff contract implemented; hosted import, production migration and cutover are deferred.

Decision date: 2026-09-25. Repository baseline inspected: `ce08707341051b7b7f8dd8bbebe18fb8bb5d5119`. Hosted database package schema inspected: `packages/neuvetra-database` schema version 22. This decision does not establish the current deployed commit or migrate any data.

## Decision

The SQLite workspace remains a local draft-authoring store only. It is not a second production data model and it must not receive another feature that creates a new durable business concept unless that concept has a named hosted owner and mapping in this document.

The hosted Postgres package remains the target system of record. Authentication and company membership must be resolved by the server. Local fields such as preparer role, company name, or a target company UUID in an export never grant access.

The current hosted schema cannot safely receive a real local planning workspace end to end:

- Schema 22 has company membership, California company/facility records, reporting boundaries, row-level policies, immutable version/audit patterns, and server-side company access checks.
- `corporate_inventory_versions` (M71), `scope1_versions` (M78), and `scope1_beta_setup_versions` (M80) are bounded synthetic milestone contracts. M71 and M78 require their exact synthetic profiles and predecessor proofs. M80 accepts only one operator-admitted fixed fixture and reports every method profile as held. They are not general import tables.
- There is no hosted general-purpose relation for the prototype's related-entity graph, all Scope 1/2/3 screening, arbitrary activity records, or original evidence bytes and locators.
- The SQLite store has one `local-workspace`, no account, no authenticated company membership, and no tenant boundary. Its append-only revisions and evidence blobs are useful local evidence, not hosted authorization or independent review.

Therefore the convergence path is an additive hosted import boundary followed by normalized hosted records. Direct writes from the prototype into M71, M78, or M80 are prohibited. M80 stays synthetic until a separately reviewed real-data contract replaces or supplements it.

This is also the feature sequencing gate. Before another prototype feature adds a persisted business concept, the hosted import-staging migration and the normalized hosted owner for that concept must be implemented and independently accepted. Bug fixes, accessibility work, read-only presentation, and the export adapter may proceed because they do not widen the stored business model. Calculation, approval, collaboration, new record families, and customer-data ingestion wait for the hosted boundary.

## Implemented handoff

`convergence-export.cjs` defines and validates `neuvetra.local-planning-handoff.v1`. It is intentionally an offline, candidate-only envelope. It:

- binds the full onboarding and plan snapshot to the local workspace revision and a canonical SHA-256 digest;
- preserves unknowns, explicit zero strings, exclusions, notes, custom sources, and unmapped fields in the embedded source snapshot;
- inventories evidence metadata, rejects conflicting metadata for one local evidence ID, and exposes referenced IDs whose metadata is unavailable;
- binds the candidate to one target company UUID while declaring that server-side membership remains unverified;
- identifies the exact current hosted relation for each possible mapping and fails closed for incompatible synthetic stores;
- sets `cutover.eligible` to `false` and enumerates the gates that remain.

The handoff does not contain evidence bytes, SQLite revision history, credentials, user identity, an approval, or an import command. `handoffSha256` detects changed envelope content; it is not a signature and does not prove who exported it.

The module exposes `createHandoff` for a later UI/export adapter and `validateHandoff` for offline validation. Its CLI validates an already-created JSON file:

```text
node convergence-export.cjs HANDOFF.json
```

The CLI only reads and reports validity. It does not connect to Postgres or write data.

## Grounded mapping at schema 22

| Local data | Current hosted destination | Decision |
| --- | --- | --- |
| `onboarding.company.legal` | `neuvetra.companies.name` | Candidate only. Existing company identity and member authority must be resolved server-side; US/California constraints must pass. Never create a duplicate solely from a name. |
| Local preparer `company.role` | none | Preserve as untrusted draft context. Never map it to `company_members.role` or an authenticated user. |
| `onboarding.locations[]` | `neuvetra.facilities` | Candidate after entity, geography, stable-ID, and duplicate review. Local `loc-*` identifiers remain source keys; the importer assigns UUIDs and retains an ID map. `egrid_subregion` remains unknown unless supported separately. |
| Calendar reporting period and proposed approach | `neuvetra.reporting_boundaries` | Candidate when dates represent one exact calendar year and approach maps to the hosted enum. Status remains `draft`; a local acknowledgment cannot set `under_review` or `approved`. |
| Included locations | `neuvetra.boundary_facilities` | Candidate only after both hosted IDs exist and the location is confirmed to belong to the same company. |
| Related entities, ownership/control and changes | no general schema-22 destination | Preserve in import staging. Add normalized tenant-scoped entity/relationship/version records before promotion. M71's synthetic payload is not a substitute. |
| Scope 1/2/3 screening and exclusions | no general real-data schema-22 destination | Preserve in import staging. Add versioned screening records with explicit unknown/not-applicable states and review evidence. |
| Plan activity/source items and records | no general real-data schema-22 destination | Preserve in import staging. Add normalized source/activity records with original units, interval, quality, allocation, and evidence links. Do not route them into M78 or M80. |
| Evidence metadata and bytes | no general schema-22 destination | The handoff carries metadata only. A later authorized transfer must read the original bytes, recompute SHA-256, quarantine/scan as required, store them under the same company boundary, and retain the local ID mapping. |
| Checklist completion and local review acknowledgment | no approval destination | Preserve as draft context. They cannot become accounting review, boundary approval, source approval, release approval, or assurance. |
| Readiness output | M80 is not compatible | Preserve any exact readiness snapshot separately if later exported. Do not translate its candidate methods into released method eligibility. |

## Hosted migration sequence

This sequence is the required order for the next authorized hosted implementation. Names below are proposed and may be refined in a reviewed migration, but the boundaries and gates are fixed.

1. **Freeze and version the import contract.** Keep local SQLite schema version 1 readable. Add the UI export adapter around `createHandoff`, include exact evidence byte retrieval separately, and verify the export against the saved revision in one read transaction. A changed revision aborts export.
2. **Add an immutable import staging boundary.** Add tenant-scoped `planning_import_batches`, `planning_import_payloads`, `planning_import_evidence`, and `planning_import_id_map` relations. Every primary/foreign key includes `company_id`; enable and force row-level security; revoke direct authenticated writes; expose security-definer functions only to the runtime role. Retain contract profile, exact payload bytes, source revision, snapshot digest, importer actor, created time, status, and rejection diagnostics. An idempotency key plus company ID must bind exact bytes and target.
3. **Prove admission before parsing.** The server derives actor identity, locks current admission and membership, verifies the actor can manage the target company, checks the contract/digest/size, and rejects company mismatches before any object or background job is created. The export's company UUID is a requested target, never authority.
4. **Add missing normalized real-data records.** Add company-scoped entity/relationship versions, source/screening versions, activity records, evidence originals/locators/links, and review decisions. Retain original text and units beside normalized candidates. Unknown, missing, explicit zero, estimated, excluded, not applicable, and review pending remain distinct. Corrections append versions.
5. **Map existing base records.** Reconcile company identity rather than creating by name. Assign hosted UUIDs to accepted source keys. Create draft facilities, reporting boundary, and boundary-facility links through one transaction. Keep entity and source records in staging until all required normalized destinations exist. Partial promotion is visible and retryable by the same exact batch; it is not cutover.
6. **Transfer evidence.** Read each original local blob under explicit authorization, recompute its digest and size, run the accepted scanning/quarantine path, and write company-scoped object metadata. Reject a mismatch without attaching the blob. Preserve original filename, MIME claim, capture time, local evidence ID, and source snapshot locator.
7. **Reconcile exact readback.** Reconstruct an import view from hosted rows and compare every source pointer with the embedded snapshot. Record mapped, preserved-only, and rejected fields. No field may disappear silently. The batch stays blocked while any referenced evidence, entity, location, source, record, exclusion, or unknown state is missing from the reconciliation.
8. **Independent review and cutover.** Run the tenant/security, preservation, recovery, and product acceptance gates below. A privileged operator marks one exact batch eligible. Only then may the product switch that company and reporting period to hosted writes. The local database becomes read-only evidence for that batch and remains retained until the approved retention/erasure procedure runs.

Rollback before cutover means rejecting or superseding the immutable import batch and deleting only unpromoted quarantined objects under the approved retention rule. Rollback after promotion appends compensating versions and restores the application read route to the last accepted hosted version. It must not delete accepted history or silently resume writes to an out-of-date local workspace.

## Required tenant and preservation acceptance gates

The hosted implementation is not acceptable until independent QA exercises these cases against the real server/data path, including background work, exports, caches, and object storage:

1. A company A member cannot read, list, update, reference, promote, download, or infer company B's import batch, evidence, IDs, diagnostics, jobs, or normalized rows.
2. A valid company A export with its `target.companyId` changed to B is rejected even if its digest is recomputed. The server-resolved admission and membership control the target.
3. A member without manage authority cannot create, retry, reject, promote, or cut over a batch. Revocation concurrent with import waits or fails closed under the same lock order used by hosted company operations.
4. Cross-company foreign keys reject facility, boundary, entity, source, evidence, and review references even when both UUIDs exist.
5. Idempotent replay of the exact same company, actor, key, and bytes returns the prior outcome. A changed payload, company, actor, or digest under the same key conflicts without writes.
6. A failed parse, validation, evidence hash, quota, or mapping step leaves no promoted records and a durable diagnostic tied to the exact immutable batch.
7. Null, unanswered text, explicit zero, estimate, exclusion, not applicable, review pending, original units, date intervals, notes, custom sources, and removed/orphan references survive readback distinctly.
8. Every source record and exclusion retains its source pointer, local revision, snapshot SHA-256, target version, actor, and timestamp. Evidence links reconstruct the exact original digest and locator.
9. Existing schema-22 rows, M71/M78 histories, M80 fixture admission/setup, release holds, policies, and audit records are byte/row-count unchanged by a rejected or staged import.
10. Backup and restore reproduce the exact staged and promoted state, including object metadata and import ID maps, before cutover is enabled.
11. Export and deletion/retention behavior are tenant safe and match the approved policy. Local evidence is not deleted merely because a hosted copy exists.
12. Product QA demonstrates a restart and a fresh authenticated session reading the same hosted draft, with all open findings still visible. This establishes persistence only, not accounting correctness or assurance.

## Cutover trigger

Cutover is an explicit per-company, per-reporting-period state transition. It may occur only when all of the following are true for one exact `snapshotSha256` and import batch:

- the additive hosted import and normalized-schema migrations are deployed and independently reviewed;
- the active server resolves the authenticated actor to the target company and authorized manager role;
- the complete local snapshot and every referenced evidence byte have been transferred, rehashed, scanned under the accepted policy, and exactly reconciled;
- all source pointers are classified as mapped, deliberately preserved-only with an accepted limitation, or rejected with a blocking diagnostic; none are silently dropped;
- cross-tenant, concurrency, idempotency, restart, backup/restore, and export tests pass on the exact release candidate;
- product/accounting reviewers accept the draft data semantics without turning local acknowledgments into approvals;
- an operator records cutover for that exact batch and the application readback matches the reconciled hosted version.

Until that trigger, the local SQLite workspace is authoritative for the prototype draft, the handoff is only a candidate, and `cutover.eligible` must remain `false`. Passing the offline tests below does not mean a customer workspace was migrated.

## Offline validation evidence

Run:

```text
node --test convergence-export.test.cjs
```

The synthetic tests cover deterministic snapshot binding, current hosted mapping dispositions, preservation of null and explicit zero, evidence metadata deduplication/conflict rejection, snapshot and target-field tamper detection, and unresolved evidence visibility. Server-side authorization remains a later gate. The tests use no customer data, hosted connection, deployment, production migration, or server on port 4319.
