"""Scope 3 completion I-05: energy resold (3D), average-data commuting and teleworking (7), asset-specific energy (4, 8, 9,
10, 13, 14) and partner-reported scope 1 and 2 (4, 5, 8, 9, 10, 12, 13, 14); register R3; aggregate profile keys
(DESIGN 4.3, 4.4, 4.6, 8.1).

Expected values never come from the engine:
- register vectors are exact `Fraction` arithmetic on the R3/R1 cells they cite (eGRID2023 rev2 US23 U3:W3 and SRL23, Hub
  2025 Table 1 row 38, Tables 11 and 12);
- the GHG Protocol worked examples (calculation guidance 4.5, 7.2, 8.1 = 1,320, 10.1 energy lines, 13.1, 14.1; corrected
  values from research/vectors/ghgp-calc-guidance-examples.json) use their own illustrative factors through test-only
  patched registers, never register factors;
- the EPA Simplified GHG Emissions Calculator (SGEC) oracle file `testdata/scope3-sgec-oracle-i05.json` holds what LibreOffice
  computed from a scratch copy of the calculator patched to Hub 2025 Table 1 and eGRID2023 rev2 ($S/s3/p4tools/epa_calc_oracle.py
  --i05): electricity lb per gas must equal the engine's kg / 0.45359237; natural gas must equal the engine's figure times the
  exact ratio of the calculator's per-scf chain to the Hub's per-MMBtu chain (the calculator uses the Hub's rounded per-unit
  columns), and stay within 1e-4 of it in CO2e.
When NEUVETRA_METHOD_SOURCES_DIR holds the staged Hub xlsx and pdf and the eGRID rev2 xlsx, the builder must reproduce R3
byte for byte (it asserts the PDF cross-checks and the heat-input sums itself). Run: python -m unittest scope3_engine_energy_partner_test
"""
import contextlib
import hashlib
import json
import os
import random
import subprocess
import sys
import tempfile
import unittest
from decimal import Decimal, ROUND_HALF_EVEN, localcontext
from fractions import Fraction as F
from pathlib import Path

import scope3_engine as e

P = {'start': '2025-01-01', 'endExclusive': '2026-01-01'}
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
REF = ROOT / 'packages/neuvetra-database/src/method-reference'
R3_PATH = REF / 'verified-scope3-supplement-register-2025.json'
R3_RAW = R3_PATH.read_bytes()
R3 = json.loads(R3_RAW.decode('utf-8'))
V3 = {x['id']: x for x in R3['entries']}
C3 = {x['id']: x for x in R3['constants']}
R1 = json.loads((REF / 'verified-scope3-register-2025.json').read_text('utf-8'))
V1 = {x['id']: x for x in R1['entries']}
C1 = {x['id']: x for x in R1['constants']}
BUILDER = ROOT / 'tools/method-reference/build_scope3_supplement_register.py'
ORACLE = json.loads((HERE / 'testdata/scope3-sgec-oracle-i05.json').read_text('utf-8'))
HUB_SHA, HUB_PDF_SHA, EGRID_SHA = ('43afb91d79b2ae765b3a447549d9e1021a144a407cec5eb804be9fcf69a668a7', '5d07c678fae6783623acb1e23faa4a7c46268ee6c5a0654c9e49c50de7caf924',
                                   '895cd81dd8662406189ad8adf5a2578dcb362cdb5cff7cca81b10ee6bd2447c6')
NONE = {'dataQuality': None, 'activityDataOrigin': None}
RESOLD, AVG, TELE, ASSET, PARTNER = ('scope3.cat3d.energy_resold.egrid2023.v1', 'scope3.cat7.commuting_average.v1', 'scope3.cat7.teleworking.v1',
                                     'scope3.asset_energy.v1', 'scope3.partner_reported.v1')
GWP = {'co2': F(1), 'ch4': F(28), 'n2o': F(265)}
LB = F(Decimal('0.45359237'))


def text(q: F) -> str:
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


def v(key: str) -> F:
    return F(Decimal((V3 if key in V3 else V1)[key]['value']))


def total(r) -> F:
    return F(Decimal(r['total']['unrounded']))


def resold(**over):
    inp = {'period': P, 'quantity': '1200.5', 'unit': 'MWh', 'gridBasis': 'subregion', 'zip': '94105', 'subregion': 'CAMX', 'utilityEiaId': None}
    inp.update(over)
    return {'kind': 'energy_resold', 'input': inp}


def mode(m, share, distance, unit='mile', occupancy=None):
    return {'mode': m, 'sharePercent': share, 'oneWayDistance': distance, 'distanceUnit': unit, 'occupancy': occupancy}


def commuting(**over):
    inp = {'period': P, 'headcount': '180', 'workingDays': 220, 'modes': [mode('passenger_car', '60', '12', 'mile', '1.2'), mode('bus', '30', '8'), mode('non_motorized', '10', '2')]}
    inp.update(over)
    return {'kind': 'commuting_average', 'input': inp}


def telework(**over):
    inp = {'period': P, 'carrier': 'electricity', 'quantity': '3200', 'unit': 'kWh', 'zip': '94105', 'subregion': 'CAMX', 'utilityEiaId': None}
    inp.update(over)
    return {'kind': 'teleworking', 'input': inp}


def gas_telework(**over):
    return telework(**dict({'carrier': 'natural_gas', 'quantity': '85', 'unit': 'therm', 'zip': None, 'subregion': None}, **over))


def asset(**over):
    inp = {'period': P, 'category': 8, 'carrier': 'electricity', 'quantity': '48000', 'unit': 'kWh', 'zip': '94105', 'subregion': 'CAMX', 'utilityEiaId': None,
           'refrigerantGas': None, 'allocation': None}
    inp.update(over)
    return {'kind': 'asset_energy', 'input': inp}


def gas_asset(**over):
    return asset(**dict({'carrier': 'natural_gas', 'quantity': '5200', 'unit': 'therm', 'zip': None, 'subregion': None}, **over))


def refrigerant(**over):
    return asset(**dict({'carrier': 'refrigerant', 'quantity': '3.5', 'unit': 'lb', 'zip': None, 'subregion': None, 'refrigerantGas': 'R-410A'}, **over))


