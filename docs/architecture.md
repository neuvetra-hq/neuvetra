# Architecture and product boundaries

**Historical foundation, superseded product priority:** the September 8 CEO direction makes Neuvetra the sole GHG product, retires TerraScope branding and defers FrontDesk. The boundaries below describe the preserved source layout. Use [the current delivery plan](roadmap-neuvetra-ghg.md) and [GHG architecture proposal](research/product-architecture.md) for new work.

**Current private pilot:** Site now contains an isolated Scope 2 research handler and question workspace. `research-server.ts` on loopback 3012 loads a pinned EPA evidence release and uses a budgeted model for reviewed-proposition selection. It does not use the historical greeter corpus or a tenant database. The [pilot runbook](milestones/m2-answer-demo.md) governs this increment; the historical ownership table below does not describe its new answer boundary.

The company website, FrontDesk and Terrascope are independent applications. They share engineering conventions and identity; they do not share business behavior merely because their folders are in one repository.

## Ownership

| Concern | Owns | Does not own |
| --- | --- | --- |
| Site (`apps/site-*`) | Brand presentation, public product discovery, greeter/chat UI, website sign-in | Call provisioning, subscription lifecycle, emissions calculations |
| FrontDesk (`apps/frontdesk-*`, `packages/frontdesk-database`) | Product landing pages, receptionist configuration, calls, calendars, notifications, business billing | Company-wide marketing orchestration or GHG knowledge |
| Terrascope (`apps/terrascope-*`, `packages/terrascope-*`, `ghg-kb`) | Emissions inputs, factors, deterministic calculation, inventory and reporting | FrontDesk operations or internal strategic memory |
| Shared tooling (`config/`, root manifests/workflows) | Bun version, compiler/lint defaults, task orchestration and verification | Product state, prompts or business rules |

The existing FrontDesk product landing pages remain with FrontDesk to preserve routes and behavior. Site is the company-level marketing surface. The product-prefixed app names already provide stable, independent build and deployment targets.

## Dependencies

1. A product's web/API may depend on its own packages and neutral tooling. Do not import another product's runtime internals.
2. Shared code must have a clear shared responsibility. Extract stable contracts or infrastructure when there are real consumers; avoid moving business behavior into a catch-all shared folder.
3. Spirit remains duplicated in Site and FrontDesk under the existing packaging decision. Its later extraction is a separate change with visual checks.
4. Frontends must not import server credentials, database connections or internal memory. FrontDesk and Site currently call their APIs through browser `fetch()`; their builds do not need API/database source code.
5. Deployments are independent despite the common lockfile. Each Dockerfile installs/builds its relevant workspaces from the repository root.

## Shared identity, separate data

The intended shared Supabase project contains `auth.users` and `public.users` for identity. Product data belongs to `frontdesk.*`, `site.*` or `terrascope.*`. Schema ownership is not an authorization boundary: APIs still need authentication/tenant checks, and exposed tables need appropriate policies.

FrontDesk browser account reads now distinguish shared profile queries in `public` from membership queries in `frontdesk`. One Supabase client still owns the session. External schema exposure and policies must be verified before deployment; this cleanup does not modify the live database or apply migrations.

## Knowledge

`claude-memory` is internal company history. `neuvetra-kb` is public product knowledge. `ghg-kb` is Terrascope domain evidence and factors. Site's export includes explicitly public `neuvetra-kb` pages only. The production build context excludes raw knowledge stores and internal memory; Site ships its generated public corpus.

Use current implementation, checks and observed service state to assess readiness. Historical notes describe what was believed at the time; the deployment guide labels historical and current evidence separately.

## Work order

The earlier September 8 sequence (foundation, Site polish, FrontDesk, Terrascope) is preserved by the checkpoint tag. It was superseded later that day by a single Neuvetra GHG focus. New stages are research/source verification, supported answers, deterministic calculations, secure workspaces and a controlled pilot.
