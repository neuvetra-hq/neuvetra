# Neuvetra

Neuvetra is becoming a California and U.S. greenhouse-gas research and accounting application. The repository retains the earlier Site, FrontDesk and Terrascope workspaces for traceability. FrontDesk is deferred; TerraScope is no longer a customer-facing brand. Start with the [current delivery plan](docs/roadmap-neuvetra-ghg.md) and [research assessment](docs/research/neuvetra-assessment.md).

The current homepage includes an overview, a searchable library of four primary publisher references, and **Ask Neuvetra**. Its opt-in private Scope 2 experiment retrieves reviewed EPA paragraphs, drafts an answer for each requested part, and checks support and completeness before display. Source integrity and reference checks are deterministic; model judgments remain fallible. Broader Q&A, authentication, billing and emissions calculations remain outside this preview. Start with the [current experiment and limits](docs/milestones/m2-passage-retrieval.md) and its [independent QA results](docs/research/scope2-passages-qa.md). The earlier fixed-statement pilot and failed evaluation history are preserved.

**The dynamic-answer release is held.** Software checks passed, but the latest live run produced only two independently clean complete answers out of eight. Local answering is stopped while the [next reliability work](docs/research/scope2-answer-reliability-next.md) is defined; this branch does not establish a working professional answer service.

The preserved foundation is tagged on GitHub as `checkpoint/pre-ghg-focus-2026-09-08` (`367497e`). The foundation PR was merged into `main` at `0100b96`; the answer pilot is developed on `work/scope2-answer-demo`. Production still deploys from the older repositories, and this preview has not been cut over. See the [verified deployment map](docs/deployment.md).

## Product workspaces

| Area | Code | Local web / API | Purpose |
| --- | --- | --- | --- |
| Neuvetra preview (Site) | `apps/site-*` | `5174` / research `3012` | GHG overview, source browser, and isolated private answer pilot; historical API `3001` remains separate |
| FrontDesk (deferred) | `apps/frontdesk-*`, `packages/frontdesk-*` | `5173` / `3000` | Preserved receptionist, dashboard, calls, appointments, and billing work |
| Legacy GHG implementation | `apps/terrascope-*`, `packages/terrascope-*` | `5175` / `3002` | Historical folder names retained; database/calculator stubs are not a working accounting service |

## Knowledge stores

- **`claude-memory/`** — Claude's persistent memory across sessions. Strategic decisions, plans, brand, products. Internal only.
- **`neuvetra-kb/`** — Historical public salesperson RAG. Its multi-product content is retained and is not loaded by the research preview.
- **`ghg-kb/`** — Inherited GHG regulations, methodologies, and factor data. Treat claims and extracted values as unverified until checked against primary sources.

The [offline research pipeline](tools/research/README.md) builds a normalized source catalog from explicit manifests. It verifies local file hashes, sizes, and allowed paths; records provenance and unresolved metadata; and rejects identity/version conflicts. Catalog inclusion does not approve a source for runtime answers or calculations. Originals remain outside Git.

## Stack

Bun 1.3.12 + Turborepo + Elysia + Vite + React 19 + React Router v7 + Tailwind v4 + Drizzle + Supabase. Each API has its own port. Shared TypeScript and ESLint defaults live in `config/`.

## Start locally

Install Bun **1.3.12**, then run from this directory:

```sh
bun install --frozen-lockfile
bun run dev
```

`dev` previews only the Site frontend at `http://localhost:5174`. The overview and source browser work without credentials or an API. They do not invoke the retained chat, sign-in, or calculation code.

`bun run dev:research:passages` starts the opt-in paragraph experiment on loopback port 3012. It defaults to provider-disabled and needs an independently pinned release, verified original/extracted sources and explicit development model configuration. Follow the [current runbook](docs/milestones/m2-passage-retrieval.md); do not use a watch process with a live in-memory budget. No environment export is loaded automatically. `bun run dev:research` retains the [historical fixed-statement service](docs/milestones/m2-answer-demo.md); run only one of these services at a time.

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

The same workflow defines a separate **Python 3.12** job for the offline catalog tests, using only the standard library and synthetic temporary files. Run them locally from the repository root:

```sh
python -m unittest discover -s tools/research -p "test_*.py" -v
```

This command needs no credentials, downloaded originals, or package installation. `bun run check` remains the application-only command and does not require Python. See the [catalog README](tools/research/README.md) for the builder command and the bundled Windows Python path when Python is not on PATH.

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
