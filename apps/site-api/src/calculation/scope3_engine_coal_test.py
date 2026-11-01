"""Round 2, lane F: the coal upstream methane-only term (DESIGN 13.6, owner decision, binding).

F_COAL = round12(EPA GHGI 2022 coal mining CH4 (43.6 MMT CO2e, AR5) x 10^9 kg / (EIA 2022 coal production (594,155 thousand
short tons) x 1000 x EIA 2022 coal production heat content (20.100 MMBtu/short ton, gross = HHV))) kg CO2e per MMBtu HHV.
Expected values are independent exact arithmetic (fractions.Fraction) on the PRINTED values as transcribed in the committed
source file tools/method-reference/sources/us-upstream-transcriptions-3.json and on the R3 register cells, never engine output.
COAL heat input is mapped in 3B / 3C upstream / 3D upstream with F_COAL; every line with coal heat input stays partial with the
non-excludable note `coal_upstream_mine_methane_only`, memos its coal heat input, and takes the coal data-quality default
(technology fair, time good, geography very good, completeness poor, reliability good).
"""
import hashlib
import json
import subprocess
import sys
import tempfile
import unittest
from decimal import Decimal
from fractions import Fraction
from pathlib import Path

import scope3_engine as e

ROOT = Path(__file__).resolve().parents[4]
SOURCES = ROOT / 'tools/method-reference/sources'
BUILDER = ROOT / 'tools/method-reference/build_scope3_us_upstream_register.py'
REF = ROOT / 'packages/neuvetra-database/src/method-reference'
R5_PATH = REF / 'verified-scope3-us-upstream-register-2025.json'
SIDECAR_PATH = REF / 'verified-scope3-us-upstream-register-2025.provenance.json'
R3 = json.loads((REF / 'verified-scope3-supplement-register-2025.json').read_text('utf-8'))
NAMES = ('us-upstream-transcriptions.json', 'us-upstream-transcriptions-2.json', 'us-upstream-transcriptions-3.json')
T = {v['id']: v for name in NAMES for v in json.loads((SOURCES / name).read_text('utf-8'))['values']}
P = {'start': '2025-01-01', 'endExclusive': '2026-01-01'}
GHGI, PROD, HEAT = 'epa_ghgi.2022.coal_mining_ch4_total', 'eia.2022.coal_production_short_tons', 'eia.2022.coal_heat_content_production'
COAL_NOTE = 'coal_upstream_mine_methane_only'


def F(text) -> Fraction:
    return Fraction(Decimal(str(text)))


def printed(tid: str) -> Fraction:
    """A printed value as transcribed (thousands separators removed), only if both reads agreed."""
    assert T[tid]['agreed'] is True, tid
    return F(T[tid]['value'].replace(',', ''))


def round12(q: Fraction) -> Fraction:
    return Fraction(round(q * 10 ** 12), 10 ** 12)  # Python's round() of a Fraction is half-even


def r3(key: str) -> Fraction:
    return F(next(x['value'] for x in R3['entries'] if x['id'] == key))


def total(r) -> Fraction:
    return F(r['total']['unrounded'])


def calc(kind, inp):
    return e.calculate({'kind': kind, 'input': inp})


# Independent: 43.6 x 10^9 / (594,155 x 1000 x 20.100) = 43,600,000,000 / 11,942,515,500 = 87,200,000 / 23,885,031
# = 3.650822140444364..., half-even to 12 dp = 3.650822140444.
COAL_NUM = printed(GHGI) * 10 ** 9
COAL_DEN = printed(PROD) * 1000 * printed(HEAT)
F_COAL = round12(COAL_NUM / COAL_DEN)
MJ_PER_MMBTU = Fraction(105505585262, 10 ** 8)
F_GAS = printed('netl2024_4862.ng_upstream.prod_through_transmission') * MJ_PER_MMBTU / 1000
F_OIL = round12((printed('cagreet3_lut2018.ulsd.total') - printed('cagreet3_lut2018.ulsd.tailpipe')) * printed('carb_lcfs.energy_density.ulsd') / 1000
                / r3('hub2025_t1.distillate_fuel_oil_no_2.heat_content'))