def partner(**over):
    inp = {'period': P, 'category': 13, 'quantity': '9000', 'unit': 'kg CO2e', 'allocationBasis': 'area', 'allocationNumerator': '5000', 'allocationDenominator': '15000',
           'scope2Basis': 'location', 'gwpBasis': 'AR5', 'verification': 'third_party_verified', 'periodMatches': True}
    inp.update(over)
    return {'kind': 'partner_reported', 'input': inp}


def calc(req) -> dict:
    return e.calculate(req)


def refusal(req) -> str:
    try:
        e.calculate(req)
    except e.Refused as x:
        return x.code
    raise AssertionError('not refused')


def grid_kg(mwh: F, prefix: str) -> dict:
    """kg per gas and kg CO2e from eGRID rates (lb/MWh) cited in the registers: MWh x rate x 0.45359237 x AR5 GWP."""
    out = {gas: mwh * v(f'{prefix}.{gas}') * LB for gas in GWP}
    return dict(out, co2e=sum(out[g] * GWP[g] for g in GWP))


def gas_kg(mmbtu: F) -> dict:
    """Hub 2025 Table 1 row 38 (E38 kg CO2, F38 g CH4, G38 g N2O per MMBtu)."""
    out = {'co2': mmbtu * v('hub2025_t1.natural_gas.co2'), 'ch4': mmbtu * v('hub2025_t1.natural_gas.ch4') / 1000, 'n2o': mmbtu * v('hub2025_t1.natural_gas.n2o') / 1000}
    return dict(out, co2e=sum(out[g] * GWP[g] for g in GWP))


@contextlib.contextmanager
def patched_registers(main=(), supplement=(), main_constants=()):
    """Test-only: R1 and R3 with replaced values (the GHG Protocol's illustrative factors never enter a real register)."""
    reg = json.loads(R3_RAW.decode('utf-8'))
    ent = {x['id']: x for x in reg['entries']}
    for key, value in supplement:
        ent[key] = dict(ent.get(key, {'id': key, 'table': 'test only', 'sheet': 'test only', 'valueCell': 'test only', 'unit': 'test only', 'labelCells': [], 'label': key}), value=value)
    reg['entries'] = sorted(ent.values(), key=lambda x: x['id'])
    raw = json.dumps(reg).encode('utf-8')
    main_reg = {'entries': dict(e.REGISTER['entries']), 'constants': dict(e.REGISTER['constants'])}
    for key, value in main:
        main_reg['entries'][key] = dict(main_reg['entries'][key], value=value)
    for key, value in main_constants:
        main_reg['constants'][key] = dict(main_reg['constants'][key], value=value)
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / 'r3.json'
        path.write_bytes(raw)
        saved, cached, saved_main = dict(e.REGISTERS['supplement']), e._LOADED_REGISTERS.pop('supplement', None), e.REGISTER
        e.REGISTERS['supplement'] = {'path': path, 'sha256': hashlib.sha256(raw).hexdigest()}
        e.REGISTER = main_reg
        try:
            yield
        finally:
            e.REGISTERS['supplement'] = saved
            e.REGISTER = saved_main
            e._LOADED_REGISTERS.pop('supplement', None)
            if cached is not None:
                e._LOADED_REGISTERS['supplement'] = cached


def staged(name: str, sha: str) -> Path | None:
    for folder in filter(None, os.environ.get('NEUVETRA_METHOD_SOURCES_DIR', '').split(os.pathsep)):
        for p in sorted(Path(folder).rglob(name)):
            if hashlib.sha256(p.read_bytes()).hexdigest() == sha:
                return p
    return None


