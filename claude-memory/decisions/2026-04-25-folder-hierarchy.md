---
id: 2026-04-25-folder-hierarchy
type: decision
status: closed
decided_on: 2026-04-25
decided_by: Joint
created: 2026-04-25
updated: 2026-04-25
related: [frontdesk, terrascope]
tags: [infra, monorepo]
---

# Folder hierarchy: consolidate under `Neuvetra\`

## Context
Originally, FrontDesk, Terrascope, and the GHG wiki lived in three separate top-level folders under `C:\Users\nimab\`. This made cross-product work (parent landing site, brand, shared ops) awkward and made `CLAUDE.md` cascading impossible.

## Decision
All three repos consolidated under `Neuvetra\` root with `code/` and `wiki/` subfolders per product. Each level has its own `CLAUDE.md` and `.claude/skills/`.

```
Neuvetra/
├── CLAUDE.md
├── wiki/                       ← C-level (this wiki, added 2026-04-25)
├── docs/
├── Terrascope/{CLAUDE.md, code/, wiki/}
└── FrontDesk/{CLAUDE.md, code/, wiki/}
```

## Why
- `CLAUDE.md` cascade now works (root → product → wiki/code).
- Cross-product work has a natural home (`Neuvetra\docs\`, and now [[2026-04-25-establish-c-level-wiki]]).
- Single Windows working directory for the whole business.
