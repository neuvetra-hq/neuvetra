# Owner runbook: applying migration 0032 to staging

> **Do not apply until the CEO says the Scope 3 line-budget change (BF-21) is deployed.** CEO decision of 13 Nov 2026
> (`fix-orders-round2-partB.md`, "CEO decisions on BF-18 / migration 0032", item 1): the image that serves 0032 may be
> deployed when the 0032 PR merges, but 0032 itself is applied only once BF-21 is merged and deployed, so the new Scope 3
> line count and its route code arrive together.
>
> **Already checked by the CEO (13 Nov 2026, read only):** staging's `postgres` role has `rolbypassrls = true` and
> `rolsuper = false`; `neuvetra_runtime`, `anon` and `authenticated` have neither. Step P1 repeats this check on the day.

Migration: `packages/neuvetra-database/src/migrations/0032_instrument_identity_and_bindings.sql` (PR #72, "BF-18: migration 0032").
File fingerprint (sha256): `1d9a2c5ee01f90f6c1fd6a56baebc92c2d1a70a1442db2a1ff00085a5555033f` (78,957 bytes).
In this runbook, **"the 0032 PR"** is PR #72 and **"the 0032 merge commit"** is its merge commit on `main`, titled
`Merge pull request #72 from neuvetra-hq/claude/bf-18-migration-0032`. Step B3 finds that commit with git; you do not need
to type it.

Written for the owner on a Windows PC. Every command is typed in **PowerShell**. The repository is at `C:\neuvetra-repo`.
Your operator export file is the one you used for 0031 (kept by you, outside the repository; see B5). Choose an output
folder, for example `C:\neuvetra-0032`; this runbook writes `<out>` for it. Do this in a quiet period, when nobody is using
staging. The whole job takes about 20 minutes; the database change itself took about half a second in the rehearsal.

> **Stop and ask.** If anything on your screen differs from this runbook (a button or tab with another name, a message or
> value that is not the one written here, an extra step you are asked to confirm), **stop and ask the CTO before
> continuing**. Do not guess. Stopping before C4 never changes anything. Items marked **"unconfirmed, check on your
> screen"** are our best guess; if your screen shows something else, stop and ask. The full list is at the end.

## What 0032 does (for your understanding; nothing to do here)

One migration, applied once, in one transaction (all or nothing):

1. Electricity certificates and contracts can carry an identity (serial or contract statement, registry, face MWh): three
   new empty columns. Nothing uses them until a later order (BF-11).
2. The stored copy of each certificate's numbers is corrected to equal what the user typed. A stored number is empty
   (NULL) exactly when the typed value is empty (null), blank, or not a plain decimal such as `12.5` (for example `1e3`,
   `-1` or `12,5`); every plain decimal is stored as typed, with any number of decimals. Until now values with more than
   three decimals were stored empty and 12.5 was stored as 12.500. Nothing reads this copy, so **no figure changes**.
3. A Scope 3 report approval now also records the CSV it approved. Existing approvals get their own version's CSV hash.
4. Three smaller rules for later orders: a clearer database code for a reused save request, a "different meter"
   confirmation for leased assets, and the Scope 3 line budget counting Scope 3 records only (CEO decision on BF-21).

No result, report version, record or approval decision changes. The rehearsal (end of this file) proved it on a copy of
staging's shape.

---

## The three rules (read these first)

**1. Order: the new image first, then 0032.**
An image containing the 0032 PR must be the **active** staging deployment in Railway **before** you apply 0032. The old
image cannot run on schema 32: if 0032 goes in while the old image is active, staging answers 503 to everything until the
new image deploys. `/ready` showing `"schemaVersion":31` does **not** tell you which image runs (old and new both report 31
before 0032). Check the commit in Railway (A2) and with git (B3).

*If you broke rule 1 by mistake:* **do not touch the database.** Let the newest `main` deployment finish and become
active (or press Redeploy on that **newest** deployment only). Staging then serves again at 32. Tell the CTO.

**2. After 0032 is applied, never go back to an older image.**
Once C4 has succeeded, do **not** use Railway's Rollback, do **not** press Redeploy on any deployment older than the 0032
merge commit, and do **not** merge a revert of the 0032 PR. An image built before the 0032 PR serves only schemas 28 to 31,
so against schema 32 it answers 503 on every request or refuses to start ("Private staging dependencies are
unavailable"): staging goes down.

**3. If 0032 misbehaves, do not try to undo it. Stop and tell the CTO.**
Unlike 0031, 0032 adds columns and rewrites two derived copies, so there is no owner-side SQL to put it back, and a backup
restore is not the answer either (it would lose anything saved since). The image you deployed works at schema 32, so
staging keeps serving; the CTO fixes forward with a new migration.

---

## A. Checks before you start

A0. The CEO has told you that BF-21 is deployed (see the note at the top). If not, stop here.

A1. In GitHub, open PR #72. It must say **merged**. On the main branch's commit list, the merge
commit's checks must all be green.

A2. In Railway, open the staging project, the staging service, the **Deployments** tab, and find the deployment marked
**Active** (*labels unconfirmed, check on your screen*). It must be the 0032 merge commit or a later commit on `main`. If
it is older, or the newest deployment is still building or failed, **stop and wait**. Write down the full 40-character
commit code of the active deployment (open it in GitHub and copy it from the address bar). You need it in B3.

A3. Open the staging `/ready` address. It must say `"status":"ready"` and `"schemaVersion":31`, and must **not** contain
`storageGuardGrantsMissing`. Anything else: stop.

A4. Make two folders, `<out>\before` and `<out>\after`. Sign in to staging. For each test company (Synthetic Cedar and
Synthetic Redwood):

- on its Results page, press **Download CSV** (the Scope 1 and 2 Results CSV);
- in its Scope 3 results, press **Download Scope 3 CSV** (the plain CSV, **not** "Download as ZIP"; the ZIP always differs).

Rename each file as soon as it downloads and move it into `before`: `cedar-results.csv`, `cedar-scope3.csv`,
`redwood-results.csv`, `redwood-scope3.csv`. If a Results page says "More than 400 active Scope 1 and 2 records", that
company has no Results CSV: note it and skip that file (before and after).

A5. Read-only checks in the Supabase **SQL editor** (*location unconfirmed, check on your screen*). They change nothing.
Paste each one, run it, and copy the result into a text file `<out>\sql-before.txt`.

```sql
-- P1: the role that applies migrations must bypass row-level security (0032 refuses to run otherwise).
select rolname, rolsuper, rolbypassrls from pg_roles where rolname = current_user;
```

Expected: one row, `postgres`, and `rolbypassrls` = `true` (or `rolsuper` = `true`). If both are `false`, **stop and ask**.

```sql
-- P2: the four functions 0032 replaces.
select proname, md5(prosrc) from pg_proc where pronamespace='neuvetra'::regnamespace and proname in ('collection_assert_activity','save_collection_activity','approve_scope3_report','scope3_active_line_count') order by 1;
```

Expected exactly (the "before" column):

| Function | Before 0032 | After 0032 |
|---|---|---|
| `approve_scope3_report` | `5381e69b395abef537e02f93127aa726` | `34943c0f7aa12fbefcbc78b3a9caef87` |
| `collection_assert_activity` | `58164f62f8431d8bbd1013037b20eea3` | `127febca8d7bb1fbbd3d52eda5756338` |
| `save_collection_activity` | `20af0cfd2e915c23e8670b8c0b14b95e` | `beec39de7d66151a94843d538950ac67` |
| `scope3_active_line_count` | `9279221fe0b977ac72aa5f7b17afd096` | `1c6c5c0f10ab170ba50e904e56d288d2` |

Any other "before" value: **stop and ask** (0032's own guard would refuse with `55000` anyway).

```sql
-- P3: every other neuvetra function, as one fingerprint (must be the same after 0032).
select count(*) as other_functions, md5(string_agg(p.oid::regprocedure::text || ':' || md5(p.prosrc), ',' order by p.oid::regprocedure::text)) as fingerprint from pg_proc p where p.pronamespace='neuvetra'::regnamespace and p.proname not in ('collection_assert_activity','save_collection_activity','approve_scope3_report','scope3_active_line_count');
```

Write down both values. (The rehearsal copy built from the repository gave `266` and `3e3a781076dfdd675ecc6926c9c2bdf4`;
staging may differ if it has extra functions, which is not a reason to stop. Only a change from before to after matters.
The function privileges are not part of this fingerprint: 0032 proves its own and C2b, C5 and E5 check the rest.)

```sql
-- P4: rows 0032 touches or must not touch (must be the same after 0032).
select (select count(*) from neuvetra.collection_electricity_instruments) as instrument_rows, (select count(*) from neuvetra.scope3_report_approvals) as approvals, (select count(*) from neuvetra.scope3_report_versions) as report_versions, (select count(*) from neuvetra.collection_activity_versions) as activity_versions, (select md5(string_agg(id::text || payload_sha256, ',' order by id)) from neuvetra.collection_activity_versions) as payload_fingerprint, (select md5(string_agg(id::text || report_sha256 || csv_sha256, ',' order by id)) from neuvetra.scope3_report_versions) as report_fingerprint;
```

Write down all six values.

```sql
-- P5: every stored report CSV matches its hash (must be 0).
select count(*) as csv_hash_mismatches from neuvetra.scope3_report_versions where csv_sha256 <> encode(sha256(convert_to(csv_text,'UTF8')),'hex');
```

Expected `0`. Anything else: **stop and ask** (approvals are anchored to the stored CSV).

```sql
-- P6: certificate rows whose stored copy differs from what was typed (0032 rewrites exactly these; after 0032 it is 0).
select count(*) as instrument_rows_to_rewrite from neuvetra.collection_electricity_instruments i join neuvetra.collection_activity_versions v on v.id=i.version_id and v.company_id=i.company_id cross join lateral jsonb_array_elements(v.payload#>'{payload,instruments}') with ordinality e(x,n) where e.n=i.ordinal and (i.mwh::text is distinct from (case when e.x->>'mwh' ~ '^(0|[1-9][0-9]*)(\.[0-9]+)?$' then e.x->>'mwh' end) or i.rate_co2_lb_per_mwh::text is distinct from (case when e.x#>>'{rateLbPerMwh,co2}' ~ '^(0|[1-9][0-9]*)(\.[0-9]+)?$' then e.x#>>'{rateLbPerMwh,co2}' end) or i.rate_ch4_lb_per_mwh::text is distinct from (case when e.x#>>'{rateLbPerMwh,ch4}' ~ '^(0|[1-9][0-9]*)(\.[0-9]+)?$' then e.x#>>'{rateLbPerMwh,ch4}' end) or i.rate_n2o_lb_per_mwh::text is distinct from (case when e.x#>>'{rateLbPerMwh,n2o}' ~ '^(0|[1-9][0-9]*)(\.[0-9]+)?$' then e.x#>>'{rateLbPerMwh,n2o}' end));
```

Write down the number (any number is fine; it is usually more than 0).

## B. Prepare your PC

B1. `bun --version` must print `1.3.12`. Otherwise stop and ask.

B2. Go to the repository and check the certificate file:

```powershell
cd C:\neuvetra-repo
Test-Path tools\cloud\fixtures\supabase-prod-ca-2021.crt
```

It must print `True`. Every later command runs from `C:\neuvetra-repo`.

B3. Put the folder at exactly the commit Railway runs:

```powershell
git status
git fetch origin
git checkout --detach <full commit code from A2>
git log -1 --format=%H
$m = git log --format=%H --merges --grep='^Merge pull request #72 from neuvetra-hq/claude/bf-18-migration-0032' origin/main | Select-Object -First 1; if ($m) { git merge-base --is-ancestor $m HEAD; $LASTEXITCODE } else { 'The 0032 PR is not merged on origin/main' }
git branch -r --contains HEAD
Get-ChildItem packages\neuvetra-database\src\migrations\*.sql | Select-Object -Last 1 -ExpandProperty Name
(Get-FileHash packages\neuvetra-database\src\migrations\0032_instrument_identity_and_bindings.sql -Algorithm SHA256).Hash.ToLower()
```

- `git status` must show no changed files (if it does, stop and ask).
- `git log` must print the commit code from A2.
- The `$m` line must print `0` (it finds the merge commit titled `Merge pull request #72 from
  neuvetra-hq/claude/bf-18-migration-0032` and checks that the deployed commit contains it). `1`, or `The 0032 PR is not
  merged on origin/main`, means stop (rule 1).
- `git branch -r --contains HEAD` must list `origin/main`.
- The migrations line must print `0032_instrument_identity_and_bindings.sql`. A later file (0033 or above): stop, this
  runbook does not cover it.
- The last line must print `1d9a2c5ee01f90f6c1fd6a56baebc92c2d1a70a1442db2a1ff00085a5555033f`. If it prints a
  different value, the file's line endings were probably changed by Windows: still continue only if the CTO says so (the
  tool normalises line endings; this is a safety check).

B4. `bun install --frozen-lockfile`, then `git status`. The only allowed failure is the one package
`webgpu-claude-skill` (as for 0031: the only `error:` line names it and the last line says `Failed to install 1 package`).
Anything else: stop and ask. `git status` must still show no changed files.

B5. Your operator export file is unchanged from 0031: one line
`DATABASE_URL=postgresql://postgres.<project-ref>:<database-password>@aws-1-us-west-1.pooler.supabase.com:5432/postgres`
(session pooler, port 5432; a password with anything but letters and digits percent-encoded, as the 0031 runbook B5
explains). Keep it outside the repository.

B6. Each tool refuses to overwrite a file. Use new names on every retry (for example `0032-apply-2.json`).

## C. Apply (plan, then apply)

C1. Read-only plan:

```powershell
bun tools/staging/plan-existing.ts <your operator export file> <out>\0032-plan.json
```

It must print `{"status":"read_only_plan_saved",...}`. `Existing target plan unavailable.` changes nothing: check B2, B5,
B6 and the network, then retry with a new file name.

C2. Check the plan. It is the same access-grant containment as for 0031 (0032 adds no schema and no function), so on
today's staging it must contain **exactly 31 statements**, in this order: `REVOKE CREATE ON DATABASE "postgres" …`; then
for each of `drizzle`, `frontdesk`, `neuvetra`, `neuvetra_research_dev`, `public`, `site`, `terrascope` the four lines
`REVOKE ALL ON SCHEMA …`, `REVOKE ALL ON ALL TABLES IN SCHEMA …`, `REVOKE ALL ON ALL SEQUENCES IN SCHEMA …`,
`REVOKE ALL ON ALL FUNCTIONS IN SCHEMA …`, each ending `FROM PUBLIC, anon, authenticated;`; and directly after the
`neuvetra` function revoke exactly the two lines
`GRANT EXECUTE ON FUNCTION neuvetra.collection_storage_can_read(text,text) TO PUBLIC;` and
`GRANT EXECUTE ON FUNCTION neuvetra.collection_storage_can_upload(text,text) TO PUBLIC;`.
`"providerAdminStatements"` (not run by the tool) must be the same three `ALTER DEFAULT PRIVILEGES FOR ROLE
"supabase_admin" IN SCHEMA "public" REVOKE ALL ON <FUNCTIONS|TABLES|SEQUENCES> FROM PUBLIC, anon, authenticated;` lines as
for 0031 (in any order).

Paste these two lines (they only read the file):

```powershell
$plan = '<out>\0032-plan.json'
$p = Get-Content $plan -Raw | ConvertFrom-Json; "statements: $($p.statements.Count)"; $p.statements | Where-Object { $_ -cnotmatch '^REVOKE ALL ON (SCHEMA|ALL TABLES IN SCHEMA|ALL SEQUENCES IN SCHEMA|ALL FUNCTIONS IN SCHEMA) "(drizzle|frontdesk|neuvetra|neuvetra_research_dev|public|site|terrascope)" FROM PUBLIC, anon, authenticated;$' -and $_ -cnotmatch '^REVOKE CREATE ON DATABASE "postgres" FROM PUBLIC, anon, authenticated;$' -and $_ -cnotmatch '^GRANT EXECUTE ON FUNCTION neuvetra\.collection_storage_can_(read|upload)\(text,text\) TO PUBLIC;$' } | ForEach-Object { "UNEXPECTED: $_" }; $i = [array]::IndexOf($p.statements, 'REVOKE ALL ON ALL FUNCTIONS IN SCHEMA "neuvetra" FROM PUBLIC, anon, authenticated;'); "after neuvetra function revoke:"; $p.statements[$i+1]; $p.statements[$i+2]; "provider (not executed): $($p.providerAdminStatements.Count)"; $p.providerAdminStatements
```

It must print `statements: 31`, **no** `UNEXPECTED:` line, the two `GRANT EXECUTE …` lines under `after neuvetra function
revoke:`, and `provider (not executed): 3` with the three `supabase_admin` lines. Anything else: stop and send the file to
the CTO.

C2b. In the SQL editor (read-only), the two Storage guards must both show `true`, `true`:

```sql
select s.sig, has_function_privilege('anon', s.sig, 'EXECUTE') as anon, has_function_privilege('authenticated', s.sig, 'EXECUTE') as authenticated
from unnest(array['neuvetra.collection_storage_can_read(text,text)', 'neuvetra.collection_storage_can_upload(text,text)']) as s(sig) order by 1;
```

C3. The plan's fingerprint:

```powershell
(Get-FileHash <out>\0032-plan.json -Algorithm SHA256).Hash.ToLower()
```

C3b. Immediately before C4, in the SQL editor, run this **read-only** query (the same as the 0031 runbook's C3b). It lists
every grant in the seven application schemas, and the database's CREATE, that C4's revokes could remove; `running_as`
shows who you are (C4 runs as the same `postgres` role).

```sql
with s(n) as (values ('drizzle'),('frontdesk'),('neuvetra'),('neuvetra_research_dev'),('public'),('site'),('terrascope')),
objs as (
  select 'database'::text as kind, null::text as schema_name, datname::text as object_name, datacl as acl, datdba as owner, 'd'::"char" as t
    from pg_database where datname = current_database()
  union all
  select 'schema', nspname::text, nspname::text, nspacl, nspowner, 'n'::"char" from pg_namespace where nspname in (select n from s)
  union all
  select case c.relkind when 'S' then 'sequence' else 'table' end, n.nspname::text, c.relname::text, c.relacl, c.relowner,
         case c.relkind when 'S' then 's'::"char" else 'r'::"char" end
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname in (select n from s) and c.relkind in ('r','p','v','m','f','S')
  union all
  select 'function', n.nspname::text, p.oid::regprocedure::text, p.proacl, p.proowner, 'f'::"char"
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in (select n from s)
),
cols as (
  select 'column'::text as kind, n.nspname::text as schema_name, c.relname || '.' || a.attname as object_name, c.relowner as owner, x.grantee, x.privilege_type, x.grantor, false as implicit_default
    from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
    cross join lateral aclexplode(a.attacl) x
   where n.nspname in (select n from s) and a.attnum > 0 and not a.attisdropped and a.attacl is not null
)
select kind, schema_name, object_name, pg_get_userbyid(owner) as owner, current_user as running_as,
       case when grantee = 0 then 'PUBLIC' else pg_get_userbyid(grantee) end as grantee,
       privilege_type, pg_get_userbyid(grantor) as grantor, implicit_default
from (
  select o.kind, o.schema_name, o.object_name, o.owner, a.grantee, a.privilege_type, a.grantor, (o.acl is null) as implicit_default
    from objs o cross join lateral aclexplode(coalesce(o.acl, acldefault(o.t, o.owner))) a
   where not (o.kind = 'database' and a.privilege_type <> 'CREATE')
  union all select * from cols
) g
where grantee = 0 or pg_get_userbyid(grantee) in ('anon', 'authenticated')
order by kind, schema_name, object_name, grantee, privilege_type;
```

It must return **exactly two rows**, the two guards: kind `function`, schema `neuvetra`, object
`neuvetra.collection_storage_can_read(text,text)` and `neuvetra.collection_storage_can_upload(text,text)`, grantee
`PUBLIC`, privilege `EXECUTE`, and `owner` equal to `running_as`. Anything else: stop and ask.

C3c. **Make sure nobody is saving or approving during C4.** Tell the staging users (or pick a moment when you know nobody
is working) that staging must be left alone for a minute, then run C4 straight away; the change itself takes under a
second. Why: a save that has already started when C4 begins waits for C4 and then finishes with the **old** save function,
so for a certificate whose figure has more than three decimals it stores the derived copy empty again. No emissions figure
is affected (nothing reads that copy), but the copy would no longer match. Step E3's check P6 catches exactly this: after
C4 it must be `0`. If P6 is not `0`, stop and send the CTO the P6 result and the time; do not run anything yourself (the
CTO's repair is in the appendix at the end, not an owner step).

C4. Apply:

```powershell
bun tools/staging/apply-existing.ts <your operator export file> <out>\0032-plan.json <fingerprint from C3> <out>\0032-apply.json
```

It must print `{"status":"containment_and_migrations_committed",...}`. **From this moment rule 2 applies: never roll
Railway back past the 0032 merge commit.**

C5. Straight after C4: run C2b again (both rows `true`, `true`) and open `/ready` (no `storageGuardGrantsMissing`). If a
guard shows `false`, tell the CTO at once; do not retry C4.

### If C4 prints `apply_failed`

**First, before anything else, open `/ready` and write down its `schemaVersion`, and send it to the CTO with the printed
line, the output file and the time.** In every case below the migration runs in one transaction, so normally nothing was
applied and `/ready` still says `31`. But if the connection dropped at the exact moment of commit, 0032 may have been
applied after all: `/ready` then says `32`. In that case **do not retry C4**; rule 2 now applies, and you continue with E1
to E5 only after the CTO says so.

The printed line has a `stage`, a `sqlstate` and (from this PR on) a `reason` with a plain sentence (`detail`):

| `reason` | Meaning | What you do |
|---|---|---|
| `inputs_invalid` (stage `validate`) | Nothing was contacted. Wrong fingerprint, an output name that exists, the export file, or not in `C:\neuvetra-repo`. | Check C3, B6, B5 and B2, then run C4 again with a new output name. |
| `role_without_bypassrls` (stage `role`) | The role in the export file does not bypass row-level security. Nothing was run. | Stop and ask (P1 should have caught it). |
| `plan_drift` (stage `containment`) | The database's plan is no longer the reviewed plan file. Nothing was applied. | Make a new plan (C1) and check it again (C2, C2b, C3, C3b). |
| `containment_not_verified` (stage `containment`) | The containment check failed after the plan's statements; rolled back. | Stop and ask. |
| `database_refused` with `"sqlstate":"55P03"` (stage `migration`) | Someone was saving; 0032 could not get a table lock within 5 seconds. Safe. | Check `/ready` says 31, wait a few minutes (C3c), run C4 again with a new output name (same plan and fingerprint). |
| `database_refused` with `"sqlstate":"55000"` (stage `migration`) | 0032 stopped itself: one of the four functions is not the expected one (P2), or one of its own checks after a backfill failed (the database's message starts `0032:`). | Do not retry. Stop and ask. |
| `database_refused` with any other `sqlstate` | The database refused a statement. | Do not retry. Stop and ask. |
| `legacy_containment_not_verified`, `receipts_mismatch` or `migration_would_expose` (stage `migration`) | The migration tool refused: containment not verified before migrating; the database's receipts are not what this folder expects; or a migration would have exposed something to anon or authenticated (rolled back). | Do not retry. Stop and ask. |
| `connection_lost` (any stage) | The network or the database connection failed. | `/ready` first (above). If it says 31, wait and run C4 again with a new output name; if it says 32, do not retry. |
| `other` | Anything else. | Do not retry. Stop and ask. |

An older tool (before this PR) printed only `"sqlstate":null` for every failure that is not a database refusal; that never
meant only one thing.

## D. Backup (optional)

As for 0031 (its section D), optional for this synthetic data: 0032 rewrites only derived copies, and the checks in A and E
prove nothing else changed. If you want it, run it before C1.

## E. Verify afterwards

E1. `/ready` (no restart needed) must say `"schemaVersion":32` and must not contain `storageGuardGrantsMissing`.

E2. Download the same four CSVs into `<out>\after` with the same names (A4). Compare them with the 0031 runbook's helper,
with the folder changed:

```powershell
function Compare-Csv($name) {
  $bp = "<out>\before\$name"; $ap = "<out>\after\$name"
  if (-not (Test-Path -LiteralPath $bp) -or -not (Test-Path -LiteralPath $ap)) { "$name MISSING"; return }
  $b = @(Get-Content -LiteralPath $bp | Where-Object { $_ -notlike '# Generated:*' })
  $a = @(Get-Content -LiteralPath $ap | Where-Object { $_ -notlike '# Generated:*' })
  if (($b -join "`n") -ceq ($a -join "`n")) { "$name SAME" } else { "$name DIFFERENT"; Compare-Object $b $a -CaseSensitive }
}
'cedar-results.csv','cedar-scope3.csv','redwood-results.csv','redwood-scope3.csv' | ForEach-Object { Compare-Csv $_ }
```

Every file must print `SAME`. `DIFFERENT`: do not retry, do not roll back (rule 2); send the CTO both files.

E3. Run P2, P3, P4, P5 and P6 again in the SQL editor and save them as `<out>\sql-after.txt`:

- P2: the four values must equal the **"After 0032"** column of the table in A5.
- P3: both values must equal the ones you wrote down before.
- P4: all six values must equal the ones you wrote down before.
- P5: `0`.
- P6: `0`. If it is not `0`, a save ran during C4 (C3c): stop and send the CTO the P6 result and the time. Do not
  repair it yourself.

Then:

```sql
-- A1: every approval carries its version's CSV hash (both must be 0).
select count(*) filter (where a.csv_sha256 is null) as missing, count(*) filter (where a.csv_sha256 is distinct from v.csv_sha256) as different from neuvetra.scope3_report_approvals a join neuvetra.scope3_report_versions v on v.id=a.version_id and v.company_id=a.company_id;
```

Any difference in E3: do not retry, do not roll back; send the CTO both text files.

E4. Functional check, as 0031's E2b, with a synthetic test account (*labels unconfirmed*): upload one small synthetic
evidence file; open an evidence file that opened before; save one small change to any record of a test company; open
the Scope 3 report versions list. Any error: tell the CTO with the time (no retry, no rollback).

E5. Open `<out>\0032-apply.json`: `audit.legacyContainmentVerified` and `audit.storageGuardGrantsVerified` must be `true`,
`audit.missingStorageGuardGrants` `[]`, `migration.schemaVersion` `32`, the last entry of `migration.migrations`
`0032_instrument_identity_and_bindings.sql` with sha256 `1d9a2c5ee01f90f6c1fd6a56baebc92c2d1a70a1442db2a1ff00085a5555033f`,
and `migration.postMigrationAudit` both `true`.

E6. Tell the CTO the apply time and the `/ready` result. A **separate follow-up PR** then changes `LIVE_STAGING_SCHEMA` from
`'31'` to `'32'` in `.github/workflows/verify.yml` (job `migration-guard`). Not before 0032 is applied.

## When you are finished

B3 left the folder on a detached commit: `git checkout main`.

## Stop-and-ask list

Stop (change nothing, ask the CTO) if:

- A2: the active deployment is older than the 0032 merge commit, or the newest is building or failed.
- A3: `/ready` is not ready at 31, or contains `storageGuardGrantsMissing`.
- P1: neither `rolbypassrls` nor `rolsuper` is `true`.
- P2: any "before" value differs from the table.
- P5: not `0`.
- B1: Bun is not 1.3.12. B3: any check fails. B4: another package fails, or files changed.
- C2: not 31 statements, any `UNEXPECTED:` line, the GRANT lines missing or elsewhere, not 3 provider lines.
- C2b / C3b: a guard not executable, a third row, or `owner` different from `running_as`.
- A0: the CEO has not said BF-21 is deployed.
- C4: any `apply_failed` other than `inputs_invalid`, `plan_drift`, `55P03` or `connection_lost` with `/ready` at 31; and
  always check `/ready` first after any `apply_failed`.
- E3: P6 is not `0` after C4.
- E1–E5: any value other than the expected one.
- Anything on your screen that this runbook does not describe.

---

## Rehearsal record (CTO, not an owner step)

The developer of the 0032 PR rehearsed this owner path end to end on a scratch PostgreSQL 16 restored from a schema-31
dump with the hosted shape: a non-superuser migration role with BYPASSRLS named as the pooler user, `anon`,
`authenticated`, `neuvetra_runtime`, the seven application schemas, Supabase's provider default privileges, the Storage
guards, verified TLS on the pooler host name, and two companies seeded through the image's own routes (Scope 1, Scope 2
with certificates, contracts and a stated rate with four-decimal figures, Scope 3 records, a correction, a withdrawal, a
report version approved and a second one prepared). Plan: 31 statements as above. C4 committed in 0.5 s; `/ready` 32;
every Results, Scope 3 and frozen-report file identical before and after (only `# Generated:` lines differ); P2 to P6 and
A1 as expected; a second plan and apply changed no row, function, constraint or trigger. The commands and outputs are in
the PR description. Deviations from your PC: Linux instead of Windows, Bun 1.4.4, a rehearsal certificate authority, and
psql instead of the SQL editor.

## Appendix for the CTO only: repairing P6 after a save raced C4

Not an owner step. A save that started before C4 waits on 0032's table lock and then finishes with the old body of
`save_collection_activity` (its plan was already running), so its instrument rows store values with more than three
decimals as NULL and `12.5` as `12.500`. QA reproduced this (PR #72 QA notes, `sc-race2`). Nothing reads those columns;
figures are unaffected; only the projection proof (P6) is broken.

Fix forward, in the Supabase SQL editor as `postgres`, in a quiet moment (C3c):

1. Run the read-only P2: all four values must be the "After 0032" column, so the save function in place is 0032's.
2. Copy section 2 of `0032_instrument_identity_and_bindings.sql` from GitHub's **Raw** view of the merged commit: from the
   line starting `-- 2. Backfill the projection from each version's own payload (BI-06).` (line 69) to the line
   `end $projection$;` (line 112). That section only rewrites instrument rows whose stored numbers differ from their payload
   (its own WHERE clause), with the row trigger disabled for that one UPDATE and enabled again, and then proves the whole
   projection. It replaces no function, so a Windows line-ending change in the paste cannot change any function text.
   Run it as one query:

   ```sql
   begin;
   set local lock_timeout = '5s';
   -- section 2 of 0032 (lines 69-112), pasted unchanged
   commit;
   ```

   If it stops (for example `55P03`, or `0032: an instrument row differs from its payload`), it rolled back and changed
   nothing. Do not add a receipt line: the receipt is already there.
3. Run P2 to P6 and A1 again: P6 must be `0`, P2 the "After 0032" column, P3 and P4 unchanged. (Rehearsed: running 0032's
   SQL again on a schema-32 database changed no row, function, constraint or trigger; QA's repair of the race brought P6
   from 1 to 0; the section-2-only repair was rehearsed: P6 2 → 0, the four function texts unchanged, the trigger enabled.)