class SupplementRegister(unittest.TestCase):
    def test_pinned_bytes_shape_and_content(self):
        self.assertEqual(hashlib.sha256(R3_RAW).hexdigest(), e.SUPPLEMENT_REGISTER_SHA256)
        self.assertEqual((e.REGISTERS['supplement']['path'], e.REGISTERS['supplement']['sha256']), (R3_PATH, e.SUPPLEMENT_REGISTER_SHA256))
        # The 0024 loader shape: six top-level keys; allowed entry keys only; a GWP entry's label is its gas (0024 loads it as the gas name).
        self.assertEqual(sorted(R3), ['constants', 'entries', 'method', 'schema', 'source', 'verifiedBy'])
        self.assertEqual({k: R3['source'][k] for k in ('url', 'sha256', 'bytes')},
                         {'url': 'https://www.epa.gov/system/files/other-files/2025-01/ghg-emission-factors-hub-2025.xlsx', 'sha256': HUB_SHA, 'bytes': 1014275})
        allowed = {'id', 'label', 'labelCells', 'sheet', 'table', 'unit', 'value', 'valueCell', 'fuel', 'modelYear', 'vehicleType', 'gwpSet', 'composition', 'sourceSha256'}
        for x in R3['entries']:
            self.assertTrue(set(x) <= allowed and {'id', 'label', 'labelCells', 'sheet', 'table', 'unit', 'value', 'valueCell'} <= set(x), x['id'])
            self.assertTrue(all(isinstance(val, str) for k, val in x.items() if k != 'labelCells') and e.FACTOR_TEXT.fullmatch(x['value']), x['id'])
            self.assertNotIn('fuel', x)  # 0024 needs fuel, vehicleType and modelYear together
            if 'gwpSet' in x:
                self.assertEqual((x['gwpSet'], x['label']), ('AR5-100', x['id'].split('.', 1)[1]))
            if x['id'].startswith(('egrid2023_us.', 'egrid2023_hi.', 'egrid2023_gen.')):
                self.assertEqual(x['sourceSha256'], EGRID_SHA)
        for c in R3['constants']:
            self.assertTrue(c['id'].startswith('supplement_const.') and set(c) <= {'id', 'value', 'unit', 'basis', 'sourceSha256'})
        self.assertEqual([x['id'] for x in R3['entries']], sorted(x['id'] for x in R3['entries']))
        prefixes = {}
        for x in R3['entries']:
            prefixes[x['id'].split('.')[0]] = prefixes.get(x['id'].split('.')[0], 0) + 1
        # 58 Table 1 fuels x 4, 32 Table 11 gases + 30 Table 12 blends, 3 U.S. rates, 27 subregions + U.S. generation.
        self.assertEqual(prefixes, {'hub2025_t1': 232, 'hub2025_gwp': 62, 'egrid2023_us': 3, 'egrid2023_gen': 28, 'egrid2023_hi': 142})
        # Every key routes to R3 (the engine's prefix map) and none collides with R1 or R2.
        self.assertEqual({e.register_for_key(x['id']) for x in R3['entries'] + R3['constants']}, {'supplement'})

    def test_published_cells(self):
        cell = lambda k: (V3[k]['valueCell'], V3[k]['value'], V3[k]['unit'])
        self.assertEqual(cell('hub2025_t1.natural_gas.heat_content'), ('D38', '0.001026', 'mmBtu per scf (HHV)'))
        self.assertEqual((cell('hub2025_t1.natural_gas.co2'), cell('hub2025_t1.natural_gas.ch4'), cell('hub2025_t1.natural_gas.n2o')),
                         (('E38', '53.06', 'kg CO2 per mmBtu'), ('F38', '1', 'g CH4 per mmBtu'), ('G38', '0.1', 'g N2O per mmBtu')))
        self.assertEqual(cell('hub2025_t1.motor_gasoline.heat_content'), ('D66', '0.125', 'mmBtu per gallon (HHV)'))
        self.assertEqual(cell('hub2025_t1.anthracite.heat_content'), ('D17', '25.09', 'mmBtu per short ton (HHV)'))
        self.assertEqual(cell('hub2025_t1.blast_furnace_gas.heat_content'), ('D40', '0.000092', 'mmBtu per scf (HHV)'))  # stored 9.2e-05, written without an exponent
        self.assertEqual(V3['hub2025_t1.biodiesel_100.co2']['table'], 'Table 1 Stationary Combustion: Biomass Fuels - Liquid')
        self.assertEqual((cell('hub2025_gwp.HFC-134a'), cell('hub2025_gwp.SF6'), cell('hub2025_gwp.CO2')),
                         (('E532', '1300', 'kg CO2e per kg gas'), ('E546', '23500', 'kg CO2e per kg gas'), ('E524', '1', 'kg CO2e per kg gas')))
        self.assertEqual((cell('hub2025_gwp.R-410A'), V3['hub2025_gwp.R-410A']['composition']), (('D575', '1924', 'kg CO2e per kg blend'), '50% HFC-32 , 50% HFC-125'))
        self.assertEqual(V3['hub2025_gwp.R-406A']['value'], '0')  # HCFC-only blend: 0 as published (Table 12 note C591)
        self.assertEqual([cell(f'egrid2023_us.{g}') for g in ('co2', 'ch4', 'n2o')],
                         [('U3', '767.209', 'lb CO2 per MWh'), ('V3', '0.057', 'lb CH4 per MWh'), ('W3', '0.008', 'lb N2O per MWh')])
        self.assertEqual(cell('egrid2023_gen.CAMX'), ('I6', '220986983.331', 'MWh'))
        self.assertEqual(V3['egrid2023_hi.CAMX.GAS']['value'], '677848268.439')
        # research/methods-energy-travel.md 2.2 (computed from the staged xlsx by another agent): CAMX GAS 3.067367 MMBtu/MWh.
        self.assertEqual(fixed(v('egrid2023_hi.CAMX.GAS') / v('egrid2023_gen.CAMX'), 6), '3.067367')
        self.assertEqual(fixed(v('egrid2023_hi.ERCT.COAL') / v('egrid2023_gen.ERCT'), 6), '1.466130')
        self.assertEqual({k: C3[k]['value'] for k in C3}, {'supplement_const.kwh_per_mmbtu': '293.07107017222222222222', 'supplement_const.liter_per_us_gallon': '3.785411784',
                                                          'supplement_const.scf_per_ccf': '100', 'supplement_const.scf_per_mcf': '1000',
                                                          'supplement_const.sqft_per_m2': '10.76391041670972230833', 'supplement_const.therm_to_mmbtu': '0.1'})

    def test_heat_input_sums_are_consistent(self):
        # The builder asserts each subregion's fuel sums equal SRHTIAN and the U.S. sums USHTIAN against the xlsx; here the
        # register alone: for every fuel the 27 subregion sums add up to the U.S. sum exactly.
        fuels = {k.split('.')[2] for k in V3 if k.startswith('egrid2023_hi.')}
        for fuel in fuels:
            subs = sum((v(k) for k in V3 if k.startswith('egrid2023_hi.') and k.endswith('.' + fuel) and not k.startswith('egrid2023_hi.US.')), F(0))
            self.assertEqual(subs, v(f'egrid2023_hi.US.{fuel}'), fuel)
        self.assertEqual(len([k for k in V3 if k.startswith('egrid2023_gen.') and k != 'egrid2023_gen.US']), 27)

    def test_builder_reproduces_r3_from_the_staged_files(self):
        hub, pdf, egrid = staged('epa-factors-hub-2025.xlsx', HUB_SHA), staged('epa-factors-hub-2025.pdf', HUB_PDF_SHA), staged('egrid2023_data_rev2.xlsx', EGRID_SHA)
        if not (hub and pdf and egrid):
            # Round 2 (ENG-5, ACC-8): the CI job `register-primaries` downloads the official files and requires this test to run.
            if os.environ.get('NEUVETRA_METHOD_SOURCES_REQUIRED') == '1':
                self.fail('NEUVETRA_METHOD_SOURCES_REQUIRED=1 but the Hub 2025 xlsx/pdf or eGRID2023 rev2 xlsx is missing or altered')
            self.skipTest('NEUVETRA_METHOD_SOURCES_DIR does not hold the staged Hub 2025 xlsx/pdf and eGRID2023 rev2 xlsx')
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / 'r3.json'
            subprocess.run([sys.executable, '-I', str(BUILDER), str(hub), str(pdf), str(egrid), str(out)], check=True, capture_output=True)
            self.assertEqual(out.read_bytes(), R3_RAW)


