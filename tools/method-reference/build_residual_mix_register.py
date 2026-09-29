"""Builds verified-electricity-register-egrid2023-greene2025.json: the verified eGRID2023 rev2 register
(copied unchanged) plus, for each eGRID subregion, the two Green-e 2025 Residual Mix inputs the per-gas residual
method uses (decision amendment 2026-09-29): "Net Generation (MWh)" and "Voluntary RE (MWh) (12-month vintage)",
read from the original page saved by Codex (resource-solutions.org/2025-residual-mix/). Green-e's published
adjusted rate is NOT loaded: its gas basis is ambiguous in the source (review finding A05).

Cross-checks, all against primary sources:
- every subregion has exactly one row, and the rows are exactly the 27 eGRID subregions;
- net generation equals eGRID2023 rev2 SRNGENAN (rounded to whole MWh) and voluntary RE emissions are 0;
- Green-e's base "Emission Rate" equals eGRID SRC2ERTA exactly and "CO2 Emissions (tons)" equals SRCO2EQA rounded to whole
  tons (recorded only);
- each published adjusted rate equals tons x 2000 / (net generation - voluntary MWh) within 0.01, which also
  confirms the transcribed voluntary MWh (e.g. SRTV prints "9,6019");
- the per-gas residual CO2e, (CO2 + 28 CH4 + 265 N2O) x gen / (gen - voluntary), equals the published adjusted
  rate within 0.2 lb/MWh for every subregion. The largest absolute and relative differences are computed here and
  written into the register's method text, rounded up (Codex V5-N02: the relative bound is not hand-written).
Usage: build_residual_mix_register.py <page.html> <egrid2023_data_rev2.xlsx> <verified-electricity-register-egrid2023.json> <out.json>"""
import hashlib, html.parser, json, re, sys
from decimal import ROUND_CEILING, Decimal
import openpyxl

PAGE, EGRID, ELECTRICITY_REGISTER, OUT = sys.argv[1:5]
EGRID_SHA = '895cd81dd8662406189ad8adf5a2578dcb362cdb5cff7cca81b10ee6bd2447c6'
page_bytes = open(PAGE, 'rb').read()
PAGE_SHA = hashlib.sha256(page_bytes).hexdigest()
assert hashlib.sha256(open(EGRID, 'rb').read()).hexdigest() == EGRID_SHA


class Tables(html.parser.HTMLParser):
    def __init__(self):
        super().__init__()
        self.rows, self.row, self.cell = [], None, None

    def handle_starttag(self, tag, attrs):
        if tag == 'tr':
            self.row = []
        elif tag in ('td', 'th') and self.row is not None:
            self.cell = []

    def handle_endtag(self, tag):
        if tag in ('td', 'th') and self.cell is not None:
            self.row.append(re.sub(r'\s+', ' ', ''.join(self.cell)).strip())
            self.cell = None
        elif tag == 'tr' and self.row is not None:
            self.rows.append(self.row)
            self.row = None

    def handle_data(self, data):
        if self.cell is not None:
            self.cell.append(data)


parser = Tables()
parser.feed(page_bytes.decode('utf-8'))
header_at = [i for i, r in enumerate(parser.rows) if any('Adjusted System Mix' in c for c in r)]
assert len(header_at) == 1, 'expected exactly one residual-mix table header'
h = header_at[0]
header = parser.rows[h]
col = lambda text: [i for i, c in enumerate(header) if text in c]
(SUB,), (TONS,), (GEN,), (BASE,), (VOLE,), (VOL,), (ADJ,) = (col('Subregion'), col('CO2 Emissions'), col('Net Generation'), col('Emission Rate'),
                                                             col('Voluntary RE emissions'), col('Voluntary RE (MWh)'), col('Adjusted System Mix'))
number = lambda t: Decimal(t.replace(',', ''))

ws = openpyxl.load_workbook(EGRID, read_only=True, data_only=True)['SRL23']
srl = list(ws.iter_rows(min_row=1, values_only=True))
assert srl[1][1] == 'SUBRGN' and srl[1][8] == 'SRNGENAN' and srl[1][17] == 'SRCO2EQA' and srl[1][22:26] == ('SRCO2RTA', 'SRCH4RTA', 'SRN2ORTA', 'SRC2ERTA')
egrid = {row[1]: row for row in srl[2:] if row[1]}
assert len(egrid) == 27

