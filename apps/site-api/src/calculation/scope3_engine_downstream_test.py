"""Scope 3 completion I-07: use of sold products (11: fuels sold, energy-using products, products containing greenhouse gases),
end of life of sold products by treatment split (12) and investments (15: investee- or project-reported, revenue x EEIO), with
biogenic CO2 and memo items outside every total (DESIGN 4.4, 4.6, 8.1).

Expected values never come from the engine:
- register vectors are exact `Fraction` arithmetic on the cells they cite (Hub 2025 Table 1 rows 38/55/66/80/35/33, Tables 11/12
  E532/D575, Table 9 row 449; eGRID2023 rev2 US23 U3:W3 and SRL23 CAMX; EPA SC v1.3 rows 755/798; the FRED transcription);
- the research test vectors (research/methods-downstream.md 9: TV11-F1 8807.8750, F2 54495.4770, F3 10240.0140, E1 1049057.0935,
  R1 1,154,400 with an explicit 100% use-phase release, TV15-E1 615000.0000) are asserted as printed there;
- the GHG Protocol worked examples (calculation guidance 11.1, 12.1, 15.1, 15.2 = 2,332,500 (never the printed 2,242,500),
  15.3, 15.5; research/vectors/ghgp-calc-guidance-examples.json) use their own illustrative factors through test-only patched
  registers, never register factors.
Run: python -m unittest scope3_engine_downstream_test
"""
import contextlib
import hashlib
import json
import random
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
R1 = json.loads((REF / 'verified-scope3-register-2025.json').read_text('utf-8'))
R2_RAW = (REF / 'verified-scope3-spend-register-epa-scghg-v1.3.json').read_bytes()
R2 = json.loads(R2_RAW.decode('utf-8'))
R3 = json.loads((REF / 'verified-scope3-supplement-register-2025.json').read_text('utf-8'))
CELLS = {x['id']: x for reg in (R1, R2, R3) for x in reg['entries']}
CONSTS = {x['id']: x for reg in (R1, R2, R3) for x in reg['constants']}
# The GHG Protocol worked examples, copied from research/vectors/ghgp-calc-guidance-examples.json (the corrected transcription of the
# staged calculation guidance PDF; line values and the published or corrected totals, kg or t as the guidance states them).
EXAMPLES = {
    '11.1': {'lines': ['7475000', '1567500', '4000000'], 'total': '13042500'},                   # p.117-118, kg, as published
    '12.1': {'lines': ['2700', '1000', '0'], 'total': '3700'},                                   # p.127, kg (narrative "tonnes" is an erratum)
    '15.1': {'lines': ['48000', '30000', '400000', '15000'], 'total': '493000'},                 # p.142-143, t, as published
    '15.2': {'lines': ['90000', '562500', '690000', '660000', '330000'], 'total': '2332500', 'printed': '2242500'},  # p.145, kg; printed total wrong
    '15.3': {'total_exact_t': '26833.3333', 'printed': '26833'},                                 # p.148, t; printed from a rounded 11.11%
    '15.5': {'30': '31500000', '60': '63000000'},                                                # p.152, t, reported separately
}
FUEL, PRODUCT, GHG, EOL = ('scope3.cat11.sold_fuel.hub2025.v1', 'scope3.cat11.sold_energy_product.v1', 'scope3.cat11.sold_ghg_product.hub2025.v1', 'scope3.cat12.end_of_life_split.v1')
REPORTED, EEIO = 'scope3.cat15.investment_reported.v1', 'scope3.cat15.investment_revenue_eeio.epa_scghg_v1_3.v1'
GWP = {'co2': F(1), 'ch4': F(28), 'n2o': F(265)}
LB = F(Decimal('0.45359237'))
NONE = {'dataQuality': None, 'activityDataOrigin': None}


def v(key: str) -> F:
    return F(Decimal(CELLS[key]['value']))


def c(key: str) -> F:
    return F(Decimal(CONSTS[key]['value']))


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


def total(r) -> F:
    return F(Decimal(r['total']['unrounded']))


def calc(req) -> dict:
    return e.calculate(req)


def refusal(req) -> str:
    try:
        e.calculate(req)
    except e.Refused as x:
        return x.code
    raise AssertionError('not refused')


def fuel(**over):
    inp = {'period': P, 'fuel': 'motor_gasoline', 'quantity': '1000', 'unit': 'US_gallon', 'combustedInUse': 'yes'}
    inp.update(over)
    return {'kind': 'sold_fuel', 'input': inp}


def product(**over):
    inp = {'period': P, 'quantity': '1000', 'lifetimeBasis': 'years', 'lifetimeQuantity': '10', 'energyPerBasis': '300', 'energyCarrier': 'electricity',
           'energyUnit': 'kWh', 'useRegion': 'US'}
    inp.update(over)
    return {'kind': 'sold_energy_product', 'input': inp}


def ghg(**over):
    inp = {'period': P, 'quantity': '500', 'gas': 'R-410A', 'chargePerUnit': '1.2', 'chargeUnit': 'kg', 'useReleasePercent': '100'}
    inp.update(over)
    return {'kind': 'sold_ghg_product', 'input': inp}


SPLIT = {'recycled': '75', 'landfilled': '20', 'combusted': '5', 'composted': '0', 'anaerobic_digestion_dry': '0', 'anaerobic_digestion_wet': '0'}


def eol(**over):
    inp = {'period': P, 'material': 'corrugated_containers', 'basis': 'packaging', 'split': dict(SPLIT), 'quantity': '85.5', 'unit': 'short_ton'}
    inp.update(over)
    return {'kind': 'end_of_life_split', 'input': inp}


def reported(**over):
    inp = {'period': P, 'path': 'investee_reported', 'holdingType': 'equity_unlisted', 'outstandingAmount': '2500000', 'attribution': {'basis': 'equity_share_percent', 'percent': '12.5'},
           'investeeEmissions': '4930', 'emissionsVerified': True, 'gwpBasis': 'AR5', 'revenue': None, 'revenueYear': None, 'naicsCode': None,
           'projectedAnnual': None, 'lifetimeYears': None}
    inp.update(over)
    return {'kind': 'investment', 'input': inp}


