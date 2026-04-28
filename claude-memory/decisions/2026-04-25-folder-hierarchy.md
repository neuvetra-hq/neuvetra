---
id: 2026-04-25-folder-hierarchy
type: decision
status: superseded
decided_on: 2026-04-25
decided_by: Joint
created: 2026-04-25
updated: 2026-04-28
related: [frontdesk, terrascope, 2026-04-28-consolidate-into-single-monorepo]
tags: [infra, monorepo]
---

# Folder hierarchy: consolidate under `Neuvetra\`

> **Superseded 2026-04-28 by [[2026-04-28-consolidate-into-single-monorepo]].** This decision consolidated three previously-independent repos as siblings under a single `Neuvetra/` *folder* — but each repo retained its own `.git`. The 2026-04-28 decision goes further: a single git repo wraps everything, products are flattened to `apps/<product>-{api,web}/`, and the `code/` + `wiki/` per-product subfolders are gone. Spatial framing (knowledge stores at root) is preserved. The body below is the historical 2026-04-25 record.

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
