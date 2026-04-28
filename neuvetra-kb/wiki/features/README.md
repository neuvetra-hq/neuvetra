# `wiki/features/`

`type: feature` — a single product capability. One page per feature.

## Frontmatter

`products: [<one-id>]` (typical). `parent: <product-id>`. `available_in: [<plan-ids>]` — list every plan that includes the feature; if "all plans," list them anyway (explicit beats inferred).

## Heading structure

```markdown
## What It Does
## Who Uses It
## How It Works
## Available In
## Common Questions
## Related
```

## Notes

- **Don't quote prices here** — pricing lives only in `plan` pages. Reference the plan via wikilink.
- **No internal stack details** in `How It Works` — describe what the feature does for the user, not the infra. Public-Safe checklist item #1.
- Unshipped features go behind public-safe checklist item #4 — default is don't write the page until it ships.
- See `../../CLAUDE.md` § Page Heading Structures for the canonical version.
