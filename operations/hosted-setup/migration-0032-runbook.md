# Owner runbook: applying migration 0032 to staging

Migration: `packages/neuvetra-database/src/migrations/0032_instrument_identity_and_bindings.sql` (PR "BF-18: migration 0032").
File fingerprint (sha256): `1d9a2c5ee01f90f6c1fd6a56baebc92c2d1a70a1442db2a1ff00085a5555033f` (78,957 bytes).
In this runbook, **"the 0032 PR"** is that pull request and **"the 0032 merge commit"** is its merge commit on `main`
(message `Merge pull request #<number> from neuvetra-hq/claude/bf-18-migration-0032`; the number is in the PR's title bar).
Step B3 finds that commit with git; you do not need to type it.

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
2. The stored copy of each certificate's numbers is corrected to equal what the user typed (until now numbers with more
   than three decimals were stored empty, and 12.5 was stored as 12.500). Nothing reads this copy, so **no figure changes**.
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

A1. In GitHub, open the 0032 PR. It must say **merged**. Note its number. On the main branch's commit list, the merge
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
$m = git log --format=%H --merges --grep='^Merge pull request #[0-9]* from neuvetra-hq/claude/bf-18-migration-0032' origin/main | Select-Object -First 1; if ($m) { git merge-base --is-ancestor $m HEAD; $LASTEXITCODE } else { 'The 0032 PR is not merged on origin/main' }
git branch -r --contains HEAD
Get-ChildItem packages\neuvetra-database\src\migrations\*.sql | Select-Object -Last 1 -ExpandProperty Name
(Get-FileHash packages\neuvetra-database\src\migrations\0032_instrument_identity_and_bindings.sql -Algorithm SHA256).Hash.ToLower()
```

- `git status` must show no changed files (if it does, stop and ask).
- `git log` must print the commit code from A2.
- The `$m` line must print `0`. `1`, or `The 0032 PR is not merged on origin/main`, means stop (rule 1).
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

C3b. Immediately before C4, run the 0031 runbook's C3b query (section C3b of `migration-0031-runbook.md`, unchanged). It
must return exactly the two guard rows (kind `function`, grantee `PUBLIC`, privilege `EXECUTE`), with `owner` equal to
`running_as`. Anything else: stop and ask.

C4. Apply:

```powershell
bun tools/staging/apply-existing.ts <your operator export file> <out>\0032-plan.json <fingerprint from C3> <out>\0032-apply.json
```

It must print `{"status":"containment_and_migrations_committed",...}`. **From this moment rule 2 applies: never roll
Railway back past the 0032 merge commit.**

C5. Straight after C4: run C2b again (both rows `true`, `true`) and open `/ready` (no `storageGuardGrantsMissing`). If a
guard shows `false`, tell the CTO at once; do not retry C4.

### If C4 prints `apply_failed`

The migration runs in one transaction, so in every case below 0032 was **not** applied and staging keeps working at 31.

- **`"sqlstate":"55P03"`** at stage `migration`: someone was saving; 0032 could not get a table lock within 5 seconds.
  Safe. Wait a few minutes and run C4 again with a new output name (same plan and fingerprint).
- **`"sqlstate":"55000"`** at stage `migration`: 0032's own guard stopped it (a function is not the expected one, P2, or
  the role does not bypass row-level security, P1, or a backfill check failed). Do not retry. Send the output to the CTO.
- **`"sqlstate":null`** at stage `migration`: the new safety check found that the migration would expose something to
  anon or authenticated (the tool's message is "A migration would break the verified legacy containment"); nothing was
  applied. Do not retry. Send the output to the CTO.
- **stage `validate`**: nothing was contacted. Check the fingerprint (C3), the output name (B6), the export file (B5) and
  the folder (B2).
- **Anything else**: do not retry. Send the CTO the printed line, the output file and the time.

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
- P6: `0`.

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
- C4: `apply_failed` with `55000`, `null` or anything other than `55P03` (see above).
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