def revenue(**over):
    inp = {'period': P, 'path': 'revenue_eeio', 'holdingType': 'equity_unlisted', 'outstandingAmount': '1000000', 'attribution': {'basis': 'equity_share_percent', 'percent': '25'},
           'investeeEmissions': None, 'emissionsVerified': None, 'gwpBasis': None, 'revenue': '10000000', 'revenueYear': 2022, 'naicsCode': '531120',
           'projectedAnnual': None, 'lifetimeYears': None}
    inp.update(over)
    return {'kind': 'investment', 'input': inp}


def combustion(mmbtu: F, fuel_token: str) -> dict:
    """Hub 2025 Table 1: kg CO2 per MMBtu; g CH4 and g N2O per MMBtu (x 0.001); AR5 GWPs."""
    out = {'co2': mmbtu * v(f'hub2025_t1.{fuel_token}.co2'), 'ch4': mmbtu * v(f'hub2025_t1.{fuel_token}.ch4') / 1000, 'n2o': mmbtu * v(f'hub2025_t1.{fuel_token}.n2o') / 1000}
    return dict(out, co2e=sum(out[g] * GWP[g] for g in GWP))


def grid(mwh: F, prefix: str) -> dict:
    out = {g: mwh * v(f'{prefix}.{g}') * LB for g in GWP}
    return dict(out, co2e=sum(out[g] * GWP[g] for g in GWP))


@contextlib.contextmanager
def patched(main=(), supplement=(), spend=(), main_constants=()):
    """Test-only registers with replaced or added values (the GHG Protocol's illustrative factors never enter a real register).
    `spend` adds `epa_scghg_v130.<code>.without_margins` entries."""
    saved = {name: dict(spec) for name, spec in e.REGISTERS.items()}
    cached = {name: e._LOADED_REGISTERS.pop(name, None) for name in ('supplement', 'spend')}
    saved_main = e.REGISTER
    main_reg = {'entries': dict(e.REGISTER['entries']), 'constants': dict(e.REGISTER['constants'])}
    for key, value in main:
        main_reg['entries'][key] = dict(main_reg['entries'][key], value=value)
    for key, value in main_constants:
        main_reg['constants'][key] = dict(main_reg['constants'][key], value=value)
    with tempfile.TemporaryDirectory() as tmp:
        for name, raw_path, changes in (('supplement', REF / 'verified-scope3-supplement-register-2025.json', supplement), ('spend', REF / 'verified-scope3-spend-register-epa-scghg-v1.3.json', spend)):
            reg = json.loads(raw_path.read_text('utf-8'))
            ent = {x['id']: x for x in reg['entries']}
            for key, value in changes:
                key = key if name == 'supplement' else f'epa_scghg_v130.{key}.without_margins'
                ent[key] = dict(ent.get(key, {'id': key, 'table': 'test only', 'sheet': 'test only', 'valueCell': 'test only', 'unit': 'test only', 'labelCells': [], 'label': key}), value=value)
            reg['entries'] = sorted(ent.values(), key=lambda x: x['id'])
            raw = json.dumps(reg).encode('utf-8')
            path = Path(tmp) / f'{name}.json'
            path.write_bytes(raw)
            e.REGISTERS[name] = {'path': path, 'sha256': hashlib.sha256(raw).hexdigest()}
        e.REGISTER = main_reg
        try:
            yield
        finally:
            for name, spec in saved.items():
                e.REGISTERS[name] = spec
            e.REGISTER = saved_main
            for name, value in cached.items():
                e._LOADED_REGISTERS.pop(name, None)
                if value is not None:
                    e._LOADED_REGISTERS[name] = value


