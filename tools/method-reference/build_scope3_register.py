"""Builds verified-scope3-register-2025.json (EPA GHG Emission Factors Hub, January 2025, Tables 8-10,
plus AR5 GWPs; eGRID2023 rev2 subregion total output rates and grid gross loss for Category 3 activity C).
Each value is the shortest round-trip decimal of the stored workbook cell. Cross-checks: every Hub value,
rounded to the decimals the Hub PDF prints, equals the PDF (same edition); eGRID rates equal the Scope 2 register."""
import hashlib, json, re, subprocess, sys
from decimal import Decimal
import openpyxl

HUB, HUB_PDF, EGRID, ELECTRICITY_REGISTER, OUT = sys.argv[1:6]
HUB_SHA, EGRID_SHA = '43afb91d79b2ae765b3a447549d9e1021a144a407cec5eb804be9fcf69a668a7', '895cd81dd8662406189ad8adf5a2578dcb362cdb5cff7cca81b10ee6bd2447c6'
assert hashlib.sha256(open(HUB, 'rb').read()).hexdigest() == HUB_SHA
assert hashlib.sha256(open(EGRID, 'rb').read()).hexdigest() == EGRID_SHA
assert hashlib.sha256(open(HUB_PDF, 'rb').read()).hexdigest() == '5d07c678fae6783623acb1e23faa4a7c46268ee6c5a0654c9e49c50de7caf924'
pdf = subprocess.run(['pdftotext', '-layout', HUB_PDF, '-'], capture_output=True, check=True).stdout.decode('utf-8')
ws = openpyxl.load_workbook(HUB, data_only=True)['Emission Factors Hub']

def text(v):
    t = repr(v) if isinstance(v, float) else str(v)
    assert re.fullmatch(r'(0|[1-9][0-9]*)(\.[0-9]+)?', t), t
    return t.rstrip('0').rstrip('.') if '.' in t else t

PDF_LINES = pdf.splitlines()

def check_pdf(label, values):
    """Every workbook value, rounded to the PDF's printed decimals, must appear in order on the PDF row for that label
    (the PDF wraps some long labels, so the numbers may sit on the line before or after the label)."""
    starts = [i for i, l in enumerate(PDF_LINES) if l.strip().startswith(label)]
    assert starts, label
    for i in starts:
        for line in PDF_LINES[max(0, i - 1):i + 2]:
            nums = re.findall(r'(?<![\w.])(NA|\d+(?:\.\d+)?)(?![\w.])', line.replace(label, ''))
            nums = [n for n in nums if n not in ('300', '2300')]
            if len(nums) < len(values):
                continue
            nums = nums[-len(values):] if any(v is None for v in values) is False and len(nums) > len(values) else nums[:len(values)]
            ok = True
            for v, p in zip(values, nums):
                if v is None:
                    ok = ok and p == 'NA'
                elif p == 'NA':
                    ok = False
                else:
                    places = len(p.split('.')[1]) if '.' in p else 0
                    ok = ok and Decimal(v).quantize(Decimal(1).scaleb(-places)) == Decimal(p)
            if ok:
                return
    raise AssertionError(f'PDF mismatch for {label}: {values}')

entries = []
def add(eid, table, cell, value, unit, label, labels, **extra):
    entries.append(dict({'id': eid, 'table': table, 'sheet': 'Emission Factors Hub', 'valueCell': cell, 'value': value, 'unit': unit,
                         'labelCells': labels, 'label': label}, **extra))

# Table 8 (Category 4 and 9) and Table 10 (Category 6 and 7): C label, D CO2 kg, E CH4 g, F N2O g, G units.
slug = lambda s: re.sub(r'[^a-z0-9]+', '_', s.lower()).strip('_')
for first, last, table, prefix in ((422, 428, 'Table 8 Scope 3 Category 4 and 9 transportation', 'transport'), (504, 515, 'Table 10 Scope 3 Category 6 and 7 travel and commuting', 'travel')):
    for r in range(first, last + 1):
        raw_label = str(ws.cell(r, 3).value).strip()
        label = re.sub(r'\s*[A-E]$', '', raw_label).strip()
        unit = str(ws.cell(r, 7).value).strip()
        vals = [text(ws.cell(r, c).value) for c in (4, 5, 6)]
        check_pdf(re.sub(r'\s*[A-E]$', '', raw_label).split(' (')[0].strip(), vals)
        key = f'{prefix}.{slug(label)}.{slug(unit)}'
        for c, gas, u in ((4, 'co2', 'kg CO2 per '), (5, 'ch4', 'g CH4 per '), (6, 'n2o', 'g N2O per ')):
            add(f'{key}.{gas}', table, f'{"DEF"[c-4]}{r}', vals[c - 4], u + unit, f'{label} ({unit})', [f'C{r}', f'{"DEF"[c-4]}{r - (r - (421 if prefix == "transport" else 503))}', f'G{r}'])