MAPPED = {'COAL': F_COAL, 'GAS': F_GAS, 'OIL': F_OIL}
FOSSIL = ('COAL', 'GAS', 'OFSL', 'OIL')
# Round 3 (AC-9): geography good (a national average of mine methane, not the supplying basins).
COAL_DQ = {'technological': 'fair', 'temporal': 'good', 'geographical': 'good', 'completeness': 'poor', 'reliability': 'good'}
BASE_DQ = {'technological': 'fair', 'temporal': 'good', 'geographical': 'very_good', 'completeness': 'fair', 'reliability': 'good'}


def expected(region: str) -> dict:
    hi = {x['id'].rsplit('.', 1)[1]: F(x['value']) for x in R3['entries'] if x['id'].startswith(f'egrid2023_hi.{region}.')}
    gen = r3(f'egrid2023_gen.{region}')
    fossil = sum((v for k, v in hi.items() if k in FOSSIL), Fraction(0))
    unmapped = sorted(k for k in hi if k in FOSSIL and k not in MAPPED)
    return {'u': sum((round12(hi[k] / gen) * f for k, f in MAPPED.items() if k in hi), Fraction(0)),
            'mapped': sorted(k for k in hi if k in MAPPED), 'unmapped': unmapped,
            'coalPerMwh': round12(hi['COAL'] / gen) if 'COAL' in hi else Fraction(0),
            'coalShare': (round12(hi['COAL'] / fossil) if 'COAL' in hi else Fraction(0)) if fossil else None,
            'unmappedShare': round12(sum((hi[k] for k in unmapped), Fraction(0)) / fossil) if fossil else None}