class SoldFuel(unittest.TestCase):
    def test_tv11_f1_f2_f3_from_table_1_cells(self):
        # TV11-F1: 1,000 gal motor gasoline, Hub D66:G66 = 0.125 MMBtu/gal, 70.22 kg, 3 g, 0.6 g per MMBtu.
        r = calc(fuel())
        exp = combustion(F(1000) * v('hub2025_t1.motor_gasoline.heat_content'), 'motor_gasoline')
        self.assertEqual((r['methodVersionId'], r['category'], r['status'], r['gwpSetId']), (FUEL, 11, 'complete', 'AR5-100'))
        self.assertEqual({g: r['gases'][g]['mass'] for g in GWP}, {g: text(exp[g]) for g in GWP})
        self.assertEqual((total(r), r['total']['display']), (exp['co2e'], '8807.8750'))
        self.assertEqual(r['boundary'], {'minimumBoundary': 'met', 'notes': ['combustion_only', 'stationary_ch4_n2o_proxy_for_transport_fuels']})
        self.assertEqual((r['estimates'], r['activity']['mmbtuHhv'], r.get('biogenicCo2')), (['fuel_default_heat_content'], '125', None))
        self.assertEqual(sorted(f['cell'] for f in r['factorsUsed'] if f['key'].startswith('hub2025_t1.')), ['D66', 'E66', 'F66', 'G66'])
        self.assertEqual(r['additionalRegisters'], [{'name': 'supplement', 'sha256': e.SUPPLEMENT_REGISTER_SHA256}])
        # TV11-F2: 1,000,000 scf natural gas (D38:G38); TV11-F3: 1,000 gal distillate No. 2 (D55:G55).
        ng = calc(fuel(fuel='natural_gas', quantity='1000000', unit='scf'))
        self.assertEqual((total(ng), ng['total']['display']), (combustion(F(1000000) * v('hub2025_t1.natural_gas.heat_content'), 'natural_gas')['co2e'], '54495.4770'))
        d2 = calc(fuel(fuel='distillate_fuel_oil_no_2'))
        self.assertEqual((total(d2), d2['total']['display']), (combustion(F(1000) * v('hub2025_t1.distillate_fuel_oil_no_2.heat_content'), 'distillate_fuel_oil_no_2')['co2e'], '10240.0140'))
        # MMBtu as stated: no heat content, no estimate.
        mm = calc(fuel(fuel='propane', quantity='4500.25', unit='MMBtu'))
        self.assertEqual((total(mm), mm['estimates']), (combustion(F(Decimal('4500.25')), 'propane')['co2e'], []))
        # Round 2 (ACC-17, r4.1 C4-170): propane is LPG's main component (Hub Table 2 lists LPG), so it carries the proxy note.
        self.assertEqual(mm['boundary']['notes'], ['combustion_only', 'stationary_ch4_n2o_proxy_for_transport_fuels'])

    def test_biomass_co2_is_biogenic_outside_the_total_and_its_ch4_n2o_inside(self):
        # Biodiesel (100%), Hub row 80 "Biomass Fuels - Liquid": 0.128 MMBtu/gal, 73.84 kg CO2, 1.1 g CH4, 0.11 g N2O per MMBtu.
        r = calc(fuel(fuel='biodiesel_100'))
        mmbtu = F(1000) * v('hub2025_t1.biodiesel_100.heat_content')
        exp = combustion(mmbtu, 'biodiesel_100')
        self.assertEqual(r['biogenicCo2'], {'mass': text(exp['co2']), 'massUnit': 'kg CO2',
                                             'basis': 'Biogenic CO2 of biodiesel_100 (EPA Hub 2025 Table 1, Biomass Fuels - Liquid), reported separately and never in a total'})
        self.assertEqual(sorted(r['gases']), ['ch4', 'n2o'])
        self.assertEqual(total(r), exp['ch4'] * 28 + exp['n2o'] * 265)  # N-7: biomass CH4 and N2O are in the total
        self.assertNotEqual(total(r), exp['co2e'])
        self.assertEqual(r['boundary']['notes'], ['biogenic_co2_reported_separately', 'combustion_only', 'stationary_ch4_n2o_proxy_for_transport_fuels'])
        self.assertIn('hub2025_t1.biodiesel_100.co2', [f['key'] for f in r['factorsUsed']])  # the CO2 factor is traced, though outside the total
        # Wood (short tons, row 35) and peat (row 33, which the Hub lists among biomass fuels: disclosed).
        wood = calc(fuel(fuel='wood_and_wood_residuals', quantity='12', unit='short_ton'))
        w = combustion(F(12) * v('hub2025_t1.wood_and_wood_residuals.heat_content'), 'wood_and_wood_residuals')
        self.assertEqual((wood['biogenicCo2']['mass'], total(wood)), (text(w['co2']), w['ch4'] * 28 + w['n2o'] * 265))
        peat = calc(fuel(fuel='peat', quantity='1', unit='MMBtu'))
        self.assertIn('peat_classified_biomass_by_hub', peat['boundary']['notes'])
        # A fossil fuel has no biogenic CO2; municipal solid waste is "Other Fuels - Solid" in the Hub, so its CO2 counts.
        self.assertNotIn('biogenicCo2', calc(fuel(fuel='municipal_solid_waste', quantity='1', unit='short_ton')))

    def test_feedstock_not_combusted_is_a_known_zero(self):
        r = calc(fuel(fuel='propane', combustedInUse='no_feedstock', quantity='5000'))
        self.assertEqual((r['status'], r['total']['unrounded'], r['total']['display'], r['gases'], r['factorsUsed']), ('complete', '0', '0.0000', {}, []))
        self.assertEqual((r['co2eWithoutGasSplit']['co2e'], r['boundary']['notes']), ('0', ['feedstock_not_combusted']))

    def test_refusals(self):
        self.assertEqual(refusal(fuel(fuel='unobtainium')), 'unknown_fuel')
        self.assertEqual(refusal(fuel(unit='scf')), 'unsupported_unit')  # motor gasoline is in gallons in Table 1
        self.assertEqual(refusal(fuel(unit='gallon')), 'unsupported_unit')
        self.assertEqual(refusal(fuel(combustedInUse='no')), 'invalid_combusted_in_use')
        self.assertEqual(refusal(fuel(quantity='-1')), 'invalid_quantity')
        self.assertEqual(refusal({'kind': 'sold_fuel', 'input': {'period': P, 'fuel': 'propane', 'quantity': '1', 'unit': 'MMBtu'}}), 'invalid_input_shape')


