"""Scope 3 completion I-03 part 1: purchases (DESIGN 4.3, 4.4, 4.6, 8.1; A12, A19-A21).

Covers R2 (EPA Supply Chain GHG Emission Factors v1.3 + the FRED GDP deflator transcription), `purchase_spend`,
`purchase_supplier` (supplier-specific, company-typed secondary factor, hybrid boundary), the method metadata, the DESIGN
3.3 code sets in the catalog, and the aggregate's fixed origins (A19) and unverified defaults (A20).

Expected values never come from the engine: the TV-S vectors are research/methods-purchases.md section 6.8 (worked from
the official CSV by another agent) and are recomputed here with exact fractions from the register cells they name; the
GHG Protocol worked examples (calculation guidance 1.1, 1.4, 4.4) and the Entergy 2025 spend rows use their own printed
factors through a test-only patched register (`patched_spend_register`), never register factors. When
NEUVETRA_METHOD_SOURCES_DIR holds the official CSV, every R2 value is also compared with the CSV cell it names and the
builder must reproduce R2 byte for byte. Run: python -m unittest scope3_engine_purchases_test
"""
import contextlib
import csv
import hashlib
import io
import json
import os
import random
import shutil
import subprocess
import sys
import tempfile
import unittest
from decimal import Decimal, ROUND_HALF_EVEN, localcontext
from fractions import Fraction as F
from pathlib import Path

import scope3_engine as e
from scope3_engine_batch_test import fake_methods

P = {'start': '2025-01-01', 'endExclusive': '2026-01-01'}
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
REF = ROOT / 'packages/neuvetra-database/src/method-reference'
R2_PATH = REF / 'verified-scope3-spend-register-epa-scghg-v1.3.json'
R2_RAW = R2_PATH.read_bytes()
R2 = json.loads(R2_RAW.decode('utf-8'))
V = {x['id']: x for x in R2['entries']}
C = {x['id']: x for x in R2['constants']}
FRED_INPUT = ROOT / 'tools/method-reference/inputs/fred-A191RD3A086NBEA.json'
BUILDER = ROOT / 'tools/method-reference/build_scope3_spend_register.py'
CSV_SHA = '6025a14c4fe16675735efba1683030e4d36011e3973f3c4261f8231aa69c002f'
NONE = {'dataQuality': None, 'activityDataOrigin': None}
SPEND_MID, SUP_MID, ACT_MID = 'scope3.spend.epa_scghg_v1_3.v1', 'scope3.cat1_2.supplier_specific.v1', 'scope3.cat1_2.average_data_user_factor.v1'


def text(q: F) -> str:
    """The exact decimal text of a terminating fraction (asserted terminating), as the engine writes it."""
    with localcontext() as ctx:
        ctx.prec = 200
        d = Decimal(q.numerator) / Decimal(q.denominator)
    assert F(d) == q, 'not a terminating decimal'
    t = format(d, 'f')
    return t.rstrip('0').rstrip('.') if '.' in t else t


def fixed(q: F, places: int) -> str:
    with localcontext() as ctx:
        ctx.prec = 100
        d = Decimal(q.numerator) / Decimal(q.denominator)
        return format(d.quantize(Decimal(1).scaleb(-places), rounding=ROUND_HALF_EVEN), f'.{places}f')


def r12(q: F) -> F:
    return F(round(q * 10 ** 12), 10 ** 12)


def kg(q: F) -> dict:
    return {'unrounded': text(q), 'display': fixed(q, 4), 'unit': 'kg CO2e', 'rounding': 'half_even_4dp_once'}


def spend(**over) -> dict:
    inp = {'period': P, 'category': 1, 'naicsCode': '541511', 'amount': '125000.00', 'currency': 'USD', 'dollarYear': 2022, 'marginChoice': 'with_margins',
           'boughtAtFactoryGate': False, 'capitalFullCost': None}
    inp.update(over)
    return {'kind': 'purchase_spend', 'input': inp}


def supplier(**over) -> dict:
    inp = {'period': P, 'category': 1, 'factorOrigin': 'supplier_primary', 'basis': 'product_factor', 'quantity': '200000', 'unit': 'kg', 'factorValue': '0.15',
           'factorUnit': 'kg CO2e per kg', 'allocationNumerator': None, 'allocationDenominator': None, 'boundary': 'cradle_to_gate', 'hybridUpstreamCoveredBy': None,
           'gwpBasis': 'AR5', 'verification': 'third_party_verified'}
    inp.update(over)
    return {'kind': 'purchase_supplier', 'input': inp}


def allocated(**over) -> dict:
    return supplier(**dict({'basis': 'allocated_total', 'unit': 'kg CO2e', 'factorValue': None, 'factorUnit': None}, **over))


def calc(req) -> dict:
    return e.calculate(req)


def refusal(req) -> str:
    try:
        e.calculate(req)
    except e.Refused as x:
        return x.code
    raise AssertionError('not refused')


# Round 2 (ENG-5, ACC-8): the official public-domain CSV is committed byte for byte, so the R2 rebuild test runs in CI too.
COMMITTED_CSV_DIR = HERE.parents[3] / 'tools/method-reference/sources/epa-scghg-v1.3'


def sources_csv() -> Path | None:
    """The official CSV, found by SHA-256 in the committed copy or in NEUVETRA_METHOD_SOURCES_DIR (as the method-reference suites
    find originals)."""
    for folder in [str(COMMITTED_CSV_DIR)] + list(filter(None, os.environ.get('NEUVETRA_METHOD_SOURCES_DIR', '').split(os.pathsep))):
        for p in sorted(Path(folder).glob('*.csv')):
            if hashlib.sha256(p.read_bytes()).hexdigest() == CSV_SHA:
                return p
    return None


@contextlib.contextmanager
def patched_spend_register(entries=(), constants=()):
    """Test-only: a copy of R2 with extra or replaced entries/constants, pinned under its own SHA for the duration of a test
    (illustrative GHG Protocol factors and the Entergy rows never enter the real register)."""
    reg = json.loads(R2_RAW.decode('utf-8'))
    ent = {x['id']: x for x in reg['entries']}
    for code, value in entries:
        ent[f'epa_scghg_v130.{code}.with_margins'] = {'id': f'epa_scghg_v130.{code}.with_margins', 'table': 'test only', 'sheet': 'test only', 'valueCell': 'test only',
                                                     'value': value, 'unit': 'kg CO2e per USD (illustrative)', 'labelCells': [], 'label': f'test only {code}'}
    con = {x['id']: x for x in reg['constants']}
    for cid, value in constants:
        con[cid] = dict(con[cid], value=value)
    reg['entries'], reg['constants'] = sorted(ent.values(), key=lambda x: x['id']), sorted(con.values(), key=lambda x: x['id'])
    raw = json.dumps(reg).encode('utf-8')
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / 'r2.json'
        path.write_bytes(raw)
        saved, cached = dict(e.REGISTERS['spend']), e._LOADED_REGISTERS.pop('spend', None)
        e.REGISTERS['spend'] = {'path': path, 'sha256': hashlib.sha256(raw).hexdigest()}
        try:
            yield
        finally:
            e.REGISTERS['spend'] = saved
            e._LOADED_REGISTERS.pop('spend', None)
            if cached is not None:
                e._LOADED_REGISTERS['spend'] = cached


