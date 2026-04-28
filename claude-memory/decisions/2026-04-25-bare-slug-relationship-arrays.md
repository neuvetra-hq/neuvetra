---
id: 2026-04-25-bare-slug-relationship-arrays
type: decision
title: "Bare kebab-case slugs are canonical in frontmatter relationship arrays (GHG KB and C-level wiki)"
status: closed
created: 2026-04-25
updated: 2026-04-25
decided_by: CEO
decided_on: 2026-04-25
related: [terrascope, weaviate, 2026-04-25-weaviate-retrieval-store, 2026-04-25-wiki-raw-layer, 2026-04-25-wiki-integrity-pass-conv]
discussed_in: [2026-04-25-ghg-kb-inbox-clearing-session]
sources: [2026-04-25-ghg-kb-inbox-clearing-and-bare-slug-decision-conv]
tags: [knowledge-architecture, schema, weaviate, ghg-kb, wiki, meta]
---

# Decision: bare kebab-case slugs are canonical in frontmatter relationship arrays

## Context

Both Neuvetra knowledge stores — the C-level wiki at [[wiki]] and the [[terrascope]] GHG knowledge base at `Terrascope\ghg-kb\wiki\` — use YAML frontmatter on every page with a stable `id` field plus typed relationship arrays (`references`, `requires`, `applies_to`, `calculated_by`, `parent`, `supersedes`, plus C-level-only `related`, `mentions`, `discussed_in`, `decided_in`, `sources`). These arrays become named edges on graph export to [[weaviate]] (decided 2026-04-25 per [[2026-04-25-weaviate-retrieval-store]]).

Two competing conventions had emerged in the GHG KB for what those array entries should look like:

1. **Bare slugs** — `references: [ghg-protocol-corporate-standard, scope-1]`. Matches the bare-slug `id:` field convention exactly.
2. **Folder-prefixed paths** — `references: [sources/ghg-protocol-corporate-standard, concepts/scope-1]`. Mirrors the wikilink display syntax used in markdown bodies (`[[folder/id|Display]]`).

A post-batch lint pass on 2026-04-25 surfaced the conflict: ~80 entries used the prefixed form; a smaller set (`regulations/eu-ets.md` and 17 entries that an automated lint had stripped) used the bare form. The C-level wiki had already adopted bare slugs earlier the same day in the wiki integrity pass ([[2026-04-25-wiki-integrity-pass-conv]]) when YAML validity required it (the `[[wikilink]], [[wikilink]]` syntax used inline in frontmatter is not valid YAML). The GHG KB had no analogous forcing function and had drifted into mixed convention.

The original `Terrascope\status.md` audit had labeled the BARE form as the bug ("Source ID prefix MISSING from ~21 references lists | Critical | Breaks ~21×N REFERENCES graph edges on export"). On re-examination this audit framing was inverted relative to the schema in `Terrascope\ghg-kb\CLAUDE.md`, which explicitly says "the `id` field is the graph node identifier [...] all cross-references use this ID."

## Current de-facto state (at decision time)

- C-level wiki: bare-slug convention adopted; 25 / 25 pages YAML-valid.
- GHG KB: mixed; ~80 prefixed entries across ~30 files alongside ~20 bare entries. Newly-ingested pages from the same-day 5-source batch had been split — CBAM and ETS Revision agents wrote bare; LCFS, Taxonomy parent, and Climate DA agents wrote prefixed; the lint pass had then stripped the latter group, deepening the inconsistency.

## Options

1. **Bare slugs everywhere (canonical).** Strip the folder prefix from every relationship-array entry across both knowledge stores. Lock the rule in the GHG KB schema doc the same way the C-level wiki schema already does it. ~80 GHG KB entries to strip; C-level already done.
2. **Folder-prefixed everywhere.** Re-add the prefix to the 17 GHG KB entries that the lint stripped, plus the few historically bare entries (e.g., `eu-ets.md` references), and also retroactively re-introduce prefixes in the C-level wiki (which adopted bare under YAML-validity pressure earlier the same day).
3. **Status quo.** Accept the mixed convention; rely on the export script to handle both forms. Defer the cleanup.

## Call

**Option 1.**

## Why

- **The schema is the canonical source of truth.** `Terrascope\ghg-kb\CLAUDE.md` Frontmatter Schema section says "the `id` field is the graph node identifier [...] all cross-references use this ID." All 119 GHG KB `id:` values are bare kebab-case slugs. The schema's plain reading is that relationship arrays should literally match `id` values. Prefix is not part of the id; therefore it should not appear in a relationship array entry.
- **Graph databases want node identity decoupled from type.** In [[weaviate]] (and Neo4j and any property-graph store), the canonical pattern is: nodes have a stable identifier and a class/label (`Source`, `Regulation`, `Concept`); edges have types (`REFERENCES`, `REQUIRES`); cross-references resolve identifier-to-identifier; the type info comes from the label, not the identifier string. Encoding type info redundantly in the identifier (`sources/california-lcfs-2025`) creates two sources of truth that can drift.
- **Refactor safety.** A page's `id` is permanent and folder-independent. If a page moves between folders (e.g., `methodologies/X` becomes `concepts/X`), the bare-slug references survive automatically. Prefixed references break silently.
- **Single source of truth.** Bare slugs match the `id` field exactly — no equality / normalization logic in the export script. Prefix requires either a stripping pass before export or a tolerant lookup that accepts both forms. Both are bug-prone.
- **The C-level wiki already adopted this.** The wiki integrity pass earlier the same day adopted bare-slug for YAML-validity reasons (`[[wikilink]], [[wikilink]]` is invalid YAML inline in a list). Adopting bare-slug across the GHG KB makes both knowledge stores composable and removes mental load — same pattern, same export script.
- **Body wikilinks are a separate concern.** `[[regulations/eu-taxonomy|EU Taxonomy]]` in markdown body text is an Obsidian reader-side convention (Obsidian uses the path as a navigation hint). The graph export only reads frontmatter relationship arrays. Different layers; both can use the convention that fits them best.

## Consequences

- The bare-slug rule is now locked in the GHG KB schema at `Terrascope\ghg-kb\CLAUDE.md` Frontmatter Schema section as a permanent rule with examples.
- The "Source ID prefix inconsistency" finding in `Terrascope\status.md` is flipped to Resolved with a sign-flip note — the original audit's framing is corrected.
- Future GHG KB ingest agents must follow the bare-slug rule for relationship arrays, regardless of any drift they encounter in older pages. Body wikilinks remain prefixed.
- The C-level wiki already follows this rule; no change needed there.
- The Weaviate export script (when written) can assume the simple equality `relationship_entry == target_page.id` with no prefix-stripping logic.
- ~80 entries across ~40 files normalized in this session; verification grep returned zero remaining prefixed entries in either block-style or flow-style YAML arrays.
- Two knowledge stores now share one schema convention — composability for any future combined export or cross-store query.

## Next

- ✅ Wiki-wide normalization completed this session (99 entries / 40 files).
- ✅ Schema clarification landed in `Terrascope\ghg-kb\CLAUDE.md`.
- ✅ Audit finding flipped in `Terrascope\status.md`.
- ✅ GHG KB log.md appended.
- 🔜 When the Weaviate export pipeline is built, validate that the equality assumption holds end-to-end (no implicit prefix-stripping anywhere).
- 🔜 If a future ingest agent ever drifts back to prefixed form (the failure mode that produced this conflict), the post-ingest lint should catch it via the same two greps used here.

## Discussion

The session that produced this decision is captured in [[2026-04-25-ghg-kb-inbox-clearing-session]] (synthesized meeting note) and [[2026-04-25-ghg-kb-inbox-clearing-and-bare-slug-decision-conv]] (raw conversation).
