---
id: project-specific-baseline
type: methodology
title: "Project-Specific Baseline Procedure"
aliases:
  - project-specific procedure
  - scenario-specific baseline
jurisdiction: Global
tags: [baseline, project-accounting, additionality, offsets, ghg-protocol]
last_updated: 2026-04-25
source_count: 1
references:
  - ghg-protocol-project-accounting
---

## Overview

The project-specific baseline procedure is one of two methods defined in the GHG Protocol for Project Accounting for estimating baseline emissions from a project activity. It produces an estimate of what GHG emissions *would have occurred* had the project not been implemented, by identifying a **baseline scenario** specific to the circumstances of the individual project.

The baseline scenario is the activity or set of activities that would most plausibly have occurred in the project's absence — not a historical average, not a regulatory minimum, but the realistic counterfactual.

(→ [[sources/ghg-protocol-project-accounting|GHG Protocol for Project Accounting, Chapter 8]])

## When To Use

Prefer the project-specific procedure when:

- The project activity is unique enough that no established performance standard exists for its sector and geography.
- Verifiable data on the project's specific alternatives (baseline candidates) are available.
- The project developer needs to demonstrate additionality for a single, specific project rather than a portfolio.
- Program rules require a project-specific demonstration (e.g., some CDM methodologies, California ARB offset protocols).

Consider the performance standard procedure instead when:
- Many similar projects are being implemented simultaneously and developing a project-specific baseline for each is cost-prohibitive.
- Verifiable data on alternatives is scarce or contested.

## Step-by-Step

**Step 1 — Define the GHG assessment boundary**
Identify all project activities within the GHG project. For each activity, identify primary effects (direct GHG changes caused by the project) and significant secondary effects (upstream/downstream GHG changes triggered by the project).

**Step 2 — Identify baseline candidates**
List all alternative technologies or practices within a defined geographic area and temporal range that could provide the same product or service as the project activity. Candidates include existing plants, recently built plants, under-construction plants, and planned future installations. Start with a 5-year lookback; expand if needed to capture relevant trends.

**Step 3 — Perform a comparative assessment of barriers**
For each baseline candidate and the project activity itself, identify barriers to implementation:
- Technological barriers (unproven technology, lack of local expertise)
- Financial/economic barriers (high upfront cost, low financial returns)
- Institutional/regulatory barriers (missing policies, unclear permitting)
- Social/cultural barriers (lack of awareness, opposition)

Rank candidates by cumulative barrier significance. The alternative with the fewest barriers (most likely to have occurred without the project) is the baseline scenario candidate.

**Step 4 — Identify the baseline scenario**
Select the baseline scenario as the alternative that would most plausibly have occurred without the project, using one of three paths:
1. *Barrier analysis result* — the alternative with lowest cumulative barriers
2. *Most conservative viable alternative* — if barrier analysis is inconclusive, use the alternative with the lowest GHG emissions (most conservative for crediting purposes)
3. *Net benefits assessment* — if the project faces no significant barriers, identify the scenario with the greatest net benefits (revenues minus costs) to decision-makers

**Step 5 — Estimate baseline emissions**
Using the identified baseline scenario, calculate its GHG emissions with assumptions, emission factors, and activity data specific to that scenario. Baseline emissions are only valid for the project activity being examined.

**Step 6 — Quantify GHG reductions**
> GHG Reductions = Baseline Emissions − Project Activity Emissions ± Secondary Effects

Apply the same GHG assessment boundary to both sides of the equation.

**Step 7 — Determine valid time length**
Specify the period for which the baseline scenario remains valid. After this period, either no further reductions are credited or the baseline is revised. Time length depends on technology stability and regulatory context.

**Step 8 — Report**
Report GHG reductions transparently, including: the GHG assessment boundary, all baseline candidates considered, the identified baseline scenario, all assumptions and emission factors used, and how secondary effects were treated.

## Data Requirements

- Activity data for the project (energy input, production output, fuel type and quantity)
- Activity data or estimates for each baseline candidate
- Emission factors for all relevant GHG sources in the baseline scenario
- Documentation of barriers and their relative significance for each alternative
- Geographic and temporal scope definition and justification
- Financial data if a net benefits assessment is used (optional but strengthens credibility)

## Worked Example

A cement plant installs a waste heat recovery system that reduces fossil fuel consumption (the project activity). Baseline candidates include: (a) continuing to operate the existing boiler at current efficiency, (b) replacing the boiler with a modern gas-fired boiler, (c) purchasing grid electricity to supplement heat. A barrier analysis finds that option (b) faces high capital cost barriers and regulatory uncertainty; option (c) is constrained by grid reliability. Option (a) — continuing current operations — faces no barriers and is identified as the baseline scenario. Baseline emissions are estimated from the existing boiler's fuel consumption and applicable emission factors. The project's GHG reductions equal baseline emissions minus the reduced fuel consumption under the new system.

(→ [[sources/ghg-protocol-project-accounting|GHG Protocol for Project Accounting, Part III Example 1 — Cement Sector]])

## Limitations

- **Subjectivity in barrier analysis.** The identification and ranking of barriers requires judgement. Different analysts may reach different baseline scenarios from the same data, creating verification challenges.
- **Risk of gaming.** Project developers may be motivated to identify a high-emissions baseline scenario to maximize credited reductions. Third-party verification of the barrier analysis is important.
- **Valid period uncertainty.** Technology and market conditions change. A baseline scenario identified today may not reflect what would have happened five years later, creating a risk of over-crediting over long project lifetimes.
- **Not suitable for portfolios.** Because the baseline is project-specific, the procedure cannot efficiently be applied to many similar small-scale projects.

## Related

- [[methodologies/performance-standard-baseline|Performance Standard Baseline Procedure]]
- [[concepts/additionality|Additionality]]
- [[sources/ghg-protocol-project-accounting|GHG Protocol for Project Accounting]]
