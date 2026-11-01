"""Builds verified-scope3-spend-register-epa-scghg-v1.3.json (R2; Scope 3 completion I-03, DESIGN 4.3, A4, A12).

Usage: python3 build_scope3_spend_register.py <EPA SC v1.3 CO2e CSV> <inputs/fred-A191RD3A086NBEA.json> <output.json>

Entries: two per 2017 NAICS-6 code of the official EPA Supply Chain GHG Emission Factors v1.3.0 CO2e CSV
(SupplyChainGHGEmissionFactors_v1.3.0_NAICS_CO2e_USD2022.csv, sha256 6025a14c...): `epa_scghg_v130.<naics>.with_margins`
and `.without_margins`, each the PUBLISHED column text (never SEF + MEF: in 110 rows the published with-margins value
differs from the sum by 0.001, e.g. 111130 = 0.848, not 0.849). `sheet` is the official CSV name; `valueCell` is
"row <n> column <header>" with the header as row 1; `label` is the NAICS title; `labelCells` name the code, title and
USEEIO-code cells of the same row and the column header.

Constants: `price_index.gdp_deflator.<year>` (BEA GDP implicit price deflator, FRED A191RD3A086NBEA, annual, index
2017 = 100) for every transcribed year, and `price_index.base_year` = 2022 (the dollar year of every factor). The index
values are a hand transcription from the FRED pages (no programmatic access; see the input file); this builder pins the
transcription file by SHA-256 and checks it against the research values for 2019-2025.

Only the keys the 0024 loader allows are written (top level: schema, verifiedBy, method, source, constants, entries).
"""
import csv, hashlib, io, json, re, sys

CSV_PATH, FRED_PATH, OUT = sys.argv[1:4]
CSV_SHA, CSV_BYTES = '6025a14c4fe16675735efba1683030e4d36011e3973f3c4261f8231aa69c002f', 123481
CSV_NAME = 'SupplyChainGHGEmissionFactors_v1.3.0_NAICS_CO2e_USD2022.csv'
CSV_URL = 'https://pasteur.epa.gov/uploads/10.23719/1531143/' + CSV_NAME
FRED_SHA = '76e6a5ba8f85f3c6c8f1eaf113b17d138215157b7aca10bfb8f2330062bf117b'
HEADER = ['2017 NAICS Code', '2017 NAICS Title', 'GHG', 'Unit', 'Supply Chain Emission Factors without Margins',
          'Margins of Supply Chain Emission Factors', 'Supply Chain Emission Factors with Margins', 'Reference USEEIO Code']
UNIT = 'kg CO2e/2022 USD, purchaser price'
DECIMAL = re.compile(r'(?:0|[1-9][0-9]{0,11})(?:\.[0-9]{1,20})?')  # the engine's FACTOR_TEXT
INDEX = re.compile(r'[1-9][0-9]{0,2}\.[0-9]{3}')

raw = open(CSV_PATH, 'rb').read()
assert hashlib.sha256(raw).hexdigest() == CSV_SHA and len(raw) == CSV_BYTES, 'not the staged official CSV'
rows = list(csv.reader(io.StringIO(raw.decode('utf-8'), newline='')))
assert rows[0] == HEADER, rows[0]
# One record per CRLF line (no quoted line breaks), so "row n" is also the file's line number.
assert raw.count(b'\r\n') == raw.count(b'\n') == len(rows) and raw.endswith(b'\r\n')
body = rows[1:]


def units(t: str) -> int:
    """Exact thousandths of a published value (every value has at most 3 decimals; asserted below)."""
    whole, _, frac = t.partition('.')
    assert len(frac) <= 3, t
    return int(whole) * 1000 + int(frac.ljust(3, '0'))


# Facts of the published file (About v1.3 and research/methods-purchases.md section 2), each asserted.
assert len(body) == 1016, len(body)
codes = [r[0] for r in body]
assert len(set(codes)) == 1016 and all(re.fullmatch(r'[0-9]{6}', c) for c in codes)
assert codes == sorted(codes)
assert all(r[2] == 'All GHGs' and r[3] == UNIT for r in body)
assert all(DECIMAL.fullmatch(r[i]) for r in body for i in (4, 5, 6)), 'a value is not a plain decimal'
assert len({(r[4], r[5], r[6]) for r in body}) == 353, 'About v1.3: 353 unique (SEF, MEF, SEF+MEF) sets'
assert all(units(r[4]) > 0 and units(r[6]) > 0 for r in body), 'a zero factor'
assert sum(1 for r in body if units(r[4]) + units(r[5]) != units(r[6])) == 110, 'with margins is published, rounded on its own'
assert all(abs(units(r[4]) + units(r[5]) - units(r[6])) <= 1 for r in body)
assert '221100' not in codes, 'About v1.3: electricity (221100) is dropped'
assert {r[6] for r in body if r[0].startswith('562')} == {'0.988'}, 'About v1.3: the waste sector is not disaggregated'
by_code = {r[0]: r for r in body}
SPOT = {  # research/methods-purchases.md section 2.2 (read by another agent): code -> (without, margin, with)
    '111130': ('0.809', '0.04', '0.848'), '327310': ('3.846', '0.078', '3.924'), '541511': ('0.084', '0', '0.084'), '541611': ('0.078', '0', '0.078'),
    '484121': ('0.595', '0', '0.595'), '481112': ('0.644', '0', '0.644'), '482111': ('0.466', '0', '0.466'), '483111': ('0.816', '0', '0.816'),
    '493110': ('0.244', '0', '0.244'), '334111': ('0.03', '0.028', '0.058'), '331110': ('0.769', '0.018', '0.787'), '236220': ('0.224', '0', '0.224'),
}
for code, values in SPOT.items():
    assert tuple(by_code[code][4:7]) == values, (code, by_code[code][4:7])
