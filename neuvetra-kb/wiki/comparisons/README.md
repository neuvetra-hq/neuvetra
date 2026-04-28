# `wiki/comparisons/`

`type: comparison` — Neuvetra (or one of its products) vs. an alternative. **Compare *categories* by default** ("DIY", "human hire", "off-the-shelf voice IVR"). Name a competitor only with explicit CEO green-light, and only with claims substantiable from public sources.

## Frontmatter

`products: [<one or more ids>]`. `compares: [<page ids of what's being compared>]` — references either Neuvetra page IDs (when comparing two products / plans / features within Neuvetra) or *category-slug* IDs (e.g., `compares: [frontdesk, hire-receptionist-category]`). Brand-level comparisons (`Neuvetra vs. building it yourself`) use `products: []`.

## Heading structure

```markdown
## What's Being Compared
## When Each Wins
## Cost Comparison
## Effort Comparison
## Recommendation
## Related
```

## Notes

- **Public-safe risk is high here** — LINT samples 100% of `comparison` pages. Common slips: naming a vendor we don't intend to (Public-Safe #7), quoting our internal cost basis (Public-Safe #2), making competitor claims we can't back up.
- `Cost Comparison` references Neuvetra plans by wikilink for the Neuvetra side; the alternative's cost is described in ranges or order-of-magnitude with public sources cited if specific.
- `When Each Wins` is honest. If the alternative wins in some scenarios, say so. The chatbot's credibility comes from acknowledging that.
- See `../../CLAUDE.md` § Page Heading Structures for the canonical version.
