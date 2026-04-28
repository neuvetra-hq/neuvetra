---
id: performance-standard-baseline
type: methodology
title: "Performance Standard Baseline Procedure"
aliases:
  - performance standard procedure
  - multi-project baseline
  - benchmark baseline
jurisdiction: Global
tags: [baseline, project-accounting, additionality, offsets, ghg-protocol, benchmark]
last_updated: 2026-04-25
source_count: 1
references:
  - ghg-protocol-project-accounting
---

## Overview

The performance standard baseline procedure is one of two methods defined in the GHG Protocol for Project Accounting for estimating baseline emissions. Rather than identifying a project-specific counterfactual scenario, it derives a **GHG emission rate benchmark** from a numerical analysis of all baseline candidates in the sector and geography. Any project activity that emits below this benchmark is credited for the difference.

Because the standard is derived from the full pool of comparable technologies or practices, it can be applied to multiple similar project activities without requiring a separate baseline analysis for each one. It is sometimes called a "multi-project baseline."

(→ [[sources/ghg-protocol-project-accounting|GHG Protocol for Project Accounting, Chapter 9]])

## When To Use

Prefer the performance standard procedure when:

- Multiple similar project activities are being implemented in the same geographic area (e.g., a program of small-scale renewable installations).
- Obtaining verifiable data on specific project alternatives is difficult, expensive, or contested.
- A GHG program or registry has already approved a performance standard for the relevant sector — it can then be reused without redevelopment.
- Reducing transaction costs across a portfolio of projects is a priority.

Consider the project-specific procedure instead when:
- The project is unique and no peer group of comparable facilities exists.
- Program rules require project-specific additionality demonstration.
- The analyst wants to demonstrate the specific counterfactual rather than rely on sector-wide benchmarks.

## Step-by-Step

**Step 1 — Define the GHG assessment boundary**
Same as for the project-specific procedure: identify project activities, primary effects, and significant secondary effects.

**Step 2 — Identify baseline candidates**
For the performance standard, baseline candidates are **all** individual plants, instances of a technology, or practices within the defined geographic area and temporal range that provide the same product or service. The list is more exhaustive than in the project-specific procedure.

**Step 3 — Collect activity and emissions data**
Gather emission rate data (e.g., tCO₂e per MWh, tCO₂e per tonne of product) for every baseline candidate. The GHG Protocol's sector-specific calculation tools can support this step.

**Step 4 — Derive the performance standard**
Calculate a GHG emission rate that represents the baseline candidates — typically a weighted average, weighted median, or a percentile of the distribution, depending on program rules. The standard is expressed as an emission rate, not a total.

Examples of typical performance standard metrics:
- Grid electricity generation: tCO₂e per MWh generated (grid emission factor)
- Industrial processes: tCO₂e per tonne of product
- Buildings: tCO₂e per m² floor area

**Step 5 — Estimate baseline emissions**
Apply the performance standard (emission rate) to the project activity's output level:

> Baseline Emissions = Performance Standard (emission rate) × Project Output

**Step 6 — Quantify GHG reductions**
> GHG Reductions = Baseline Emissions − Project Activity Emissions ± Secondary Effects

**Step 7 — Determine valid time length**
Define the period for which the performance standard remains valid. Because the standard is derived from a snapshot of market conditions, it must be updated periodically — typically every 3–10 years depending on how rapidly the sector is changing.

**Step 8 — Report**
Report the performance standard value, the dataset used to derive it, all baseline candidates included or excluded, and the rationale for the chosen aggregation method.

## Data Requirements

- Comprehensive list of all facilities/technologies in the defined sector and geography providing the same product or service
- Emission rate data for each baseline candidate (from facility reports, regulatory databases, engineering estimates)
- Clear definition of geographic area and temporal range, with justification
- Output data for the project activity (to apply the emission rate)
- Program or registry rules specifying which percentile or averaging method to apply

## Worked Example

A natural gas compressor station efficiency upgrade project is being credited under a regional GHG program (one of several similar projects). A performance standard is derived by collecting emission rate data (tCO₂e per unit of gas compressed) from all compressor stations in the region. The weighted average emission rate of the pool becomes the performance standard. The project's baseline emissions are estimated by multiplying this standard rate by the project's actual gas throughput. GHG reductions equal the difference between those baseline emissions and the project's actual emissions.

(→ [[sources/ghg-protocol-project-accounting|GHG Protocol for Project Accounting, Part III Example 2 — Compressor Station]])

## Limitations

- **Aggregation obscures project-level realities.** The standard is a sector-wide benchmark, not a true counterfactual for any individual project. Some credited projects may not be genuinely additional; some truly additional projects may not receive credit.
- **Data collection burden at program setup.** Deriving a credible performance standard requires comprehensive baseline candidate data, which can be costly to assemble. However, once built, it reduces per-project transaction costs significantly.
- **Requires periodic updating.** Technology and market conditions shift the distribution of baseline candidates over time. A stale performance standard over-credits as the sector improves.
- **Not suitable for unique projects.** If a project activity has no peer group of comparable technologies or practices, there is no meaningful pool from which to derive a standard.

## Related

- [[methodologies/project-specific-baseline|Project-Specific Baseline Procedure]]
- [[concepts/additionality|Additionality]]
- [[sources/ghg-protocol-project-accounting|GHG Protocol for Project Accounting]]
