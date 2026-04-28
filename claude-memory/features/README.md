# Features

One page per feature. Features are the **graph hub** of this wiki — most cross-references converge here.

A feature page links to:
- Its product ([[frontdesk]] or [[terrascope]])
- The plan it lives under (`plans\<name>`)
- The decisions that shaped it (`decisions\<date>-<slug>`)
- The tech it uses (`tech\<name>`)
- The meetings where it was discussed (`meetings\<date>-<slug>`)

## Filename
`<feature-slug>.md` — kebab-case, globally unique.

## Frontmatter
```yaml
---
type: feature
status: active | shipped | parked
created: YYYY-MM-DD
updated: YYYY-MM-DD
product: frontdesk | terrascope
related: [[product-name]], [[plan-name]], [[tech-name]]
tags: [...]
---
```

## Structure
1. **What it is** — one paragraph
2. **User-facing behavior** — what the user sees / does
3. **Status** — current state, ship/build progress
4. **Decisions that shaped it** — links
5. **Tech** — links
6. **Next** — what's the next move on this feature
