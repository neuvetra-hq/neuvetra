"""Scope 3 round 2, lane A (ROUND2.md owner decisions 1-4; findings ACC-5, ACC-7, ACC-14, ACC-17, ENG-7, ENG-8, ENG-12).

Expected values are independent exact arithmetic (fractions.Fraction) on the source values: the committed transcription
files (tools/method-reference/sources/*.json), the R1/R2/R3 register cells (each built from its primary file and checked
against it by the builder tests) and the r4.1 oracle's hand figure for C4-177 (oracle/r41_extension.py), never engine output.
"""
import decimal
import json
import re
import unittest
from decimal import Decimal
from fractions import Fraction
from pathlib import Path
from unittest import mock

import scope3_engine as e

ROOT = Path(__file__).resolve().parents[4]
REF = ROOT / 'packages/neuvetra-database/src/method-reference'
SOURCES = ROOT / 'tools/method-reference/sources'
R1 = json.loads((REF / 'verified-scope3-register-2025.json').read_text('utf-8'))
R2 = json.loads((REF / 'verified-scope3-spend-register-epa-scghg-v1.3.json').read_text('utf-8'))
R3 = json.loads((REF / 'verified-scope3-supplement-register-2025.json').read_text('utf-8'))
T = {v['id']: v for name in ('us-upstream-transcriptions.json', 'us-upstream-transcriptions-2.json') for v in json.loads((SOURCES / name).read_text('utf-8'))['values']}
P = {'start': '2025-01-01', 'endExclusive': '2026-01-01'}
P26 = {'start': '2026-01-01', 'endExclusive': '2027-01-01'}
FY = {'start': '2025-07-01', 'endExclusive': '2026-07-01'}
MAX = '999999999999.999'


def F(text) -> Fraction:
    return Fraction(Decimal(str(text)))


def tv(tid: str) -> Fraction:
    assert T[tid]['agreed'] is True, tid
    return F(T[tid]['value'])


def cell(reg: dict, key: str, part: str = 'entries') -> Fraction:
    return F(next(x['value'] for x in reg[part] if x['id'] == key))


def round12(q: Fraction) -> Fraction:
    return Fraction(round(q * 10 ** 12), 10 ** 12)


def total(r) -> Fraction:
    return F(r['total']['unrounded'])


def calc(kind, inp):
    return e.calculate({'kind': kind, 'input': inp})


MJ_PER_MMBTU = Fraction(105505585262, 10 ** 8)
F_TRANS = tv('netl2024_4862.ng_upstream.prod_through_transmission') * MJ_PER_MMBTU / 1000
# Decision 2: kg CO2e per MMBtu (HHV) of oil-fired generation = UP_ulsd (g/MJ LHV, CA-GREET3.0 Total - Tailpipe) x ED_ulsd
# (MJ/gal LHV, 17 CCR 95486 Table 4) / 1000 / HHV of distillate No. 2 (MMBtu/gal, Hub 2025 Table 1 D55), rounded 12 dp.
UP_ULSD = tv('cagreet3_lut2018.ulsd.total') - tv('cagreet3_lut2018.ulsd.tailpipe')
F_OIL = round12(UP_ULSD * tv('carb_lcfs.energy_density.ulsd') / 1000 / cell(R3, 'hub2025_t1.distillate_fuel_oil_no_2.heat_content'))
FOSSIL = ('COAL', 'GAS', 'OFSL', 'OIL')
# Round 2, lane F (DESIGN 13.6): coal mine methane only, round12(43.6 MMT CO2e x 10^9 / (594,155 thousand short tons x 1000 x
# 20.100 MMBtu/short ton)), from the printed values of us-upstream-transcriptions-3.json (thousands separator removed).
T3 = {v['id']: v for v in json.loads((SOURCES / 'us-upstream-transcriptions-3.json').read_text('utf-8'))['values'] if v['agreed'] is True}
F_COAL = round12(F(T3['epa_ghgi.2022.coal_mining_ch4_total']['value']) * 10 ** 9 / (F(T3['eia.2022.coal_production_short_tons']['value'].replace(',', '')) * 1000
                                                                                   * F(T3['eia.2022.coal_heat_content_production']['value'])))
MAPPED = {'COAL': F_COAL, 'GAS': F_TRANS, 'OIL': F_OIL}


def heat(region: str) -> dict:
    return {x['id'].rsplit('.', 1)[1]: F(x['value']) for x in R3['entries'] if x['id'].startswith(f'egrid2023_hi.{region}.')}