class EnergyResold(unittest.TestCase):
    def test_subregion_and_us_vectors_from_cells(self):
        r = calc(resold())
        exp = grid_kg(F(Decimal('1200.5')), 'egrid2023.CAMX')
        self.assertEqual((r['methodVersionId'], r['category'], r['status'], r['gwpSetId']), (RESOLD, 3, 'complete', 'AR5-100'))
        self.assertEqual({g: r['gases'][g]['mass'] for g in GWP}, {g: text(exp[g]) for g in GWP})
        self.assertEqual(total(r), exp['co2e'])
        self.assertEqual(r['boundary'], {'minimumBoundary': 'partial', 'notes': ['location_based_grid_rates', 'upstream_of_resold_energy_excluded']})
        self.assertEqual((r['estimates'], r['additionalRegisters']), ([], []))
        us = calc(resold(quantity='250', unit='kWh', gridBasis='us_average', zip=None, subregion=None))
        exp = grid_kg(F(Decimal('0.25')), 'egrid2023_us')  # US23 U3:W3
        self.assertEqual((total(us), us['estimates']), (exp['co2e'], ['us_average_grid_rate']))
        self.assertEqual(us['additionalRegisters'], [{'name': 'supplement', 'sha256': e.SUPPLEMENT_REGISTER_SHA256}])
        self.assertEqual(sorted(f['cell'] for f in us['factorsUsed'] if f['key'].startswith('egrid2023_us.')), ['U3', 'V3', 'W3'])
        # 1,000 MWh at the U.S. rate (research TV11-E1 uses the same cells): CO2 348,000.1486... kg
        self.assertEqual(fixed(grid_kg(F(1000), 'egrid2023_us')['co2'], 4), fixed(F(1000) * F(Decimal('767.209')) * LB, 4))

    def test_zip_findings_as_td_losses(self):
        self.assertEqual(calc(resold(zip='00000'))['findings'], ['zip_not_in_lookup'])
        self.assertEqual(calc(resold(subregion='ERCT'))['findings'], ['subregion_not_listed_for_zip'])
        self.assertEqual(calc(resold(utilityEiaId='1'))['findings'], ['utility_not_listed_for_zip_and_subregion'])
        self.assertEqual(refusal(resold(subregion='XXXX')), 'unknown_subregion')
        self.assertEqual(refusal(resold(gridBasis='us_average')), 'invalid_input_shape')  # a U.S.-average record has no location
        self.assertEqual(refusal(resold(gridBasis='state')), 'invalid_grid_basis')
        self.assertEqual(refusal(resold(unit='therm')), 'unsupported_unit')

    def test_ghgp_table_3_2_utility_resale_arithmetic(self):
        # Calculation guidance Table 3.2 (p.40), utility C: 3D = purchased energy x life-cycle factor. Illustrative factor
        # through a patched US rate (lb/MWh with lb -> kg patched to 1): 94.5 t for 105 MWh at 900 kg/MWh (arithmetic only).
        with patched_registers(supplement=[('egrid2023_us.co2', '900'), ('egrid2023_us.ch4', '0'), ('egrid2023_us.n2o', '0')], main_constants=[('lb_to_kg', '1')]):
            r = calc(resold(quantity='105', gridBasis='us_average', zip=None, subregion=None))
        self.assertEqual(r['total']['display'], '94500.0000')


class Commuting(unittest.TestCase):
    def test_hand_computed_profile_from_cells(self):
        r = calc(commuting())
        days, head = 220, F(180)
        car_pm = head * F(60, 100) * 12 * 2 * days
        car_vm = r12(car_pm / F(Decimal('1.2')))
        bus_pm = head * F(30, 100) * 8 * 2 * days
        exp = {g: car_vm * v(f'travel.passenger_car.vehicle_mile.{g}') * (1 if g == 'co2' else F(1, 1000))
               + bus_pm * v(f'travel.bus.passenger_mile.{g}') * (1 if g == 'co2' else F(1, 1000)) for g in GWP}
        self.assertEqual({g: r['gases'][g]['mass'] for g in GWP}, {g: text(exp[g]) for g in GWP})
        self.assertEqual(total(r), sum(exp[g] * GWP[g] for g in GWP))
        self.assertEqual((r['methodVersionId'], r['category'], r['boundary']), (AVG, 7, {'minimumBoundary': 'met', 'notes': ['average_data_commuting_profile', 'non_motorized_known_zero', 'tank_to_wheel_only']}))
        self.assertEqual([m['mode'] for m in r['activity']['modes']], ['passenger_car', 'bus', 'non_motorized'])
        self.assertEqual(r['activity']['modes'][2]['amount'], '0')
        self.assertEqual([c['quantity'] for c in r['conversions']], ['mode 1 vehicle-miles = person-miles / occupancy'])

    def test_ghgp_example_7_2(self):
        # Calculation guidance example 7.2 (pp.92-93): 10,000 employees, 235 days; rail 50% 10 km x 0.1; car 30% 15 km x 0.2;
        # foot 15% 1 km x 0; bus 5% 5 km x 0.1 = 6,697,500 kg CO2e. Illustrative factors per unit distance through patched
        # Hub Table 10 rows, distances entered as miles so no conversion enters (arithmetic of formula 7.2 only).
        patch = [('travel.commuter_rail.passenger_mile.co2', '0.1'), ('travel.passenger_car.vehicle_mile.co2', '0.2'), ('travel.bus.passenger_mile.co2', '0.1')]
        patch += [(f'travel.{b}.{g}', '0') for b in ('commuter_rail.passenger_mile', 'passenger_car.vehicle_mile', 'bus.passenger_mile') for g in ('ch4', 'n2o')]
        with patched_registers(main=patch):
            r = calc(commuting(headcount='10000', workingDays=235, modes=[mode('commuter_rail', '50', '10'), mode('passenger_car', '30', '15', 'mile', '1'),
                                                                          mode('non_motorized', '15', '1'), mode('bus', '5', '5')]))
        self.assertEqual((r['total']['unrounded'], r['total']['display']), ('6697500', '6697500.0000'))

    def test_km_occupancy_and_holds(self):
        r = calc(commuting(modes=[mode('passenger_car', '100', '20', 'km', None)]))
        miles = r12(F(20) / F(Decimal('1.609344')))
        exp = F(180) * 1 * miles * 2 * 220 * v('travel.passenger_car.vehicle_mile.co2')
        self.assertEqual(F(Decimal(r['gases']['co2']['mass'])), exp)
        self.assertEqual(r['estimates'], ['commute_vehicle_occupancy_one'])
        held = calc(commuting(modes=[mode('bus', '60', '5'), mode('passenger_car', '30', '5')]))
        self.assertEqual((held['status'], held['findings'], held['total'], held['activity']), ('input_needed', ['mode_shares_must_total_100'], None, {'sharesTotalPercent': '90'}))
        self.assertEqual(refusal(commuting(modes=[mode('bus', '100', '5', 'mile', '2')])), 'occupancy_not_applicable')
        self.assertEqual(refusal(commuting(modes=[mode('air_long_haul', '100', '5')])), 'unsupported_mode')
        self.assertEqual(refusal(commuting(workingDays=367)), 'invalid_working_days')
        self.assertEqual(refusal(commuting(modes=[mode('passenger_car', '100', '5', 'mile', '0.5')])), 'invalid_occupancy')
        walk = calc(commuting(modes=[mode('non_motorized', '100', '1')]))
        self.assertEqual((walk['status'], walk['total']['unrounded'], sorted(walk['gases'])), ('complete', '0', ['ch4', 'co2', 'n2o']))  # a known zero