class CoalFactor(unittest.TestCase):
    def test_the_three_printed_inputs_and_the_value(self):
        self.assertEqual((T[GHGI]['value'], T[PROD]['value'], T[HEAT]['value']), ('43.6', '594,155', '20.100'))
        self.assertEqual((COAL_NUM, COAL_DEN), (Fraction(43600000000), Fraction(11942515500)))
        self.assertEqual(COAL_NUM / COAL_DEN, Fraction(87200000, 23885031))
        self.assertEqual(F_COAL, F('3.650822140444'))
        self.assertIn('AR5', T[GHGI]['basis']['gwp_set'])
        self.assertTrue(T[HEAT]['basis']['heating_value'].startswith('HHV (gross)'))

    def test_the_source_copy_is_byte_for_byte_and_pinned(self):
        raw = (SOURCES / 'us-upstream-transcriptions-3.json').read_bytes()
        self.assertEqual(hashlib.sha256(raw).hexdigest(), 'fe96dddc44e7bda8cfa39f386b0b072c333d435d7e6c5e61fda4eeb9bc9a6aeb')
        self.assertIn("'us-upstream-transcriptions-3.json': 'fe96dddc44e7bda8cfa39f386b0b072c333d435d7e6c5e61fda4eeb9bc9a6aeb'", BUILDER.read_text('utf-8'))

    def test_r5_registers_the_inputs_the_constant_and_the_derivation_record(self):
        reg = json.loads(R5_PATH.read_text('utf-8'))
        by = {x['id']: x for x in reg['entries']}
        sha3 = hashlib.sha256((SOURCES / 'us-upstream-transcriptions-3.json').read_bytes()).hexdigest()
        for tid, value in ((GHGI, '43.6'), (PROD, '594155'), (HEAT, '20.100')):
            x = by[tid]
            self.assertEqual((x['value'], x['sourceSha256'], x['sheet']), (value, sha3, T[tid]['url']), tid)
            self.assertEqual(x['labelCells'], ['quote1: ' + T[tid]['quote1'], 'quote2: ' + T[tid]['quote2']], tid)
            self.assertTrue(set(x) <= {'id', 'label', 'labelCells', 'sheet', 'table', 'unit', 'value', 'valueCell', 'sourceSha256'}, tid)
            self.assertIn('[transcription: webfetch_double_read; us-upstream-transcriptions-3.json id ' + tid + ']', x['valueCell'])
        consts = {c['id']: c for c in reg['constants']}
        for c in consts.values():
            self.assertTrue(set(c) <= {'id', 'value', 'unit', 'basis', 'sourceSha256'}, c['id'])  # 0024 constant keys
        self.assertEqual(F(consts['us_upstream_const.coal_mine_methane_kg_per_mmbtu_hhv']['value']), F_COAL)
        self.assertEqual(consts['us_upstream_const.coal_mine_methane_kg_per_mmbtu_hhv']['value'], '3.650822140444')
        self.assertTrue(consts['us_upstream_const.coal_mine_methane_kg_per_mmbtu_hhv']['basis'].startswith('Derived, not a printed value'))
        self.assertEqual((consts['us_upstream_const.kg_per_million_metric_tons']['value'], consts['us_upstream_const.short_tons_per_thousand_short_tons']['value']),
                         ('1000000000', '1000'))
        # No printed coal upstream factor counts in a figure: NPC 2011 and Abrahams 2015 are registered since round 3 only for the
        # screening-range memo outside totals (owner decision 2), and their labels say so.
        self.assertEqual(sorted(k for k in by if k.startswith('coal_upstream.')), ['coal_upstream.abrahams2015_cmu.us_average', 'coal_upstream.npc2011.us_average.upstream_combustion'])
        self.assertTrue(all(by[k]['label'].startswith('Screening only') for k in by if k.startswith('coal_upstream.')))
        # The derivation record is in the sidecar the register names.
        raw = SIDECAR_PATH.read_bytes()
        self.assertEqual(reg['source']['provenanceSidecar'], {'file': SIDECAR_PATH.name, 'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': str(len(raw))})
        d = json.loads(raw)['derived']['us_upstream_const.coal_mine_methane_kg_per_mmbtu_hhv']
        self.assertIs(d['derived'], True)
        self.assertEqual([(i['id'], i['printed'], i['value']) for i in d['inputs']], [(GHGI, '43.6', '43.6'), (PROD, '594,155', '594155'), (HEAT, '20.100', '20.100')])
        self.assertEqual({i['fileSha256'] for i in d['inputs']}, {sha3})
        self.assertEqual((F(d['division']['numerator']), F(d['division']['denominator']), F(d['division']['result']), d['division']['places'],
                          d['division']['rounding'], d['division']['rounded']), (COAL_NUM, COAL_DEN, F_COAL, 12, 'half_even', True))
        self.assertIn('round12(', d['formula'])

    def test_a_tampered_coal_quote_stops_the_builder(self):
        with tempfile.TemporaryDirectory() as tmp:
            src = Path(tmp) / 'sources'
            src.mkdir()
            for name in NAMES:
                (src / name).write_bytes((SOURCES / name).read_bytes())
            doc = json.loads((src / NAMES[2]).read_text('utf-8'))
            for v in doc['values']:
                if v['id'] == PROD:
                    v['quote2'] = v['quote2'].replace('594,155', '594,156')
            (src / NAMES[2]).write_text(json.dumps(doc, ensure_ascii=False, indent=1), 'utf-8')
            run = subprocess.run([sys.executable, '-I', str(BUILDER), str(Path(tmp) / 'a.json'), str(src)], capture_output=True, text=True)
            self.assertNotEqual(run.returncode, 0)
            self.assertIn('us-upstream-transcriptions-3.json', run.stderr)  # the pinned SHA-256 refuses the altered copy
            code = BUILDER.read_text('utf-8').replace('fe96dddc44e7bda8cfa39f386b0b072c333d435d7e6c5e61fda4eeb9bc9a6aeb', hashlib.sha256((src / NAMES[2]).read_bytes()).hexdigest())
            (Path(tmp) / 'b.py').write_text(code, 'utf-8')
            run = subprocess.run([sys.executable, '-I', str(Path(tmp) / 'b.py'), str(Path(tmp) / 'b.json'), str(src)], capture_output=True, text=True)
            self.assertNotEqual(run.returncode, 0)
            self.assertIn('"594,155" not in quote2', run.stderr)
            self.assertFalse((Path(tmp) / 'b.json').exists())

    def test_the_engine_lists_the_one_division_and_checks_the_register_constant(self):
        used, conv = {}, []
        with e._exact():
            got = e._coal_upstream_factor(used, conv)
        self.assertEqual(F(got), F_COAL)
        self.assertEqual(len(conv), 1)
        self.assertEqual((F(conv[0]['numerator']), F(conv[0]['denominator']), F(conv[0]['result']), conv[0]['rounded'], conv[0]['places']),
                         (COAL_NUM, COAL_DEN, F_COAL, True, 12))
        self.assertTrue({GHGI, PROD, HEAT, 'constant:us_upstream_const.coal_mine_methane_kg_per_mmbtu_hhv', 'constant:us_upstream_const.kg_per_million_metric_tons',
                         'constant:us_upstream_const.short_tons_per_thousand_short_tons'} <= set(used))