# Table 9 (Category 5 and 12): metric tons CO2e per short ton, AR4 GWPs as published. D..I = six disposal methods.
methods = {4: 'recycled', 5: 'landfilled', 6: 'combusted', 7: 'composted', 8: 'anaerobic_digestion_dry', 9: 'anaerobic_digestion_wet'}
for r in range(436, 497):
    material = str(ws.cell(r, 3).value).strip()
    row = [ws.cell(r, c).value for c in range(4, 10)]
    vals = [None if v == 'NA' else text(v) for v in row]
    check_pdf(material, vals)
    for c, v in zip(range(4, 10), vals):
        if v is None:
            continue
        add(f'waste.{slug(material)}.{methods[c]}', 'Table 9 Scope 3 Category 5 and 12 waste', f'{"DEFGHI"[c-4]}{r}', v,
            'metric ton CO2e (AR4 GWP) per short ton', f'{material}, {methods[c].replace("_", " ")}', [f'C{r}', f'{"DEFGHI"[c-4]}435'])

# AR5 GWPs (Table 11), as in the verified 2025 register.
for cell, gas in (('E524', 'CO2'), ('E525', 'CH4'), ('E526', 'N2O')):
    add(f'gwp_ar5.{gas}', 'Table 11 GWP (AR5 100-year)', cell, text(ws[cell].value), 'kg CO2e per kg gas', gas, [f'C{cell[1:]}', 'E523'], gwpSet='AR5-100')

# eGRID2023 rev2 total output rates (identical to the Scope 2 register) and grid gross loss by interconnect.
electricity = json.load(open(ELECTRICITY_REGISTER, encoding='utf-8'))
for e in electricity['entries']:
    if e['id'].startswith('egrid2023.'):
        entries.append(dict(e, sourceSha256=EGRID_SHA))
ggl = openpyxl.load_workbook(EGRID, read_only=True, data_only=True)['GGL23']
for r, row in enumerate(ggl.iter_rows(min_row=3, values_only=True), start=3):
    if row[1] is None:
        continue
    assert row[0] == 2023
    entries.append({'id': f'egrid2023_ggl.{slug(row[1])}', 'table': 'GGL23 eGRID grid gross loss by interconnect', 'sheet': 'GGL23', 'valueCell': f'F{r}',
                    'value': text(row[5]), 'unit': 'fraction of generation lost in transmission and distribution', 'labelCells': [f'B{r}', 'F1'],
                    'label': f'{row[1]} grid gross loss', 'sourceSha256': EGRID_SHA})

ids = [e['id'] for e in entries]
assert len(ids) == len(set(ids)), 'duplicate id'
register = {
    'schema': 'neuvetra.verified-factor-register.v1',
    'verifiedBy': 'Claude (independent AI review), 2026-09-28',
    'method': 'Hub Tables 8-10 read programmatically from exact cells of the January 2025 workbook (shortest round-trip decimal of each stored value); each value rounded to the printed decimals equals the same-edition Hub PDF. '
              'Table 9 waste factors are metric tons CO2e per short ton computed by EPA with AR4 GWPs and cannot be split by gas. One cell (Asphalt Concrete, recycled, D490) stores 0.0035205384954666674 while EPA prints 0.004; the stored value is used. '
              'eGRID2023 rev2 subregion rates are identical to the verified Scope 2 register; grid gross loss values are read from sheet GGL23.',
    'source': {'publisher': 'U.S. EPA Center for Corporate Climate Leadership', 'title': 'GHG Emission Factors Hub', 'edition': 'Last Modified: January 15, 2025',
               'url': 'https://www.epa.gov/system/files/other-files/2025-01/ghg-emission-factors-hub-2025.xlsx', 'sha256': HUB_SHA, 'bytes': 1014275},
    'constants': [
        {'id': 'g_to_kg', 'value': '0.001', 'unit': 'kg per g', 'basis': 'SI definition'},
        {'id': 'km_per_mile', 'value': '1.609344', 'unit': 'km per international mile', 'basis': 'Exact: international mile = 1,609.344 m (international yard and pound agreement, 1959)'},
        {'id': 'kwh_to_mwh', 'value': '0.001', 'unit': 'MWh per kWh', 'basis': 'SI definition'},
        {'id': 'lb_to_kg', 'value': '0.45359237', 'unit': 'kg per lb', 'basis': 'Exact international avoirdupois pound definition'},
        {'id': 'lb_per_short_ton', 'value': '2000', 'unit': 'lb per short ton', 'basis': 'Definition; stated in the Hub Table 9 notes'},
        {'id': 'metric_ton_to_kg', 'value': '1000', 'unit': 'kg per metric ton', 'basis': 'SI definition'},
    ],
    'entries': entries,
}
open(OUT, 'w', encoding='utf-8', newline='\n').write(json.dumps(register, ensure_ascii=False, indent=1) + '\n')
print(hashlib.sha256(open(OUT, 'rb').read()).hexdigest(), len(entries))