electricity = json.load(open(ELECTRICITY_REGISTER, encoding='utf-8'))
entries = [dict(e, sourceSha256=e.get('sourceSha256', EGRID_SHA)) for e in electricity['entries']]
seen = {}
max_gap = max_rel = Decimal(0)
letter = lambda i: chr(ord('A') + i)
for n, row in enumerate(parser.rows[h + 1:], start=2):
    if len(row) != len(header) or row[SUB] not in egrid:
        continue
    s = row[SUB]
    assert s not in seen, 'duplicate subregion ' + s
    base, adj, tons, gen, vol = (number(row[i]) for i in (BASE, ADJ, TONS, GEN, VOL))
    assert base == Decimal(repr(egrid[s][25])), f'{s}: base rate {base} is not eGRID2023 rev2 SRC2ERTA {egrid[s][25]}'
    assert tons == Decimal(round(egrid[s][17])), f'{s}: CO2 tons {tons} is not eGRID2023 rev2 SRCO2EQA {egrid[s][17]}'
    assert gen == Decimal(round(egrid[s][8])), f'{s}: net generation {gen} is not eGRID2023 rev2 SRNGENAN {egrid[s][8]}'
    assert number(row[VOLE]) == 0 and 0 <= vol < gen, f'{s}: voluntary RE emissions must be 0 and voluntary MWh below generation'
    derived = tons * 2000 / (gen - vol)
    assert abs(derived - adj) <= Decimal('0.01'), f'{s}: adjusted {adj} vs derived {derived}'
    co2, ch4, n2o = (Decimal(repr(egrid[s][c])) for c in (22, 23, 24))
    gap = abs((co2 + 28 * ch4 + 265 * n2o) * gen / (gen - vol) - adj)
    assert gap <= Decimal('0.2'), f'{s}: per-gas residual CO2e differs from the published adjusted rate by {gap}'
    max_gap = max(max_gap, gap)
    max_rel = max(max_rel, 100 * gap / adj)
    seen[s] = True
    for key, idx, unit, what in (('net_generation_mwh', GEN, 'MWh', 'net generation'),
                                 ('voluntary_re_mwh', VOL, 'MWh (Green-e certified voluntary renewable sales, 12-month vintage, removed at zero emissions)', 'voluntary RE')):
        text = row[idx].replace(',', '')  # the page prints thousands separators (and SRTV voluntary as "9,6019")
        assert re.fullmatch(r'(0|[1-9][0-9]{0,11})(\.[0-9]{1,12})?', text), row[idx]
        entries.append({'id': f'residual_mix_green_e_2025.{s}.{key}', 'table': 'Green-e 2025 Residual Mix Emissions Rates (2023 data), 12-month vintage',
                        'sheet': 'resource-solutions.org/2025-residual-mix/ table', 'valueCell': f'{letter(idx)}{n}', 'value': text.rstrip('0').rstrip('.') if '.' in text else text,
                        'unit': unit, 'labelCells': [f'{letter(SUB)}{n}', f'{letter(idx)}1'], 'label': f'{s} residual mix {what}', 'sourceSha256': PAGE_SHA})
assert sorted(seen) == sorted(egrid), sorted(set(egrid) ^ set(seen))

register = {
    'schema': 'neuvetra.verified-factor-register.v1',
    'verifiedBy': 'Claude (method author, AI), 2026-09-29; independent review by Codex is recorded separately',
    'method': electricity['method'] + ' Green-e 2025 Residual Mix (Center for Resource Solutions, 2023 data, released 2026-01-29; applied to 2025 reporting by Neuvetra decision 2026-09-28): '
              'Net Generation (MWh) and Voluntary RE (MWh, 12-month vintage) for each of the 27 subregions, read from the original page (valueCell = column letter '
              'and row of the published table, header = row 1). Net generation equals eGRID2023 rev2 SRNGENAN rounded to whole MWh (Green-e publishes whole MWh; '
              'eGRID reports fractions), and voluntary RE emissions are 0, for all 27. '
              'Per-gas residual rate = eGRID rate x gen / (gen - voluntary); with AR5 it reproduces each published adjusted rate within '
              + format(max_gap.quantize(Decimal('0.001'), ROUND_CEILING), 'f') + ' lb/MWh (at most ' + format(max_rel.quantize(Decimal('0.001'), ROUND_CEILING), 'f') + '%). '
              'The published adjusted rate itself is not loaded because the source labels it CO2 while its values follow eGRID CO2e.',
    'source': electricity['source'],
    'constants': electricity['constants'],
    'entries': entries,
}
open(OUT, 'w', encoding='utf-8', newline='\n').write(json.dumps(register, ensure_ascii=False, indent=1) + '\n')
print(hashlib.sha256(open(OUT, 'rb').read()).hexdigest(), len(entries), 'page', PAGE_SHA, len(page_bytes))