def expected(region: str) -> dict:
    hi, gen = heat(region), cell(R3, f'egrid2023_gen.{region}')
    fossil = sum((v for k, v in hi.items() if k in FOSSIL), Fraction(0))
    mapped = sum((v for k, v in hi.items() if k in MAPPED), Fraction(0))
    unmapped = sum((v for k, v in hi.items() if k in FOSSIL and k not in MAPPED), Fraction(0))
    return {'u': sum((round12(hi[k] / gen) * f for k, f in MAPPED.items() if k in hi), Fraction(0)),
            'share': round12(mapped / fossil) if fossil else None, 'unmappedShare': round12(unmapped / fossil) if fossil else None,
            'unmappedPerMwh': round12(unmapped / gen), 'otherPerMwh': round12(hi['OTHF'] / gen) if 'OTHF' in hi else None,
            'mapped': sorted(k for k in hi if k in MAPPED), 'unmapped': sorted(k for k in hi if k in FOSSIL and k not in MAPPED),
            'other': ['OTHF'] if 'OTHF' in hi else []}


class Registry(unittest.TestCase):
    """ENG-7: one declarative registry; no runtime patching; a start-up consistency check."""

    def test_methods_kinds_and_calculators_come_from_one_declaration(self):
        declared = [mid for _, _, ids in e.METHOD_REGISTRY for mid in ids]
        self.assertEqual(sorted(declared), sorted(e.METHODS))
        self.assertEqual(len(declared), 25)
        self.assertEqual(e.CALCULATORS, {kind: fn for kind, fn, _ in e.METHOD_REGISTRY})
        for kind, _, ids in e.METHOD_REGISTRY:
            self.assertTrue(all(e.METHODS[mid]['kind'] == kind for mid in ids), kind)
            self.assertEqual(e.KIND_METHOD.get(kind), ids[0] if len(ids) == 1 else None, kind)
        e._check_registry()

    def test_the_check_refuses_an_inconsistent_declaration(self):
        dup = e.METHOD_REGISTRY + (('waste', e.waste, ('scope3.cat5_12.waste.v1',)),)
        with mock.patch.object(e, 'METHOD_REGISTRY', dup), self.assertRaises(RuntimeError):
            e._check_registry()
        bad = dict(e.METHODS)
        bad['scope3.cat5_12.waste.v1'] = dict(bad['scope3.cat5_12.waste.v1'], kind='transport')
        with mock.patch.object(e, 'METHODS', bad), self.assertRaises(RuntimeError):
            e._check_registry()
        with mock.patch.object(e, 'REGISTER_PREFIXES', e.REGISTER_PREFIXES + (('cbecs2018.', 'cbecs'),)), self.assertRaises(RuntimeError):
            e._check_registry()

    def test_no_runtime_patching_and_no_dead_prefix(self):
        src = Path(e.__file__).read_text('utf-8')
        for pattern in (r'METHODS\.update\(', r'KIND_METHOD\.update\(', r'CALCULATORS\.update\(', r'(?<![A-Z_])REGISTERS\[[^\]]+\]\s*=', r'REGISTER_PREFIXES\s*=\s*tuple\('):
            self.assertIsNone(re.search(pattern, src), pattern)
        self.assertEqual(src.count('\nREGISTER_PREFIXES = '), 1)
        self.assertNotIn('cbecs', {name for _, name in e.REGISTER_PREFIXES})
        self.assertTrue(all(name in e.REGISTERS for _, name in e.REGISTER_PREFIXES))


