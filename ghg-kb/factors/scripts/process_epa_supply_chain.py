"""
Process EPA Supply Chain GHG Emission Factors v1.3.0 -> scope3_spend_epa-scghg-v130.csv

Source: SupplyChainGHGEmissionFactors_v1.3.0_NAICS_CO2e_USD2022.csv
Covers: Scope 3 Category 1 spend-based factors for ~1,016 NAICS-6 commodities
Unit output: kg CO2e / USD2022 (purchaser price)
Tier: 1 (spend-based, least preferred but widely applicable)
"""

import pandas as pd
import re
import warnings
from pathlib import Path

warnings.filterwarnings("ignore")

RAW = Path(r"C:\Users\nimab\Neuvetra\raw\factors\epa-supply-chain\SupplyChainGHGEmissionFactors_v1.3.0_NAICS_CO2e_USD2022.csv")
OUT = Path(r"C:\Users\nimab\Neuvetra\factors\processed\scope3_spend_epa-scghg-v130.csv")

def slugify(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower().strip()).strip("-")

df = pd.read_csv(RAW)

# Expected columns:
# "2017 NAICS Code", "2017 NAICS Title", "GHG", "Unit",
# "Supply Chain Emission Factors without Margins",
# "Margins of Supply Chain Emission Factors",
# "Supply Chain Emission Factors with Margins",
# "Reference USEEIO Code"

records = []

for _, row in df.iterrows():
    naics_code  = str(int(row["2017 NAICS Code"])).zfill(6)
    naics_title = str(row["2017 NAICS Title"]).strip()
    ghg         = str(row["GHG"]).strip()
    unit_raw    = str(row["Unit"]).strip()

    # We take the with-margins factor as the recommended value
    value_with    = float(row["Supply Chain Emission Factors with Margins"])
    value_without = float(row["Supply Chain Emission Factors without Margins"])
    margin        = float(row["Margins of Supply Chain Emission Factors"])

    # Only process the "All GHGs" row (CO2e total)
    if ghg != "All GHGs":
        continue

    # Normalise unit to our convention: "kg CO2e / USD2022"
    unit = "kg CO2e / USD2022"

    factor_id = f"scope3-spend-naics{naics_code}-epa-scghg-v130"
    slug_title = slugify(naics_title)[:50]

    records.append({
        "factor_id": factor_id,
        "name": f"Scope 3 Cat 1 Spend-Based — NAICS {naics_code} {naics_title}",
        "factor_type": "scope3-spend",
        "scope": 3,
        "scope3_category": 1,
        "substance": f"naics-{naics_code}",
        "value": round(value_with, 6),
        "unit": unit,
        "co2_factor": "",
        "ch4_factor": "",
        "n2o_factor": "",
        "geography": "US-national",
        "jurisdiction": "US-Federal",
        "required_by": "{GHG-Protocol,SB-253}",
        "gwp_basis": "AR5",
        "tier": 1,
        "uncertainty_pct": round(margin / value_with * 100, 1) if value_with else "",
        "source_document": "EPA Supply Chain GHG Emission Factors v1.3.0",
        "source_url": "https://www.epa.gov/climateleadership/supply-chain-ghg-emission-factors-us-industry-and-commodities",
        "data_year": 2022,
        "published_date": "2024-01-01",
        "effective_start": "2024-01-01",
        "effective_end": "",
        "superseded_by": "",
        "wiki_method_page": "methodologies/scope-3-cat1-spend-based",
        "last_verified": "2026-04-24",
    })

OUT.parent.mkdir(parents=True, exist_ok=True)
pd.DataFrame(records).to_csv(OUT, index=False)
print(f"Wrote {len(records)} supply chain spend records -> {OUT}")
