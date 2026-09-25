# Inventory planning storage

## Implemented local demonstration

`server.py` is a Python standard-library HTTP server bound only to `127.0.0.1`. It serves the company-onboarding directory and a single local workspace backed by SQLite. It does not implement accounts, tenants, user authentication, production hosting, review approval, emission calculations, legal applicability or external assurance.

Run from this directory with Python 3.10 or newer:

```text
python -B server.py --port 4321
python -B server.py --port 4321 --db C:/path/outside/repository/inventory-plan.sqlite3
```

Open the printed `http://127.0.0.1:4321` URL. `localhost`, alternate hostnames and network addresses are intentionally rejected. The default database is `neuvetra-inventory-plan.sqlite3` in the operating system temporary directory, outside Git. It survives ordinary server restarts; temporary-directory cleanup can remove it. Use an explicit durable local `--db` location for retained demonstrations. No database content, cookies, document contents or request paths are printed.

The database contains potentially sensitive local information and is not encrypted by this application. Local operating-system users/processes with filesystem access can read or alter it. The local session is a cross-site request protection, not user identity or an access boundary against other local software. Do not expose this HTTP server through a tunnel or deploy it as a customer service.

### Stored schema, version 1

| Table | Actual contents and guarantees |
| --- | --- |
| `workspace` | One `local-workspace` row, current revision, exact JSON onboarding and plan snapshots, UTC save timestamp. |
| `workspace_revision` | Initial revision 0 and every accepted revision; snapshots, timestamp and SHA-256 of the serialized onboarding/plan content. Unique workspace/revision key and triggers reject updates/deletes through ordinary SQL. |
| `evidence` | Server-issued ID, workspace reference, name, MIME type, byte count, server-computed SHA-256, immutable original BLOB and capture timestamp. Triggers reject updates/deletes through ordinary SQL. |

SQLite uses foreign keys, WAL journaling and `synchronous=FULL`. Each request gets a connection that is explicitly closed. `BEGIN IMMEDIATE` serializes writers. Expected revision checking, history insertion and current-row replacement happen in one transaction; a conflict returns 409 without overwriting saved data. These are local durability controls, not a tested disaster-recovery or encrypted backup system. The history digest is an integrity aid, not a signature or proof of independent approval. Database owners can remove triggers; this is not a tamper-proof audit log.

Unknown `null`, unanswered empty strings and explicit values are preserved separately. The server accepts incomplete drafts. It bounds JSON depth, record count, text and numeric ranges, rejects duplicate/prototype-pollution keys, and requires plan schema/catalog version fields. It does not establish the factual accuracy or accounting suitability of draft values. Onboarding locations/entities are limited to 100 each, and sources, when present, must have exactly five object records. Plan fields may extend the declared schema with safe JSON. Current source/checklist catalog content is owned by the application; its version is stored with every plan snapshot.

### HTTP contract

All API requests need `X-Neuvetra-Local: 1`. Every request needs the exact bound `Host`. Cross-site requests or mismatched supplied `Origin` are rejected. HTML/static/API workspace GET issues a random per-server session cookie (`HttpOnly; SameSite=Strict; Path=/`). PUT and POST additionally need that cookie, an exact matching `Origin`, `Content-Type: application/json`, and one bounded `Content-Length`. There is no CORS. The cookie is intentionally not `Secure` because the loopback demo uses HTTP. A server restart invalidates the prior cookie; reload the page.

| Request | Result |
| --- | --- |
| `GET /api/workspace` | `{id, revision, onboarding, plan, updatedAt}`. Initial onboarding is `null`; plan is `{schemaVersion:1,catalogVersion:"uninitialized",items:{},custom:[],screening:{}}`. |
| `PUT /api/workspace` | Body `{expectedRevision, onboarding, plan}`; returns the newly saved workspace. Maximum body 1 MiB. Conflict 409; invalid data 400; oversized request 413; unconfirmed storage failure 503. |
| `POST /api/evidence` | Body `{name,mime,contentBase64}`; returns 201 with `{id,name,mime,size,sha256,createdAt}`. |
| `GET /api/evidence/<id>` | Same evidence metadata plus `contentBase64`; protected JSON read for the UI's local download. Unknown ID returns 404. |

Uploads allow PDF, PNG, JPEG, UTF-8 CSV and TXT, matching the filename extension and declared MIME type. Binary types receive leading-signature checks; text receives UTF-8/control-character checks. These checks are **not** malware scanning, full document parsing, evidence sufficiency or source approval. Uploads are captured as original bytes without interpretation. Maximum decoded file size is 5 MiB; total stored evidence is 50 MiB. Quota checking and insertion are one transaction. The request envelope is bounded to 7 MiB to accommodate base64.

