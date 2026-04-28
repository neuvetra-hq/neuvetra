---
id: 2026-04-25-site-scaffold-conv
type: conversation
title: "Conversation: Site scaffold stand-up + wiki-architecture policy"
status: shipped
created: 2026-04-25
updated: 2026-04-25
hats: [CTO, CPO]
related: [parent-landing-experience, 2026-04-25-parent-landing-site, 2026-04-25-spirit-as-brand-icon, frontdesk, terrascope, spirit, stack, multi-product-launch]
sources: []
tags: [scaffold, code, wiki-policy, brand]
---

# Conversation: Site scaffold stand-up + wiki-architecture policy

## Metadata

- **Date:** 2026-04-25
- **Hats worn:** CTO (lead — stack & code), CPO (recommendations on packaging, scope, naming).
- **Triggered by:** CEO opening: *"okay, now I want to start our new Nuvetra codebase that hosts both Frontesk and TerraScope applications. Let's use our tech stack that you're familiar with, like TypeScript and the tech stack that we are using in Frontesk, like 3JS and stuff like that. Let's create that folder inside the new Nuvetra and start from there."*
- **Workflow used:** superpowers brainstorming → write-spec → write-plan → subagent-driven implementation → save (this).

## Topics covered

In order of conversation flow:

1. Context check against the wiki — confirmed `[[parent-landing-experience]]` is the relevant feature page; pulled FrontDesk's stack details from `FrontDesk\code\` and `FrontDesk\code\apps\web\src\lib\spirit\`.
2. **Codebase directory name** — closed Open Q1 of `[[parent-landing-experience]]`.
3. **`code/` subdirectory** — CEO directed it be dropped; `Site/` IS the code root.
4. **Spirit code packaging** — closed Open Q2 of `[[parent-landing-experience]]`.
5. **Monorepo shape** — full Turborepo with both `apps/web` and `apps/api` populated from day 1.
6. **Scope of API copy from FrontDesk** — CEO clarified: tech-stack scaffold only, NOT functionality / routes.
7. **Scope of web copy from FrontDesk** — same: tech-stack scaffold only, no Spirit, no app-fsm route.
8. **Bun-only convention** — `bun add` / `bunx` for everything; no npm / pnpm / npx anywhere.
9. **Railway plumbing carry-over** — adapt FrontDesk's `railway.toml` + `Dockerfile` (both apps).
10. **Wiki-architecture policy** — CEO declared a new policy: memory / conversation wikis live ONLY at the Neuvetra root. The GHG KB is the sole exception (different purpose: product-RAG, not memory).
11. **Implementation:** subagent-driven scaffold execution, 6 batches, 10 commits.
12. **Verification:** `/health` returns `{"status":"ok"}`; web app serves Neuvetra placeholder; typecheck / build / lint all pass.

## Key statements

**CEO (opening):**
> "okay, now I want to start our new Nuvetra codebase that hosts both Frontesk and TerraScope applications. Let's use our tech stack that you're familiar with… Let's create that folder inside the new Nuvetra and start from there."

**CEO (directory name decision):**
> "let's go with site."

**CPO (Spirit packaging recommendation):**
Recommended **copy** rather than the wiki's prior "extract" recommendation, on the grounds that FrontDesk is live in production and restructuring it for a shared package was disproportionate cost for one new consumer. Full extraction deferred to the third-consumer trigger (Terrascope frontend).

**CEO (Spirit packaging decision):**
> "let's copy it. If you look into the Frontesk app route or app FST route that's heavily using the spirit, we can use that section as a bare minimum for our application. We don't need anything outside of that app-FST route, so look into it to see what technologies we are using and then use it as a base."

