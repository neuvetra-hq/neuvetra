# GHG Wiki Knowledge Base — Design Spec

**Date:** 2026-04-24
**Status:** Approved

---

## Purpose

A persistent, LLM-maintained wiki knowledge base for Greenhouse Gas (GHG) emissions accounting and reporting. Serves as the source of truth for a future commercial chatbot application that helps businesses of all sizes calculate and report their Scope 1, 2, and 3 emissions under EU and California regulations.

The wiki is not the end product. It is the curated, validated source of truth that will be exported to a graph database (Neo4j or Weaviate) and vector store (Pinecone or Weaviate) to power a production SaaS chatbot. Every structural decision in this design serves that migration path.

---

## Domain & Scope

**Primary jurisdictions (current):**
- EU: CSRD, ESRS E1, EU ETS Phase 4, EU Taxonomy
- California: SB 253, SB 261, CARB MRR, AB 32

**Frameworks:**
- GHG Protocol Corporate Standard
- GHG Protocol Scope 3 Standard
- ISO 14064

**Expansion-ready (future):**
- US Federal: SEC climate disclosure rules, EPA GHGRP
- Voluntary: TCFD, ISSB/IFRS S2, CDP, SBTi
- Other jurisdictions: UK, Canada, Australia

**GHG Scopes:** 1, 2, and 3 (all 15 Scope 3 categories)

**Chatbot audience:** Both sustainability professionals (technical depth) and business owners (plain language). Adaptive depth based on how the question is framed.

**Chatbot mode:** Full stack — guidance/Q&A and emissions calculation methodology.

---

## Architecture — Three Layers

### Layer 1: Raw Sources (`raw/`)

Immutable source documents. The LLM reads but never modifies these files. The `raw/` root acts as an **inbox** — files dropped here are unclassified. The LLM classifies and moves them to the correct subfolder on ingest.

```
raw/
├── [inbox]         # Files dropped here — unclassified, process first
├── standards/      # GHG Protocol, ISO 14064, IPCC guidelines
├── regulations/    # CSRD, ESRS E1, SB 253, SB 261, CARB MRR
├── guidance/       # Technical guidance, Q&As, worked examples
├── reports/        # NGO/research publications, sector reports
└── assets/         # Downloaded images referenced by wiki pages
```

### Layer 2: Wiki (`wiki/`)

LLM-maintained markdown knowledge base. Six page types plus four special files.

```
wiki/
├── concepts/       # Core GHG definitions, theory, scope categories
├── regulations/    # Jurisdiction-specific requirements
├── methodologies/  # Calculation procedures and approaches
├── sectors/        # Business-type guides
├── organizations/  # Key bodies: GHG Protocol, CARB, EU Commission, etc.
├── index.md        # Master catalog — LLM reads this first on every query
├── log.md          # Append-only chronological operation record
├── overview.md     # Evolving high-level synthesis of the knowledge base
└── calendar.md     # Master regulatory deadline timeline
```

### Layer 3: Schema (`CLAUDE.md`)

The operating schema that tells the LLM how to maintain the wiki — workflows, page conventions, writing rules, and graph export notes.

---

## Page Types

| Type | Folder | Purpose |
|---|---|---|
| `concept` | wiki/concepts/ | Core GHG definitions, theory, scope categories |
| `regulation` | wiki/regulations/ | Jurisdiction-specific requirements |
| `methodology` | wiki/methodologies/ | Calculation procedures |
| `sector` | wiki/sectors/ | Business-type guides |
| `organization` | wiki/organizations/ | Key bodies and standard-setters |
| `source` | Relevant subfolder | Summary of a raw source document |

---

## Frontmatter Schema

Every wiki page carries structured YAML frontmatter. Fields map directly to graph database node properties and vector store metadata filters.

```yaml
---
id: kebab-case-stable-slug          # REQUIRED — graph node identifier, never changes
type: concept                        # REQUIRED — see Page Types
title: ""                            # REQUIRED — full human-readable title
aliases: []                          # Alternate names the chatbot should recognize
jurisdiction: EU | California | US-Federal | Global | N/A
scope: [1, 2, 3]                    # GHG scopes this applies to
business_size: SME | large | any    # For regulations and sectors
tags: []                             # e.g. [csrd, scope-2, electricity, manufacturing]
effective_date: YYYY-MM-DD
last_updated: YYYY-MM-DD
source_count: 0
# Typed relationships — become named graph edges on export
requires: []        # IDs this mandates (REQUIRES edge)
references: []      # IDs this cites (REFERENCES edge)
supersedes: []      # IDs this replaces (SUPERSEDES edge)
applies_to: []      # Sector IDs this regulation covers (APPLIES_TO edge)
calculated_by: []   # Methodology IDs used to calculate this (CALCULATED_BY edge)
parent: ""          # Parent page ID for hierarchies (CHILD_OF edge)
---
```

