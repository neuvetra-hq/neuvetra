# Hosted setup gate transport — author handoff

Date: 2026-09-26  
Task: `HOSTED-SETUP-GATE-TRANSPORT-01`  
Mode: security/reliability implementation under CTO/CEO  
Requested route: critical `gpt-6-astra`/high  
Observed model, effort, token use and cost: unknown  
Controller reservation: unavailable because no defensible cost observation was exposed; routing exception recorded rather than inventing spend  
Status: **author candidate; independent QA required**

## Bounded implementation

Two new inert-on-import modules were added:

- `tools/staging/hosted-setup-gate-transport.ts`
- `tools/staging/hosted-setup-gate-transport.test.ts`

The source supplies concrete Railway and PostgreSQL clients for the already reviewed Candidate 3 adapter. Credentials, HTTP, TLS-aware PostgreSQL construction and connection-failure classification are injected. Import and construction perform no I/O. The module does not read environment variables, files, provider state or credentials, and it contains no executable entrypoint.

## Railway binding and deliberate mutation refusal

The Railway binding uses the documented GraphQL v2 endpoint and project-token header. It pages all deployments and deployment triggers with Relay cursors, caps traversal at 32 pages, rejects duplicate IDs/cursors, rejects snapshot drift between pages, and verifies the exact project, environment, service, deployment and commit. It reads the complete multi-region configuration, latest deployment, source, cron scheduling, image-update status, source autodeploy status, trigger count, pending configuration count and a configuration version. Unknown/nonterminal deployment status, GraphQL errors, missing fields, schema mismatch or incomplete pagination fail with fixed sanitized errors.

Some required safety fields are not part of the stable examples in Railway's public documentation. Railway directs API clients to live schema introspection for current fields. This candidate does not introspect a real token or assert that the current live schema exposes every requested field. A missing or renamed field causes GraphQL validation failure and therefore fail-closed observation.

The adapter requires a scale mutation with an atomic expected-configuration-version condition. Railway documents `railway scale` as one environment patch commit and documents `serviceInstanceUpdate`, but the public documentation does not expose an atomic compare-and-swap predicate. Therefore `scaleRegions` validates the exact target and then throws `HS_GATE_TRANSPORT_RAILWAY_ATOMIC_CAS_UNAVAILABLE_NO_MUTATION` before credential resolution or HTTP. It never submits a provider mutation. This transport cannot produce a held gate receipt through the existing adapter.

Primary Railway references:

- https://docs.railway.com/integrations/api
- https://docs.railway.com/integrations/api/graphql-overview
- https://docs.railway.com/integrations/api/manage-services
- https://docs.railway.com/cli/scale
- https://docs.railway.com/deployments/optimize-performance

## PostgreSQL binding

The PostgreSQL resolver accepts only the exact Supabase pooler hostname, port 5432, `/postgres` database and project-qualified `postgres` or `neuvetra_runtime` username. Query parameters and fragments are refused. The injected connector must establish verified TLS and return the authenticated peer-certificate SHA-256. Endpoint identity binds hostname, port, database, project, PostgreSQL 17 version and peer certificate.

Admin inventory runs in one `REPEATABLE READ READ ONLY` transaction. It verifies:

- database/session identity and PostgreSQL major version 17;
- the exact `neuvetra.staging_target` project/profile and exactly 22 migration receipts;
- runtime role login, superuser, BYPASSRLS and connection-limit fields;
- runtime and privileged sessions, excluding only the inventory connection's own backend PID;
- inherited table and column write privileges across every application table/partition/foreign table;
- all executable `neuvetra` function/procedure signatures;
- elevated role memberships, runtime role elevation attributes and membership admin options;
- every other non-privileged login role with application table writes or executable application routines;
- PostgreSQL scheduler extensions matching cron/agent/scheduler, refusing unknown scheduler extensions, plus active `pg_cron` commands mentioning the application schema.

The runtime login probe uses the same exact URL and TLS endpoint evidence, queries the actual session/current roles and staging target, and returns a connected proof only after both match. An injected structured connection failure is mapped without raw error output. A role-limit result preserves the exact server SQLSTATE, severity, reporting routine and message for the adapter's narrow PostgreSQL 17 predicate. Authentication, network, DNS, TLS and timeout outcomes remain distinct.

`ALTER ROLE neuvetra_runtime CONNECTION LIMIT 0` executes in a transaction with before/after catalog readback. Session termination enumerates exact runtime PIDs, compares the attempted set, records every `pg_terminate_backend` result and rereads remaining PIDs. Any race, false result or close failure propagates as uncertainty; there is no automatic retry.

PostgreSQL references:

- https://www.postgresql.org/docs/17/catalogs.html
- https://www.postgresql.org/docs/17/functions-info.html
- https://www.postgresql.org/docs/17/monitoring-stats.html
- https://www.postgresql.org/docs/17/protocol-error-fields.html
- https://raw.githubusercontent.com/postgres/postgres/REL_17_STABLE/src/backend/utils/init/miscinit.c

## Synthetic validation

Commands run from `C:\Users\nimab\.codex\worktrees\inventory-plan-delivery\Neuvetra`:

```text
bun test tools/staging/hosted-setup-gate-transport.test.ts tools/staging/hosted-setup-write-gate-adapter.test.ts tools/staging/hosted-setup-write-gate.test.ts
25 pass, 0 fail, 139 assertions

bunx tsc --noEmit --strict --skipLibCheck --moduleResolution bundler --module esnext --target es2022 --types bun tools/staging/hosted-setup-gate-transport.ts tools/staging/hosted-setup-gate-transport.test.ts
exit 0, no diagnostics
```

The seven transport tests cover inert construction, complete two-page deployment traversal, trigger traversal, page-to-page drift, sanitized GraphQL errors, no-I/O scale refusal, exact read-only database inventory, mutation readbacks, known-good runtime credential proof, authentic role-limit preservation, and general-capacity/authentication/network negative cases. Synthetic credential strings do not appear in returned inventories or sanitized errors.

No real Railway or PostgreSQL call, provider/database mutation, ENV/file credential access, archive access, Git command or shared operations edit occurred.

## Limits and next review

This candidate deliberately does not enable a live stop. The actual Railway schema/capabilities, token scope, HTTP behavior, TLS peer evidence, Supabase catalog visibility, exact routine-set identity, scheduler coverage and connection-error provenance remain unobserved. The injected PostgreSQL connector must distinguish a server-authenticated startup rejection from client/network errors without rewriting diagnostics. Secret-resolver disposal is an injected responsibility.

The adapter's privileged/provider-admin continuous-hold marker remains unresolved. This transport samples privileged sessions but does not revoke privileged credentials or create a global hold. A separately reviewed single locked preservation transaction may satisfy the board's broader all-writer preservation goal, but that design is outside this transport and does not change its current contract.

Independent QA should challenge the GraphQL query against current introspection without mutating state, Relay completeness and snapshot consistency, the deliberate no-CAS refusal, PostgreSQL role/ACL inheritance and routine coverage, scheduler discovery, pooled-role/session identity, TLS endpoint binding, mutation races, raw diagnostic provenance, cleanup uncertainty and secret non-disclosure. No live gate, migration, deployment or publication authority is claimed.