class SpendRegister(unittest.TestCase):
    def test_pinned_bytes_shape_and_published_facts(self):
        self.assertEqual(hashlib.sha256(R2_RAW).hexdigest(), e.SPEND_REGISTER_SHA256)
        self.assertEqual((e.REGISTERS['spend']['path'], e.REGISTERS['spend']['sha256']), (R2_PATH, e.SPEND_REGISTER_SHA256))
        # The 0024 loader shape: six top-level keys, allowed entry and constant keys only, every value a string.
        self.assertEqual(sorted(R2), ['constants', 'entries', 'method', 'schema', 'source', 'verifiedBy'])
        self.assertEqual(R2['schema'], 'neuvetra.verified-factor-register.v1')
        self.assertEqual({k: R2['source'][k] for k in ('url', 'sha256', 'bytes')}, {
            'url': 'https://pasteur.epa.gov/uploads/10.23719/1531143/SupplyChainGHGEmissionFactors_v1.3.0_NAICS_CO2e_USD2022.csv', 'sha256': CSV_SHA, 'bytes': 123481})
        allowed = {'id', 'label', 'labelCells', 'sheet', 'table', 'unit', 'value', 'valueCell', 'fuel', 'modelYear', 'vehicleType', 'gwpSet', 'composition', 'sourceSha256'}
        for x in R2['entries']:
            self.assertTrue(set(x) <= allowed and all(isinstance(v, str) for k, v in x.items() if k != 'labelCells'), x['id'])
            self.assertTrue(e.FACTOR_TEXT.fullmatch(x['value']), x['id'])
        for x in R2['constants']:
            self.assertTrue(set(x) <= {'id', 'value', 'unit', 'basis', 'sourceSha256'} and all(isinstance(v, str) for v in x.values()), x['id'])
        # 1,016 codes x 2 published columns. About v1.3 counts 353 distinct (without, margin, with) sets; R2 keeps no margin
        # column, and one pair (0.184, 0.21) is published with margins 0.025 and 0.026 (each column rounded on its own), so
        # R2 has 352 distinct (without, with) pairs. The 353 sets are checked against the CSV below and in the builder.
        self.assertEqual(len(R2['entries']), 2032)
        codes = sorted({k.split('.')[1] for k in V})
        self.assertEqual(len(codes), 1016)
        self.assertEqual({k.split('.')[2] for k in V}, {'with_margins', 'without_margins'})
        self.assertNotIn('221100', codes)
        self.assertTrue(all(F(x['value']) > 0 for x in R2['entries']))
        self.assertEqual(len({(V[f'epa_scghg_v130.{c}.without_margins']['value'], V[f'epa_scghg_v130.{c}.with_margins']['value']) for c in codes}), 352)
        # The rounding trap: 111130 is published 0.848 with margins, although 0.809 + 0.04 = 0.849.
        self.assertEqual((V['epa_scghg_v130.111130.with_margins']['value'], V['epa_scghg_v130.111130.without_margins']['value']), ('0.848', '0.809'))
        self.assertEqual(V['epa_scghg_v130.111130.with_margins']['valueCell'], 'row 4 column Supply Chain Emission Factors with Margins')
        self.assertEqual(V['epa_scghg_v130.327310.with_margins']['label'], 'Cement Manufacturing')
        self.assertEqual({V[f'epa_scghg_v130.{c}.with_margins']['unit'] for c in codes}, {'kg CO2e/2022 USD, purchaser price'})

    def test_price_index_constants_are_the_fred_transcription(self):
        raw = FRED_INPUT.read_bytes()
        fred = json.loads(raw.decode('utf-8'))
        self.assertIn(hashlib.sha256(raw).hexdigest(), BUILDER.read_text('utf-8'))  # the builder pins the transcription
        index = {k: v['value'] for k, v in C.items() if k.startswith('price_index.gdp_deflator.')}
        self.assertEqual(index, {f'price_index.gdp_deflator.{y}': v for y, v in fred['observations'].items()})
        self.assertEqual(sorted(int(k.rsplit('.', 1)[1]) for k in index), list(range(2012, 2026)))
        # research/methods-purchases.md section 3 (read on 2026-10-30 by another agent) for 2019-2025.
        self.assertEqual([index[f'price_index.gdp_deflator.{y}'] for y in range(2019, 2026)], ['103.979', '105.377', '110.159', '118.026', '122.451', '125.587', '128.893'])
        self.assertEqual(C['price_index.base_year']['value'], '2022')
        for k in index:
            self.assertIn('A191RD3A086NBEA', C[k]['basis'])
            self.assertIn('2026-09-30', C[k]['basis'])
            self.assertIn('commodity-specific', C[k]['basis'])

    def test_every_value_equals_the_official_csv_cell_and_the_builder_reproduces_r2(self):
        path = sources_csv()
        if path is None:
            if os.environ.get('NEUVETRA_METHOD_SOURCES_REQUIRED') == '1':
                self.fail('NEUVETRA_METHOD_SOURCES_REQUIRED=1 but the official EPA v1.3 CO2e CSV (sha256 6025a14c...) is missing')
            self.skipTest('NEUVETRA_METHOD_SOURCES_DIR does not hold the official EPA v1.3 CO2e CSV (sha256 6025a14c...)')
        rows = list(csv.reader(io.StringIO(path.read_bytes().decode('utf-8'), newline='')))
        header = rows[0]
        for x in R2['entries']:
            n, column = x['valueCell'].split(' column ', 1)
            row = rows[int(n.split(' ')[1]) - 1]
            self.assertEqual((row[0], row[1], row[header.index(column)]), (x['id'].split('.')[1], x['label'], x['value']), x['id'])
        self.assertEqual(len(rows) - 1, 1016)
        self.assertEqual(len({tuple(r[4:7]) for r in rows[1:]}), 353)  # About v1.3: 353 unique (SEF, MEF, SEF+MEF) sets
        self.assertEqual(rows[3][:7], ['111130', 'Dry Pea and Bean Farming', 'All GHGs', 'kg CO2e/2022 USD, purchaser price', '0.809', '0.04', '0.848'])
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / 'r2.json'
            p = subprocess.run([sys.executable, '-I', str(BUILDER), str(path), str(FRED_INPUT), str(out)], capture_output=True)
            self.assertEqual(p.returncode, 0, p.stderr.decode())
            self.assertEqual(out.read_bytes(), R2_RAW)

    def test_a_changed_spend_register_stops_only_the_methods_that_read_it(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'apps/site-api/src/calculation').mkdir(parents=True)
            shutil.copytree(REF, root / 'packages/neuvetra-database/src/method-reference')
            shutil.copy(HERE / 'scope3_engine.py', root / 'apps/site-api/src/calculation/scope3_engine.py')
            target = root / 'packages/neuvetra-database/src/method-reference' / R2_PATH.name
            target.write_bytes(R2_RAW.replace(b'"0.848"', b'"0.849"', 1))
            engine = str(root / 'apps/site-api/src/calculation/scope3_engine.py')

            def cli(payload):
                p = subprocess.run([sys.executable, engine], input=json.dumps(payload).encode(), capture_output=True)
                return p.returncode, json.loads(p.stdout)
            self.assertEqual(cli({'action': 'calculate', 'request': spend(naicsCode='111130')}), (2, {'status': 'error', 'code': 'scope3_engine_unavailable'}))
            # Input the engine refuses is refused before R2 is read, whatever state R2 is in.
            self.assertEqual(cli({'action': 'calculate', 'request': spend(amount='-1')}), (1, {'status': 'refused', 'code': 'invalid_quantity'}))
            self.assertEqual(cli({'action': 'calculate', 'request': spend(currency='EUR')}), (1, {'status': 'refused', 'code': 'unsupported_currency'}))
            waste = {'kind': 'waste', 'input': {'period': P, 'category': 5, 'material': 'mixed_msw', 'treatment': 'landfilled', 'quantity': '2', 'unit': 'short_ton'}}
            self.assertEqual(cli({'action': 'calculate', 'request': waste})[1]['result']['total']['display'], '1160.0000')
            code, out = cli({'action': 'calculate_many', 'requests': [waste, spend(), supplier()]})
            self.assertEqual((code, [i['status'] for i in out['results']]), (0, ['ok', 'error', 'ok']))


