---
id: professional-services
type: sector
title: "Professional Services"
aliases:
  - professional services
  - consulting
  - law firms
  - accounting firms
  - audit firms
  - management consulting
  - engineering firms
  - advisory
  - staffing
jurisdiction: Global
scope: [1, 2, 3]
business_size: any
tags: [professional-services, consulting, business-travel, cat-6, cat-7, scope-2, office-based]
last_updated: 2026-04-24
source_count: 1
references:
  - sb253-ccdaa
  - sb261
  - csrd
  - esrs-e1
  - scope-2
  - scope-3-categories
  - scope-2-location-based
  - scope-2-market-based
calculated_by:
  - scope-2-location-based
  - scope-2-market-based
---

## Profile

Law firms, management consultants, accounting and audit firms, engineering and design firms, marketing agencies, staffing companies, and financial advisors share a common GHG profile: they are almost entirely **Scope 2 and Scope 3** businesses with minimal Scope 1.

The professional services firm has no manufacturing, no fleet, no refrigeration units, and typically no direct control of the building it occupies. Its carbon footprint is almost entirely:
1. **Scope 2:** Office electricity (and sometimes natural gas for building HVAC, if the firm controls its own systems — rare in leased corporate space)
2. **Scope 3 Cat 6:** Business travel — flights, hotels, ground transport for client engagements, firm events, partner meetings, international travel
3. **Scope 3 Cat 7:** Employee commuting — office-based workforces commuting by train, car, bus, or walking

For large consulting firms with heavy project travel requirements, Cat 6 business travel can easily represent 80–90% of the entire inventory, dwarfing all other categories combined. This makes business travel data quality the single most important variable in a professional services GHG inventory.

The sector also includes firms that lease significant office space across multiple locations. Cat 8 (upstream leased assets) may appear in inventories where the firm leases office space and the landlord provides utilities under a gross lease structure — in that case, the building energy falls in the firm's Scope 3 Cat 8 rather than Scope 2.

**COVID and hybrid work:** The shift to hybrid and remote work post-2020 has significantly reduced both commuting (Cat 7) and some business travel (Cat 6) while potentially increasing home office energy use (Cat 7 or Cat 1 depending on boundary decisions). Firms building inventories for 2024–2026 should account for hybrid work patterns in commuting surveys.

## Applicable Regulations

**California:**
- **SB 253 (CCDAA):** Applies if annual revenue exceeds $1,000,000,000 and entity does business in California. Big Four accounting firms (Deloitte, PwC, EY, KPMG), major management consulting firms (McKinsey, BCG, Bain), large law firms with California offices, and large engineering firms may qualify. Many mid-size professional services firms remain below threshold. First Scope 1/2 disclosure due 2026-08-10. (→ [[regulations/sb253-ccdaa|SB 253]])
- **SB 261:** Applies if annual revenue exceeds $500,000,000. Physical climate risk is less directly material than for asset-heavy sectors, but transition risk (client demand shifts, stranded skills) and reputational risk are relevant. (→ [[regulations/sb261|SB 261]])

**EU:**
- **CSRD / ESRS E1:** Applies to large professional services firms with EU operations or listings meeting CSRD thresholds. The Big Four, most major law firms, and large consulting firms have significant EU revenues and headcount. Business travel (Scope 3 Cat 6) is expected to be the dominant material emission source for most in-scope professional services firms. (→ [[regulations/csrd|CSRD]], [[regulations/esrs-e1|ESRS E1]])

## Typical Emission Sources

### Scope 1

Scope 1 is typically minimal for professional services firms. Common sources are limited to:

| Source | Applicability | Notes |
|---|---|---|
| Natural gas — office HVAC | Only if the firm directly operates building systems | Rare in leased corporate office space; typically the landlord's obligation |
| Company car fleet | Some firms maintain cars for senior partners or field staff | Uncommon in pure advisory firms; more common in engineering and site-based consulting |
| Refrigerants | Only if the firm manages its own HVAC and kitchen equipment | Unusual; most leased offices include HVAC in the service charge |

Most professional services firms will report **zero or near-zero Scope 1.** Where a firm occupies owned premises and controls its own HVAC, natural gas and refrigerants become relevant.

### Scope 2

| Source | Notes |
|---|---|
| Office electricity | The primary Scope 2 source; relatively modest in absolute terms per employee compared to industrial or healthcare settings |
| Data center electricity | Relevant for firms running significant in-house IT infrastructure; most firms have migrated to cloud (making this Cat 1 cloud services) |

Dual reporting required. Large firms increasingly hold RECs or green tariff contracts for near-zero market-based Scope 2. (→ [[methodologies/scope-2-location-based|Location-Based]], [[methodologies/scope-2-market-based|Market-Based]])

### Scope 3

| Category | Applicability | Materiality |
|---|---|---|
| **Cat 6** — Business travel | All firms with project travel, client meetings, or firm events | **Dominant** — flights, hotels, ground transport; can be 80–90% of total inventory for consulting and advisory firms |
| **Cat 7** — Employee commuting | All office-based firms | **High** — large office workforces; commuting mode (car vs. public transit) drives variability |
| **Cat 1** — Purchased goods & services | IT equipment (laptops, phones, servers), office supplies | Medium — laptop lifecycle emissions are the primary Cat 1 item |
| **Cat 8** — Upstream leased assets | Firms in gross-lease office space where landlord provides utilities | Medium — building energy use appears here rather than Scope 2 where the firm does not directly procure electricity |
| **Cat 6 / Cat 3** — Cloud computing | Firms using cloud services | Low–medium — upstream emissions from cloud data center energy; typically reported as Cat 1 (purchased services) |