class EnergyProducts(unittest.TestCase):
    def test_tv11_e1_us23_and_a_subregion(self):
        # TV11-E1: 1,000 units x 10 years x 300 kWh = 3,000 MWh at US23 U3:W3.
        r = calc(product())
        exp = grid(F(3000), 'egrid2023_us')
        self.assertEqual({g: r['gases'][g]['mass'] for g in GWP}, {g: text(exp[g]) for g in GWP})
        self.assertEqual((total(r), r['total']['display']), (exp['co2e'], '1049057.0935'))
        self.assertEqual((r['methodVersionId'], r['activity']['lifetimeEnergy'], r['activity']['mwh'], r['estimates']), (PRODUCT, '3000000', '3000', []))
        self.assertEqual(r['boundary'], {'minimumBoundary': 'met', 'notes': ['direct_use_phase_only', 'indirect_use_phase_excluded', 'reporting_year_grid_factor']})
        self.assertEqual(sorted(f['cell'] for f in r['factorsUsed'] if f['key'].startswith('egrid2023_us.')), ['U3', 'V3', 'W3'])
        cam = calc(product(useRegion='CAMX', energyUnit='MWh', energyPerBasis='0.3', lifetimeBasis='uses', lifetimeQuantity='2000'))
        self.assertEqual(total(cam), grid(F(1000) * 2000 * F(3, 10), 'egrid2023.CAMX')['co2e'])

    def test_fuel_using_products_and_their_biogenic_co2(self):
        gas = calc(product(energyCarrier='natural_gas', energyUnit='scf', energyPerBasis='35.5', lifetimeBasis='uses', lifetimeQuantity='3650', useRegion='CAMX'))
        mmbtu = F(1000) * 3650 * F(Decimal('35.5')) * v('hub2025_t1.natural_gas.heat_content')
        self.assertEqual((total(gas), gas['estimates']), (combustion(mmbtu, 'natural_gas')['co2e'], ['fuel_default_heat_content']))
        # Round 2 (ACC-17): Table 1 natural gas is pipeline gas, not a transport fuel, so the proxy note is not given.
        self.assertNotIn('stationary_ch4_n2o_proxy_for_transport_fuels', gas['boundary']['notes'])
        wood = calc(product(energyCarrier='wood_and_wood_residuals', energyUnit='MMBtu', energyPerBasis='2', useRegion='non_US'))  # a fuel's factor is a property of the fuel
        w = combustion(F(1000) * 10 * 2, 'wood_and_wood_residuals')
        self.assertEqual((wood['status'], wood['biogenicCo2']['mass'], total(wood)), ('complete', text(w['co2']), w['ch4'] * 28 + w['n2o'] * 265))

    def test_non_us_electricity_is_held_and_plausibility_flags(self):
        held = calc(product(useRegion='non_US'))
        self.assertEqual((held['status'], held['findings'], held['total']), ('input_needed', ['use_region_outside_us'], None))
        long_life = calc(product(lifetimeQuantity='31', energyPerBasis='50000.001'))
        self.assertEqual(long_life['estimates'], ['annual_kwh_over_50000_check', 'lifetime_over_30_years_check'])
        self.assertEqual(calc(product(lifetimeQuantity='30', energyPerBasis='50'))['estimates'], [])
        self.assertEqual(calc(product(energyUnit='MWh', energyPerBasis='50.001'))['estimates'], ['annual_kwh_over_50000_check'])
        self.assertEqual(calc(product(lifetimeBasis='uses', lifetimeQuantity='500', energyPerBasis='60000'))['estimates'], [])  # per use, not per year

    def test_ghgp_11_1_through_a_patched_us_rate(self):
        # Calculation guidance example 11.1 (pp.117-118): X100 1,000 uses x 11,500 sold x 1.3 kWh, X200 1,100 x 1,900 x 1.5, Y123 2,000 x
        # 20,000 x 0.2, at an illustrative 0.5 kg CO2e/kWh (500 kg per MWh; lb -> kg patched to 1): 13,042,500 kg (as published).
        ex = EXAMPLES['11.1']
        with patched(supplement=[('egrid2023_us.co2', '500'), ('egrid2023_us.ch4', '0'), ('egrid2023_us.n2o', '0')], main_constants=[('lb_to_kg', '1')]):
            rs = [calc(product(quantity=sold, lifetimeBasis='uses', lifetimeQuantity=uses, energyPerBasis=kwh)) for uses, sold, kwh in
                  (('1000', '11500', '1.3'), ('1100', '1900', '1.5'), ('2000', '20000', '0.2'))]
            agg = e.aggregate(rs)
        self.assertEqual([total(r) for r in rs], [F(int(x)) for x in ex['lines']])
        self.assertEqual(F(Decimal(agg['categorySubtotals']['11']['unrounded'])), F(int(ex['total'])))

    def test_refusals(self):
        self.assertEqual(refusal(product(energyCarrier='steam')), 'unknown_energy_carrier')
        self.assertEqual(refusal(product(energyUnit='therm')), 'unsupported_unit')
        self.assertEqual(refusal(product(energyCarrier='propane', energyUnit='scf')), 'unsupported_unit')
        self.assertEqual(refusal(product(useRegion='EU')), 'unknown_use_region')
        self.assertEqual(refusal(product(lifetimeBasis='months')), 'invalid_lifetime_basis')
        self.assertEqual(refusal(product(lifetimeQuantity='1e3')), 'invalid_lifetime')


class GhgProducts(unittest.TestCase):
    def test_tv11_r1_and_explicit_release_shares(self):
        # TV11-R1: 500 units x 1.2 kg R-410A x 100% (stated, never defaulted) x 1,924 (Hub Table 12 D575) = 1,154,400 kg.
        r = calc(ghg())
        self.assertEqual((total(r), r['total']['display']), (F(500) * F(Decimal('1.2')) * v('hub2025_gwp.R-410A'), '1154400.0000'))
        self.assertEqual((r['methodVersionId'], r['gwpSetId'], r['gases'], r['co2eWithoutGasSplit']['gwpSetId']), (GHG, 'AR5-100', {}, 'AR5-100'))
        self.assertEqual(r['boundary']['notes'], ['blend_gwp_hfc_pfc_constituents_only', 'end_of_life_remaining_charge_memo_upper_bound', 'use_phase_release_only'])  # round 3: + EOL memo
        self.assertEqual([f['cell'] for f in r['factorsUsed']], ['D575'])
        # The fixture's split AC unit: 1,200 x 2.75 kg x 4% x 1,924; pounds; HFC-134a (Table 11 E532, no blend note); 0% is a known zero.
        self.assertEqual(total(calc(ghg(quantity='1200', chargePerUnit='2.75', useReleasePercent='4'))), F(1200) * F(Decimal('2.75')) * F(4, 100) * 1924)
        lb = calc(ghg(chargeUnit='lb', chargePerUnit='3.5', gas='HFC-134a', useReleasePercent='2.5'))
        self.assertEqual((total(lb), lb['boundary']['notes']), (F(500) * F(Decimal('3.5')) * LB * F(25, 1000) * v('hub2025_gwp.HFC-134a'), ['end_of_life_remaining_charge_memo_upper_bound', 'use_phase_release_only']))
        zero = calc(ghg(useReleasePercent='0'))
        self.assertEqual((zero['status'], zero['total']['unrounded']), ('complete', '0'))

    def test_refusals(self):
        self.assertEqual(refusal(ghg(gas='R-22')), 'unknown_gas')  # an HCFC: not in Hub Tables 11 or 12
        self.assertEqual(refusal(ghg(useReleasePercent='100.001')), 'invalid_release_percent')
        self.assertEqual(refusal(ghg(useReleasePercent=None)), 'invalid_release_percent')  # no default
        self.assertEqual(refusal(ghg(chargeUnit='g')), 'unsupported_unit')


