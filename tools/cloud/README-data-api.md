# Research schema API exposure

CLOUD-API-01. The user authorized appending `neuvetra_research_dev` to the existing Supabase Data API list. The coordinator owns credentials, unique private receipts and live execution. Imports and offline tests do not read ENV or contact services.

## Verified baseline and fixed change

On 2026-09-09 the coordinator observed the known project `icockcoguyadhryzydvl`, direct database/operator `postgres`, verified TLS and a read-only transaction. The filtered catalog query returned no `pgrst.db_schemas` overrides. The operator's own setting was null; that alone does not establish API exposure. A separate zero-row public metadata probe at 05:38:32 UTC returned structured `PGRST106` with the effective ordered list `public, graphql_public` in its hint. Private receipts: `.superpowers/cloud-api-discovery-01.json` and `.superpowers/cloud-api-effective-04.json`.

[`data-api-exposure.ts`](data-api-exposure.ts) requires that baseline again before this fixed change:

```sql
ALTER ROLE authenticator IN DATABASE postgres SET pgrst.db_schemas = 'public, graphql_public, neuvetra_research_dev';
```

The prior default remains first; only the research schema is added. No customer rows, grants, RLS, memberships or other role settings change. Rollback restores the captured absence of this override:

```sql
ALTER ROLE authenticator IN DATABASE postgres RESET pgrst.db_schemas;
```

Both operations issue `NOTIFY pgrst, 'reload config'` and `NOTIFY pgrst, 'reload schema'` in the same transaction. This SQL override shadows Dashboard-managed configuration until reset. Database-specific authenticator settings take precedence over role-wide settings. [Supabase override guidance](https://supabase.com/docs/guides/troubleshooting/postgrest-error-pgrst002-could-not-query-the-database-for-the-schema-cache-c396e9), [PostgREST precedence](https://docs.postgrest.org/en/v14/references/configuration.html#in-database-configuration)

## Execution contract

The only CLI mode is nonconnecting inspection:

```text
bun tools/cloud/data-api-exposure.ts --check
```

A reviewed private coordinator launcher calls the exported function with in-memory inputs:

```ts
await runExposure({ mode: 'apply', databaseUrl, caBytes, publicKey })
// Explicit rollback only: mode: 'rollback'.
```

There is no automatic export loading or arbitrary SQL option. The launcher must pin reviewed code and input provenance, preflight a unique output path, refuse overwrite, and save only the returned receipt or fixed error code/`commit_attempted` flag. Never log inputs, headers, raw Error objects or connection strings. The helper does not write files.

The URL must identify the known project. It is explicitly retargeted to `db.icockcoguyadhryzydvl.supabase.co:5432`, database/operator `postgres`, preserving the password in memory. Peer/hostname verification stays enabled with official CA bytes pinned to SHA-256 `700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7`. No TLS fallback is available; the inventory helper supplies bounded connection defaults.

The public key must have the current `sb_publishable_` form. The fixed HTTPS metadata probe uses an intentionally unexposed profile and `select=scope_id&limit=0`, rejects redirects, times out after 10 seconds and limits the response to 16 KiB. Only a structured `PGRST106` with one unambiguous schema list in the documented message or current hint is accepted. The receipt contains schema metadata, never arbitrary provider prose. A bare 406 is insufficient. [Supabase PGRST106 guidance](https://supabase.com/docs/guides/troubleshooting/pgrst106-the-schema-must-be-one-of-the-following-error-when-querying-an-exposed-schema)

Before apply, the helper requires:

1. A fresh API list (at most 60 seconds old) exactly `public, graphql_public`, in that order.
2. A direct session reporting database/operator `postgres`, `read_only=on` and backend TLS true.
3. No matching authenticator/all-role `pgrst.db_schemas` overrides at database/global scopes. Other role configuration is never returned.
4. Exactly the eight reviewed research tables with RLS enabled. This supplements the reviewed migration; it does not prove every policy or grant.
5. The same catalog baseline immediately before the single ALTER in a write transaction with 3-second lock and 10-second statement deadlines.

The receipt captures before/after setting rows. The new override must match exactly before commit. Rollback requires that exact override and an effective API list equal to either the original or newly configured list; the original is allowed because adoption can lag. Other settings/lists are drift. Already-applied operations and absent rollback settings are not silently retried or treated as no-ops.

The catalog and running API are separate systems: these checks cannot eliminate a concurrent external configuration edit between observations. Coordinate a quiet configuration window. Never infer exposure from catalog schema names or add `frontdesk` automatically.

## Verification and uncertain outcomes

After confirmed commit, one public probe must show exactly the intended ordered list. `committed: true, api_verified: false` means the setting was stored but adoption is pending or could not be verified. Use read-only follow-up checks, not another apply. Configuration/cache reload is asynchronous. [PostgREST schema selection and reload](https://docs.postgrest.org/en/v14/references/api/schemas.html)

`commit_outcome_unknown` means COMMIT was attempted without confirmation. Do not retry or automatically issue an inverse statement. First inspect the exact setting and effective list using read-only helpers; any explicit rollback must pass its own preconditions.

Adoption is not an RLS test. The coordinator must separately verify restricted A/B synthetic reads, cross-scope and anonymous denials, private object access and the existing anonymous `public.users` denial. Service-role success cannot certify tenant isolation. Do not add generic `GRANT ALL` examples; the research migration already provides restricted grants. [Supabase custom schemas](https://supabase.com/docs/guides/api/using-custom-schemas)

## Offline validation and limits

```text
bun test tools/cloud/data-api-exposure.test.ts
bun node_modules/typescript/bin/tsc --noEmit --module esnext --moduleResolution bundler --target es2022 --types bun --strict --skipLibCheck tools/cloud/data-api-exposure.ts tools/cloud/data-api-exposure.test.ts
```

Thirteen tests with 94 assertions passed, as did strict TypeScript checking and `--check`. Tests inject synthetic transports for schema bounds, ordered-list/catalog drift, exact apply/rollback, TLS/read-only/RLS guards, failure cleanup, commit uncertainty and delayed adoption. Bun setup is documented in [README-database.md](README-database.md).

The author has not executed this change. SQL privileges, API adoption and real restricted-user results remain coordinator/independent-review gates. A direct database reader is a separate implementation; substituting an administrator connection would not satisfy the existing PostgREST isolation test.
