---
id: 2026-04-25-wiki-integrity-pass-conv
type: conversation
title: "Conversation: wiki integrity pass — schema refinement after raw-layer adoption"
status: shipped
created: 2026-04-25
updated: 2026-04-25
hats: [CPO, CTO]
related: [2026-04-25-wiki-raw-layer, 2026-04-25-wiki-raw-layer-design]
sources: []
---

# Conversation: wiki integrity pass — schema refinement after raw-layer adoption (2026-04-25)

## Metadata

- **Date:** 2026-04-25
- **Participants:** CEO (Nima); C-suite hats: CPO, CTO
- **Subject:** Continuation of [[2026-04-25-wiki-raw-layer-design-conv]]. CEO asked to make sure everything is in good shape after the raw-layer architecture rollout.

## Topics covered

1. Lint pass over the new wiki structure: stable `id` coverage, basename / id alignment, broken wikilinks, orphan pages, index drift.
2. Backfill of `id:` frontmatter on the 20 pre-existing pages.
3. YAML validity — discovered `[[a]], [[b]]` syntax in frontmatter `related:` etc. is invalid YAML (parsed as nested flow lists).
4. Schema refinement: **frontmatter uses bare IDs; `[[wikilink]]` syntax is body-only.**
5. Stale-claim sweep: caught Railway "configs not yet committed" still living in `tech/stack.md`.
6. Body-link discoverability: three pages had only frontmatter inbound edges, no body wikilinks.

## Key statements

**CEO:**

- "You link to our wiki as well. Make sure everything is in good shape."

**CTO:** Ran a full integrity pass:

- All 20 pre-existing pages were missing `id:` (the new schema's stable graph node identifier). Backfilled them via Python script: `id = filename basename`.
- Backfill script had a bug — collapsed closing `---` onto the last frontmatter line (`tags: [...]---`). Caught immediately and fixed.
- Discovered the deeper issue: every page's `related:` field used Obsidian wikilink syntax inline (`related: [[a]], [[b]]`), which is invalid YAML. Normalized to `related: [a, b]` (bare IDs) across all 25 pages. Validated via `yaml.safe_load` — 25 / 25 pass.

**CPO:** Translated the YAML fix into a schema rule and propagated it:

- Updated `wiki\CLAUDE.md` § Frontmatter Schema with explicit guidance: bare IDs in frontmatter, wikilinks body-only, with example values.
- Updated `wiki\raw\conversations\README.md` example.
- Updated `Neuvetra\.claude\skills\save-wiki\SKILL.md` example and quality bar.
- Caught a stale claim in `tech\stack.md` ("Railway configs not yet committed") — same line that was already corrected in root `CLAUDE.md` last session. Fixed to reflect FrontDesk live on `neuvetra.com`.

**Joint:** Three pages had inbound frontmatter graph edges but no inbound *body* wikilinks (decisions/folder-hierarchy, meetings/wiki-raw-layer-design, tech/claude-desktop-setup). Added body references in `overview.md`, the wiki-raw-layer decision, and `tech/stack.md` so they're discoverable in both layers. Final integrity check: 25 / 25 YAML valid, 25 / 25 id-basename match, 0 broken body links, 0 orphans.

## Files referenced

- `Neuvetra\wiki\CLAUDE.md` — schema, refined.
- `Neuvetra\wiki\raw\conversations\README.md` — example updated.
- `Neuvetra\.claude\skills\save-wiki\SKILL.md` — examples updated.
- `Neuvetra\wiki\tech\stack.md` — stale Railway line + body link to claude-desktop-setup.
- `Neuvetra\wiki\overview.md` — added body link to folder-hierarchy decision.
- `Neuvetra\wiki\decisions\2026-04-25-wiki-raw-layer.md` — added Discussion section linking to meeting + raw conversation.
- 20 pages backfilled with `id:` field (all decisions / meetings / people / plans / products / tech).

## Decisions raised

- **Schema clarification (no formal decision page — refinement of [[2026-04-25-wiki-raw-layer]]):** Frontmatter relationship fields (`related`, `mentions`, `discussed_in`, `decided_in`, `supersedes`, `sources`, `parent`) use bare IDs only — never `[[ ]]` wrapping. Wikilinks are body-only. Documented in `wiki\CLAUDE.md`.

## Action items

- ✅ Backfill `id:` on all pre-existing pages.
- ✅ Fix backfill script's frontmatter-fence bug.
- ✅ Normalize all frontmatter relationships to bare IDs.
- ✅ Update schema docs (CLAUDE.md, raw README, SKILL.md) with bare-IDs rule.
- ✅ Fix stale Railway claim in `tech\stack.md`.
- ✅ Add body wikilinks for three frontmatter-only pages.
- ✅ Final integrity verification: YAML valid, id-basename match, no broken links, no orphans.

## Open questions

- None outstanding from this pass.

## Outcome

Wiki is now structurally sound: 25 / 25 pages YAML-valid with stable IDs, zero broken links, zero orphans, two raw conversations both with synthesized meeting notes. Ready for the next session — CEO is moving to a branding conversation.
