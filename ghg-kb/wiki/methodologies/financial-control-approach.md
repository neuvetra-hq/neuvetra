---
id: financial-control-approach
type: methodology
title: "Financial Control Approach"
aliases:
  - financial control
  - financial control method
  - financial consolidation
jurisdiction: Global
scope: [1, 2, 3]
business_size: any
tags: [organizational-boundary, consolidation, financial-control, joint-venture, subsidiaries]
last_updated: 2026-04-25
source_count: 1
references:
  - ghg-protocol-corporate-standard
---

## Overview

The financial control approach is one of three methods for setting an organizational boundary under the GHG Protocol Corporate Standard. Under this approach, a company **consolidates 100% of GHG emissions from operations over which it has financial control** — defined as the ability to direct the financial and operating policies of an operation with a view to gaining economic benefits from its activities.

If the company has financial control, it accounts for 100% regardless of its equity stake. If it lacks financial control (e.g., a minority non-controlling interest), it accounts for 0%.

(→ [[sources/ghg-protocol-corporate-standard|GHG Protocol Corporate Standard, Chapter 3]])

## When To Use

- When the company's GHG reporting is intended to align with its **financial consolidated statements** (consistent with how assets and liabilities are consolidated for accounting purposes)
- When the company has financial control over operations in which it holds less than 100% equity
- When a reporting program or regulation requires financial control consolidation
- When the company wants a view consistent with its overall business risk management (financial exposure = GHG exposure)

## Step-by-Step

1. **Identify all operations** within the corporate group.

2. **Assess financial control** for each operation:
   - Does the company direct financial and operating policies?
   - Does the company benefit economically from the operation?
   - Is the operation consolidated in the company's financial statements?

3. **Consolidate 100%** of Scope 1 and Scope 2 emissions for all financially controlled operations.

4. **Exclude entirely** (0%) any operation where the company lacks financial control.

5. **Sum** all consolidated emissions for the group total.

6. **Apply consistently** year over year. Acquisitions and disposals require base year recalculation.

## Data Requirements

- Financial consolidation scope from the audited financial statements
- Clarity on which entities are fully consolidated vs. equity-accounted vs. excluded
- Scope 1 and Scope 2 emissions data for all consolidated entities
- Documentation of control determination for joint ventures and associates

## Worked Example

Company B wholly owns Plant X (financially controlled), has a 50% stake in JV Y with shared control (financially controlled — it directs the JV's operating policies), and a 25% non-controlling interest in Facility Z.

| Operation | Financial Control? | Total Emissions (tCO₂e) | Company B's Share |
|---|---|---|---|
| Plant X | Yes (100%) | 10,000 | 10,000 |
| JV Y | Yes (directs policies) | 8,000 | 8,000 |
| Facility Z | No (minority) | 6,000 | 0 |
| **Total** | | | **18,000** |

Note: Compare with equity share (15,500 tCO₂e) — financial control produces a higher total here because JV Y is 100% consolidated.

## Limitations

- **100% consolidation despite partial ownership:** The company reports 100% of a 50%-owned JV, which may overstate its proportional economic interest in those emissions.
- **Complexity for mixed-control structures:** Determining financial control for complex JV governance arrangements can require legal analysis.
- **Misalignment with operational responsibility:** Financial control does not always equal operational responsibility — an operator under contract may run the facility day-to-day.

## Related

- [[concepts/organizational-boundary|Organizational Boundary]]
- [[methodologies/equity-share-approach|Equity Share Approach]]
- [[methodologies/operational-control-approach|Operational Control Approach]]