class SpendVectors(unittest.TestCase):
    """research/methods-purchases.md 6.8 TV-S1..S8: expected kg recomputed from the named register cells; the printed value
    of each vector is asserted too."""

    def check(self, req, key, printed, ratio=F(1)):
        r = calc(req)
        q = F(req['input']['amount']) * F(V[key]['value']) * ratio
        self.assertEqual((r['status'], r['total']['unrounded'], r['total']['display']), ('complete', text(q), printed))
        self.assertEqual(r['co2eWithoutGasSplit'], {'co2e': text(q), 'co2eUnit': 'kg CO2e', 'gwpSetId': 'AR5-100',
                                                    'reason': 'EPA Supply Chain GHG Emission Factors v1.3 publish CO2e only (AR5 100-year GWPs applied by EPA)'})
        self.assertEqual(r['gases'], {})
        self.assertEqual([f['key'] for f in r['factorsUsed']], [key])
        self.assertEqual(r['factorsUsed'][0]['cell'], V[key]['valueCell'])
        self.assertEqual(r['additionalRegisters'], [{'name': 'spend', 'sha256': e.SPEND_REGISTER_SHA256}])
        self.assertEqual((r['methodVersionId'], r['gwpSetId'], r['registerSha256']), (SPEND_MID, 'AR5-100', e.REGISTER_SHA256))
        return r

    def test_tv_s1_custom_programming_services(self):
        r = self.check(spend(), 'epa_scghg_v130.541511.with_margins', '10500.0000')
        self.assertEqual((r['conversions'], r['estimates']), ([], []))
        self.assertEqual(r['boundary'], {'minimumBoundary': 'met', 'notes': ['cradle_to_shelf_including_margins', 'factor_ghg_year_2022', 'us_national_sector_average']})
        self.assertEqual(r['activity'], {'amount': '125000', 'currency': 'USD', 'dollarYear': 2022, 'naicsCode': '541511', 'marginChoice': 'with_margins', 'nominalCo2e': '10500'})
        self.assertEqual(r['constantsUsed'], [{'id': 'price_index.base_year', 'value': '2022', 'unit': 'year (dollar year of every factor)'}])

    def test_tv_s2_cement_with_and_without_margins(self):
        self.check(spend(naicsCode='327310', amount='10000.00'), 'epa_scghg_v130.327310.with_margins', '39240.0000')
        r = self.check(spend(naicsCode='327310', amount='10000.00', marginChoice='without_margins', boughtAtFactoryGate=True), 'epa_scghg_v130.327310.without_margins', '38460.0000')
        self.assertIn('cradle_to_gate_factory_price', r['boundary']['notes'])

    def test_tv_s3_truckload_freight_category_4_is_a_fallback(self):
        r = self.check(spend(category=4, naicsCode='484121', amount='20000.00'), 'epa_scghg_v130.484121.with_margins', '11900.0000')
        self.assertEqual((r['category'], 'spend_based_fallback' in r['boundary']['notes']), (4, True))

    def test_tv_s4_published_with_margins_never_sef_plus_mef(self):
        r = self.check(spend(naicsCode='111130', amount='1000.00'), 'epa_scghg_v130.111130.with_margins', '848.0000')
        self.assertNotEqual(r['total']['display'], '849.0000')

    def test_tv_s5_deflated_with_the_transcribed_index(self):
        ratio = r12(F(C['price_index.gdp_deflator.2022']['value']) / F(C['price_index.gdp_deflator.2024']['value']))
        self.assertEqual(text(ratio), '0.939794723976')
        r = self.check(spend(amount='100000.00', dollarYear=2024), 'epa_scghg_v130.541511.with_margins', '7894.2757', ratio)
        self.assertEqual(r['total']['unrounded'], '7894.2756813984')
        self.assertEqual(r['conversions'], [{'quantity': 'price ratio = I2022 / I2024 (BEA GDP implicit price deflator, FRED A191RD3A086NBEA; economy-wide, not commodity-specific)',
                                             'numerator': '118.026', 'denominator': '125.587', 'result': '0.939794723976', 'rounded': True, 'places': 12, 'rounding': 'half_even'}])
        self.assertEqual((r['estimates'], r['activity']['priceRatio'], r['activity']['nominalCo2e']), (['economy_wide_price_index'], '0.939794723976', '8400'))
        self.assertEqual([c['id'] for c in r['constantsUsed']], ['price_index.base_year', 'price_index.gdp_deflator.2022', 'price_index.gdp_deflator.2024'])

    def test_tv_s6_computer_manufacturing_at_the_factory_gate(self):
        self.check(spend(naicsCode='334111', amount='2500.00', marginChoice='without_margins', boughtAtFactoryGate=True), 'epa_scghg_v130.334111.without_margins', '75.0000')
        self.check(spend(naicsCode='334111', amount='2500.00'), 'epa_scghg_v130.334111.with_margins', '145.0000')

    def test_tv_s7_electricity_is_held_never_zero(self):
        r = calc(spend(naicsCode='221100', amount='5000.00'))
        self.assertEqual((r['status'], r['findings'], r['total'], r['co2eWithoutGasSplit'], r['factorsUsed']), ('input_needed', ['naics_code_not_in_factor_set'], None, None, []))
        self.assertEqual(r['additionalRegisters'], [{'name': 'spend', 'sha256': e.SPEND_REGISTER_SHA256}])  # decided from R2
        a = e.aggregate([r])
        self.assertEqual((a['categorySubtotals'], a['notCalculated'][0]['findings'], a['categoryProfiles']), ({}, ['naics_code_not_in_factor_set'], {}))

    def test_tv_s8_capital_goods_at_full_cost(self):
        r = self.check(spend(category=2, naicsCode='236220', amount='1000000.00', capitalFullCost=True), 'epa_scghg_v130.236220.with_margins', '224000.0000')
        self.assertIn('capital_goods_full_cost_in_acquisition_year', r['boundary']['notes'])
        for full in (None, False):
            self.assertEqual(refusal(spend(category=2, naicsCode='236220', amount='1000000.00', capitalFullCost=full)), 'capital_goods_must_be_full_cost')

    def test_dollar_years(self):
        # 2012-2035 accepted (A25); a year without a registered index is held, never extrapolated.
        for year in (2012, 2019, 2025):
            ratio = r12(F(C['price_index.gdp_deflator.2022']['value']) / F(C[f'price_index.gdp_deflator.{year}']['value']))
            self.check(spend(dollarYear=year), 'epa_scghg_v130.541511.with_margins', fixed(F('125000') * F('0.084') * ratio, 4), ratio)
        for year in (2026, 2035):
            r = calc(spend(dollarYear=year))
            self.assertEqual((r['status'], r['findings']), ('input_needed', ['dollar_year_index_missing']))
        both = calc(spend(dollarYear=2030, naicsCode='221100'))
        self.assertEqual(both['findings'], ['dollar_year_index_missing', 'naics_code_not_in_factor_set'])
        for year in (2011, 2036, '2024', True, 2024.0, None):
            self.assertEqual(refusal(spend(dollarYear=year)), 'invalid_dollar_year', year)

    def test_category_notes_and_estimates(self):
        for category in (3, 5, 6):
            r = calc(spend(category=category))
            self.assertEqual((r['category'], 'spend_based_fallback' in r['boundary']['notes']), (category, True))
        nine = calc(spend(category=9, naicsCode='484121'))
        self.assertEqual((nine['estimates'], 'spend_based_fallback' in nine['boundary']['notes']), (['downstream_spend_estimated_by_company'], True))
        one = calc(spend(category=1))
        self.assertEqual((one['estimates'], 'spend_based_fallback' in one['boundary']['notes']), ([], False))

    def test_refusals(self):
        cases = [
            (spend(category=7), 'invalid_category'), (spend(category=0), 'invalid_category'), (spend(category=True), 'invalid_category'), (spend(category='1'), 'invalid_category'),
            (spend(category=1.0), 'invalid_category'), (spend(currency='EUR'), 'unsupported_currency'), (spend(currency='usd'), 'unsupported_currency'),
            (spend(naicsCode='54151'), 'invalid_naics_code'), (spend(naicsCode=541511), 'invalid_naics_code'), (spend(naicsCode=None), 'invalid_naics_code'),
            (spend(amount='-5'), 'invalid_quantity'), (spend(amount='1,000'), 'invalid_quantity'), (spend(amount='1.2345'), 'invalid_quantity'), (spend(amount=100), 'invalid_quantity'),
            (spend(marginChoice='with'), 'invalid_margin_choice'), (spend(boughtAtFactoryGate='yes'), 'invalid_factory_gate'),
            (spend(marginChoice='without_margins'), 'without_margins_requires_factory_gate'), (spend(capitalFullCost='true'), 'invalid_capital_full_cost'),
            (spend(period={'start': '2024-01-01', 'endExclusive': '2025-01-01'}), 'period_outside_2025_method_envelope'),
        ]
        for req, code in cases:
            self.assertEqual(refusal(req), code, req['input'])
        extra = spend()
        extra['input']['description'] = 'Office supplies'
        missing = spend()
        del missing['input']['currency']
        for req in (extra, missing):
            self.assertEqual(refusal(req), 'invalid_input_shape')

    def test_ghgp_1_4_spend_part_and_4_4_through_a_patched_register(self):
        """Calculation guidance p.34-35 (1.4, spend part: 11,700 kg) and p.66 (4.4: 7,300 kg; the printed unit "kg CO2e/$" is a
        typo for kg CO2e). Illustrative factors (labelled "illustrative only") under test-only codes, 2022 dollars."""
        lines_14 = [('900001', '5000', '0.3'), ('900002', '3000', '0.3'), ('900003', '4000', '0.3'), ('900004', '6000', '0.5'), ('900005', '1500', '0.2'),
                    ('900006', '5000', '0.2'), ('900007', '5000', '0.3'), ('900008', '1000', '0.3'), ('900009', '5000', '0.4')]
        lines_44 = [('900011', '20000', '0.04'), ('900012', '30000', '0.15'), ('900013', '40000', '0.05')]
        with patched_spend_register(entries=[(c, f) for c, _, f in lines_14 + lines_44]):
            one = [calc(spend(naicsCode=c, amount=a)) for c, a, _ in lines_14]
            four = [calc(spend(category=4, naicsCode=c, amount=a)) for c, a, _ in lines_44]
            self.assertEqual([r['total']['display'] for r in four], ['800.0000', '4500.0000', '2000.0000'])
            both = e.aggregate(one + four)
            self.assertEqual((both['categorySubtotals']['1']['display'], both['categorySubtotals']['4']['display']), ('11700.0000', '7300.0000'))
            self.assertEqual(sum(F(amount) * F(f) for _, amount, f in lines_14), 11700)
            self.assertEqual(sum(F(amount) * F(f) for _, amount, f in lines_44), 7300)
            # GHGP 1.4 whole (54,100): the mass part (42,400) through the company-typed secondary factor method.
            mass = [('400', '20'), ('200', '10'), ('500', '40'), ('100', '70'), ('1500', '3'), ('300', '3')]
            avg = [calc(supplier(factorOrigin='secondary_database', quantity=q, factorValue=f, verification='unverified')) for q, f in mass]
            b = e.aggregate(one + avg)
            self.assertEqual(b['categorySubtotals']['1']['display'], '54100.0000')
            p = b['categoryProfiles']['1']
            self.assertEqual(p['methodTypes'], {'activity_average_data': kg(F(42400)), 'spend_based': kg(F(11700))})
            self.assertEqual(p['valueChain']['percent'], {'value': '0', 'display': '0.0'})  # secondary factors and spend are company records

    def test_entergy_2025_spend_rows_with_the_printed_deflator(self):
        """Entergy 2025 Corporate GHG Inventory p.11 (research/vectors/entergy-2025.json): kg = spend x 0.794 x (CO2 + CH4 x 28 +
        N2O x 265 + other). The printed factors (summary EEIO by gas, not v1.3) go through a patched register; the index pair
        I2022 = 0.794, I2025 = 1 gives the printed ratio exactly. Entergy rounds the deflated spend to cents, so each row agrees
        within the vector's 1e-4 relative tolerance."""
        rows = ENTERGY_ROWS
        self.assertEqual(len(rows), 12)
        entries = []
        for i, row in enumerate(rows):
            f = row['factors']
            per_usd = F(f['kg_co2_per_usd']) + F(f['kg_ch4_per_usd']) * 28 + F(f['kg_n2o_per_usd']) * 265 + F(f['kg_co2e_other_per_usd'])
            entries.append((f'9001{i:02d}', text(per_usd)))
        with patched_spend_register(entries=entries, constants=[('price_index.gdp_deflator.2022', '0.794'), ('price_index.gdp_deflator.2025', '1')]):
            results = []
            for (code, per_usd), row in zip(entries, rows):
                r = calc(spend(naicsCode=code, amount=row['inputs']['spend_2025_usd'], dollarYear=2025))
                self.assertEqual(r['activity']['priceRatio'], '0.794')
                got, published = F(r['total']['unrounded']), F(row['expected']['kg_co2e'])
                self.assertEqual(got, F(row['inputs']['spend_2025_usd']) * F('0.794') * F(per_usd))
                self.assertLessEqual(abs(got - published), published / 10000, row['inputs']['commodity'])
                if row['inputs']['commodity'] == 'Machinery':
                    # Source anomaly, asserted as published and flagged: the CH4 factor equals the CO2 factor (0.167), so CH4 x 28
                    # dominates. The arithmetic reproduces; the value is not a plausible machinery factor.
                    self.assertEqual(row['factors']['kg_ch4_per_usd'], row['factors']['kg_co2_per_usd'])
                    self.assertEqual(per_usd, '4.886')
                results.append(r)
            self.assertEqual(e.aggregate(results)['categorySubtotals']['1']['unrounded'], text(sum((F(r['total']['unrounded']) for r in results), F(0))))


