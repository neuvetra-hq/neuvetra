"""Scope 3 completion I-12u: category 3 upstream from US free sources (DESIGN 13).

Expected values are independent exact arithmetic (fractions.Fraction) on the numbers as transcribed in the committed source
files (tools/method-reference/sources/us-upstream-transcriptions*.json) and on the R1/R3 register cells, never engine output.
Also: the R5 builder reproduces the committed register byte for byte, and a tampered quote stops it; the natural gas energy of
3A is the Scope 1 engine's own figure for the same record; the aggregate closes 3C and 3D combustion lines with their upstream
lines (boundaryClosures).
"""
import hashlib
import json
import os
import subprocess
import sys
import tempfile
import unittest
from decimal import Decimal
from fractions import Fraction
from pathlib import Path

import scope1_engine as s1
import scope3_engine as e

ROOT = Path(__file__).resolve().parents[4]
SOURCES = ROOT / 'tools/method-reference/sources'
BUILDER = ROOT / 'tools/method-reference/build_scope3_us_upstream_register.py'
REF = ROOT / 'packages/neuvetra-database/src/method-reference'
R5_PATH = REF / 'verified-scope3-us-upstream-register-2025.json'
R1 = json.loads((REF / 'verified-scope3-register-2025.json').read_text('utf-8'))
R3 = json.loads((REF / 'verified-scope3-supplement-register-2025.json').read_text('utf-8'))
T = {}
for name in ('us-upstream-transcriptions.json', 'us-upstream-transcriptions-2.json'):
    for v in json.loads((SOURCES / name).read_text('utf-8'))['values']:
        T[v['id']] = v
P = {'start': '2025-01-01', 'endExclusive': '2026-01-01'}
NG3A, EL3B, LOSS3C, RESOLD3D = ('scope3.cat3a.upstream_fuels.us_netl2024_cagreet3.v1', 'scope3.cat3b.upstream_electricity.egrid2023_netl2024.v1',
                                'scope3.cat3c.td_losses_upstream.egrid2023_netl2024.v1', 'scope3.cat3d.energy_resold_upstream.egrid2023_netl2024.v1')


def F(text) -> Fraction:
    return Fraction(Decimal(str(text)))


def tv(tid: str) -> Fraction:
    """A transcribed value, only if both reads agreed."""
    assert T[tid]['agreed'] is True, tid
    return F(T[tid]['value'])


def round12(q: Fraction) -> Fraction:
    return Fraction(round(q * 10 ** 12), 10 ** 12)  # Python's round() of a Fraction is half-even


def r1(key: str) -> Fraction:
    return F(next(x['value'] for x in R1['entries'] if x['id'] == key))


def r3(key: str) -> Fraction:
    return F(next(x['value'] for x in R3['entries'] if x['id'] == key))


MJ_PER_MMBTU = Fraction(105505585262, 10 ** 8)  # International Table Btu = 1055.05585262 J (definition)
F_DIST = tv('netl2024_4862.ng_upstream.prod_through_distribution') * MJ_PER_MMBTU / 1000
F_TRANS = tv('netl2024_4862.ng_upstream.prod_through_transmission') * MJ_PER_MMBTU / 1000
WTT = {'carbob': tv('cagreet3_lut2018.carbob.total') - tv('cagreet3_lut2018.carbob.tailpipe'),
       'ulsd': tv('cagreet3_lut2018.ulsd.total') - tv('cagreet3_lut2018.ulsd.tailpipe')}
ED = {'carbob': tv('carb_lcfs.energy_density.carbob'), 'ulsd': tv('carb_lcfs.energy_density.ulsd')}
# Round 2 (ACC-14): OTHF is not counted as fossil; (owner decision 2) oil is mapped with the CA-GREET3.0 ULSD upstream converted
# to HHV with the Hub 2025 distillate No. 2 heat content (R3 cell D55), rounded 12 dp.
FOSSIL = ('COAL', 'GAS', 'OFSL', 'OIL')
F_OIL = round12(WTT['ulsd'] * ED['ulsd'] / 1000 / F(next(x['value'] for x in R3['entries'] if x['id'] == 'hub2025_t1.distillate_fuel_oil_no_2.heat_content')))
# Round 2, lane F (DESIGN 13.6): coal mine methane only, round12(43.6 MMT CO2e x 10^9 / (594,155 thousand short tons x 1000 x
# 20.100 MMBtu/short ton)), from the printed values of us-upstream-transcriptions-3.json (thousands separator removed).
T3 = {v['id']: v for v in json.loads((SOURCES / 'us-upstream-transcriptions-3.json').read_text('utf-8'))['values'] if v['agreed'] is True}
F_COAL = round12(F(T3['epa_ghgi.2022.coal_mining_ch4_total']['value']) * 10 ** 9 / (F(T3['eia.2022.coal_production_short_tons']['value'].replace(',', '')) * 1000
                                                                                   * F(T3['eia.2022.coal_heat_content_production']['value'])))
