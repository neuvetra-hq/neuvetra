---
id: 2026-04-26-overview-wedge-and-draft
type: conversation
title: "Conversation: Brand wedge selection + overview.md draft"
created: 2026-04-26
updated: 2026-04-26
hats: [CPO]
sources_for: [overview]
---

# Conversation: Brand wedge selection + overview.md draft

## Metadata

First M2 content cycle for `neuvetra-kb`. Authoring session: brand-level wedge selection + draft of `wiki/overview.md`. Trigger: implicit — CEO opened M2 ("let's do M2") and immediately asked to study Adobe's parent-brand pattern as a reference for Neuvetra's brand architecture.

## Topics covered

- **Adobe brand-architecture study.** Three-tier pattern: parent brand (Adobe, "Creativity for All") → cloud groupings (Creative Cloud, Document Cloud, Experience Cloud) → product brands (Photoshop, Illustrator, Acrobat, Premiere). Master-brand color anchors visually; products keep it but get distinctive secondary colors and a shared logo template (one capital + one smaller letter). Voice split: parent = mission/aspiration, product = job-to-be-done.
- **Where Neuvetra differs from Adobe.** Adobe products are creative tools the user operates; Neuvetra products are AI agents that operate themselves. Adobe sells licenses to use; Neuvetra sells subscriptions to outcomes. Adobe customers are creators with skill investment; Neuvetra customers are SMB owners with zero skill investment. The shared structure (parent + portfolio of distinct named tools) is the reusable pattern; the product nature is different and the wedge has to honor that.
- **Adobe homepage chatbot UX.** CEO described the "Ask anything" input on adobe.com that answers visitor questions ("what is Adobe?", "what is Photoshop?", "what does it do?", "what's the pricing?"). Markdown-formatted streaming responses similar to ChatGPT. Confirmed that the schema in `neuvetra-kb/CLAUDE.md` was designed for exactly this retrieval pattern — page types map to question types, heading structures map to markdown sections the bot streams back.
- **Wedge candidates surfaced.** Four options proposed:
  - **A.** "AI specialists for every job in your business." — aspirational, mission-shaped.
  - **B.** "You don't hire it. You don't build it. You subscribe to it." — contrarian hook, names the buying model.
  - **C.** "Run your business, not your AI." — owner-first, clean.
  - **D.** "One AI tool per job. Pick yours." — portfolio-first, Adobe-shaped.
- **Wedge selected: A.** "AI specialists for every job in your business."
- **Site homepage slogan follow-up.** With the wedge locked, the homepage slogan at `Site/apps/web/src/App.tsx` (currently *"AI tools for businesses"*) gets updated to the full wedge. CEO chose "with option full" — full wedge in the homepage slogan, not a compressed version.
- **Overview draft shape.** Mirrors Adobe's mission → portfolio → products cadence, adapted to subscription-to-outcomes positioning. `## What It Is` first sentence is self-contained so retrieval can pull just that paragraph and answer "what is Neuvetra?" cleanly. Bold-anchored wedge for embedding-based retrieval. Wikilinks to product pages become Weaviate edges. Pricing pointer only — no numbers (single-source-of-truth rule).

## Key statements

**CEO:** "It's, for example, Adobe's website so they do our business model. Adobe is the parent and then they have Acrobat, Photoshop, Illustrator, Premiere, so that's their thing. Look at the website; you can get some ideas. We are similar to them but we do AI tools set up like Photoshop and Illustrator."

**CEO:** "On their home page they have an 'Ask a question or ask anything' page, which is an AI chat box. I can ask: What is Adobe? What is Photoshop? What does it do? We provide… What are the prices like you? The AI, similar to ChatGPT, answers and prints out some Markdown and stuff like that."

**CEO:** [wedge selection] "AI specialists for every job in your business."

**CEO:** [Site slogan tweak] "with option worth full" — interpreted as "go with the full wedge" for the homepage slogan, not a compressed version.

**CPO:** Adobe's parent-product pattern is the reusable shape; the product *nature* (AI agents that do the work, on subscription) is what makes Neuvetra distinct, and the wedge has to honor that. "AI specialists" rather than "AI tools" because *specialist* implies the AI is doing skilled work for you, not that you're operating a tool. "For every job in your business" sets up a portfolio explicitly — there will be many specialists, each owning a job.

## Files referenced

- `neuvetra-kb/CLAUDE.md` — schema, page types, heading structures, public-safe checklist (referenced for INGEST workflow).
- `neuvetra-kb/wiki/overview.md` — the page being authored (was M1 placeholder, promoted to `visibility: public` in this session).
- `Site/apps/web/src/App.tsx` — homepage slogan to be updated to the full wedge in the same session.
- `claude-memory/products/frontdesk.md`, `claude-memory/products/terrascope.md` — internal-strategy product pages (memory wiki, separate store from this KB).

## Decisions raised

- **Wedge for the brand:** *"AI specialists for every job in your business."* Closed.
- **Site homepage slogan:** Full wedge, not compressed. Closed.
- **Promote `overview.md`** from `visibility: draft` to `public`. Closed.

## Action items

- [x] Update `neuvetra-kb/wiki/overview.md` with the approved draft. Promote `visibility` to `public`.
- [x] Write this raw conversation file.
- [x] Append `neuvetra-kb/wiki/log.md`.
- [x] Update `neuvetra-kb/wiki/index.md` (overview promoted from M1-placeholder to actual).
- [x] Update `Site/apps/web/src/App.tsx` slogan to the full wedge.
- [ ] Next M2 cycle: draft `products/frontdesk.md` and `products/terrascope.md`. Both inherit the wedge — each is positioned as "your AI [job-title]" (receptionist, emissions analyst).
- [ ] Plans pages (`plans/*.md`) blocked by `[[2026-04-25-auth-billing-strategy]]` closure (open C-level decision in `claude-memory`).

## Open questions

- The `## Common Questions` section on the overview is currently a placeholder. As `faq` / `objection` / `comparison` pages land in subsequent M2 cycles, they should cross-link into the overview's Common Questions list. Likely first ones: "Why specialists instead of one general-purpose AI?", "How does this compare to hiring a person?", "What if my business's job isn't on the list yet?". None drafted yet — wait for the chatbot to surface them via real visitor queries (M4+) rather than guessing.
- Brand-color and visual identity for the homepage portfolio cards (FrontDesk purple, Terrascope green via backdrop hue-rotate) currently signal product-distinctness without an explicit master-brand color story. Open under `claude-memory` decision `2026-04-25-brand-identity` (logotype, type scale, palette spec, voice/tone). Adobe's pattern (master color + per-product secondary) is a candidate framework when that decision closes.
