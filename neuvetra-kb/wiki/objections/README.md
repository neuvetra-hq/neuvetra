# `wiki/objections/`

`type: objection` — a common buyer concern + the honest answer. Examples: "Will it sound robotic?", "What about data privacy?", "I tried AI voice before and it was bad — why is this different?".

## Frontmatter

`products: [<one or more ids>]`. `addresses` is unused on this page type (objections are *addressed by* feature / use-case pages, which carry `addresses: [<this-objection-id>]`).

## Heading structure

```markdown
## The Concern
## The Honest Answer
## What We Actually Do
## Related
```

## Notes

- **Lead with the honest answer, not deflection.** The chatbot's credibility comes from acknowledging real concerns.
- **If the answer involves a tradeoff, say so.** "It can't do X yet" beats "It does everything X does and more" when the latter isn't true.
- **`What We Actually Do` describes capability the user observes**, not internal stack. Public-Safe checklist item #1.
- LINT samples 100% of `objection` pages — high public-safe risk.
- See `../../CLAUDE.md` § Page Heading Structures for the canonical version.
