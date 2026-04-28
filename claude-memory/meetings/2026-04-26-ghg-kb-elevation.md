---
id: 2026-04-26-ghg-kb-elevation
type: meeting
title: "Meeting: GHG KB elevated to Neuvetra root for spatial symmetry"
status: shipped
created: 2026-04-26
updated: 2026-04-26
hats: [CTO, CPO]
related: [terrascope, 2026-04-25-wiki-architecture-policy, 2026-04-25-folder-hierarchy, 2026-04-26-neuvetra-kb-design]
mentions: [terrascope, frontdesk, site]
sources: []
tags: [refactor, hierarchy, knowledge-base, schema, paths]
---

# Meeting: GHG KB elevated to Neuvetra root for spatial symmetry

CEO closed the day's structural work by elevating the Terrascope GHG KB out of the product folder. With `wiki/` already at the Neuvetra root and `neuvetra-kb/` scaffolded earlier today (also at root), `Terrascope/ghg-kb/` was the last knowledge store still nested under a product. Moving it to `Neuvetra/ghg-kb/` puts all three knowledge stores at the same hierarchical level. Codebases (`Site/`, `FrontDesk/`, `Terrascope/`) stay where they are, and `Terrascope/` now contains only the Terrascope-runtime concerns (CLAUDE.md, status.md, code/).

## What we discussed

Brief CEO directive at the close of the neuvetra-kb M1 cycle:

> "now that the Neuvetra KB and the Wiki are on the top level, let's move the GHG KB to the same level as them so all the knowledge bases are going to be at the same level and then we will have site and the other code bases there."