# research/vectors/entergy-2025.json, category 1 rows (pdf p.11), copied so the test runs without the research folder.
ENTERGY_ROWS = [
    {'category': 1, 'inputs': {'commodity': c, 'spend_2025_usd': s}, 'factors': {'kg_co2_per_usd': f1, 'kg_ch4_per_usd': f2, 'kg_n2o_per_usd': f3, 'kg_co2e_other_per_usd': f4},
     'expected': {'kg_co2e': x}}
    for c, s, f1, f2, f3, f4, x in (
        ('Administrative and support services', '341475914.06', '0.088', '0.001', '0', '0.004', '32535825.09'),
        ('Chemical products', '46086103.15', '0.282', '0.001', '0', '0.01', '11709557.09'),
        ('Computer and electronic products', '241376274.39', '0.043', '0', '0', '0.004', '9007679.81'),
        ('Construction', '110815343.82', '0.259', '0.002', '0', '0.02', '29475773.30'),
        ('Electrical equipment, appliances and components', '643234871.88', '0.197', '0.001', '0', '0.011', '120531923.23'),
        ('Fabricated metal product', '4704269.70', '0.225', '0.001', '0', '0.008', '974884.63'),
        ('Machinery', '69216759.80', '0.167', '0.167', '0', '0.043', '268525312.18'),
        ('Miscellaneous professional, scientific, and technical services', '161064568.08', '0.109', '0.001', '0', '0.004', '18031822.65'),
        ('Motor vehicles, bodies and trailers', '108676576.69', '0.174', '0.001', '0', '0.019', '19069913.62'),
        ('Petroleum and coal products', '23687959.04', '0.755', '0.018', '0', '0.005', '23773614.70'),
        ('Utilities', '965933675.26', '2.884', '0.005', '0', '0.01', '2326930359.97'),
        ('Waste management and remediation', '87119890.36', '0.274', '0.044', '0', '0.013', '105074080.08'),
    )
]


