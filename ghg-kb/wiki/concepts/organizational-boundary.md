---
id: organizational-boundary
type: concept
title: "Organizational Boundary"
aliases:
  - organizational boundary
  - company boundary
  - inventory boundary (organizational)
jurisdiction: Global
scope: [1, 2, 3]
business_size: any
tags: [boundary, organizational-boundary, consolidation, equity-share, financial-control, operational-control]
last_updated: 2026-04-25
source_count: 2
references:
  - ghg-protocol-corporate-standard
  - efrag-ig2-value-chain-2024
  - esrs-1
  - esrs-e1
calculated_by:
  - equity-share-approach
  - financial-control-approach
  - operational-control-approach
---

## Definition

The organizational boundary defines **which operations, subsidiaries, joint ventures, and facilities are included in a company's GHG inventory**. It answers the question: whose emissions does this inventory account for?

Business structures are complex — wholly owned subsidiaries, joint ventures, minority shareholdings, operated assets, leased facilities — and the organizational boundary determines how each of these is treated. The GHG Protocol Corporate Standard provides three approaches for setting this boundary.

(→ [[sources/ghg-protocol-corporate-standard|GHG Protocol Corporate Standard, Chapter 3]])

## Why It Matters

Two companies looking at the same joint venture may each draw their boundary differently — and both can be "correct" under the standard. The choice of approach materially changes the total emissions reported and affects comparability between companies. Selecting and consistently applying an approach is a prerequisite for a verifiable inventory.

Regulators increasingly specify which approach they require — for example, the EU ETS requires operational control for covered installations.

## Key Distinctions

**Three approaches for setting the organizational boundary:**

| Approach | Rule | What gets consolidated |
|---|---|---|
| **Equity share** | Consolidate emissions proportional to ownership stake | 30% share → 30% of that operation's emissions |
| **Financial control** | Consolidate 100% of emissions from operations the company has financial control over | Full consolidation if company directs financial and operating policies |
| **Operational control** | Consolidate 100% of emissions from operations the company operates (has full authority to introduce and implement operating policies) | Full consolidation of operated assets; zero for non-operated |

**Revised edition change:** The first edition required companies to report under both equity and one control approach. The revised edition allows reporting under a **single approach** — reflecting that not all companies need both types of information.

**Organizational boundary vs. operational boundary:** These are distinct. The organizational boundary defines *which entities* are in scope. The [[concepts/operational-boundary|operational boundary]] then defines *which emission sources* within those entities are Scope 1, 2, or 3.

**Joint ventures — a key complexity:**
- Under equity share: each partner accounts for their proportional share
- Under financial control: only the controlling partner includes 100%; non-controlling partners exclude it
- Under operational control: only the operator includes 100%; non-operators exclude it

**Minimum equity threshold removed:** The revised edition removed the minimum equity threshold for reporting purposes, enabling emissions to be reported even at small ownership stakes where they are significant.

### ESRS reporting boundary (CSRD reporters)

For CSRD sustainability reporting, the **reporting undertaking is the same parent + subsidiary group as the financial statements** — i.e. the **financial-control consolidation perimeter**. This is the *floor* of own-operations reporting. Two important nuances clarified by EFRAG IG 2 (§2.3, ¶34–57):

1. **Value chain extends *beyond* the consolidation perimeter.** Material IROs in business relationships outside the consolidated group (upstream suppliers, downstream customers, end-of-life paths, associates / JVs not financially controlled) must be assessed and reported where material. See [[methodologies/double-materiality-assessment|Double Materiality Assessment]].

2. **Operational control is a *separate* environmental-disclosure trigger, not the reporting boundary.** Under ESRS E1 ¶50(b), the undertaking must additionally disclose 100% of GHG / pollution / biodiversity-impacting activity from sites or entities under operational control (regardless of equity), as a *separate line item* alongside the consolidated financial-control figures. Operational control does **not** apply to social standards (S1–S4) — see [[concepts/operational-boundary|Operational Boundary]] for detail.

(→ [[sources/efrag-ig2-value-chain-2024|EFRAG IG 2 — Value Chain (May 2024)]])

## Calculation Notes

The organizational boundary is a policy decision, not a calculation. Once set:
1. Apply the chosen approach consistently across all entities
2. Document the treatment of each subsidiary, JV, and operated asset
3. Reapply the same approach in every reporting period (consistency principle)
4. If the approach changes, disclose and justify — this may require base year recalculation

## Regulatory References

- **GHG Protocol Corporate Standard (Revised)** — Chapter 3, pp. 16–23
- **EU ETS** — requires operational control approach for covered installations
- **ESRS E1** — reporting boundary = financial-control consolidation perimeter (same as financial statements); operational control triggers a *separate* additional disclosure (E1 ¶50(b))
- **EFRAG IG 2 — Value Chain (May 2024)** — operationalises the financial-control vs operational-control distinction for ESRS reporters with the Seren Group worked example

## Related

- [[concepts/operational-boundary|Operational Boundary]]
- [[methodologies/equity-share-approach|Equity Share Approach]]
- [[methodologies/financial-control-approach|Financial Control Approach]]
- [[methodologies/operational-control-approach|Operational Control Approach]]
- [[methodologies/double-materiality-assessment|Double Materiality Assessment]] — ESRS reporting-boundary mechanics
- [[regulations/esrs-1|ESRS 1]] — Chapter 5 value-chain rules
- [[regulations/esrs-e1|ESRS E1]] — ¶50(a) consolidated GHG vs ¶50(b) operational-control disclosure
- [[concepts/ghg-accounting-principles|GHG Accounting and Reporting Principles]]
