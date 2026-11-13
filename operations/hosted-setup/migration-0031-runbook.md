# Owner runbook: applying migration 0031 to staging

Migration: `packages/neuvetra-database/src/migrations/0031_integrity_guards.sql` (PR #52, BF-09).
File fingerprint (sha256): `3513b5da55e41133d94faaf3a8b610e1fb66f415a95393272d3f8b1c49246cd7` (63,029 bytes).
PR #52's merge commit on `main`: `687ed3f185c8e00b038e46ef5a24dac593722437`
(message `Merge pull request #52 from neuvetra-hq/claude/bf-09-migration-0031`).

> **BF-10 (12 Nov 2026): the tools changed; read this first.** The containment step that `apply-existing.ts` runs before
> migrating used to remove the deliberate PUBLIC EXECUTE grant on the two Storage policy guards from 0027, which would have
> broken every Storage upload and download on staging (see `bf10-containment-storage-guards.md` in this folder). Nothing was
> changed on staging. The fixed tools add exactly two `GRANT EXECUTE` lines to the plan. So: the deployed commit, and your
> local folder (B3), must be a commit on `main` that contains PR #61 (BF-10) as well as PR #52 (A2, B3); any plan file
> made before PR #61 is void (make a new one in C1); C2, C2b, C3b and C5 below are the new checks. From PR #61 on, `/ready`
> also reports a lost Storage guard grant: it stays `"status":"ready"` but adds `"storageGuardGrantsMissing":true` and a
> `"missingStorageGuardGrants"` list (the workspace keeps working; uploads and downloads fail). A healthy `/ready` has
> neither field.

> **Resuming after the 12 Nov pause (your exact state).** You stopped before C4: the clone is at `C:\neuvetra-repo`,
> dependencies are installed, your operator export file works, `C:\neuvetra-0031\0031-plan.json` is a **void** pre-BF-10
> plan, and the four "before" CSVs are in `C:\neuvetra-0031\before`. Those CSVs stay valid unless someone changed staging
> data since (the comparison ignores the `# Generated:` line); if in doubt, download them again (A4). Do A2 and A3 first
> (the active deployment must now contain PR #61; `/ready` at 30 with no `storageGuardGrantsMissing`). Then, in PowerShell:
>
> ```powershell
> cd C:\neuvetra-repo
> Rename-Item C:\neuvetra-0031\0031-plan.json 0031-plan-VOID-pre-BF10.json
> git status
> git fetch origin
> git checkout --detach <full commit code from A2>
> git log -1 --format=%H
> git merge-base --is-ancestor 687ed3f185c8e00b038e46ef5a24dac593722437 HEAD; $LASTEXITCODE
> $m = git log --format=%H --merges --grep='^Merge pull request #61 from ' origin/main | Select-Object -First 1; if ($m) { git merge-base --is-ancestor $m HEAD; $LASTEXITCODE } else { 'PR #61 is not merged on origin/main' }
> git branch -r --contains HEAD
> bun install --frozen-lockfile
> git status
> bun tools/staging/plan-existing.ts <your operator export file> C:\neuvetra-0031\0031-plan-2.json
> ```
>
> Check each output exactly as B3, B4 and C1 say (both ancestor lines print `0`). Then run C2 with
> `$plan = 'C:\neuvetra-0031\0031-plan-2.json'`, then C2b and C3b in the SQL editor, then C3 and C4 on the new file:
>
> ```powershell
> (Get-FileHash C:\neuvetra-0031\0031-plan-2.json -Algorithm SHA256).Hash.ToLower()
> bun tools/staging/apply-existing.ts <your operator export file> C:\neuvetra-0031\0031-plan-2.json <fingerprint from the line above> C:\neuvetra-0031\0031-apply.json
> ```
>
> then C5 and E1 to E4. Everything else in this runbook applies unchanged.

Written for the owner on a Windows PC. Every command below is typed in **PowerShell**. Do this in a quiet period, when nobody is
using staging. The whole job takes about 15 minutes; the database change itself takes under a second.

> **Stop and ask.** If anything on your screen differs from this runbook (a button or tab with another name, a message or
> value that is not the one written here, an extra step you are asked to confirm), **stop and ask the CTO before
> continuing**. Do not guess. Stopping before C4 never changes anything. Items marked **"unconfirmed, check on your screen"**
> are our best guess of what you will see; if your screen shows something else, that is a reason to stop and ask, not to
> improvise.

---

## The three rules (read these first)

**1. Order: the new image first, then 0031.**
An image containing PR #52 must be the **active** staging deployment in Railway **before** you apply 0031. The old image
cannot run on schema 31: if 0031 goes in while the old image is active, staging answers 503 to everything until the new
image deploys. `/ready` showing `"schemaVersion":30` does **not** tell you which image is running (the old and the new image
both report 30 before 0031). Check the commit in Railway, as in step A2.

*If you broke rule 1 by mistake* (0031 went in before the new image was active): **do not touch the database.** Let the
newest `main` deployment in Railway finish building and become active (or, if it already failed, press Redeploy on that
**newest** deployment only). Once it is active, staging serves again at schema 31. Then tell the CTO.

**2. After 0031 is applied, never go back to an older image.**
Once step C4 has succeeded, do **not** use Railway's Rollback, do **not** press Redeploy on any deployment older than commit
`687ed3f` (PR #52's merge), and do **not** merge a revert of PR #52. An image built before PR #52 answers 503 on every
request (or refuses to start, "Private staging dependencies are unavailable") against schema 31, so any of those takes
staging down.

**3. If 0031 misbehaves, recover by SQL, not by a backup.**
0031 only replaces three database functions and adds TRUNCATE guards; it writes no data rows (apart from its own receipt).
Recovery is to put 0030's three function definitions back, in one transaction (section F). No backup restore is needed.

---

## A. Checks before you start

A1. In GitHub, open PR #52. It must say **merged**, with merge commit `687ed3f` (full code
`687ed3f185c8e00b038e46ef5a24dac593722437`). On the main branch's commit list, that commit's checks must all be green.

A2. In Railway, open the staging project, then the staging service, then the **Deployments** tab, and find the deployment
marked **Active** (*Railway screen labels "Deployments" and "Active": unconfirmed, check on your screen*).
The active deployment must be **commit `687ed3f` or a later commit on `main`** (a later main commit contains PR #52):

- Commit `687ed3f` itself shows the message `Merge pull request #52 from neuvetra-hq/claude/bf-09-migration-0031`.
- A later main commit shows some other message; B3 checks with git that it contains PR #52.
- **BF-10:** the active deployment must also be a commit on `main` that contains PR #61 (its merge commit, message
  `Merge pull request #61 from neuvetra-hq/claude/bf-10-containment-keeps-storage-guards`, or any later `main` commit). B3
  checks that with git. If it is older, stop and wait for the newer deployment to become active.

If the active deployment is older than `687ed3f`, or the newest deployment is still building or failed, **stop and wait**
(or ask the CTO). Do not continue on `/ready` alone.
Write down the full 40-character commit code of the active deployment (click it to open it in GitHub, and copy the code from
the address bar or the commit page). You need it in B3.

A3. Open the staging site's `/ready` address (the one you check after every deploy). It must say `"status":"ready"` and
`"schemaVersion":30`, and must **not** contain `storageGuardGrantsMissing`. If it says anything else, stop.

A4. Make two folders outside the repository, for example `C:\neuvetra-0031\before` and `C:\neuvetra-0031\after`.
Sign in to staging. For each of the two test companies (Synthetic Cedar and Synthetic Redwood):

- on its Results page, press **Download CSV** (the Scope 1 and 2 Results CSV);
- in its Scope 3 results (*location: unconfirmed, check on your screen*; the code places it lower on the same Results page,
  but it may appear as a separate tab or view), press **Download Scope 3 CSV** (the plain CSV). Do **not** use "Download as ZIP (one CSV per section)": the ZIP's bytes
  contain a timestamp and always differ.

Both companies' files download with the same names (`neuvetra-draft-results-<date>.csv` and
`neuvetra-draft-scope3-<date>.csv`; the browser adds ` (1)` to the second one). Move each into the `before` folder straight
away and rename it so you can tell them apart: `cedar-results.csv`, `cedar-scope3.csv`, `redwood-results.csv`,
`redwood-scope3.csv`.

If a company's Results page says **"More than 400 active Scope 1 and 2 records. Withdraw records you no longer need to see
results."**, that company has no Results CSV. That is expected, before and after 0031; just note it and skip that file.

## B. Prepare your PC (one time per apply)

You need: Git, Bun **1.3.12**, your copy of the Neuvetra repository, and your operator export file.

B1. Check Bun: `bun --version` must print `1.3.12`. If it prints anything else, stop and ask the CTO.

B2. Go to the **repository root** (the folder that contains `package.json`, `tools` and `packages`). Every later command must
be run from this folder, because the tools find the database certificate by a path relative to it:

```powershell
cd <your Neuvetra repository folder>
Test-Path tools\cloud\fixtures\supabase-prod-ca-2021.crt
```

The second line must print `True`.

B3. Put the folder at exactly the commit Railway runs (the tools apply the migration files from **this folder**, so it must
be the deployed commit, not your own older or newer copy):

```powershell
git status
git fetch origin
git checkout --detach <full commit code from A2>
git log -1 --format=%H
git merge-base --is-ancestor 687ed3f185c8e00b038e46ef5a24dac593722437 HEAD; $LASTEXITCODE
$m = git log --format=%H --merges --grep='^Merge pull request #61 from ' origin/main | Select-Object -First 1; if ($m) { git merge-base --is-ancestor $m HEAD; $LASTEXITCODE } else { 'PR #61 is not merged on origin/main' }
git branch -r --contains HEAD
```

- `git status` must show no changed files before you start (if it does, stop and ask the CTO).
- `git log` must print the same commit code as A2.
- The first `merge-base` line must print `0` (the deployed commit contains PR #52). `1` means it does not: stop (rule 1).
- The PR #61 line must print `0` (it finds PR #61's merge commit on `origin/main` by its message, then checks that the
  deployed commit contains it). `1`, or `PR #61 is not merged on origin/main`, means it does not: stop. Do not run C1 or C4
  from a folder without PR #61: its plan would strip the Storage guards' grants.
- The last line must list `origin/main`.

Then check the migrations folder:

```powershell
Get-ChildItem packages\neuvetra-database\src\migrations\*.sql | Select-Object -Last 1 -ExpandProperty Name
```

It must print `0031_integrity_guards.sql`. If a later file appears (0032 or above), stop and ask the CTO: this runbook does
not cover it.

B4. Install the exact dependency versions:

```powershell
bun install --frozen-lockfile
git status
```

It should finish without an error. Do not run plain `bun install` (it may change `bun.lock`).

**One known exception.** The install can fail on exactly one package, `webgpu-claude-skill` (a FrontDesk web dependency
downloaded from GitHub that the staging tools do not use). You recognise it like this: the only line starting `error:` names
`webgpu-claude-skill` (for example
`error: failed to download webgpu-claude-skill@github:dgreenheck/webgpu-claude-skill#af2319b: 403 Forbidden`; the reason at
the end may differ), and the last line says `Failed to install 1 package`. In that case, and only then, you may continue.
If any other package is named, or more than one package failed, stop and ask the CTO.
Either way, `git status` must still show no changed files.

B5. Your **operator export file** is a small text file, kept **outside** the repository folder and never committed or
shared, holding exactly one line like this (placeholders shown; use the real values from the Supabase dashboard's
Connect panel, **Session pooler** connection string; *Supabase screen labels: unconfirmed, check on your screen*):

```
DATABASE_URL=postgresql://postgres.<project-ref>:<database-password>@aws-1-us-west-1.pooler.supabase.com:5432/postgres
```

Both tools refuse anything else: the host must be `aws-1-us-west-1.pooler.supabase.com`, the port `5432` (the session
pooler, not 6543), the user `postgres.<project-ref>` and the database `/postgres`. The file must contain exactly one
`DATABASE_URL` line.

**Special characters in the password.** If the database password contains anything other than letters and digits (for example
`@ : / ? # % & +` or a space), it must be **percent-encoded** in that line, or both tools fail (`Existing target plan
unavailable.` / stage `validate`). Encode it on your own PC, in PowerShell, with this one line:

```powershell
$p = Read-Host -AsSecureString 'Database password'; [uri]::EscapeDataString([Net.NetworkCredential]::new('', $p).Password)
```

It asks for the password (what you type or paste is shown as `*` and is not saved in the PowerShell history), and prints the
encoded form. (If you use `Start-Transcript`, stop it first with `Stop-Transcript`; otherwise nothing records the screen.)
Put that printed text in place of `<database-password>` in the export file, then:

- type `Clear-Host` to clear the screen, and close that PowerShell window when you are done;
- clear the clipboard with `Set-Clipboard -Value ' '`;
- if Windows clipboard history is on (press **Win+V**; if it lists entries), delete the password and encoded-password
  entries there too (or choose "Clear all").

Do the same clipboard clean-up (`Set-Clipboard -Value ' '` and Win+V) after you paste the connection string into the export
file, even if the password needed no encoding. Do not put the password anywhere else (no chat, no other file, no website).
A password of only letters and digits needs no encoding; resetting it to such a password in Supabase is an alternative.

B6. Choose a work folder **outside** the repository for the output files, for example `C:\neuvetra-0031`. Each tool refuses
to overwrite a file that already exists: every run needs output names that do not exist yet. If you retry, use a new name
(for example `0031-apply-2.json`).

## C. Apply (recommended path: plan, then apply)

`tools/staging/plan-existing.ts` reads the database without changing it. `tools/staging/apply-existing.ts` then applies only
what is missing (0031) in one transaction, writes the receipt row with the image's own fingerprint in that same transaction,
takes the migration runner's lock, and checks the access-grant containment first. This is the supported path.

C1. Read-only plan. **A plan file made before BF-10 (29 statements) is void: do not reuse it, or its fingerprint.** C4 would
refuse it anyway ("plan drift"). Make a new one, with a new file name if the old one is still in the folder:

```powershell
bun tools/staging/plan-existing.ts <your operator export file> C:\neuvetra-0031\0031-plan.json
```

It must print `{"status":"read_only_plan_saved",...}`. If it prints `Existing target plan unavailable.`, nothing was changed;
the usual causes are: you are not in the repository root (B2), the output file already exists (B6), the export file is not
exactly as in B5 (including an un-encoded special character in the password), or the network/password is wrong.

C2. Check the plan. `"statements"` is **never** empty: it is the access-grant containment that C4 runs, in this order, in
one transaction, before the migration. On today's staging it must contain exactly these and nothing else:

- one `REVOKE CREATE ON DATABASE "postgres" FROM PUBLIC, anon, authenticated;`
- for each of the seven application schemas (`drizzle`, `frontdesk`, `neuvetra`, `neuvetra_research_dev`, `public`, `site`,
  `terrascope`), four lines: `REVOKE ALL ON SCHEMA "<schema>" …`, `REVOKE ALL ON ALL TABLES IN SCHEMA "<schema>" …`,
  `REVOKE ALL ON ALL SEQUENCES IN SCHEMA "<schema>" …` and `REVOKE ALL ON ALL FUNCTIONS IN SCHEMA "<schema>" …`, each ending
  `FROM PUBLIC, anon, authenticated;`
- exactly two `GRANT` lines, **directly after** `REVOKE ALL ON ALL FUNCTIONS IN SCHEMA "neuvetra" …`:
  `GRANT EXECUTE ON FUNCTION neuvetra.collection_storage_can_read(text,text) TO PUBLIC;` then
  `GRANT EXECUTE ON FUNCTION neuvetra.collection_storage_can_upload(text,text) TO PUBLIC;`

That is 31 statements. **Stop and send the file to the CTO** if you see anything else: any other `GRANT`, any statement that
names another role (only `PUBLIC, anon, authenticated` may appear), any column-level revoke (a column name in brackets),
any `ALTER DEFAULT PRIVILEGES` inside `"statements"`, another schema, or a different count.

`"providerAdminStatements"` are **not** run by the tool (C4 only checks that they have not changed since the plan). They are
expected to be exactly three lines, for `FUNCTIONS`, `TABLES` and `SEQUENCES`, each
`ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" REVOKE ALL ON <kind> FROM PUBLIC, anon, authenticated;`.
Anything else there: stop and ask.

Paste these two lines into PowerShell (they only read the file; set `$plan` to your plan file). It prints the count, then any statement that does not match the
expected patterns, then the two lines after the `neuvetra` function revoke, then the provider lines:

```powershell
$plan = 'C:\neuvetra-0031\0031-plan.json'
$p = Get-Content $plan -Raw | ConvertFrom-Json; "statements: $($p.statements.Count)"; $p.statements | Where-Object { $_ -cnotmatch '^REVOKE ALL ON (SCHEMA|ALL TABLES IN SCHEMA|ALL SEQUENCES IN SCHEMA|ALL FUNCTIONS IN SCHEMA) "(drizzle|frontdesk|neuvetra|neuvetra_research_dev|public|site|terrascope)" FROM PUBLIC, anon, authenticated;$' -and $_ -cnotmatch '^REVOKE CREATE ON DATABASE "postgres" FROM PUBLIC, anon, authenticated;$' -and $_ -cnotmatch '^GRANT EXECUTE ON FUNCTION neuvetra\.collection_storage_can_(read|upload)\(text,text\) TO PUBLIC;$' } | ForEach-Object { "UNEXPECTED: $_" }; $i = [array]::IndexOf($p.statements, 'REVOKE ALL ON ALL FUNCTIONS IN SCHEMA "neuvetra" FROM PUBLIC, anon, authenticated;'); "after neuvetra function revoke:"; $p.statements[$i+1]; $p.statements[$i+2]; "provider (not executed): $($p.providerAdminStatements.Count)"; $p.providerAdminStatements
```

It must print `statements: 31`, **no** `UNEXPECTED:` line, the two `GRANT EXECUTE … collection_storage_can_read …` and
`… collection_storage_can_upload …` lines under `after neuvetra function revoke:`, and `provider (not executed): 3` with the
three `supabase_admin` lines. Anything else: stop and send the file to the CTO.

C2b. Before C4, in the Supabase SQL editor, run this **read-only** query (it changes nothing):

```sql
select s.sig, has_function_privilege('anon', s.sig, 'EXECUTE') as anon, has_function_privilege('authenticated', s.sig, 'EXECUTE') as authenticated
from unnest(array['neuvetra.collection_storage_can_read(text,text)', 'neuvetra.collection_storage_can_upload(text,text)']) as s(sig) order by 1;
```

It must show two rows, both with `true` and `true`. If either shows `false`, stop and ask the CTO (Storage is already
broken; do not apply anything).

C3. Get the plan's fingerprint:

```powershell
(Get-FileHash C:\neuvetra-0031\0031-plan.json -Algorithm SHA256).Hash.ToLower()
```

C3b. Immediately before C4, in the Supabase SQL editor, run this **read-only** query (QA's; it changes nothing). It lists
every grant in the seven application schemas, and the database's CREATE, that C4's revokes could remove: anything granted
to PUBLIC, anon or authenticated, including implicit defaults and column grants. The `running_as` column shows who you are
(C4 runs as the same `postgres` role).

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
`neuvetra.collection_storage_can_read(text,text)` and `neuvetra.collection_storage_can_upload(text,text)`, grantee `PUBLIC`,
privilege `EXECUTE`. **Anything else (a third row, a missing guard, another grantee): stop and ask the CTO.**

Then compare `owner` with `running_as` on the two rows. If they are the same (expected), continue. If they differ, you are
not the guards' owner: tell the CTO before C4. *What C4 would then do is reasoned, not tested on staging:* PostgreSQL treats
a REVOKE or GRANT by a role that is neither the owner nor holds a grant option as a no-op with a warning (checked locally on
PostgreSQL 16 with a plain non-owner role), so the guards' grant would be left as it is, and C4's own check runs after the
statements in the same transaction: if any guard were then not executable it stops with `apply_failed` at stage
`containment` and the whole transaction rolls back, changing nothing.

C4. Apply:

```powershell
bun tools/staging/apply-existing.ts <your operator export file> C:\neuvetra-0031\0031-plan.json <fingerprint from C3> C:\neuvetra-0031\0031-apply.json
```

It must print `{"status":"containment_and_migrations_committed",...}`. **From this moment rule 2 applies: never roll Railway
back past commit `687ed3f`.**

C5. Straight after C4, run the C2b query again, and open `/ready`: it must **not** contain `storageGuardGrantsMissing`.
Both query rows must still show `true` and `true`. If either shows `false`, every
Storage upload and download is failing: tell the CTO at once (do not retry C4). The repair is the two `GRANT` lines from C2
run in the SQL editor, but only on the CTO's instruction.

### If C4 prints `apply_failed`

The message shows a `stage` and a `sqlstate`. In every case below the migration itself was not applied (it runs in one
transaction and rolls back on any error), and staging keeps working at schema 30 with the new image.

- **`"sqlstate":"55P03"`** (normally at stage `migration`): 0031 could not get a table lock within 5 seconds because someone
  was saving at that moment. This is safe. Wait a few minutes (a quieter moment) and run C4 again with a **new output name**,
  for example `0031-apply-2.json`. You can reuse the same plan file and fingerprint. (The failed run leaves its output file
  behind with `"stage": "containment_committed"`; keep it, do not reuse its name.)
- **`"sqlstate":"55000"`** at stage `migration`: a function on staging is not 0030's (0031's drift guard stopped it). Do not
  retry. Send the output to the CTO.
- **stage `validate`**: nothing was contacted or changed. Check the fingerprint (C3), that the output name is new (B6), the
  export file (B5, including the password encoding) and that you are in the repository root (B2).
- **Anything else**: do not retry. Send the CTO the printed line, the output file and the time.

## D. Backup (optional for this synthetic data)

`tools/staging/backup-existing.ps1` is **optional** for this migration. Staging holds only synthetic data, 0031 writes no
rows, and recovery is by SQL (section F), so the before/after CSVs (A4 and E2) are a sufficient check. If you want the
backup anyway, run it **before C1**. It needs:

- a Windows `pg_dump.exe` whose major version is at least the staging server's. *Staging's PostgreSQL major version
  (we expect 17, as CI uses): unconfirmed, check on your screen.* Check it first: in the Supabase SQL editor run
  `show server_version;` and compare the number before the first dot with the one printed by
  `& "<path to pg_dump.exe>" --version` (keep the double quotes: the usual path, such as
  `C:\Program Files\PostgreSQL\17\bin\pg_dump.exe`, contains a space). If pg_dump's is lower, get a newer pg_dump or skip the backup.
- the operator export file (B5) and the certificate `tools\cloud\fixtures\supabase-prod-ca-2021.crt`;
- `-RecoveryDirectory` set to **exactly** the recovery folder written on **line 27** of the script, inside
  `GetFullPath('…')` (it refuses any other folder).

```powershell
powershell -ExecutionPolicy Bypass -File tools/staging/backup-existing.ps1 -ExportPath <your operator export file> -PgDumpPath "<path to pg_dump.exe>" -CertificatePath tools/cloud/fixtures/supabase-prod-ca-2021.crt -RecoveryDirectory <the folder on line 27 of the script> -ApplicationOnly
```

`-ExecutionPolicy Bypass` lets Windows run this one unsigned script file (the default Windows policy refuses with "running
scripts is disabled"); it applies only to that single `powershell` command and changes no setting on your PC.

It must print `"status": "encrypted_backup_verified"`. The archive is sealed with Windows DPAPI (only your Windows account
can open it) and a restore from it has never been tested, so treat it as a safety copy, not as the recovery plan.

## E. Verify afterwards

E1. Open `/ready` again (no redeploy or restart needed): it must say `"schemaVersion":31`, and must **not** contain
`storageGuardGrantsMissing`.

E2. Download the same CSVs again, exactly as in A4, into the `after` folder with the same four names. Then compare each pair.
Paste this once into PowerShell (it defines a small helper; nothing is changed):

```powershell
function Compare-Csv($name) {
  $bp = "C:\neuvetra-0031\before\$name"; $ap = "C:\neuvetra-0031\after\$name"
  if (-not (Test-Path -LiteralPath $bp) -or -not (Test-Path -LiteralPath $ap)) { "$name MISSING"; return }
  $b = @(Get-Content -LiteralPath $bp | Where-Object { $_ -notlike '# Generated:*' })
  $a = @(Get-Content -LiteralPath $ap | Where-Object { $_ -notlike '# Generated:*' })
  if (($b -join "`n") -ceq ($a -join "`n")) { "$name SAME" } else { "$name DIFFERENT"; Compare-Object $b $a -CaseSensitive }
}
'cedar-results.csv','cedar-scope3.csv','redwood-results.csv','redwood-scope3.csv' | ForEach-Object { Compare-Csv $_ }
```

Every file must print `SAME` (the only line allowed to differ is `# Generated: …`, which the helper ignores). If one prints
`DIFFERENT`, the lines below it show what changed (`<=` before, `=>` after): do not retry anything and do not roll Railway
back (rule 2); send the CTO both files. A file that is absent from either folder prints `MISSING` (never `SAME`): check
its name and folder. Leave out the name of any Results CSV you skipped in A4 (more than 400 active records); any other
`MISSING` means a download is missing, so fix that before continuing.

E2b. Functional check (Storage and the import path), with a synthetic test account on staging (*screen labels: unconfirmed,
check on your screen*):

- upload one small synthetic evidence file (for example a one-page PDF) to a record of one test company;
- open an evidence file (one that already opened before the apply; a new upload stays "pending" until it is scanned and
  cannot be opened until then, which is expected); it must open, not fail;
- run one small Scope 3 spend import (a CSV of one or two synthetic lines) and check the rows appear.

Any of these failing with an error (for example "permission denied" or a failed upload): do not retry and do not roll Railway
back (rule 2); tell the CTO with the time.

E3. Open `0031-apply.json`: `audit.legacyContainmentVerified` and `audit.storageGuardGrantsVerified` must be `true`, and
`audit.missingStorageGuardGrants` must be `[]`. `migration.schemaVersion` must be `31`, and the last entry of `migration.migrations` must be
`0031_integrity_guards.sql` with sha256 `3513b5da55e41133d94faaf3a8b610e1fb66f415a95393272d3f8b1c49246cd7`.

E4. Tell the CTO the apply time and the `/ready` result. A **separate follow-up PR** then changes
`LIVE_STAGING_SCHEMA: '30'` to `'31'` in `.github/workflows/verify.yml` (job `migration-guard`). That bump is not part of
PR #52. Until it merges, CI does not yet treat 0031 as applied.

If `/ready` shows anything other than 30 or 31, or the site returns errors after the apply, do not retry and do not roll
Railway back (rule 2): send the CTO the apply output and the time, and see section F.

## Checking the function text (used by F and G)

Copying from GitHub may still change line breaks into Windows line endings (CRLF) on the way through the browser clipboard
and the SQL editor; this has not been tested on Windows. The SQL still runs without error, but stores different function
text. So after F or G, run this read-only query in the Supabase SQL editor:

```sql
select proname, md5(prosrc) from pg_proc where pronamespace='neuvetra'::regnamespace and proname in ('collection_assert_activity','save_collection_activity','approve_scope3_report') order by 1;
```

| Function | Expected after G (0031) | Expected after F (0030 restored) |
|---|---|---|
| `approve_scope3_report` | `5381e69b395abef537e02f93127aa726` | `17ff92295a6f163252eed24042c4394d` |
| `collection_assert_activity` | `58164f62f8431d8bbd1013037b20eea3` | `0457ca21aed5a59262777131d91e470b` |
| `save_collection_activity` | `20af0cfd2e915c23e8670b8c0b14b95e` | `3ca3b0a7329de85173b9c2c7142a2a80` |

(These are the same values 0031's own drift guard accepts, lines 26–29 of `0031_integrity_guards.sql`.) Any other value means
the paste changed the text; what to do is written at the end of F and of G.

## F. Recovery if 0031 misbehaves (put 0030's functions back)

Use this only on the CTO's instruction. It restores the three functions exactly as 0030 left them. It keeps all data, the
0031 receipt, the TRUNCATE guards and the access grants; the new image keeps serving (at schema 31); and 0031's drift guard
accepts the restored functions later. No backup restore is needed, because 0031 writes no rows.

F0. *Whether the SQL editor's role owns these functions and may create in schema `neuvetra`: unconfirmed, check on your
screen.* Replacing a function needs both. Run this read-only query in the Supabase SQL editor first:

```sql
select proname, pg_get_userbyid(proowner) as owner, pg_has_role(proowner,'USAGE') as can_replace, has_schema_privilege('neuvetra','CREATE') as can_create from pg_proc where pronamespace='neuvetra'::regnamespace and proname in ('collection_assert_activity','save_collection_activity','approve_scope3_report') order by 1;
```

All three rows must show `can_replace` = `true` **and** `can_create` = `true`. If any value is `false`, stop and ask the CTO.
(If you ran F anyway, the transaction would stop with `permission denied for schema neuvetra` when `can_create` is false, or
with `must be owner of function …` when only `can_replace` is false, and in either case change nothing.)

F1. Copy these three blocks from `packages/neuvetra-database/src/migrations/0030_scope3_completion.sql`, **from GitHub's Raw
view** (open the file on GitHub on the `main` branch and press **Raw**):

| Function | Lines in 0030 | Starts with | Ends with |
|---|---|---|---|
| `collection_assert_activity` | 234–542 | `create or replace function neuvetra.collection_assert_activity(a jsonb)` | `end $$;` |
| `save_collection_activity` | 545–594 | `create or replace function neuvetra.save_collection_activity(target_company uuid,target_record uuid,request jsonb)` | `end $$;` |
| `approve_scope3_report` | 1315–1338 | `create function neuvetra.approve_scope3_report(target_company uuid,request jsonb)` | `end $$;` |

In the third block, change the first words `create function` to `create or replace function` (0030 created it new; here it
must replace 0031's). Change nothing else. Then run it as **one** transaction in the Supabase SQL editor:

```sql
begin;
-- block 1 (0030 lines 234-542)
-- block 2 (0030 lines 545-594)
-- block 3 (0030 lines 1315-1338, with "create or replace function")
commit;
```

If it stops with `must be owner of function …` or `permission denied for schema neuvetra`, nothing was changed: stop and
ask the CTO.

F2. Run the function-text query above. All three values must match the **"after F"** column.

- **All match:** done. `/ready` still says 31. The 400-record cap and the superseded-approval check stay enforced by the
  server's own checks, as they were at schema 30. Tell the CTO; do not touch the `LIVE_STAGING_SCHEMA` value.
- **Any differs:** the paste changed the text. F is safe to repeat (it only replaces the three functions): copy the blocks
  again from the Raw view and run F1 again, then check again. If it still differs, stop and ask the CTO (until it is fixed,
  re-applying 0031 would stop at its drift guard with 55000).

## G. Fallback only: the Supabase SQL editor

Use this only if the CTO tells you the tools in section C cannot be used. It skips the tools' safety checks (target check,
containment check, runner lock), so three mistakes are easy to make and each one breaks staging. Rules 1 and 2 apply in full,
and the check F0 applies too (0031 replaces the same three functions; without ownership or CREATE on the schema it
stops with `must be owner of function …` or `permission denied for schema neuvetra` and changes nothing).

G1. **Wrap everything in one transaction.** Paste `begin;`, then the whole of `0031_integrity_guards.sql`, then the receipt
line, then `commit;`, and run it as one query. Without `begin; … commit;` the file's `set local lock_timeout` is ignored and a
failure can leave 0031 half applied.

G2. **The receipt line must be exactly this**, character for character (a mistyped fingerprint makes the new image refuse the
database: staging answers 503 until it is corrected):

```sql
insert into neuvetra.schema_migrations(name,sha256) values('0031_integrity_guards.sql','3513b5da55e41133d94faaf3a8b610e1fb66f415a95393272d3f8b1c49246cd7');
```

G3. **Copy the file from GitHub's Raw view**, not from a file opened on Windows.

G4. Run the function-text query above. All three values must match the **"after G (0031)"** column.

- **All match:** verify exactly as in section E.
- **Any differs:** the paste changed the text. Staging keeps working (the image checks the receipt, not the function text),
  but the next migration's drift guard would stop with 55000. **Do not run G again**: a second run stops (at 0031's drift guard,
  or on the receipt that is already there) and changes nothing. Send the CTO the query result and the time; the CTO decides the repair.

## When you are finished

B3 left your repository folder on a detached commit. Put it back on the main branch (from the repository root):

```powershell
git checkout main
```