class SupplierVectors(unittest.TestCase):
    def test_ghgp_1_1_supplier_specific_product_factors(self):
        """Calculation guidance p.25 (example 1.1): 145,000 kg CO2e (illustrative factors entered as supplier data)."""
        lines = [('200000', '0.15'), ('600000', '0.10'), ('200000', '0.10'), ('100000', '0.25'), ('50000', '0.20')]
        results = [calc(supplier(quantity=q, factorValue=f)) for q, f in lines]
        self.assertEqual([r['total']['display'] for r in results], ['30000.0000', '60000.0000', '20000.0000', '25000.0000', '10000.0000'])
        r = results[0]
        self.assertEqual((r['methodVersionId'], r['gwpSetId'], r['boundary'], r['factorsUsed'], r['constantsUsed']),
                         (SUP_MID, 'AS-REPORTED', {'minimumBoundary': 'met', 'notes': ['supplier_gwp_basis_ar5']}, [], []))
        self.assertEqual(r['co2eWithoutGasSplit'], {'co2e': '30000', 'co2eUnit': 'kg CO2e', 'gwpSetId': 'AS-REPORTED',
                                                    'reason': 'Supplier-reported CO2e, declared GWP basis AR5; used as reported, not split by gas or restated'})
        self.assertNotIn('additionalRegisters', r)
        a = e.aggregate(results)
        self.assertEqual((a['categorySubtotals']['1']['display'], a['gwpSetsUsed']), ('145000.0000', ['AS-REPORTED']))
        p = a['categoryProfiles']['1']
        self.assertEqual((p['dominantMethodType'], p['valueChain']['percent']), ('supplier_specific', {'value': '100', 'display': '100.0'}))

    def test_allocated_totals_shares_and_units(self):
        # Hybrid S1+S2 of calculation guidance example 1.2/1.3 (electricity 5,000 kWh x 0.5 + gas 2,500 kWh x 0.2 = 3,000 kg),
        # allocated by the supplier, with the upstream covered by other records: boundary met.
        hybrid = calc(allocated(quantity='3000', boundary='supplier_scope1_2_only', hybridUpstreamCoveredBy='other_records'))
        self.assertEqual((hybrid['total']['display'], hybrid['boundary']), ('3000.0000', {'minimumBoundary': 'met', 'notes': ['hybrid_upstream_from_other_records', 'supplier_gwp_basis_ar5']}))
        missing = calc(allocated(quantity='3000', boundary='supplier_scope1_2_only', hybridUpstreamCoveredBy='none'))
        self.assertEqual((missing['status'], missing['boundary']), ('complete', {'minimumBoundary': 'partial', 'notes': ['hybrid_upstream_missing', 'supplier_gwp_basis_ar5']}))
        self.assertEqual(e.aggregate([missing])['partialBoundaryResults'][0]['notes'], ['hybrid_upstream_missing', 'supplier_gwp_basis_ar5'])
        # Metric tons x 1000 (R1 constant), share = numerator / denominator rounded once to 12 dp and listed.
        share = r12(F('1250') / F('7000'))
        r = calc(allocated(quantity='420.5', unit='metric_ton CO2e', allocationNumerator='1250', allocationDenominator='7000', gwpBasis='AR6', verification='unverified'))
        self.assertEqual(r['total']['unrounded'], text(F('420.5') * 1000 * share))
        self.assertEqual(r['conversions'], [{'quantity': 'allocation share = numerator / denominator', 'numerator': '1250', 'denominator': '7000', 'result': text(share),
                                             'rounded': True, 'places': 12, 'rounding': 'half_even'}])
        self.assertEqual(r['constantsUsed'], [{'id': 'metric_ton_to_kg', 'value': '1000', 'unit': 'kg per metric ton'}])
        self.assertEqual((r['activity']['allocationShare'], r['boundary']['notes']), (text(share), ['supplier_data_unverified', 'supplier_gwp_basis_ar6']))
        self.assertEqual(calc(allocated(quantity='5', allocationNumerator='0', allocationDenominator='3'))['total']['display'], '0.0000')  # a known zero share
        self.assertEqual(calc(allocated(quantity='5', allocationNumerator='3', allocationDenominator='3'))['total']['display'], '5.0000')
        # Held, never counted: a share above one needs review; a zero denominator needs input.
        over = calc(allocated(quantity='5', allocationNumerator='3.001', allocationDenominator='3'))
        self.assertEqual((over['status'], over['findings'], over['total']), ('review_required', ['allocation_share_exceeds_one'], None))
        zero = calc(allocated(quantity='5', allocationNumerator='1', allocationDenominator='0'))
        self.assertEqual((zero['status'], zero['findings'], zero['total']), ('input_needed', ['allocation_denominator_zero'], None))

    def test_boundaries_origins_and_gwp_basis(self):
        other = calc(supplier(boundary='other'))
        self.assertEqual((other['status'], other['findings'], other['total']), ('review_required', ['supplier_boundary_not_cradle_to_gate'], None))
        for boundary, hybrid in (('other', None), ('supplier_scope1_2_only', 'other_records')):
            r = calc(supplier(factorOrigin='secondary_database', boundary=boundary, hybridUpstreamCoveredBy=hybrid))
            self.assertEqual((r['methodVersionId'], r['status'], r['findings']), (ACT_MID, 'review_required', ['secondary_factor_boundary_not_cradle_to_gate']))
        act = calc(supplier(factorOrigin='secondary_database', gwpBasis='unknown', verification='unverified'))
        self.assertEqual((act['methodVersionId'], act['boundary']['notes']), (ACT_MID, ['factor_gwp_basis_unknown', 'user_supplied_secondary_factor_not_verified']))
        self.assertEqual(act['co2eWithoutGasSplit']['reason'], 'Secondary CO2e factor entered by the company, declared GWP basis unknown; used as entered, not split by gas or restated')
        for basis in ('AR4', 'AR5', 'AR6', 'unknown'):
            self.assertIn(f'supplier_gwp_basis_{basis.lower()}', calc(supplier(gwpBasis=basis))['boundary']['notes'])
        # Up to 6 decimal places in a supplier factor (A10); the unit must be exactly "kg CO2e per <quantity unit>".
        r = calc(supplier(quantity='12.5', unit='US_gallon', factorValue='2.123456', factorUnit='kg CO2e per US_gallon'))
        self.assertEqual(r['total']['unrounded'], text(F('12.5') * F('2.123456')))
        mixed = e.aggregate([calc(supplier()), calc(spend())])
        self.assertEqual((mixed['mixedGwpSets'], mixed['gwpSetsUsed'], mixed['complete']), (True, ['AR5-100', 'AS-REPORTED'], False))

    def test_refusals(self):
        cases = [
            (supplier(category=4), 'invalid_category'), (supplier(category=True), 'invalid_category'), (supplier(factorOrigin='supplier'), 'invalid_factor_origin'),
            (supplier(basis='spend'), 'invalid_basis'), (supplier(boundary='cradle_to_grave'), 'invalid_boundary'),
            (supplier(hybridUpstreamCoveredBy='none'), 'invalid_hybrid_upstream'), (supplier(boundary='supplier_scope1_2_only'), 'invalid_hybrid_upstream'),
            (supplier(boundary='supplier_scope1_2_only', hybridUpstreamCoveredBy='some'), 'invalid_hybrid_upstream'),
            (supplier(gwpBasis='AR3'), 'invalid_gwp_basis'), (supplier(verification='self_declared'), 'invalid_verification'),
            (supplier(unit='kg CO2e'), 'unsupported_unit'), (supplier(unit='tonne'), 'unsupported_unit'), (supplier(factorValue='0.1234567'), 'invalid_factor_value'),
            (supplier(factorValue=0.15), 'invalid_factor_value'), (supplier(factorUnit='kg CO2e per lb'), 'factor_unit_mismatch'),
            (supplier(factorUnit='kg CO2e/kg'), 'factor_unit_mismatch'), (supplier(allocationNumerator='1', allocationDenominator='2'), 'allocation_not_applicable_to_product_factor'),
            (supplier(quantity='-1'), 'invalid_quantity'), (allocated(unit='kg'), 'unsupported_unit'), (allocated(factorValue='1'), 'invalid_input_shape'),
            (allocated(allocationNumerator='1'), 'invalid_allocation'), (allocated(allocationNumerator='1', allocationDenominator='1.2345'), 'invalid_allocation'),
        ]
        for req, code in cases:
            self.assertEqual(refusal(req), code, req['input'])


