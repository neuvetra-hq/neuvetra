# Monorepo Restructure — Migration Plan

**Date:** 2026-04-25
**Status:** Ready to execute (script not yet run)
**Owner:** Nima
**Goal:** Consolidate the three Neuvetra repos under a single umbrella folder so the parent CLAUDE.md, sibling product CLAUDE.mds, and shared assets all live in one tree.

---

## Target Layout

```
C:\Users\nimab\Neuvetra\                     ← umbrella (existing folder, repurposed)
├── CLAUDE.md                                ← parent / holistic operating schema
├── docs\                                    ← cross-product docs (specs, plans)
│   └── superpowers\specs\
│       ├── 2026-04-25-monorepo-restructure-plan.md   ← this file
│       └── 2026-04-25-multi-product-launch-plan.md   ← the launch plan
├── ghg-wiki\                                ← the wiki repo (was C:\Users\nimab\Neuvetra root)
│   ├── CLAUDE.md                            ← wiki operating schema (extracted from current root)
│   ├── raw\
│   ├── wiki\                                ← the curated pages folder
│   ├── factors\
│   ├── calculations\
│   ├── docs\specs\
│   └── .obsidian\
├── front-desk\                              ← was C:\Users\nimab\front-desk
│   ├── CLAUDE.md                            ← already cross-references parent
│   ├── apps\
│   └── packages\
└── terrascope\                              ← was C:\Users\nimab\terrascope
    ├── CLAUDE.md                            ← already cross-references parent
    ├── apps\
    └── packages\
```

**Why `ghg-wiki/` and not `wiki/`?** The wiki repo has its own internal `wiki/` folder for curated pages. Nesting it as `Neuvetra\wiki\wiki\` would be confusing.

---

## What Has To Move

| From | To |
|---|---|
| All current contents of `C:\Users\nimab\Neuvetra\` (except the new parent `CLAUDE.md` and the new `docs\` for cross-product specs) | `C:\Users\nimab\Neuvetra\ghg-wiki\` |
| `C:\Users\nimab\front-desk\` (entire folder) | `C:\Users\nimab\Neuvetra\front-desk\` |
| `C:\Users\nimab\terrascope\` (entire folder) | `C:\Users\nimab\Neuvetra\terrascope\` |

The current `Neuvetra\CLAUDE.md` becomes two files:
- The parent block (top half) stays at `Neuvetra\CLAUDE.md`.
- The wiki schema (bottom half, marked by the `# ──────` divider) moves to `Neuvetra\ghg-wiki\CLAUDE.md`.

---

## Path References That Must Be Rewritten

Search-and-replace targets after the moves complete:

| Old path | New path | Files to update |
|---|---|---|
| `C:\Users\nimab\Neuvetra\` (when meaning the wiki) | `C:\Users\nimab\Neuvetra\ghg-wiki\` | `terrascope\CLAUDE.md`; the wiki's own `CLAUDE.md`; any wiki internal docs that reference absolute paths |
| `C:\Users\nimab\front-desk` | `C:\Users\nimab\Neuvetra\front-desk` | parent `CLAUDE.md`; `terrascope\CLAUDE.md`; FrontDesk's own internal absolute-path references (if any) |
| `C:\Users\nimab\terrascope` | `C:\Users\nimab\Neuvetra\terrascope` | parent `CLAUDE.md`; FrontDesk `CLAUDE.md` (none currently); Terrascope-internal absolute references |
| `C:/Users/nimab/Neuvetra/factors/processed/` | `C:/Users/nimab/Neuvetra/ghg-wiki/factors/processed/` | `terrascope\packages\database\src\seed-factors.ts` (lines 26–32) |

**Recommendation regardless of restructure:** the `seed-factors.ts` hardcoded paths should move to env vars or a relative path resolved against a `WIKI_ROOT` constant. Restructure is a good time to fix this.

---

## Execution Steps (script does these in order)

1. **Pre-flight checks**
   - Verify the three source paths exist.
   - Verify the target subpaths (`Neuvetra\ghg-wiki\`, `Neuvetra\front-desk\`, `Neuvetra\terrascope\`) do **not** exist.
   - Verify no node processes / dev servers are running against any of the three repos (script prints a reminder; user confirms).
   - Verify there are no uncommitted changes in any of the three git repos (script runs `git status --porcelain` in each).

2. **Stash the current wiki contents**
   - Create `C:\Users\nimab\Neuvetra\.migration-staging\` as a temporary location.
   - Move every top-level item under `Neuvetra\` EXCEPT the new parent `CLAUDE.md` and the new `docs\` folder into staging.

3. **Create the new structure**
   - `mkdir Neuvetra\ghg-wiki`.
   - Move every item from `.migration-staging\` into `ghg-wiki\`.
   - Remove the empty `.migration-staging\`.

4. **Move the two product repos**
   - `Move-Item C:\Users\nimab\front-desk C:\Users\nimab\Neuvetra\front-desk`.
   - `Move-Item C:\Users\nimab\terrascope C:\Users\nimab\Neuvetra\terrascope`.

5. **Split the parent CLAUDE.md**
   - The parent `CLAUDE.md` currently contains BOTH the parent operating schema and the wiki operating schema, separated by the `# ──────` divider.
   - Cut everything from the divider downward and write it to `Neuvetra\ghg-wiki\CLAUDE.md`, prefixed with a `> Parent: see ..\CLAUDE.md` cross-reference.
   - Leave only the parent block in `Neuvetra\CLAUDE.md`.

