# Meetings

One file per *material* C-level chat. Filename: `YYYY-MM-DD-slug.md`.

## When to file a full meeting note
- A decision was made (also gets a `decisions\` page).
- A non-trivial discussion that future-me should be able to reconstruct.
- A change in direction on a product / plan / feature.

## When NOT to file
- Small talk, quick lookups, or routine queries — `log.md` entry is enough.

## Frontmatter
```yaml
---
type: meeting
status: shipped
created: YYYY-MM-DD
updated: YYYY-MM-DD
hats: [CPO, CTO]   # which hats I wore in this meeting
related: [[...]]
tags: [...]
---
```

## Structure
1. **What we discussed** — short summary
2. **Decisions** — bullet list, each linking to a `decisions\` page if applicable
3. **Action items** — who does what next (mark ✅ when done in-session)
4. **Open questions** — what we couldn't resolve
5. **CEO direction captured** — direct quotes worth preserving
