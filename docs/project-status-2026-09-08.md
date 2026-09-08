# Neuvetra project assessment — September 8, 2026

Neuvetra has a substantial FrontDesk MVP, an early conversational brand website, and an unfinished Terrascope application backed by useful domain knowledge and a Python calculation reference. The immediate work is to stabilize access controls and the April repository consolidation, then finish one complete customer journey at a time.

## Repository and scope

- Repository: https://github.com/neuvetra-hq/neuvetra
- Downloaded into `C:\Users\nimab\OneDrive\Documents\ChatGPT\Neuvetra`.
- Reviewed `main` at `80ce387`, the latest downloaded commit, dated April 28, 2026. It adds Site's sign-in button and two-step phone OTP modal.
- The remote clone contains six commits and only the `main` branch. The initial commit consolidated earlier projects; this repository does not contain their complete earlier development history.
- All 745 tracked files were downloaded. Dependencies and review tools were installed locally. No application code, database, deployed service, or GitHub content was changed by this assessment.
- Findings combine source inspection, existing plans and memory, and the checks below. Production hosting, account settings, live databases, carrier approval, payment processing and real telephone calls were not verified. No real credentials were present in this fresh checkout; only example environment files were committed.

## What the project is

There are two subscription products and one shared brand surface, represented by six applications: a web frontend and an API for each.

| Area | Purpose | Current code maturity |
| --- | --- | --- |
| FrontDesk | AI telephone receptionist for small businesses: answer calls, book appointments, capture callbacks, manage subscriptions | Most developed; substantial MVP with integration and security gaps |
| Site | Neuvetra's main website, animated Spirit brand identity, conversational product discovery and sign-in | Streaming chat and OTP implemented; persistence and specialist handoff unfinished |
| Terrascope | Greenhouse-gas inventory and reporting assistant | Frontend is a coming-soon page; API routes exist but essential packages are throwing placeholders |

Shared technologies are TypeScript, Bun, Turborepo, React, Vite, Tailwind, Elysia, Supabase/Postgres and Drizzle. FrontDesk integrates Twilio, Retell, Stripe and calendar providers. Site uses Anthropic through the AI SDK, XState, Three.js and Langfuse.

Three distinct knowledge stores are intentional: `claude-memory` is internal strategic history, `neuvetra-kb` is public product/sales content, and `ghg-kb` is Terrascope's domain content. The public Site currently injects a generated three-page corpus into its prompt; vector retrieval is future work.

## Checks performed

| Check | Result | Meaning and limitation |
| --- | --- | --- |
| Frozen Bun dependency installation | Passed; 1,717 packages | Used project-local Bun 1.3.12, matching the API Dockerfiles; dependency scripts disabled |
| Root typecheck | Passed; six app tasks | Terrascope stubs satisfy types using `any`; this does not establish runtime functionality |
| Root build | Passed; all three web apps | Includes frontend project-reference compilation; APIs have no build task; credentials and runtime connections were not exercised |
| Root lint | Passed with 53 warnings | 52 FrontDesk warnings and one Site warning; only web apps expose lint tasks |
| Root test command | Zero tasks executed | No workspace declares the `test` script that Turbo expects; a successful exit is not test coverage |
| Site API tests, invoked directly | 42 passed | Mocked handler, streaming, optional authentication, origin and rate-limit behavior |
| Site web tests, invoked directly | 13 passed | State transitions and simplified OTP logic; no real browser sign-in or SMS validation |
| Full Python calculation suite | Failed during collection | Unfinished mobile-combustion specifications contain `expected.value: TBD`, which the harness converts to a number |
| Separate Python factor, inventory and unit tests | 21 passed | Working foundations; this excludes the failing methodology harness |
| FrontDesk browser/integration tests | Not run | 24 Playwright spec files exist; some mock services and others require a configured API, phone number and calendar |

Builds reported large JavaScript bundles for FrontDesk and Site. These are optimization opportunities after functional stabilization.

## FrontDesk findings

Implemented code covers OTP sign-in, onboarding, subscription activation, phone-number provisioning, Retell calls, a business knowledge base, Google/Outlook/CalDAV scheduling, callbacks, call logs, dashboard settings and appointment SMS.

The first work should address these concrete gaps:

1. **Enforce authenticated business ownership.** The business route group has no authentication or membership guard, including calls, knowledge editing and number purchase/release. Several billing routes also trust submitted identifiers. No global authentication wrapper protects these groups. Evidence: `apps/frontdesk-api/src/routes/businesses.ts:8`, `apps/frontdesk-api/src/routes/billing.ts:29`, and `apps/frontdesk-api/src/index.ts:11`. Verify Twilio/Retell callback signatures as part of the same boundary work (`apps/frontdesk-api/src/routes/webhooks.ts:179`). These are source findings; the live deployment was not probed.
2. **Finish the schema migration throughout the application.** Migration 0007 moves business tables to the `frontdesk` schema, while the browser client still defaults to `public` and business lookups use unqualified table names. That combination should fail against the migrated database unless external compatibility changes exist. Shared `users` must remain in `public`. Evidence: `packages/frontdesk-database/migrations/0007_neuvetra_namespace_reorg.sql:38`, `apps/frontdesk-web/src/lib/supabase.ts:10`, and `apps/frontdesk-web/src/contexts/AuthContext.tsx:58`.
3. **Complete billing reliability.** Call completion stores duration but does not invoke the metered-usage endpoint. No Stripe subscription/payment lifecycle webhook implementation was found. Activation spans external services and database writes without a durable recovery/idempotency flow. Evidence: `apps/frontdesk-api/src/routes/billing.ts` and `apps/frontdesk-api/src/routes/webhooks.ts:672`.
4. **Complete appointment-alert consent.** April notes record Campaign 2 rejection and an agreed separate, optional appointment-alert opt-in. The schema and notification service still lack those fields and gating. Existing authentication consent belongs to a separate path. Current Twilio approval state is unknown. Evidence: `claude-memory/topics/frontdesk-sms-architecture.md` and `apps/frontdesk-api/src/services/notify.ts`.
5. **Connect onboarding choices to call behavior.** Activation stores name/personality/voice choices, but runtime uses a different name field and a common agent with a fixed configured voice. Calendar OAuth state also needs binding to the initiating authenticated user rather than only encoding a business identifier.

