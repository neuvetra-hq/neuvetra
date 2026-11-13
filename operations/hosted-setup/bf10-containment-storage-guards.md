# BF-10: the containment plan would have broken Storage on staging (12 Nov 2026)

**Status:** found before the 0031 apply; **nothing was changed on staging**. Fixed in the BF-10 pull request
(`<BF-10 merge commit>` once merged).

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
- `auditLegacyStagingExposure` reports `storagePolicyGuards` and `missingStorageGuardGrants`, and is not verified while a
  reviewed guard exists that anon or authenticated cannot execute. Every audit caller (image readiness, the operator
  migration, the apply tools) then refuses instead of passing a broken database.
- Native PostgreSQL tests: running the plan leaves both guards executable and Storage inserts/selects in the evidence bucket
  and another bucket exactly as before; a guard revoked by hand makes the audit, readiness and the migration refuse.
- The 0031 runbook: new C2 check, a read-only guard query before and after C4, a functional check, and the deployed commit
  must contain BF-10. Any plan file made before BF-10 is void (C4 refuses it as plan drift).