class EndOfLife(unittest.TestCase):
    def test_split_from_table_9_cells(self):
        # 85.5 short tons of corrugated containers: 75% recycled (D449 0.11), 20% landfilled (E449 1), 5% combusted (F449 0.05).
        r = calc(eol())
        tons = F(Decimal('85.5'))
        parts = {t: tons * F(s) / 100 * v(f'waste.corrugated_containers.{t}') * 1000 for t, s in (('recycled', 75), ('landfilled', 20), ('combusted', 5))}
        self.assertEqual((r['methodVersionId'], r['category'], r['gwpSetId'], r['co2eWithoutGasSplit']['gwpSetId']), (EOL, 12, 'AR4-100', 'AR4-100'))
        self.assertEqual(total(r), sum(parts.values()))
        self.assertEqual([(x['treatment'], x['co2e']) for x in r['activity']['treatments']], [(t, text(parts[t])) for t in ('recycled', 'landfilled', 'combusted')])
        self.assertEqual(sorted(f['cell'] for f in r['factorsUsed']), ['D449', 'E449', 'F449'])
        self.assertEqual(r['boundary']['notes'], ['ar4_gwp_embedded_in_factor', 'avoided_emissions_excluded', 'includes_transport_to_facility', 'sold_product_end_of_life_assumed_split'])
        # Metric tons and pounds: the waste conversion, rounded once to 12 dp and listed; the shares are exact.
        t = calc(eol(material='mixed_plastics', basis='sold_products', quantity='12', unit='metric_ton', split=dict(SPLIT, recycled='30', landfilled='60', combusted='10')))
        st = r12(F(12) * 1000 / (LB * 2000))
        self.assertEqual(total(t), sum(st * F(s, 100) * v(f'waste.mixed_plastics.{k}') * 1000 for k, s in (('recycled', 30), ('landfilled', 60), ('combusted', 10))))
        self.assertEqual([x['quantity'] for x in t['conversions']], ['short tons = metric tons x 1000 / (0.45359237 x 2000)'])

    def test_unknown_split_wrong_total_and_na_treatment_are_held(self):
        self.assertEqual((calc(eol(split=None))['status'], calc(eol(split=None))['findings']), ('input_needed', ['treatment_split_unknown']))
        bad = calc(eol(split=dict(SPLIT, recycled='74.999')))
        self.assertEqual((bad['status'], bad['findings'], bad['activity']['sharesTotalPercent']), ('input_needed', ['treatment_split_must_total_100'], '99.999'))
        na = calc(eol(split=dict(SPLIT, recycled='65', composted='10')))  # corrugated containers: composting is NA in Table 9
        self.assertEqual((na['status'], na['findings'], na['activity']['treatmentsWithoutFactor']), ('input_needed', ['no_published_factor_for_material_and_treatment'], ['composted']))
        self.assertEqual(refusal(eol(material='unobtainium')), 'unknown_material')
        self.assertEqual(refusal(eol(split=dict(SPLIT, recycled='75%'))), 'invalid_split')
        self.assertEqual(refusal(eol(split=dict(SPLIT, recycled='101'))), 'invalid_split')

    def test_ghgp_12_1_through_patched_factors(self):
        # Calculation guidance example 12.1 (p.127): 10,000 kg sold, 90% landfilled x 0.3 kg CO2e/kg, 10% incinerated x 1.0, 0% recycled: 3,700 kg
        # (the narrative's "tonnes" is the documented erratum). Illustrative per-kg factors, entered as metric tons per short ton (x 1000).
        with patched(main=[('waste.mixed_msw.landfilled', '0.0003'), ('waste.mixed_msw.combusted', '0.001')]):
            r = calc(eol(material='mixed_msw', quantity='10000', unit='short_ton', split=dict(SPLIT, recycled='0', landfilled='90', combusted='10')))
        self.assertEqual(r['total']['unrounded'], EXAMPLES['12.1']['total'])
        self.assertEqual([x['co2e'] for x in r['activity']['treatments']], EXAMPLES['12.1']['lines'][:2])  # the 0% recycled line is not calculated


