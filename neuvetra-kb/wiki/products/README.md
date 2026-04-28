# `wiki/products/`

`type: product` — high-level overview of one Neuvetra product. **One page per product.** Two expected today: `frontdesk.md` and `terrascope.md`. Brand-level "what is Neuvetra" content lives in `wiki/overview.md`, not here.

## Frontmatter

`products: [<one-id>]`. `parent` is unused (products have no parent). `available_in` is unused (products aren't included in plans; plans are children of products).

## Heading structure

```markdown
## What It Is
## Who It's For
## How It Works
## Key Features
## Plans
## Common Questions
## Related
```

## Notes

- `Key Features` lists feature-page IDs by wikilink, not raw text. The feature pages own the descriptions.
- `Plans` lists plan-page IDs by wikilink — pricing belongs in plan pages, not here.
- See `../../CLAUDE.md` § Page Heading Structures for the canonical version.