MAPPED = {'COAL': F_COAL, 'GAS': F_TRANS, 'OIL': F_OIL}


def total(r) -> Fraction:
    return F(r['total']['unrounded'])


def calc(kind, inp):
    return e.calculate({'kind': kind, 'input': inp})


def intensity(region: str) -> tuple[Fraction, Fraction | None, list]:
    """U(region) = sum over gas and oil of round12(HI / GEN) x their factor, the mapped share and the unmapped fossil fuels, from R3 cells."""
    hi = {x['id'].rsplit('.', 1)[1]: F(x['value']) for x in R3['entries'] if x['id'].startswith(f'egrid2023_hi.{region}.')}
    gen = r3(f'egrid2023_gen.{region}')
    u = sum((round12(hi[k] / gen) * f for k, f in MAPPED.items() if k in hi), Fraction(0))
    fossil = sum((v for k, v in hi.items() if k in FOSSIL), Fraction(0))
    share = round12(sum((hi[k] for k in MAPPED if k in hi), Fraction(0)) / fossil) if fossil else None
    return u, share, sorted(k for k in hi if k in FOSSIL and k not in MAPPED)


class R5Register(unittest.TestCase):
    def test_pinned_and_rebuilt_byte_for_byte(self):
        raw = R5_PATH.read_bytes()
        self.assertEqual(hashlib.sha256(raw).hexdigest(), e.US_UPSTREAM_REGISTER_SHA256)
        self.assertEqual((e.REGISTERS['us_upstream']['path'], e.REGISTERS['us_upstream']['sha256']), (R5_PATH, e.US_UPSTREAM_REGISTER_SHA256))
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / 'r5.json'
            subprocess.run([sys.executable, '-I', str(BUILDER), str(out)], check=True, capture_output=True)
            self.assertEqual(out.read_bytes(), raw)

    def test_a_tampered_quote_stops_the_builder(self):
        with tempfile.TemporaryDirectory() as tmp:
            src = Path(tmp) / 'sources'
            src.mkdir()
            for name in ('us-upstream-transcriptions.json', 'us-upstream-transcriptions-2.json', 'us-upstream-transcriptions-3.json'):  # round 2, lane F: -3 (coal)
                (src / name).write_bytes((SOURCES / name).read_bytes())
            doc = json.loads((src / 'us-upstream-transcriptions.json').read_text('utf-8'))
            for v in doc['values']:
                if v['id'] == 'netl2024_4862.ng_upstream.prod_through_transmission':
                    v['quote2'] = v['quote2'].replace('are 7.8 g', 'are 7.9 g')
            (src / 'us-upstream-transcriptions.json').write_text(json.dumps(doc, ensure_ascii=False, indent=1), 'utf-8')
            # 1. The pinned SHA-256 refuses the altered file.
            run = subprocess.run([sys.executable, '-I', str(BUILDER), str(Path(tmp) / 'a.json'), str(src)], capture_output=True, text=True)
            self.assertNotEqual(run.returncode, 0)
            self.assertIn('us-upstream-transcriptions.json', run.stderr)
            # 2. With the pin moved to the altered bytes, the quote check itself refuses it (the value is no longer in both quotes).
            code = BUILDER.read_text('utf-8').replace('1774e71e0b2cc7d2d29df9ca153956254b96e3f733ea35a34312ea03b4accaeb',
                                                      hashlib.sha256((src / 'us-upstream-transcriptions.json').read_bytes()).hexdigest())
            (Path(tmp) / 'b.py').write_text(code, 'utf-8')
            run = subprocess.run([sys.executable, '-I', str(Path(tmp) / 'b.py'), str(Path(tmp) / 'b.json'), str(src)], capture_output=True, text=True)
            self.assertNotEqual(run.returncode, 0)
            self.assertIn('"7.8" not in quote2', run.stderr)
            self.assertFalse((Path(tmp) / 'b.json').exists())

    def test_entries_keep_provenance_in_0024_keys(self):
        reg = json.loads(R5_PATH.read_text('utf-8'))
        self.assertEqual(sorted(reg), ['constants', 'entries', 'method', 'schema', 'source', 'verifiedBy'])
        for x in reg['entries']:
            self.assertTrue(set(x) <= {'id', 'label', 'labelCells', 'sheet', 'table', 'unit', 'value', 'valueCell', 'sourceSha256'}, x['id'])
            self.assertIn('[transcription: webfetch_double_read;', x['valueCell'])
            self.assertTrue(x['sheet'].startswith('https://'), x['id'])
            self.assertGreaterEqual(len(x['labelCells']), 2)
        by = {x['id']: x for x in reg['entries']}
        # Both quotes, the URL and the page/table/row of the NETL value; the derived CA-GREET upstream values.
        n = by['netl2024_4862.ng_upstream.prod_through_distribution']
        self.assertEqual((n['value'], n['labelCells'][0], n['labelCells'][1]), ('8.8', 'quote1: ' + T[n['id']]['quote1'], 'quote2: ' + T[n['id']]['quote2']))
        self.assertIn('Executive Summary, p. 2', n['valueCell'])
        self.assertEqual({k: by[f'cagreet3_lut2018.{k}.upstream']['value'] for k in ('carbob', 'ulsd', 'propane_weighted')}, {'carbob': '26.88', 'ulsd': '25.59', 'propane_weighted': '18.16'})
        consts = {c['id']: c['value'] for c in reg['constants']}
        self.assertEqual(F(consts['us_upstream_const.ng_upstream_distribution_kg_per_mmbtu_hhv']), F_DIST)
        self.assertEqual(F(consts['us_upstream_const.ng_upstream_transmission_kg_per_mmbtu_hhv']), F_TRANS)
        self.assertEqual((consts['us_upstream_const.ng_upstream_distribution_kg_per_mmbtu_hhv'], consts['us_upstream_const.ng_upstream_transmission_kg_per_mmbtu_hhv']), ('9.284491503056', '8.229435650436'))
        # No printed coal or oil upstream factor counts in a figure (round 2, lane F: the coal term is derived, DESIGN 13.6). Round 3
        # (owner decision 2): the two printed coal cross-checks are registered for the screening-range memo only, labelled so.
        self.assertFalse([k for k in by if k.startswith('oil_upstream.')])
        self.assertTrue(all(by[k]['label'].startswith('Screening only') for k in by if k.startswith('coal_upstream.')))


