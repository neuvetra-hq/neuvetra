# M80 synthetic foundation runtime candidate

Date: 2026-09-24. Task `M80-FOUNDATION-RUNTIME-20260924`; software-engineering writer `/root/m80_foundation_runtime`; CTO sponsor and integration owner: root coordinator. Requested route `gpt-5.6-sol/high`; observed model and effort are unavailable. Role prompt SHA-256 `a9ab5574fe2ef1e940cb1950e6ae69da008ff71ba1f857b6a63b45d53240a52b`.

This candidate persists the accepted M80 fixed synthetic setup and exposes current state, immutable correction history and one bounded save operation. It keeps all four method profiles `held_candidate`, returns `releasedSupportedCount: 0`, and provides no calculation, factor, GWP, document, export, invitation or release-promotion operation. It has not been applied to a hosted database.

## Runtime boundary

- Migration `0022_scope1_beta_foundation.sql` adds six forced-RLS tables: held release records, operator-owned fixture admissions, current heads, immutable versions, idempotency requests and immutable audit records. Runtime receives `SELECT` on all six, no sequence or direct mutation privilege, and `EXECUTE` on one `SECURITY DEFINER` writer. Release, version, request and audit records are append-only.
- The writer requires verified staging access, authoritative manager membership, one exact active fixture admission, the exact four held registry rows, a closed synthetic setup and exact request/version metadata. Compare-and-swap predecessor binding and actor-bound idempotency serialize corrections. History is capped at 100 versions and 5 MB of canonical setup bytes per company.
- Reads verify stored canonical bytes, payload hash, fixed metadata, version hash, request fingerprint, audit binding, predecessor lineage and the current head before returning a result. Equivalent valid input ordering is normalized for the view only after the stored raw bytes and hash pass integrity checks.
- `GET /workspace-api/workspace/:companyId/scope1-beta-setup` returns the synthetic foundation, server-derived `canManage`, current version and ascending history metadata. `GET .../versions/:versionId` returns one authorized immutable version. `POST` accepts only `idempotencyKey`, exact predecessor fields, the closed correction reason and setup. An exact replay returns the original saved version even after a later successor exists.
- Members can read and receive `canManage: false`; owners/admins receive `canManage: true` and can save. Foreign tenants and unknown records share the same not-found response. Authentication, same-origin, body-size and no-store rules remain at the staging server boundary.

## Operator admission preparation

Admission is a separate operator action after exact migration review. The operator must bind only an existing synthetic company and an existing owner/admin identity. The reviewed statement uses `$1` for that company UUID and `$2` for that manager UUID:

```sql
insert into neuvetra.scope1_beta_fixture_admissions
  (company_id, fixture_profile_id, fixture_version, fixture_sha256, active, admitted_by)
select c.id,
  'm80-synthetic-scope1-foundation-v1',
  1,
  '2c6a9f78cded2a209bf536969e4ea389baa7fe1633c8ef63fad0c22826f77dc1',
  true,
  m.user_id
from neuvetra.companies c
join neuvetra.company_members m on m.company_id = c.id
where c.id = $1::uuid
  and m.user_id = $2::uuid
  and m.role in ('owner', 'admin')
returning company_id, fixture_profile_id, fixture_version, fixture_sha256, active, admitted_by;
```

The operator must require exactly one returned row and separately record the approved parameters. This candidate did not execute that statement on a hosted target.

## Local verification

The exact schema-21 database `m78_author_native_1789620106488` was cloned to the disposable loopback-only database `m80_foundation_author_20260924` on port 55472. Migration 0022 applied once and a second migration call was a no-op at 22 receipts. Candidate 2 canonical migration SHA-256 is `0ee148b366e803e8cf28187393f9e5a6f19b29f5bb54578e359db7cbcd795e35`.

The native adapter/API suite passed 5 tests and 51 assertions against real PostgreSQL. It verified all six new tables have forced RLS, runtime has exactly `SELECT` table grants, runtime lacks direct insert/update/delete and audit-sequence use, all four profiles remain held, manager/member authority differs, history and old-key replay work, concurrent successors yield one winner, direct mutations fail, a canonical direct-writer call reads back through the adapter inside a rollback, and malformed setup/request/version metadata fails closed.

Independent Candidate 1 review found one material boundary error: the SQL entrypoint accepted JSON strings for numeric version metadata before inserting them into integer columns. Candidate 2 requires exact JSON scalar types for request/version fields and a canonical UTC millisecond timestamp. The failed Candidate 1 snapshot remains retained.

The route and mounted staging suites passed 14 tests and 103 assertions. Pure M80 validation passed 10 tests and 93 assertions. Database and site API package typechecks passed, as did `git diff --check`. The repository-wide typecheck remains blocked by pre-existing missing FrontDesk Drizzle dependencies; the two changed packages typecheck independently.

## Deployment preparation and limits

Before any hosted action, an operator must independently review the frozen migration bytes and manifest, back up the target, confirm the target is the intended private synthetic project at schema 21, and compare all pre-existing rows plus relation, column, constraint, policy, trigger, index, function, role, membership and default-ACL metadata before and after a disposable-clone migration. New foreign-key triggers on referenced old tables are the only expected old-object additions. The operator must verify the six new tables, forced RLS, policies, grants, function ownership/search path and migration receipt, then run the parameterized admission above for the selected existing synthetic company. Application deployment must use code pinned to schema 22 and pass authenticated manager/member/foreign-tenant checks before invitation consideration.

Independent runtime security review remains pending. No provider, hosted migration, real data, M78 replay, method release, customer invitation, calculation or assurance claim occurred. This is a local candidate, not hosted-ready evidence.