Migration reproducibility also needs repair: the database command paths reference the old `apps/api` location, and the migration journal omits 0007 even though that SQL file says it was applied separately to production.

## Site findings

The current code is ahead of its older status notes. Spirit, streaming responses, movement/color tools, conversational OTP, a standalone sign-in modal, session storage and optional validated user identity are already implemented.

- **Local chat wiring is inconsistent.** Site web runs on 5174, Site API on 3001, the browser transport hardcodes 3000, and the API's local origin allowlist contains 5173. Repair these together. Evidence: `apps/site-web/vite.config.ts`, `apps/site-web/src/lib/api.ts:49`, `apps/site-api/src/index.ts:31`, and `apps/site-api/src/config/allowed-origins.ts:7`.
- **Knowledge corpus regeneration uses an obsolete parent path.** It climbs four directories from the script and resolves outside the repository. The checked-in corpus survives, but refresh does not target this checkout's KB. Evidence: `apps/site-api/scripts/sync-kb-corpus.ts:38`.
- **Deployment needs consolidation updates.** Railway configuration references the former `apps/web/Dockerfile`; the Site Dockerfile exposes only the API URL while the frontend now needs Supabase build-time configuration. Missing values cause the browser client to initialize with empty strings. Actual Railway overrides were not inspected. Evidence: `apps/site-web/railway.toml`, `apps/site-web/Dockerfile`, and `apps/site-web/src/lib/supabase.ts`.
- **Conversation persistence and specialist handoff are unfinished.** Chat lives in browser actor memory; the server conversation machine is a greeter skeleton. Attachment and dictation buttons lack behavior, and several product/plan destinations suggested by the agent do not yet exist.
- **Public content needs alignment with shipped features.** Only three published pages populate the current corpus. Some product claims extend beyond what the implementation delivers.

Anonymous chat is intentional. Optional JWT validation supplies identity, not an access or spending gate. Origin headers alone do not stop scripted abuse. Verify trusted proxy behavior and actual production spending controls; unchecked items in `apps/site-api/HARDENING.md` are not proof of live account settings.

## Terrascope findings

The main application is blocked by explicit throwing placeholders in `packages/terrascope-database/src/index.ts` and `packages/terrascope-calculator/src/index.ts`. The API's company, factors, calculation and report routes depend on them. Its frontend contains only a coming-soon message.

Useful work survives:

- Python calculations for stationary combustion, refrigerants, location-based electricity, market-based electricity and inventory aggregation, with factors, units and provenance.
- 120 substantive knowledge pages, including 44 source summaries, plus four navigation pages.
- Five processed emission-factor CSVs containing 2,138 rows.
- Detailed product requirements and implementation plans under `docs/terrascope`.

Recover or rebuild the TypeScript packages from trustworthy earlier copies, the Python reference, and verified database structure. The current monorepo history begins with the consolidated snapshot and does not supply a working pre-loss implementation. Resolve whether Python or TypeScript is the canonical calculator before maintaining two engines.

The full Python suite is currently blocked by unfinished mobile-combustion test specifications and a missing implementation module. Repair these without inventing expected numerical values. Company/report authentication, input validation, report export, inventory UI and a complete onboarding/subscription journey also remain.

Database notes disagree about seeded factor counts and the shared schema. Verify live structure and data before any migration/reload. Original source PDFs/spreadsheets under `ghg-kb/raw` were intentionally excluded from Git and were not downloaded. Several data processing scripts still use former absolute paths. Reproducible refresh requires source recovery and path repair.

Regulatory-source currency and filing suitability were not assessed in this software review.

## Suggested finish order

1. **Establish a dependable development baseline:** local environment setup, corrected ports and paths, migration alignment, real test scripts and automated build/test checks. The committed GitHub workflows currently provide Claude review/interaction, not a conventional deterministic verification pipeline.
2. **Stabilize FrontDesk first:** authenticated tenant access, signed callbacks, schema queries, billing lifecycle/usage, and appointment-alert opt-in. Define completion as a verified test-account journey from sign-up through activation, a call, booking, notification and accurate billing.
3. **Finish Site's customer journey:** reliable sign-in/chat, correct product destinations, persisted conversations with ownership rules, then specialist handoff and richer published content.
4. **Restore Terrascope foundations before expanding its UI:** working database and canonical calculator, green methodology tests, verified factor data, authenticated company access, then one complete inventory-to-downloadable-report journey. Broader Scope 3 support and retrieval can follow.

If the business priority is the fastest path to a usable paid product, FrontDesk is the strongest starting point. Terrascope requires substantially more foundational work.

## Historical records used

`README.md`, root and per-app `CLAUDE.md`, `claude-memory/index.md`, `claude-memory/overview.md`, `claude-memory/next.md`, `claude-memory/log.md`, the three product notes, `apps/site-api/HARDENING.md`, and `apps/terrascope-api/STATUS.md` provided context. Their latest entries generally date to April 28. Where they conflict with the downloaded source or executed checks, this assessment reports the source/check result and treats old operational assertions as unverified history.

This assessment is a proposed coding baseline, not a claim that any product is currently working in production. No completion percentages or delivery dates are assigned before the integrations and missing components are scoped.
