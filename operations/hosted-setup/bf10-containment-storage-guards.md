# BF-10: the containment plan would have broken Storage on staging (12 Nov 2026)

**Status:** found before the 0031 apply; **nothing was changed on staging**. Fixed in PR #61 (BF-10); the deployed commit
and the owner's folder must be a commit on `main` that contains PR #61.

## What was found

QA rehearsed the 0031 apply (`tools/staging/apply-existing.ts`) on a scratch PostgreSQL database built like staging, using
the real plan the owner had generated from staging (`0031-plan.json`: 29 `statements`, 3 `providerAdminStatements`).

`apply-existing.ts` runs every statement of `planLegacyStagingContainment` in one transaction before migrating. One of them,
`REVOKE ALL ON ALL FUNCTIONS IN SCHEMA "neuvetra" FROM PUBLIC, anon, authenticated;`, also removed the deliberate PUBLIC
EXECUTE grant that migration 0027 gives the two Storage policy guards, `neuvetra.collection_storage_can_upload(text,text)`
and `neuvetra.collection_storage_can_read(text,text)`. Nothing granted them back. 0027's restrictive `to public` policies on
`storage.objects` call those functions for every row, so afterwards every Supabase Storage insert and select made with a
user token failed with `42501 permission denied for function …`, in **every** bucket, not only the evidence bucket. The
audit (`auditLegacyStagingExposure`) still reported `legacyContainmentVerified: true`, so neither the tool nor the image
would have noticed.

The runbook's step C2 also said both plan lists must be empty, which is never true for `statements`.

## What was not affected

Staging itself: the plan was generated (read only) but never applied. Today's staging still has both grants (the plan's own
audit lists the two guards as callable by anon and authenticated).

## The fix

- `planLegacyStagingContainment` now adds `GRANT EXECUTE ON FUNCTION <guard> TO PUBLIC;` for each reviewed guard that exists,
  directly after its schema's function revoke, in the same transaction. On staging's shape the plan is the previous 29
  statements plus exactly those two lines (31). Before 0027 (no guards) the plan is unchanged.
- `auditLegacyStagingExposure` reports `storagePolicyGuards`, `missingStorageGuardGrants` and a separate verdict,
  `storageGuardGrantsVerified` (`legacyContainmentVerified` keeps its earlier meaning). Tools that apply something
  (`apply-existing.ts`, `check-containment.ts`, the operator migration) require both verdicts and refuse otherwise.
- CEO ruling: the serving path (image boot, per-request readiness, `/ready`) requires only `legacyContainmentVerified`. A
  missing guard grant breaks Storage, not the workspace, so the server keeps serving; `/ready` stays ready and adds
  `storageGuardGrantsMissing: true` with the `missingStorageGuardGrants` list (a healthy `/ready` is unchanged); the server
  logs `storage_guard_grants_missing` naming function and role, at boot and at most once a minute.
- Native PostgreSQL tests: running the plan leaves both guards executable and Storage inserts/selects in the evidence bucket
  and another bucket exactly as before; with a guard revoked by hand a running server and a fresh boot keep serving and
  report it on `/ready`, Storage fails, and the migration refuses.
- The 0031 runbook: new C2 check, read-only guard queries before (C2b, C3b) and after (C5) C4, a functional check, a
  "resuming" box for the owner's paused state, and the deployed commit must contain PR #61. Any plan file made before BF-10 is void (C4 refuses it as plan drift).
