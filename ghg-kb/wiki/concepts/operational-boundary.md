---
id: operational-boundary
type: concept
title: "Operational Boundary"
aliases:
  - operational boundary
  - scope boundary
  - inventory boundary (operational)
jurisdiction: Global
scope: [1, 2, 3]
business_size: any
tags: [boundary, operational-boundary, scope-1, scope-2, scope-3, direct-emissions, indirect-emissions]
last_updated: 2026-04-25
source_count: 2
references:
  - ghg-protocol-corporate-standard
  - efrag-ig2-value-chain-2024
  - esrs-e1
---

## Definition

The operational boundary defines **which emission sources, within the organizational boundary, are classified as Scope 1, Scope 2, or Scope 3**. It is set at the corporate level after the organizational boundary is established, then applied uniformly across all operations and facilities.

Together, the organizational boundary and the operational boundary constitute the company's **inventory boundary** — the complete perimeter of what is measured and reported.

(→ [[sources/ghg-protocol-corporate-standard|GHG Protocol Corporate Standard, Chapter 4]])

## Why It Matters

The operational boundary determines the completeness and comparability of a GHG inventory. Two companies in the same industry with the same facilities can report very different totals if they draw operational boundaries differently — particularly around Scope 3, which is vast and complex.

Establishing a clear, documented operational boundary is also necessary for verification: verifiers need to know which sources should be in the inventory and confirm that none are missing.

## Key Distinctions

**Three scopes, three levels of obligation:**

| Scope | Category | Mandatory under GHG Protocol? |
|---|---|---|
| Scope 1 | Direct emissions from owned/controlled sources | Yes |
| Scope 2 | Indirect from purchased electricity (and heat/steam) | Yes |
| Scope 3 | All other indirect (value chain) | Optional (under base standard) |

**Operational boundary vs. organizational boundary:** The organizational boundary answers *whose* operations are included. The operational boundary answers *which emission sources* within those operations are measured and at which scope.

**Setting the operational boundary involves:**
1. Identifying all emission sources within the organizational boundary
2. Categorizing each as Scope 1, 2, or 3
3. Deciding which Scope 3 categories to include (optional under base standard)
4. Documenting exclusions and justifications

**Scope 3 boundary decisions:** Because Scope 3 is optional and spans the entire value chain, companies must decide which categories are material and relevant. Once included, those categories should be reported consistently over time.

### Operational control as a separate ESRS environmental-disclosure trigger

Under ESRS E1 (Climate Change), E2 (Pollution), and E4 (Biodiversity), the undertaking must disclose **two distinct boundaries** for environmental metrics:

| ESRS E1 ¶ | What is reported | Boundary |
|---|---|---|
| **¶50(a)** | Consolidated Scope 1 / 2 / 3 GHG emissions | Financial-control consolidation perimeter (same as financial statements) |
| **¶50(b)** | 100% Scope 1 / 2 from operationally-controlled sites and entities — separate line item | Operational control (regardless of equity / financial control) |

This means the undertaking may report **two different totals for the same period** — one consolidated, one operational — and the difference (e.g. 50% of a joint operation, an associate where the undertaking directs operating activities) is informational, not a discrepancy. The two boundaries are **not netted**. EFRAG IG 2 §2.3 (¶34–57) provides a decision tree and the Seren Group worked example walking through the mechanics for subsidiaries, joint operations, joint ventures, and associates.

**Operational control does NOT apply to social standards (ESRS S1–S4).** Social DRs follow contractual / stakeholder relationships, not the operational-control test. Per IG 2 ¶60–61.

(→ [[sources/efrag-ig2-value-chain-2024|EFRAG IG 2 — Value Chain (May 2024)]])

## Calculation Notes

The operational boundary is a governance decision — it does not produce emissions numbers itself. It structures the calculation work:
- Every Scope 1 source within the organizational boundary needs an emission factor and activity data
- Scope 2 requires purchased electricity metering and a grid emission factor
- Each Scope 3 category requires its own activity data and methodology

## Regulatory References

- **GHG Protocol Corporate Standard (Revised)** — Chapter 4, pp. 24–33
- **ESRS E1** — requires Scope 1 and 2 (mandatory) and Scope 3 (required for large companies); ¶50(a) consolidated + ¶50(b) operational-control separate disclosure
- **EFRAG IG 2 — Value Chain (May 2024)** — operationalises ESRS E1 ¶50(b) with decision tree and Seren Group worked example
- **SB 253** — requires all three scopes for covered California companies

## Related

- [[concepts/scope-1|Scope 1 — Direct GHG Emissions]]
- [[concepts/scope-2|Scope 2 — Electricity Indirect GHG Emissions]]
- [[concepts/scope-3|Scope 3 — Other Indirect GHG Emissions]]
- [[concepts/organizational-boundary|Organizational Boundary]]
- [[regulations/esrs-e1|ESRS E1]] — ¶50(a) consolidated GHG and ¶50(b) operational-control separate disclosure
- [[methodologies/double-materiality-assessment|Double Materiality Assessment]] — boundary mechanics for ESRS reporting
- [[concepts/ghg-accounting-principles|GHG Accounting and Reporting Principles]]