class Exactness(unittest.TestCase):
    """ENG-12: Inexact is trapped except in the listed rounding steps."""

    def test_an_inexact_operation_raises_in_the_calculation_context(self):
        with e._exact():
            with self.assertRaises(decimal.Inexact):
                Decimal(1) / Decimal(3)
            self.assertEqual(Decimal('1234.5') * Decimal('0.45359237'), Decimal('559.959780765'))
        self.assertTrue(e.EXACT.traps[decimal.Inexact])
        self.assertFalse(e.ROUNDING_STEP.traps[decimal.Inexact])
        self.assertEqual(len(e.ROUNDING_STEPS), 3)

    def test_the_listed_rounding_steps_still_round_half_even(self):
        with e._exact():
            self.assertEqual((e.display(Decimal('0.00005')), e.display(Decimal('0.00015')), e.display(Decimal('-0.00025'))), ('0.0000', '0.0002', '-0.0002'))
            conv = []
            self.assertEqual(e.divide(Decimal(1), Decimal(3), 'third', conv), Decimal('0.333333333333'))
            self.assertTrue(conv[0]['rounded'])

    def test_every_kind_at_maximum_magnitude_is_exact(self):
        """A property per method: the largest quantities the input grammar allows calculate without any inexact step."""
        waste = 'mixed_msw'
        gas = e.catalog()['ghgGases'][0]
        cases = {
            'td_losses': {'period': P, 'quantity': MAX, 'unit': 'MWh', 'subregion': 'CAMX', 'zip': '94105'},
            'transport': {'period': P, 'category': 4, 'vehicle': 'medium_and_heavy_duty_truck', 'loadBasis': 'shared_vehicle', 'activity': {'value': MAX, 'unit': 'tonne-km'},
                          'thirdPartyFacilities': 'none'},
            'waste': {'period': P, 'category': 5, 'material': waste, 'treatment': 'landfilled', 'quantity': MAX, 'unit': 'kg'},
            'business_travel': {'period': P, 'mode': 'air', 'segmentDistance': {'value': MAX, 'unit': 'km'}, 'passengerSegments': 10_000_000},
            'employee_commuting': {'period': P, 'mode': 'bus', 'activity': {'value': MAX, 'unit': 'passenger-km'}},
            'purchase_spend': {'period': P26, 'category': 1, 'naicsCode': '111130', 'amount': MAX, 'currency': 'USD', 'dollarYear': 2026, 'marginChoice': 'with_margins',
                               'boughtAtFactoryGate': False, 'capitalFullCost': None},
            'purchase_supplier': {'period': P, 'category': 1, 'factorOrigin': 'supplier_primary', 'basis': 'allocated_total', 'quantity': MAX, 'unit': 'metric_ton CO2e',
                                  'factorValue': None, 'factorUnit': None, 'allocationNumerator': '1', 'allocationDenominator': '3', 'boundary': 'cradle_to_gate',
                                  'hybridUpstreamCoveredBy': None, 'gwpBasis': 'AR5', 'verification': 'unverified'},
            'energy_resold': {'period': P, 'quantity': MAX, 'unit': 'kWh', 'gridBasis': 'us_average', 'zip': None, 'subregion': None, 'utilityEiaId': None},
            'commuting_average': {'period': P, 'headcount': MAX, 'workingDays': 366, 'modes': [{'mode': 'passenger_car', 'sharePercent': '100', 'oneWayDistance': MAX,
                                                                                               'distanceUnit': 'km', 'occupancy': '3.333'}]},
            'teleworking': {'period': P, 'carrier': 'natural_gas', 'quantity': MAX, 'unit': 'scf', 'zip': None, 'subregion': None, 'utilityEiaId': None},
            'asset_energy': {'period': P, 'category': 8, 'carrier': 'electricity', 'quantity': MAX, 'unit': 'kWh', 'zip': '94105', 'subregion': 'CAMX', 'utilityEiaId': None,
                             'refrigerantGas': None, 'allocation': {'reportingArea': '1', 'buildingArea': '3', 'occupancyPercent': '99.999', 'areaUnit': 'sqft'}},
            'partner_reported': {'period': P, 'category': 8, 'quantity': MAX, 'unit': 'metric_ton CO2e', 'allocationBasis': 'area', 'allocationNumerator': '1',
                                 'allocationDenominator': '7', 'scope2Basis': 'location', 'gwpBasis': 'AR5', 'verification': 'unverified', 'periodMatches': True},
            'sold_fuel': {'period': P, 'fuel': 'motor_gasoline', 'quantity': MAX, 'unit': 'US_gallon', 'combustedInUse': 'yes'},
            'sold_energy_product': {'period': P, 'quantity': MAX, 'lifetimeBasis': 'years', 'lifetimeQuantity': MAX, 'energyPerBasis': MAX, 'energyCarrier': 'natural_gas',
                                    'energyUnit': 'therm', 'useRegion': 'US'},
            'sold_ghg_product': {'period': P, 'quantity': MAX, 'gas': gas, 'chargePerUnit': MAX, 'chargeUnit': 'lb', 'useReleasePercent': '99.999'},
            'end_of_life_split': {'period': P, 'material': waste, 'basis': 'sold_products', 'quantity': MAX, 'unit': 'kg',
                                  'split': {'recycled': '0', 'landfilled': '33.333', 'combusted': '66.667', 'composted': '0', 'anaerobic_digestion_dry': '0', 'anaerobic_digestion_wet': '0'}},
            'investment': {'period': P26, 'path': 'revenue_eeio', 'holdingType': 'equity_listed', 'outstandingAmount': '1', 'attribution': {'basis': 'outstanding_over_denominator',
                           'denominatorType': 'evic', 'denominator': '3'}, 'investeeEmissions': None, 'emissionsVerified': None, 'gwpBasis': None, 'revenue': MAX,
                           'revenueYear': 2026, 'naicsCode': '111130', 'projectedAnnual': MAX, 'lifetimeYears': 100},
            'fuel_upstream': {'period': P, 'source': 'natural_gas', 'quantity': MAX, 'unit': 'mcf', 'heatContent': {'value': '999999999999.999999', 'unit': 'therm per ccf'}},
            'electricity_upstream': {'period': P, 'quantity': MAX, 'unit': 'MWh', 'subregion': 'CAMX', 'zip': '94105'},
            'td_losses_upstream': {'period': P, 'quantity': MAX, 'unit': 'MWh', 'subregion': 'CAMX', 'zip': '94105'},
            'energy_resold_upstream': {'period': P, 'quantity': MAX, 'unit': 'MWh', 'gridBasis': 'us_average', 'zip': None, 'subregion': None, 'utilityEiaId': None},
            'hotel_stay': {'period': P, 'roomNights': MAX, 'country': 'US', 'countryBasis': 'stated'},
            'building_average': {'period': FY, 'category': 8, 'cbecsActivity': 'office', 'usesNaturalGas': 'yes', 'area': MAX, 'areaUnit': 'm2', 'coveredDays': 200,
                                 'gridBasis': 'subregion', 'zip': '94105', 'subregion': 'CAMX', 'utilityEiaId': None},
        }
        self.assertEqual(sorted(cases), sorted(e.CALCULATORS))
        for kind, inp in cases.items():
            r = calc(kind, inp)
            self.assertEqual(r['status'], 'complete', kind)
            self.assertGreater(total(r), 0, kind)