**Cat 6 business travel detail:** Air travel drives most Cat 6 emissions. Key variables:
- **Flight class:** Business class and first class have 2–3× the per-passenger emission factor of economy, reflecting their greater share of aircraft capacity.
- **Radiative forcing index (RFI):** High-altitude aviation emissions (contrails, NOx) may exert non-CO2 climate effects. The GHG Protocol includes an optional RFI multiplier; it is not required under SB 253 but some firms disclose it voluntarily. Standard GHG inventories count only CO2 from aviation fuel combustion.
- **Hotel stays:** Accommodation emissions are part of Cat 6 business travel; typically calculated using spend-based or nights × per-night emission factor approaches.

**Cat 7 employee commuting detail:** Mode share (car, train, bus, cycling, walking) is the key driver. A firm where employees predominantly drive to suburban campuses will have Cat 7 emissions 3–5× higher per employee than a firm in a dense urban center where employees walk or use transit. Commuting surveys are the recommended data source — distance and mode by employee or employee cohort. (→ [[sources/ghg-protocol-scope-3-calc-guidance|Scope 3 Calculation Guidance]])

## Recommended Methodologies

| Emission source | Recommended method | Data needed |
|---|---|---|
| Scope 2 electricity | Dual: location-based + market-based | kWh bills by office location; REC/green tariff contracts |
| Cat 6 business travel — flights | Distance-based: great-circle distance × cabin class × emission factor (DEFRA or ICAO) | Flight records (origin, destination, cabin class) from corporate travel management system |
| Cat 6 business travel — rail | Distance-based: km × rail mode emission factor | Rail booking records |
| Cat 6 business travel — hotels | Nights × per-night emission factor by region | Hotel booking records |
| Cat 6 business travel — rental cars | Fuel consumption or distance × vehicle class emission factor | Rental records |
| Cat 7 employee commuting | Survey-based: employee distance × mode share × transport mode emission factor | Annual commuting survey; employee home locations (aggregated) |
| Cat 1 IT equipment | Physical quantity × device emission factor | Device procurement records (units and model) |
| Cat 8 upstream leased assets | Building energy use × grid emission factor | Landlord energy disclosure; EPC ratings; CBRE/JLL portfolio data |

**Travel system integration:** Most large firms use corporate travel management platforms (Amex GBT, CWT, BCD Travel) that can provide segment-level flight and hotel data. These platforms increasingly offer integrated carbon calculators — verify that they use published emission factors (DEFRA, ICAO) rather than proprietary factors before using their outputs as inventory inputs.

**Spend-based vs. distance-based for travel:** Spend-based methods (cost of travel × spend-based emission factor) are available from Tier 3 calculation approaches but produce low-quality estimates — travel costs vary widely by route, class, and booking timing independent of actual emissions. Always use distance-based methods for Cat 6 where segment data is available.

## Filing Calendar

| Date | Obligation | Applies to |
|---|---|---|
| **2026-08-10** | First SB 253 Scope 1/2 disclosure | Revenue > $1B, doing business in CA |
| **2026-09-10** | Annual SB 253/261 fee notice from CARB | All covered entities |
| **2027** (CARB schedule TBD) | First SB 253 Scope 3 disclosure | Revenue > $1B |
| **2026-01-01** | SB 261 first climate risk report | Revenue > $500M (enforcement suspended) |
| **FY2025 (reports due 2026)** | First CSRD / ESRS E1 disclosure | Large EU professional services firms with EU operations or listings |
| **FY2026 (reports due 2027)** | First CSRD / ESRS E1 disclosure | Listed SME professional services firms |

## Sub-sectors

- **Management Consulting** — highest Cat 6 intensity per employee of any sub-sector; intensive project travel is fundamental to the business model; Cat 6 typically 70–90% of total inventory
- **Audit & Accounting (Big Four and Mid-Market)** — high travel to client sites; Cat 6 plus Cat 7 from large office workforces; SB 253 compliance clients create indirect disclosure pressure
- **Law Firms** — moderate travel; litigation partners and deal teams drive Cat 6; most large law firms are below SB 253 threshold on revenue
- **Engineering & Technical Consulting** — field-based site visits add to Cat 6; equipment procurement for projects may create Cat 1 exposure depending on organizational boundary
- **Marketing & Creative Agencies** — lowest travel intensity of the sub-sectors; Cat 7 commuting and office Scope 2 are primary sources; typically below SB 253 thresholds
- **Staffing & Recruitment** — asset-light; commuting (Cat 7 for placed workers) is a boundary question — most firms exclude placed workers from organizational boundary; own-employee Cat 7 and Cat 6 dominate

## Related

- [[concepts/scope-2|Scope 2 — Electricity Indirect GHG Emissions]]
- [[concepts/scope-3-categories|Scope 3 Categories]] — Cat 6 and Cat 7 are the defining categories for this sector
- [[methodologies/scope-2-location-based|Scope 2 Location-Based Method]]
- [[methodologies/scope-2-market-based|Scope 2 Market-Based Method]]
- [[regulations/sb253-ccdaa|California SB 253 — CCDAA]]
- [[regulations/sb261|California SB 261 — Climate-Related Financial Risk Disclosure]]
- [[regulations/csrd|EU CSRD]] — EU mandatory sustainability reporting
- [[regulations/esrs-e1|ESRS E1 — Climate Change]] — GHG disclosure standard under CSRD; Cat 6 business travel expected to be the dominant material emission
