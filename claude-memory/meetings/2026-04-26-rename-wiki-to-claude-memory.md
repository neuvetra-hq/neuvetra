---
id: 2026-04-26-rename-wiki-to-claude-memory
type: meeting
title: "Meeting: C-level wiki renamed to claude-memory for clearer purpose"
status: shipped
created: 2026-04-26
updated: 2026-04-26
hats: [CTO, CPO]
related: [2026-04-25-establish-c-level-wiki, 2026-04-25-wiki-architecture-policy, 2026-04-26-ghg-kb-elevation, 2026-04-26-neuvetra-kb-design]
mentions: [frontdesk, terrascope, site]
sources: []
tags: [refactor, naming, schema, hierarchy, paths]
---

# Meeting: C-level wiki renamed to claude-memory for clearer purpose

CEO closed the day's structural rework with a naming change: rename `Neuvetra\wiki\` → `Neuvetra\claude-memory\`. The store was always Claude's persistent memory across sessions (declared in `claude-memory/CLAUDE.md` § Identity & Role); calling it "wiki" was generic and didn't communicate that it's distinct from the public salesperson RAG (`neuvetra-kb\`) or the Terrascope domain RAG (`ghg-kb\`). Three knowledge stores at root, three different roles — now the names make the roles obvious.

## What we discussed

CEO directive:

> "Rename the wiki to something like Claude's memory wiki or Claude conversation or conversation knowledge with something that we know, that it is not just a wiki, just a more meaningful name. Update your memories too."

Three finalist names proposed (with rationale):

1. **`claude-memory/`** — most direct match for "Claude's memory wiki." Names actor + role. Short, lines up with `neuvetra-kb/` / `ghg-kb/` brevity. Mild concern about overlap with Claude Code's auto-memory feature (already explicitly disabled in CLAUDE.md, so contained).
2. **`c-suite/`** — distinctive, no overlap. Anchors on the existing "Claude wears CFO/CPO/CTO hats" metaphor. Less obvious-purpose to a cold reader.
3. **`c-level-memory/`** — matches existing prose ("the C-level wiki", "C-level strategy"). Both vocabulary-words already familiar. Slightly longer, slight insider-flavor on "C-level".

CEO call: **`claude-memory`**.

The `save-wiki` skill at `.claude/skills/save-wiki/` was renamed simultaneously to `.claude/skills/save-claude-memory/` for naming consistency with the store it persists to.

## Implementation

1. ✅ **Filesystem move:** `Neuvetra\wiki\` → `Neuvetra\claude-memory\`. The store carries its `.obsidian/` config + all pages + raw conversations + meeting notes intact.
2. ✅ **Skill rename:** `.claude/skills/save-wiki/` → `.claude/skills/save-claude-memory/`. SKILL.md frontmatter `name:` updated `save-wiki` → `save-claude-memory`. Trigger phrases extended to include "save to memory" / "save to claude-memory" while keeping "save to wiki" / "update wiki" as legacy fallbacks (same store, more meaningful name).
3. ✅ **Path-pattern replacements** across living docs (replace_all): `Neuvetra\wiki\` → `Neuvetra\claude-memory\`, `Neuvetra/wiki/` → `Neuvetra/claude-memory/`, and all the `wiki\<typed-folder>\` / `wiki/<typed-folder>/` variants. Living docs updated: root `Neuvetra\CLAUDE.md`; `claude-memory\CLAUDE.md`, `claude-memory\index.md`, `claude-memory\log.md`, `claude-memory\next.md`, `claude-memory\overview.md`; many `claude-memory\meetings\2026-04-2[56]-*` and `claude-memory\decisions\2026-04-2[56]-*` files (today's, plus the wiki-architecture-policy decision via its `> Update 2026-04-26` block); `claude-memory\products\site.md`, `claude-memory\products\terrascope.md`, `claude-memory\tech\*.md`, `claude-memory\raw\README.md`; `Terrascope\CLAUDE.md`, `Terrascope\status.md`, `Terrascope\code\CLAUDE.md`; `ghg-kb\CLAUDE.md`; `neuvetra-kb\CLAUDE.md`, `neuvetra-kb\raw\conversations\README.md`; `Site\CLAUDE.md`; `FrontDesk\wiki\CLAUDE.md`; `.claude\skills\save-claude-memory\SKILL.md`; `NEXT.md`; `docs\superpowers\specs\2026-04-26-neuvetra-kb-design.md`.
4. ✅ **Identity prose updates** in the major identity-bearing files: root `CLAUDE.md` § "The C-Level Wiki" → § "The C-Level Memory Store (`claude-memory/`)"; hierarchy diagram callouts; Self-Awareness Rule entries (the table that maps user-vocab to paths) updated to add "claude memory" / "Claude's memory" as canonical and keep "the wiki" as a recognized legacy term routing to the same place. `claude-memory\CLAUDE.md` title `Neuvetra C-Level Wiki — Operating Schema` → `Neuvetra Claude-Memory — Operating Schema`, plus a path-history note at the top. `claude-memory\log.md` title `Wiki Log` → `Claude-Memory Log` plus a naming note.
5. ✅ **Recovery from over-eager replace_all.** Initial bulk replace on the bare pattern `wiki\` → `claude-memory\` accidentally munged a few `FrontDesk\wiki\` references into `FrontDesk\claude-memory\` (the FrontDesk product wiki placeholder is a separate thing — it stayed put). Caught and reverted in `claude-memory\log.md`, `claude-memory\next.md`, `claude-memory\overview.md`. Lesson: when bulk-replacing, prefer bounded patterns (`Neuvetra\wiki\`) over unbounded ones (`wiki\`).
6. ✅ **Historical records preserved** — raw conversations, past meeting notes, past decisions, past log entries, 2026-04-25 specs/plans — left as-is per the convention. They describe events when the store was called `wiki/`. New entries use `claude-memory/`. The naming-note blocks in `claude-memory\CLAUDE.md` and `claude-memory\log.md` make the convention explicit for future readers.
7. ✅ This meeting note filed; new log entry appended at the top of `claude-memory\log.md`; `claude-memory\index.md` updated.

## Decisions

### Decision 1 — Rename `wiki/` → `claude-memory/`

**Status:** Closed 2026-04-26.

**The call.** The C-level memory store at `Neuvetra\wiki\` is renamed to `Neuvetra\claude-memory\`. Three reasons:

1. **"Wiki" is generic.** The store has been Claude's persistent memory across sessions since establishment (2026-04-25 per `[[2026-04-25-establish-c-level-wiki]]`). The name didn't say so. The new name does.
2. **Three knowledge stores deserve three distinct names.** With `neuvetra-kb/` and `ghg-kb/` now at root (today's earlier work — `[[2026-04-26-neuvetra-kb-design]]` and `[[2026-04-26-ghg-kb-elevation]]`), having one of them called "wiki" was the odd-one-out. Each store now carries a name that signals its role: memory, public KB, GHG KB.
3. **Reduces "the wiki" ambiguity.** The Self-Awareness Rule used to flag "the wiki alone" as ambiguous (could be C-level or GHG KB or the FrontDesk placeholder). With the rename, "Claude's memory" / "the memory" routes here cleanly; "the GHG KB" / "the public KB" routes to the right RAG.

### Decision 2 — `save-wiki` skill renamed `save-claude-memory`

**Status:** Closed 2026-04-26.

**The call.** Skill folder `.claude/skills/save-wiki/` → `.claude/skills/save-claude-memory/`. SKILL frontmatter `name: save-wiki` → `name: save-claude-memory`. Trigger phrases keep backward compatibility: "save to wiki" / "update wiki" still trigger the skill (same store, just renamed).

### Decision 3 — Backward compatibility for "wiki" terminology

**Status:** Closed 2026-04-26.

**The call.** Phrases like "the wiki", "save to wiki", "this wiki" remain valid recognition terms — they all route to `claude-memory/`. The Self-Awareness Rule documents "wiki" as a legacy term that resolves to the new path. Historical pages (raw conversations, past meeting notes, past log entries) are left as-is — they describe events when the store was called `wiki/`. Future text uses `claude-memory/` naturally; the term "wiki" can still appear as a noun describing what kind of thing it is.

**Why.** A hard cutover would break (a) the CEO's existing vocabulary mid-conversation, (b) all historical record references, (c) any cached/external mental models. Soft cutover: the new name is canonical going forward; the old name still resolves.

## Action items

- [x] All filesystem moves + cascade updates. **Done 2026-04-26.**
- [x] File this meeting note + append `claude-memory\log.md`. **Done 2026-04-26.**
- [ ] **Claude Desktop projects** (per `claude-memory\tech\claude-desktop-setup.md`): no change needed — the filesystem-MCP root is `Neuvetra\` and stays correct. The four Desktop projects' folder pins were already at the product/root level; only the GHG KB's pin needed updating (handled in `[[2026-04-26-ghg-kb-elevation]]`).
- [ ] **Obsidian vault config.** The `.obsidian/` directory inside `claude-memory/` carries pane state from when it was `wiki/`. Should "just work" since paths are relative to the vault root, but verify on next Obsidian open and re-save the workspace if needed.
- [ ] **`NEXT.md` is stale relative to today's three structural cycles** (neuvetra-kb scaffold, ghg-kb elevation, this rename). Path references are now correct, but the body still describes 2026-04-25 state. Consider deprecating in favor of `claude-memory/next.md` (the canonical "what's next" tracker), or rewriting. Out of scope for this rename.

## Files referenced

- **Renamed:** `Neuvetra\wiki\` → `Neuvetra\claude-memory\`. `.claude\skills\save-wiki\` → `.claude\skills\save-claude-memory\`.
- **Updated** (~20 living-doc files): root `Neuvetra\CLAUDE.md`; the entire `claude-memory\` entry surface (`CLAUDE.md`, `index.md`, `log.md`, `next.md`, `overview.md`, `raw\README.md`); `claude-memory\products\*`, `claude-memory\tech\*`, `claude-memory\decisions\2026-04-25-wiki-architecture-policy.md`, today's two meeting notes; `Terrascope\CLAUDE.md`, `Terrascope\status.md`, `Terrascope\code\CLAUDE.md`; `ghg-kb\CLAUDE.md`; `neuvetra-kb\CLAUDE.md`, `neuvetra-kb\raw\conversations\README.md`; `Site\CLAUDE.md`; `FrontDesk\wiki\CLAUDE.md`; `.claude\skills\save-claude-memory\SKILL.md`; `NEXT.md`; `docs\superpowers\specs\2026-04-26-neuvetra-kb-design.md`.
- **Left as historical record** (unchanged): all `claude-memory\raw\conversations\*`, prior `claude-memory\meetings\2026-04-25-*`, prior `claude-memory\decisions\2026-04-25-*` (other than the 2026-04-25-wiki-architecture-policy framing edit done earlier today), prior entries in `claude-memory\log.md`, `docs\superpowers\specs\2026-04-25-*` and `plans\2026-04-25-*`. They describe the world when the store was called `wiki/`. The naming notes at the top of `claude-memory\CLAUDE.md` and `claude-memory\log.md` make the convention explicit for future readers.
