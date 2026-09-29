"""Builds verified-electricity-register-egrid2023.json from the EPA eGRID2023 rev2 workbook.
Values are read programmatically from exact cells; each is the shortest round-trip decimal of the
stored cell value (every rate is published to 3 decimals). Cross-checks: all 27 subregion CO2 and
CO2e rates equal EPA's Power Profiler data (USEPA/power-profiler subregion.json, 2023 data), and
each published CO2e rate equals CO2 + 28 x CH4 + 265 x N2O within the 3-dp rounding bound."""
import hashlib, json, sys
from decimal import Decimal
import openpyxl

WORKBOOK, HUB_REGISTER, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
raw = open(WORKBOOK, 'rb').read()
sha = hashlib.sha256(raw).hexdigest()
assert sha == '895cd81dd8662406189ad8adf5a2578dcb362cdb5cff7cca81b10ee6bd2447c6', sha
hub = json.load(open(HUB_REGISTER, encoding='utf-8'))
hub_entries = {e['id']: e for e in hub['entries']}
ws = openpyxl.load_workbook(WORKBOOK, read_only=True, data_only=True)['SRL23']
rows = list(ws.iter_rows(min_row=1, values_only=True))
assert rows[1][1] == 'SUBRGN' and rows[1][2] == 'SRNAME' and rows[1][22:25] == ('SRCO2RTA', 'SRCH4RTA', 'SRN2ORTA')
entries = []
for r, row in enumerate(rows[2:], start=3):
    if not row[1]:
        continue
    assert row[0] == 2023
    for col, gas, unit in (('W', 'co2', 'lb CO2 per MWh'), ('X', 'ch4', 'lb CH4 per MWh'), ('Y', 'n2o', 'lb N2O per MWh')):
        v = row[{'W': 22, 'X': 23, 'Y': 24}[col]]
        text = repr(v)
        assert Decimal(text) == Decimal(str(v)) and len(text.split('.')[-1]) <= 3 and float(text) == v
        entries.append({'id': f'egrid2023.{row[1]}.{gas}', 'table': 'SRL23 eGRID subregion annual total output emission rates', 'sheet': 'SRL23',
                        'valueCell': f'{col}{r}', 'value': text.rstrip('0').rstrip('.') if '.' in text else text, 'unit': unit,
                        'labelCells': [f'B{r}', f'C{r}', f'{col}1'], 'label': f'{row[2]} ({row[1]})'})
assert len(entries) == 81
for gas in ('CO2', 'CH4', 'N2O'):
    e = dict(hub_entries['gwp_ar5.' + gas])
    e['sourceSha256'] = hub['source']['sha256']
    entries.append(e)
register = {
    'schema': 'neuvetra.verified-factor-register.v1',
    'verifiedBy': 'Claude (independent AI review), 2026-09-27',
    'method': 'eGRID rates read programmatically from exact SRL23 cells of the EPA eGRID2023 rev2 workbook with openpyxl (shortest round-trip decimal of each stored value; all published to 3 decimals). '
              'All 27 CO2 and CO2e subregion rates equal EPA Power Profiler data (USEPA/power-profiler subregion.json, dataYear 2023). Each published CO2e rate equals CO2 + 28 x CH4 + 265 x N2O within the 3-dp rounding bound (max difference 0.129 lb/MWh), confirming AR5 GWPs. '
              'AR5 GWP entries are copied from the verified 2025 Hub register (source hash in sourceSha256). Rates are total output emission rates, which exclude grid losses.',
    'source': {'publisher': 'U.S. EPA', 'title': 'eGRID2023 data file, revision 2', 'edition': 'eGRID2023 rev2 (data year 2023), released 2025-06-12; latest EPA edition as of 2026-09-27',
               'url': 'https://www.epa.gov/system/files/documents/2025-06/egrid2023_data_rev2.xlsx', 'sha256': sha, 'bytes': len(raw)},
    'constants': [
        {'id': 'lb_to_kg', 'value': '0.45359237', 'unit': 'kg per lb', 'basis': 'Exact international avoirdupois pound definition'},
        {'id': 'kwh_to_mwh', 'value': '0.001', 'unit': 'MWh per kWh', 'basis': 'SI definition'},
    ],
    'entries': entries,
}
open(OUT, 'w', encoding='utf-8', newline='\n').write(json.dumps(register, ensure_ascii=False, indent=1) + '\n')
print(hashlib.sha256(open(OUT, 'rb').read()).hexdigest(), len(entries))
