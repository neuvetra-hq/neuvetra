---
id: 2026-04-28-consolidate-into-single-monorepo
type: decision
title: "Consolidate three product repos + four unbacked-up local stores into a single monorepo"
status: closed
created: 2026-04-28
updated: 2026-04-28
decided_by: CEO
decided_on: 2026-04-28
tags: [infra, monorepo, refactor]
related: [frontdesk, terrascope, site, stack, supabase, multi-product-launch]
mentions: [ceo, c-suite]
discussed_in: [2026-04-28-monorepo-restructure]
sources: [2026-04-28-monorepo-restructure-conv]
supersedes: [2026-04-25-folder-hierarchy]
---

# 2026-04-28 — Consolidate into single monorepo

## Context

Pre-2026-04-28 state had three product codebases each in their own GitHub repo plus four local-only stores:

| Folder | GitHub | Status |
|---|---|---|
| `FrontDesk/code/` | `neuvetra-hq/front-desk` | Live → `neuvetra.com` (Railway) |
| `Site/` | `neuvetra-hq/site` | Live → `www.neuvetra.ai` (Railway) |
| `ghg-kb/` | `neuvetra-hq/neuvetra-ghg-wiki` | Backed up |
| `Terrascope/code/` | **No remote** | **Local-only — at risk** |
| `claude-memory/` | Not git-tracked | **Local-only — at risk** |
| `neuvetra-kb/` | Not git-tracked | **Local-only — at risk** |
| `docs/` | Not git-tracked | **Local-only — at risk** |

This had grown organically as products were added to the same root folder ([[2026-04-25-folder-hierarchy]]). It worked, but four problems were stacking:

1. **Single-machine risk on four stores.** Months of strategic memory + Terrascope's entire backend + DB + calculation engine + the public-KB scaffold lived only on the CEO's laptop.
2. **Cross-product code sharing was awkward.** The Spirit (Three.js + XState) was already duplicated across FrontDesk and Site per [[2026-04-25-spirit-packaging]]. Extraction across three separate repos requires npm publish or git submodules; both are heavier than they need to be.
3. **Strategic context had no obvious home.** [[claude-memory]] is cross-cutting by design and didn't belong inside any product repo, but it was unversioned outside them too.
4. **Stack alignment** ([[stack]]) was a "rule" enforced by hand. A monorepo enforces it for free via shared lockfile + workspace dep resolution.

The session also surfaced a Twilio Campaign 2 rejection on FrontDesk that was unrelated to this decision but motivated the broader "let's just do the infrastructure fresh" call.

## Current de-facto state

After execution on 2026-04-28: **single private repo at `github.com/neuvetra-hq/neuvetra`** containing all six apps, five packages, three knowledge stores, docs, and configs. Initial commit `6466770` — 720 files, 93,782 lines. Old GitHub repos remain available for archival reference; old local `.git` directories were nuked. See [[2026-04-28-monorepo-restructure]] for the execution write-up.

## Options

**Option A — Stay polyrepo** (status quo). Keep three product repos plus add GitHub remotes for the four unbacked-up stores.
- Pros: zero migration risk; Railway hookups already work; smaller blast radius per repo.
- Cons: doesn't solve cross-product code sharing or stack drift; strategic memory still has no clean home; four new remotes to provision and maintain.

**Option B — Hybrid: shared infra repo + product repos.** A `neuvetra-shared` repo for `claude-memory/`, knowledge bases, and shared packages (Spirit) alongside the three product repos.
- Pros: preserves product independence; strategic memory gets a home.
- Cons: still requires submodules or copy/paste for shared code; four moving parts instead of three; mental model fragments.

**Option C — Single monorepo.** All apps + packages + knowledge stores + docs in one private repo.
- Pros: cross-product code sharing is native (workspaces); stack alignment enforced by shared lockfile; strategic memory finally version-controlled; one mental model; one CI surface.
- Cons: Railway services need re-pointing with per-app Root Directory; bigger blast radius for repo-wide changes; permissions are coarse (acceptable given solo-founder context).

## Call

**Option C — single monorepo at `github.com/neuvetra-hq/neuvetra` (private).** Layout:

```
neuvetra/
├── apps/
│   ├── frontdesk-{api,web}    ← from FrontDesk/code/apps/{api,web}
│   ├── site-{api,web}         ← from Site/apps/{api,web}
│   └── terrascope-{api,web}   ← from Terrascope/code/apps/{api,web}
├── packages/
│   ├── frontdesk-{config,database}
│   └── terrascope-{config,database,calculator}
├── claude-memory/             ← finally version-controlled
├── neuvetra-kb/               ← finally version-controlled
├── ghg-kb/                    ← absorbed (was its own repo)
├── docs/                      ← finally version-controlled
└── (configs at root: package.json, turbo.json, tsconfig.base.json, .gitignore, .gitattributes, eslint.config.mjs)
```

Folder names use product prefix; **package.json `name` fields preserved** (`@frontdesk/database`, `@terrascope/database`, etc.) so existing `import "@frontdesk/database"` statements keep working without churn.

`.gitattributes` enforces LF line endings, eliminating the Windows CRLF phantom-diff failure mode.

Old per-product `.git` directories nuked; initial commit force-pushed over the empty `neuvetra` repo's auto-generated placeholder `README.md` + `SECURITY.md`.

## Why

- **Stack is identical** across all three products (Bun + Turborepo + Elysia + Drizzle + Vite + React 19 + RR v7 + Tailwind v4). Workspace resolution does what manual lockstep was doing by hand.
- **Spirit extraction trigger is approaching.** Per [[2026-04-25-spirit-packaging]] the trigger fires when a 3rd consumer arrives (Terrascope frontend). In a monorepo extraction is a one-line workspace move; in three repos it's npm publish + version bumps everywhere.
- **Strategic memory needs a backed-up home.** [[claude-memory]] is the C-level source of truth and was never version-controlled. This puts it in git on push.
- **Solo-founder context.** The main reason teams choose polyrepo (independent permissions, blast-radius isolation between teams) doesn't apply.
- **CEO directive: start fresh.** Snapshot current files into a clean repo, no carried git history. The old GitHub repos remain for archival reference; Railway is the only piece that needs explicit re-pointing.

## Consequences

**Immediate (done in execution session):**
- Three GitHub repos no longer the source of truth for FrontDesk / Site / ghg-kb. The new `neuvetra` repo is.
- 18 commits of `feature/app-fsm` Spirit/app-fsm UI work discarded with explicit CEO authorization (CEO declared "I don't need them"). Recoverable from `git reflog` for ~30 days; from the deleted remote for ~90 days via GitHub support.
- 2 unpushed Site M2 pilot commits' git history not carried; the on-disk file state did make it into the initial monorepo commit.
- All `node_modules/` and `bun.lock` files dropped — `bun install` at root regenerates a unified `bun.lock`.

**Pending (next session bites):**
- **Railway re-point** — both services (`front-desk` and `site-web`/`site-api`) need GitHub source switched to `neuvetra-hq/neuvetra` with appropriate per-app Root Directory (e.g., `apps/frontdesk-web`, `apps/site-api`). CEO action in Railway dashboard. Until done, production is on the OLD repos and any push to the new monorepo won't auto-deploy.
- **Old GitHub repos** (`neuvetra-hq/front-desk`, `neuvetra-hq/site`, `neuvetra-hq/neuvetra-ghg-wiki`) — flag read-only / archived once Railway is migrated.
- **Supabase project rename** (FrontDesk → Neuvetra) + schema reorg into `frontdesk.*` / `terrascope.*` / `site.*` Postgres schemas. The single-shared-Supabase decision was already made in [[2026-04-26-site-chat-backend-architecture]] § Decision 5; this is the execution of it. Tracked in [[2026-04-28-monorepo-restructure]] action items.
- **CLAUDE.md rewrite pass** — root + per-app CLAUDE.md files slim and accurate to the new layout. `ghg-kb/CLAUDE.md` and `neuvetra-kb/CLAUDE.md` are explicitly NOT touched (they follow [[karpathy-llm-wiki]] and are working as designed).

**Supersedes:** [[2026-04-25-folder-hierarchy]] (the prior decision to consolidate three repos as siblings under `Neuvetra/` while keeping each its own git repo). That decision's spatial framing — knowledge stores at root, products as siblings — is preserved; what changes is that there's now one git repo wrapping all of it instead of four.

## Next

- Execute the database rename + schema reorg as the next infrastructure bite.
- Re-point Railway services.
- Archive old GitHub repos.
- Continue per [[2026-04-28-monorepo-restructure]] § Action items.