class FuelUpstream3A(unittest.TestCase):
    def test_natural_gas_energy_is_the_scope1_engines_and_the_factor_is_netl_distribution(self):
        cases = [('120.5', 'MMBtu', None), ('1234', 'therm', None), ('50000', 'scf', {'value': '0.001037', 'unit': 'MMBtu per scf'}),
                 ('480.5', 'ccf', {'value': '1.037', 'unit': 'therm per ccf'}), ('480.5', 'ccf', {'value': '0.1037', 'unit': 'MMBtu per ccf'}),
                 ('48.25', 'mcf', {'value': '1.037', 'unit': 'MMBtu per mcf'}), ('7', 'scf', {'value': '0.000999', 'unit': 'MMBtu per ccf'})]
        for q, unit, hc in cases:
            inp = {'period': P, 'quantity': q, 'unit': unit, **({'heatContent': hc} if hc else {})}
            scope1 = s1.natural_gas(inp)
            r = calc('fuel_upstream', dict(inp, source='natural_gas'))
            self.assertEqual((r['methodVersionId'], r['category'], r['status'], r['gwpSetId']), (NG3A, 3, 'complete', 'AS-PUBLISHED'))
            self.assertEqual(F(r['activity']['mmbtuHhv']), F(scope1['activity']['mmbtuHhv']), (q, unit, hc))
            # Independent energy: the bill's quantity and heat content.
            scf = F(q) * {'scf': 1, 'ccf': 100, 'mcf': 1000}.get(unit, 0)
            mmbtu = {'MMBtu': F(q), 'therm': F(q) / 10}.get(unit) if not hc else {'MMBtu per scf': scf * F(hc['value']) if hc else 0,
                                                                                   'MMBtu per ccf': scf / 100 * F(hc['value']) if hc else 0,
                                                                                   'MMBtu per mcf': scf / 1000 * F(hc['value']) if hc else 0,
                                                                                   'therm per ccf': scf / 100 * F(hc['value']) / 10 if hc else 0}[hc['unit']]
            self.assertEqual(total(r), mmbtu * F_DIST)
            self.assertEqual(r['co2eWithoutGasSplit']['co2e'], r['total']['unrounded'])
            self.assertEqual((r['boundary']['minimumBoundary'], r['boundary']['notes']), ('met', ['natural_gas_upstream_hhv_basis', 'upstream_gwp_as_published_ar6']))
            self.assertEqual({f['key'] for f in r['factorsUsed']}, {'netl2024_4862.ng_upstream.prod_through_distribution'})
            self.assertIn('us_upstream_const.ng_upstream_distribution_kg_per_mmbtu_hhv', {c['id'] for c in r['constantsUsed']})
        # 1,234 therms: 123.4 MMBtu x 9.284491503056 = 1145.7062514771104 kg CO2e (hand arithmetic).
        r = calc('fuel_upstream', {'period': P, 'source': 'natural_gas', 'quantity': '1234', 'unit': 'therm'})
        self.assertEqual((r['total']['unrounded'], r['total']['display']), ('1145.7062514771104', '1145.7063'))

    def test_natural_gas_volume_without_heat_content_needs_input_as_in_scope1(self):
        inp = {'period': P, 'quantity': '50000', 'unit': 'scf'}
        self.assertEqual((s1.natural_gas(inp)['status'], s1.natural_gas(inp)['findings']), ('input_needed', ['heat_content_required_for_volume']))
        r = calc('fuel_upstream', dict(inp, source='natural_gas'))
        self.assertEqual((r['status'], r['findings'], r['total']), ('input_needed', ['heat_content_required_for_volume'], None))
        for bad in ({'value': '0', 'unit': 'MMBtu per scf'}, {'value': '0.001', 'unit': 'kWh per scf'}, {'value': '0.0010371', 'unit': 'MMBtu per scf'}):
            with self.assertRaises(e.Refused):
                calc('fuel_upstream', dict(inp, source='natural_gas', heatContent=bad))
        with self.assertRaises(e.Refused):
            calc('fuel_upstream', {'period': P, 'source': 'natural_gas', 'quantity': '5', 'unit': 'MMBtu', 'heatContent': {'value': '1', 'unit': 'MMBtu per mcf'}})

    def test_liquids_gallons_x_energy_density_x_upstream_intensity(self):
        self.assertEqual(T['cagreet3.heating_value_basis']['value'], 'LHV')
        self.assertTrue(all('(LHV' in T[f'carb_lcfs.energy_density.{k}']['unit'] for k in ('carbob', 'ulsd', 'propane')))
        g = calc('fuel_upstream', {'period': P, 'source': 'vehicle', 'fuel': 'gasoline', 'gallons': '1250.5'})
        self.assertEqual(total(g), F('1250.5') * ED['carbob'] * WTT['carbob'] / 1000)
        self.assertEqual(g['total']['unrounded'], '4017.8144832')  # 1250.5 x 119.53 = 149472.265; x 26.88 = 4017814.4832; / 1000 (hand arithmetic)
        d = calc('fuel_upstream', {'period': P, 'source': 'vehicle', 'fuel': 'diesel', 'gallons': '980'})
        self.assertEqual(total(d), F('980') * ED['ulsd'] * WTT['ulsd'] / 1000)
        for r, notes in ((g, ['biofuel_share_not_modelled']), (d, ['biofuel_share_not_modelled'])):
            # Round 2 (ACC-7): the CA-GREET3.0 vintage note (the LCFS moved to CA-GREET4.0 on 1 July 2025).
            self.assertEqual(r['boundary'], {'minimumBoundary': 'met', 'notes': sorted(notes + ['california_pathway_proxy', 'liquid_upstream_lhv_basis', 'upstream_gwp_inferred_ar4',
                                                                                               'cagreet3_vintage_superseded_by_cagreet4'])})
            self.assertEqual(r['co2eWithoutGasSplit']['gwpSetId'], 'AS-PUBLISHED')
        measured = calc('fuel_upstream', {'period': P, 'source': 'distillate_no2', 'consumption': {'basis': 'measured', 'gallons': '400'}})
        self.assertEqual(total(measured), F('400') * ED['ulsd'] * WTT['ulsd'] / 1000)
        self.assertIn('distillate_proxied_by_ulsd', measured['boundary']['notes'])
        tank = {'period': P, 'consumption': {'basis': 'purchases_with_tank_levels', 'purchasedGallons': '500', 'openingGallons': '120.5', 'closingGallons': '80'}}
        self.assertEqual(F(calc('fuel_upstream', dict(tank, source='distillate_no2'))['activity']['gallons']), F(s1.distillate(tank)['activity']['gallonsConsumed']))
        self.assertEqual(total(calc('fuel_upstream', dict(tank, source='distillate_no2'))), F('540.5') * ED['ulsd'] * WTT['ulsd'] / 1000)
        held = calc('fuel_upstream', {'period': P, 'source': 'distillate_no2', 'consumption': {'basis': 'purchases_only', 'purchasedGallons': '500'}})
        self.assertEqual((held['status'], held['findings']), ('input_needed', ['tank_levels_required_for_purchases']))
        neg = calc('fuel_upstream', {'period': P, 'source': 'distillate_no2', 'consumption': {'basis': 'purchases_with_tank_levels', 'purchasedGallons': '1', 'openingGallons': '0', 'closingGallons': '5'}})
        self.assertEqual((neg['status'], neg['findings']), ('review_required', ['negative_consumption_from_tank_levels']))
        # A vehicle fuel Scope 1 does not calculate has no upstream pathway here (the adapter holds it first).
        for fuel in ('e85', 'propane', 'cng', 'B100'):
            with self.assertRaises(e.Refused) as x:
                calc('fuel_upstream', {'period': P, 'source': 'vehicle', 'fuel': fuel, 'gallons': '1'})
            self.assertEqual(x.exception.code, 'upstream_factor_not_available_for_fuel')
        with self.assertRaises(e.Refused):
            calc('fuel_upstream', {'period': P, 'source': 'fugitive', 'gallons': '1'})

    def test_data_quality_defaults(self):
        ng = calc('fuel_upstream', {'period': P, 'source': 'natural_gas', 'quantity': '10', 'unit': 'MMBtu'})
        liquid = calc('fuel_upstream', {'period': P, 'source': 'vehicle', 'fuel': 'diesel', 'gallons': '10'})
        self.assertEqual(e.default_data_quality(ng)['indicators'], {'technological': 'fair', 'temporal': 'good', 'geographical': 'very_good', 'completeness': 'fair', 'reliability': 'good'})
        self.assertEqual(e.default_data_quality(liquid)['indicators'], {'technological': 'fair', 'temporal': 'fair', 'geographical': 'fair', 'completeness': 'good', 'reliability': 'good'})
        a = e.aggregate([ng, liquid])
        dq = a['categoryProfiles']['3']['dataQuality']['indicators']
        self.assertEqual(sorted(dq['temporal']['ratingKg']), ['fair', 'good'])
        self.assertEqual(F(dq['temporal']['ratingKg']['fair']['unrounded']), total(liquid))
        meta = e.describe()['methodMetadata'][NG3A]
        self.assertEqual(meta['defaultDataQualityByNote']['california_pathway_proxy']['indicators']['temporal'], 'fair')


