# Deployment map and configuration

Reviewed 2026-09-08. This document separates April project history, the signed-in Railway dashboard inspection, public health checks, and deployment configuration in this checkout. No Railway, DNS, Supabase, or other production settings were changed during this cleanup.

## Verified Railway dashboard state

Both products still deploy from their old repositories. The consolidated `neuvetra-hq/neuvetra` repository has not replaced those sources. Auto-deployment is enabled on the connected branches. All four application services show Online in Railway; that is not equivalent to passing public health checks.

| Service | Current source / branch | Active source commit | Current root / Dockerfile | Domain target |
|---|---|---|---|---|
| Neuvetra / `web` | `neuvetra-hq/front-desk`, `master` | `3c0138be98ce36bea9dae4250371f7815ec03c10` | `/`, `/apps/web/Dockerfile` | `neuvetra.com`, port 8080 |
| Neuvetra / `api` | `neuvetra-hq/front-desk`, `master` | `17d3a51d3a27326001711f40efb2c51ba883b5e7` | Root unset (repository root), `/apps/api/Dockerfile` | `api.neuvetra.com`, port 3000 |
| Neuvetra-AI / `Site-Web` | `neuvetra-hq/site`, `main` | `de2a8c819da9a5f2e4d63833df6979fd04a404b4` | `/apps/web`, `apps/web/Dockerfile` | `www.neuvetra.ai`, port 8080 |
| Neuvetra-AI / `Site-API` | `neuvetra-hq/site`, `main` | `de2a8c819da9a5f2e4d63833df6979fd04a404b4` | `/apps/api`, `/apps/api/Dockerfile` in active deployment | `api.neuvetra.ai`, port 3000 |

