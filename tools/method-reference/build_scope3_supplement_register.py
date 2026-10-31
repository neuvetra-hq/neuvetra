"""Builds verified-scope3-supplement-register-2025.json (R3; Scope 3 completion I-05, DESIGN 4.3) from the staged primary files.

Usage: python3 build_scope3_supplement_register.py <epa-factors-hub-2025.xlsx> <epa-factors-hub-2025.pdf> <egrid2023_data_rev2.xlsx> <out.json>

Content (every value read programmatically from an exact cell; xlsx numbers are the shortest round-trip decimal of the
stored value, written without an exponent; sums are exact decimal sums of such values):
- EPA GHG Emission Factors Hub (January 15, 2025), sheet "Emission Factors Hub":
  - Table 1 (stationary combustion), every fuel with a default heat content (rows 17-83): `hub2025_t1.<fuel>.heat_content`
    (mmBtu per short ton, scf or gallon, HHV), `.co2` (kg CO2 per mmBtu), `.ch4` (g CH4 per mmBtu), `.n2o` (g N2O per mmBtu).
    The Hub section is in `table` ("Biomass Fuels" sections are biogenic). The kraft pulping liquor rows (85-89) have no
    heat content per physical unit and are not included.
  - Table 11 (AR5 100-year GWPs, rows 524-555) and Table 12 (blended refrigerants, rows 561-590): `hub2025_gwp.<gas>`,
    where <gas> is the HFC/PFC designation, the chemical formula of the other gases (CO2, CH4, N2O, SF6, NF3) or the ASHRAE
    number of a blend. Table 12 GWPs count only HFC and PFC constituents (note C591), so HCFC-only blends are 0 as published.
  - Each value, rounded to the decimals the same-edition Hub PDF prints, must equal the PDF (cross-check on every row).
- EPA eGRID2023 revision 2:
  - US23 U3, V3, W3: U.S. annual total output emission rates `egrid2023_us.{co2,ch4,n2o}` (lb per MWh).
  - PLNT23: plant annual heat input from combustion (PLHTIAN, MMBtu) summed by eGRID subregion (SUBRGN) and plant primary
    fuel category (PLFUELCT): `egrid2023_hi.<SUB>.<FUELCT>`, and over all plants: `egrid2023_hi.US.<FUELCT>` (pairs with a
    positive sum only; the plant count is in `valueCell`). Asserted: for each of the 27 subregions the fuel sums add up
    to SRL23 SRHTIAN exactly, and the U.S. sums add up to US23 USHTIAN exactly.
  - SRL23 SRNGENAN and US23 USNGENAN: annual net generation `egrid2023_gen.<SUB>` and `egrid2023_gen.US` (MWh).
- Constants (prefix `supplement_const.`, routed to this register by the engine): therm_to_mmbtu, scf_per_ccf,
  scf_per_mcf, kwh_per_mmbtu, sqft_per_m2, liter_per_us_gallon.
The output is sorted, uses only the 0024 loader keys, and is byte-reproducible from the same inputs.
"""
import hashlib
import json
import re
import subprocess
import sys
import warnings
from collections import defaultdict
from decimal import Decimal, ROUND_HALF_EVEN, localcontext
from fractions import Fraction

import openpyxl

warnings.filterwarnings('ignore')  # openpyxl warns about the Hub's header/footer and extensions; nothing is read from them

HUB, HUB_PDF, EGRID, OUT = sys.argv[1:5]
HUB_SHA = '43afb91d79b2ae765b3a447549d9e1021a144a407cec5eb804be9fcf69a668a7'
HUB_PDF_SHA = '5d07c678fae6783623acb1e23faa4a7c46268ee6c5a0654c9e49c50de7caf924'
EGRID_SHA = '895cd81dd8662406189ad8adf5a2578dcb362cdb5cff7cca81b10ee6bd2447c6'
HUB_BYTES, EGRID_BYTES = 1014275, None
for path, sha in ((HUB, HUB_SHA), (HUB_PDF, HUB_PDF_SHA), (EGRID, EGRID_SHA)):
    assert hashlib.sha256(open(path, 'rb').read()).hexdigest() == sha, path