class MetadataAndCatalog(unittest.TestCase):
    def test_method_metadata(self):
        d = e.describe()
        meta = d['methodMetadata']
        self.assertEqual(d['additionalRegisterSha256s'], {'building_hotel': e.BUILDING_HOTEL_REGISTER_SHA256, 'spend': e.SPEND_REGISTER_SHA256, 'supplement': e.SUPPLEMENT_REGISTER_SHA256, 'us_upstream': e.US_UPSTREAM_REGISTER_SHA256})  # I-05 pins R3 too; I-12u R5; I-12h R6
        dq = lambda *r: dict(zip(e.DQ_INDICATORS, r))
        expected = {
            SPEND_MID: ('spend_based', 'company_records', dq('poor', 'good', 'good', 'fair', 'fair'), None, 'not_in_factor', ['spend']),
            SUP_MID: ('supplier_specific', 'value_chain_partner', dq('very_good', 'good', 'very_good', 'good', 'very_good'), dq('very_good', 'good', 'very_good', 'good', 'fair'), 'as_reported', []),
            ACT_MID: ('activity_average_data', 'company_records', dq('fair', 'good', 'fair', 'fair', 'fair'), None, 'as_reported', []),
        }
        for mid, (mt, origin, default, unverified, biogenic, registers) in expected.items():
            m = meta[mid]
            self.assertEqual((m['methodType'], m['activityDataOrigin'], m['defaultDataQuality']['indicators'], m.get('defaultDataQualityUnverified', {}).get('indicators'),
                              m['biogenicTreatment'], m['additionalRegisters']), (mt, origin, default, unverified, biogenic, registers), mid)
            for block in ('defaultDataQuality', 'defaultDataQualityUnverified'):
                if block in m:
                    self.assertTrue(all(len(t) > 20 for t in m[block]['rationale'].values()))
        # The five existing methods keep exactly their I-01 metadata keys (no unverified default).
        for mid in ('scope3.cat3.td_losses.egrid2023.v1', 'scope3.cat4_9.transport_distance.v1', 'scope3.cat5_12.waste.v1',
                    'scope3.cat6.business_travel_distance.v1', 'scope3.cat7.employee_commuting_distance.v1'):
            self.assertEqual(sorted(meta[mid]), ['activityDataOrigin', 'additionalRegisters', 'biogenicTreatment', 'defaultDataQuality', 'methodType'])
        methods = {m['id']: m for m in d['methods']}
        spend_m = methods[SPEND_MID]
        self.assertEqual((spend_m['gwpSetId'], len(spend_m['factorKeys']), spend_m['registerSha256'], spend_m['profileId'], spend_m['scope']),
                         ('AR5-100', 2032, e.REGISTER_SHA256, 'scope3.spend.epa_scghg_v1_3', 3))
        self.assertEqual(spend_m['factorValues'], {k: V[k]['value'] for k in V})
        self.assertEqual(spend_m['factorCells'], {k: V[k]['valueCell'] for k in V})
        self.assertEqual(spend_m['constantValues'], {k: {'value': text(F(c['value'])), 'unit': c['unit']} for k, c in C.items()})  # describe writes "100.000" as "100"
        for mid in (SUP_MID, ACT_MID):
            self.assertEqual((methods[mid]['gwpSetId'], methods[mid]['factorKeys'], methods[mid]['constantIds']), ('AS-REPORTED', [], ['metric_ton_to_kg']))
        for m in d['methods']:  # every method keeps exactly the keys 0024 registers (plus values, cells, constants)
            self.assertEqual(set(m) - {'factorValues', 'factorCells', 'constantValues'}, {'id', 'profileId', 'scope', 'family', 'title', 'formula', 'enginePath', 'engineSha256',
                                                                                   'registerSha256', 'gwpSetId', 'admissionRules', 'estimateRules', 'reportingPeriod', 'factorKeys', 'constantIds'})

    def test_catalog_code_sets_are_design_3_3(self):
        c = e.catalog()
        self.assertEqual((c['spendCategories'], c['spendImportCategories']), ([1, 2, 3, 4, 5, 6, 9], [1, 2, 3, 4, 5, 6]))
        self.assertEqual(c['spendCategoryCodeSet'], {'3': 'fuel_proxy', '4': 'freight', '5': 'waste', '6': 'passenger', '9': 'freight'})
        self.assertEqual((c['spendMarginChoices'], c['spendCurrencies'], c['spendNaicsCodes']), (['with_margins', 'without_margins'], ['USD'], 1016))
        self.assertEqual(c['spendDollarYears'], {'min': 2012, 'max': 2035, 'indexed': list(range(2012, 2026))})
        # DESIGN 3.3, copied here from the design text.
        design = {
            'freight': '481112 481212 482111 482112 483111 483113 483211 484110 484121 484122 484210 484220 484230 486110 486210 486910 486990 488111 488119 488190 488210 '
                       '488310 488320 488330 488390 488410 488490 488510 491110 492110 492210 493110 493120 493130 493190',
            'passenger': '481111 481211 482111 483112 483114 483212 485111 485112 485113 485119 485210 485310 485320 485510 485999 532111 721110 721120 721191 721199',
            'waste': '221320 562111 562112 562119 562211 562212 562213 562219 562910 562920 562991 562998',
            'fuel_proxy': '212111 212112 212113 221210 324110',
            'energy_confirm': '211120 211130 212111 212112 212113 221210 221330 324110 324199 447110 447190 454310 486110 486210 486910 486990',
        }
        sets = c['spendNaicsSets']
        for name, codes in design.items():
            self.assertEqual(sets[name], sorted(codes.split()), name)
        self.assertEqual(sets['overlap_confirm'], sorted(set(design['freight'].split()) | set(design['passenger'].split()) | set(design['waste'].split())))
        self.assertEqual(len(sets['overlap_confirm']), 66)
        codes = {k.split('.')[1] for k in V}
        self.assertEqual(sets['trade_sector'], sorted(x for x in codes if x[:2] in ('42', '44', '45') and x not in design['energy_confirm'].split()))
        self.assertEqual(len(sets['trade_sector']), 134)
        self.assertEqual(sets['absent'], ['221100'])
        for name, members in sets.items():  # every listed code has a factor, except the one listed as absent
            self.assertEqual([x for x in members if x not in codes], ['221100'] if name == 'absent' else [], name)
        self.assertEqual((c['supplierFactorOrigins'], c['supplierBases'], c['supplierBoundaries'], c['supplierHybridUpstreamCoveredBy']),
                         (['supplier_primary', 'secondary_database'], ['product_factor', 'allocated_total'], ['cradle_to_gate', 'other', 'supplier_scope1_2_only'], ['other_records', 'none']))
        self.assertEqual((c['supplierProductUnits'], c['supplierTotalUnits'], c['gwpBases'], c['verification']),
                         (['kg', 'metric_ton', 'short_ton', 'lb', 'unit', 'kWh', 'MWh', 'liter', 'm3', 'US_gallon'], ['kg CO2e', 'metric_ton CO2e'], ['AR4', 'AR5', 'AR6', 'unknown'],
                          ['third_party_verified', 'unverified']))
        for unit in c['supplierProductUnits']:  # every product unit is accepted with its own factor unit
            self.assertEqual(calc(supplier(unit=unit, factorUnit=f'kg CO2e per {unit}'))['status'], 'complete', unit)