class CoalMapped(unittest.TestCase):
    EL = {'period': P, 'quantity': '1234.5', 'unit': 'MWh', 'subregion': 'CAMX', 'zip': '94105'}

    def test_camx_3b_counts_the_coal_term_and_stays_partial(self):
        x = expected('CAMX')
        r = calc('electricity_upstream', self.EL)
        a = r['activity']
        self.assertEqual(r['status'], 'complete')
        self.assertEqual(total(r), F('1234.5') * x['u'])
        self.assertEqual((a['mappedFuels'], a['unmappedFuels'], a['otherFuelsNotMapped']), (['COAL', 'GAS', 'OIL'], ['OFSL'], ['OTHF']))
        self.assertEqual(F(a['unmappedFossilHeatInputShare']), x['unmappedShare'])
        self.assertEqual((F(a['coalHeatInputMmbtu']), F(a['coalHeatInputShare'])), (F('1234.5') * x['coalPerMwh'], x['coalShare']))
        self.assertEqual(r['boundary']['minimumBoundary'], 'partial')
        self.assertIn(COAL_NOTE, r['boundary']['notes'])
        self.assertIn('fossil_fuel_upstream_not_mapped', r['boundary']['notes'])  # OFSL still unmapped
        self.assertIn('EPA GHGI', r['co2eWithoutGasSplit']['reason'])
        self.assertTrue({GHGI, PROD, HEAT} <= {f['key'] for f in r['factorsUsed']})
        self.assertIn('us_upstream_const.coal_mine_methane_kg_per_mmbtu_hhv', {c['id'] for c in r['constantsUsed']})
        self.assertIn('3.650822140444', [c['result'] for c in r['conversions']])  # F_COAL's division, listed on the line
        self.assertEqual(e.default_data_quality(r)['indicators'], COAL_DQ)

    def test_a_region_whose_only_gap_is_coal_methane_only_is_still_partial(self):
        x = expected('SRMW')  # coal, gas and oil: nothing unmapped, but coal counts mine methane only
        r = calc('electricity_upstream', {'period': P, 'quantity': '100', 'unit': 'MWh', 'subregion': 'SRMW', 'zip': '63101'})
        self.assertEqual((r['status'], r['activity']['unmappedFuels'], F(r['activity']['unmappedFossilHeatInputShare'])), ('complete', [], Fraction(0)))
        self.assertEqual(total(r), 100 * x['u'])
        self.assertNotIn('fossil_fuel_upstream_not_mapped', r['boundary']['notes'])
        self.assertEqual((r['boundary']['minimumBoundary'], COAL_NOTE in r['boundary']['notes']), ('partial', True))
        self.assertEqual(F(r['activity']['coalHeatInputMmbtu']), 100 * x['coalPerMwh'])

    def test_a_region_without_coal_has_no_coal_term_note_or_default(self):
        x = expected('NYCW')
        r = calc('electricity_upstream', {'period': P, 'quantity': '100', 'unit': 'MWh', 'subregion': 'NYCW', 'zip': '10001'})
        self.assertEqual(total(r), 100 * x['u'])
        self.assertNotIn(COAL_NOTE, r['boundary']['notes'])
        self.assertEqual((r['activity']['coalHeatInputMmbtu'], r['activity']['coalHeatInputShare']), ('0', '0'))
        self.assertNotIn(GHGI, {f['key'] for f in r['factorsUsed']})
        self.assertEqual(e.default_data_quality(r)['indicators'], BASE_DQ)

    def test_every_subregion_and_the_us(self):
        for region in sorted({x['id'].split('.')[1] for x in R3['entries'] if x['id'].startswith('egrid2023_gen.')}):
            x = expected(region)
            used, conv = {}, []
            with e._exact():
                u, a, notes, _memo = e._upstream_intensity(region, Decimal('10'), used, conv)  # round 3: + the coal screening memo
            self.assertEqual(F(u), x['u'], region)
            self.assertEqual((a['mappedFuels'], a['unmappedFuels']), (x['mapped'], x['unmapped']), region)
            self.assertEqual(COAL_NOTE in notes, 'COAL' in x['mapped'], region)
            self.assertEqual(F(a['coalHeatInputMmbtu']), 10 * x['coalPerMwh'], region)
            self.assertEqual(None if a['coalHeatInputShare'] is None else F(a['coalHeatInputShare']), x['coalShare'], region)

    def test_3c_and_3d_upstream_carry_the_coal_term(self):
        us = {'period': P, 'quantity': '250', 'unit': 'MWh', 'gridBasis': 'us_average', 'zip': None, 'subregion': None, 'utilityEiaId': None}
        up = calc('energy_resold_upstream', us)
        self.assertEqual(total(up), 250 * expected('US')['u'])
        self.assertIn(COAL_NOTE, up['boundary']['notes'])
        loss = calc('td_losses_upstream', self.EL)
        self.assertEqual(total(loss), F(loss['activity']['lossMwh']) * expected('CAMX')['u'])
        self.assertEqual((loss['boundary']['minimumBoundary'], COAL_NOTE in loss['boundary']['notes']), ('partial', True))
        for r in (up, loss):
            self.assertEqual(e.default_data_quality(r)['indicators'], COAL_DQ)

    def test_metadata_and_catalog(self):
        self.assertEqual(e.catalog()['powerFuelsMapped'], ['COAL', 'GAS', 'OIL'])
        d = e.describe()
        methods = {m['id']: m for m in d['methods']}
        for mid in ('scope3.cat3b.upstream_electricity.egrid2023_netl2024.v1', 'scope3.cat3c.td_losses_upstream.egrid2023_netl2024.v1',
                    'scope3.cat3d.energy_resold_upstream.egrid2023_netl2024.v1'):
            self.assertEqual(methods[mid]['factorValues'][PROD], '594155', mid)
            self.assertEqual(methods[mid]['constantValues']['us_upstream_const.coal_mine_methane_kg_per_mmbtu_hhv']['value'], '3.650822140444', mid)
            self.assertEqual(d['methodMetadata'][mid]['defaultDataQualityByNote'][COAL_NOTE]['indicators'], COAL_DQ, mid)
            self.assertIn('mine methane', ' '.join(methods[mid]['admissionRules']), mid)


if __name__ == '__main__':
    unittest.main()