EGRID_BYTES = len(open(EGRID, 'rb').read())
SHEET = 'Emission Factors Hub'
ws = openpyxl.load_workbook(HUB, data_only=True)[SHEET]
pdf_lines = subprocess.run(['pdftotext', '-layout', HUB_PDF, '-'], capture_output=True, check=True).stdout.decode('utf-8').splitlines()


def text(v) -> str:
    """The shortest round-trip decimal of a stored number, without an exponent (9.2e-05 -> 0.000092)."""
    assert isinstance(v, (int, float)) and not isinstance(v, bool), v
    t = format(Decimal(repr(v)), 'f') if isinstance(v, float) else str(v)
    assert re.fullmatch(r'(0|[1-9][0-9]*)(\.[0-9]+)?', t), t
    return t.rstrip('0').rstrip('.') if '.' in t else t


def pdf_row(label: str, count: int, skip: int = 0) -> list:
    """The first `count` numbers (after `skip` tokens) of the PDF row whose first column is exactly `label`."""
    for line in pdf_lines:
        cells = re.split(r'\s{2,}', line.strip())
        if cells and cells[0] == label and len(cells) >= 1 + skip + count:
            nums = cells[1 + skip:1 + skip + count]
            if all(re.fullmatch(r'[0-9][0-9,]*(\.[0-9]+)?', n) for n in nums):
                return [n.replace(',', '') for n in nums]
    raise AssertionError(f'PDF row not found: {label}')


def same_as_printed(value: str, printed: str) -> bool:
    places = len(printed.split('.')[1]) if '.' in printed else 0
    return Decimal(value).quantize(Decimal(1).scaleb(-places), rounding=ROUND_HALF_EVEN) == Decimal(printed)


slug = lambda s: re.sub(r'[^a-z0-9]+', '_', s.lower()).strip('_')
entries = []


def add(eid: str, table: str, sheet: str, cell: str, value: str, unit: str, label: str, labels: list, **extra):
    entries.append(dict({'id': eid, 'table': table, 'sheet': sheet, 'valueCell': cell, 'value': value, 'unit': unit, 'labelCells': labels, 'label': label}, **extra))


# ---- Hub Table 1: fuels with a heat content (rows 17-83). Column C label, D heat content, E kg CO2/mmBtu, F g CH4/mmBtu,
# G g N2O/mmBtu; the unit row above each block (rows 15, 36, 47) names the heat-content unit.
assert str(ws['B12'].value).strip() == 'Table 1' and 'Stationary Combustion' in str(ws['C12'].value)
assert [str(ws.cell(14, c).value).strip() for c in (3, 4, 5, 6, 7)] == ['Fuel Type', 'Heat Content (HHV)', 'CO2 Factor', 'CH4 Factor', 'N2O Factor']
section, unit_row, fuels = None, None, 0
for r in range(15, 84):
    label = ws.cell(r, 3).value
    d = ws.cell(r, 4).value
    if label is None and isinstance(d, str):  # a unit row: "mmBtu per short ton" / "mmBtu per scf" / "mmBtu per gallon"
        assert [str(ws.cell(r, c).value).strip() for c in (5, 6, 7)] == ['kg CO2 per mmBtu', 'g CH4 per mmBtu', 'g N2O per mmBtu'], r
        unit_row = r
        continue
    label = str(label).strip()
    if d is None:  # a section heading
        section = label
        continue
    vals = [text(ws.cell(r, c).value) for c in (4, 5, 6, 7)]
    printed = pdf_row(label, 4)
    assert all(same_as_printed(v, p) for v, p in zip(vals, printed)), (label, vals, printed)
    hc_unit = str(ws.cell(unit_row, 4).value).strip()
    assert hc_unit in ('mmBtu per short ton', 'mmBtu per scf', 'mmBtu per gallon'), hc_unit
    key = f'hub2025_t1.{slug(label)}'
    table = f'Table 1 Stationary Combustion: {section}'
    for col, part, unit in ((4, 'heat_content', hc_unit + ' (HHV)'), (5, 'co2', 'kg CO2 per mmBtu'), (6, 'ch4', 'g CH4 per mmBtu'), (7, 'n2o', 'g N2O per mmBtu')):
        letter = 'CDEFG'[col - 3]
        add(f'{key}.{part}', table, SHEET, f'{letter}{r}', vals[col - 4], unit, label, [f'C{r}', f'{letter}{unit_row}', f'{letter}14'])
    fuels += 1
