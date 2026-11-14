# Owner runbook: database connections after BF-19 (bulk-write gate, pool size, readiness)

For the owner. No code, no command line: two dashboards (Railway and Supabase) and one browser tab. About 15 minutes.
Screen labels marked *unconfirmed* are from documentation, not checked on your screen; if a label differs, look for
the nearest match and note it for the CTO.

## What BF-19 changes (PR "BF-19: bulk writes must not starve other companies")

- **One large write at a time per server.** A spend import, a currency conversion, a spend mapping save and "withdraw this
  import" each hold a database connection for seconds. While one runs, a second one on the same server is refused at
  once (nothing is read or saved) and the person sees: *"Another large import or conversion is running. Try again in a
  moment."* Trying again a little later works normally. Everything else (reading, single saves, Results) is unchanged.
- **The number of database connections per server becomes a setting**: `NEUVETRA_STAGING_DB_POOL_SIZE`, a whole number
  from 1 to 8. Without it the server uses 4, as today. Any other value (0, 9, `4.0`, empty) stops the server from starting.
- **Health check (`/ready`) gets its own extra connection** (1 per server), so it never waits behind large writes.
- **The health check now proves two safety settings reach the database**: `lock_timeout` 5 s and `statement_timeout`
  15 s. Every time budget in the app assumes them. If they do not arrive (possible with Supabase's *transaction*
  pooler, port 6543), the server **refuses to start** and says why (step 5). On Railway that means the deploy fails and
  **the previous version keeps running**; nothing breaks, but later deploys are blocked until it is sorted out.

Because of that last point, **do step 1 before the CEO merges BF-19**, and tell the CEO the answer.

## Step 1 (before merge): which database address does the app use?

1. Railway → project → the staging service (Site-Web) → **Variables** → `DATABASE_URL`. Reveal it on screen only; do not
   copy it anywhere.
2. Read only the part after the `@`, up to `/postgres`. Write down which of these it is (never the password):

| What you see after `@` | Meaning | What to do |
|---|---|---|
| `aws-…pooler.supabase.com:5432` | Session pooler | Fine. Continue with step 2. |
| `db.<project-ref>.supabase.co:5432` (or no port) | Direct connection | Fine for the settings. Continue; in step 3 use the database's own connection limit. |
| `aws-…pooler.supabase.com:6543` | **Transaction pooler** | **Stop. Tell the CTO before BF-19 is merged.** The settings check will probably fail and the new version will not start. |

## Step 2: Supabase pool size

Supabase dashboard → the staging project → **Database** → **Settings** → **Connection pooling** (*unconfirmed labels*).
Write down:
- **Pool size** (call it **P**): how many database connections the pooler itself may open.
- **Max client connections**: how many app connections the pooler accepts (normally much larger than P).
- The **pooler mode** shown there (session or transaction), to match step 1.

If you use the direct connection (step 1, second row), write down the compute size's connection limit instead and tell
the CTO; Supabase's own services share that limit, so the CTO picks the number with you.

## Step 3: Railway replicas

Railway → staging service → **Settings** → **Deploy** → **Replicas** (*unconfirmed label*). Write down the number
(call it **R**; usually 1).

## Step 4: the arithmetic, then the setting

Each server (replica) uses `NEUVETRA_STAGING_DB_POOL_SIZE` connections for requests **plus 1** for the health check.
Keep **2** spare for the operator tools and migrations. The rule:

> **R × (pool size + 1) + 2 must not be more than P.**

So the largest allowed pool size is **(P − 2) ÷ R − 1**, rounded down, and never more than 8.

| P (Supabase pool size) | R = 1 | R = 2 |
|---|---|---|
| 15 | 8 (1 × 9 + 2 = 11) | 5 (2 × 6 + 2 = 14) |
| 10 | 7 (1 × 8 + 2 = 10) | 3 (2 × 4 + 2 = 10) |
| 7 | 4 (1 × 5 + 2 = 7) | 1 (2 × 2 + 2 = 6) |
| less than 7 | tell the CTO | tell the CTO |

Then: Railway → staging service → **Variables** → **New variable**: name `NEUVETRA_STAGING_DB_POOL_SIZE`, value the
number (just the digit, for example `8`). Railway redeploys. Write down the number you set and P and R, and send them to
the CTO.

Note: each replica has its own one-at-a-time gate, so with R = 2 two large writes can run at once (one per server).
Include that when you report R.

## Step 5: check it worked

1. Wait for the deploy to show **Active** (a few minutes).
2. Open `https://<staging address>/ready` in a browser. Expected (one line):
   `{"status":"ready","profile":"neuvetra.private-synthetic-staging.v1","schemaVersion":31,"legacyContainmentVerified":true}`
   (the schema number is whatever staging is at). Nothing else needs checking here.
3. If the deploy **failed**, open the deploy's logs and look for a line starting `{"event":"staging_start_failed"`:
   - `{"event":"staging_start_failed","reason":"database_session_settings_not_applied"}`: the safety settings did not
     reach the database (step 1's transaction pooler, or a pooler setting). **Stop and tell the CTO**, with what step 1
     and step 2 showed. Do not change `DATABASE_URL` or any Supabase setting on your own. The previous version is still
     serving users.
   - `{"event":"staging_start_failed"}` with no reason, right after you set the variable: the value is not a digit from
     1 to 8. Fix it (or delete the variable) and Railway redeploys.
4. A running server whose `/ready` page shows `{"status":"unavailable","reason":"database_session_settings_not_applied"}`
   means the same as the first case: tell the CTO.

## Undo

Delete the variable `NEUVETRA_STAGING_DB_POOL_SIZE` in Railway. The server goes back to 4 connections (plus 1 for the
health check). The one-at-a-time gate and the settings check stay; they are part of the code.

## What you never need to do

No migration, no SQL, no change to `DATABASE_URL`, no change to Supabase settings. If any of those seems necessary, that
is the CTO's decision.
