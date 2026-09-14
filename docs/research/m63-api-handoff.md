# M63 API implementation handoff

September 14, 2026. Executor `/root/m63_cto`; architecture and backend author, not independent reviewer. Requested `gpt-6-astra` / `high`; observed setting unavailable. This handoff covers local implementation only. No live Auth request, hosted database connection, environment export, deployment or invitation was performed by this worker.

## Delivered boundary

`apps/site-api/src/staging/server.ts` exports `createStagingServer(config, overrides?)`, returning `fetch(request)` and `close()`. Its guarded main entry reads explicit staging configuration, creates the hosted database, checks readiness, and listens on `0.0.0.0:$PORT`. Failed startup emits a fixed event and exits unsuccessfully; imports cause no credential reads, network, listener or migration.

The existing M54–M61 server retains its development/test flags, synthetic identity map and loopback listener. Its store construction now delegates to `workspace/service.ts`, preserving the same deterministic calculation and domain operations. Staging supplies a preprovisioned owner-workspace lookup instead of synthetic membership insertion. Hosted database implementation, SQL roles and migrations belong to M63-DATA.

| Route | Contract |
| --- | --- |
| `GET /workspace-api/config` | Public, no-store `{profile,supabaseUrl,anonKey}`; no database/server credentials. |
| `GET /workspace-api/session` | Real Bearer validation plus current DB access. `{profile,user:{id},access:{role,workspaceId,evidenceId}}`. Missing/invalid token 401; removed/noninvited access 403; dependencies unavailable 503. |
| `/workspace-api/workspace...` | Same existing workspace routes and response contracts; the outer boundary validates real identity/current access before routing. Mutations require the exact configured Origin. Reads allow absent Origin but reject a foreign Origin. Underlying routes and every hosted transaction recheck authority. |
| `GET /health` | Minimal liveness only: `{status:"alive"}`. |
| `GET /ready` | Database check verifies exact staging profile/schema version 9; checks pinned runtime assets and static entry. Returns sanitized 503 when unavailable. |
| `GET /`, `GET /workspace`, `GET /assets/<flat allowed filename>` | Only the built static root and selected asset extensions, with real-path containment. No repository files, source maps, arbitrary HTML or stored user artifacts. |

Real authentication uses the existing Supabase `auth.getUser(token)` helper with an isolated configured client and bounded five-second fetch. No token-to-user impersonation map is present in the staging entry. The API excludes private Auth metadata from session responses. Current invitation checks run for every authenticated API request; the nested route also validates token and access, trading an extra Auth lookup for explicit independent gating. No session or token cache bypasses revocation.

Every response has no-store, nosniff, no-referrer, frame denial and a restrictive CSP. HTTPS responses enable HSTS. Request logs contain only a generated request ID, fixed route class, status and rounded duration; no path IDs, tokens, email, content, notes, query or driver error. Global admission is bounded to 360 authenticated-surface attempts/minute and 120 requests/minute per verified actor in one process. These are a single-replica staging limit, not distributed production limits. Request bodies are capped at 300,000 bytes while streaming and by the Bun listener. Failed logs cannot turn committed work into an apparent request failure.

## Configuration and container contract

Required: `NODE_ENV=production`, `NEUVETRA_STAGING_ENABLED=enabled`, `NEUVETRA_STAGING_PROFILE=neuvetra.private-synthetic-staging.v1`, `NEUVETRA_STAGING_PROJECT_REF`, `NEUVETRA_STAGING_ORIGIN`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `DATABASE_URL`. `PORT` defaults 3000; `NEUVETRA_STAGING_WEB_ROOT` defaults `/app/apps/site-web/dist-staging`. Loopback HTTP is accepted only in explicit test mode. The origin must be one exact origin with no path/credentials/query. `SUPABASE_URL` must exactly match the configured project. Latest board steering authorizes reusing existing capacity: known project `icockcoguyadhryzydvl` is accepted only with `NEUVETRA_STAGING_REUSE_EXISTING=confirmed` and current database `legacyContainmentVerified=true`. Startup, readiness and every workspace API request including public config check that receipt. Public keys must match the publishable format, or an anon JWT whose project ref matches; service/secret keys refuse.

Database target must be the same project's direct endpoint or project-qualified runtime pooler user, `/postgres`, expected port, no query/hash and no owner/service-role username. The database adapter independently validates target/role/TLS and migration hashes. Credentials remain runtime secrets, never Vite build values. No unrelated provider variables are needed.

Image entry: `bun run apps/site-api/src/staging/server.ts` from repository root, or `bun run src/staging/server.ts` from `/app/apps/site-api`. Install Python and set `NEUVETRA_PYTHON` to its executable if it is not named `python`. Include the database modules/migrations and five exact files in `staging/assets.ts`: linked Python adapter, imported location-based Python method, fixed bill PDF, annual register JSON and manifest. Preserve relative repository paths. The web builder must place the dedicated staging HTML at `apps/site-web/dist-staging/index.html`. Root owns the complete image/build manifest and actual image tests.

## Executed checks and remaining evidence

- Shared-store extraction preserved the existing development server: 4 tests / 131 assertions passed.
- New staging tests use real PGlite domain routes with an injected test identity provider: 7 tests / 67 assertions passed after the board-directed explicit existing-project reuse gate. They exercise session revocation, containment-receipt drift, foreign/unknown workspace equivalence, multipart upload through the staging wrapper, member refusal, dependency failures, origin/body/path limits, log contents and actual static path containment/asset hashes.
- Full Site API suite passed 631 tests / 5,509 assertions before the final configuration/reuse changes; focused tests and API typecheck passed afterward. Full workspace typecheck passed before those final changes. A temporary type mismatch in the database worker's in-progress driver settings caused an intermediate API typecheck failure; the corrected package passed the subsequent check.
- The opt-in native PostgreSQL test in `staging/postgres.test.ts` passed 1 test / 34 assertions against QA's loopback `m63_integration` database. It created unique synthetic Auth UUID rows and an approved roster, then performed the entire calculation/inventory/pack/replay/report/second-manager flow through the staged API handler using the real restricted-role adapter. After closing and recreating the API/database pool, exact decision/report hashes survived; outsider, signed-out and revoked-member access refused. This is a real PostgreSQL integration check with an injected identity provider and separately tested static assets, not live Supabase Auth or a container/process restart drill.
- No new dependency or package script was required by this worker. No calculation Python bytes, numerical contracts or history formats were changed.

Independent review, actual Supabase Auth, deployed role/catalog checks, container boot and deployed artifact persistence/recovery remain with QA/data/root. The native PostgreSQL check establishes a local driver/application integration result; PGlite tests and injected-identity tests do not establish live tenant isolation. Readiness checks do not themselves establish active alert delivery, backup success, restore, private tester completion or production release eligibility.

Root/CPO should review inherited `synthetic_local_only_no_assurance` wording when displayed in hosted staging. It remains an immutable historical profile/acknowledgment code; changing it silently would invalidate existing archive/report/review contracts. New hosting status belongs beside those preserved accounting limitations. QA's restore clarification was incorporated into the technical plan: exact restoration must preserve original actor UUIDs, IDs, timestamps and bytes; remapped identities are not an exact-record restore.
