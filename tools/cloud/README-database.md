# Synthetic research database slice

CLOUD-DB-01 supplies a read-only connection inventory and a proposed, additive migration for two synthetic scopes. It does not connect the current answer experiment, import the legacy pipeline, create customer tenants, or establish production readiness. The coordinator performs approved cloud operations separately.

## Connection inventory

`database-inventory.ts` imports no product database client. It loads the installed `postgres` driver through `packages/frontdesk-database/package.json` only when invoked, and reads exactly one `DATABASE_URL` assignment from an explicitly supplied export. Importing the module does not read an export or open a connection. Check mode verifies URL target, driver callability and optional CA syntax locally; it does not authenticate to Supabase.

From the repository root with Bun on PATH:

```powershell
bun tools/cloud/database-inventory.ts --mode check --export 'C:/Users/nimab/Neuvetra/env.json.txt'
bun test tools/cloud/database-inventory.test.ts
```

The bundled Bun executable is `.superpowers/review-tools/bun-windows-x64/bun.exe` when a global Bun installation is unavailable. The export stays outside Git; no example contains a credential value. The helper accepts only the known project `icockcoguyadhryzydvl`: its direct database host or a Supabase pooler with the exact project-qualified database user. It extracts connection fields explicitly and refuses other connection options.

After the coordinator reviews the target and authorizes the read-only operation, use a **new** output path for each attempt:

```powershell
bun tools/cloud/database-inventory.ts --mode inventory --export 'C:/Users/nimab/Neuvetra/env.json.txt' --ca-file '.superpowers/official-supabase-ca.pem' --out '.superpowers/cloud-db-inventory-new.json'
```

`--ca-file` is optional when the system trust store already verifies the server. When needed, obtain the CA through the project's official Supabase database settings; the helper does not download or invent trust material. It permits only a bounded PEM bundle of CA certificates and reports its SHA-256, never its contents. Certificate and hostname verification remain enabled. A failed TLS check has no insecure fallback.

Inventory reserves the output path without overwriting an existing file, opens one verified connection, and executes fixed catalog queries inside a read-only transaction with short query/lock deadlines. It returns schema/table/column/constraint/policy/grant metadata and the connection's own read-only/TLS/role flags. It does not select customer rows, policy expressions, defaults, stored function bodies or arbitrary caller SQL. Failure messages use fixed categories; raw driver errors and credentials are not logged. A failed inventory may leave an empty reserved output file, which must not be mistaken for a successful report.

Local checks cover synthetic URL parsing and target refusal, the actual installed driver export shape without constructing a connection, CA bounds/type checks, transaction ordering/cleanup, and sanitized connection/TLS/authentication failures. They do not prove a live certificate chain or database permissions. The coordinator's first live attempt exposed the driver export-shape bug; the corrected attempt was stopped by certificate verification. No successful live catalog inventory is recorded by this helper's author.

## Proposed migration and adapter contract

[`infra/cloud/001-neuvetra-research-dev.sql`](../../infra/cloud/001-neuvetra-research-dev.sql) is **not applied**. It creates `neuvetra_research_dev` and aborts if that schema already exists. Before applying, the coordinator must verify the actual project and existing objects, then explicitly acknowledge the project with the connection setting `neuvetra.target_project_ref`. That setting is an operator acknowledgement, not independent proof of the server's identity. The transaction has bounded lock/statement timeouts and does not move or replace existing product/auth tables.

The isolated schema accepts only scope UUIDs `90000000-0000-4000-8000-00000000000a` and `90000000-0000-4000-8000-00000000000b`. Its projection agrees with `evidence_smoke.stage_payload(plan, target, review_expires_at)`:

| Table | Content / initial state |
| --- | --- |
| `research_scopes` | Two labeled synthetic scopes. |
| `research_memberships` | Separately provisioned Auth user-to-scope mapping; omitted from stage payload. |
| `research_objects` | Scoped SHA-256, byte size and immutable private Storage key. |
| `research_sources` | Scoped original hash and provenance; review `pending`. |
| `research_releases` | Release/profile hashes, build UUID, namespace and explicit review expiry; status `candidate`, commercial approval false. |
| `research_passages` | Exact text/hash, original/extraction references, locator, spans, dependencies and qualifications; review `pending`. |
| `research_ingestion_runs` | Build/manifest hash and `expected_passage_ids`, mapped from the plan's `expected_active_passage_ids`; state `staged`. |
| `research_active_builds` | One pointer per scope, omitted from stage payload. |

The bucket is `neuvetra-research-dev`, created and checked **private** by the coordinator through Storage. Object keys are exactly `<scope UUID>/sha256/<object SHA-256>/source.txt`, `extraction.json` or `release.json`, according to object kind. The owned synthetic source's canonical URL identifies its authenticated Storage object; it is not a public publisher citation. Every release/build/source/extraction foreign-key boundary includes the scope. Passage text has a database SHA-256 check. Content projections reject updates that alter identity or content; explicit review/withdrawal/activity flags remain administratively mutable.

Authenticated readers receive SELECT only, subject to membership RLS. They cannot mutate memberships, approval flags, staged rows or the active pointer. No `anon` grant exposes the research schema. Additive Storage policies fence only the named bucket: authenticated downloads require a matching scoped object, anonymous downloads and ordinary reader writes are denied, and other buckets retain their existing policy outcomes. These intended outcomes still require live policy testing. Service-role and database-owner actions can bypass RLS and cannot certify tenant isolation.

There is no staging RPC. The coordinator inserts the complete stage payload in one transaction, provisions two restricted test identities/memberships separately, and records the exact reviewed synthetic target/fixture/code hashes. Publication uploads immutable objects and vectors outside that transaction. Only after independent review and exact external byte/vector verification may the coordinator mark source/passage review `approved`, release `approved`, and ingestion `verified`.

`activate_research_build(scope_id, build_id, manifest_sha256)` is callable only by `service_role` through the API. Direct service-role pointer writes are revoked. The function serializes one scope, requires the approved/unexpired release, matching manifest and verified ingestion state, verifies the exact expected active passage set, approved source/object kinds and complete acyclic dependencies, then switches the pointer and ingestion states atomically. A supplied manifest hash or `verified` flag does not itself prove that cloud objects/vectors were checked; the provisioner is trusted for those external checks. The custom schema must also be explicitly exposed in the project's Data API before PostgREST can serve it; SQL grants alone do not configure API exposure.

## Remaining live gates and recovery

No SQL parser/database execution, migration application, hosted object publication, activation or real authenticated A/B JWT test was performed by this database helper's author. Before accepting cloud integration, test permitted same-scope reads; denied cross-scope/anonymous reads and approval/membership/pointer writes; private Storage downloads and writes; unchanged existing-bucket access; tampered, missing, withdrawn, expired and incomplete builds; and failed/interrupted activation preserving the prior pointer. Include actual non-admin JWTs: service-role probes exercise a bypass path.

Failure before activation leaves the prior pointer in place. If a newly active build must be withdrawn, an authorized database operator can withdraw its release or remove only its synthetic pointer in a controlled transaction; readers then fail closed. Cleanup must use the frozen manifest's scoped rows/object keys/vector IDs after deactivation and reference checks. This proposal supplies no broad deletion or automatic rollback script. A successful synthetic connection/retrieval test would still not resolve the separate answer-quality gate or authorize production use.