6. **Rewrite absolute path references** (script does targeted Edit operations, NOT a blind string replace, to avoid corrupting code or comments)
   - In `Neuvetra\CLAUDE.md`: update sibling repo paths to the new `Neuvetra\<product>\` locations.
   - In `Neuvetra\ghg-wiki\CLAUDE.md`: update any internal absolute path references and the parent reference.
   - In `Neuvetra\terrascope\CLAUDE.md`: update wiki path from `C:\Users\nimab\Neuvetra\wiki\` to `C:\Users\nimab\Neuvetra\ghg-wiki\` and FrontDesk path.
   - In `Neuvetra\front-desk\CLAUDE.md`: update parent reference if needed.
   - In `Neuvetra\terrascope\packages\database\src\seed-factors.ts`: update the five `CSV_FILES` entries to the new `ghg-wiki\factors\processed\` location. (Better: refactor to env var; flagged as follow-up.)

7. **Post-flight verification**
   - For each repo, `cd` in and run `git status` — should show no working-tree changes (folder moves don't touch git internals).
   - Grep all three CLAUDE.mds for old absolute paths — should find none.
   - Grep `Neuvetra\terrascope\` for `C:/Users/nimab/Neuvetra/factors` (old path) — should find none.
   - List the new top-level `Neuvetra\` contents — should show exactly: `CLAUDE.md`, `docs\`, `ghg-wiki\`, `front-desk\`, `terrascope\`.

---

## Rollback

If anything goes wrong mid-migration:

- Steps 2–4 are reversible by `Move-Item` in reverse. The script keeps a log at `Neuvetra\.migration-log.txt` recording every move with old → new paths.
- Step 5 (CLAUDE.md split) is reversible: the script writes the original `CLAUDE.md` to `.migration-backup\CLAUDE.md` before splitting.
- Step 6 (path rewrites) is reversible via git in each affected repo (`git checkout -- <file>`).

If the script halts partway, re-running it is **not** safe — it expects a clean starting state. Run the rollback section of the script (`-Rollback` flag) instead, which reads `.migration-log.txt` in reverse.

---

## Things This Migration Does NOT Do

These are out of scope and tracked separately:

- **Parent landing site (neuvetra.com / .ai).** No new product folder is created. That's a separate decision — see the multi-product launch plan.
- **Refactoring `seed-factors.ts` to use env vars.** Script only updates the hardcoded paths to the new locations. Proper refactor is a follow-up.
- **Deduplicating Terrascope and FrontDesk shared infrastructure.** The two `packages/database` and `packages/config` folders stay independent. Sharing those is a separate decision.
- **Re-cloning into a single git repo.** The three repos retain their own `.git\` directories and remote origins. This is a folder reorg, not a git surgery.

---

## When To Run

Recommended sequence:

1. Commit and push every uncommitted change in all three repos.
2. Close any IDE windows pointing at the old paths.
3. Stop any running dev servers.
4. Run the script (see `2026-04-25-restructure.ps1`).
5. Re-open IDE workspaces at the new paths.
6. Update any local shell aliases, bookmarks, or scheduled tasks pointing at old paths.
7. Smoke test: `cd Neuvetra\terrascope; bun install; bun run --cwd apps/api dev` to confirm.