class PeriodEnvelope(unittest.TestCase):
    """Owner decision 1: the Scope 3 envelope is 2025-01-01 to 2027-01-01; later periods disclose the factor vintage."""
    BUS = {'mode': 'bus', 'activity': {'value': '1', 'unit': 'passenger-mile'}}

    def test_2026_and_fiscal_years_calculate_with_the_latest_factors_and_say_so(self):
        base = calc('employee_commuting', dict(self.BUS, period=P))
        self.assertNotIn('factor_vintage_precedes_period', base['boundary']['notes'])
        for period in (P26, FY, {'start': '2026-01-01', 'endExclusive': '2026-02-01'}):
            r = calc('employee_commuting', dict(self.BUS, period=period))
            self.assertEqual(r['status'], 'complete', period)
            self.assertEqual(total(r), total(base))  # the same Hub 2025 factors: only the vintage disclosure is added
            self.assertEqual(r['boundary']['notes'], sorted(base['boundary']['notes'] + ['factor_vintage_precedes_period']))
            self.assertEqual(r['factorsUsed'], base['factorsUsed'])
        # A held line of a later period carries the disclosure too.
        held = calc('waste', {'period': P26, 'category': 5, 'material': 'mixed_msw', 'treatment': 'recycled', 'quantity': '1', 'unit': 'kg'})
        self.assertEqual((held['status'], held['boundary']['notes']), ('input_needed', ['factor_vintage_precedes_period']))

    def test_outside_the_envelope_keeps_the_existing_refusal_code(self):
        for period in ({'start': '2027-01-01', 'endExclusive': '2027-02-01'}, {'start': '2026-07-01', 'endExclusive': '2027-07-01'},
                       {'start': '2024-12-01', 'endExclusive': '2025-02-01'}):
            with self.assertRaises(e.Refused) as x:
                calc('employee_commuting', dict(self.BUS, period=period))
            self.assertEqual(x.exception.code, 'period_outside_2025_method_envelope')
        self.assertEqual({m['reportingPeriod']['endExclusive'] for m in e.describe()['methods']}, {'2027-01-01'})

    def test_buildings_count_days_of_the_year_the_period_ends_in(self):
        r = calc('building_average', {'period': FY, 'category': 8, 'cbecsActivity': 'office', 'usesNaturalGas': 'no', 'area': '1000', 'areaUnit': 'sqft',
                                      'coveredDays': 365, 'gridBasis': 'us_average', 'zip': None, 'subregion': None, 'utilityEiaId': None})
        self.assertEqual((r['activity']['daysInYear'], r['activity']['yearShare']), (365, '1'))
        self.assertIn('factor_vintage_precedes_period', r['boundary']['notes'])


