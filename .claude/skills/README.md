# Skills Folder

This folder holds Claude Code skills scoped to **this level** of the Neuvetra hierarchy.

A skill is a folder containing a `SKILL.md` (and optional supporting files like scripts, reference docs, or templates). When Claude is invoked at this directory or below, the skills here become available alongside any skills at parent levels.

## Scope conventions

- **`Neuvetra\.claude\skills\`** — business-wide. Skills here are available everywhere in the tree. Use for skills that apply to both products (e.g., a "write a status update across both products" skill).
- **`Neuvetra\<Product>\.claude\skills\`** — product-scoped. Available when working anywhere in that product. Use for product-level skills (e.g., a Terrascope-specific "ingest a regulation source" skill).
- **`Neuvetra\<Product>\wiki\.claude\skills\`** or **`Neuvetra\<Product>\code\.claude\skills\`** — surface-scoped. Available only when working in that wiki or codebase. Use for narrow, technical skills (e.g., a "run the calculator test suite" skill in `code/.claude/skills/`).

## Adding a skill

```
.claude/skills/
└── <skill-name>/
    ├── SKILL.md         ← required: name, description, instructions
    └── ...              ← optional: scripts, refs, templates
```

The `SKILL.md` description should make it obvious when Claude should trigger the skill. Keep skills narrow and composable rather than building one mega-skill.

## Currently empty

This is a fresh slot. Add skills as patterns emerge from real work.