Pre-flight survey before the move:
- **`Terrascope/ghg-kb/` was its own git repo** (803 files, history intact). Filesystem move preserves git history with no special handling.
- **31 markdown files** referenced `Terrascope/ghg-kb/` or `Terrascope\ghg-kb\`. 135 total occurrences across 36 files (broader `ghg-kb` token).
- **No actual code** (TS/SQL/Python) in `Terrascope/code/` hardcodes the path; the only references are markdown documentation in `Terrascope/code/CLAUDE.md` (relative `..\ghg-kb\`, becomes `..\..\ghg-kb\` post-move) and a runtime env-var note for `seed-factors.ts` (the env var is set at dev-environment level — not in code, but the dev-instructions for setting it now point to the new path).

Decided to update **living docs** (CLAUDE.md cascade, current wiki state, status pages) and leave **historical records** (raw conversations, past meetings, past decisions, past log entries, point-in-time specs from 2026-04-25) untouched. Past records describe the world as it was; rewriting them retroactively is a fidelity loss for no operational gain.

## Implementation

1. ✅ Filesystem move: `mv Terrascope/ghg-kb ghg-kb`. Git repo history preserved.
2. ✅ Updated root `Neuvetra/CLAUDE.md`: hierarchy diagram (added `ghg-kb/` as a top-level sibling above `Terrascope/`), hierarchy notes (replaced "Terrascope's GHG KB is the sole exception to root-only memory" framing with "all knowledge stores live at root"), boundary-with-product-knowledge paragraph, save-protocol exclusion list, self-awareness rule (`"the GHG KB"` → `Neuvetra\ghg-kb\`), Two Products Terrascope blurb, Cross-Product Absolute Rule #1 (the three-stores rule now uses root-level paths for all three), Decided list (added 2026-04-26 entry).
3. ✅ Updated `Terrascope/CLAUDE.md`: rewrote "Two Halves" section ("two surfaces at different levels now"); per-section paths absolutized to `Neuvetra\ghg-kb\` and `Terrascope\code\`. Open Question on factor-seeding env-var path updated.
4. ✅ Updated `Terrascope/code/CLAUDE.md`: relative refs `..\ghg-kb\` → `..\..\ghg-kb\` (4 places).
5. ✅ Updated `Terrascope/status.md`: 5 paths.
6. ✅ Updated `ghg-kb/CLAUDE.md` (the moved file): parent reference now points at the Neuvetra root; added a path-history note.
7. ✅ Updated wiki living docs: `overview.md` (knowledge-stores section now lists three at root), `next.md` (Terrascope pre-Phase-3 gate paths + skill-propagation list + new env-var update item), `CLAUDE.md` (one wikilink path), `raw/README.md`, `products/terrascope.md`, `products/site.md`, `tech/weaviate.md` (2 paths), `tech/claude-desktop-setup.md` (Desktop project pin path + a new note about the filesystem MCP scope being unchanged).
8. ✅ Editorial framing edit on `wiki/decisions/2026-04-25-wiki-architecture-policy.md`: added a `> Update 2026-04-26` block at the top noting the path elevation, kept the body as the 2026-04-25 record, added a parenthetical to the relevant Consequences bullet.
9. ✅ Updated `neuvetra-kb/CLAUDE.md` (just-shipped today): the parent-reference paragraph and the three-wiki table both now reference `..\ghg-kb\` (no longer `..\Terrascope\ghg-kb\`).
10. ✅ Updated `FrontDesk/wiki/CLAUDE.md` (3 refs), `.claude/skills/save-wiki/SKILL.md` (2 refs), `NEXT.md` (4 refs).
11. ✅ Updated `docs/superpowers/specs/2026-04-26-neuvetra-kb-design.md` (5 refs; status field bumped to "M1 shipped").
12. ✅ This meeting note filed; `wiki/log.md` ingest entry appended.

## Decisions

### Decision 1 — GHG KB path elevation: `Neuvetra/Terrascope/ghg-kb/` → `Neuvetra/ghg-kb/`

**Status:** Closed 2026-04-26. (Same-day operational decision, folded here per Policy C.)

**The call.** Move the GHG KB out of the Terrascope product folder up to the Neuvetra root, so all three knowledge stores (`wiki/`, `neuvetra-kb/`, `ghg-kb/`) sit at the same hierarchical level.

**Why now.**
- The `wiki/` and `neuvetra-kb/` knowledge stores are already at the root by 2026-04-26's earlier work. Leaving `ghg-kb/` nested under Terrascope created an asymmetry — same role (RAG store), different depth in the tree.
- Mental model alignment: knowledge stores at root, codebases under their product folders. Cleaner cascading-CLAUDE.md story; Self-Awareness Rule simpler.
- Future per-product KBs (e.g., a future FrontDesk KB if it ever needs one) follow the same rule by default — at root, not nested.
- The KB's git repo travels with the directory; no history loss, no rewrite.

**Rejected alternatives.** Leave it nested (asymmetry against `wiki/` and `neuvetra-kb/`; CEO explicitly rejected this in the directive). Rename it to `terrascope-kb/` to match `neuvetra-kb/` naming (would lose the existing `ghg-kb` brand on the directory + git repo + `Neuvetra GHG KB` framing in its CLAUDE.md; deferred — could be revisited but not now).

### Decision 2 — Wiki-architecture-policy framing extended (not changed)

**Status:** Closed 2026-04-26. The 2026-04-25 decision still holds.

**The call.** The original `wiki-architecture-policy` decision framed `ghg-kb` as "the sole exception to the root-only memory-wiki rule." That framing was about *path*, not about *the rule*. The rule was always: memory wikis at root; RAGs are a different category and may live wherever serves their purpose. Now that all three knowledge stores live at root by spatial convention, the "sole exception" language is stale. The clarified shape:

- **Memory wikis** at root only (rule unchanged).
- **RAGs** at root by convention (clarification).
- **Codebases** under their product folders (`Site/`, `FrontDesk/`, `Terrascope/`).
- **Nothing else nested.**

The original decision page received a `> Update 2026-04-26` block at the top to reflect this; the body is preserved as the 2026-04-25 record.

### Decision 3 — Per-product RAGs (M5+) follow root-level convention

**Status:** Closed 2026-04-26 (anticipatory).

**The call.** When per-product chatbot RAGs are eventually built (e.g., FrontDesk signup KB, Terrascope intake KB), they live at the Neuvetra root, alongside `wiki/`, `neuvetra-kb/`, and `ghg-kb/` — not under their respective product folders. Naming convention: `<product>-kb/` (e.g., `frontdesk-kb/`, `terrascope-kb/`).

**Why.** Maintains the spatial pattern locked in today. The `[[2026-04-26-neuvetra-kb-design]]` meeting note's offhand line *"per-product chatbots build on the same pattern under their respective product folders later"* (written this morning, before this elevation) is implicitly superseded — the pattern is at root.

## Action items

- [x] Move directory + update all living docs. **Done 2026-04-26.**
- [x] File this meeting note + append `wiki/log.md`. **Done 2026-04-26.**
- [ ] **Inside `ghg-kb`'s own git repo** (now at root): consider committing a one-line README note flagging the parent path change. The internal `wiki/log.md` of the GHG KB still has historical entries that mention `Terrascope/ghg-kb/` — those are correct as historical record. Optional.
- [ ] **Terrascope code env-var update.** The dev-environment env var that points the factor seeder at `Neuvetra\Terrascope\ghg-kb\factors\processed\` needs updating to `Neuvetra\ghg-kb\factors\processed\`. Tracked in `wiki/next.md` Terrascope pre-Phase-3 gate as item (4).
- [ ] **Claude Desktop GHG KB project** (per `wiki/tech/claude-desktop-setup.md`): the project's pinned folder path needs updating from `Neuvetra\Terrascope\ghg-kb\` to `Neuvetra\ghg-kb\`. Filesystem MCP root (`Neuvetra\`) is unchanged. Manual step in Desktop's project settings.

## Files referenced

- **Filesystem move:** `Neuvetra\Terrascope\ghg-kb\` → `Neuvetra\ghg-kb\`.
- **Files updated** (living docs only): root `Neuvetra\CLAUDE.md`; `Terrascope\CLAUDE.md`, `Terrascope\code\CLAUDE.md`, `Terrascope\status.md`; `ghg-kb\CLAUDE.md`; `wiki\overview.md`, `wiki\next.md`, `wiki\CLAUDE.md`, `wiki\raw\README.md`, `wiki\products\terrascope.md`, `wiki\products\site.md`, `wiki\tech\weaviate.md`, `wiki\tech\claude-desktop-setup.md`; `wiki\decisions\2026-04-25-wiki-architecture-policy.md` (framing edit only); `neuvetra-kb\CLAUDE.md`; `FrontDesk\wiki\CLAUDE.md`; `.claude\skills\save-wiki\SKILL.md`; `NEXT.md`; `docs\superpowers\specs\2026-04-26-neuvetra-kb-design.md`.
- **Files left as historical record** (unchanged): all `wiki\raw\conversations\*`, all prior `wiki\meetings\*` (other than this one), all prior `wiki\decisions\*` (other than the framing edit on `wiki-architecture-policy`), prior entries in `wiki\log.md`, all `docs\superpowers\specs\2026-04-25-*` and `plans\2026-04-25-*`. Historical records describe the world as it was; rewriting them retroactively is a fidelity loss.