assert min(units(r[6]) for r in body) == 29 and max(body, key=lambda r: units(r[6]))[0] == '327310'

entries = []
for n, r in enumerate(body, start=2):
    code, title, useeio = r[0], r[1], r[7]
    assert title and title == title.strip() and useeio
    for column, margin in ((6, 'with_margins'), (4, 'without_margins')):
        entries.append({'id': f'epa_scghg_v130.{code}.{margin}',
                        'table': f'EPA Supply Chain GHG Emission Factors v1.3.0, CO2e by 2017 NAICS-6 commodity: {HEADER[column]}',
                        'sheet': CSV_NAME, 'valueCell': f'row {n} column {HEADER[column]}', 'value': r[column], 'unit': UNIT,
                        'labelCells': [f'row {n} column {HEADER[0]}', f'row {n} column {HEADER[1]}', f'row {n} column {HEADER[7]}', f'row 1 column {HEADER[column]}'],
                        'label': title})
entries.sort(key=lambda e: e['id'])
ids = [e['id'] for e in entries]
assert len(ids) == len(set(ids)) == 2032

# FRED transcription (DESIGN A12, 4.3): pinned bytes, contiguous years, both pages agree, research values agree.
fraw = open(FRED_PATH, 'rb').read()
assert hashlib.sha256(fraw).hexdigest() == FRED_SHA, 'the FRED transcription changed: re-read both pages, update the pin and the engine pin'
fred = json.loads(fraw.decode('utf-8'))
assert fred['series'] == 'A191RD3A086NBEA' and fred['units'] == 'Index 2017=100' and fred['frequency'] == 'Annual'
obs = fred['observations']
years = sorted(int(y) for y in obs)
assert years == list(range(years[0], years[-1] + 1)) and years[0] <= 2012 and years[-1] >= 2025, years
assert all(INDEX.fullmatch(v) for v in obs.values()) and obs['2017'] == '100.000'
series_page = [x for x in fred['reads'] if x['url'] == 'https://fred.stlouisfed.org/series/A191RD3A086NBEA']
assert len(series_page) == 1 and series_page[0]['values'] and all(obs[y] == v for y, v in series_page[0]['values'].items())
RESEARCH = {'2019': '103.979', '2020': '105.377', '2021': '110.159', '2022': '118.026', '2023': '122.451', '2024': '125.587', '2025': '128.893'}
assert all(obs[y] == v for y, v in RESEARCH.items()), 'FRED transcription disagrees with research/methods-purchases.md section 3'

basis = ('BEA GDP implicit price deflator, annual, index 2017 = 100, not seasonally adjusted: FRED series A191RD3A086NBEA '
         '(https://fred.stlouisfed.org/data/A191RD3A086NBEA and https://fred.stlouisfed.org/series/A191RD3A086NBEA), '
         f'retrieved {fred["retrievedOn"]}, FRED last updated {fred["fredLastUpdated"]}; transcribed by hand into '
         f'tools/method-reference/inputs/fred-A191RD3A086NBEA.json (sha256 {FRED_SHA}). Economy-wide approximation: '
         'EPA recommends commodity-specific price indexes (About v1.3, usage notes), which are not published after 2022.')
constants = [{'id': f'price_index.gdp_deflator.{y}', 'value': obs[str(y)], 'unit': 'index (2017 = 100)', 'basis': f'{y} annual value. ' + basis} for y in years]
constants.append({'id': 'price_index.base_year', 'value': '2022', 'unit': 'year (dollar year of every factor)',
                  'basis': f'Every factor is in "{UNIT}" ({CSV_NAME}, column Unit, all 1,016 rows); spend in another dollar year is multiplied by the ratio of the 2022 index to that year\'s index, rounded once'})
constants.sort(key=lambda c: c['id'])

register = {
    'schema': 'neuvetra.verified-factor-register.v1',
    'verifiedBy': 'Claude (Scope 3 completion I-03 builder: programmatic read of the official CSV; FRED index transcribed and cross-checked), 2026-10-30',
    'method': 'EPA Supply Chain GHG Emission Factors v1.3.0 (CO2e, 2017 NAICS-6, kg CO2e per 2022 USD purchaser price, IPCC AR5 GWP-100 applied by EPA, '
              'U.S. GHG data for 2022) read programmatically from the official CSV: for each of the 1,016 codes the published "with margins" (cradle to '
              'shelf) and "without margins" (cradle to factory gate) values exactly as printed; the with-margins value is never recomputed as SEF + MEF '
              '(110 rows differ by 0.001). Electricity (221100) is not in the file. Price index: BEA GDP implicit price deflator (FRED A191RD3A086NBEA), '
              'an economy-wide approximation of EPA\'s commodity-specific deflation, transcribed from two FRED pages that agree.',
    'source': {'publisher': 'U.S. EPA Office of Research and Development',
               'title': f'Supply Chain Greenhouse Gas Emission Factors for US Industries and Commodities ({CSV_NAME})',
               'edition': 'v1.3.0, 5 July 2024 (doi 10.23719/1531143); licence: EPA ScienceHub, public domain, https://pasteur.epa.gov/license/sciencehub-license.html',
               'url': CSV_URL, 'sha256': CSV_SHA, 'bytes': CSV_BYTES},
    'constants': constants,
    'entries': entries,
}
open(OUT, 'w', encoding='utf-8', newline='\n').write(json.dumps(register, ensure_ascii=False, indent=1) + '\n')
print(hashlib.sha256(open(OUT, 'rb').read()).hexdigest(), len(entries), len(constants))
