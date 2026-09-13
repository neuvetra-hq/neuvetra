# M54 — tenant-safe company workspace foundation

**State:** complete for the bounded local synthetic scope; independent security/product/data review passed
**Started:** September 12, 2026

## CEO outcome

A signed-in development user can create and revisit one synthetic company workspace containing a facility and a draft reporting boundary. A second synthetic user cannot read, change, attach to or infer the first user's records.

This is the first bounded Stage 4 milestone. It establishes the tenant root before bill upload or inventory-entry work is allowed to persist.

## Supported demonstration

- Create one synthetic United States / California company, one facility and one calendar-year draft boundary in one transaction.
- Return the created workspace only to its authenticated owner.
- Revisit the same workspace through an authenticated server route.
- Treat a foreign workspace identifier as absent and return no tenant data.
- Preserve an immutable creation audit event and explicit boundary version.

## Acceptance gate

- Versioned PostgreSQL schema and migration for companies, memberships, facilities, boundaries, boundary facilities and audit events.
- Row-level security is enabled and forced on every tenant-owned table.
- Policies derive identity from the authenticated database request; the browser cannot supply a user or tenant override.
- An executable two-user SQL test proves same-tenant access and cross-tenant read/write/link refusal.
- The API requires a valid bearer identity and returns the same safe response for missing and foreign records.
- The development UI demonstrates create, revisit and signed-out behavior with accessible status/error states.
- Full relevant tests, type checks, lint, production exclusion and independent security/product review pass.

## Exclusions

No customer data, bill upload or parsing, calculation persistence, factor release, real OTP delivery, production database migration, deployment, merge, billing or launch is part of M54. The synthetic development fixture is not a production workspace or inventory.

## Implemented development boundary

- `packages/neuvetra-database` owns one versioned PostgreSQL migration and a PGlite execution harness. PGlite is used only to exercise PostgreSQL behavior locally without a remote database.
- The schema creates companies, memberships, facilities, reporting boundaries, boundary-facility links and immutable creation audit events. Composite foreign keys prevent links across company roots.
- Row-level security is enabled and forced on every tenant-owned table. Membership reads and owner/admin writes derive the actor from `auth.uid()`; the bootstrap function creates the owner relationship atomically.
- The isolated loopback server accepts two fixed non-secret synthetic bearer identities only when `M54_SYNTHETIC_WORKSPACE=enabled` and `NODE_ENV` is explicitly `development` or `test`. It fails closed for an unset flag or runtime and for staging or production. It neither imports the legacy chat service nor uses Supabase credentials.
- The development-only browser surface creates and saves a browser pointer, revisits through the authenticated server, and demonstrates the foreign-tenant and signed-out refusals. The component and synthetic tokens are excluded from the production bundle.

## Author validation

Seven database tests / 40 assertions execute the migration against PostgreSQL-in-WASM and pass creation, owner replay, foreign reads across all six tenant tables, owner/admin writes, member/outsider write denial, an actual cross-company link attempt, unauthenticated bootstrap and duplicate rollback. All 617 API tests / 5,311 assertions and all 53 web tests / 185 assertions pass. Database, API and web type checks pass; web lint and the production build pass. The built website contains none of the M54 component, token, fixture or endpoint strings. The focused M54 suite passes 20 tests / 73 assertions, including strict request shape, real-environment startup guards and bounded create/read error responses that do not expose database details.

Browser inspection reproduced owner create and revisit, foreign `Workspace not found`, signed-out `Authentication required`, fixed company/facility/boundary values and accessible status updates. It also found an initial same-origin read defect: a normal browser GET omitted `Origin` and was rejected before authorization. The repaired route rejects an explicitly foreign origin, accepts an authenticated origin-less read and still relies on row-level security for tenant filtering.

This evidence does not show compatibility with the hosted Supabase project, a real JWT/session, durable storage across process restarts, production migration safety, storage/search/job isolation, upload parsing or customer readiness. Independent review passed only this bounded local synthetic milestone; Stage 4 and release acceptance remain false.
