# Browser smoke suite (site-web end to end)

A few journeys through the signed-in workspace in a real Chrome, against the real staging server and a real PostgreSQL database. It exists because the bugs below were found only by hand, in a browser, after the unit suites passed: a false ✓ on the Overview, a record that did not open at its own address, input lost on navigation, a cross-user address leak, an outage that closed the workspace, write controls shown to a view-only member, page overflow on Results, and stale claims on the landing page.

CI runs it as the job **Browser smoke (site-web end to end)** in `.github/workflows/verify.yml`, on every pull request and push to `main`. When a journey fails, the job uploads a screenshot of each open page and a Playwright trace (artifact `browser-smoke-failures`). Open a trace with `bunx playwright-core show-trace <file>.zip`.

## What runs

- `harness/database.ts` drops and recreates the database `neuvetra_e2e`, adds the parts of Supabase the migrations expect (the `auth` and `storage` schemas and roles, as `packages/neuvetra-database/src/hosted.test.ts` does), and migrates it with the repository's own `migratePrivateStaging` to the current staging schema.
- `harness/stack.ts` starts `createStagingServer` from `apps/site-api` on a loopback port. It serves the built staging bundle (`apps/site-web/dist-staging`) and uses the restricted `neuvetra_runtime` role. It injects only three things, all through `StagingOverrides`, the seam the server tests use:
  - the database connection (loopback, no TLS);
  - the token validator, which reads the suite's `TokenDirectory`;
  - an in-memory evidence store.
- `harness/browser.ts` drives the installed Chrome with `playwright-core` (no browser download). Each journey gets a new browser context. In that context the Supabase Auth API (`https://<ref>.supabase.co/auth/v1/...`) is answered by a stub at the network level, so nothing hosted is contacted. A password sign-in returns a session whose token the server's injected validator accepts. To end a session, a test revokes its token, and the server then answers 401.
- `browser-smoke.test.ts` holds the journeys. Each one asserts that the page raised no uncaught error.

## Run it locally

You need a PostgreSQL 16 or 17 server that **only this suite uses**. Migration 0009 creates the cluster-wide role `neuvetra_runtime`, so the harness drops that role and recreates it with the database. You also need Chrome or Chromium, and `python` on the PATH (the Results engines use only the standard library).

```bash
# A throwaway PostgreSQL in Docker (any port):
docker run --rm -d --name neuvetra-e2e -e POSTGRES_USER=e2e_admin -e POSTGRES_HOST_AUTH_METHOD=trust -p 55480:5432 postgres:17

cd apps/site-web
bun run build:staging          # the bundle under test; rebuild after changing src
E2E_DATABASE_URL=postgres://e2e_admin@127.0.0.1:55480/neuvetra_e2e bun run test:e2e
```

Optional environment variables:

- `CHROME_PATH`: the Chrome or Chromium executable. Without it, the usual Linux and macOS locations are tried.
- `E2E_WEB_ROOT`: test another build, for example another branch's `dist-staging`.
- `NEUVETRA_PYTHON`: the Python the engines run with.

Without `E2E_DATABASE_URL` the suite is skipped. The harness refuses any database that is not on loopback or is not named `neuvetra_e2e`.

## The seed (`harness/seed.ts`)

Every ID is fixed, so a test can name a record. Every run starts from the same data, because the database is recreated.

- **Users** (`USERS`): in company 1, `owner`, `admin` and `member` (view only); in company 2, `otherOwner`. Users and rosters are written as an operator would, with `auth.users` and `provisionStagingRoster`.
- **Company 1** (`COMPANIES.first`):
  - setup with a January to November 2025 reporting period, and Scope 3 categories 1, 4, 5, 6 and 7 screened in;
  - Scope 1 and 2 records:
    - ready: `GAS-1` and `M-1`;
    - needs input: `GAS-2`, with no quantity;
    - held: `GAS-DEC`, which falls in December 2025, outside the reporting period;
  - Scope 3 records: `W-1` (waste), `T-1` (business travel), `C-1` (employee commuting) and `S-1` (spend);
  - one spend import of six lines (`SPEND_IMPORT_CSV`): five coded and one with no category.
- **Company 2** (`COMPANIES.second`): setup without Scope 3, and one record, `OTHER-GAS`.

Setup, records and the import go through the HTTP API as the owner, so they pass the same validation a browser save does. To add data, add it in `seed()` with a new fixed ID in `RECORDS`. Keep it small: every record makes each screen slower to load.

## Add a journey

1. Use `journey(name, options, body)` in `browser-smoke.test.ts`. `options.signedInAs` starts the page already signed in, with the session placed in localStorage before the app loads. Without it, the page starts signed out.
2. Wait for state, never for time. Use `headingIs`, `activityListLoaded`, `locator.waitFor()` or `page.waitForFunction`. A fixed `waitForTimeout` is allowed only to show that nothing more happens, as with "exactly one prompt".
3. Check what the server stored through `stack.api(...)` or `stack.operator`, not only what the screen shows.
4. The `Journey` object records the dialogs the page opened (`dialogs`; they are declined unless `answerDialogs` is set), the workspace API writes it sent (`writes`), and every address the tab showed (`addressesSeen`).
5. Journeys share one seeded database and run in file order. A journey that changes data changes a record that no other journey reads for that value.
6. Run the suite five times in a row before you push. A journey that fails even once gets fixed or removed, never retried.

## Tolerated check: member write controls (WO-12, still open)

On `main`, a member still sees the new-record form fields, the file pickers and the spend mapping's "Map" button enabled. The server refuses those writes. The member journey requires that no save, import, withdraw or correct button is enabled. It tolerates only those known WO-12 controls. When WO-12 lands, delete the `tolerated` rule so the check becomes "no write control at all".

The record-view journeys (WO-06) were written while PR #39 was open and ran only when the bundle contained the record view. PR #39 merged before this suite did, so they now run unconditionally. A regression that removes the record view fails them; it does not skip them.