assert fuels == 58, fuels  # 9 coal and coke, 4 other solids, 4 biomass solids, natural gas, 4 other gases, 2 biomass gases, 30 petroleum products, 4 biomass liquids
assert ws['C84'].value is not None and 'Kraft' in str(ws['C84'].value) and ws['D85'].value is None  # no heat content below row 83

# ---- Hub Table 11 (rows 524-555) and Table 12 (rows 561-590).
assert str(ws['B521'].value).strip() == 'Table 11' and str(ws['B558'].value).strip() == 'Table 12'
gases = []
for r in range(524, 556):
    name, formula, gwp = str(ws.cell(r, 3).value).strip(), str(ws.cell(r, 4).value).replace('\xa0', '').strip(), text(ws.cell(r, 5).value)
    token = name if name.startswith(('HFC-', 'PFC-')) else formula
    assert re.fullmatch(r'[A-Za-z0-9-]+', token), token
    assert same_as_printed(gwp, pdf_row(name, 1, skip=1)[0]), (name, gwp)
    # The label is the gas token (0024 loads a GWP entry's label as its gas name); the common name and formula are cells C and D.
    add(f'hub2025_gwp.{token}', 'Table 11 Global Warming Potential (AR5 100-year)', SHEET, f'E{r}', gwp, 'kg CO2e per kg gas', token, [f'C{r}', f'D{r}', 'E523'], gwpSet='AR5-100')
    gases.append(token)
assert len(gases) == 32
note = str(ws['C591'].value)
assert 'based only on their HFC and PFC constituents' in note
for r in range(561, 591):
    name, gwp, composition = str(ws.cell(r, 3).value).strip(), text(ws.cell(r, 4).value), str(ws.cell(r, 5).value).strip()
    assert re.fullmatch(r'R-[0-9]{3}[A-Z]', name), name
    assert same_as_printed(gwp, pdf_row(name, 1)[0]), (name, gwp)
    add(f'hub2025_gwp.{name}', 'Table 12 Global Warming Potential for blended refrigerants (AR5 100-year; HFC and PFC constituents only, note C591)', SHEET, f'D{r}', gwp,
        'kg CO2e per kg blend', name, [f'C{r}', 'D560', 'C591', f'E{r}'], gwpSet='AR5-100', composition=composition)
    gases.append(name)
assert len(gases) == 62 and len(set(gases)) == 62

# ---- eGRID2023 rev2.
eg = openpyxl.load_workbook(EGRID, read_only=True, data_only=True)
us = list(eg['US23'].iter_rows(min_row=1, max_row=3, values_only=True))
col = {name: i for i, name in enumerate(us[1])}
assert us[2][col['YEAR']] == 2023
for gas, name, letter in (('co2', 'USCO2RTA', 'U'), ('ch4', 'USCH4RTA', 'V'), ('n2o', 'USN2ORTA', 'W')):
    assert col[name] == ord(letter) - ord('A')
    add(f'egrid2023_us.{gas}', 'US23 eGRID U.S. annual total output emission rate', 'US23', f'{letter}3', text(us[2][col[name]]), f'lb {gas.upper()} per MWh',
        'U.S. (eGRID2023 rev2)', [f'{letter}1', f'{letter}2'], sourceSha256=EGRID_SHA)
assert (col['USHTIAN'], col['USNGENAN']) == (2, 6)
us_heat, us_gen = Decimal(text(us[2][col['USHTIAN']])), text(us[2][col['USNGENAN']])
add('egrid2023_gen.US', 'US23 eGRID U.S. annual net generation', 'US23', 'G3', us_gen, 'MWh', 'U.S. annual net generation (USNGENAN)', ['G1', 'G2'], sourceSha256=EGRID_SHA)