The `id` field is the graph node identifier. It is set once on page creation and never changed, even if the page is renamed.

---

## Page Heading Structures

Consistent heading structure per page type enables reliable semantic chunking for vector embeddings.

| Type | Sections (in order) |
|---|---|
| **Concept** | Definition → Why It Matters → Key Distinctions → Calculation Notes → Regulatory References → Related |
| **Regulation** | Overview → Who Must Comply → Reporting Requirements → Deadlines → Penalties → Calculation Requirements → Related |
| **Methodology** | Overview → When To Use → Step-by-Step → Data Requirements → Worked Example → Limitations → Related |
| **Sector** | Profile → Applicable Regulations → Typical Emission Sources (Scope 1 / Scope 2 / Scope 3) → Recommended Methodologies → Filing Calendar → Sub-sectors → Related |
| **Organization** | Overview → Role in GHG Ecosystem → Key Publications → Related |
| **Source** | Metadata → Key Takeaways → What This Updated in the Wiki → Raw File Link |

---

## Workflows

### Ingest
**Trigger:** User says "new file in raw, process it"

1. Scan `raw/` root for unclassified files
2. Read each file — determine type (standards / regulations / guidance / reports / assets)
3. Move to correct `raw/` subfolder
4. Discuss key takeaways with user (3–5 most important points; what changes or confirms existing knowledge)
5. Write a Source summary page
6. Update all relevant wiki pages across concepts, regulations, methodologies, sectors:
   - Update content, increment `source_count`, update `last_updated`
   - Flag contradictions with existing content explicitly
   - Create new pages for concepts/regulations not yet covered
7. Update `wiki/index.md`
8. Update `wiki/calendar.md` — add or revise any deadlines
9. Update `wiki/overview.md` if the source materially changes the synthesis
10. Append to `wiki/log.md`

### Query
**Trigger:** Any question from the user

1. Read `wiki/index.md` to find relevant pages
2. Read the relevant pages
3. Synthesize a cited answer — adaptive depth (plain language or technical)
4. Offer to file valuable answers back into the wiki
5. Append to `wiki/log.md`

### Lint
**Trigger:** "Run a wiki health check"

1. Check for contradictions between pages
2. Flag stale claims superseded by newer sources
3. Find orphan pages (no inbound links)
4. Identify concepts mentioned but lacking their own page
5. Check for broken relationship IDs
6. Find regulations with no calendar entries
7. Produce a report with specific page IDs and fixes
8. Append to `wiki/log.md`

---

## Graph DB Migration Path

The wiki is designed for direct export to Neo4j or Weaviate.

**Recommended target:** Weaviate — native graph + vector in one store, best fit for this use case.

**Export pipeline:**
```
wiki/ markdown files
  → Python export script
  → Parse frontmatter → nodes (id + properties) + typed edges
  → Split content by headings → embed each section
  → Upsert to Weaviate (or Neo4j + Pinecone)
```

**Edge type mapping:**

| Frontmatter field | Graph relationship | Direction |
|---|---|---|
| `requires` | `REQUIRES` | this → target |
| `references` | `REFERENCES` | this → target |
| `supersedes` | `SUPERSEDES` | this → target |
| `applies_to` | `APPLIES_TO` | this → target |
| `calculated_by` | `CALCULATED_BY` | this → target |
| `parent` | `CHILD_OF` | this → target |

**Production chatbot query pattern:**
- Graph traversal for structured queries: *"What regulations apply to a California manufacturer with >$1B revenue for Scope 3?"*
- Vector search for semantic queries: *"How do I account for upstream transportation emissions?"*

---

## Key Constraints

- Numerical emission factors are **not** stored in the wiki — they belong in an external database
- `raw/` files are **immutable** — the LLM reads but never modifies them
- `log.md` is **append-only** — existing entries are never edited
- Page `id` fields are **permanent** — never changed after creation
- All cross-references use the stable `id` field, not file paths
