"""Scope 1 beta engine checks. Expected values were computed by hand from the EPA cells named
in each case (Hub January 2025), not by calling the engine. Run: python -m unittest scope1_engine_test"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import scope1_engine as e

P = {'start': '2025-01-01', 'endExclusive': '2026-01-01'}
HERE = Path(__file__).resolve().parent


def calc(kind, **inp):
    return e.calculate({'kind': kind, 'input': dict(period=P, **inp)})


def total(r):
    return r['total']['display']


class NaturalGas(unittest.TestCase):
    def test_therms_follow_epa_worked_example(self):
        # 61,500 therms x 0.1 = 6,150 MMBtu; x (53.06 + 1/1000 x 28 + 0.1/1000 x 265) = 326,654.175
        r = calc('natural_gas', quantity='61500', unit='therm')
        self.assertEqual((r['status'], r['activity']['mmbtuHhv'], total(r)), ('complete', '6150', '326654.1750'))
        self.assertEqual(r['gases']['ch4'], {'mass': '6.15', 'massUnit': 'kg CH4', 'co2e': '172.2', 'co2eUnit': 'kg CO2e'})
        self.assertEqual(r['activity']['originalUnit'], 'therm')
        self.assertEqual([f['cell'] for f in r['factorsUsed']], ['E525', 'E524', 'E526', 'F38', 'E38', 'G38'])

    def test_mmbtu_and_half_even_rounding(self):
        # 103.7 MMBtu x 53.1145 = 5,507.97365 -> half-even keeps ...36
        self.assertEqual(total(calc('natural_gas', quantity='103.7', unit='MMBtu')), '5507.9736')
        # ccf with the bill's therm factor gives the same MMBtu: 1000 ccf x 1.037 therm/ccf x 0.1
        r = calc('natural_gas', quantity='1000', unit='ccf', heatContent={'value': '1.037', 'unit': 'therm per ccf'})
        self.assertEqual((r['activity']['mmbtuHhv'], total(r)), ('103.7', '5507.9736'))

    def test_volume_needs_stated_heat_content_never_default(self):
        r = calc('natural_gas', quantity='100000', unit='scf')
        self.assertEqual((r['status'], r['findings'], r['total']), ('input_needed', ['heat_content_required_for_volume'], None))
        r = calc('natural_gas', quantity='100000', unit='scf', heatContent={'value': '0.001026', 'unit': 'MMBtu per scf'})
        self.assertEqual(total(r), '5449.5477')  # 102.6 MMBtu x 53.1145 = 5,449.5477

    def test_quantity_rules(self):
        self.assertEqual(calc('natural_gas', quantity='1.5', unit='MMBtu')['input']['quantity'], '1.5')
        for bad in ('1.2345', '-1', '1,000', '01', '1e3', 5):
            with self.assertRaises(e.Refused):
                calc('natural_gas', quantity=bad, unit='MMBtu')
        with self.assertRaises(e.Refused):
            calc('natural_gas', quantity='1', unit='gallon')
        with self.assertRaises(e.Refused):
            e.calculate({'kind': 'natural_gas', 'input': {'period': {'start': '2024-12-01', 'endExclusive': '2025-12-01'}, 'quantity': '1', 'unit': 'MMBtu'}})


class Distillate(unittest.TestCase):
    def test_default_hhv_is_labelled(self):
        # 100 gal x 0.138 = 13.8 MMBtu x 74.203 = 1,024.0014 (10.240014 kg CO2e/gal)
        r = calc('distillate_no2', consumption={'basis': 'measured', 'gallons': '100'})
        self.assertEqual((total(r), r['estimates']), ('1024.0014', ['default_hhv']))

    def test_tank_levels_and_stated_hhv(self):
        r = calc('distillate_no2', consumption={'basis': 'purchases_with_tank_levels', 'purchasedGallons': '120', 'openingGallons': '30', 'closingGallons': '50'})
        self.assertEqual((r['activity']['gallonsConsumed'], total(r)), ('100', '1024.0014'))
        r = calc('distillate_no2', consumption={'basis': 'measured', 'gallons': '100'}, statedHhvMmbtuPerGallon='0.137')
        self.assertEqual((total(r), r['estimates']), ('1016.5811', []))  # 13.7 x 74.203

    def test_purchases_alone_are_not_consumption(self):
        r = calc('distillate_no2', consumption={'basis': 'purchases_only', 'purchasedGallons': '120'})
        self.assertEqual((r['status'], r['findings']), ('input_needed', ['tank_levels_required_for_purchases']))
        r = calc('distillate_no2', consumption={'basis': 'purchases_with_tank_levels', 'purchasedGallons': '0', 'openingGallons': '10', 'closingGallons': '20'})
        self.assertEqual(r['status'], 'review_required')


class Vehicles(unittest.TestCase):
    def test_gasoline_light_truck_with_odometer_miles(self):
        # 1000 gal x 8.78 = 8,780; 20,000 mi x 0.008 g CH4 (E202) and 0.0013 g N2O (F202): 4.48 + 6.89
        r = calc('vehicle', fuel='gasoline', vehicleType='gasoline_light_duty_truck', modelYear=2019, gallons='1000', miles={'value': '20000', 'basis': 'odometer'})
        self.assertEqual((r['status'], total(r), r['activity']['modelYearBand']), ('complete', '8791.3700', '2019'))

    def test_newer_diesel_truck_uses_latest_band_as_labelled_proxy(self):
        # 1000 gal x 10.21 + 8,000 mi x 0.0116875 kg CO2e/mi (F256, G256) = 10,303.5
        r = calc('vehicle', fuel='diesel', vehicleType='diesel_medium_heavy_duty', modelYear=2024, gallons='1000', miles={'value': '8000', 'basis': 'trip_log'})
        self.assertEqual((total(r), r['estimates']), ('10303.5000', ['model_year_proxy:2007-2022']))

    def test_miles_from_fuel_economy_are_an_estimate(self):
        # 500 gal x 20 mpg = 10,000 mi; 5,105 + 10,000 x (0.029 x 28 + 0.0214 x 265)/1000 = 5,169.83
        r = calc('vehicle', fuel='diesel', vehicleType='diesel_light_duty_truck', modelYear=2015, gallons='500', fuelEconomy={'mpg': '20', 'source': 'fleet_record'})
        self.assertEqual((total(r), r['activity']['miles'], r['estimates']), ('5169.8300', '10000', ['miles_estimated_from_fuel_economy:fleet_record']))

    def test_no_miles_gives_co2_only_partial_never_zero(self):
        r = calc('vehicle', fuel='gasoline', vehicleType='gasoline_passenger_car', modelYear=2020, gallons='300')
        self.assertEqual((r['status'], r['missingGases'], total(r), sorted(r['gases'])), ('partial', ['ch4', 'n2o'], '2634.0000', ['co2']))

    def test_uncovered_or_unsupported_vehicles_refuse(self):
        with self.assertRaises(e.Refused):
            calc('vehicle', fuel='gasoline', vehicleType='gasoline_passenger_car', modelYear=1965, gallons='1', miles={'value': '1', 'basis': 'odometer'})
        with self.assertRaises(e.Refused):
            calc('vehicle', fuel='propane', vehicleType='gasoline_passenger_car', modelYear=2020, gallons='1')
        with self.assertRaises(e.Refused):
            calc('vehicle', fuel='diesel', vehicleType='gasoline_passenger_car', modelYear=2020, gallons='1')
        r = calc('vehicle', fuel='gasoline', vehicleType='gasoline_heavy_duty', modelYear=1978, gallons='1', miles={'value': '1000', 'basis': 'odometer'})
        self.assertEqual(r['activity']['modelYearBand'], '≤1980')


class Fugitive(unittest.TestCase):
    base = dict(insideBoundary=True, maintainsRefrigerantStock=False, retrofitInPeriod=False, contractorRecordsComplete=True, eventChronologyComplete=True)

    def terms(self, **t):
        return {k: t.get(k, '0') for k in ('PN', 'CN', 'PS', 'CD', 'RD')}

    def test_pounds_convert_exactly(self):
        # 10 lb x 0.45359237 = 4.5359237 kg x 1924 (R-410A, D575) = 8,727.1171988
        r = calc('fugitive', gas='R-410A', unit='lb', terms=self.terms(PS='10'), **self.base)
        self.assertEqual((r['activity']['massKg'], r['gases']['refrigerant']['co2e'], total(r)), ('4.5359237', '8727.1171988', '8727.1172'))

    def test_full_material_balance_including_install_and_retirement(self):
        # (20 - 18) + 5 + (12 - 10) = 9 kg R-404A x 3943 (D567) = 35,487
        r = calc('fugitive', gas='R-404A', unit='kg', terms=self.terms(PN='20', CN='18', PS='5', CD='12', RD='10'), **self.base)
        self.assertEqual(total(r), '35487.0000')
        # retired fire-suppression system: 50 - 45 = 5 kg HFC-227ea x 3350
        self.assertEqual(total(calc('fugitive', gas='HFC-227ea', unit='kg', terms=self.terms(CD='50', RD='45'), **self.base)), '16750.0000')

    def test_r22_is_reported_outside_scope1(self):
        r = calc('fugitive', gas='R-22', unit='kg', terms=self.terms(PS='3'), **self.base)
        self.assertEqual((r['status'], r['total'], r['memo']['gas'], r['memo']['massKg']), ('memo_only', None, 'HCFC-22', '3'))

    def test_any_us_location_inside_boundary_and_record_rules(self):
        r = calc('fugitive', gas='R-410A', unit='kg', terms=self.terms(PS='1'), **dict(self.base, insideBoundary=False))
        self.assertEqual((r['status'], r['findings']), ('excluded', ['outside_declared_boundary']))
        r = calc('fugitive', gas='R-410A', unit='kg', terms=self.terms(PS='1'), **dict(self.base, contractorRecordsComplete=False))
        self.assertEqual(r['status'], 'input_needed')
        r = calc('fugitive', gas='R-410A', unit='kg', terms=self.terms(CN='5'), **self.base)
        self.assertEqual((r['status'], r['findings']), ('review_required', ['negative_material_balance']))
        r = calc('fugitive', gas='R-32', unit='kg', terms=self.terms(PS='1'), **self.base)
        self.assertEqual((r['status'], r['findings']), ('input_needed', ['unsupported_refrigerant']))
        with self.assertRaises(e.Refused):
            calc('fugitive', gas='R-410A', unit='kg', terms={'PS': '1'}, **self.base)

    def test_unknown_boundary_is_never_an_exclusion(self):
        # QA F05: null membership is input needed; only an explicit False excludes; other values are malformed.
        r = calc('fugitive', gas='R-410A', unit='kg', terms=self.terms(PS='1'), **dict(self.base, insideBoundary=None))
        self.assertEqual((r['status'], r['findings'], r['total']), ('input_needed', ['boundary_membership_unknown'], None))
        for bad in ('yes', 0, 1, [], {}):
            with self.assertRaises(e.Refused):
                calc('fugitive', gas='R-410A', unit='kg', terms=self.terms(PS='1'), **dict(self.base, insideBoundary=bad))

    def test_simplified_method_applicability(self):
        # QA F01: EPA fugitive guidance (Dec 2023) printed p. 8 limits Equation 6 to entities that do not maintain and
        # track a refrigerant stock and did not retrofit equipment in the period.
        for k in ('maintainsRefrigerantStock', 'retrofitInPeriod'):
            r = calc('fugitive', gas='R-410A', unit='kg', terms=self.terms(PS='1'), **dict(self.base, **{k: None}))
            self.assertEqual((r['status'], r['findings']), ('input_needed', ['simplified_method_applicability_unknown']))
            r = calc('fugitive', gas='R-410A', unit='kg', terms=self.terms(PS='1'), **dict(self.base, **{k: True}))
            self.assertEqual((r['status'], r['findings'], r['total']), ('review_required', ['simplified_method_not_applicable'], None))
        # v3 accounting review A03: a known yes is never weakened by an unknown other answer.
        for stock, retrofit in ((None, True), (True, None)):
            r = calc('fugitive', gas='R-410A', unit='kg', terms=self.terms(PS='1'), **dict(self.base, maintainsRefrigerantStock=stock, retrofitInPeriod=retrofit))
            self.assertEqual((r['status'], r['findings']), ('review_required', ['simplified_method_not_applicable']))
        missing = {k: v for k, v in self.base.items() if k != 'retrofitInPeriod'}
        with self.assertRaises(e.Refused):
            calc('fugitive', gas='R-410A', unit='kg', terms=self.terms(PS='1'), **missing)


class Aggregation(unittest.TestCase):
    def test_rounds_once_and_lists_everything_not_counted(self):
        ccf = dict(quantity='1000', unit='ccf', heatContent={'value': '1.037', 'unit': 'therm per ccf'})
        a = e.aggregate([calc('natural_gas', **ccf), calc('natural_gas', **ccf)])
        self.assertEqual(a['knownSourceSubtotal']['display'], '11015.9473')  # not 2 x 5507.9736
        results = [calc('natural_gas', quantity='61500', unit='therm'),
                   calc('vehicle', fuel='diesel', vehicleType='diesel_medium_heavy_duty', modelYear=2024, gallons='1000', miles={'value': '8000', 'basis': 'trip_log'}),
                   calc('vehicle', fuel='gasoline', vehicleType='gasoline_passenger_car', modelYear=2020, gallons='300'),
                   calc('fugitive', gas='R-22', unit='kg', terms={'PN': '0', 'CN': '0', 'PS': '3', 'CD': '0', 'RD': '0'}, insideBoundary=True, maintainsRefrigerantStock=False, retrofitInPeriod=False, contractorRecordsComplete=True, eventChronologyComplete=True),
                   calc('natural_gas', quantity='5', unit='scf')]
        a = e.aggregate(results)
        self.assertEqual(a['knownSourceSubtotal']['display'], '339591.6750')  # 326,654.175 + 10,303.5 + 2,634
        self.assertEqual((len(a['includedResults']), len(a['incompleteResults']), len(a['notCalculated']), a['reportedOutsideScopes'][0]['gas'], a['complete']), (3, 1, 1, 'HCFC-22', False))

    def test_tampered_results_are_refused(self):
        r = calc('natural_gas', quantity='1', unit='MMBtu')
        r['total']['unrounded'] = '0'
        with self.assertRaises(e.Refused):
            e.aggregate([r])

    def test_forged_total_with_recomputed_hash_is_refused(self):
        # QA observation: the hash is unkeyed, so the aggregate recomputes each result from its input.
        r = calc('natural_gas', quantity='1', unit='therm')
        body = {k: v for k, v in r.items() if k != 'resultSha256'}
        body['total'] = dict(body['total'], unrounded='999999', display='999999.0000')
        forged = dict(body, resultSha256=e.digest(body))
        with self.assertRaises(e.Refused):
            e.aggregate([forged])

    def test_empty_aggregate_is_not_complete(self):
        a = e.aggregate([])
        self.assertEqual((a['complete'], a['resultCount'], a['knownSourceSubtotal']['display']), (False, 0, '0.0000'))


class Dates(unittest.TestCase):
    def test_impossible_calendar_dates_are_refused(self):
        # QA F05: 2025-02-30 was accepted as a period.
        for start, end in (('2025-02-30', '2025-02-31'), ('2025-13-01', '2025-12-31'), ('2025-00-10', '2025-01-11'), ('2025-1-01', '2025-02-01')):
            with self.assertRaises(e.Refused) as ctx:
                e.natural_gas({'period': {'start': start, 'endExclusive': end}, 'quantity': '1', 'unit': 'therm'})
            self.assertEqual(ctx.exception.code, 'invalid_date')
        self.assertEqual(e.natural_gas({'period': {'start': '2025-02-28', 'endExclusive': '2025-03-01'}, 'quantity': '1', 'unit': 'therm'})['status'], 'complete')
        for start, end in (('2024-12-31', '2025-02-01'), ('2025-03-01', '2025-03-01'), ('2025-06-01', '2026-01-02')):
            with self.assertRaises(e.Refused) as ctx:
                e.natural_gas({'period': {'start': start, 'endExclusive': end}, 'quantity': '1', 'unit': 'therm'})
            self.assertEqual(ctx.exception.code, 'period_outside_2025_method_envelope')


class RegisterAndDescription(unittest.TestCase):
    def test_describe_uses_exact_register_values(self):
        reg = json.loads((HERE.parents[3] / 'packages/neuvetra-database/src/method-reference/verified-factor-register-2025.json').read_text('utf-8'))
        values = {x['id']: x['value'] for x in reg['entries']}
        d = e.describe()
        counts = {m['id']: len(m['factorKeys']) for m in d['methods']}
        self.assertEqual(counts, {'scope1.fugitive.material_balance.v2': 6, 'scope1.mobile.onroad_diesel.v2': 20, 'scope1.mobile.onroad_gasoline.v2': 234,
                                  'scope1.stationary.distillate_no2.v2': 7, 'scope1.stationary.natural_gas.v2': 6})
        for m in d['methods']:
            self.assertEqual(m['engineSha256'], e.engine_sha256())
            for k in m['factorKeys']:
                self.assertEqual(m['factorValues'][k], values[k].rstrip('0').rstrip('.') if '.' in values[k] else values[k])

    def test_engine_refuses_when_register_bytes_change(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'apps/site-api/src/calculation').mkdir(parents=True)
            (root / 'packages/neuvetra-database/src/method-reference').mkdir(parents=True)
            shutil.copy(HERE / 'scope1_engine.py', root / 'apps/site-api/src/calculation/scope1_engine.py')
            src = HERE.parents[3] / 'packages/neuvetra-database/src/method-reference/verified-factor-register-2025.json'
            (root / 'packages/neuvetra-database/src/method-reference/verified-factor-register-2025.json').write_text(src.read_text('utf-8').replace('"53.06"', '"53.07"'), 'utf-8')
            p = subprocess.run([sys.executable, str(root / 'apps/site-api/src/calculation/scope1_engine.py')], input=b'{"action":"describe"}', capture_output=True, env={**os.environ})
            self.assertEqual((p.returncode, json.loads(p.stdout)['status']), (2, 'error'))

    def test_cli_round_trip_and_refusal_codes(self):
        run = lambda payload: subprocess.run([sys.executable, str(HERE / 'scope1_engine.py')], input=json.dumps(payload).encode(), capture_output=True)
        ok = run({'action': 'calculate', 'request': {'kind': 'natural_gas', 'input': {'period': P, 'quantity': '61500', 'unit': 'therm'}}})
        self.assertEqual((ok.returncode, json.loads(ok.stdout)['result']['total']['display']), (0, '326654.1750'))
        bad = run({'action': 'calculate', 'request': {'kind': 'natural_gas', 'input': {'period': P, 'quantity': '1', 'unit': 'gallon'}}})
        self.assertEqual((bad.returncode, json.loads(bad.stdout)), (1, {'status': 'refused', 'code': 'unsupported_unit'}))


if __name__ == '__main__':
    unittest.main()