sr = list(eg['SRL23'].iter_rows(min_row=1, values_only=True))
scol = {name: i for i, name in enumerate(sr[1])}
assert (scol['SUBRGN'], scol['SRNAME'], scol['SRHTIAN'], scol['SRNGENAN']) == (1, 2, 4, 8)
subregions = {}
for r, row in enumerate(sr[2:], start=3):
    if row[1] is None:
        continue
    assert row[0] == 2023
    subregions[row[1]] = {'row': r, 'name': row[2], 'heat': Decimal(text(row[4])), 'gen': text(row[8])}
    add(f'egrid2023_gen.{row[1]}', 'SRL23 eGRID subregion annual net generation', 'SRL23', f'I{r}', text(row[8]), 'MWh', f'{row[2]} ({row[1]}) annual net generation (SRNGENAN)',
        [f'B{r}', f'C{r}', 'I1', 'I2'], sourceSha256=EGRID_SHA)
assert len(subregions) == 27, len(subregions)

pl = list(eg['PLNT23'].iter_rows(min_row=1, values_only=True))
pcol = {name: i for i, name in enumerate(pl[1])}
assert (pcol['SUBRGN'], pcol['PLFUELCT'], pcol['PLHTIAN']) == (13, 25, 36)
sums, counts = defaultdict(Decimal), defaultdict(int)
for row in pl[2:]:
    heat = row[36]
    if heat is None:
        continue
    value = Decimal(text(heat))
    assert value >= 0 and row[13] in subregions and isinstance(row[25], str), row[:5]
    if value == 0:
        continue
    for sub in (row[13], 'US'):
        sums[(sub, row[25])] += value
        counts[(sub, row[25])] += 1
for sub, facts in subregions.items():
    total = sum((v for (s, _), v in sums.items() if s == sub), Decimal(0))
    assert total == facts['heat'], (sub, total, facts['heat'])  # the fuel sums add up to SRHTIAN exactly
assert sum((v for (s, _), v in sums.items() if s == 'US'), Decimal(0)) == us_heat  # and to USHTIAN
for (sub, fuel), value in sorted(sums.items()):
    where = 'all U.S. plants' if sub == 'US' else f'SUBRGN={sub}'
    name = 'U.S.' if sub == 'US' else f'{subregions[sub]["name"]} ({sub})'
    add(f'egrid2023_hi.{sub}.{fuel}', 'PLNT23 eGRID plant annual heat input from combustion (PLHTIAN) summed by subregion and plant primary fuel category (PLFUELCT)', 'PLNT23',
        f'AK3:AK{len(pl)} summed over {counts[(sub, fuel)]} plants with {where} and PLFUELCT={fuel} and PLHTIAN > 0', format(value, 'f'), 'MMBtu (annual heat input from combustion, HHV)',
        f'{name}, primary fuel {fuel}', ['N2', 'Z2', 'AK1', 'AK2'], sourceSha256=EGRID_SHA)


def fixed(q: Fraction, places: int) -> str:
    with localcontext() as ctx:
        ctx.prec = 100
        d = Decimal(q.numerator) / Decimal(q.denominator)
        return format(d.quantize(Decimal(1).scaleb(-places), rounding=ROUND_HALF_EVEN), 'f')