class Teleworking(unittest.TestCase):
    def test_electricity_and_gas_vectors(self):
        r = calc(telework())
        self.assertEqual(total(r), grid_kg(F(Decimal('3.2')), 'egrid2023.CAMX')['co2e'])
        self.assertEqual((r['methodVersionId'], r['category'], r['boundary']['notes']), (TELE, 7, ['incremental_above_baseline', 'location_based_grid_rates', 'optional_activity_included']))
        g = calc(gas_telework())
        self.assertEqual(total(g), gas_kg(F(Decimal('8.5')))['co2e'])  # 85 therm x 0.1 = 8.5 MMBtu
        self.assertEqual(g['total']['display'], '451.4732')  # 451.47325 rounded half-even
        self.assertEqual(g['additionalRegisters'], [{'name': 'supplement', 'sha256': e.SUPPLEMENT_REGISTER_SHA256}])
        scf = calc(gas_telework(quantity='8500', unit='scf'))
        self.assertEqual((total(scf), scf['estimates']), (gas_kg(F(8500) * v('hub2025_t1.natural_gas.heat_content'))['co2e'], ['default_heat_content']))
        self.assertEqual(refusal(gas_telework(unit='ccf')), 'unsupported_unit')
        self.assertEqual(refusal(gas_telework(zip='94105')), 'invalid_input_shape')


class AssetEnergy(unittest.TestCase):
    def test_vectors_from_cells(self):
        r = calc(asset())
        self.assertEqual(total(r), grid_kg(F(48), 'egrid2023.CAMX')['co2e'])
        self.assertEqual(r['boundary'], {'minimumBoundary': 'met', 'notes': ['asset_lifecycle_excluded', 'location_based_grid_rates']})
        alloc = {'reportingArea': '12000', 'buildingArea': '48000', 'occupancyPercent': '95', 'areaUnit': 'sqft'}
        g = calc(gas_asset(category=13, allocation=alloc))
        share = r12(F(12000) / (F(48000) * F(95, 100)))
        self.assertEqual(g['activity']['allocationShare'], text(share))
        self.assertEqual(total(g), gas_kg(F(520) * share)['co2e'])
        self.assertEqual(g['estimates'], ['area_allocated_not_submetered'])
        self.assertEqual(g['conversions'][0]['result'], text(share))
        mcf = calc(gas_asset(category=10, quantity='120', unit='mcf'))
        self.assertEqual(total(mcf), gas_kg(F(120000) * v('hub2025_t1.natural_gas.heat_content'))['co2e'])
        ref = calc(refrigerant(category=14))
        self.assertEqual(total(ref), F(Decimal('3.5')) * LB * v('hub2025_gwp.R-410A'))
        self.assertEqual((ref['gases'], ref['co2eWithoutGasSplit']['gwpSetId'], ref['boundary']['notes']), ({}, 'AR5-100', ['asset_lifecycle_excluded', 'blend_gwp_hfc_pfc_constituents_only']))
        warehouse = calc(refrigerant(category=4, refrigerantGas='HFC-134a', unit='kg', quantity='12'))
        self.assertEqual((total(warehouse), warehouse['boundary']['notes']), (12 * v('hub2025_gwp.HFC-134a'), ['asset_lifecycle_excluded', 'warehouse_site_specific']))

    def test_ghgp_example_8_1_is_1320(self):
        # Calculation guidance example 8.1 (pp.97-98): 200 of 2,000 m2, occupancy 75%; building natural gas 1,500 x 0.2,
        # electricity 3,000 kWh x 0.7, fugitive 5 kg x 1,500. Exact arithmetic gives 1,320 (the guidance prints 1,325 after
        # rounding the fugitive share to 0.67 kg; research/vectors/ghgp-calc-guidance-examples.json). Illustrative factors
        # through patched registers (gas quantity entered as MMBtu with 0.2 kg CO2 per MMBtu; electricity rate 700 per MWh
        # with lb -> kg patched to 1; a test gas with GWP 1,500).
        alloc = {'reportingArea': '200', 'buildingArea': '2000', 'occupancyPercent': '75', 'areaUnit': 'm2'}
        patch3 = [('hub2025_t1.natural_gas.co2', '0.2'), ('hub2025_t1.natural_gas.ch4', '0'), ('hub2025_t1.natural_gas.n2o', '0'), ('hub2025_gwp.HFC-134a', '1500')]
        patch1 = [('egrid2023.CAMX.co2', '700'), ('egrid2023.CAMX.ch4', '0'), ('egrid2023.CAMX.n2o', '0')]
        with patched_registers(main=patch1, supplement=patch3, main_constants=[('lb_to_kg', '1')]):
            lines = [calc(gas_asset(quantity='1500', unit='MMBtu', allocation=alloc, category=8)), calc(asset(quantity='3000', allocation=alloc)),
                     calc(refrigerant(quantity='5', unit='kg', refrigerantGas='HFC-134a', allocation=alloc))]
            agg = e.aggregate(lines)
        self.assertEqual([x['total']['display'] for x in lines], ['40.0000', '280.0000', '1000.0000'])
        self.assertEqual(agg['categorySubtotals']['8']['display'], '1320.0000')
        self.assertEqual(sum((total(x) for x in lines), F(0)), r12(F(200) / (F(2000) * F(3, 4))) * 9900)

    def test_ghgp_examples_4_5_and_10_1_energy_lines(self):
        # 4.5 (p.69), distribution site-specific: (10,000 kWh x 0.8 + 1,000 x 0.25) x 100/400 + (15,000 x 0.8 + 2,000 x 0.25) x
        # 200/800 = 5,187.5 (shares entered as reporting / building with occupancy 100%; arithmetic only).
        patch3 = [('hub2025_t1.natural_gas.co2', '0.25'), ('hub2025_t1.natural_gas.ch4', '0'), ('hub2025_t1.natural_gas.n2o', '0')]
        patch1 = [('egrid2023.CAMX.co2', '800'), ('egrid2023.CAMX.ch4', '0'), ('egrid2023.CAMX.n2o', '0')]
        a1 = {'reportingArea': '100', 'buildingArea': '400', 'occupancyPercent': '100', 'areaUnit': 'sqft'}
        a2 = {'reportingArea': '200', 'buildingArea': '800', 'occupancyPercent': '100', 'areaUnit': 'sqft'}
        with patched_registers(main=patch1, supplement=patch3, main_constants=[('lb_to_kg', '1')]):
            lines = [calc(asset(category=4, quantity='10000', allocation=a1)), calc(gas_asset(category=4, quantity='1000', unit='MMBtu', allocation=a1)),
                     calc(asset(category=4, quantity='15000', allocation=a2)), calc(gas_asset(category=4, quantity='2000', unit='MMBtu', allocation=a2))]
        self.assertEqual(sum((total(x) for x in lines), F(0)), F(51875, 10))
        # 10.1 (p.107), site-specific energy lines: 3,500 x 0.2 (gas) + 2,000 kWh x 0.5 = 1,700 (its 50 kg waste line is a waste record).
        with patched_registers(main=[('egrid2023.CAMX.co2', '500'), ('egrid2023.CAMX.ch4', '0'), ('egrid2023.CAMX.n2o', '0')],
                               supplement=[('hub2025_t1.natural_gas.co2', '0.2'), ('hub2025_t1.natural_gas.ch4', '0'), ('hub2025_t1.natural_gas.n2o', '0')],
                               main_constants=[('lb_to_kg', '1')]):
            lines = [calc(gas_asset(category=10, quantity='3500', unit='MMBtu')), calc(asset(category=10, quantity='2000'))]
        self.assertEqual([x['total']['display'] for x in lines], ['700.0000', '1000.0000'])

    def test_findings_and_refusals(self):
        alloc = lambda **o: dict({'reportingArea': '100', 'buildingArea': '400', 'occupancyPercent': '100', 'areaUnit': 'sqft'}, **o)
        over = calc(asset(allocation=alloc(reportingArea='500')))
        self.assertEqual((over['status'], over['findings'], over['total']), ('review_required', ['allocated_share_exceeds_one'], None))
        empty = calc(asset(allocation=alloc(occupancyPercent='0')))
        self.assertEqual((empty['status'], empty['findings'], empty['total']), ('input_needed', ['building_area_or_occupancy_zero'], None))
        self.assertEqual(calc(asset(zip='00000'))['findings'], ['zip_not_in_lookup'])
        self.assertEqual(refusal(asset(allocation=alloc(occupancyPercent='100.5'))), 'invalid_allocation')
        self.assertEqual(refusal(refrigerant(refrigerantGas='HCFC-22')), 'unknown_refrigerant')
        self.assertEqual(refusal(refrigerant(unit='therm')), 'unsupported_unit')
        self.assertEqual(refusal(asset(category=5)), 'invalid_category')
        self.assertEqual(refusal(gas_asset(unit='kWh')), 'unsupported_unit')
        self.assertEqual(refusal(asset(refrigerantGas='R-410A')), 'invalid_input_shape')