class Investments(unittest.TestCase):
    def test_ghgp_15_1_investment_specific(self):
        # Calculation guidance example 15.1 (pp.142-143): reported scope 1 and 2 in t CO2e x equity share = 493,000 t.
        rs = [calc(reported(investeeEmissions=emissions, attribution={'basis': 'equity_share_percent', 'percent': pct})) for emissions, pct in
              (('120000', '40'), ('200000', '15'), ('1600000', '25'), ('60000', '25'))]
        self.assertEqual([total(r) for r in rs], [F(int(x)) * 1000 for x in EXAMPLES['15.1']['lines']])
        agg = e.aggregate(rs)
        self.assertEqual(F(Decimal(agg['categorySubtotals']['15']['unrounded'])), F(int(EXAMPLES['15.1']['total'])) * 1000)
        r = rs[0]
        self.assertEqual((r['methodVersionId'], r['gwpSetId'], r['activity']['pcafScore'], r['activity']['attributionShare']), (REPORTED, 'AS-REPORTED', 1, '0.4'))
        self.assertEqual(r['boundary']['notes'], ['investee_gwp_basis_ar5', 'investee_scope3_excluded', 'pcaf_style_score_1'])
        self.assertEqual([(x['quantity'], x['rounded']) for x in r['conversions']], [('attribution share = equity share percent / 100', False)])

    def test_ghgp_15_2_revenue_eeio_corrected_total(self):
        # Calculation guidance example 15.2 (p.145) with its illustrative kg CO2e per $ factors through patched NAICS codes (2022 USD):
        # the correct total is 2,332,500 kg; the guidance prints 2,242,500 (investee 4 is 990,000, not 900,000).
        ex = EXAMPLES['15.2']
        lines = (('900001', '0.6', '3000000', '5'), ('900002', '0.5', '7500000', '15'), ('900003', '3.0', '1150000', '20'),
                 ('900004', '2.0', '3300000', '10'), ('900005', '1.5', '2200000', '10'))  # investee 4: 5.5M split 60% / 40% by sector
        with patched(spend=[(code, factor) for code, factor, _, _ in lines]):
            rs = [calc(revenue(naicsCode=code, revenue=rev, attribution={'basis': 'equity_share_percent', 'percent': pct})) for code, _, rev, pct in lines]
            agg = e.aggregate(rs)
        self.assertEqual([total(r) for r in rs], [F(int(x)) for x in ex['lines']])
        self.assertEqual((agg['categorySubtotals']['15']['unrounded'], agg['categorySubtotals']['15']['display']), (ex['total'], '2332500.0000'))
        self.assertNotEqual(agg['categorySubtotals']['15']['unrounded'], ex['printed'])  # never the printed 2,242,500

    def test_ghgp_15_3_project_shares_and_15_5_lifetime_memo(self):
        # Example 15.3 (p.148): project scope 1 and 2 x share of total project cost (1/20, 5/50, 3/60, 10/90); 10/90 rounded once to 12 dp.
        rs = [calc(reported(path='project_reported', holdingType='project_finance', outstandingAmount=n, investeeEmissions=em,
                            attribution={'basis': 'outstanding_over_denominator', 'denominatorType': 'total_project_cost', 'denominator': d}))
              for em, n, d in (('200000', '1', '20'), ('10000', '5', '50'), ('250000', '3', '60'), ('30000', '10', '90'))]
        exp = [F(int(em)) * 1000 * r12(F(int(n), int(d))) for em, n, d in (('200000', 1, 20), ('10000', 5, 50), ('250000', 3, 60), ('30000', 10, 90))]
        self.assertEqual([total(r) for r in rs], exp)
        self.assertEqual(rs[3]['conversions'][0]['result'], '0.111111111111')
        self.assertEqual(fixed(sum(exp) / 1000, 4), EXAMPLES['15.3']['total_exact_t'])  # the guidance prints 26,833 from a rounded 11.11%
        # Example 15.5 (p.152): an initial sponsor's projected lifetime emissions, 7,000,000 t a year x 30 (or 60) years x 15%, reported
        # separately: a memo item, never in the total.
        for years, tonnes in ((30, int(EXAMPLES['15.5']['30'])), (60, int(EXAMPLES['15.5']['60']))):
            r = calc(reported(path='project_reported', holdingType='project_finance', investeeEmissions='7000000', attribution={'basis': 'equity_share_percent', 'percent': '15'},
                              projectedAnnual='7000000', lifetimeYears=years))
            self.assertEqual(r['memoItems'], [{'code': 'projected_lifetime_emissions', 'kg': text(F(tonnes) * 1000), 'unit': 'kg CO2e', 'reportedSeparately': True}])
            self.assertEqual(total(r), F(7000000) * 1000 * F(15, 100))  # the annual figure only
            self.assertIn('projected_lifetime_emissions_reported_separately', r['boundary']['notes'])
            agg = e.aggregate([r])
            self.assertEqual(agg['categorySubtotals']['15']['unrounded'], text(total(r)))
            self.assertEqual(agg['categoryProfiles']['15']['memoItems'], {'projected_lifetime_emissions': {'unrounded': text(F(tonnes) * 1000), 'display': fixed(F(tonnes) * 1000, 4),
                                                                                                           'unit': 'kg CO2e', 'rounding': 'half_even_4dp_once'}})

    def test_tv15_e1_and_a_deflated_revenue_year(self):
        # TV15-E1: 10,000,000 USD (2022) x 0.246 (EPA v1.3 row 755, 531120 without margins) x 25% = 615,000 kg.
        r = calc(revenue())
        self.assertEqual((total(r), r['total']['display']), (F(10000000) * v('epa_scghg_v130.531120.without_margins') * F(1, 4), '615000.0000'))
        self.assertEqual((r['methodVersionId'], r['gwpSetId'], r['activity']['pcafScore'], r['estimates'], 'priceRatio' in r['activity']), (EEIO, 'AR5-100', 4, [], False))
        self.assertEqual(r['boundary']['notes'], ['eeio_upper_bound_proxy_includes_investee_upstream', 'factor_ghg_year_2022', 'pcaf_style_score_4', 'revenue_proxy'])
        self.assertEqual(r['activity']['nominalCo2e'], text(total(r)))
        # The fixture's 35,000,000 USD of 2024 revenue under 541511 (row 798), 1,000,000 over an EVIC of 125,000,000.
        d = calc(revenue(revenue='35000000', revenueYear=2024, naicsCode='541511', attribution={'basis': 'outstanding_over_denominator', 'denominatorType': 'evic', 'denominator': '125000000'}))
        share, ratio = r12(F(1000000, 125000000)), r12(c('price_index.gdp_deflator.2022') / c('price_index.gdp_deflator.2024'))
        self.assertEqual(total(d), F(35000000) * v('epa_scghg_v130.541511.without_margins') * ratio * share)
        self.assertEqual((d['activity']['nominalCo2e'], d['activity']['priceRatio'], d['estimates']), (text(F(35000000) * F(84, 1000) * share), text(ratio), ['revenue_economy_wide_price_index']))
        self.assertEqual([x['quantity'] for x in d['conversions']], ['attribution share = outstanding amount / evic',
                                                                       'price ratio = I2022 / I2024 (BEA GDP implicit price deflator, FRED A191RD3A086NBEA; economy-wide, not commodity-specific)'])

    def test_holds_never_count(self):
        over = calc(reported(attribution={'basis': 'equity_share_percent', 'percent': '100.5'}))
        self.assertEqual((over['status'], over['findings'], over['total']), ('review_required', ['attribution_share_exceeds_one'], None))
        evic = calc(reported(outstandingAmount='2', attribution={'basis': 'outstanding_over_denominator', 'denominatorType': 'evic', 'denominator': '1'}))
        self.assertEqual(evic['findings'], ['attribution_share_exceeds_one'])
        zero = calc(reported(attribution={'basis': 'outstanding_over_denominator', 'denominatorType': 'evic', 'denominator': '0'}))
        self.assertEqual((zero['status'], zero['findings']), ('input_needed', ['attribution_denominator_zero']))
        self.assertEqual(calc(reported(investeeEmissions=None))['findings'], ['investee_emissions_required'])
        self.assertEqual(calc(revenue(naicsCode='221100'))['findings'], ['investee_naics_code_not_in_factor_set'])
        late = calc(revenue(revenueYear=2026))
        self.assertEqual((late['findings'], late['additionalRegisters']), (['revenue_year_index_missing'], [{'name': 'spend', 'sha256': e.SPEND_REGISTER_SHA256}]))
        self.assertEqual(refusal(reported(revenue='1')), 'invalid_input_shape')
        self.assertEqual(refusal(revenue(gwpBasis='AR5')), 'invalid_input_shape')
        self.assertEqual(refusal(reported(projectedAnnual='1')), 'invalid_projection')
        self.assertEqual(refusal(reported(path='direct')), 'invalid_investment_path')
        self.assertEqual(refusal(reported(attribution={'basis': 'equity_share', 'percent': '1'})), 'invalid_attribution')
        self.assertEqual(refusal(revenue(revenueYear=2011)), 'invalid_revenue_year')

    def test_pcaf_style_score_optional_types_and_unverified_default(self):
        unverified = calc(reported(emissionsVerified=None, holdingType='debt_general', gwpBasis='unknown'))
        self.assertEqual(unverified['activity']['pcafScore'], 2)
        self.assertEqual(unverified['boundary']['notes'], ['investee_data_unverified', 'investee_gwp_basis_unknown', 'investee_scope3_excluded', 'optional_investment_type_included', 'pcaf_style_score_2'])
        self.assertEqual(calc(reported(emissionsVerified=False))['activity']['pcafScore'], 2)
        verified = calc(reported(investeeEmissions='1000'))
        p = e.aggregate([verified, unverified, calc(revenue())], [NONE, NONE, {'dataQuality': None, 'activityDataOrigin': 'company_records'}])['categoryProfiles']['15']
        # A19: investee figures are value-chain data, the revenue proxy an estimate whatever the annotation; A20: unverified -> fair reliability.
        self.assertEqual(F(Decimal(p['valueChain']['numerator']['unrounded'])), total(verified) + total(unverified))
        rel = p['dataQuality']['indicators']['reliability']['ratingKg']
        self.assertEqual({k: F(Decimal(x['unrounded'])) for k, x in rel.items()}, {'very_good': total(verified), 'fair': total(unverified) + total(calc(revenue()))})
        self.assertEqual(sorted(p['methodTypes']), ['partner_reported', 'proxy'])


