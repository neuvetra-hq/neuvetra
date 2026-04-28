---
id: operational-control-approach
type: methodology
title: "Operational Control Approach"
aliases:
  - operational control
  - operational control method
  - operator approach
jurisdiction: Global
scope: [1, 2, 3]
business_size: any
tags: [organizational-boundary, consolidation, operational-control, operator, joint-venture]
last_updated: 2026-04-25
source_count: 1
references:
  - ghg-protocol-corporate-standard
---

## Overview

The operational control approach is one of three methods for setting an organizational boundary under the GHG Protocol Corporate Standard. Under this approach, a company **consolidates 100% of GHG emissions from operations over which it has operational control** — defined as the full authority to introduce and implement its operating policies at that operation.

If the company operates the facility (i.e., can set and enforce operating procedures, HSE standards, energy management practices), it accounts for 100% of emissions. If it has an equity interest but does not operate, it accounts for 0%.

(→ [[sources/ghg-protocol-corporate-standard|GHG Protocol Corporate Standard, Chapter 3]])

## When To Use

- When the company manages GHG performance primarily through **operational decisions** (fuel switching, energy efficiency, process changes)
- When the company is an **operator or contractor** for assets it does not fully own
- When required by regulation — the **EU ETS** requires operational control for covered installations
- When the company has minority equity stakes in operations it does not run, and wants to exclude those from its inventory
- Most common approach in practice for industrial companies

## Step-by-Step

1. **Identify all operations** within the group and any third-party assets the company operates.

2. **Assess operational control** for each:
   - Does the company have full authority to introduce and implement operating policies?
   - Can the company set energy management, HSE, and process standards?
   - Is the company the named operator under the relevant permits/licenses?

3. **Consolidate 100%** of Scope 1 and Scope 2 emissions for all operationally controlled facilities.

4. **Exclude entirely** (0%) any facility the company does not operate — even if it has a significant equity stake.

5. **Include third-party operated assets at 0%** — their emissions may appear in Scope 3 instead.

6. **Sum** all 100% figures for the inventory total.

## Data Requirements

- Operator-of-record documentation (permits, licenses, operating agreements)
- Clear definition of what constitutes "full authority to implement operating policies" for each JV
- Scope 1 and Scope 2 data for all operated facilities
- Documentation of non-operated equity interests (may be reported as Scope 3 upstream investments)

## Worked Example

Company C wholly owns and operates Plant X, operates JV Y (as named operator under a 50/50 JV agreement), and holds a 25% passive interest in Facility Z (operated by another party).

| Operation | Operational Control? | Total Emissions (tCO₂e) | Company C's Share |
|---|---|---|---|
| Plant X | Yes | 10,000 | 10,000 |
| JV Y | Yes (named operator) | 8,000 | 8,000 |
| Facility Z | No (passive interest) | 6,000 | 0 |
| **Total** | | | **18,000** |

Note: In this example, operational control produces the same result as financial control because the JV control structure is the same. Results diverge when financial and operational control are held by different parties.

## Limitations

- **100% for operated non-owned assets:** A company operating a facility it barely owns consolidates all emissions — potentially misaligning reported emissions with economic interest.
- **Misses non-operated equity:** Emissions from significant minority stakes in non-operated assets are excluded from Scope 1/2 (though they can be reported in Scope 3).
- **Contract operator complexity:** If a company operates under a management contract with limited policy authority, establishing "full authority" requires careful analysis.

## Related

- [[concepts/organizational-boundary|Organizational Boundary]]
- [[methodologies/equity-share-approach|Equity Share Approach]]
- [[methodologies/financial-control-approach|Financial Control Approach]]
