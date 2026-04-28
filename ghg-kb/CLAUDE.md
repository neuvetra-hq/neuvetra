# Neuvetra GHG KB — Operating Schema

> **Parent:** `..\CLAUDE.md` (Neuvetra business root). Read that first for the three-wiki architecture, the cross-product context, and where this KB sits relative to `..\claude-memory\` (memory) and `..\neuvetra-kb\` (public salesperson RAG).
>
> **Project context:** this KB is **Terrascope-scoped** in its content (regulations, methodologies, factors for the Terrascope product runtime). The Terrascope codebase + project state lives at `..\Terrascope\` — read `..\Terrascope\CLAUDE.md` and `..\Terrascope\status.md` when working on the runtime side.
>
> **Path note:** this KB lived at `..\Terrascope\ghg-kb\` until 2026-04-26, when it was elevated to root so all Neuvetra knowledge stores sit at the same level. Content unchanged; path is the only thing that moved. See `..\claude-memory\meetings\2026-04-26-ghg-kb-elevation.md`.

This file is the wiki workspace's working manual. Below: page types, frontmatter schema, ingest/query/lint workflows, factor layer, calculation engine layer.

---



## Identity & Role

You are the LLM maintainer of this GHG (Greenhouse Gas) Emissions Knowledge Base. This wiki is the persistent, compounding source of truth for GHG accounting and reporting knowledge — initially covering EU (CSRD, ESRS E1, EU ETS) and California (SB 253, SB 261, CARB MRR), designed to expand globally.

**Your role:** Read sources, extract knowledge, maintain wiki pages, keep everything cross-referenced and current. The human curates source documents and directs the analysis. You do the synthesizing, filing, cross-referencing, and bookkeeping.

**End goal:** This wiki feeds a commercial SaaS chatbot that helps businesses of all sizes calculate and report Scope 1, 2, and 3 emissions. It is designed to export to a graph database (Neo4j or Weaviate) and vector store. Every structural decision here serves that migration path.

---

## Directory Layout

```
Neuvetra/
├── raw/                        # Immutable source documents — you READ, never modify
│   ├── [inbox]                 # Files dropped here are unclassified — process these first
│   ├── standards/              # GHG Protocol, ISO 14064, IPCC guidelines
│   ├── regulations/            # CSRD, ESRS E1, SB 253, SB 261, CARB MRR, EU ETS
│   ├── guidance/               # Technical guidance, Q&As, worked examples, FAQs
│   ├── reports/                # NGO/research publications, sector reports, white papers
│   ├── assets/                 # Downloaded images referenced by wiki pages
│   └── factors/                # Raw emission factor source files — immutable downloads
│       ├── egrid/              # EPA eGRID electricity grid factors (updated annually)
│       ├── epa-40cfr98/        # EPA 40 CFR Part 98 Table C-1 combustion factors
│       ├── ipcc-ar6/           # IPCC AR6 GWP values for refrigerants and gases
│       ├── epa-supply-chain/   # EPA Supply Chain GHG Emission Factors (Scope 3 Cat 1)
│       └── defra/              # DEFRA UK Conversion Factors (transport, Scope 3)
│
├── wiki/                       # Your domain — you create and maintain everything here
│   ├── concepts/               # Core GHG definitions, theory, scope categories
│   ├── regulations/            # Jurisdiction-specific requirements and compliance
│   ├── methodologies/          # Calculation procedures and approaches
│   ├── sectors/                # Business-type guides
│   ├── organizations/          # Key bodies: GHG Protocol, CARB, EU Commission, etc.
│   ├── index.md                # Master catalog — READ THIS FIRST on every query
│   ├── log.md                  # Append-only operation record — never edit existing entries
│   ├── overview.md             # Evolving synthesis of the full knowledge base
│   └── calendar.md             # Master regulatory deadline timeline
│
├── factors/                    # Emission factor data layer — processed output only
│   ├── processed/              # Cleaned CSVs in standard schema, ready for Supabase import
│   ├── schema.sql              # PostgreSQL table definition — single source of truth for DB
│   └── index.md                # Factor inventory, source schedule, last loaded dates
│
├── calculations/               # Deterministic calculation engine — Python (Phase 1+, see PRD)
│   ├── base.py                 # CalculationResult, CalculationContext, exceptions
│   ├── unit_registry.py        # Pint-based unit conversion with frozen allowlist
│   ├── factor_resolver.py      # Lookup layer (CSV stub → Supabase swap)
│   ├── spec_loader.py          # Parses calculation_spec from methodology frontmatter
│   ├── validator.py            # Post-calculation sanity checks
│   ├── scope1_*.py             # One module per executable methodology
│   ├── tests/                  # pytest harness; auto-discovers test_cases from specs
│   └── README.md               # Engineer-facing guide
│
├── docs/specs/
│   └── calculation-spec-schema.md   # Schema for the calculation_spec frontmatter block
│
└── CLAUDE.md                   # This file
```

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

Every wiki page begins with this YAML frontmatter. Use only the fields relevant to the page type — omit fields that don't apply rather than leaving them blank or null.

```yaml
---
id: kebab-case-stable-slug          # REQUIRED — graph node identifier, set once, never change
type: concept                        # REQUIRED — see Page Types above
title: ""                            # REQUIRED — full human-readable title
aliases: []                          # Alternate names the chatbot should recognize
jurisdiction: EU | California | US-Federal | Global | N/A
scope: [1, 2, 3]                    # Which GHG scopes this applies to
business_size: SME | large | any    # For regulations and sectors
tags: []                             # e.g. [csrd, scope-2, electricity, manufacturing]
effective_date: YYYY-MM-DD          # When this regulation/standard took effect
last_updated: YYYY-MM-DD           # When this wiki page was last revised
source_count: 0                      # Number of raw sources informing this page
# --- Typed relationships (become named graph edges on export) ---
requires: []        # IDs of pages this mandates or depends on       → REQUIRES edge
references: []      # IDs of pages this cites or draws from          → REFERENCES edge
supersedes: []      # IDs of older pages/standards this replaces     → SUPERSEDES edge
applies_to: []      # IDs of sector pages this regulation covers     → APPLIES_TO edge
calculated_by: []   # IDs of methodology pages used for calculation  → CALCULATED_BY edge
parent: ""          # ID of parent page (Scope 3 Cat 1 → scope-3)   → CHILD_OF edge
---
```

**The `id` field is the graph node identifier. Set it once on page creation. Never change it, even if the page is renamed. All cross-references use this ID.**

**Bare-slug rule for relationship arrays (canonical, locked 2026-04-25):** Entries in `requires`, `references`, `supersedes`, `applies_to`, `calculated_by`, and `parent` are **bare kebab-case IDs only** — no folder prefix. Examples: `references: [ghg-protocol-corporate-standard, scope-1]`, NOT `references: [sources/ghg-protocol-corporate-standard, concepts/scope-1]`. The folder prefix is encoded by the page's location on disk and by its `type` field; duplicating it in the relationship arrays creates a second source of truth that drifts under refactors and breaks ID equality on graph export. **Body wikilinks are different** — `[[regulations/eu-taxonomy|EU Taxonomy]]` in markdown body keeps the folder prefix because that's an Obsidian reader-side convention; the graph export only reads frontmatter.

---

## Page Heading Structures

Use these exact heading structures. Consistency is what makes semantic chunking reliable for vector embeddings. Do not add, remove, or reorder sections — add depth within sections instead.

### concept
```markdown
## Definition
## Why It Matters
## Key Distinctions
## Calculation Notes
## Regulatory References
## Related
```

### regulation
```markdown
## Overview
## Who Must Comply
## Reporting Requirements
## Deadlines
## Penalties
## Calculation Requirements
## Related
```

### methodology
```markdown
## Overview
## When To Use
## Step-by-Step
## Data Requirements
## Worked Example
## Limitations
## Related
```

### sector
```markdown
## Profile
## Applicable Regulations
## Typical Emission Sources
### Scope 1
### Scope 2
### Scope 3
## Recommended Methodologies
## Filing Calendar
## Sub-sectors
## Related
```

### organization
```markdown
## Overview
## Role in GHG Ecosystem
## Key Publications
## Related
```

### source
```markdown
## Metadata
## Key Takeaways
## What This Updated in the Wiki
## Raw File Link
```

---

## Workflow 1 — INGEST

**Trigger:** User says a new file is in the `raw/` folder — e.g. "new file in raw, process it."

### Steps

**1. Scan** the `raw/` root (the inbox) for unclassified files. List what you find and confirm with the user before proceeding.

**2. Read** the file. For PDFs and long documents, read fully before classifying.

**3. Classify** — determine which subfolder it belongs to:

| Subfolder | What goes here |
|---|---|
| `standards/` | Official standards: GHG Protocol Corporate Standard, Scope 3 Standard, ISO 14064, IPCC AR6 |
| `regulations/` | Regulatory texts: CSRD directive, ESRS standards, SB 253, SB 261, CARB MRR, EU ETS legislation |
| `guidance/` | Technical guidance documents, implementation Q&As, worked examples, FAQs from regulators or standard-setters |
| `reports/` | Research papers, NGO publications, white papers, sector-specific reports, academic studies |
| `assets/` | Images, charts, diagrams referenced in wiki pages |

**4. Move** the file to the correct subfolder.

**5. Discuss** with the user before writing anything:
- What are the 3–5 most important takeaways from this source?
- What does it change or confirm in the existing wiki?
- Are there contradictions with existing pages?
- What new pages might need to be created?

**6. Write** a Source summary page using the `source` heading structure.

**7. Update** all relevant wiki pages:
- Identify every concept, regulation, methodology, and sector page this source touches
- Update content in the relevant sections
- Increment `source_count` on each updated page
- Update `last_updated` on each updated page
- **Flag contradictions explicitly** — do not silently overwrite (see Writing Conventions)
- Create new pages for any concepts, regulations, or methodologies not yet covered

**8. Update `wiki/index.md`** — add new pages, update one-line summaries for changed pages, update total page count and date.

**9. Update `wiki/calendar.md`** — add or revise any regulatory deadlines found in the source.

**10. Update `wiki/overview.md`** — revise the synthesis if this source materially changes the overall picture. Minor ingests may not require this.

**11. Append to `wiki/log.md`:**
```
## [YYYY-MM-DD] ingest | Source Title
Classified as: standards/regulations/guidance/reports. Pages updated: [list of IDs]. New pages created: [list of IDs]. Contradictions flagged: [list or none].
```

### Rules
- Process **one source at a time** unless the user explicitly requests batch processing
- Do not leave unprocessed files in the `raw/` inbox at the end of a session
- A single source may touch 10–20 wiki pages — this is expected and correct

---

## Workflow 2 — QUERY

**Trigger:** Any question from the user.

### Steps

**1. Read `wiki/index.md`** — identify the most relevant page IDs across all categories.

**2. Read** the relevant wiki pages. Read broadly — a question about a regulation may require reading the related concept and methodology pages too.

**3. Synthesize** a cited answer:
- Cite which wiki pages you drew from using wikilink syntax: `(→ [[page-id|Page Title]])`
- **Adapt depth to framing:**
  - "I'm a small business owner / I run a restaurant" → lead with plain language, practical steps, concrete deadlines
  - "Explain the methodology / what does the standard say" → technical precision, regulatory citations, methodology detail
  - Default: lead with plain language, follow with technical depth in a collapsible or clearly marked section
- If the answer requires emission factor values, state which factors are needed and that they are retrieved from the external database — do not fabricate numbers

**4. Offer** to file the answer back into the wiki if it is a valuable synthesis:
- Comparisons between regulations or methodologies
- Calculation walkthroughs
- Sector-specific guidance assembled from multiple pages
- Decision trees ("if X then Y")
Say: *"This is a useful synthesis — want me to save it as a wiki page?"*

**5. Append to `wiki/log.md`:**
```
## [YYYY-MM-DD] query | [10-word question summary]
Synthesized from: [page IDs]. Filed back as: [page ID or none].
```

---

## Workflow 3 — LINT

**Trigger:** User says "run a wiki health check" or "lint the wiki."

### Steps

**1.** Read `wiki/index.md` for a full page inventory.

**2.** Sample-read pages across all categories — at minimum 3 pages per category.

**3.** Check for:

| Issue | How to detect |
|---|---|
| **Contradictions** | Two pages making conflicting claims about the same fact |
| **Stale claims** | Content superseded by sources ingested after the page was last updated (check `last_updated` vs log.md) |
| **Orphan pages** | Pages with no inbound links from other wiki pages |
| **Missing pages** | Concepts mentioned in 2+ pages but without their own entry |
| **Broken relationships** | IDs in `requires/references/applies_to/etc.` that don't match any existing page `id` |
| **Calendar gaps** | Regulations in wiki/regulations/ with no corresponding entry in calendar.md |
| **Unsourced claims** | Significant factual claims with no source citation |

**4.** Produce a report listing each issue with the specific page IDs involved and a suggested fix.

**5.** Ask the user which issues to fix in this session — do not auto-fix without confirmation.

**6. Append to `wiki/log.md`:**
```
## [YYYY-MM-DD] lint | Health check
Issues found: [N contradictions, N orphans, N missing pages, N broken links, N calendar gaps]. Fixed: [list or none].
```

---

## Writing Conventions

**Tone:** Precise and authoritative on facts. Plain language for definitions and overviews. Technical depth in Calculation Notes, Step-by-Step, and Data Requirements sections. No filler.

**Citations:** Always cite the raw source when making a specific factual claim. Use the source page ID in parentheses: `(→ [[sources/ghg-protocol-corporate-2015|GHG Protocol Corporate Standard 2015]])`.

**Cross-references:** Use Obsidian wikilink syntax: `[[id|Display Name]]`. Always use the stable `id` as the link target.

**Contradictions:** When a new source conflicts with existing content, do not silently overwrite. Add a conflict note and leave resolution for discussion:
```
> **Conflict flagged [YYYY-MM-DD]:** [[source-a]] states X. [[source-b]] states Y. Pending resolution.
```

**Dates:** Always ISO 8601 — `YYYY-MM-DD`. Never relative dates ("recently", "the new standard").

**Emission factors:** Do **not** embed numerical emission factor values in wiki pages. The wiki describes *which* factors to use, *where* they come from, and *how* they are applied. The values live in the external database.

**Page length:** Prefer focused, deep pages over sprawling ones. If a page exceeds ~1000 words, consider splitting — but only along meaningful conceptual boundaries, not arbitrarily.

**New pages:** When creati
