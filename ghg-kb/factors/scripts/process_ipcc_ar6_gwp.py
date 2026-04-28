"""
Process IPCC AR6 Chapter 7 Supplementary — GWP100 values -> refrigerant_gwp_ipcc-ar6.csv

Source: IPCC_AR6_WGI_Chapter07_SM.pdf, Table 7.SM.7 (pages 16–25)
Covers: 100-year GWP values for all greenhouse gases including refrigerants, HFCs, HCFCs, PFCs, SF6
Unit output: kg CO2e / kg (GWP-100 is dimensionless but represents kg CO2e per kg of substance)
"""

import pdfplumber
import pandas as pd
import re
import warnings
from pathlib import Path

warnings.filterwarnings("ignore")

RAW = Path(r"C:\Users\nimab\Neuvetra\raw\factors\ipcc-ar6\IPCC_AR6_WGI_Chapter07_SM.pdf")
OUT = Path(r"C:\Users\nimab\Neuvetra\factors\processed\refrigerant_gwp_ipcc-ar6.csv")

# Table 7.SM.7 spans pages 16–25 of the PDF (1-indexed = indices 15–24)
GWP_PAGES = list(range(15, 26))

# Column indices within extracted table rows
COL_NAME    = 0
COL_FORMULA = 1
COL_GWP100  = 7   # "GWP-100"

def slugify(s: str) -> str:
    s = s.strip().lower()
    # Normalise multi-line names from PDF extraction
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")[:70]

def parse_float(val) -> float | None:
    if val is None:
        return None
    s = str(val).replace(",", "").replace("\n", "").strip()
    # Handle scientific notation representations like "1.33 × 10–5"
    s = re.sub(r"×\s*10[–-](\d+)", r"e-\1", s)
    s = re.sub(r"×\s*10\^?(\d+)", r"e\1", s)
    try:
        return float(s)
    except ValueError:
        return None

rows_all = []

with pdfplumber.open(str(RAW)) as pdf:
    for page_idx in GWP_PAGES:
        if page_idx >= len(pdf.pages):
            break
        page = pdf.pages[page_idx]
        tables = page.extract_tables()
        for table in tables:
            for row in table:
                if len(row) < 8:
                    continue
                rows_all.append(row)

records = []
seen_ids = set()

for row in rows_all:
    name_raw = row[COL_NAME]
    formula  = row[COL_FORMULA]
    gwp_raw  = row[COL_GWP100]

    if not name_raw or not isinstance(name_raw, str):
        continue

    # Clean multi-line name
    name = re.sub(r"\s+", " ", name_raw).strip()

    # Skip header rows
    if name.lower() in ("name", "major greenhouse gases", "") or "gwp" in name.lower():
        continue

    gwp100 = parse_float(gwp_raw)
    if gwp100 is None or gwp100 <= 0:
        continue

    slug = slugify(name)
    if not slug:
        continue

    factor_id = f"refrigerant-gwp-{slug}-ipcc-ar6"

    # Avoid duplicates (same compound may appear on multiple pages due to table continuation)
    if factor_id in seen_ids:
        continue
    seen_ids.add(factor_id)

    formula_clean = re.sub(r"\s+", "", formula or "").strip() if formula else ""

    # Scope 1 (direct refrigerant leaks are Scope 1 fugitive emissions)
    records.append({
        "factor_id": factor_id,
        "name": f"{name} — GWP100 (IPCC AR6)",
        "factor_type": "refrigerant-gwp",
        "scope": 1,
        "scope3_category": "",
        "substance": name,
        "value": round(gwp100, 2),
        "unit": "kg CO2e / kg",
        "co2_factor": "",
        "ch4_factor": "",
        "n2o_factor": "",
        "geography": "Global",
        "jurisdiction": "Global",
        "required_by": "{GHG-Protocol,SB-253,CARB-MRR}",
        "gwp_basis": "AR6",
        "tier": "",
        "uncertainty_pct": "",
        "source_document": "IPCC AR6 WGI Chapter 7 Supplementary Material, Table 7.SM.7",
        "source_url": "https://www.ipcc.ch/report/ar6/wg1/",
        "data_year": 2021,
        "published_date": "2021-08-09",
        "effective_start": "2021-08-09",
        "effective_end": "",
        "superseded_by": "",
        "wiki_method_page": "methodologies/scope-1-fugitive-refrigerants",
        "last_verified": "2026-04-24",
    })

OUT.parent.mkdir(parents=True, exist_ok=True)
pd.DataFrame(records).to_csv(OUT, index=False)
print(f"Wrote {len(records)} refrigerant GWP records -> {OUT}")

# Print key values for spot-check
key_refs = {"r-22": "HCFC-22", "r-134a": "HFC-134a", "sf6": "SF6", "ch4": "Methane"}
for slug_part, label in key_refs.items():
    match = [r for r in records if slug_part in r["factor_id"]]
    if match:
        print(f"  {label}: GWP100 = {match[0]['value']}")
