# Browser smoke suite (site-web end to end)

A few journeys through the signed-in workspace in a real Chrome, against the real staging server and a real PostgreSQL database. It exists because the bugs below were found only by hand, in a browser, after the unit suites passed: a false ✓ on the Overview, a record that did not open at its own address, input lost on navigation, a cross-user address leak, an outage that closed the workspace, write controls shown to a view-only member, page overflow on Results, and stale claims on the landing page.

CI runs it as the job **Browser smoke (site-web end to end)** in `.github/workflows/verify.yml`, on every pull request and push to `main`. When a journey fails, the job uploads a screenshot of each open page and a Playwright trace (artifact `browser-smoke-failures`). Open a trace with `bunx playwright-core show-trace <file>.zip`.

## What runs

- `harness/database.ts` drops and recreates the database `neuvetra_e2e`, adds the parts of Supabase the migrations expect (the `auth` and `storage` schemas and roles, as `packages/neuvetra-database/src/hosted.test.ts` does), and migrates it with the repository's own `migratePrivateStaging` to the current staging schema.
- `harness/stack.ts` starts `createStagingServer` from `apps/site-api` on a loopback port. It serves the built staging bundle (`apps/site-web/dist-staging`) and uses the restricted `neuvetra_runtime` role. It injects only three things, all through `StagingOverrides`, the seam the server tests use:
  - the database connection (loopback, no TLS);
  - the token validator, which reads the suite's `TokenDirectory`;
  - an in-memory evidence store.
- `harness/browser.ts` drives Chrome with `playwright-core`. CI downloads (from the official Chrome for Testing bucket, cached by version) the Chrome for Testing build that playwright-core 1.59.1 is made for (147.0.7727.15) and refuses any other (`E2E_CHROME_VERSION`); locally, any installed Chrome is used. Each journey gets a new browser context. In that context the Supabase Auth API (`https://<ref>.supabase.co/auth/v1/...`) is answered by a stub at the network level, so nothing hosted is contacted. A password sign-in returns a session whose token the server's injected validator accepts. To end a session, a test revokes its token, and the server then answers 401.
- `browser-smoke.test.ts` holds the journeys. Each one asserts that the page raised no uncaught error.

## Run it locally

You need a PostgreSQL 16 or 17 server that **only this suite uses**. Migration 0009 creates the cluster-wide role `neuvetra_runtime`, so the harness drops that role and recreates it with the database. Before it drops anything, the harness asks the server itself and refuses unless:

- the server's own address (`inet_server_addr()`) is loopback or a Unix socket. A loopback URL alone is not enough, because it can be a tunnel or a port forward to another machine. A Docker container reached through `-p` port mapping is refused for the same reason, so run it on the host network;
- the server holds no database except `postgres`, `template0`, `template1` and `neuvetra_e2e`.

You also need Chrome or Chromium, and `python` on the PATH (the Results engines use only the standard library).

```bash
# A throwaway PostgreSQL in Docker on the host's loopback (Linux), as CI runs it:
docker run --rm -d --name neuvetra-e2e --network host -e POSTGRES_USER=e2e_admin -e POSTGRES_DB=postgres -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17 -c listen_addresses=127.0.0.1 -c port=55480
# Elsewhere, a native throwaway server: initdb -D /some/empty/dir -U e2e_admin --auth=trust; pg_ctl -D /some/empty/dir -o "-p 55480 -c listen_addresses=127.0.0.1" start

cd apps/site-web
bun run build:staging          # the bundle under test; rebuild after changing src
E2E_DATABASE_URL=postgres://e2e_admin@127.0.0.1:55480/neuvetra_e2e bun run test:e2e
```

Optional environment variables:

- `CHROME_PATH`: the Chrome or Chromium executable. Without it, the usual Linux and macOS locations are tried.
- `E2E_WEB_ROOT`: test another build, for example another branch's `dist-staging`.
- `NEUVETRA_PYTHON`: the Python the engines run with.
- `E2E_CHROME_VERSION`: refuse any Chrome whose version is not exactly this one.
- `E2E_VERBOSE`: print the server's requests per minute, all users together. The server allows 300 a minute per user. Since WO-04b (each Overview visit also asks for Scope 3 results once), the suite peaks at about 280–310 a minute in total; the readiness keyboard journey runs as `admin` so that `owner` stays well inside its own limit. A journey that opens many views should do the same.