constants = [
    {'id': 'supplement_const.therm_to_mmbtu', 'value': '0.1', 'unit': 'MMBtu per therm', 'basis': 'Definition: 1 therm = 100,000 Btu = 0.1 MMBtu'},
    {'id': 'supplement_const.scf_per_ccf', 'value': '100', 'unit': 'scf per ccf', 'basis': 'Definition: 1 ccf = 100 cubic feet'},
    {'id': 'supplement_const.scf_per_mcf', 'value': '1000', 'unit': 'scf per mcf', 'basis': 'Definition: 1 mcf = 1,000 cubic feet'},
    {'id': 'supplement_const.kwh_per_mmbtu', 'value': fixed(Fraction(Decimal('1055.05585262')) * 10 ** 6 / 3600000, 20), 'unit': 'kWh per MMBtu',
     'basis': 'International Table Btu = 1055.05585262 J and 1 kWh = 3.6 MJ: 10^6 x 1055.05585262 / 3,600,000 = 293.0710701722...; rounded half-even to 20 decimal places'},
    {'id': 'supplement_const.sqft_per_m2', 'value': fixed(1 / Fraction(Decimal('0.3048')) ** 2, 20), 'unit': 'square feet per square metre',
     'basis': 'International foot = 0.3048 m exactly: 1 / 0.3048^2 = 10.7639104167...; rounded half-even to 20 decimal places'},
    {'id': 'supplement_const.liter_per_us_gallon', 'value': '3.785411784', 'unit': 'litres per U.S. gallon', 'basis': 'Exact: U.S. gallon = 231 cubic inches and 1 inch = 2.54 cm, so 231 x 2.54^3 cm3 = 3,785.411784 cm3 = 3.785411784 L'},
]
assert constants[3]['value'] == '293.07107017222222222222' and constants[4]['value'] == '10.76391041670972230833'

entries.sort(key=lambda e: e['id'])
constants.sort(key=lambda c: c['id'])
ids = [e['id'] for e in entries]
assert len(ids) == len(set(ids)), 'duplicate id'
register = {
    'schema': 'neuvetra.verified-factor-register.v1',
    'verifiedBy': 'Claude (lane A engineer, Scope 3 completion I-05), 2026-10-30; built by tools/method-reference/build_scope3_supplement_register.py from the staged files',
    'method': 'Supplement register R3 for Scope 3 categories 3D, 7, 4/8/9/10/13/14 and 11. EPA GHG Emission Factors Hub (January 15, 2025) Table 1 rows 17-83 '
              '(every stationary-combustion fuel with a default heat content; heat content HHV, kg CO2, g CH4 and g N2O per mmBtu), Table 11 and Table 12 AR5 100-year '
              'GWPs, each value the shortest round-trip decimal of the stored workbook cell and, rounded to the printed decimals, equal to the same-edition Hub PDF. '
              'One stored value differs from its printed form beyond rounding noise in the binary double only: Blast Furnace Gas CH4 (F40) is stored 0.022000000000000002 '
              'and printed 0.022; the stored value is used, as for every other cell. Table 12 GWPs count only the HFC and PFC constituents of a blend (note C591). '
              'eGRID2023 rev2: U.S. total output emission rates (US23 U3:W3); subregion and U.S. annual net generation (SRL23 SRNGENAN, US23 USNGENAN); plant heat input '
              'from combustion (PLNT23 PLHTIAN) summed by subregion and plant primary fuel category, asserted to add up exactly to SRHTIAN for all 27 subregions and to '
              'USHTIAN. Values are published values; no factor is derived or typed by hand.',
    'source': {'publisher': 'U.S. EPA Center for Corporate Climate Leadership; U.S. EPA eGRID', 'title': 'GHG Emission Factors Hub (Tables 1, 11, 12); eGRID2023 revision 2',
               'edition': f'Hub Last Modified: January 15, 2025 (cross-checked against the Hub PDF, sha256 {HUB_PDF_SHA}); eGRID2023 revision 2 data file '
                          f'(sha256 {EGRID_SHA}, {EGRID_BYTES} bytes; every eGRID entry cites it in sourceSha256); licence: U.S. Government work, public domain',
               'url': 'https://www.epa.gov/system/files/other-files/2025-01/ghg-emission-factors-hub-2025.xlsx', 'sha256': HUB_SHA, 'bytes': HUB_BYTES},
    'constants': constants,
    'entries': entries,
}
assert len(open(HUB, 'rb').read()) == HUB_BYTES
open(OUT, 'w', encoding='utf-8', newline='\n').write(json.dumps(register, ensure_ascii=False, indent=1) + '\n')
print(hashlib.sha256(open(OUT, 'rb').read()).hexdigest(), len(entries), len(constants))