class ElectricityUpstream(unittest.TestCase):
    EL = {'period': P, 'quantity': '1234.5', 'unit': 'MWh', 'subregion': 'CAMX', 'zip': '94105'}

    def test_3b_is_mwh_x_heat_input_per_mwh_x_netl_transmission(self):
        u, share, unmapped = intensity('CAMX')
        r = calc('electricity_upstream', self.EL)
        self.assertEqual((r['methodVersionId'], r['status'], r['gwpSetId']), (EL3B, 'complete', 'AS-PUBLISHED'))
        self.assertEqual(total(r), F('1234.5') * u)
        self.assertEqual((F(r['activity']['mappedFossilHeatInputShare']), r['activity']['unmappedFuels'], r['activity']['mappedFuels']), (share, unmapped, ['COAL', 'GAS', 'OIL']))
        self.assertEqual(unmapped, ['OFSL'])  # round 2: oil mapped, coal mine methane only (lane F); OTHF listed apart (otherFuelsNotMapped)
        self.assertEqual(r['boundary'], {'minimumBoundary': 'partial', 'notes': sorted([  # round 3 (lane A): + coal screening memo, AR5 coal code, solar co-firing
            'coal_upstream_omitted_screening_range_memo', 'solar_thermal_cofiring_upstream_not_counted', 'upstream_gwp_ar5_coal_mine_methane', 'cagreet3_vintage_superseded_by_cagreet4', 'coal_upstream_mine_methane_only', 'fossil_fuel_upstream_not_mapped',
            'nuclear_biomass_byproduct_fuels_upstream_excluded', 'oil_fired_upstream_proxied_by_ulsd', 'other_fuel_upstream_not_mapped', 'plant_primary_fuel_allocation',
            'upstream_gwp_as_published_ar6', 'upstream_gwp_inferred_ar4', 'upstream_heat_input_hhv_basis'])})
        self.assertEqual(r['additionalRegisters'], [{'name': 'supplement', 'sha256': e.SUPPLEMENT_REGISTER_SHA256}, {'name': 'us_upstream', 'sha256': e.US_UPSTREAM_REGISTER_SHA256}])
        kwh = calc('electricity_upstream', dict(self.EL, quantity='1234500', unit='kWh'))
        self.assertEqual(total(kwh), total(r))

    def test_every_subregion_and_the_us(self):
        for region in sorted({x['id'].split('.')[1] for x in R3['entries'] if x['id'].startswith('egrid2023_gen.')}):
            u, share, unmapped = intensity(region)
            with e._exact():
                used, conv = {}, []
                got, activity, notes, _memo = e._upstream_intensity(region, Decimal(1), used, conv)  # round 3: + the coal screening memo
            self.assertEqual(F(got), u, region)
            self.assertEqual(activity['unmappedFuels'], unmapped, region)
            self.assertEqual('fossil_fuel_upstream_not_mapped' in notes, bool(unmapped), region)
            self.assertEqual(None if share is None else F(activity['mappedFossilHeatInputShare']), share, region)

    def test_3c_upstream_uses_the_3c_loss_and_closes_the_3c_line(self):
        u, _, _ = intensity('CAMX')
        ggl = r1('egrid2023_ggl.western')
        loss = round12(F('1234.5') * ggl / (1 - ggl))
        up = calc('td_losses_upstream', self.EL)
        c = calc('td_losses', self.EL)
        self.assertEqual((up['methodVersionId'], F(up['activity']['lossMwh']), F(c['activity']['lossMwh'])), (LOSS3C, loss, loss))
        self.assertEqual(total(up), loss * u)
        b = calc('electricity_upstream', self.EL)
        a = e.aggregate([c, up, b])
        self.assertEqual(a['boundaryClosures'], [{'resultSha256': c['resultSha256'], 'closedBy': up['resultSha256']}])
        self.assertEqual(sorted(p['resultSha256'] for p in a['partialBoundaryResults']), sorted([up['resultSha256'], b['resultSha256']]))
        self.assertEqual(a['gwpSetsUsed'], ['AR5-100', 'AS-PUBLISHED'])
        self.assertTrue(a['mixedGwpSets'])
        self.assertEqual(F(a['categorySubtotals']['3']['unrounded']), total(c) + total(up) + total(b))
        # A different input closes nothing; one upstream line closes one 3C line only.
        other = calc('td_losses_upstream', dict(self.EL, quantity='1234.6'))
        self.assertEqual(e.aggregate([c, other])['boundaryClosures'], [])
        twice = e.aggregate([c, c, up])
        self.assertEqual(len(twice['boundaryClosures']), 1)
        self.assertEqual([p['resultSha256'] for p in twice['partialBoundaryResults']].count(c['resultSha256']), 1)
        # Without upstream lines the aggregate is exactly as before (no closure).
        self.assertEqual([p['resultSha256'] for p in e.aggregate([c])['partialBoundaryResults']], [c['resultSha256']])

    def test_prms_uses_the_us_grid_loss_and_location_findings_match_3c(self):
        pr = calc('td_losses_upstream', {'period': P, 'quantity': '10', 'unit': 'MWh', 'subregion': 'PRMS', 'zip': '00601'})
        self.assertEqual(pr['estimates'], calc('td_losses', {'period': P, 'quantity': '10', 'unit': 'MWh', 'subregion': 'PRMS', 'zip': '00601'})['estimates'])
        for bad in ({'zip': '00000'}, {'subregion': 'ERCT'}):
            for kind in ('electricity_upstream', 'td_losses_upstream'):
                inp = dict(self.EL, **bad)
                r, c = calc(kind, inp), calc('td_losses', inp)
                self.assertEqual((r['status'], r['findings'], r['total']), (c['status'], c['findings'], None), (kind, bad))
        with self.assertRaises(e.Refused):
            calc('electricity_upstream', dict(self.EL, subregion='XXXX'))

    def test_3d_upstream_us_average_and_subregion_close_the_3d_line(self):
        u, share, _ = intensity('US')
        us = {'period': P, 'quantity': '250', 'unit': 'MWh', 'gridBasis': 'us_average', 'zip': None, 'subregion': None, 'utilityEiaId': None}
        up = calc('energy_resold_upstream', us)
        self.assertEqual((up['methodVersionId'], total(up), F(up['activity']['mappedFossilHeatInputShare']), up['estimates']), (RESOLD3D, F('250') * u, share, ['us_average_upstream_intensity']))
        comb = calc('energy_resold', us)
        a = e.aggregate([comb, up])
        self.assertEqual(a['boundaryClosures'], [{'resultSha256': comb['resultSha256'], 'closedBy': up['resultSha256']}])
        self.assertNotIn(comb['resultSha256'], [p['resultSha256'] for p in a['partialBoundaryResults']])
        sub = {'period': P, 'quantity': '250000', 'unit': 'kWh', 'gridBasis': 'subregion', 'zip': '94105', 'subregion': 'CAMX', 'utilityEiaId': None}
        self.assertEqual(total(calc('energy_resold_upstream', sub)), F('250') * intensity('CAMX')[0])


