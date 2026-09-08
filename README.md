# Neuvetra

Neuvetra is becoming a California and U.S. greenhouse-gas research and accounting application. The repository retains the earlier Site, FrontDesk and Terrascope workspaces for traceability. FrontDesk is deferred; TerraScope is no longer a customer-facing brand. Start with the [current delivery plan](docs/roadmap-neuvetra-ghg.md) and [research assessment](docs/research/neuvetra-assessment.md).

The current homepage is a research preview: an overview of the planned workflow and a searchable, filterable library of four primary references from GHG Protocol, EPA, and CARB. It does not mount chat, authentication, billing, or emissions calculations. Source-backed Q&A and deterministic accounting remain in development.

The preserved foundation is tagged on GitHub as `checkpoint/pre-ghg-focus-2026-09-08` (`367497e`). Current work is on `work/neuvetra-ghg`. The Railway dashboard assessment is complete; production still deploys from the older repositories, and this preview has not been cut over. See the [verified deployment map](docs/deployment.md).

## Product workspaces

| Area | Code | Local web / API | Purpose |
| --- | --- | --- | --- |
| Neuvetra preview (Site) | `apps/site-*` | `5174` / `3001` | GHG overview, source browser, and optional decorative Spirit; retained API is not used by the preview |
| FrontDesk (deferred) | `apps/frontdesk-*`, `packages/frontdesk-*` | `5173` / `3000` | Preserved receptionist, dashboard, calls, appointments, and billing work |
| Legacy GHG implementation | `apps/terrascope-*`, `packages/terrascope-*` | `5175` / `3002` | Historical folder names retained; database/calculator stubs are not a working accounting service |

## Knowledge stores

- **`claude-memory/`** — Claude's persistent memory across sessions. Strategic decisions, plans, brand, products. Internal only.
- **`neuvetra-kb/`** — Historical public salesperson RAG. Its multi-product content is retained and is not loaded by the research preview.
- **`ghg-kb/`** — Inherited GHG regulations, methodologies, and factor data. Treat claims and extracted values as unverified until checked against primary sources.

## Stack

Bun 1.3.12 + Turborepo + Elysia + Vite + React 19 + React Router v7 + Tailwind v4 + Drizzle + Supabase. Each API has its own port. Shared TypeScript and ESLint defaults live in `config/`.

## Start locally

Install Bun **1.3.12**, then run from this directory:

```sh
bun install --frozen-lockfile
bun run dev
```

`dev` previews only the Site frontend at `http://localhost:5174`. The overview and source browser work without credentials or an API. They do not invoke the retained chat, sign-in, or calculation code.

For explicit work on the retained web/API pairs, copy the relevant app `.env.example` files to `.env` in the same directories and populate development credentials. This is not needed for the research preview:

```sh
bun run dev:site        # Preview + retained Site API; API needs its integrations
bun run dev:frontdesk   # FrontDesk web + API; requires configured integrations
bun run dev:terrascope  # Explicit opt-in; application remains blocked by stubs
```

`bun run dev:all` starts every app and requires all their environments. Use `dev` for the preview and the explicit pair commands for integration work. Retained API clients use local APIs in development; their production `VITE_*` values must be supplied at build time. Never put server secrets in browser variables or Git.

## Verify changes

```sh
bun run check          # Typecheck, lint, unit tests, then all web builds
bun run test           # Offline Site tests + FrontDesk account-data tests
bun run build:site
bun run build:frontdesk
bun run build:terrascope
```

Typechecking includes the six applications and three database/calculator packages. Frontend checks compile their project references. FrontDesk's remaining legacy lint warnings are explicit in its own config. Unit tests run on every invocation. `.github/workflows/verify.yml` runs these application checks for pull requests and pushes to `main`.

Integration checks are separate:

- `bun run test:e2e:frontdesk` runs Playwright. Its browser and appropriate local services are required; some scenarios also require a test phone number/calendar.
- `bun run test:ghg` runs the Python reference-engine suite. Install `pytest`, `pint` and `pyyaml` in your Python environment first. The full suite currently fails on unfinished mobile-combustion values (`TBD`); those are not silently skipped.

Passing application checks does not verify production, subscriptions, telephone calls, message delivery, GHG answer quality, or the legacy GHG application's missing runtime packages.

## More

- [Architecture and product boundaries](docs/architecture.md)
- [Deployment map, public checks, and Railway setup](docs/deployment.md)
- [Cleanup record and remaining work](docs/foundation-cleanup.md)
- [Initial assessment before cleanup](docs/project-status-2026-09-08.md)
- [Project conventions](CLAUDE.md) and [strategic memory](claude-memory/)

The repository's configuration for four Railway services builds from the **repository root**, with separate app Dockerfiles and configuration paths. The verified dashboard assignments still point at the old repositories; applying the monorepo configuration and deploying this preview remain future cutover work described in the [deployment guide](docs/deployment.md). The legacy GHG application has no deployment configuration because its runtime is incomplete. Original GHG source PDFs/spreadsheets are intentionally excluded from Git.
