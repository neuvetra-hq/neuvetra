---
id: healthcare-pharmaceuticals
type: sector
title: "Healthcare & Pharmaceuticals"
aliases:
  - healthcare
  - hospitals
  - pharmaceuticals
  - pharma
  - health systems
  - medical
  - life sciences
jurisdiction: Global
scope: [1, 2, 3]
business_size: any
tags: [healthcare, pharmaceuticals, hospitals, anesthetic-gases, medical-gases, scope-1, cold-chain, cat-1]
last_updated: 2026-04-24
source_count: 0
references:
  - sb253-ccdaa
  - sb261
  - csrd
  - esrs-e1
  - scope-1
  - scope-2
  - scope-3-categories
  - scope-2-location-based
  - scope-2-market-based
calculated_by:
  - scope-2-location-based
  - scope-2-market-based
---

## Profile

Healthcare and pharmaceuticals covers two distinct sub-sectors with overlapping but different GHG profiles:

**Hospitals and health systems:** Energy-intensive facilities operating 24/7, with HVAC requirements for sterile environments, operating theatres, and patient wards that cannot be compromised. The defining and most commonly overlooked Scope 1 source is **anesthetic and medical gases** — nitrous oxide (N2O, GWP 265) and volatile halogenated anesthetic agents such as desflurane (GWP ~2,500) and isoflurane (GWP ~510) are released directly to the atmosphere during surgical procedures. A busy surgical hospital can emit more CO2e from anesthetic gases than from its boilers.

**Pharmaceutical manufacturers:** Combine the energy intensity of manufacturing (process heat, cleanroom HVAC) with the chemical complexity of pharmaceutical synthesis (process solvents, reaction gases). Supply chain emissions — particularly Cat 1 from active pharmaceutical ingredient (API) sourcing and Cat 11 from inhaler propellants — can dominate large pharma companies' inventories.

Both sub-sectors share large, complex supply chains for consumables, devices, and pharmaceuticals, making Cat 1 a significant Scope 3 source.

## Applicable Regulations

**California:**
- **SB 253 (CCDAA):** Applies if annual revenue exceeds $1,000,000,000 and entity does business in California. Large hospital systems (Kaiser, Sutter, HCA), large pharmaceutical companies (many headquartered or operating in California), and major health insurers qualify. First Scope 1/2 disclosure due 2026-08-10. (→ [[regulations/sb253-ccdaa|SB 253]])
- **SB 261:** Applies if annual revenue exceeds $500,000,000. Physical climate risk (wildfire smoke affecting patient admissions, heat stress on vulnerable populations, supply chain disruption for drugs and devices) is highly material. (→ [[regulations/sb261|SB 261]])
- **CARB MRR:** Large hospital campuses or pharmaceutical manufacturing facilities with on-site boilers, cogeneration systems, or emergency generators may meet the 10,000 MT CO2e threshold. (→ [[regulations/carb-mrr|CARB MRR]])

**EU:**
- **CSRD / ESRS E1:** Applies to large pharmaceutical companies and hospital groups with EU operations or listings meeting CSRD thresholds. Pharmaceutical companies are significant users of solvents and process gases that attract regulatory scrutiny. Anesthetic gases (N2O, desflurane) are high-GWP Scope 1 sources expected to be material for hospital operators under the double materiality assessment. (→ [[regulations/csrd|CSRD]], [[regulations/esrs-e1|ESRS E1]])

## Typical Emission Sources

### Scope 1

| Source | Applicability | Notes |
|---|---|---|
| Natural gas — space heating and steam | Hospitals, pharmaceutical plants | HVAC, sterilization autoclaves, laundry, kitchens |
| **Anesthetic gases — N2O, desflurane, isoflurane** | Hospitals with surgical programs | High-GWP; often the largest single Scope 1 source at busy surgical hospitals; released via scavenging systems or directly to atmosphere |
| **Medical N2O (non-anesthetic)** | Hospitals, dental offices | Dental sedation, procedural sedation; same gas, same GWP; inventory separately |
| Refrigerants (HFCs) | Pharmaceutical cold storage, HVAC, lab equipment | Cold chain integrity is critical; leak detection is mandatory, not optional |
| Fleet — ambulances, medical transport | Hospitals, emergency services | Diesel or CNG |
| On-site generators (diesel) | Hospitals (critical backup), data centers | Required by code; tested regularly — include test-run fuel consumption |
| Biomedical waste incinerators | Some hospitals | Less common; replaced by autoclaving in most jurisdictions |
| Process solvents and reagents | Pharmaceutical manufacturing | Depending on process; may involve volatile organic compounds with GWP values |

**Anesthetic gas detail:** Desflurane, while being phased out in many countries due to its extreme GWP, is still in use in some US and EU facilities. A hospital performing 5,000 procedures per year using desflurane may emit the CO2e equivalent of hundreds of tonnes of CO2 from anesthesia alone. Tracking requires surgical records and gas consumption data from the anaesthesia machines.

### Scope 2

| Source | Notes |
|---|---|
| Electricity — 24/7 facility operations | Hospitals have among the highest electricity intensity of any building type; cannot reduce load during peak grid periods |
| Electricity — cleanroom HVAC (pharma) | Pharmaceutical manufacturing cleanrooms require constant pressurized filtered air regardless of production activity |
| Steam / district heating | Large hospital campuses often use steam loops; purchased steam is Scope 2 |

Dual reporting required. Healthcare systems are increasing REC and PPA purchasing to reduce market-based Scope 2. (→ [[methodologies/scope-2-location-based|Location-Based]], [[methodologies/scope-2-market-based|Market-Based]])

