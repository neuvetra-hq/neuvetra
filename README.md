# Neuvetra

Two products and one company website in a Bun + Turborepo workspace. Product code stays separate; the development tools, lockfile and identity model are shared.

## Product workspaces

| Area | Code | Local web / API | Purpose |
| --- | --- | --- | --- |
| Site | `apps/site-*` | `5174` / `3001` | Company website, Spirit, product discovery, chat and sign-in |
| FrontDesk | `apps/frontdesk-*`, `packages/frontdesk-*` | `5173` / `3000` | AI receptionist, business dashboard, calls, appointments and billing |
| Terrascope | `apps/terrascope-*`, `packages/terrascope-*` | `5175` / `3002` | GHG reporting; calculator/database restoration still required |

## Knowledge stores

- **`claude-memory/`** — Claude's persistent memory across sessions. Strategic decisions, plans, brand, products. Internal only.
- **`neuvetra-kb/`** — Public salesperson RAG. Brand, product, plan, use-case, comparison, objection, FAQ, story pages.
- **`ghg-kb/`** — Terrascope domain RAG. Regulations, methodologies, factor data.

## Stack

Bun 1.3.12 + Turborepo + Elysia + Vite + React 19 + React Router v7 + Tailwind v4 + Drizzle + Supabase. Each API has its own port. Shared TypeScript and ESLint defaults live in `config/`.

## Start locally

Install Bun **1.3.12**, then run from this directory:

```sh
bun install --frozen-lockfile
bun run dev
```

`dev` previews only the Site frontend at `http://localhost:5174`. The homepage renders without credentials; sign-in is unavailable until Supabase is configured, and chat requires the Site API. It does not start the unfinished Terrascope API.

For a complete product workspace, copy its app `.env.example` files to `.env` in the same directories and populate development credentials:

```sh
bun run dev:site        # Site web + API; requires Anthropic, Supabase and Langfuse
bun run dev:frontdesk   # FrontDesk web + API; requires configured integrations
bun run dev:terrascope  # Explicit opt-in; application remains blocked by stubs
```

`bun run dev:all` starts every app and requires all their environments. Use the product commands for ordinary work. Local browser requests use local APIs; production `VITE_*` values must be supplied at build time. Never put server secrets in browser variables or Git.

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

Passing application checks does not verify production, subscriptions, telephone calls, message delivery or Terrascope's missing runtime packages.

## More

- [Architecture and product boundaries](docs/architecture.md)
- [Deployment map, public checks, and Railway setup](docs/deployment.md)
- [Cleanup record and remaining work](docs/foundation-cleanup.md)
- [Initial assessment before cleanup](docs/project-status-2026-09-08.md)
- [Project conventions](CLAUDE.md) and [strategic memory](claude-memory/)

The repository's configuration for four Railway services now builds from the **repository root**, with separate app Dockerfiles and configuration paths. Verify hosting dashboard assignments before publishing. Terrascope has no deployment configuration because its runtime is incomplete. Original GHG source PDFs/spreadsheets are intentionally excluded from Git.
