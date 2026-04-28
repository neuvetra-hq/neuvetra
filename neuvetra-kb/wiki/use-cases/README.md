# `wiki/use-cases/`

`type: use-case` — a concrete buyer scenario the product solves. Reads like a vignette, not a spec. Examples: "Solo dental clinic missing after-hours calls", "Mid-market manufacturer preparing first CSRD filing".

## Frontmatter

`products: [<one or more ids>]`. `addresses: [<objection or faq ids>]` when the use-case directly answers a common concern.

## Heading structure

```markdown
## The Scenario
## The Problem Today
## How Neuvetra Solves It
## Outcome
## Recommended Plan
## Related
```

## Notes

- **`Outcome` is concrete or it's nothing.** "Saves time" is filler. "Captures every after-hours call" is real.
- **`Recommended Plan` links to one plan-page ID** — the simplest match for the scenario. Don't list all plans; that's `products/`'s job.
- Brand-level use-cases (e.g., "what is Neuvetra for") use `products: []`.
- See `../../CLAUDE.md` § Page Heading Structures for the canonical version.
