"""
Process EPA GHG Emission Factors Hub 2025 -> combustion_epa-cfr98-2025.csv

Source: ghg-emission-factors-hub-2025.xlsx
Covers: Stationary combustion factors (Scope 1) for ~50 fuel types
Required by: CARB-MRR, SB-253, GHG-Protocol
GWP basis: AR5 (CH4=28, N2O=265 — per EPA hub header)
Unit output: kg CO2e / MMBtu
"""

import pandas as pd
import numpy as np
import re
import csv
import warnings
from pathlib import Path

warnings.filterwarnings("ignore")

RAW = Path(r"C:\Users\nimab\Neuvetra\raw\factors\epa-40cfr98\ghg-emission-factors-hub-2025.xlsx")
OUT = Path(r"C:\Users\nimab\Neuvetra\factors\processed\combustion_epa-cfr98-2025.csv")

# AR5 GWP100 values (as stated in the EPA hub)
CH4_GWP = 28
N2O_GWP = 265

def slugify(name: str) -> str:
    s = name.lower().strip()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = s.strip("-")
    return s[:60]

def parse_gwp(val) -> float | None:
    try:
        return float(str(val).replace(",", "").strip())
    except (ValueError, TypeError):
        return None

df_raw = pd.read_excel(RAW, sheet_name="Emission Factors Hub", header=None)

records = []

# Walk rows and collect stationary combustion data rows.
# Section A (solid): row format [name, heat_mmbtu_per_ton, co2, ch4, n2o, ...]
# Section B (gas):   row format [name, heat_mmbtu_per_scf, co2, ch4, n2o, ...]
# Section C (liquid): row format [name, heat_mmbtu_per_gal, co2, ch4, n2o, ...]
# Section D (biomass biogenic): row format [name, co2, ch4, n2o]  (4 values only)

# Detect section D rows: fuel string + exactly 3 numeric values (co2~50-150, ch4 small, n2o small)
# Sections A/B/C rows have heat content in col 1 and co2 in col 2.

# Map rows to known mobile combustion boundary (row 100+) - skip those
MAX_ROW = 100

for i in range(MAX_ROW):
    row = df_raw.iloc[i]
    vals = [v for v in row if pd.notna(v)]

    if len(vals) < 2:
        continue

    name = vals[0]
    if not isinstance(name, str):
        continue

    # Skip header/unit annotation rows
    lower = name.lower()
    if any(kw in lower for kw in ["mmBtu", "fuel type", "vehicle", "source:", "note", "table", "mmbtu", "unit"]):
        continue
    if name.strip() == "":
        continue

    # Section D: biomass biogenic — 4 values [name, co2, ch4, n2o]
    if len(vals) == 4 and all(isinstance(v, (int, float)) for v in vals[1:4]):
        co2 = parse_gwp(vals[1])
        ch4 = parse_gwp(vals[2])
        n2o = parse_gwp(vals[3])
    elif len(vals) >= 5 and all(isinstance(v, (int, float)) for v in vals[1:5]):
        # Sections A/B/C: [name, heat_content, co2, ch4, n2o, ...]
        co2 = parse_gwp(vals[2])
        ch4 = parse_gwp(vals[3])
        n2o = parse_gwp(vals[4])
    else:
        continue

    if co2 is None or ch4 is None or n2o is None:
        continue

    # Compute CO2e per MMBtu
    co2e = co2 + (ch4 * CH4_GWP / 1000) + (n2o * N2O_GWP / 1000)

    slug = slugify(name)
    factor_id = f"combustion-{slug}-epa-cfr98-2025"

    records.append({
        "factor_id": factor_id,
        "name": f"{name} — Stationary Combustion",
        "factor_type": "combustion",
        "scope": 1,
        "scope3_category": "",
        "substance": name,
        "value": round(co2e, 5),
        "unit": "kg CO2e / MMBtu",
        "co2_factor": round(co2, 5),
        "ch4_factor": round(ch4 * CH4_GWP / 1000, 6),
        "n2o_factor": round(n2o * N2O_GWP / 1000, 6),
        "geography": "US-national",
        "jurisdiction": "US-Federal",
        "required_by": "{CARB-MRR,SB-253,GHG-Protocol}",
        "gwp_basis": "AR5",
        "tier": "",
        "uncertainty_pct": "",
        "source_document": "EPA GHG Emission Factors Hub 2025",
        "source_url": "https://www.epa.gov/system/files/documents/2025-01/ghg-emission-factors-hub-2025.xlsx",
        "data_year": 2025,
        "published_date": "2025-01-15",
        "effective_start": "2025-01-15",
        "effective_end": "",
        "superseded_by": "",
        "wiki_method_page": "methodologies/scope-1-stationary-combustion",
        "last_verified": "2026-04-24",
    })

OUT.parent.mkdir(parents=True, exist_ok=True)
pd.DataFrame(records).to_csv(OUT, index=False)
print(f"Wrote {len(records)} combustion records -> {OUT}")