Any `evidenceIds` array anywhere in the plan must contain real IDs stored in this workspace. References are checked inside the save transaction. Uploading a file and attaching it to a plan are separate actions; an interrupted attachment can leave an unattached immutable file. It still consumes quota. There is no deletion API. Resetting the current draft, if offered by the UI, retains revision history and uploaded files; it is not erasure. Prior revisions retain their evidence because evidence cannot be deleted through the application.

Static responses allow root HTML/CSS/JS/WOFF2 and JSON in `data/` only, with no directory listing. Dot paths, traversal and symlink escapes are rejected. Python, Markdown, SQLite/WAL, `.git`, root configuration JSON and other files are not served. Response headers prevent framing and cross-origin resource reads and constrain scripts/connections to this origin. Uploaded evidence is never served as executable static content.

### Verification

```text
python -B -m unittest test_server -v
```

The suite starts actual subprocess servers against isolated temporary SQLite files. Ten tests exercise exact state/evidence readback across process restarts; concurrent compare-and-swap with exactly one winner; append-only triggers; null preservation; malformed/oversized inputs; field and prototype-key bounds; origin/host/session/header protection; traversal/source-file protection; upload types/signatures/byte limits; immutable file hashes; rejected missing evidence references; and transactional storage quota. Binary-signature fixtures intentionally test signature acceptance, not complete PDF/image validity. The quota fixture inserts 50 MiB directly to avoid HTTP transfer overhead, then checks that the real upload endpoint refuses another file without changing the total.

Author-run result: 14 tests passed on 2026-09-25. The first runs exposed test-harness header-case handling and fixture connection cleanup issues; those were repaired before the passing run. Independent integrated UI/security review is a separate gate. This file is not a claim that the complete product is production-ready.

## Proposed normalized production schema — DESIGN ONLY

The local JSON snapshot model is useful for a bounded demonstration. A future corporate inventory service needs an explicitly authorized implementation and migration, independent review, and release evidence for the following design. These tables and controls are **not implemented by this prototype**.

| Proposed relation | Purpose and lineage |
| --- | --- |
| `tenant`, `membership` | Company workspace and authenticated user/role authorization. Never infer tenant from a document or client-supplied object alone. |
| `inventory`, `inventory_version` | Reporting dates, consolidation method, immutable submitted versions and draft/review state; retain company-wide coverage gaps. |
| `entity`, `entity_version` | Legal entities, parent relationships, ownership/control evidence and effective dates. |
| `location`, `location_version` | Facilities with stable identity, jurisdiction, coverage dates and explicit unknown boundary treatment. |
| `catalog_release`, `source_template`, `checklist_template` | Versioned candidate source definitions, scope/category classification and checklist templates. Approved releases, draft candidates and method/factor releases remain distinct. |
| `source_instance`, `source_instance_version` | Inventory/entity/location-specific source, applicability answer, missing-data state, explicit exclusion reason and exact template release. Corporate Scope 1, 2 and 3 coverage is represented without treating unassessed as absent. |
| `checklist_instance`, `checklist_item` | Concrete required activity/evidence requests, assignee, entered period/units, missing-versus-zero values, and the template version that generated each request. |
| `evidence_original`, `evidence_locator` | Immutable source bytes/object-store reference, server-computed digest, capture identity/time, document period and page/section locators. |
| `evidence_link`, `extracted_candidate` | Many-to-many document-to-source/checklist links, extracted candidates and review disposition. A link or extraction is not source approval. |
| `review_decision`, `audit_event` | Attributed decisions on exact versions, authorization basis and reviewer independence; corrections append new versions. |
| `method_release`, `factor_release`, `calculation_run`, `report_version` | Separately approved pinned methods/factors, deterministic input/output/rounding lineage and immutable report artifacts. Outside this planning prototype. |

Every tenant-owned primary and foreign key should carry `tenant_id`; composite foreign keys such as `(tenant_id, inventory_id)` prevent cross-tenant references at the database boundary. Evidence links must reference both tenant-scoped originals and tenant-scoped checklist/source instances. Enable database row-level security with a trusted server-resolved membership/tenant context, deny-by-default policies and a non-bypass application role. Apply the same tenant authorization to object storage, derived indexes, exports, queues and caches. Test actual cross-tenant reads, writes, references, background work and exports. Client filters and globally unique IDs do not supply this protection.

Concurrent drafts need expected-version checks; submission/review/report references need immutable exact-version joins. Catalog upgrades should retain the originating version, show added/removed/changed requests and require deliberate reconciliation rather than silently rewriting an accepted inventory. A source applicability change must not erase collected activity or evidence. Explicit corrections preserve prior versions and decisions. Source approval, accounting validation, software verification and independent external assurance remain different events.

Before migrating any real data: specify retention/erasure and legal-hold behavior, bounded upload scanning/quarantine, encryption and key ownership, restore-tested backups, tenant-safe import/export, migrations and rollback, and independent authorization/security review. Do not copy local demo evidence into another provider without an authorized destination and access boundary.