class SpendDeflator(unittest.TestCase):
    """Owner decision 1: a line year without a published annual deflator uses the latest published year, disclosed."""
    LINE = {'category': 1, 'naicsCode': '111130', 'amount': '1000', 'currency': 'USD', 'marginChoice': 'with_margins', 'boughtAtFactoryGate': False, 'capitalFullCost': None}

    def test_2026_dollars_use_the_2025_index(self):
        latest = max(int(c['id'].rsplit('.', 1)[1]) for c in R2['constants'] if c['id'].startswith('price_index.gdp_deflator.'))
        self.assertEqual(latest, 2025)
        r = calc('purchase_spend', dict(self.LINE, period=P26, dollarYear=2026))
        ratio = round12(cell(R2, 'price_index.gdp_deflator.2022', 'constants') / cell(R2, 'price_index.gdp_deflator.2025', 'constants'))
        self.assertEqual(r['status'], 'complete')
        self.assertEqual(total(r), F('1000') * cell(R2, 'epa_scghg_v130.111130.with_margins') * ratio)
        self.assertEqual((F(r['activity']['priceRatio']), r['activity']['priceIndexYearUsed'], r['activity']['dollarYear']), (ratio, 2025, 2026))
        self.assertIn('price_index_latest_published_year_used', r['boundary']['notes'])
        self.assertIn('economy_wide_price_index', r['estimates'])
        self.assertIn('I2022 / I2025', r['conversions'][0]['quantity'])
        # A registered year is unchanged (no new key or note).
        r25 = calc('purchase_spend', dict(self.LINE, period=P, dollarYear=2025))
        self.assertNotIn('priceIndexYearUsed', r25['activity'])
        self.assertNotIn('price_index_latest_published_year_used', r25['boundary']['notes'])

    def test_dollars_later_than_the_line_year_stay_held(self):
        for period, year in ((P, 2026), (P26, 2027), (FY, 2027)):
            r = calc('purchase_spend', dict(self.LINE, period=period, dollarYear=year))
            self.assertEqual((r['status'], r['findings']), ('input_needed', ['dollar_year_index_missing']), (period, year))

    def test_investment_revenue_year_follows_the_same_rule(self):
        inv = {'path': 'revenue_eeio', 'holdingType': 'equity_listed', 'outstandingAmount': '50', 'attribution': {'basis': 'outstanding_over_denominator',
               'denominatorType': 'evic', 'denominator': '200'}, 'investeeEmissions': None, 'emissionsVerified': None, 'gwpBasis': None, 'revenue': '1000000',
               'naicsCode': '111130', 'projectedAnnual': None, 'lifetimeYears': None}
        r = calc('investment', dict(inv, period=P26, revenueYear=2026))
        ratio = round12(cell(R2, 'price_index.gdp_deflator.2022', 'constants') / cell(R2, 'price_index.gdp_deflator.2025', 'constants'))
        self.assertEqual(total(r), F('1000000') * cell(R2, 'epa_scghg_v130.111130.without_margins') * ratio * round12(F(50) / F(200)))
        self.assertIn('price_index_latest_published_year_used', r['boundary']['notes'])
        held = calc('investment', dict(inv, period=P, revenueYear=2026))
        self.assertEqual(held['findings'], ['revenue_year_index_missing'])


