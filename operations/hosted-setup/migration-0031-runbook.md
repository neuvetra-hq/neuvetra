# Owner runbook: applying migration 0031 to staging

Migration: `packages/neuvetra-database/src/migrations/0031_integrity_guards.sql` (PR #52, BF-09).
File fingerprint (sha256): `3513b5da55e41133d94faaf3a8b610e1fb66f415a95393272d3f8b1c49246cd7` (63,029 bytes).

Written for the owner on a Windows PC. Every command below is typed in **PowerShell**. Do this in a quiet period, when nobody is
using staging. The whole job takes about 15 minutes; the database change itself takes under a second.

---

## The three rules (read these first)

**1. Order: the new image first, then 0031.**
This PR's image must be the **active** staging deployment in Railway **before** you apply 0031. The old image cannot run on
schema 31: if 0031 goes in while the old image is active, staging answers 503 to everything until the new image deploys.
`/ready` showing `"schemaVersion":30` does **not** tell you which image is running (the old and the new image both report
30 before 0031). Check the commit in Railway, as in step A2.

**2. After 0031 is applied, never go back to an older image.**
Once step C4 has succeeded, do **not** use Railway's Rollback, do **not** press Redeploy on any deployment older than this
PR's merge, and do **not** merge a revert of this PR. An image built before this PR answers 503 on every request (or refuses
to start, "Private staging dependencies are unavailable") against schema 31, so any of those takes staging down.

**3. If 0031 misbehaves, recover by SQL, not by a backup.**
0031 only replaces three database functions and adds TRUNCATE guards; it writes no data rows (apart from its own receipt).
Recovery is to put 0030's three function definitions back, in one transaction (section F). No backup restore is needed.

---

## A. Checks before you start

A1. In GitHub, open PR #52. It must say **merged**. At the bottom it shows "merged commit `xxxxxxx` into main": note that short
commit code. On the main branch's commit list, that commit's checks must all be green.

A2. In Railway, open the staging project, then the staging service, then the **Deployments** tab. The deployment marked
**Active** must be this PR's merge commit: its commit message reads
`Merge pull request #52 from neuvetra-hq/claude/bf-09-migration-0031` and its short commit code matches A1. A later main
commit is also fine, because it contains this PR. If the active deployment is older than the merge commit, or the newest
deployment is still building or failed, **stop and wait** (or ask the CTO). Do not continue on `/ready` alone.
Write down the full commit code of the active deployment (click it to open it in GitHub, and copy the 40-character code from
the address bar or the commit page). You need it in B3.

A3. Open the staging site's `/ready` address (the one you check after every deploy). It must say `"status":"ready"` and
`"schemaVersion":30`. If it says anything else, stop.

