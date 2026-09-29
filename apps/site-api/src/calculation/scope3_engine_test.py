"""Scope 3 engine checks. Expected values are recomputed here with exact fractions from the register
cells named in each case, independently of the engine's code path. Run: python -m unittest scope3_engine_test"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from decimal import Decimal, ROUND_HALF_EVEN
from fractions import Fraction as F
from pathlib import Path

import scope3_engine as e

P = {'start': '2025-01-01', 'endExclusive': '2026-01-01'}
HERE = Path(__file__).resolve().parent
REF = HERE.parents[3] / 'packages/neuvetra-database/src/method-reference'
REG = json.loads((REF / 'verified-scope3-register-2025.json').read_text('utf-8'))
V = {x['id']: F(x['value']) for x in REG['entries']}
CELL = {x['id']: x['valueCell'] for x in REG['entries']}
LB, GWP = F('0.45359237'), {'co2': 1, 'ch4': 28, 'n2o': 265}


def r12(q: F) -> F:
    return F(round(q * 10 ** 12), 10 ** 12)


def hub_co2e(activity: F, base: str) -> F:
    """Hub Tables 8 and 10: CO2 kg/unit, CH4 and N2O g/unit."""
    return activity * (V[base + '.co2'] + V[base + '.ch4'] / 1000 * 28 + V[base + '.n2o'] / 1000 * 265)


def exact_str(q: F) -> str:
    d = Decimal(q.numerator) / Decimal(q.denominator)
    t = format(d, 'f')
    return t.rstrip('0').rstrip('.') if '.' in t else t


class Category3TdLosses(unittest.TestCase):
    ZIPS = {'CAMX': '94105', 'ERCT': '75201', 'HIOA': '96813', 'NYCW': '10001', 'AKGD': '99501', 'PRMS': '00901'}

    def calc(self, **inp):
        return e.td_losses(dict({'period': P, 'zip': self.ZIPS.get(inp.get('subregion'), '94105')}, **inp))

    def test_camx_uses_western_ggl_and_power_profiler_formula(self):
        # 10 MWh x 0.041/0.959 (GGL23 F7 Western) = 0.427528675704 MWh (12 dp); x (428.464 + 0.025x28 + 0.003x265) lb/MWh (SRL23 W6 X6 Y6) x 0.45359237
        r = self.calc(quantity='10000', unit='kWh', subregion='CAMX')
        loss = r12(F(10) * V['egrid2023_ggl.western'] / (1 - V['egrid2023_ggl.western']))
        expected = loss * sum(V[f'egrid2023.CAMX.{g}'] * GWP[g] for g in GWP) * LB
        self.assertEqual((r['activity']['interconnect'], r['activity']['lossMwh'], r['total']['unrounded'], r['total']['display']),
                         ('western', '0.427528675704', exact_str(expected), '83.3793'))
        self.assertEqual((CELL['egrid2023_ggl.western'], r['boundary']['minimumBoundary'], r['conversions'][0]['rounded']), ('F7', 'partial', True))
        self.assertIn('combustion_only_upstream_of_lost_energy_excluded', r['boundary']['notes'])

    def test_interconnects_follow_epa_power_profiler(self):
        # USEPA/power-profiler f42a47a, prep/add_egrid_data.py lines 146-151 (PRMS uses the U.S. value)
        pp = {'alaska': ['AKGD', 'AKMS'], 'hawaii': ['HIMS', 'HIOA'], 'ercot': ['ERCT'], 'western': ['CAMX', 'NWPP', 'AZNM', 'RMPA'], 'u_s': ['PRMS'],
              'eastern': ['MROE', 'SRMV', 'SRMW', 'RFCW', 'RFCM', 'SRTV', 'SRSO', 'FRCC', 'SRVC', 'RFCE', 'NYCW', 'NYLI', 'NYUP', 'NEWE', 'SPSO', 'SPNO', 'MROW']}
        self.assertEqual({k: sorted(v) for k, v in e.INTERCONNECT.items()}, {k: sorted(v) for k, v in pp.items()})
        self.assertEqual(sorted(e.SUBREGION_INTERCONNECT), sorted({k.split('.')[1] for k in V if k.startswith('egrid2023.')}))
        self.assertEqual({k: str(v) for k, v in V.items() if k.startswith('egrid2023_ggl.')},
                         {'egrid2023_ggl.alaska': '41/1000', 'egrid2023_ggl.ercot': '21/500', 'egrid2023_ggl.eastern': '21/500', 'egrid2023_ggl.hawaii': '11/250',
                          'egrid2023_ggl.western': '41/1000', 'egrid2023_ggl.u_s': '21/500'})
        for sub, ic in (('ERCT', 'ercot'), ('HIOA', 'hawaii'), ('NYCW', 'eastern'), ('AKGD', 'alaska')):
            r = self.calc(quantity='1', unit='MWh', subregion=sub)
            self.assertEqual((r['activity']['interconnect'], r['estimates']), (ic, []))
        pr = self.calc(quantity='1', unit='MWh', subregion='PRMS')
        self.assertEqual((pr['activity']['interconnect'], pr['estimates']), ('u_s', ['us_average_grid_loss']))

    def test_zip_and_utility_evidence_as_in_scope2(self):
        r = self.calc(quantity='1', unit='MWh', subregion='ERCT', zip='94105')
        self.assertEqual((r['status'], r['findings'], r['total']), ('review_required', ['subregion_not_listed_for_zip'], None))
        r = self.calc(quantity='1', unit='MWh', subregion='RFCE', zip='07401')
        self.assertEqual((r['status'], r['findings']), ('input_needed', ['utility_required_for_multi_subregion_zip']))
        self.assertEqual(self.calc(quantity='1', unit='MWh', subregion='RFCE', zip='07401', utilityEiaId='15477')['status'], 'complete')
        r = self.calc(quantity='1', unit='MWh', subregion='RFCE', zip='07401', utilityEiaId='16213')
        self.assertEqual((r['status'], r['findings']), ('review_required', ['utility_not_listed_for_zip_and_subregion']))

    def test_refusals(self):
        for bad in (dict(quantity='1', unit='therm', subregion='CAMX'), dict(quantity='1', unit='kWh', subregion='XXXX'),
                    dict(quantity='1.2345', unit='kWh', subregion='CAMX'), dict(quantity='1', unit='kWh', subregion='CAMX', zip='9410'),
                    dict(quantity='1', unit='kWh', subregion='CAMX', utilityEiaId=16612), dict(quantity='1', unit='kWh', subregion='CAMX', instruments=[])):
            with self.assertRaises(e.Refused):
                self.calc(**bad)
        with self.assertRaises(e.Refused):
            e.td_losses({'period': P, 'quantity': '1', 'unit': 'kWh', 'subregion': 'CAMX'})


class Categories4And9Transport(unittest.TestCase):
    def calc(self, **inp):
        return e.transport(dict({'period': P, 'thirdPartyFacilities': 'none'}, **inp))

    def test_third_party_facilities_decide_the_boundary(self):
        # v3 accounting review A04: warehousing and distribution centres are inside the category 4/9 minimum boundary.
        base = dict(category=9, vehicle='rail', loadBasis='shared_vehicle', activity={'value': '100', 'unit': 'short ton-mile'})
        self.assertEqual(self.calc(**base)['boundary'], {'minimumBoundary': 'met', 'notes': ['tank_to_wheel_only']})
        for answer, note in (('present_not_included', 'third_party_facilities_not_included'), ('unknown', 'third_party_facilities_not_assessed')):
            r = self.calc(**dict(base, thirdPartyFacilities=answer))
            self.assertEqual((r['status'], r['boundary']), ('complete', {'minimumBoundary': 'partial', 'notes': sorted(['tank_to_wheel_only', note])}))
            a = e.aggregate([r])
            self.assertEqual((a['allCalculated'], a['complete'], len(a['partialBoundaryResults'])), (True, False, 1))
        for bad in (None, True, 'maybe'):
            with self.assertRaises(e.Refused):
                self.calc(**dict(base, thirdPartyFacilities=bad))
        with self.assertRaises(e.Refused):
            e.transport(dict(period=P, **base))

    def test_dedicated_truck_vehicle_miles(self):
        # 1,000 x (1.298 + 0.0115/1000 x 28 + 0.0376/1000 x 265) (Table 8 D422 E422 F422) = 1,308.286
        r = self.calc(category=4, vehicle='medium_and_heavy_duty_truck', loadBasis='dedicated_vehicle', activity={'value': '1000', 'unit': 'vehicle-mile'})
        self.assertEqual((r['total']['unrounded'], r['category'], r['conversions']), ('1308.286', 4, []))
        self.assertEqual([f['cell'] for f in r['factorsUsed'] if f['key'].startswith('transport.')], ['E422', 'D422', 'F422'])

    def test_shared_truck_tonne_km(self):
        stm = r12(F(1000) * 1000 / (LB * 2000 * F('1.609344')))
        r = self.calc(category=9, vehicle='medium_and_heavy_duty_truck', loadBasis='shared_vehicle', activity={'value': '1000', 'unit': 'tonne-km'})
        self.assertEqual((r['activity']['amount'], r['total']['unrounded'], r['total']['display'], r['category']),
                         (exact_str(stm), exact_str(hub_co2e(stm, 'transport.medium_and_heavy_duty_truck.short_ton_mile')), '128.4105', 9))

    def test_aircraft_published_zero_ch4_is_a_value(self):
        r = self.calc(category=4, vehicle='aircraft', loadBasis='shared_vehicle', activity={'value': '100', 'unit': 'short ton-mile'})
        self.assertEqual((r['gases']['ch4']['mass'], r['total']['unrounded']), ('0', exact_str(hub_co2e(F(100), 'transport.aircraft.short_ton_mile'))))

    def test_refusals(self):
        for bad in (dict(category=5, vehicle='rail', loadBasis='shared_vehicle', activity={'value': '1', 'unit': 'short ton-mile'}),
                    dict(category=True, vehicle='rail', loadBasis='shared_vehicle', activity={'value': '1', 'unit': 'short ton-mile'}),
                    dict(category=4, vehicle='rail', loadBasis='dedicated_vehicle', activity={'value': '1', 'unit': 'vehicle-mile'}),
                    dict(category=4, vehicle='passenger_car', loadBasis='shared_vehicle', activity={'value': '1', 'unit': 'short ton-mile'}),
                    dict(category=4, vehicle='rail', loadBasis='shared_vehicle', activity={'value': '1', 'unit': 'vehicle-mile'}),
                    dict(category=4, vehicle='barge', loadBasis='shared_vehicle', activity={'value': '1', 'unit': 'short ton-mile'}),
                    dict(category=4, vehicle='rail', loadBasis='unknown', activity={'value': '1', 'unit': 'short ton-mile'})):
            with self.assertRaises(e.Refused):
                self.calc(**bad)


class Categories5And12Waste(unittest.TestCase):
    def calc(self, **inp):
        return e.waste(dict(period=P, **inp))

    def test_units(self):
        # Mixed MSW landfilled 0.58 t CO2e per short ton (Table 9 E477)
        f = V['waste.mixed_msw.landfilled']
        self.assertEqual(CELL['waste.mixed_msw.landfilled'], 'E477')
        cases = (('2', 'short_ton', F(2)), ('4000', 'lb', F(2)), ('1000', 'kg', r12(F(1000) / (LB * 2000))), ('1.5', 'metric_ton', r12(F(1500) / (LB * 2000))))
        for q, unit, tons in cases:
            r = self.calc(category=5, material='mixed_msw', treatment='landfilled', quantity=q, unit=unit)
            self.assertEqual((r['activity']['shortTons'], r['total']['unrounded'], r['gases'], r['gwpSetId']), (exact_str(tons), exact_str(tons * f * 1000), {}, 'AR4-100'))
            self.assertEqual(r['co2eWithoutGasSplit']['co2e'], r['total']['unrounded'])
        self.assertFalse(self.calc(category=5, material='mixed_msw', treatment='landfilled', quantity='4000', unit='lb')['conversions'][0]['rounded'])

    def test_stored_asphalt_value_is_used_not_the_printed_rounding(self):
        r = self.calc(category=12, material='asphalt_concrete', treatment='recycled', quantity='1', unit='short_ton')
        self.assertEqual((r['total']['unrounded'], r['total']['display'], r['category']), ('3.5205384954666674', '3.5205', 12))

    def test_na_treatment_is_not_calculated_and_never_zero(self):
        r = self.calc(category=5, material='mixed_msw', treatment='recycled', quantity='1', unit='short_ton')
        self.assertEqual((r['status'], r['total'], r['findings']), ('input_needed', None, ['no_published_factor_for_material_and_treatment']))

    def test_refusals(self):
        for bad in (dict(category=6, material='mixed_msw', treatment='landfilled', quantity='1', unit='short_ton'),
                    dict(category=5, material='plutonium', treatment='landfilled', quantity='1', unit='short_ton'),
                    dict(category=5, material='mixed_msw', treatment='buried', quantity='1', unit='short_ton'),
                    dict(category=5, material='mixed_msw', treatment='landfilled', quantity='1', unit='cubic_yard'),
                    dict(category=5, material='mixed_msw', treatment='landfilled', quantity='', unit='short_ton')):
            with self.assertRaises(e.Refused):
                self.calc(**bad)


class Categories6And7Travel(unittest.TestCase):
    def test_bus_passenger_miles(self):
        # 1,000 x (0.066 + 0.0046/1000 x 28 + 0.0019/1000 x 265) (Table 10 D512 E512 F512) = 66.6323
        r = e.business_travel({'period': P, 'mode': 'bus', 'activity': {'value': '1000', 'unit': 'passenger-mile'}})
        self.assertEqual((r['total']['unrounded'], r['category'], r['boundary']), ('66.6323', 6, {'minimumBoundary': 'met', 'notes': ['tank_to_wheel_only']}))

    def test_air_haul_from_segment_distance(self):
        for dist, unit, mode in (('299.999', 'mile', 'air_short_haul'), ('300', 'mile', 'air_medium_haul'), ('2299.999', 'mile', 'air_medium_haul'),
                                 ('2300', 'mile', 'air_long_haul'), ('482.803', 'km', 'air_short_haul'), ('482.804', 'km', 'air_medium_haul')):
            r = e.business_travel({'period': P, 'mode': 'air', 'segmentDistance': {'value': dist, 'unit': unit}, 'passengerSegments': 3})
            self.assertEqual(r['activity']['mode'], mode, dist + unit)
        # 2,475 miles x 2 segments = 4,950 passenger-miles x (0.163 + 0.0006/1000 x 28 + 0.0052/1000 x 265) (D515 E515 F515) = 813.75426
        r = e.business_travel({'period': P, 'mode': 'air', 'segmentDistance': {'value': '2475', 'unit': 'mile'}, 'passengerSegments': 2})
        self.assertEqual((r['total']['unrounded'], r['estimates']), ('813.75426', []))
        self.assertIn('radiative_forcing_not_included', r['boundary']['notes'])

    def test_declared_haul_needs_basis_and_is_labelled(self):
        r = e.business_travel({'period': P, 'mode': 'air_medium_haul', 'activity': {'value': '10000', 'unit': 'passenger-mile'}, 'haulBasis': 'Agency report FY2025'})
        self.assertEqual((r['estimates'], r['total']['unrounded']), (['air_haul_declared'], exact_str(hub_co2e(F(10000), 'travel.air_travel_medium_haul_300_miles_2300_miles.passenger_mile'))))
        for bad in ({'mode': 'air_medium_haul', 'activity': {'value': '1', 'unit': 'passenger-mile'}},
                    {'mode': 'air_medium_haul', 'activity': {'value': '1', 'unit': 'passenger-mile'}, 'haulBasis': ' '},
                    {'mode': 'air', 'segmentDistance': {'value': '0', 'unit': 'mile'}, 'passengerSegments': 1},
                    {'mode': 'air', 'segmentDistance': {'value': '10', 'unit': 'mile'}, 'passengerSegments': 0},
                    {'mode': 'air', 'segmentDistance': {'value': '10', 'unit': 'mile'}, 'passengerSegments': True},
                    {'mode': 'bus', 'activity': {'value': '1', 'unit': 'vehicle-mile'}}):
            with self.assertRaises(e.Refused):
                e.business_travel(dict(period=P, **bad))

    def test_commuting_km_and_no_air(self):
        miles = r12(F(100) / F('1.609344'))
        r = e.employee_commuting({'period': P, 'mode': 'passenger_car', 'activity': {'value': '100', 'unit': 'vehicle-km'}})
        self.assertEqual((r['activity']['amount'], r['total']['unrounded'], r['category']), (exact_str(miles), exact_str(hub_co2e(miles, 'travel.passenger_car.vehicle_mile')), 7))
        rail = e.employee_commuting({'period': P, 'mode': 'intercity_rail_national_average', 'activity': {'value': '10', 'unit': 'passenger-mile'}})
        self.assertEqual(rail['estimates'], ['intercity_rail_route_average'])
        for mode in ('air', 'air_short_haul'):
            with self.assertRaises(e.Refused):
                e.employee_commuting({'period': P, 'mode': mode, 'activity': {'value': '1', 'unit': 'passenger-mile'}})
        with self.assertRaises(e.Refused):
            e.employee_commuting({'period': {'start': '2026-01-01', 'endExclusive': '2026-02-01'}, 'mode': 'bus', 'activity': {'value': '1', 'unit': 'passenger-mile'}})


class Aggregate(unittest.TestCase):
    def test_category_subtotals_rounded_once_and_disclosures(self):
        results = [e.td_losses({'period': P, 'quantity': '10000', 'unit': 'kWh', 'subregion': 'CAMX', 'zip': '94105'}),
                   e.business_travel({'period': P, 'mode': 'bus', 'activity': {'value': '1000', 'unit': 'passenger-mile'}}),
                   e.business_travel({'period': P, 'mode': 'air', 'segmentDistance': {'value': '2475', 'unit': 'mile'}, 'passengerSegments': 2}),
                   e.waste({'period': P, 'category': 5, 'material': 'mixed_msw', 'treatment': 'landfilled', 'quantity': '2', 'unit': 'short_ton'}),
                   e.waste({'period': P, 'category': 5, 'material': 'mixed_msw', 'treatment': 'recycled', 'quantity': '2', 'unit': 'short_ton'})]
        a = e.aggregate(results)
        cat3 = F(results[0]['total']['unrounded'])
        self.assertEqual({k: v['unrounded'] for k, v in a['categorySubtotals'].items()},
                         {'3': exact_str(cat3), '5': '1160', '6': '880.38656'})
        self.assertEqual((a['knownSourceSubtotal']['unrounded'], a['complete'], a['allCalculated'], a['mixedGwpSets'], a['gwpSetsUsed'], len(a['notCalculated']), len(a['partialBoundaryResults'])),
                         (exact_str(cat3 + 1160 + F('880.38656')), False, False, True, ['AR4-100', 'AR5-100'], 1, 1))
        self.assertEqual({k: v['unrounded'] for k, v in a['gwpSetSubtotals'].items()}, {'AR4-100': '1160', 'AR5-100': exact_str(cat3 + F('880.38656'))})

    def test_complete_needs_met_boundaries_and_one_gwp_set(self):
        losses = e.td_losses({'period': P, 'quantity': '1', 'unit': 'MWh', 'subregion': 'CAMX', 'zip': '94105'})
        bus = e.business_travel({'period': P, 'mode': 'bus', 'activity': {'value': '1', 'unit': 'passenger-mile'}})
        waste = e.waste({'period': P, 'category': 5, 'material': 'mixed_msw', 'treatment': 'landfilled', 'quantity': '1', 'unit': 'short_ton'})
        self.assertEqual([(x['allCalculated'], x['complete']) for x in (e.aggregate([losses]), e.aggregate([bus, waste]), e.aggregate([bus]))],
                         [(True, False), (True, False), (True, True)])

    def test_tampered_or_forged_result_refused(self):
        r = e.business_travel({'period': P, 'mode': 'bus', 'activity': {'value': '1', 'unit': 'passenger-mile'}})
        r['total']['unrounded'] = '0'
        with self.assertRaises(e.Refused):
            e.aggregate([r])
        r = e.business_travel({'period': P, 'mode': 'bus', 'activity': {'value': '1', 'unit': 'passenger-mile'}})
        body = {k: v for k, v in r.items() if k != 'resultSha256'}
        body['total'] = dict(body['total'], unrounded='0')
        with self.assertRaises(e.Refused):
            e.aggregate([dict(body, resultSha256=e.digest(body))])

    def test_empty_is_not_complete(self):
        a = e.aggregate([])
        self.assertEqual((a['complete'], a['resultCount'], a['categorySubtotals']), (False, 0, {}))


class Dates(unittest.TestCase):
    def test_impossible_dates_refused(self):
        for fn, inp in ((e.waste, {'category': 5, 'material': 'mixed_msw', 'treatment': 'landfilled', 'quantity': '1', 'unit': 'short_ton'}),
                        (e.business_travel, {'mode': 'bus', 'activity': {'value': '1', 'unit': 'passenger-mile'}})):
            with self.assertRaises(e.Refused) as ctx:
                fn(dict(inp, period={'start': '2025-02-29', 'endExclusive': '2025-03-01'}))
            self.assertEqual(ctx.exception.code, 'invalid_date')


class DataIntegrity(unittest.TestCase):
    def test_describe_matches_register(self):
        d = e.describe()
        self.assertEqual([(m['id'], len(m['factorKeys']), m['gwpSetId']) for m in d['methods']], [
            ('scope3.cat3.td_losses.egrid2023.v1', 90, 'AR5-100'), ('scope3.cat4_9.transport_distance.v1', 24, 'AR5-100'),
            ('scope3.cat5_12.waste.v1', 183, 'AR4-100'), ('scope3.cat6.business_travel_distance.v1', 39, 'AR5-100'),
            ('scope3.cat7.employee_commuting_distance.v1', 30, 'AR5-100')])
        raw = {x['id']: x['value'] for x in REG['entries']}
        consts = {c['id']: {'value': c['value'], 'unit': c['unit']} for c in REG['constants']}
        for m in d['methods']:
            self.assertEqual(m['constantValues'], {c: consts[c] for c in m['constantIds']})
            self.assertEqual(set(m) - {'factorValues', 'factorCells', 'constantValues'}, {'id', 'profileId', 'scope', 'family', 'title', 'formula', 'enginePath', 'engineSha256', 'registerSha256',
                                                                       'gwpSetId', 'admissionRules', 'estimateRules', 'reportingPeriod', 'factorKeys', 'constantIds'})
            self.assertEqual(m['factorValues'], {k: raw[k] for k in m['factorKeys']})
        elec = {x['id']: x['value'] for x in json.loads((REF / 'verified-electricity-register-egrid2023.json').read_text('utf-8'))['entries']}
        hub = {x['id']: x['value'] for x in json.loads((REF / 'verified-factor-register-2025.json').read_text('utf-8'))['entries']}
        for k, v in raw.items():
            if k.startswith('egrid2023.'):
                self.assertEqual(v, elec[k])
            if k.startswith('gwp_ar5.'):
                self.assertEqual(v, hub[k])

    def test_catalog(self):
        c = e.catalog()
        self.assertEqual((len(c['travelModes']), len(c['transportVehicles']), len(c['wasteMaterials']), sum(len(m['treatments']) for m in c['wasteMaterials'])), (12, 6, 61, 183))

    def test_engine_refuses_changed_register(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'apps/site-api/src/calculation').mkdir(parents=True)
            shutil.copytree(REF, root / 'packages/neuvetra-database/src/method-reference')
            shutil.copy(HERE / 'scope3_engine.py', root / 'apps/site-api/src/calculation/scope3_engine.py')
            target = root / 'packages/neuvetra-database/src/method-reference/verified-scope3-register-2025.json'
            text = target.read_bytes().decode('utf-8')
            self.assertIn('"0.066"', text)
            target.write_bytes(text.replace('"0.066"', '"0.067"', 1).encode('utf-8'))
            p = subprocess.run([sys.executable, str(root / 'apps/site-api/src/calculation/scope3_engine.py')], input=b'{"action":"describe"}', capture_output=True, env={**os.environ})
            self.assertEqual((p.returncode, json.loads(p.stdout)['status']), (2, 'error'))

    def test_cli(self):
        req = {'action': 'calculate', 'request': {'kind': 'waste', 'input': {'period': P, 'category': 5, 'material': 'mixed_msw', 'treatment': 'landfilled', 'quantity': '2', 'unit': 'short_ton'}}}
        p = subprocess.run([sys.executable, str(HERE / 'scope3_engine.py')], input=json.dumps(req).encode(), capture_output=True)
        self.assertEqual((p.returncode, json.loads(p.stdout)['result']['total']['display']), (0, '1160.0000'))
        p = subprocess.run([sys.executable, str(HERE / 'scope3_engine.py')], input=json.dumps({'action': 'calculate', 'request': {'kind': 'hotel', 'input': {}}}).encode(), capture_output=True)
        self.assertEqual((p.returncode, json.loads(p.stdout)), (1, {'status': 'refused', 'code': 'unsupported_kind'}))


if __name__ == '__main__':
    unittest.main()