class ElectricityUpstreamRound2(unittest.TestCase):
    """Owner decisions 2 and 3, ACC-14: oil mapped with the ULSD proxy (HHV), OTHF not fossil, static nuclear note, the
    quantified gap memo, a zero mapped share held and no fossil generation a stated zero."""
    EL = {'period': P, 'quantity': '1234.5', 'unit': 'MWh', 'subregion': 'CAMX', 'zip': '94105'}

    def test_the_oil_factor_is_ulsd_upstream_converted_to_hhv(self):
        self.assertEqual(UP_ULSD, F('25.59'))
        self.assertEqual(F_OIL, F('24.935415217391'))  # 25.59 x 134.47 / 1000 / 0.138 = 24.9354152173913...
        used, conv = {}, []
        with e._exact():
            got = e._oil_upstream_factor(used, conv)
        self.assertEqual(F(got), F_OIL)
        self.assertEqual(conv[0]['denominator'], '0.138')
        self.assertTrue({'cagreet3_lut2018.ulsd.upstream', 'carb_lcfs.energy_density.ulsd', 'hub2025_t1.distillate_fuel_oil_no_2.heat_content'} <= set(used))

    def test_camx_maps_gas_and_oil_and_memos_the_gap(self):
        x = expected('CAMX')
        r = calc('electricity_upstream', self.EL)
        a = r['activity']
        self.assertEqual(r['status'], 'complete')
        self.assertEqual(total(r), F('1234.5') * x['u'])
        self.assertEqual((a['mappedFuels'], a['unmappedFuels'], a['otherFuelsNotMapped']), (['COAL', 'GAS', 'OIL'], ['OFSL'], ['OTHF']))  # lane F: coal mapped (methane only)
        self.assertEqual((F(a['mappedFossilHeatInputShare']), F(a['unmappedFossilHeatInputShare'])), (x['share'], x['unmappedShare']))
        self.assertEqual(F(a['unmappedFossilHeatInputMmbtu']), F('1234.5') * x['unmappedPerMwh'])
        self.assertEqual(F(a['otherFuelHeatInputMmbtu']), F('1234.5') * x['otherPerMwh'])
        self.assertEqual(a['nonFossilFuelsExcluded'], ['BIOMASS', 'HYDRO', 'NUCLEAR', 'SOLAR', 'WIND'])
        self.assertEqual(r['boundary'], {'minimumBoundary': 'partial', 'notes': sorted([
            # round 3 (lane A): the coal screening memo, the AR5 coal GWP code and solar-thermal co-firing (CAMX burns gas at solar plants)
            'coal_upstream_omitted_screening_range_memo', 'solar_thermal_cofiring_upstream_not_counted', 'upstream_gwp_ar5_coal_mine_methane',
            'cagreet3_vintage_superseded_by_cagreet4', 'coal_upstream_mine_methane_only', 'fossil_fuel_upstream_not_mapped', 'nuclear_biomass_byproduct_fuels_upstream_excluded', 'oil_fired_upstream_proxied_by_ulsd',
            'other_fuel_upstream_not_mapped', 'plant_primary_fuel_allocation', 'upstream_gwp_as_published_ar6', 'upstream_gwp_inferred_ar4', 'upstream_heat_input_hhv_basis'])})

    def test_every_subregion_and_the_us(self):
        regions = sorted({x['id'].split('.')[1] for x in R3['entries'] if x['id'].startswith('egrid2023_gen.')})
        for region in regions:
            x = expected(region)
            used, conv = {}, []
            with e._exact():
                u, a, notes, _memo = e._upstream_intensity(region, Decimal('10'), used, conv)  # round 3: + the coal screening memo
            self.assertEqual(F(u), x['u'], region)
            self.assertEqual((a['mappedFuels'], a['unmappedFuels'], a['otherFuelsNotMapped']), (x['mapped'], x['unmapped'], x['other']), region)
            self.assertEqual(F(a['mappedFossilHeatInputShare']), x['share'], region)
            self.assertEqual(F(a['unmappedFossilHeatInputShare']), x['unmappedShare'], region)
            self.assertEqual(F(a['unmappedFossilHeatInputMmbtu']), 10 * x['unmappedPerMwh'], region)
            self.assertEqual('fossil_fuel_upstream_not_mapped' in notes, bool(x['unmapped']), region)
            self.assertEqual('other_fuel_upstream_not_mapped' in notes, bool(x['other']), region)
            self.assertIn('nuclear_biomass_byproduct_fuels_upstream_excluded', notes)  # static (ACC-14), also where nuclear has no heat input
        self.assertEqual(e.catalog()['upstreamSubregionsWithoutMappedFossil'], [])

    def test_hawaii_is_no_longer_zero(self):
        x = expected('HIOA')
        r = calc('electricity_upstream', {'period': P, 'quantity': '1000', 'unit': 'MWh', 'subregion': 'HIOA', 'zip': '96701'})
        self.assertEqual((r['status'], r['activity']['mappedFuels'], F(r['activity']['mappedFossilHeatInputShare'])), ('complete', ['OIL'], Fraction(1)))
        self.assertEqual(total(r), 1000 * x['u'])
        self.assertGreater(total(r), 0)
        self.assertNotIn('fossil_fuel_upstream_not_mapped', r['boundary']['notes'])

    def test_a_subregion_with_fossil_heat_input_but_no_mapped_fuel_is_held(self):
        with mock.patch.object(e, 'POWER_FUEL_UPSTREAM', {'GAS': e.POWER_FUEL_UPSTREAM['GAS']}):
            self.assertEqual(e.catalog()['upstreamSubregionsWithoutMappedFossil'], ['HIMS', 'HIOA'])
            for kind in ('electricity_upstream', 'td_losses_upstream'):
                r = calc(kind, {'period': P, 'quantity': '1000', 'unit': 'MWh', 'subregion': 'HIOA', 'zip': '96701'})
                self.assertEqual((r['status'], r['findings'], r['total']), ('input_needed', ['no_upstream_factor_for_subregion_fuels'], None), kind)
                self.assertEqual((r['activity']['mappedFossilHeatInputShare'], r['activity']['unmappedFuels']), ('0', ['OIL']), kind)

    def test_a_subregion_without_fossil_heat_input_is_a_stated_zero(self):
        with mock.patch.object(e, 'POWER_FOSSIL_FUELS', ('COAL', 'GAS', 'OFSL')), mock.patch.object(e, 'POWER_NON_FOSSIL_FUELS', e.POWER_NON_FOSSIL_FUELS + ('OIL',)):
            r = calc('electricity_upstream', {'period': P, 'quantity': '1000', 'unit': 'MWh', 'subregion': 'HIOA', 'zip': '96701'})
        self.assertEqual((r['status'], total(r), r['activity']['mappedFossilHeatInputShare']), ('complete', Fraction(0), None))
        self.assertIn('no_fossil_generation_in_subregion', r['boundary']['notes'])

    def test_3c_and_3d_upstream_use_the_same_intensity(self):
        x = expected('US')
        us = {'period': P, 'quantity': '250', 'unit': 'MWh', 'gridBasis': 'us_average', 'zip': None, 'subregion': None, 'utilityEiaId': None}
        up = calc('energy_resold_upstream', us)
        self.assertEqual(total(up), 250 * x['u'])
        self.assertEqual(F(up['activity']['unmappedFossilHeatInputMmbtu']), 250 * x['unmappedPerMwh'])
        ggl = cell(R1, 'egrid2023_ggl.western')
        loss = round12(F('1234.5') * ggl / (1 - ggl))
        c = calc('td_losses_upstream', self.EL)
        self.assertEqual(total(c), loss * expected('CAMX')['u'])
        self.assertEqual(F(c['activity']['unmappedFossilHeatInputMmbtu']), loss * expected('CAMX')['unmappedPerMwh'])