CPO interpreted "app FST route" as `pages/app-fsm/` (the most Spirit-heavy route in `FrontDesk\code\apps\web\src\`). Confirmed by reading `pages/app-fsm/AppFsmView.tsx` and the `machines/{appFsmMachine,spiritActor,loadAssetsActor,initializerMachine,probeActor}.ts` it depends on.

**CEO (monorepo shape):**
> "with option C: full Turborepo with API, let's copy or use Frontesk API as our base to see how we communicate with Railways. Eventually, we wanted to point Railways to this repo and send it live to that section."

**CEO (scope clarification — pivotal):**
> "when I said we use the API from Frontesk as the base, I didn't mean to just copy all the routes and functionality. Basically, the tech stack we're using to create an empty API tech stack for us there, so not the functionality there. The same thing goes for the UI or frontend section of the site. I want to basically scaffold all the technologies there. Everything is talking about an empty section, and then we take it from there."

This **rescoped the scaffold** mid-design. Spec section 1 was rewritten on the spot: no Spirit copy, no app-fsm route copy, no FrontDesk routes/services. Just the bones — empty Elysia API with `/health`, empty Vite + React 19 web app with placeholder element, all the deps installed for the eventual Spirit + chat work.

**CEO (no `code/` subdirectory):**
> "I don't think we need to go in the code directory; just sites, and then everything goes on there. The code subdirectory is not needed here."

CPO: agreed and tightened the rationale — Site has no knowledge-base sibling planned (per the wiki-policy below), so the `code/` level is empty nesting.

**CEO (Bun-everything):**
> "Make sure that everything that we use, we are using Bonn for everything. Also, we can use Bonnex for installing some packages and stuff like that if we needed to."

(*Voice transcription rendered "Bun" as "Bonn" and "bunx" as "Bonnex" — disambiguated from context.*)

**CEO (wiki-architecture policy — pivotal):**
> "after some thoughts, I think the only root-level wiki to save our conversation memory and everything that will be you and I talking about at every level should be enough. We would have the GHG knowledge base wiki, which is going to be a source of truth for ingesting files and adding a correct knowledge base wiki graph (kind of a basic graph database idea that we can push to our graph database and make a chatbot directly talk to it). That's a different wiki, and then we have all basically memory wiki or knowledge wiki for the whole brand and movement so that we can all talk about it. Have that in mind, and your design document looks good too. Thanks."

**Joint reading of that policy:**
- Memory / conversation wikis live ONLY at `Neuvetra\wiki\`. One canonical store across all C-level discussion regardless of which level a conversation touches (brand, FrontDesk, Terrascope, Site, plans, etc.).
- The Terrascope GHG KB at `Terrascope\ghg-kb\` is the sole exception. Different purpose: ingest domain files → graph DB (Weaviate) → product-RAG chatbot. Not for human conversation memory.
- The empty `FrontDesk\wiki\` placeholder is **redundant under this policy** and slated for review (out of scope this session).
- This explains why Site has no `wiki/` subdir (it would violate the policy) and reinforces why it has no `code/` subdir (no KB sibling needed).

**CEO (final approval to start implementation):**
> "okay, let's go."

**CEO (execution path):**
> "1" (chose subagent-driven execution from the two options offered).

## Files referenced

### Read during the conversation
- `C:\Users\nimab\Neuvetra\CLAUDE.md`
- `C:\Users\nimab\Neuvetra\wiki\index.md`
- `C:\Users\nimab\Neuvetra\wiki\features\parent-landing-experience.md`
- `C:\Users\nimab\Neuvetra\wiki\log.md`
- `C:\Users\nimab\Neuvetra\wiki\next.md`
- `C:\Users\nimab\Neuvetra\wiki\CLAUDE.md`
- `C:\Users\nimab\Neuvetra\wiki\brand\spirit.md`
- `C:\Users\nimab\Neuvetra\wiki\overview.md`
- `C:\Users\nimab\Neuvetra\wiki\meetings\2026-04-25-domain-deployment-state.md`
- `C:\Users\nimab\Neuvetra\wiki\plans\multi-product-launch.md`
- `C:\Users\nimab\Neuvetra\wiki\decisions\2026-04-25-parent-landing-site.md`
- `C:\Users\nimab\Neuvetra\FrontDesk\CLAUDE.md`
- `C:\Users\nimab\Neuvetra\FrontDesk\code\CLAUDE.md`
- `C:\Users\nimab\Neuvetra\FrontDesk\code\package.json`
- `C:\Users\nimab\Neuvetra\FrontDesk\code\turbo.json`
- `C:\Users\nimab\Neuvetra\FrontDesk\code\tsconfig.json`
- `C:\Users\nimab\Neuvetra\FrontDesk\code\apps\api\package.json`
- `C:\Users\nimab\Neuvetra\FrontDesk\code\apps\api\src\index.ts`
- `C:\Users\nimab\Neuvetra\FrontDesk\code\apps\api\railway.toml`
- `C:\Users\nimab\Neuvetra\FrontDesk\code\apps\api\Dockerfile`
- `C:\Users\nimab\Neuvetra\FrontDesk\code\apps\api\tsconfig.json`
- `C:\Users\nimab\Neuvetra\FrontDesk\code\apps\web\package.json`
- `C:\Users\nimab\Neuvetra\FrontDesk\code\apps\web\vite.config.ts`
- `C:\Users\nimab\Neuvetra\FrontDesk\code\apps\web\index.html`
- `C:\Users\nimab\Neuvetra\FrontDesk\code\apps\web\tsconfig.json`
- `C:\Users\nimab\Neuvetra\FrontDesk\code\apps\web\tsconfig.app.json`
- `C:\Users\nimab\Neuvetra\FrontDesk\code\apps\web\tsconfig.node.json`
- `C:\Users\nimab\Neuvetra\FrontDesk\code\apps\web\railway.toml`
- `C:\Users\nimab\Neuvetra\FrontDesk\code\apps\web\Dockerfile`
- `C:\Users\nimab\Neuvetra\FrontDesk\code\apps\web\src\main.tsx`
- `C:\Users\nimab\Neuvetra\FrontDesk\code\apps\web\src\pages\app-fsm\AppFsmView.tsx`
- `C:\Users\nimab\Neuvetra\FrontDesk\code\apps\web\src\pages\app-fsm\AppFsmProvider.tsx`
- `C:\Users\nimab\Neuvetra\FrontDesk\code\apps\web\src\pages\app-fsm\useAppFsm.ts`
- `C:\Users\nimab\Neuvetra\FrontDesk\code\apps\web\src\pages\app-fsm\index.tsx`
- `C:\Users\nimab\Neuvetra\FrontDesk\code\apps\web\src\machines\appFsmMachine.ts`
- `C:\Users\nimab\Neuvetra\FrontDesk\code\apps\web\src\machines\spiritActor.ts`
- `C:\Users\nimab\Neuvetra\FrontDesk\code\apps\web\src\machines\loadAssetsActor.ts`
- `C:\Users\nimab\Neuvetra\FrontDesk\code\apps\web\src\machines\initializerMachine.ts`
- `C:\Users\nimab\Neuvetra\FrontDesk\code\apps\web\src\machines\authActor.ts`
- `C:\Users\nimab\Neuvetra\FrontDesk\code\apps\web\src\machines\probeActor.ts`

### Written / created during the conversation
- `C:\Users\nimab\Neuvetra\docs\superpowers\specs\2026-04-25-neuvetra-site-scaffold-design.md` (spec)
- `C:\Users\nimab\Neuvetra\docs\superpowers\plans\2026-04-25-neuvetra-site-scaffold.md` (plan)
- All files under `C:\Users\nimab\Neuvetra\Site\` (the scaffold itself):
  - `Site/.gitignore`, `Site/README.md`, `Site/CLAUDE.md`
  - `Site/package.json`, `Site/turbo.json`, `Site/tsconfig.base.json`, `Site/bun.lock`
  - `Site/apps/api/package.json`, `Site/apps/api/tsconfig.json`, `Site/apps/api/src/index.ts`
  - `Site/apps/api/railway.toml`, `Site/apps/api/Dockerfile`
  - `Site/apps/web/package.json`, `Site/apps/web/tsconfig.json`, `Site/apps/web/tsconfig.app.json`, `Site/apps/web/tsconfig.node.json`, `Site/apps/web/eslint.config.js`
  - `Site/apps/web/vite.config.ts`, `Site/apps/web/index.html`
  - `Site/apps/web/src/main.tsx`, `Site/apps/web/src/App.tsx`, `Site/apps/web/src/index.css`, `Site/apps/web/src/vite-env.d.ts`
  - `Site/apps/web/railway.toml`, `Site/apps/web/Dockerfile`

10 commits on `Site/` `main`. Site is its own git repo.

## Decisions raised

All raised AND closed in this conversation:

1. **Site directory name = `Site/`** (capital S) — closes Open Q1 of `[[parent-landing-experience]]`. Captured in the new product page `[[site]]` and reflected in all wiki + plan updates.
2. **Drop the `code/` subdirectory** — Site IS the code root; deviation from FrontDesk/Terrascope tracked.
3. **Spirit packaging = copy when added (next cycle)** — closes Open Q2 of `[[parent-landing-experience]]`. Captured as decision page `[[2026-04-25-spirit-packaging]]`. Defers extract-to-shared-package to the third consumer (Terrascope frontend).
4. **Wiki architecture policy: memory wikis only at `Neuvetra\wiki\` root, GHG KB sole exception** — captured as decision page `[[2026-04-25-wiki-architecture-policy]]`. Implies `FrontDesk\wiki\` placeholder is redundant; Site does not get a `wiki/` subdir.
5. **Bun-only across the board** for Site code — captured in `Site\CLAUDE.md`. Cross-product lockstep with FrontDesk and Terrascope.
6. **Full Turborepo (`apps/web` + `apps/api`) from day 1** — both apps populated; no `packages/` until shared code earns it.
7. **API copy = empty shell, not functionality** — Elysia + CORS + `/health` only. No FrontDesk routes / services / database / Stripe / Twilio / Retell.
8. **Web copy = empty shell, deps-only** — Vite + React 19 + RR v7 + Tailwind v4. Three.js + XState installed but unused (ready for next cycle's Spirit copy).
9. **Railway deploy plumbing in-repo** — adapted from FrontDesk: `railway.toml` (nixpacks for API, Dockerfile-based for web) + `Dockerfile`s for both apps.

## Action items

### Done in this conversation
- ✅ Spec written and committed: `docs\superpowers\specs\2026-04-25-neuvetra-site-scaffold-design.md`.
- ✅ Plan written: `docs\superpowers\plans\2026-04-25-neuvetra-site-scaffold.md`.
- ✅ `Site/` scaffold built and verified end-to-end (10 commits on `main`, all gates green: `bun install` ✓ | `bun run dev` ✓ | `/health` ✓ | typecheck ✓ | build ✓ | lint ✓).
- ✅ Wiki write-back (this save).

### Open after this conversation
- ☐ **Decide whether to fix the two reviewer-flagged issues** (web tsconfigs not extending base; Dockerfile `COPY ... bun.lock` would fail before Task 9's lockfile commit). Both deferred — non-blocking for current state.
- ☐ **Push Site/ to GitHub.** User-driven; not done in this conversation.
- ☐ **Wire Railway** (point services at Site repo's `apps/api` and `apps/web`). User-driven.
- ☐ **Resolve `FrontDesk\wiki\` placeholder** under the new wiki-architecture policy. Out of scope this session.
- ☐ **Next cycle: Spirit copy + parent-landing real content.** Each gets its own brainstorm → spec → plan → build cycle. Tracked under `[[parent-landing-experience]]` Open Q3–Q10.

## Open questions

These remain open AFTER this conversation (none surfaced new from it; all are deferred items from `[[parent-landing-experience]]` already on file):

- Q3: Spirit zone on the page (full-bleed vs scoped).
- Q4: Spirit reactivity event wiring.
- Q5: Per-product hover presets (`frontdeskHover`, `terrascopeHover`).
- Q6: Real-product chatbot vs lightweight explainer scope.
- Q7: Voice on the parent for Terrascope.
- Q8: Domain re-routing plan.
- Q9: Mobile / low-end device performance fallback for Spirit.
- Q10: Accessibility (reduced-motion, screen reader, keyboard nav).

Plus the cross-product open decisions (unchanged):
- `[[2026-04-25-brand-identity]]`, `[[2026-04-25-auth-billing-strategy]]`, `[[2026-04-25-calculator-implementation-strategy]]`.

## Notes / Heads-up

- **Reviewer false positives.** Sonnet code-quality reviewer flagged two issues in Batch 3 (`__dirname` in ESM `vite.config.ts`; `tsc --noEmit` failing on project-references tsconfig). Both were theoretical concerns that proved empirically wrong in Task 11 (Vite's config loader provides `__dirname` even in ESM; `tsc --noEmit` works on the project-references root with TS 5.9). Matches FrontDesk's prod-tested pattern. **Cross-product lockstep saved us** — when in doubt, mirror FrontDesk.
- **Voice transcription artifacts.** "Bun" → "Bonn", "bunx" → "Bonnex", "FrontDesk" → "Frontesk", "Neuvetra" → "Nuvetra/Wetrop", "app-fsm" → "app FST." Disambiguated mid-conversation. Same pattern as flagged in `[[2026-04-25-spirit-as-brand-and-parent-landing-conv]]`.
