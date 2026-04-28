---
id: additionality
type: concept
title: "Additionality"
aliases:
  - additional
  - additionality test
  - additional reductions
jurisdiction: Global
tags: [additionality, offsets, baseline, project-accounting, carbon-credits, cdm]
last_updated: 2026-04-25
source_count: 1
references:
  - ghg-protocol-project-accounting
parent: ""
---

## Definition

Additionality is the criterion that GHG reductions from a project should only be recognized if the project activity would not have occurred "anyway" — i.e., the project activity differs from what would have happened in the absence of climate-change motivation or a GHG program incentive. A project is **additional** if its GHG reductions are genuinely caused by the project, not by business-as-usual forces.

More precisely: a project activity is additional when it differs from its **baseline scenario** — the activities or conditions that would have existed had the GHG project not been implemented.

(→ [[sources/ghg-protocol-project-accounting|GHG Protocol for Project Accounting, Chapters 2 and 3]])

## Why It Matters

Additionality is central to the integrity of any system that awards offset credits for project-based GHG reductions:

- If a project "would have happened anyway" and receives offset credits, the credit allows covered emitters to emit more while uncapped emissions remain unchanged — a net *increase* in atmospheric GHGs.
- Additionality distinguishes genuine climate action from the crediting of ordinary business decisions.
- Weak additionality rules are the primary source of criticism against voluntary carbon offset markets and CDM.

For regulated compliance markets (EU ETS, California cap-and-trade), additionality requirements are typically set by the program rules. For voluntary markets, they are set by the applicable standard (e.g., Verra VCS, Gold Standard).

## Key Distinctions

**Additionality ≠ emissions reduction relative to history.** A project may reduce emissions compared to a company's historical levels while still being non-additional — if the reduction would have happened due to regulatory requirements, economic incentives, or technology trends.

**Two approaches to establishing additionality:**

### Project-specific approach
Identifies a distinct baseline scenario for the specific project through a structured analysis of barriers and alternatives. If the project activity differs from the identified baseline scenario, it is additional. Subjectivity risk: the quality of the analysis depends on the analyst.

### Performance standard approach
Avoids project-specific determination by using a benchmark (performance standard) derived from all baseline candidates in the sector. Projects that outperform the benchmark are treated as collectively additional. Reduces individual subjectivity but may credit some non-additional projects and deny credits to some truly additional ones.

**GHG Protocol treatment:** The Project Protocol does not mandate an explicit additionality test. Instead, additionality is incorporated implicitly into the two baseline procedures — estimating what the baseline scenario would have been effectively settles whether the project is additional.

**CDM treatment:** The Kyoto Protocol's Clean Development Mechanism requires an explicit additionality demonstration, typically using a step-by-step tool that includes regulatory surplus, common practice, and investment analysis tests.

## Calculation Notes

Additionality is not itself a calculation — it is a determination that shapes which baseline to use. Once the baseline scenario is established (via either the project-specific or performance standard procedure), GHG reductions are calculated as:

> GHG Reductions = Baseline Emissions − Project Activity Emissions ± Secondary Effects

Additionality enters the calculation by determining the baseline emissions value. A wrongly specified baseline directly inflates or deflates the credited reduction.

## Regulatory References

- **GHG Protocol for Project Accounting** — Chapters 2 (concept), 3 (policy dimensions), 8 and 9 (embedded in baseline procedures)
- **Kyoto Protocol CDM** — requires explicit additionality test; most CDM methodologies use the UNFCCC additionality tool
- **ISO 14064-2** — includes requirements for additionality demonstration for project-level accounting
- **California ARB Offset Protocols** — each protocol specifies its own additionality requirements, generally requiring regulatory surplus and financial additionality

## Related

- [[methodologies/project-specific-baseline|Project-Specific Baseline Procedure]]
- [[methodologies/performance-standard-baseline|Performance Standard Baseline Procedure]]
- [[sources/ghg-protocol-project-accounting|GHG Protocol for Project Accounting]]
- [[concepts/ghg-accounting-principles|GHG Accounting and Reporting Principles]]