class BuildingsAndProducts(unittest.TestCase):
    def test_buildings_are_partial_for_other_energy_sources(self):
        """Owner decision 4: fuel oil, propane, district heat and refrigerants are not counted, so the line is partial."""
        for gas in ('yes', 'no'):
            r = calc('building_average', {'period': P, 'category': 13, 'cbecsActivity': 'office', 'usesNaturalGas': gas, 'area': '10000', 'areaUnit': 'sqft',
                                          'coveredDays': 365, 'gridBasis': 'us_average', 'zip': None, 'subregion': None, 'utilityEiaId': None})
            self.assertEqual(r['boundary']['minimumBoundary'], 'partial', gas)
            self.assertIn('building_other_energy_sources_not_included', r['boundary']['notes'])

    def test_therm_is_accepted_for_natural_gas_products(self):
        """ACC-5, r4.1 C4-177: 2500 furnaces x 18 years x 450 therm = 20,250,000 therm = 2,025,000 MMBtu; the oracle's hand
        figure is 107,556,862.5 kg CO2e (Hub Table 1 row 38: 53.06 kg CO2, 1 g CH4, 0.1 g N2O; AR5 28 and 265)."""
        r = calc('sold_energy_product', {'period': P, 'quantity': '2500', 'lifetimeBasis': 'years', 'lifetimeQuantity': '18', 'energyPerBasis': '450',
                                         'energyCarrier': 'natural_gas', 'energyUnit': 'therm', 'useRegion': 'US'})
        self.assertEqual((r['status'], total(r), F(r['activity']['mmbtuHhv'])), ('complete', F('107556862.5'), F('2025000')))
        self.assertIn('supplement_const.therm_to_mmbtu', {c['id'] for c in r['constantsUsed']})
        self.assertNotIn('fuel_default_heat_content', r['estimates'])
        with self.assertRaises(e.Refused):
            calc('sold_energy_product', {'period': P, 'quantity': '1', 'lifetimeBasis': 'years', 'lifetimeQuantity': '1', 'energyPerBasis': '1',
                                         'energyCarrier': 'propane', 'energyUnit': 'therm', 'useRegion': 'US'})

    def test_the_transport_fuel_note_is_for_liquid_transport_fuels_lpg_and_propane_not_pipeline_gas(self):
        """ACC-17 and r4.1 C4-170/C4-172: pipeline natural gas sold is not a transport fuel; propane is LPG (Hub Table 2)."""
        def notes(fuel, unit):
            return calc('sold_fuel', {'period': P, 'fuel': fuel, 'quantity': '100', 'unit': unit, 'combustedInUse': 'yes'})['boundary']['notes']
        self.assertNotIn('stationary_ch4_n2o_proxy_for_transport_fuels', notes('natural_gas', 'MMBtu'))
        for fuel in ('propane', 'liquefied_petroleum_gases_lpg', 'motor_gasoline', 'distillate_fuel_oil_no_2', 'kerosene_type_jet_fuel'):
            self.assertIn('stationary_ch4_n2o_proxy_for_transport_fuels', notes(fuel, 'US_gallon'), fuel)

    def test_3d_admission_rules_no_longer_say_the_upstream_source_is_missing(self):
        rules = ' '.join(next(m for m in e.describe()['methods'] if m['id'] == 'scope3.cat3d.energy_resold.egrid2023.v1')['admissionRules'])
        self.assertNotIn('DESNZ', rules)
        self.assertIn('3D upstream', rules)

    def test_ca_greet_liquid_lines_disclose_the_lcfs_vintage(self):
        """ACC-7: CA-GREET3.0 values while the LCFS moved to CA-GREET4.0 on 1 July 2025."""
        r = calc('fuel_upstream', {'period': P, 'source': 'vehicle', 'fuel': 'diesel', 'gallons': '10'})
        self.assertIn('cagreet3_vintage_superseded_by_cagreet4', r['boundary']['notes'])
        ng = calc('fuel_upstream', {'period': P, 'source': 'natural_gas', 'quantity': '10', 'unit': 'MMBtu'})
        self.assertNotIn('cagreet3_vintage_superseded_by_cagreet4', ng['boundary']['notes'])


