"""
Process DEFRA UK GHG Conversion Factors 2024 -> scope3_transport_defra-2024.csv

Source: ghg-conversion-factors-2024-FlatFormat_v1_1.xlsx, sheet "Factors by Category"
Covers: Business travel (air/land/sea), freight, passenger vehicles — Scope 3 Cat 4/6/7/9
Unit output: varies (kg CO2e / passenger.km, tonne.km, vehicle.km, etc.)
"""

import pandas as pd
import re
import warnings
from pathlib import Path

warnings.filterwarnings("ignore")

RAW = Path(r"C:\Users\nimab\Neuvetra\raw\factors\defra\ghg-conversion-factors-2024-FlatFormat_v1_1.xlsx")
OUT = Path(r"C:\Users\nimab\Neuvetra\factors\processed\scope3_transport_defra-2024.csv")

df = pd.read_excel(RAW, sheet_name="Factors by Category", header=5)

# Columns: ID, Scope, Level 1, Level 2, Level 3, Level 4, Column Text, UOM, GHG/Unit, GHG Conversion Factor 2024
df.columns = ["id", "scope_raw", "level1", "level2", "level3", "level4", "col_text", "uom", "ghg_unit", "value"]

# Keep only rows where:
# 1. ghg_unit == "kg CO2e"  (total CO2e, not per-gas breakdown)
# 2. value is numeric
# 3. level1 is in transport/travel categories
TRANSPORT_CATEGORIES = {
    "Business travel- air",
    "Business travel- land",
    "Business travel- sea",
    "Freighting goods",
    "Passenger vehicles",
    "Delivery vehicles",
}

df = df[df["ghg_unit"] == "kg CO2e"]
df = df[df["level1"].isin(TRANSPORT_CATEGORIES)]
df = df[pd.to_numeric(df["value"], errors="coerce").notna()]
df["value"] = pd.to_numeric(df["value"])

# Scope 3 category mapping
CATEGORY_MAP = {
    "Business travel- air": 6,
    "Business travel- land": 6,
    "Business travel- sea": 6,
    "Freighting goods": 4,
    "Passenger vehicles": 7,
    "Delivery vehicles": 4,
}

def slugify(s: str) -> str:
    s = re.sub(r"\s+", " ", str(s)).strip().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")[:60]

def build_substance(row) -> str:
    parts = [p for p in [row["level2"], row["level3"], row["level4"], row["col_text"]] if pd.notna(p) and str(p).strip()]
    return " — ".join(str(p).strip() for p in parts)

records = []
seen_ids = set()

for _, row in df.iterrows():
    level1 = str(row["level1"]).strip()
    substance = build_substance(row)
    slug = slugify(substance or level1)
    factor_id = f"scope3-transport-{slugify(level1)}-{slug}-defra-2024"

    # Truncate if too long
    if len(factor_id) > 100:
        factor_id = factor_id[:100]

    # Avoid duplicates (deduplication on factor_id)
    if factor_id in seen_ids:
        # Append short hash to disambiguate
        factor_id = factor_id[:95] + f"-{len(seen_ids) % 1000:03d}"
    seen_ids.add(factor_id)

    scope3_cat = CATEGORY_MAP.get(level1, "")
    uom = str(row["uom"]).strip() if pd.notna(row["uom"]) else ""
    unit = f"kg CO2e / {uom}" if uom else "kg CO2e"

    # Scope: Scope 3 for all these transport categories
    scope = 3

    records.append({
        "factor_id": factor_id,
        "name": f"{level1} — {substance} (DEFRA 2024)",
        "factor_type": "scope3-distance",
        "scope": scope,
        "scope3_category": scope3_cat,
        "substance": substance,
        "value": round(float(row["value"]), 6),
        "unit": unit,
        "co2_factor": "",
        "ch4_factor": "",
        "n2o_factor": "",
        "geography": "Global",
        "jurisdiction": "Global",
        "required_by": "{GHG-Protocol,SB-253}",
        "gwp_basis": "AR5",
        "tier": 2,
        "uncertainty_pct": "",
        "source_document": "DEFRA UK GHG Conversion Factors 2024 v1.1",
        "source_url": "https://www.gov.uk/government/collections/government-conversion-factors-for-company-reporting",
        "data_year": 2024,
        "published_date": "2024-10-01",
        "effective_start": "2024-10-01",
        "effective_end": "",
        "superseded_by": "",
        "wiki_method_page": "methodologies/scope-3-cat6-business-travel",
        "last_verified": "2026-04-24",
    })

OUT.parent.mkdir(parents=True, exist_ok=True)
pd.DataFrame(records).to_csv(OUT, index=False)
print(f"Wrote {len(records)} DEFRA transport records -> {OUT}")

# Summary breakdown
summary = df.groupby("level1").size()
print("Records by category:")
for cat, count in summary.items():
    print(f"  {cat}: {count}")