A4. Sign in to staging. For the two test companies (Synthetic Cedar and Synthetic Redwood), download the **Results CSV** and
the **Scope 3 Results CSV**. Keep these four files in a folder as your "before" files.

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
```

`git status` must show no changed files before you start (if it does, stop and ask the CTO). The last line must print the
same commit code as A2. Then check the migrations folder:

```powershell
Get-ChildItem packages\neuvetra-database\src\migrations\*.sql | Select-Object -Last 1 -ExpandProperty Name
```

It must print `0031_integrity_guards.sql`. If a later file appears (0032 or above), stop and ask the CTO: this runbook does
not cover it.

B4. Install the exact dependency versions:

```powershell
bun install --frozen-lockfile
```

It must finish without an error. Do not run plain `bun install` (it may change `bun.lock`).

B5. Your **operator export file** is a small text file, kept **outside** the repository folder and never committed or
shared, holding exactly one line like this (placeholders shown; use the real values from the Supabase dashboard's
Connect panel, **Session pooler** connection string):

```
DATABASE_URL=postgresql://postgres.<project-ref>:<database-password>@aws-1-us-west-1.pooler.supabase.com:5432/postgres
```

Both tools refuse anything else: the host must be `aws-1-us-west-1.pooler.supabase.com`, the port `5432` (the session
pooler, not 6543), the user `postgres.<project-ref>` and the database `/postgres`. The file must contain exactly one
`DATABASE_URL` line.

B6. Choose a work folder **outside** the repository for the output files, for example `C:\neuvetra-0031`. Each tool refuses
to overwrite a file that already exists: every run needs output names that do not exist yet. If you retry, use a new name
(for example `0031-apply-2.json`).

## C. Apply (recommended path: plan, then apply)

`tools/staging/plan-existing.ts` reads the database without changing it. `tools/staging/apply-existing.ts` then applies only
what is missing (0031) in one transaction, writes the receipt row with the image's own fingerprint in that same transaction,
takes the migration runner's lock, and checks the access-grant containment first. This is the supported path.

C1. Read-only plan:

```powershell
bun tools/staging/plan-existing.ts <your operator export file> C:\neuvetra-0031\0031-plan.json
```

It must print `{"status":"read_only_plan_saved",...}`. If it prints `Existing target plan unavailable.`, nothing was changed;
the usual causes are: you are not in the repository root (B2), the output file already exists (B6), the export file is not
exactly as in B5, or the network/password is wrong.

C2. Open `0031-plan.json` in Notepad. Both `"statements"` and `"providerAdminStatements"` must be empty lists `[]`. If either is
not empty, **stop and send the file to the CTO** (the tool would change access grants before migrating).

C3. Get the plan's fingerprint:

```powershell
(Get-FileHash C:\neuvetra-0031\0031-plan.json -Algorithm SHA256).Hash.ToLower()
```

C4. Apply:

```powershell
bun tools/staging/apply-existing.ts <your operator export file> C:\neuvetra-0031\0031-plan.json <fingerprint from C3> C:\neuvetra-0031\0031-apply.json
```

It must print `{"status":"containment_and_migrations_committed",...}`. **From this moment rule 2 applies: never roll Railway
back past this PR.**

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
  export file (B5) and that you are in the repository root (B2).
- **Anything else**: do not retry. Send the CTO the printed line, the output file and the time.

## D. Backup (optional for this synthetic data)

`tools/staging/backup-existing.ps1` is **optional** for this migration. Staging holds only synthetic data, 0031 writes no
rows, and recovery is by SQL (section F), so the before/after CSVs (A4 and E2) are a sufficient check. If you want the
backup anyway, run it **before C1**. It needs:

- a Windows `pg_dump.exe` at least as new as the staging server (PostgreSQL 17);
- the operator export file (B5) and the certificate `tools\cloud\fixtures\supabase-prod-ca-2021.crt`;
- `-RecoveryDirectory` set to **exactly** the recovery folder written on line 26 of the script (it refuses any other folder).

```powershell
powershell -File tools/staging/backup-existing.ps1 -ExportPath <your operator export file> -PgDumpPath <path to pg_dump.exe> -CertificatePath tools/cloud/fixtures/supabase-prod-ca-2021.crt -RecoveryDirectory <the folder on line 26 of the script> -ApplicationOnly
```

It must print `"status": "encrypted_backup_verified"`. The archive is sealed with Windows DPAPI (only your Windows account
can open it) and a restore from it has never been tested, so treat it as a safety copy, not as the recovery plan.

## E. Verify afterwards

E1. Open `/ready` again (no redeploy or restart needed): it must say `"schemaVersion":31`.

E2. Download the same four CSVs again. They must be identical to the "before" files apart from the generated date/time line.

E3. Open `0031-apply.json`: `migration.schemaVersion` must be `31`, and the last entry of `migration.migrations` must be
`0031_integrity_guards.sql` with sha256 `3513b5da55e41133d94faaf3a8b610e1fb66f415a95393272d3f8b1c49246cd7`.

E4. Tell the CTO the apply time and the `/ready` result. A **separate follow-up PR** then changes
`LIVE_STAGING_SCHEMA: '30'` to `'31'` in `.github/workflows/verify.yml` (job `migration-guard`). That bump is not part of
PR #52. Until it merges, CI does not yet treat 0031 as applied.

If `/ready` shows anything other than 30 or 31, or the site returns errors after the apply, do not retry and do not roll
Railway back (rule 2): send the CTO the apply output and the time, and see section F.

## F. Recovery if 0031 misbehaves (put 0030's functions back)

Use this only on the CTO's instruction. It restores the three functions exactly as 0030 left them. It keeps all data, the
0031 receipt, the TRUNCATE guards and the access grants; the new image keeps serving (at schema 31); and 0031's drift guard
accepts the restored functions later. No backup restore is needed, because 0031 writes no rows.

Copy these three blocks from `packages/neuvetra-database/src/migrations/0030_scope3_completion.sql`, **from GitHub's Raw view**
(open the file on GitHub on the `main` branch and press **Raw**; this avoids Windows line endings, see G3):

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

Afterwards `/ready` still says 31. The 400-record cap and the superseded-approval check stay enforced by the server's own
checks, as they were at schema 30. Tell the CTO; do not touch the `LIVE_STAGING_SCHEMA` value.

## G. Fallback only: the Supabase SQL editor

Use this only if the CTO tells you the tools in section C cannot be used. It skips the tools' safety checks (target check,
containment check, runner lock), so three mistakes are easy to make and each one breaks staging:

G1. **Wrap everything in one transaction.** Paste `begin;`, then the whole of `0031_integrity_guards.sql`, then the receipt
line, then `commit;`, and run it as one query. Without `begin; … commit;` the file's `set local lock_timeout` is ignored and a
failure can leave 0031 half applied.

G2. **The receipt line must be exactly this**, character for character (a mistyped fingerprint makes the new image refuse the
database: staging answers 503 until it is corrected):

```sql
insert into neuvetra.schema_migrations(name,sha256) values('0031_integrity_guards.sql','3513b5da55e41133d94faaf3a8b610e1fb66f415a95393272d3f8b1c49246cd7');
```

G3. **Copy the file from GitHub's Raw view**, not from a file opened on Windows. A copy with Windows line endings (CRLF) runs
without error but stores different function text, and a later re-run or the next migration's drift guard then stops with
55000.

Then verify exactly as in section E. Rules 1 and 2 apply in full.