class PartnerReported(unittest.TestCase):
    def test_ghgp_examples_13_1_and_14_1(self):
        # 13.1 (p.129): lessee scope 1+2 9,000 kg x 5,000 / 15,000 m2 = 3,000 (the share is rounded once to 12 dp: 2999.999999997).
        r = calc(partner())
        self.assertEqual((r['total']['unrounded'], r['total']['display']), (text(F(9000) * r12(F(1, 3))), '3000.0000'))
        self.assertEqual((r['methodVersionId'], r['gwpSetId'], r['co2eWithoutGasSplit']['gwpSetId']), (PARTNER, 'AS-REPORTED', 'AS-REPORTED'))
        self.assertEqual(r['boundary'], {'minimumBoundary': 'met', 'notes': ['partner_gwp_basis_ar5', 'partner_scope2_location']})
        # 14.1 (p.133): five franchisees' scope 1 + 2, exclusive: 355,000 kg.
        lines = [calc(partner(category=14, quantity=q, allocationBasis='exclusive', allocationNumerator=None, allocationDenominator=None))
                 for q in ('120000', '35000', '40000', '120000', '40000')]
        self.assertEqual(e.aggregate(lines)['categorySubtotals']['14']['display'], '355000.0000')

    def test_tonnes_basis_and_findings(self):
        t = calc(partner(category=4, quantity='12.5', unit='metric_ton CO2e', allocationBasis='exclusive', allocationNumerator=None, allocationDenominator=None,
                         verification='unverified', gwpBasis='AR6', scope2Basis='market'))
        self.assertEqual((t['total']['unrounded'], t['boundary']['notes']), ('12500', ['partner_data_unverified', 'partner_gwp_basis_ar6', 'partner_scope2_market']))
        for category in e.PARTNER_CATEGORIES:
            self.assertEqual(calc(partner(category=category))['category'], category)
        late = calc(partner(periodMatches=False))
        self.assertEqual((late['status'], late['findings'], late['total']), ('review_required', ['partner_period_mismatch'], None))
        self.assertEqual((calc(partner(allocationNumerator='2', allocationDenominator='1'))['findings']), ['allocation_share_exceeds_one'])
        zero = calc(partner(allocationDenominator='0'))
        self.assertEqual((zero['status'], zero['findings']), ('input_needed', ['partner_share_denominator_zero']))
        self.assertEqual(refusal(partner(category=7)), 'invalid_category')
        self.assertEqual(refusal(partner(allocationBasis='exclusive')), 'invalid_allocation')
        self.assertEqual(refusal(partner(unit='kg')), 'unsupported_unit')
        self.assertEqual(refusal(partner(periodMatches='yes')), 'invalid_period_matches')