class AggregateBiogenicMemoAndDeflation(unittest.TestCase):
    def test_biogenic_summed_per_category_outside_every_total(self):
        rs = [calc(fuel(fuel='biodiesel_100')), calc(fuel()), calc(product(energyCarrier='wood_and_wood_residuals', energyUnit='MMBtu', energyPerBasis='2')), calc(ghg())]
        agg = e.aggregate(rs)
        biogenic = sum(F(Decimal(r['biogenicCo2']['mass'])) for r in rs if 'biogenicCo2' in r)
        self.assertEqual(agg['categoryProfiles']['11']['biogenicCo2'], {'unrounded': text(biogenic), 'display': fixed(biogenic, 4), 'unit': 'kg CO2', 'rounding': 'half_even_4dp_once'})
        self.assertEqual(F(Decimal(agg['categorySubtotals']['11']['unrounded'])), sum(total(r) for r in rs))
        self.assertEqual(F(Decimal(agg['knownSourceSubtotal']['unrounded'])), sum(total(r) for r in rs))  # biogenic CO2 is in no total
        # Round 3 (owner decision 3): the greenhouse-gas product's end-of-life charge is the category's only memo item, outside every total.
        eol = sum(F(Decimal(m['kg'])) for r in rs for m in r.get('memoItems') or [])
        self.assertEqual({k: F(Decimal(x['unrounded'])) for k, x in agg['categoryProfiles']['11']['memoItems'].items()}, {'ghg_product_end_of_life_remaining_charge': eol})

    def test_revenue_proxy_deflation_effect(self):
        d = calc(revenue(revenueYear=2024))
        p = e.aggregate([d, calc(reported())])['categoryProfiles']['15']
        effect = F(Decimal(d['activity']['nominalCo2e'])) - total(d)
        self.assertEqual(p['deflationEffect'], {'unrounded': text(effect), 'display': fixed(effect, 4), 'unit': 'kg CO2e', 'rounding': 'half_even_4dp_once'})
        self.assertEqual(p['dominantMethodType'], 'partner_reported' if total(calc(reported())) > total(d) else 'proxy')


