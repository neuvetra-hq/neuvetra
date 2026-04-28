"""
Process EPA eGRID 2023 (metric) -> electricity_grid_egrid-2023.csv

Source: egrid2023_data_metric_rev2.xlsx, sheet SRL23 (subregion level)
Covers: US electricity grid emission factors by eGRID subregion
Key subregion: CAMX (California — required for Scope 2 location-based)
GWP basis: AR5 (eGRID 2023 documentation uses AR5)
Unit output: kg CO2e / MWh
"""

import pandas as pd
import re
import warnings
from pathlib import Path

warnings.filterwarnings("ignore")

RAW = Path(r"C:\Users\nimab\Neuvetra\raw\factors\egrid\egrid2023_data_metric_rev2.xlsx")
OUT = Path(r"C:\Users\nimab\Neuvetra\factors\processed\electricity_grid_egrid-2023.csv")

def slugify(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower().strip()).strip("-")

df = pd.read_excel(RAW, sheet_name="SRL23", header=0, skiprows=[1])

# Rename to known short names based on column indices
col_names = list(df.columns)

# Columns of interest (0-indexed in df after header row skip):
# 1:  SUBRGN  — subregion acronym
# 2:  SRNAME  — subregion name
# 28: CO2 total output emission rate (kg/MWh)
# 30: CH4 total output emission rate (kg/MWh)
# 32: N2O total output emission rate (kg/MWh)
# 34: CO2e total output emission rate (kg/MWh)  ← primary value

# Verify by checking partial column name
assert "CO2 total output emission rate (kg/MWh)" in col_names[28], f"Col 28 mismatch: {col_names[28]}"
assert "CH4 total output emission rate (kg/MWh)" in col_names[30], f"Col 30 mismatch: {col_names[30]}"
assert "N2O total output emission rate (kg/MWh)" in col_names[32], f"Col 32 mismatch: {col_names[32]}"
assert "CO2 equivalent total output emission rate (kg/MWh)" in col_names[34], f"Col 34 mismatch: {col_names[34]}"

subrgn_col = col_names[1]
srname_col = col_names[2]
co2_col    = col_names[28]
ch4_col    = col_names[30]
n2o_col    = col_names[32]
co2e_col   = col_names[34]

records = []

for _, row in df.iterrows():
    subrgn = str(row[subrgn_col]).strip() if pd.notna(row[subrgn_col]) else None
    if not subrgn or subrgn in ("nan", "SUBRGN"):
        continue

    srname = str(row[srname_col]).strip() if pd.notna(row[srname_col]) else subrgn

    try:
        co2e  = float(row[co2e_col])
        co2   = float(row[co2_col])
        ch4   = float(row[ch4_col])
        n2o   = float(row[n2o_col])
    except (ValueError, TypeError):
        continue

    # Regulatory context — CAMX = California
    required_by = "{GHG-Protocol,SB-253}"
    if subrgn == "CAMX":
        required_by = "{CARB-MRR,SB-253,GHG-Protocol}"
        geography = "CAMX"
        jurisdiction = "California"
    else:
        geography = subrgn
        jurisdiction = "US-Federal"

    factor_id = f"electricity-grid-{slugify(subrgn)}-egrid-2023"

    records.append({
        "factor_id": factor_id,
        "name": f"Electricity Grid — {subrgn} ({srname}) — eGRID 2023",
        "factor_type": "electricity-grid",
        "scope": 2,
        "scope3_category": "",
        "substance": f"grid-electricity-{subrgn.lower()}",
        "value": round(co2e, 4),
        "unit": "kg CO2e / MWh",
        "co2_factor": round(co2, 4),
        "ch4_factor": round(ch4, 6),
        "n2o_factor": round(n2o, 6),
        "geography": geography,
        "jurisdiction": jurisdiction,
        "required_by": required_by,
        "gwp_basis": "AR5",
        "tier": "",
        "uncertainty_pct": "",
        "source_document": "EPA eGRID 2023 (metric rev2)",
        "source_url": "https://www.epa.gov/egrid",
        "data_year": 2023,
        "published_date": "2025-01-01",
        "effective_start": "2025-01-01",
        "effective_end": "",
        "superseded_by": "",
        "wiki_method_page": "methodologies/scope-2-location-based",
        "last_verified": "2026-04-24",
    })

OUT.parent.mkdir(parents=True, exist_ok=True)
pd.DataFrame(records).to_csv(OUT, index=False)
print(f"Wrote {len(records)} electricity grid records -> {OUT}")
camx = [r for r in records if r["geography"] == "CAMX"]
if camx:
    print(f"  CAMX factor: {camx[0]['value']} kg CO2e / MWh")