class SgecOracle(unittest.TestCase):
    """EPA Simplified GHG Emissions Calculator (LibreOffice-recalculated scratch copy, Hub 2025 and eGRID rev2 patched)."""

    def test_oracle_file_provenance(self):
        self.assertEqual((ORACLE['factor_set'], ORACLE['sha256'], ORACLE['sha256_matches_receipt']),
                         ('hub2025-patched', '47bd1b100597d0972049425c3686a6edf50f6b7518de2551749363fef34fe8f9', True))
        self.assertEqual((ORACLE['gwp'], len(ORACLE['cases'])), ({'CH4': 28.0, 'N2O': 265.0}, 9))
        self.assertTrue(all(c['match_1e-9_relative'] for c in ORACLE['cases']))  # LibreOffice = the workbook's own chain recomputed exactly

    def test_electricity_cases_equal_the_engine_exactly(self):
        names = {'WECC California': 'CAMX', 'RFC West': 'RFCW', 'NPCC NYC/Westchester': 'NYCW', 'ERCOT All': 'ERCT', 'US Average': None}
        zips = {'CAMX': '94105', 'RFCW': '43215', 'NYCW': '10001', 'ERCT': '75201'}
        cases = [c for c in ORACLE['cases'] if c['input']['sheet'] == 'electricity']
        self.assertEqual(len(cases), 5)
        for c in cases:
            sub, kwh = names[c['input']['subregion']], str(c['input']['qty'])
            if sub is None:
                r = calc(resold(quantity=kwh, unit='kWh', gridBasis='us_average', zip=None, subregion=None))
            else:
                held = e._grid_location(zips[sub], sub, None)
                r = calc(telework(quantity=kwh, zip=zips[sub], subregion=sub)) if held is None else None
                self.assertIsNotNone(r, f'{sub} ZIP {zips[sub]} {held}')
            for gas in GWP:
                ours_lb = F(Decimal(r['gases'][gas]['mass'])) / LB
                theirs = F(Decimal(repr(c['libreoffice'][f'lb_{gas}'])))
                self.assertLessEqual(abs(ours_lb - theirs), theirs * F(1, 10 ** 12), (c['id'], gas))
                self.assertEqual(ours_lb, F(Decimal(c['independent'][f'lb_{gas}'])), (c['id'], gas))

    def test_natural_gas_cases_match_within_the_hub_per_unit_rounding(self):
        # The calculator converts MMBtu and therms to scf with ROUND(1/0.001026, 6) and applies the Hub's rounded per-scf
        # columns (H38 0.05444 kg CO2, I38 0.00103 g CH4, J38 0.0001 g N2O); the engine applies the Hub's per-MMBtu factors
        # (E38:G38) to MMBtu, the documented primary basis (scf x 0.001026 heat content). The engine's figure times the exact
        # ratio of the two chains is the calculator's figure; the CO2e differs by less than 1e-4.
        per_scf = {'co2': F(Decimal('0.05444')), 'ch4': F(Decimal('0.00103')), 'n2o': F(Decimal('0.0001'))}
        scf_per_mmbtu = F(round(Decimal(1) / Decimal('0.001026'), 6))
        cases = [c for c in ORACLE['cases'] if c['input']['sheet'] == 'stationary']
        self.assertEqual(len(cases), 4)
        for c in cases:
            unit, q = c['input']['unit'], str(c['input']['qty'])
            r = calc(gas_telework(quantity=q, unit={'Therm': 'therm', 'MMBtu': 'MMBtu', 'scf': 'scf'}[unit]))
            mmbtu = F(Decimal(r['activity']['mmbtuHhv']))
            scf = F(Decimal(q)) if unit == 'scf' else F(Decimal(q)) * scf_per_mmbtu * (F(1, 10) if unit == 'Therm' else 1)
            ours_co2e, theirs_co2e = F(0), F(0)
            for gas, col in (('co2', 'kg_co2'), ('ch4', 'g_ch4'), ('n2o', 'g_n2o')):
                theirs = F(Decimal(repr(c['libreoffice'][col]))) / (1 if gas == 'co2' else 1000)
                ours = F(Decimal(r['gases'][gas]['mass']))
                per_mmbtu = v(f'hub2025_t1.natural_gas.{gas}') / (1 if gas == 'co2' else 1000)
                self.assertEqual(ours, mmbtu * per_mmbtu, (c['id'], gas))
                expected_theirs = scf * per_scf[gas] / (1 if gas == 'co2' else 1000)
                self.assertLessEqual(abs(theirs - expected_theirs), expected_theirs * F(1, 10 ** 9), (c['id'], gas))
                ours_co2e += ours * GWP[gas]
                theirs_co2e += theirs * GWP[gas]
            self.assertEqual(ours_co2e, total(r))
            self.assertLess(abs(ours_co2e - theirs_co2e) / theirs_co2e, F(1, 10 ** 4), c['id'])