class MetadataAndCatalog(unittest.TestCase):
    def test_metadata(self):
        meta = e.describe()['methodMetadata']
        dq = lambda *r: dict(zip(e.DQ_INDICATORS, r))
        product_dq = dq('fair', 'very_good', 'good', 'fair', 'fair')
        expected = {
            FUEL: ('activity_average_data', 'company_records', product_dq, None, 'quantified', ['supplement']),
            PRODUCT: ('activity_average_data', 'company_records', product_dq, None, 'quantified', ['supplement']),
            GHG: ('activity_average_data', 'company_records', product_dq, None, 'none_expected', ['supplement']),
            EOL: ('activity_average_data', 'company_records', dq('fair', 'good', 'good', 'fair', 'good'), None, 'not_in_factor', []),
            REPORTED: ('partner_reported', 'value_chain_partner', dq('very_good', 'good', 'very_good', 'good', 'very_good'), dq('very_good', 'good', 'very_good', 'good', 'fair'), 'as_reported', []),
            EEIO: ('proxy', 'estimate', dq('poor', 'good', 'fair', 'fair', 'fair'), None, 'not_in_factor', ['spend']),
        }
        for mid, (mt, origin, default, unverified, biogenic, registers) in expected.items():
            m = meta[mid]
            self.assertEqual((m['methodType'], m['activityDataOrigin'], m['defaultDataQuality']['indicators'], m.get('defaultDataQualityUnverified', {}).get('indicators'),
                              m['biogenicTreatment'], m['additionalRegisters']), (mt, origin, default, unverified, biogenic, registers), mid)
        self.assertEqual(e.UNVERIFIED_NOTES, ('supplier_data_unverified', 'partner_data_unverified', 'investee_data_unverified'))
        self.assertEqual({mid: e.METHODS[mid]['resultExtras'] for mid in expected}, {FUEL: ('additionalRegisters', 'biogenicCo2'), PRODUCT: ('additionalRegisters', 'biogenicCo2'),
                                                                                       GHG: ('additionalRegisters', 'memoItems'), EOL: (), REPORTED: ('memoItems',), EEIO: ('additionalRegisters', 'memoItems')})
        methods = {m['id']: m for m in e.describe()['methods']}
        self.assertTrue('upper-bound proxy' in methods[EEIO]['title'])
        self.assertEqual(methods[GHG]['factorCells']['hub2025_gwp.R-410A'], 'D575')
        self.assertEqual(sorted(methods[EEIO]['factorKeys']), sorted(k for k in CELLS if k.startswith('epa_scghg_v130.') and k.endswith('.without_margins')))
        # Every method the engine runs: the five base methods, three purchases, five I-05, six I-07, four I-12u and two I-12h methods.
        self.assertEqual(len(methods), 25)

    def test_catalog_token_lists(self):
        cat = e.catalog()
        units = {x['id'].split('.')[1]: x['unit'] for x in R3['entries'] if x['id'].endswith('.heat_content')}
        self.assertEqual(cat['soldFuelUnits'], {f: {'mmBtu per gallon (HHV)': 'US_gallon', 'mmBtu per scf (HHV)': 'scf', 'mmBtu per short ton (HHV)': 'short_ton'}[u] for f, u in units.items()})
        self.assertEqual(sorted(cat['soldFuelUnits']), cat['soldFuels'])
        self.assertTrue(set(cat['transportFuels']) <= set(cat['soldFuels']))
        self.assertEqual(cat['useRegions'][:2], ['US', 'non_US'])
        self.assertEqual(sorted(cat['useRegions'][2:]), sorted(e.SUBREGION_INTERCONNECT))
        self.assertEqual(cat['investmentPaths'], {'investee_reported': REPORTED, 'project_reported': REPORTED, 'revenue_eeio': EEIO})
        self.assertEqual(cat['holdingTypes'], ['equity_listed', 'equity_unlisted', 'jv_associate', 'debt_known_use', 'project_finance', 'debt_general', 'other'])
        self.assertEqual(cat['optionalHoldingTypes'], ['debt_general', 'other'])
        # Hub Table 2's fuels (C104:C113 of the staged Hub xlsx) as Table 1 rows: Table 1's CO2 per gallon is Table 2's value before
        # EPA's rounding (residual fuel oil 0.150 x 75.10 = 11.265 -> 11.27, so No. 6 not No. 5's 10.21; motor gasoline 8.7775 -> 8.78).
        self.assertEqual(v('hub2025_t1.residual_fuel_oil_no_6.heat_content') * v('hub2025_t1.residual_fuel_oil_no_6.co2'), F(11265, 1000))
        self.assertEqual(v('hub2025_t1.motor_gasoline.heat_content') * v('hub2025_t1.motor_gasoline.co2'), F(87775, 10000))

    def test_context_independence_and_batch_equivalence(self):
        rng = random.Random(707)
        fuels = sorted(e._sold_fuels().items())
        reqs = []
        for _ in range(50):
            name, (unit, _) = rng.choice(fuels)
            reqs.append(fuel(fuel=name, quantity=f'{rng.randint(1, 99999)}.{rng.randint(0, 999)}', unit=rng.choice([unit, 'MMBtu'])))
            reqs.append(product(quantity=str(rng.randint(1, 10 ** 5)), lifetimeQuantity=str(rng.randint(1, 40)), energyPerBasis=f'{rng.randint(1, 9999)}.{rng.randint(0, 99)}',
                                useRegion=rng.choice(['US', 'CAMX', 'ERCT', 'NWPP'])))
            reqs.append(ghg(quantity=str(rng.randint(1, 10 ** 5)), useReleasePercent=f'{rng.randint(0, 99)}.{rng.randint(0, 9)}', gas=rng.choice(['R-410A', 'HFC-134a', 'R-404A', 'SF6'])))
            reqs.append(eol(quantity=str(rng.randint(1, 10 ** 4)), unit=rng.choice(['short_ton', 'lb', 'kg', 'metric_ton'])))
            reqs.append(reported(investeeEmissions=str(rng.randint(1, 10 ** 7)), attribution={'basis': 'outstanding_over_denominator', 'denominatorType': 'total_equity_plus_debt',
                                                                                             'denominator': str(rng.randint(10 ** 7, 10 ** 9))}))
            reqs.append(revenue(revenue=str(rng.randint(1, 10 ** 9)), revenueYear=rng.randint(2012, 2025)))
        many = e.calculate_many(reqs)
        for req, item in zip(reqs, many):
            self.assertEqual(item, {'status': 'ok', 'result': calc(req)})
            with localcontext() as ctx:
                ctx.prec = 6
                self.assertEqual(calc(req), item['result'])
        e.aggregate([x['result'] for x in many])  # recomputation accepts every result


if __name__ == '__main__':
    unittest.main()
