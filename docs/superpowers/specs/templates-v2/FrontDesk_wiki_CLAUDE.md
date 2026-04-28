# FrontDesk Wiki — Placeholder

> **Parent:** `..\CLAUDE.md` (FrontDesk project). Read that first for the project context.

---

## Status

**No wiki content exists for FrontDesk today.** This folder is a reserved slot for future use, kept for symmetry with `Neuvetra\Terrascope\wiki\`.

---

## When To Fill This

Consider populating this folder when FrontDesk needs:

- **Product FAQs** the chatbot should ground in (rather than freelance via system prompt)
- **Brand voice references** that go beyond what fits in a prompt
- **Internal runbooks** for ops or support
- **Customer-facing docs** that the chatbot can cite

---

## How To Fill It (when the time comes)

Mirror the structure used in `Neuvetra\Terrascope\wiki\`:

```
wiki/                            ← this folder
├── CLAUDE.md                    ← (rewrite this file with the actual wiki schema)
├── raw/                         ← immutable source documents (the inbox)
├── wiki/                        ← curated, LLM-maintained markdown pages
└── sources/                     ← summaries of raw documents
```

Then write a real wiki operating schema following the pattern in `Neuvetra\Terrascope\wiki\CLAUDE.md` — page types, frontmatter, ingest/query/lint workflows.

If the wiki is going to feed RAG at runtime, decide on a retrieval store (Terrascope uses Weaviate). Two products with two separate wikis can share a Weaviate instance using namespace separation.

---

## Until Then

Treat this folder as inert. Don't add files here unless you're committing to building the FrontDesk knowledge base.