Without `E2E_DATABASE_URL` the suite is skipped locally. When `CI` is set, a missing `E2E_DATABASE_URL` is an error. The CI job also fails when fewer journeys pass than `E2E_EXPECTED_PASS` in `verify.yml`, so raise that number with every journey you add. The harness refuses any URL that is not on loopback or whose database is not named `neuvetra_e2e`.

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
6. Find form fields with `getByLabel(...)`, not by label markup. WO-10 (PR #46) moves fields from a wrapping `<label>` to `<label for>`, and `getByLabel` works with both.
7. Raise `E2E_EXPECTED_PASS` in `verify.yml`.
8. Run the suite five times in a row before you push. A journey that fails even once gets fixed or removed, never retried.

## What the suite covers, and what it does not

The server's token validator is injected (`StagingOverrides.validateUser`), so the suite says nothing about how a real token is validated.

It covers, through the real server and database:

- the browser's whole signed-in workspace on the built bundle;
- bearer-token extraction and the origin check;
- the staging-access roster check (`hasStagingAccess`) and the per-route role checks;
- tenant isolation as the restricted `neuvetra_runtime` role, through row-level security;
- the rate limiters;
- real asset verification and serving;
- the Python engines behind Results;
- how the browser handles 401 (session ended), 503 (transient) and the session check;
- readiness (WO-04b): the Overview, the side navigation, the Menu sheet, Ask and the Results Scope 3 to-do agree, Scope 3 results are requested once per visit, and each kind of next-step action opens its view with focus on the page heading.
- members (WO-12): Activity, the spend import, the record view, Results and Scope 3 assessments offer a view-only member reading controls only;
- readiness follow-ups (WO-04c, the last journey): a Scope 3 possible duplicate reads the same on the Overview ("to confirm (counted)") and in the Results to-do, Ask's Try again after a failed Scope 3 check makes exactly one request, a spend import (two writes) shows "Checking…" at once and rechecks Scope 3 once, and no Overview action button wraps past two lines at 390 px. It adds a business-travel record repeating `T-1` and a two-line spend import to company 1, so it runs last.

It does **not** cover:

- the local token pre-check (`isPlausibleUnexpiredJwt`, PR #38). `createStagingServer` turns it off whenever a validator is injected;
- real Supabase `/auth/v1/user` validation, including its failure path. When Auth is unavailable, the server treats it as transient (`throwWhenUnavailable`), behind a 5-second bounded fetch;
- Supabase Storage. The in-memory evidence store ignores the token and the bucket, so storage access rules and object authorization are not exercised;
- `HostedWorkspaceDatabase.create`: its Supabase host, TLS, CA and project-ref checks. The harness constructs the adapter directly on the loopback connection, through a cast that also hides constructor signature changes from `tsc`;
- the email-link (PKCE) exchange and token refresh. Sessions in the stub last a day and are never refreshed.

Those are covered, where they are covered at all, by the site-api and database unit and native suites and by the staging image smoke.

## Member checks (WO-12)

A view-only member is checked by real state, with no tolerance list: every control the page shows a member, enabled or disabled, by accessible name, must be a reading control. `MEMBER_READING_CONTROLS` lists them: navigation, filters and search, reload, a record's earlier versions, downloading a cleared original, the spend review's tabs, "Show lines"/"Hide lines" and "Open" a line, and the WO-08 shell's ≡ Menu, Close menu, Details, the sheet's navigation items and Ask, and Sign out. Results adds its own reading controls (filters, search, downloads and print, "Show all", "View …", "Close the assessment", "Recalculate").

- The Activity journey checks the list (no new-record form), each spend review tab with a group's lines shown, the record view (no "Correct this record") and the shell at 1360 px and 390 px.
- The Results journey (1360 px and 390 px) opens a Scope 3 assessment with "View the assessment" and checks it is text (no field, no button), and that no "Add" or "Edit the assessment" is offered. It then checks company setup's assessments.

A control's name is its `aria-label`, otherwise its label's field name (`.setup-field__name`, without the "Required" / "Needed for results" / "Optional" label after it), otherwise its text. Company setup's own form is still shown to a member as a disabled form (outside WO-12); the suite does not check it.

The record-view journeys (WO-06) were written while PR #39 was open and ran only when the bundle contained the record view. PR #39 merged before this suite did, so they now run unconditionally. A regression that removes the record view fails them; it does not skip them.