class MetadataAndCatalog(unittest.TestCase):
    def test_methods_and_catalog(self):
        d = e.describe()
        methods = {m['id']: m for m in d['methods']}
        for mid in (NG3A, EL3B, LOSS3C, RESOLD3D):
            self.assertEqual((methods[mid]['gwpSetId'], methods[mid]['family']), ('AS-PUBLISHED', 'fuel_energy_related'))
            meta = d['methodMetadata'][mid]
            self.assertEqual((meta['methodType'], meta['activityDataOrigin'], meta['biogenicTreatment'], meta['additionalRegisters']),
                             ('activity_average_data', 'company_records', 'none_expected', ['supplement', 'us_upstream']))
            self.assertEqual(meta['defaultDataQuality']['indicators'], {'technological': 'fair', 'temporal': 'good', 'geographical': 'very_good', 'completeness': 'fair', 'reliability': 'good'})
        self.assertEqual(methods[EL3B]['factorValues']['netl2024_4862.ng_upstream.prod_through_transmission'], '7.8')
        self.assertEqual(methods[NG3A]['constantValues']['us_upstream_const.ng_upstream_distribution_kg_per_mmbtu_hhv']['value'], '9.284491503056')
        self.assertEqual(d['additionalRegisterSha256s']['us_upstream'], e.US_UPSTREAM_REGISTER_SHA256)
        cat = e.catalog()
        self.assertEqual((cat['upstreamSources'], cat['upstreamVehicleFuels'], cat['upstreamLiquidsVerified'], cat['powerFuelsMapped']),
                         (['natural_gas', 'distillate_no2', 'vehicle'], {'diesel': 'ulsd', 'gasoline': 'carbob'}, True, ['COAL', 'GAS', 'OIL']))
        self.assertEqual(sorted(cat['powerFossilFuels'] + cat['powerOtherFuels'] + cat['powerNonFossilFuels']),
                         sorted({x['id'].rsplit('.', 1)[1] for x in R3['entries'] if x['id'].startswith('egrid2023_hi.')}))
        self.assertEqual(cat['boundaryClosurePairs'], {'scope3.cat3.td_losses.egrid2023.v1': LOSS3C, 'scope3.cat3d.energy_resold.egrid2023.v1': RESOLD3D})

    def test_results_recompute_in_the_aggregate(self):
        rs = [calc('fuel_upstream', {'period': P, 'source': 'natural_gas', 'quantity': '1', 'unit': 'MMBtu'}), calc('electricity_upstream', ElectricityUpstream.EL)]
        tampered = json.loads(json.dumps(rs[0]))
        tampered['co2eWithoutGasSplit']['co2e'] = '1'
        tampered['total']['unrounded'] = '1'
        tampered['resultSha256'] = e.digest({k: v for k, v in tampered.items() if k != 'resultSha256'})
        with self.assertRaises(e.Refused):
            e.aggregate([tampered])
        self.assertEqual(e.aggregate(rs)['resultCount'], 2)


if __name__ == '__main__':
    unittest.main()
