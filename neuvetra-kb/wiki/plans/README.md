# `wiki/plans/`

`type: plan` — a pricing tier for one product. **The single source of truth for pricing in this wiki.** Other pages reference plans by wikilink; they never quote a price.

## Frontmatter

`products: [<one-id>]`. `parent: <product-id>`. `replaces: [<old-plan-ids>]` when superseding a deprecated plan.

## Heading structure

```markdown
## At a Glance
## Price
## What's Included
## What's Not Included
## Who It's For
## Upgrade Path
## Related
```

## Notes

- **No unit-economics, vendor costs, or margin numbers in `Price`.** Display price only. Public-Safe checklist item #2.
- **`What's Included` lists feature-page IDs by wikilink** — the feature pages own the capability descriptions. This page owns *which features are in this plan*, not what they do.
- A new plan's `Upgrade Path` should reference the next plan up. The top plan's `Upgrade Path` can be "Contact us" (or whatever the actual escalation is) — but never describe internal sales motions (Public-Safe checklist item #5).
- Deprecated plan: don't delete; set `visibility: draft` and add `replaces: []` referencing the new plan in the new plan's frontmatter.
- See `../../CLAUDE.md` § Page Heading Structures for the canonical version.
