# Foundation cleanup — September 8, 2026

This pass establishes a consistent local development and deployment setup while preserving existing product workflows. It also makes a modest visual improvement to Site. Hosting settings, databases, paid integrations and production content were not changed.

## Completed

- Standardized Bun 1.3.12 across the root manifest, verification workflow and four configured Dockerfiles. Updated the lockfile for shared lint dependencies and pinned static serving.
- Added separate product development/build commands; default development previews the company website without starting every API.
- Centralized TypeScript/frontend lint defaults. FrontDesk retains its existing warning severities; this cleanup does not hide them.
- Connected real unit tests to the root command. Frontend typechecking now compiles referenced projects; database/calculator packages also participate.
- Added a GitHub verification workflow and root `check` command. Turbo build inputs include shared configuration, local environment files and public Vite variables. Integration tests are not cached.
- Repaired Docker/Railway paths and public build variables. Build-context exclusions keep credentials, local tools and internal knowledge out of images.
- Documented historical hosting, current public observations, build/start contracts and unresolved dashboard items in `deployment.md`.
- Fixed Site's local API route/port/origin wiring and public KB path/export gate. Generated corpus and knowledge pages remain unchanged.
- Allowed homepage preview without Supabase configuration; unavailable sign-in/chat is explicit. No fake credentials or simulated replies are used.
- Consolidated duplicate FrontDesk account loaders/types and separated `public` identity from `frontdesk` business queries, with offline transport regression tests.
- Removed unnecessary Spirit type suppressions and unused bindings without changing rendering behavior.
- Polished Site spacing, typography, focus states and responsive cards/chat. Verified at 1280×720 and 390×844. Preserved Spirit and brand; marked Terrascope in development and disabled unsupported attachment/dictation controls.
- Corrected Site's scene actor lifecycle under React StrictMode and extracted OTP verification into a focused helper.

## Verification and limits

The final frozen dependency install and full root `check` passed: nine TypeScript tasks, 65 offline tests (45 Site API, 15 Site web, 5 FrontDesk account-data), and all three frontend production builds. Lint reports zero errors and 44 remaining FrontDesk warnings; Site and Terrascope lint are clean. Large frontend bundle warnings remain.

The pinned static server successfully served the built Site homepage, a nested SPA fallback route, and a JavaScript asset with the expected content types. Browser checks at 1280×720 and 390×844 found no horizontal overflow or console warnings/errors. The new GitHub workflow has not yet run remotely.

Browser checks use the local Site frontend without credentials. They establish rendering/layout, not real OTP delivery or paid chat. FrontDesk integration tests still need development credentials and an external test account.

Docker is unavailable on this machine. Copy paths, workspace selection and commands have been inspected, but actual container builds/Railway deploys remain unverified. Confirm dashboard assignments and use the documented root context before publishing; the former isolated app context will not work with these files.

## Next work

1. Verify hosting dashboard state and resolve FrontDesk's observed `www` 404/API health failure. Confirm source repository, branch, deployed commit, custom domains and environment values before deployment.
2. Stabilize FrontDesk: tenant access, signed callbacks/OAuth state, database exposure/policies, billing lifecycle/usage, and appointment-alert opt-in. Schema-query cleanup does not replace these controls.
3. Finish Site persistence, product navigation/handoff and UI/auth integration tests. Public knowledge still needs reconciliation with product readiness.
4. Restore Terrascope's calculator/database and unfinished methodology tests. The full Python suite still fails on `TBD` values; no numerical expectations or factor claims were invented in this cleanup.
5. Continue incremental legacy lint/bundle cleanup after behavior is covered. Review Railway's replacement infrastructure configuration before its documented legacy-config deadline.

A usable development baseline is narrower than all products and production services being ready.