class RegisterShape(unittest.TestCase):
    """ENG-8: every register entry passes the 0024 loader's entry-shape rule (0024_method_reference.sql, register load)."""

    def test_every_register_entry_has_only_0024_keys(self):
        sql = (ROOT / 'packages/neuvetra-database/src/migrations/0024_method_reference.sql').read_text('utf-8')
        allowed = set(re.search(r"allowed := array\[([^\]]+)\]", sql).group(1).replace("'", '').split(','))
        required = {'id', 'label', 'labelCells', 'sheet', 'table', 'unit', 'value', 'valueCell'}
        for name, spec in sorted(e.REGISTERS.items()):
            reg = json.loads(spec['path'].read_text('utf-8'))
            self.assertIsInstance(reg['source'].get('sha256'), str, name)
            for entry in reg['entries']:
                self.assertTrue(set(entry) <= allowed and required <= set(entry), (name, entry['id'], sorted(set(entry) - allowed)))
                self.assertTrue(all(isinstance(v, str) for k, v in entry.items() if k != 'labelCells'), (name, entry['id']))

    def test_r6_names_what_its_source_hash_is_and_keeps_its_quotes_in_a_sidecar(self):
        r6 = json.loads(e.BUILDING_HOTEL_REGISTER_PATH.read_text('utf-8'))
        self.assertEqual(r6['source']['url'], 'tools/method-reference/sources/us-upstream-transcriptions.json')
        self.assertIn('transcription file', r6['source']['sha256Of'])
        sidecar_path = e.BUILDING_HOTEL_REGISTER_PATH.with_name('verified-scope3-us-building-hotel-register-2025.provenance.json')
        sidecar = json.loads(sidecar_path.read_text('utf-8'))
        self.assertEqual(r6['source']['provenanceSidecar']['sha256'], __import__('hashlib').sha256(sidecar_path.read_bytes()).hexdigest())
        self.assertEqual(sorted(sidecar['entries']), sorted(x['id'] for x in r6['entries']))
        for entry in r6['entries']:
            p = sidecar['entries'][entry['id']]
            self.assertEqual((p['transcription'], p['agreed'], p['transcriptionSha256']), ('webfetch_double_read', True, entry['sourceSha256']))
            self.assertIn(entry['value'], p['quote1'])


if __name__ == '__main__':
    unittest.main()