FrontDesk project ID: `0c2ef37e-9cce-4cae-9b0d-5a2eacf6b509`; production environment `44bc92d3-7977-422c-b268-6197eab33245`; web service `0c46c999-6093-4623-a537-fddbeba671e3`; API service `37af7430-f9b6-4d03-a95b-38cb14aff25a`. [Dashboard](https://railway.com/project/0c2ef37e-9cce-4cae-9b0d-5a2eacf6b509).

Site project ID: `119f3652-9d84-4d16-983c-1a17c0fd1aaa`; production environment `6642d65a-15a2-41e9-b25e-b7b01990aa28`; web service `f43abcf9-72f0-4034-828a-8d83ca26b0db`; API service `95487338-d03b-4d80-a07a-ab0a76482aea`. [Dashboard](https://railway.com/project/119f3652-9d84-4d16-983c-1a17c0fd1aaa).

Site-API currently uses `/apps/api/railway.toml`; the other three inspected settings panels show no explicit config-file path. Both APIs start with `bun run src/index.ts`. FrontDesk web retains a custom build command `bun run --filter=web build`; its latest attempted source deployment failed while the earlier commit above remains active. All inspected active deployments use one replica in US East (Virginia).

The FrontDesk services confirm Railway as the origin host behind Cloudflare. The web service lists `neuvetra.com` but no `www.neuvetra.com` custom domain, consistent with the public `www` 404. This does not establish DNS ownership or authorize traffic changes. The Site project also has the six Langfuse infrastructure services recorded below, all shown online; no Terrascope service appears. A third workspace project has no services. Staging, backups, database policies and actual integration credentials remain unverified.

## Railway environment export

The user-provided `env.json.txt` is stored outside this repository. Read-only inspection found 31 populated FrontDesk API variables, including database/Supabase, Twilio/Retell, Google/Microsoft OAuth and Stripe configuration. The Stripe secret-key prefix identifies test mode, and `PORT` matches the configured 3000 target. `STRIPE_WEBHOOK_SECRET` is absent from this export; that alone does not establish the complete live service environment. This file contains no Site Anthropic, Langfuse or Pinecone keys. Credential validity and external accounts were not tested. Secret values are deliberately omitted from these notes and from Git/Docker build contexts.

## Recorded hosting topology

| Surface | Recorded host/project | Recorded service | Public address | Evidence and remaining uncertainty |
|---|---|---|---|---|
| FrontDesk web | Railway project `Neuvetra` | `web` in the Langfuse notes; exact current name/ID unverified | `neuvetra.com` / `www.neuvetra.com` | [Langfuse infrastructure notes](../claude-memory/tech/langfuse.md#status) describe the project and services. [Company overview](../claude-memory/overview.md#the-two-products--the-parent-surface) also records a `www` CNAME to Vercel on April 27. Verify which host actually serves FrontDesk before changing its deployment. |
| FrontDesk API | Railway project `Neuvetra` | `api`; API instructions also mention `front-desk-api`, so verify the current service name/ID | `api.neuvetra.com` pattern recorded in the [Site DNS history](../claude-memory/meetings/2026-04-27-site-deploy-and-dns.md#3-dns-swap-to-neuvetraai) | The original `front-desk` repository deployed from `master`, according to the [consolidation record](../claude-memory/meetings/2026-04-28-monorepo-restructure.md#thread-2--branch-cleanup-on-frontdesk). Current source and branch are unverified. |
| Site web | Railway project `Neuvetra-AI` | `site-web` | `https://www.neuvetra.ai` | [Deployment record](../claude-memory/meetings/2026-04-27-site-deploy-and-dns.md#outcome): deployed April 27 from the old `neuvetra-hq/site` repository, branch `main`. |
| Site API | Railway project `Neuvetra-AI` | `site-api` | `https://api.neuvetra.ai` | Same [deployment record](../claude-memory/meetings/2026-04-27-site-deploy-and-dns.md#outcome); consumer of Anthropic, Supabase Auth, and Langfuse. |
| Langfuse | Railway project `Neuvetra-AI` | `langfuse-web`, `langfuse-worker`, ClickHouse, Redis, MinIO, and Postgres | Historical UI: `https://langfuse-web-production-ea08.up.railway.app` | [Infrastructure notes](../claude-memory/tech/langfuse.md#where-it-lives). This checkout does not define or manage those services. |
| Terrascope | No deployment recorded | None | No assigned production domain recorded | The [product notes](../claude-memory/products/terrascope.md) describe the intended product; its [database](../packages/terrascope-database/README.md) and [calculator](../packages/terrascope-calculator/README.md) are currently stubs. Do not treat the placeholder frontend or `/health` route as a working product. |

Both domains were registered and DNS-hosted with Squarespace. The April Site deployment used `www` and `api` CNAMEs plus Railway ownership TXT records; `neuvetra.ai` apex forwarded to `https://www.neuvetra.ai`. The same record reports an apex HTTPS certificate problem at that time. These are historical observations, not proof of the present DNS or certificate configuration. [Source](../claude-memory/meetings/2026-04-27-site-deploy-and-dns.md#3-dns-swap-to-neuvetraai).

The April 28 consolidation explicitly left Railway repointing as pending work. Its old per-app Root Directory advice predates the configuration below, which needs the shared root lockfile and workspace packages. [Source](../claude-memory/meetings/2026-04-28-monorepo-restructure.md#action-items).

## Public observations on 2026-09-08

These unauthenticated DNS/HTTP checks were made during the cleanup; they do not establish the connected repository, deployed revision, or dashboard configuration.

| Address | Observed result |
|---|---|
| `www.neuvetra.ai` | DNS CNAME `17g2vxun.up.railway.app`; HTTPS `200`, `server: railway-hikari`. |
| `api.neuvetra.ai/health` | DNS CNAME `berikyi7.up.railway.app`; HTTPS `200`, body `{"status":"ok"}`, `server: railway-hikari`. |
| `https://neuvetra.ai` | Successfully redirects to `https://www.neuvetra.ai`. The historical apex certificate problem was not reproduced. |
| `https://neuvetra.com` | HTTPS `200`, title “Front Desk by Neuvetra — AI Receptionist for Small Business”, `server: cloudflare`. The edge header does not identify the origin host. |
| `https://www.neuvetra.com` | HTTPS `404`, `server: cloudflare`, JSON “Application not found”. The apex works while this hostname needs investigation. |
| `https://api.neuvetra.com/health` | First request timed out after 15 seconds; a second returned HTTP `502`, `server: cloudflare`. The API did not pass its public healthcheck during this review. Verify the service and upstream routing in the hosting dashboard. |

## Shared services and data ownership

The intended identity/database target is the historical FrontDesk Supabase project, renamed to Neuvetra. Shared identity lives in `auth.users` and `public.users`; product tables belong in `frontdesk`, `site`, or `terrascope`. The [Supabase notes](../claude-memory/tech/supabase.md#project-rename--schema-reorg-in-flight-as-of-2026-04-28) describe the migration plan; the [FrontDesk schema](../packages/frontdesk-database/src/schema.ts) describes this checkout. Neither establishes which migrations have been applied to production.

Terrascope's older separate Supabase project is `jfjbiqeplnbxkadqnimt`. Its factor inventory and operational notes disagree about whether the 2,138 factors were loaded. Resolve the actual data location, backups, schema, and row counts before data migration or deployment. [Factor inventory](../ghg-kb/factors/index.md), [Terrascope operational notes](../apps/terrascope-api/STATUS.md).

FrontDesk also uses Twilio, Retell, Stripe, and Google/Microsoft/CalDAV calendar integrations. Site uses Anthropic and the existing Langfuse deployment. These are external accounts, not additional apps to run from this monorepo. Keep the existing webhook URLs, OAuth callbacks, public-key/secret-key separation, and shared-auth project alignment when preparing a deployment. Runtime variable names are recorded in the per-app `.env.example` files; actual values stay outside Git.

## Build contract for this monorepo

The repository configuration builds all four services from the **repository root**. Their Dockerfiles use Bun **1.3.12**, the root `bun.lock`, and frozen installs. Each install selects the required workspaces; all 11 workspace manifests are copied so Bun can validate the lockfile consistently. Frontend builds require their own source and shared tooling, without API/database source copies. Shared TypeScript configuration under `config/` is available to builds and API runtimes.

| App | Railway Root Directory | Railway config-file path | Dockerfile path | Runtime directory | Port / healthcheck |
|---|---|---|---|---|---|
| FrontDesk API | `/` | `/apps/frontdesk-api/railway.toml` | `apps/frontdesk-api/Dockerfile` | `/app/apps/frontdesk-api` | `3000` / `/health` |
| FrontDesk web | `/` | `/apps/frontdesk-web/railway.toml` | `apps/frontdesk-web/Dockerfile` | `/app/apps/frontdesk-web` | `8080` / `/` |
| Site API | `/` | `/apps/site-api/railway.toml` | `apps/site-api/Dockerfile` | `/app/apps/site-api` | `3000` / `/health` |
| Site web | `/` | `/apps/site-web/railway.toml` | `apps/site-web/Dockerfile` | `/app/apps/site-web` | `8080` / `/` |

Railway's Root Directory and config-file path are service settings: these TOML files cannot establish the correct service/repository assignment. Use `neuvetra-hq/neuvetra` and the intended branch after confirming each existing service. Clear any stale custom Dockerfile variable or dashboard build/start override that points at the old `apps/api` or `apps/web` paths. The per-app TOML files select the Dockerfile builder, appropriate startup command, healthcheck, and watch paths. No deployment command runs database migrations, provisions phone numbers, or updates Retell agents.

Railway documents root-directory isolation and shared monorepos in its [monorepo guide](https://docs.railway.com/deployments/monorepo). Its [Dockerfile guide](https://docs.railway.com/builds/dockerfiles) explains custom Dockerfile paths and `ARG` declarations for build variables.

**Railway compatibility follow-up:** official documentation checked September 8 says legacy `railway.toml` / `railway.json` Config as Code support ends for existing services on **2026-12-01**. These files repair the repository's existing legacy configuration. Verify service eligibility and migrate the confirmed projects to Railway Infrastructure as Code before that date; this cleanup does not invent service IDs or apply infrastructure changes. [Railway Config as Code reference](https://docs.railway.com/config-as-code/reference).

API containers set `NODE_ENV=production` and a default `PORT=3000`; Railway may override `PORT`, and its domain target must match. Web containers serve the prebuilt SPA with the workspace's pinned `serve` package under Bun, including the existing fallback to `index.html` for browser routes. They explicitly listen on `0.0.0.0:8080`; set the service/domain target port to `8080`. The [root `.dockerignore`](../.dockerignore) excludes credentials, local dependencies, generated output, internal memory, and knowledge-store source folders. Site's checked-in generated public KB corpus remains included with its API source.

## Public frontend values required at build time

Vite embeds these public values in JavaScript. Set them on the corresponding Railway web service before building; changing only a running container's environment does not update an existing bundle. Never use a Supabase service-role key or a Stripe secret key in a `VITE_` variable.

| Web app | Build arguments |
|---|---|
| FrontDesk | `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`, `VITE_STRIPE_PUBLISHABLE_KEY`, `VITE_STRIPE_PRICE_STARTER_FLAT`, `VITE_STRIPE_PRICE_GROWTH_FLAT`, `VITE_STRIPE_PRICE_PRO_FLAT` |
| Site | `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |

FrontDesk's public Supabase key variable and Site's anon-key variable use different names because that is the current application contract. They should identify the same shared Supabase project. Site's recorded production API value is `https://api.neuvetra.ai`; confirm FrontDesk's actual API host before supplying its value. See [FrontDesk environment example](../apps/frontdesk-web/.env.example) and [Site environment example](../apps/site-web/.env.example).

## Local image verification

Run Docker builds with `.` as the context from the monorepo root. API builds need no production credentials:

```sh
docker build -f apps/frontdesk-api/Dockerfile -t neuvetra/frontdesk-api:local .
docker build -f apps/site-api/Dockerfile -t neuvetra/site-api:local .
```

For each web Dockerfile, supply the arguments listed above with `--build-arg NAME=value`. Use development/test public values for a local check. Test the resulting web image at `/` and a nested browser route, and confirm assets are served. API runtime smoke checks need the appropriate development credentials even though image builds do not. An HTTP healthcheck confirms process readiness only; it does not verify billing, telephony, authentication, or calculations.

Docker was unavailable during this cleanup. Actual container builds remain unverified. All three frontend application builds passed, and the pinned static-server command served the built Site homepage, a nested SPA fallback route and a JavaScript asset successfully. These checks and source-path inspection provide narrower evidence than running the images.

## Dashboard items still to resolve

1. Reconfirm the recorded dashboard assignments immediately before a cutover. Establish staging, a rollback plan and backups; current staging availability is unknown. Do not deploy unfinished GHG functionality merely by repointing the services.
2. Confirm DNS ownership and fix FrontDesk's missing `www` domain and API public health failure if maintaining those services. Railway origin hosting is now verified; the earlier Vercel note is historical.
3. Verify shared Supabase project identity, migration state, policies, auth redirects, and backups. Reconcile Terrascope's separate database and factor counts.
4. Verify public frontend build variables and server-only credentials in the correct services. Preserve existing Stripe/Twilio/Retell webhook and calendar OAuth callback assignments.
5. Confirm Site's generated KB is current, Langfuse ingestion works, and the operator tasks in [HARDENING.md](../apps/site-api/HARDENING.md) are complete before a public launch.
6. Decide and validate Railway's replacement IaC configuration against the confirmed existing services before the legacy configuration deadline.

Terrascope has no Dockerfile or Railway configuration here because its database/calculator restoration, input/auth validation, working UI, and data verification must precede deployment.