class AggregateProfiles(unittest.TestCase):
    def test_partner_origin_is_fixed_and_unverified_default_applies(self):
        verified, unverified = calc(partner(category=8, quantity='1000')), calc(partner(category=8, quantity='3000', verification='unverified'))
        assets = calc(asset(category=8, quantity='4000'))
        notes = [{'dataQuality': None, 'activityDataOrigin': 'company_records'}, NONE, {'dataQuality': None, 'activityDataOrigin': 'estimate'}]
        p = e.aggregate([verified, unverified, assets], notes)['categoryProfiles']['8']
        # A19: partner figures are value-chain data whatever the annotation; asset energy is activity data and takes its annotation.
        self.assertEqual(F(Decimal(p['valueChain']['numerator']['unrounded'])), total(verified) + total(unverified))
        self.assertEqual(p['methodTypes']['partner_reported']['unrounded'], text(total(verified) + total(unverified)))
        # A20: the unverified partner figure is rated fair for reliability; the verified one very good; asset energy good.
        rel = p['dataQuality']['indicators']['reliability']['ratingKg']
        self.assertEqual({k: F(Decimal(x['unrounded'])) for k, x in rel.items()}, {'very_good': total(verified), 'fair': total(unverified), 'good': total(assets)})

    def test_new_profile_keys_hand_computed(self):
        # Two categories: 8 (asset energy + partner) and 1 (spend in 2024 dollars and in 2022 dollars).
        spend24 = calc({'kind': 'purchase_spend', 'input': {'period': P, 'category': 1, 'naicsCode': '541511', 'amount': '10000', 'currency': 'USD', 'dollarYear': 2024,
                                                             'marginChoice': 'with_margins', 'boughtAtFactoryGate': False, 'capitalFullCost': None}})
        spend22 = calc({'kind': 'purchase_spend', 'input': dict(spend24['input'], amount='5000', dollarYear=2022)})
        a, b = calc(asset(category=8, quantity='4000')), calc(partner(category=8, quantity='1000'))
        agg = e.aggregate([spend24, spend22, a, b])
        p1, p8 = agg['categoryProfiles']['1'], agg['categoryProfiles']['8']
        known = sum((total(x) for x in (spend24, spend22, a, b)), F(0))
        sub1, sub8 = total(spend24) + total(spend22), total(a) + total(b)
        # deflation effect: nominal (amount x factor) minus deflated, over spend results with a price ratio only (2022 dollars have none).
        nominal = F(10000) * F(Decimal(spend24['factorsUsed'][0]['value']))
        self.assertEqual(spend24['activity']['nominalCo2e'], text(nominal))
        self.assertEqual(p1['deflationEffect'], {'unrounded': text(nominal - total(spend24)), 'display': fixed(nominal - total(spend24), 4), 'unit': 'kg CO2e', 'rounding': 'half_even_4dp_once'})
        self.assertIsNone(p8['deflationEffect'])
        pct = lambda q: {'value': text(r12(q)), 'display': fixed(q, 1)}
        self.assertEqual(p1['shareOfKnownTotal'], pct(sub1 * 100 / known))
        self.assertEqual(p8['shareOfKnownTotal'], pct(sub8 * 100 / known))
        self.assertEqual(p1['largestResultShare'], pct(max(total(spend24), total(spend22)) * 100 / sub1))
        self.assertEqual(p8['largestResultShare'], pct(max(total(a), total(b)) * 100 / sub8))
        # A known zero: a category whose subtotal is 0 has no largest share; with the known-source total 0 no share at all.
        walk = calc(commuting(modes=[mode('non_motorized', '100', '1')]))
        z = e.aggregate([walk])['categoryProfiles']['7']
        self.assertEqual((z['deflationEffect'], z['shareOfKnownTotal'], z['largestResultShare']), (None, None, None))
        mixed = e.aggregate([walk, b])['categoryProfiles']
        self.assertEqual((mixed['7']['shareOfKnownTotal'], mixed['7']['largestResultShare']), ({'value': '0', 'display': '0.0'}, None))


class MetadataCatalogAndContext(unittest.TestCase):
    def test_metadata(self):
        meta = e.describe()['methodMetadata']
        dq = lambda *r: dict(zip(e.DQ_INDICATORS, r))
        expected = {
            RESOLD: ('activity_average_data', 'company_records', dq('good', 'very_good', 'good', 'good', 'good'), None, 'none_expected', ['supplement']),
            AVG: ('activity_average_data', 'company_records', dq('poor', 'good', 'fair', 'fair', 'poor'), None, 'none_expected', []),
            TELE: ('activity_average_data', 'estimate', dq('good', 'very_good', 'good', 'good', 'good'), None, 'none_expected', ['supplement']),
            ASSET: ('activity_average_data', 'value_chain_partner', dq('good', 'very_good', 'good', 'good', 'good'), None, 'none_expected', ['supplement']),
            PARTNER: ('partner_reported', 'value_chain_partner', dq('very_good', 'good', 'very_good', 'good', 'very_good'), dq('very_good', 'good', 'very_good', 'good', 'fair'), 'as_reported', []),
        }
        for mid, (mt, origin, default, unverified, biogenic, registers) in expected.items():
            m = meta[mid]
            self.assertEqual((m['methodType'], m['activityDataOrigin'], m['defaultDataQuality']['indicators'], m.get('defaultDataQualityUnverified', {}).get('indicators'),
                              m['biogenicTreatment'], m['additionalRegisters']), (mt, origin, default, unverified, biogenic, registers), mid)
        methods = {m['id']: m for m in e.describe()['methods']}
        self.assertEqual(methods[ASSET]['constantValues']['supplement_const.therm_to_mmbtu'], {'value': '0.1', 'unit': 'MMBtu per therm'})
        self.assertEqual(methods[RESOLD]['factorCells']['egrid2023_us.co2'], 'U3')

    def test_catalog_token_lists(self):
        c = e.catalog()
        self.assertEqual(c['commutingAverageModes'], list(e.COMMUTING_MODES) + ['non_motorized'])
        self.assertEqual(len(c['soldFuels']), 58)
        self.assertEqual(len(c['ghgGases']), 62)
        self.assertIn('natural_gas', c['soldFuels'])
        self.assertIn('R-410A', c['ghgGases'])
        self.assertEqual(c['partnerCategories'], [4, 5, 8, 9, 10, 12, 13, 14])
        self.assertEqual(c['assetCategories'], [4, 8, 9, 10, 13, 14])

    def test_context_independence_and_batch_equivalence(self):
        rng = random.Random(505)
        reqs = []
        for _ in range(60):
            reqs.append(resold(quantity=str(rng.randint(1, 10 ** 6)), unit=rng.choice(['kWh', 'MWh'])))
            reqs.append(commuting(headcount=str(rng.randint(1, 5000)), workingDays=rng.randint(1, 366)))
            reqs.append(gas_asset(quantity=f'{rng.randint(1, 99999)}.{rng.randint(0, 999)}', unit=rng.choice(['therm', 'MMBtu', 'scf', 'ccf', 'mcf'])))
            reqs.append(partner(quantity=str(rng.randint(1, 10 ** 7)), allocationNumerator=str(rng.randint(1, 100)), allocationDenominator=str(rng.randint(100, 1000))))
        many = e.calculate_many(reqs)
        for req, item in zip(reqs, many):
            self.assertEqual(item, {'status': 'ok', 'result': calc(req)})
            with localcontext() as ctx:
                ctx.prec = 6
                self.assertEqual(calc(req), item['result'])
        e.aggregate([x['result'] for x in many])  # recomputation accepts every result


if __name__ == '__main__':
    unittest.main()
