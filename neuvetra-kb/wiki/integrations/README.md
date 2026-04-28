# `wiki/integrations/`

`type: integration` — a third-party tool or channel a product connects to. Examples: Twilio (telephony), QuickBooks (accounting export), Salesforce (CRM sync).

## Frontmatter

`products: [<one or more ids>]`. `parent` is unused (integrations don't have a parent product in the graph; they have `products:` tags instead).

## Heading structure

```markdown
## What It Is
## What Connects
## Setup Overview
## Limitations
## Related
```

## Notes

- **Naming a third-party brand on an integration page is the documented exception** to Public-Safe checklist item #1 — that brand is the page's literal subject. Naming a vendor in *any other page type* (especially `feature` or `product`) is still prohibited.
- `Setup Overview` describes what the user does, not what we do internally. No internal infra exposed.
- `Limitations` is honest, not deflective. If the integration is one-way, say so. If it's beta, say so. Public-Safe checklist item #4 (unshipped roadmap) still applies — don't promise capability that isn't shipped.
- See `../../CLAUDE.md` § Page Heading Structures for the canonical version.
