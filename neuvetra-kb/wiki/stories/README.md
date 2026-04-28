# `wiki/stories/`

`type: story` — a customer narrative or worked example demonstrating value.

## Frontmatter

`products: [<one or more ids>]`. `demonstrates: [<feature, plan, or product ids the story exemplifies>]`. `sources: [<conversation id, customer-approval reference>]`.

## Heading structure

```markdown
## The Customer
## What They Tried Before
## What Changed
## Outcome
## Related
```

## Notes

- **Customer names require explicit written approval** (Public-Safe checklist item #6). Reference the approval in `sources:` (e.g., `sources: [2026-05-15-acme-dental-approval]` where that conversation captures the sign-off). Without approval: anonymize ("a 40-person dental practice in the Pacific Northwest").
- **Specific outcome numbers come from the customer**, not from us. If the customer said "we recovered 12% of after-hours revenue," quote it. Don't invent precision.
- **Worked examples (not real customers)** are also `story` pages — but `## The Customer` becomes "An illustrative example: ..." and `sources:` is empty. Keep them clearly framed as illustrations.
- See `../../CLAUDE.md` § Page Heading Structures for the canonical version.
