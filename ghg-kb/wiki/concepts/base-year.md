---
id: base-year
type: concept
title: "Base Year"
aliases:
  - base year
  - baseline year
  - reference year
  - GHG base year
jurisdiction: Global
scope: [1, 2, 3]
business_size: any
tags: [base-year, tracking, time-series, recalculation, targets, consistency]
last_updated: 2026-04-25
source_count: 1
references:
  - ghg-protocol-corporate-standard
---

## Definition

A **base year** is a specific historical year (or multi-year average) against which a company's GHG emissions are tracked over time. It serves as the fixed reference point for measuring progress toward reduction targets and assessing performance trends.

The base year is set when a company first develops its GHG inventory and should remain fixed — the consistency principle requires that it be recalculated (not simply changed) when significant structural changes occur.

(→ [[sources/ghg-protocol-corporate-standard|GHG Protocol Corporate Standard, Chapter 5]])

## Why It Matters

Without a consistent base year, emissions changes caused by acquisitions, divestitures, or methodology updates cannot be distinguished from genuine operational performance improvements. A robust base year approach is also a prerequisite for:
- Setting credible GHG reduction targets
- Participating in emissions trading schemes
- Receiving credit for early voluntary action under future regulations

California specifically noted it would use best efforts to ensure companies that register emissions with the California Climate Action Registry receive recognition under future regulatory programs — contingent on having a credible historical record.

## Key Distinctions

**Fixed base year vs. rolling base year:**
- *Fixed base year* (GHG Protocol default): The reference year stays constant; current-year emissions are compared to that fixed point.
- *Rolling base year*: The reference shifts each year. Not recommended for corporate inventories — makes trend analysis and target tracking unreliable.

**Base year recalculation triggers:** The base year must be recalculated (retroactively restated) when structural or methodological changes would otherwise produce a misleading comparison. Required triggers include:

| Trigger | Example |
|---|---|
| Acquisitions | Company buys a manufacturer; its historical emissions must be added to base year |
| Divestitures | Company sells a facility; its emissions are removed from base year retroactively |
| Outsourcing/insourcing | A previously in-house process is outsourced; Scope 1 becomes Scope 3 |
| Methodology changes | Switching emission factors or calculation methods |
| Discovery of errors | Significant miscalculation in prior years |

**Recalculation threshold:** Companies should set a significance threshold for recalculation — changes below the threshold may not require restatement. This threshold must be disclosed.

**Revised edition change:** The recommendation of pro-rata adjustments was deleted from Chapter 5 of the revised edition to avoid the need for two simultaneous adjustments.

**Multi-year base period:** Some programs use a multi-year average (e.g., 3 years) as the base to smooth out anomalous years. This is permissible under the GHG Protocol but must be documented.

## Calculation Notes

Base year recalculation preserves the comparability of the time series:

> **Restated base year emissions = original base year + emissions from acquired operations (for that base year period) − emissions from divested operations**

This allows current-year performance to be compared against a like-for-like reference, isolating genuine operational reductions from structural changes.

## Regulatory References

- **GHG Protocol Corporate Standard (Revised)** — Chapter 5, pp. 34–39
- **ESRS E1** — requires multi-year comparative data; base year recalculation expected on material structural changes
- **SBTi** — science-based targets require a fixed base year and documented recalculation policy

## Related

- [[concepts/ghg-accounting-principles|GHG Accounting and Reporting Principles]]
- [[concepts/organizational-boundary|Organizational Boundary]]
- [[concepts/operational-boundary|Operational Boundary]]