### Scope 3

| Category | Applicability | Materiality |
|---|---|---|
| **Cat 1** — Purchased pharmaceuticals, devices, consumables | Hospitals | **High** — single-use medical devices, pharmaceuticals, PPE, implants; embedded carbon from manufacture and logistics |
| **Cat 1** — Active pharmaceutical ingredients (APIs) | Pharma manufacturers | **High** — API synthesis, often outsourced to contract manufacturers in Asia; embedded solvent and energy use |
| **Cat 11** — Use of sold products | Pharma manufacturers selling inhalers | **High** — metered-dose inhalers (MDIs) use HFC propellants (HFA-134a, HFA-227ea); patient use releases HFCs directly; GWP 1,430–3,220 |
| **Cat 4** — Upstream transportation | Pharma supply chain | Medium — global API and finished goods logistics |
| **Cat 5** — Waste | Hospitals | Medium — biomedical waste treatment (off-site autoclaving, incineration); general clinical and domestic waste |
| **Cat 7** — Employee commuting | Large hospital workforces | Medium |
| **Cat 6** — Business travel | Pharmaceutical companies | Medium — medical conferences, sales, clinical trial site visits |

**MDI inhaler note (Cat 11):** For pharmaceutical companies that manufacture HFC-propellant inhalers, Cat 11 is often the largest single Scope 3 category. One standard 200-dose MDI inhaler releases approximately 10–26 kg CO2e over its life depending on propellant type. Global inhaler sales in the hundreds of millions translate to millions of tonnes of CO2e in Cat 11. Several manufacturers are transitioning to low-GWP propellants (HFA-152a, HFO-1234ze) to address this.

## Recommended Methodologies

| Emission source | Recommended method | Data needed |
|---|---|---|
| Natural gas — boilers, HVAC | Fuel consumption × combustion factor | Utility bills (therms or MMBtu) |
| Anesthetic gases — N2O | Gas consumption × GWP (265) | Surgical records; gas cylinder purchase and inventory records |
| Anesthetic gases — desflurane/isoflurane | Gas consumption × GWP (2,500 / 510) | Anaesthesia machine consumption logs; cylinder records |
| Refrigerants | Refrigerant tracking: purchases minus verified disposals | Maintenance logs; refrigerant purchase invoices |
| Scope 2 electricity | Dual: location-based + market-based | kWh bills; REC/PPA contracts |
| Cat 1 pharmaceuticals & devices | Spend-based (Tier 3) or supplier-specific EPDs where available | Purchase records by category; EEIO emission factors |
| Cat 11 MDI inhalers | Units sold × propellant charge per unit × propellant GWP | Sales volumes; product specifications (propellant type and fill weight) |
| Cat 5 biomedical waste | Waste tonnage × treatment-specific emission factor | Waste manifests; disposal contractor records |

## Filing Calendar

| Date | Obligation | Applies to |
|---|---|---|
| **2026-04-10** | CARB MRR annual report due | CA facilities ≥ 10,000 MT CO2e |
| **2026-08-10** | First SB 253 Scope 1/2 disclosure | Revenue > $1B, doing business in CA |
| **2026-09-10** | Annual SB 253/261 fee notice from CARB | All covered entities |
| **2027** (CARB schedule TBD) | First SB 253 Scope 3 disclosure | Revenue > $1B |
| **2026-01-01** | SB 261 first climate risk report | Revenue > $500M (enforcement suspended) |
| **FY2025 (reports due 2026)** | First CSRD / ESRS E1 disclosure | Large EU pharmaceutical companies and hospital groups with EU operations or listings |
| **FY2026 (reports due 2027)** | First CSRD / ESRS E1 disclosure | Listed SME healthcare operators |

## Sub-sectors

- **Hospital Systems & Integrated Delivery Networks** — anesthetic gases and building energy define the Scope 1 profile; Cat 1 supply chain (devices, drugs, consumables) is the dominant Scope 3 source
- **Pharmaceutical Manufacturers** — process chemistry, cleanroom energy, cold chain; Cat 11 MDI inhalers can be the single largest source for inhaler producers
- **Biotechnology** — similar to pharma but with more cell culture and fermentation (electricity-intensive); early-stage companies typically below SB 253 thresholds
- **Medical Device Manufacturers** — manufacturing Scope 1/2; product use (powered devices) creates Cat 11 exposure; complex global supply chains
- **Dental Practices & Clinics** — N2O from sedation; refrigerants; small footprint; far below mandatory reporting thresholds
- **Pharmaceutical Distributors** — cold chain logistics (refrigerant Scope 1, Scope 3 Cat 4 transport) dominate inventory

## Related

- [[concepts/scope-1|Scope 1 — Direct GHG Emissions]]
- [[concepts/scope-2|Scope 2 — Electricity Indirect GHG Emissions]]
- [[concepts/scope-3-categories|Scope 3 Categories]] — Cat 1, Cat 5, Cat 11 most material
- [[methodologies/scope-2-location-based|Scope 2 Location-Based Method]]
- [[methodologies/scope-2-market-based|Scope 2 Market-Based Method]]
- [[regulations/sb253-ccdaa|California SB 253 — CCDAA]]
- [[regulations/sb261|California SB 261 — Climate-Related Financial Risk Disclosure]]
- [[regulations/csrd|EU CSRD]] — EU mandatory sustainability reporting
- [[regulations/esrs-e1|ESRS E1 — Climate Change]] — GHG disclosure standard under CSRD; anesthetic gases are material Scope 1 for hospitals