class OriginAndDefaults(unittest.TestCase):
    """A19 (fixed origins by method type) and A20 (unverified defaults) in the aggregate's category profiles."""

    def test_a19_a_spend_annotation_never_changes_the_value_chain_share(self):
        sup, line = calc(supplier(quantity='100', factorValue='1')), calc(spend(amount='1000.00', naicsCode='111130'))  # 100 kg + 848 kg
        plain = e.aggregate([sup, line])['categoryProfiles']['1']
        claimed = e.aggregate([sup, line], [{'dataQuality': None, 'activityDataOrigin': 'company_records'},
                                            {'dataQuality': None, 'activityDataOrigin': 'value_chain_partner'}])['categoryProfiles']['1']
        share = F(100) * 100 / F(948)
        expected = {'numerator': kg(F(100)), 'denominator': kg(F(948)), 'percent': {'value': text(r12(share)), 'display': fixed(share, 1)}}
        self.assertEqual(plain['valueChain'], expected)
        self.assertEqual(claimed['valueChain'], expected)  # neither override counts: supplier fixed partner, spend fixed company records
        self.assertEqual(claimed['valueChain']['percent']['display'], '10.5')
        self.assertEqual(e.effective_origin(line, {'dataQuality': None, 'activityDataOrigin': 'estimate'}), 'company_records')

    def test_a19_activity_data_takes_the_annotation_and_proxies_are_estimates(self):
        act = calc(supplier(factorOrigin='secondary_database', quantity='50', factorValue='2'))
        self.assertEqual(e.aggregate([act])['categoryProfiles']['1']['valueChain']['numerator'], kg(F(0)))
        partner = e.aggregate([act], [{'dataQuality': None, 'activityDataOrigin': 'value_chain_partner'}])['categoryProfiles']['1']
        self.assertEqual(partner['valueChain']['numerator'], kg(F(100)))
        with fake_methods(('test.proxy', 'proxy', 'estimate', ())):
            proxy = e.calculate({'kind': 'test.proxy', 'input': {'period': P, 'quantity': '40'}})
            p = e.aggregate([proxy, act], [{'dataQuality': None, 'activityDataOrigin': 'value_chain_partner'}, NONE])['categoryProfiles']['1']
            self.assertEqual(p['valueChain']['numerator'], kg(F(0)))
            self.assertEqual(e.effective_origin(proxy, {'dataQuality': None, 'activityDataOrigin': 'company_records'}), 'estimate')

    def test_a20_unverified_supplier_data_use_the_unverified_default(self):
        verified = calc(supplier(quantity='100', factorValue='1'))
        unverified = calc(supplier(quantity='300', factorValue='1', verification='unverified'))
        self.assertEqual(unverified['boundary']['notes'], ['supplier_data_unverified', 'supplier_gwp_basis_ar5'])
        p = e.aggregate([verified, unverified])['categoryProfiles']['1']['dataQuality']
        # Reliability: verified very good (1) on 100 kg, unverified fair (3) on 300 kg -> (100 + 900) / 400 = 2.5.
        self.assertEqual(p['indicators']['reliability'], {'ratingKg': {'fair': kg(F(300)), 'very_good': kg(F(100))}, 'score': {'value': '2.5', 'display': '2.50'}})
        self.assertEqual(p['indicators']['technological'], {'ratingKg': {'very_good': kg(F(400))}, 'score': {'value': '1', 'display': '1.00'}})
        overall = (F(1) + 2 + 1 + 2 + F(5, 2)) / 5
        self.assertEqual(p['overall'], {'score': {'value': text(r12(overall)), 'display': fixed(overall, 2)}, 'label': 'good'})
        # A user's rating still wins over either default.
        mine = {'dataQuality': {'technological': None, 'temporal': None, 'geographical': None, 'completeness': None, 'reliability': 'good'}, 'activityDataOrigin': None}
        q = e.aggregate([unverified], [mine])['categoryProfiles']['1']['dataQuality']['indicators']['reliability']
        self.assertEqual(q['ratingKg'], {'good': kg(F(300))})
        # A method without an unverified default keeps its one default whatever the record says.
        act = calc(supplier(factorOrigin='secondary_database', verification='unverified'))
        self.assertEqual(e.aggregate([act])['categoryProfiles']['1']['dataQuality']['indicators']['reliability']['ratingKg'], {'fair': kg(F(30000))})


