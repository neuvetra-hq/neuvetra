---
id: 2026-04-25-site-scaffold
type: meeting
title: "Meeting: Site scaffold stand-up + wiki-architecture policy"
status: shipped
created: 2026-04-25
updated: 2026-04-25
hats: [CTO, CPO]
related: [site, parent-landing-experience, 2026-04-25-parent-landing-site, 2026-04-25-spirit-packaging, 2026-04-25-wiki-architecture-policy, 2026-04-25-spirit-as-brand-icon, frontdesk, terrascope, spirit, stack, multi-product-launch]
mentions: [frontdesk, terrascope, site, spirit]
sources: [2026-04-25-site-scaffold-conv]
tags: [scaffold, code, brand, infra, wiki-policy, launch]
---

# Meeting: Site scaffold stand-up + wiki-architecture policy

CEO opened a working session to stand up the new parent-landing codebase under `Neuvetra\`. Through the conversation: closed two open questions on `[[parent-landing-experience]]` (directory name, Spirit packaging), surfaced and closed a new policy decision on wiki architecture, and shipped the scaffold end-to-end with verification gates green.

## What we discussed

Followed superpowers brainstorming → write-spec → write-plan → subagent-driven implementation → save (this).

**Brainstorming phase (4 questions):**

1. **Directory name** (`[[parent-landing-experience]]` Open Q1). CPO offered `Site/` / `Landing/` / `neuvetra-com/`; recommended `Site/` for neutrality and future-proofing as the surface grows beyond pure landing.
   - **CEO:** "let's go with site."

2. **Spirit packaging** (`[[parent-landing-experience]]` Open Q2). CPO flagged that the wiki's prior "extract" recommendation predated awareness that FrontDesk is in production — restructuring it for a shared package was disproportionate cost. Recommended copy-now-defer-extraction.
   - **CEO:** "let's copy it. If you look into the Frontesk app route or app FST route that's heavily using the spirit, we can use that section as a bare minimum for our application."
   - CPO interpreted "app FST route" as `pages/app-fsm/` and confirmed by inspecting `FrontDesk\code\apps\web\src\pages\app-fsm\` and its `machines/` dependencies.

3. **Monorepo shape.** Three options offered (Turborepo with `apps/web` only / flat Vite / full Turborepo with empty API). CPO recommended option A.
   - **CEO:** "with option C: full Turborepo with API, let's copy or use Frontesk API as our base to see how we communicate with Railways. Eventually, we wanted to point Railways to this repo and send it live to that section."

4. **Scope (rescope mid-design).** CPO had begun to plan the app-fsm route + Spirit copy as part of the scaffold. CEO interrupted with a critical clarification:
   - **CEO:** "when I said we use the API from Frontesk as the base, I didn't mean to just copy all the routes and functionality. Basically, the tech stack we're using to create an empty API tech stack for us there… The same thing goes for the UI or frontend section of the site. I want to basically scaffold all the technologies there. Everything is talking about an empty section, and then we take it from there."
   - This rescoped the scaffold from "app-fsm + Spirit lift" to "deps-only empty shell." Spec section 1 was rewritten; everything Spirit-related and route-related deferred to subsequent cycles.

**Spec stage:**

5. **Drop the `code/` subdirectory.**
   - **CEO:** "I don't think we need to go in the code directory; just sites, and then everything goes on there. The code subdirectory is not needed here."
   - **CPO:** Tightened the rationale — Site has no knowledge-base sibling planned, so the `code/` level is dead weight. Documented as a deviation from FrontDesk/Terrascope hierarchy.

6. **Bun-only convention.**
   - **CEO:** "everything that we use, we are using Bonn for everything. Also, we can use Bonnex for installing some packages and stuff like that if we needed to."
   - (Voice transcription rendered "Bun" → "Bonn" and "bunx" → "Bonnex" — disambiguated from context.)

7. **Wiki-architecture policy clarification (pivotal).** After the design doc was nearly complete, CEO surfaced a broader policy:
   - **CEO:** "the only root-level wiki to save our conversation memory and everything that will be you and I talking about at every level should be enough. We would have the GHG knowledge base wiki, which is going to be a source of truth for ingesting files and adding a correct knowledge base wiki graph… That's a different wiki, and then we have all basically memory wiki or knowledge wiki for the whole brand and movement so that we can all talk about it."
   - **Joint reading:** memory wikis live ONLY at `Neuvetra\wiki\`; the GHG KB is the sole exception (different purpose: product-RAG, not human conversation memory). The empty `FrontDesk\wiki\` placeholder becomes redundant under this policy. Captured as `[[2026-04-25-wiki-architecture-policy]]`. Spec was updated inline to tighten the Site `wiki/` rationale and add this as a wiki write-back item.

**Plan + implementation stage:**

8. Plan written (14 tasks, batched into 6 implementer dispatches). CEO chose subagent-driven execution.
9. Implementation: 6 batches, 10 commits, reviewer-driven cadence (spec review on every batch; code-quality review on substantive batches).
10. Reviewer false positives (Sonnet flagged `__dirname` ESM concern + `tsc --noEmit` project-references concern) — both turned out to be theoretical issues that don't fire in practice; FrontDesk's identical patterns work in production. **Cross-product lockstep saved us.**
11. Verification: `bun install` ✓ (456 packages, no peer-dep conflicts) | `bun run dev` ✓ (api on 3000, vite on 5173) | `/health` returns `{"status":"ok"}` | typecheck ✓ | build ✓ | lint ✓.

## Decisions

All raised AND closed in this session:

| # | Decision | Page | Status |
|---|---|---|---|
| 1 | Directory name = `Site/` | (closes Q1 of `[[parent-landing-experience]]`; captured in `[[site]]`) | Closed |
| 2 | Drop `code/` subdirectory | (rationale in `[[site]]` and `Site\CLAUDE.md`) | Closed |
| 3 | Spirit packaging = copy when added; defer extraction to 3rd consumer | `[[2026-04-25-spirit-packaging]]` | Closed |
| 4 | Memory wikis only at Neuvetra root; GHG KB sole exception | `[[2026-04-25-wiki-architecture-policy]]` | Closed |
| 5 | Bun-only across Site code | (in `Site\CLAUDE.md`) | Closed |
| 6 | Full Turborepo with `apps/web` + `apps/api` from day 1 | (in `[[site]]`) | Closed |
| 7 | API copy = empty Elysia shell, no FrontDesk routes/services | (in `[[site]]`, spec) | Closed |
| 8 | Web copy = empty deps-only shell, no Spirit yet | (in `[[site]]`, spec) | Closed |
| 9 | Railway plumbing in-repo, adapted from FrontDesk | (in `[[site]]`) | Closed |

Also resolves an open observation from `[[2026-04-25-domain-deployment-state]]`: **Railway configs ARE committed in-repo for FrontDesk** — confirmed via `FrontDesk\code\apps\api\railway.toml` + `Dockerfile` and the matching web pair. Used as the template for Site's deploy plumbing.

## Action items

### Done in this session
- ✅ Spec at `docs\superpowers\specs\2026-04-25-neuvetra-site-scaffold-design.md`.
- ✅ Plan at `docs\superpowers\plans\2026-04-25-neuvetra-site-scaffold.md`.
- ✅ Site scaffold built: `Neuvetra\Site\` (10 commits on `main`).
- ✅ Verification gates green.
- ✅ Wiki write-back (this save).

### Open after this session
- ☐ User: push `Site\` to GitHub.
- ☐ User: wire Railway services to the Site repo (api + web).
- ☐ Cleanup: resolve `FrontDesk\wiki\` placeholder under the new wiki-architecture policy. Out of scope this session.
- ☐ Cycle 2 (separate brainstorm): Spirit copy + parent-landing real content. See `[[parent-landing-experience]]` § Next.
- ☐ Optional: address two non-blocking reviewer notes (web tsconfigs not extending base; Dockerfile `COPY ... bun.lock` would error pre-Task-9 — works after).

## Open questions

None new. Open Q3–Q10 on `[[parent-landing-experience]]` remain (Spirit zone, reactivity, presets, chatbot scope, voice on Terrascope, domain re-routing, mobile fallback, accessibility) — to be addressed in subsequent cycles.

Cross-product open decisions unchanged: `[[2026-04-25-brand-identity]]`, `[[2026-04-25-auth-billing-strategy]]`, `[[2026-04-25-calculator-implementation-strategy]]`.

## CEO direction captured

- Site is the directory name. No `code/` subdir.
- Tech stack scaffold only — empty shells. Build the bones now, add content in subsequent cycles.
- Bun for everything; `bunx` for one-off tools.
- Single root memory wiki for all C-level conversation; product KBs only when they serve product-RAG.
- Railway-deployable from day 1 (configs in-repo).