class SpendContextIndependence(unittest.TestCase):
    """Sampled (fixed seed, 300 requests) over every R2 code, both margins, indexed and unindexed years and amounts: each
    result is the same in any caller Decimal context and the aggregate accepts it (S3A-01 for R2)."""

    def test_sampled_requests(self):
        rng = random.Random(20261030)
        codes = sorted({k.split('.')[1] for k in V}) + ['221100']
        amounts = ('0.001', '17.125', '125000.00', '123456789.987', '999999999999.999')
        complete = 0
        for _ in range(300):
            margin = rng.choice(('with_margins', 'without_margins'))
            category = rng.choice((1, 2, 3, 4, 5, 6, 9))
            req = spend(category=category, naicsCode=rng.choice(codes), amount=rng.choice(amounts), dollarYear=rng.choice((2012, 2017, 2022, 2024, 2025, 2026)),
                        marginChoice=margin, boughtAtFactoryGate=margin == 'without_margins' or rng.random() < 0.5, capitalFullCost=True if category == 2 else rng.choice((None, False, True)))
            plain = calc(req)
            for prec in (200, 12):
                with localcontext() as ctx:
                    ctx.prec = prec
                    self.assertEqual(e.canonical(calc(req)), e.canonical(plain), req)
            agg = e.aggregate([plain])
            if plain['status'] == 'complete':
                complete += 1
                self.assertEqual(agg['knownSourceSubtotal']['unrounded'], plain['total']['unrounded'])
                ef = F(V[f"epa_scghg_v130.{req['input']['naicsCode']}.{margin}"]['value'])
                year = req['input']['dollarYear']
                ratio = F(1) if year == 2022 else r12(F(C['price_index.gdp_deflator.2022']['value']) / F(C[f'price_index.gdp_deflator.{year}']['value']))
                self.assertEqual(plain['total']['unrounded'], text(F(req['input']['amount']) * ef * ratio))
        self.assertGreater(complete, 200)


if __name__ == '__main__':
    unittest.main()
