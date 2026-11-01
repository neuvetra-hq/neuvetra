"""Round 3, lane A (ROUND3.md owner decisions 2 and 3; AC-6, AC-7, AC-9, AC-10; DESIGN 13.8 engine comment).

Expected values are independent exact arithmetic (fractions.Fraction) on PRINTED source values: the committed transcription
file tools/method-reference/sources/us-upstream-transcriptions-3.json (NPC 2011 Table 7, Abrahams et al. 2015 Table S7, EPA
GHGI / EIA MER for F_COAL), the eGRID2023 cells of R3 and the Hub 2025 GWP cells of R3, and exact unit definitions
(1 lb = 0.45359237 kg; 1 MMBtu = 1055.05585262 MJ). Never engine output.

Decision 2: every upstream electricity line with coal heat input carries a memo (outside totals) of the omitted coal mining
energy and transport CO2 as a screening range: low = coal MMBtu x 5.0 lb CO2e/MMBtu x 0.45359237; high = coal MMBtu x
(12.2 g CO2e/MJ x 1055.05585262 / 1000 - F_COAL). Decision 3: a sold greenhouse-gas product memos the charge left at end of
life, units x charge x (1 - use release %) x GWP, as an upper bound outside totals. Figures (totals) never move.
"""
import json
import unittest
from decimal import Decimal
from fractions import Fraction
from pathlib import Path

import scope3_engine as e

ROOT = Path(__file__).resolve().parents[4]
SOURCES = ROOT / 'tools/method-reference/sources'
REF = ROOT / 'packages/neuvetra-database/src/method-reference'
R3 = json.loads((REF / 'verified-scope3-supplement-register-2025.json').read_text('utf-8'))
R5 = json.loads((REF / 'verified-scope3-us-upstream-register-2025.json').read_text('utf-8'))
R1 = json.loads((REF / 'verified-scope3-register-2025.json').read_text('utf-8'))
T3 = {v['id']: v for v in json.loads((SOURCES / 'us-upstream-transcriptions-3.json').read_text('utf-8'))['values']}
NAMES = ('us-upstream-transcriptions.json', 'us-upstream-transcriptions-2.json', 'us-upstream-transcriptions-3.json')
T = {v['id']: v for name in NAMES for v in json.loads((SOURCES / name).read_text('utf-8'))['values']}
P = {'start': '2025-01-01', 'endExclusive': '2026-01-01'}
NPC, CMU = 'coal_upstream.npc2011.us_average.upstream_combustion', 'coal_upstream.abrahams2015_cmu.us_average'
LOW, HIGH = 'coal_upstream_omitted_screening_low', 'coal_upstream_omitted_screening_high'
RANGE_NOTE, AR5_NOTE, SOLAR_NOTE = 'coal_upstream_omitted_screening_range_memo', 'upstream_gwp_ar5_coal_mine_methane', 'solar_thermal_cofiring_upstream_not_counted'
EOL = 'ghg_product_end_of_life_remaining_charge'


def F(text) -> Fraction:
    return Fraction(Decimal(str(text)))


def printed(tid: str) -> Fraction:
    assert T[tid]['agreed'] is True, tid
    return F(T[tid]['value'].replace(',', ''))


def round12(q: Fraction) -> Fraction:
    return Fraction(round(q * 10 ** 12), 10 ** 12)


def r3(key: str) -> Fraction:
    return F(next(x['value'] for x in R3['entries'] if x['id'] == key))


def total(r) -> Fraction:
    return F(r['total']['unrounded'])


def memo(r) -> dict:
    return {m['code']: F(m['kg']) for m in r.get('memoItems') or []}


def calc(kind, inp):
    return e.calculate({'kind': kind, 'input': inp})


KG_PER_LB = Fraction(45359237, 10 ** 8)            # exact international avoirdupois pound
MJ_PER_MMBTU = Fraction(105505585262, 10 ** 8)     # International Table Btu = 1055.05585262 J
F_COAL = round12(printed('epa_ghgi.2022.coal_mining_ch4_total') * 10 ** 9
                 / (printed('eia.2022.coal_production_short_tons') * 1000 * printed('eia.2022.coal_heat_content_production')))
F_GAS = printed('netl2024_4862.ng_upstream.prod_through_transmission') * MJ_PER_MMBTU / 1000
F_OIL = round12((printed('cagreet3_lut2018.ulsd.total') - printed('cagreet3_lut2018.ulsd.tailpipe')) * printed('carb_lcfs.energy_density.ulsd') / 1000
                / r3('hub2025_t1.distillate_fuel_oil_no_2.heat_content'))
MAPPED = {'COAL': F_COAL, 'GAS': F_GAS, 'OIL': F_OIL}
LOW_PER_MMBTU = printed(NPC) * KG_PER_LB                           # 5.0 lb x 0.45359237 = 2.267961850 kg CO2e/MMBtu
HIGH_PER_MMBTU = printed(CMU) * MJ_PER_MMBTU / 1000 - F_COAL       # 12.871681401964 - 3.650822140444 = 9.22085926152


def region(s: str) -> dict:
    hi = {x['id'].rsplit('.', 1)[1]: F(x['value']) for x in R3['entries'] if x['id'].startswith(f'egrid2023_hi.{s}.')}
    gen = r3(f'egrid2023_gen.{s}')
    return {'u': sum((round12(hi[k] / gen) * f for k, f in MAPPED.items() if k in hi), Fraction(0)),
            'coal': round12(hi['COAL'] / gen) if hi.get('COAL') else Fraction(0),
            'solar': round12(hi['SOLAR'] / gen) if hi.get('SOLAR') else None}


class ScreeningInputs(unittest.TestCase):
    def test_the_two_printed_cross_check_values_and_the_per_mmbtu_range(self):
        self.assertEqual((T3[NPC]['value'], T3[CMU]['value'], T3[NPC]['agreed'], T3[CMU]['agreed']), ('5.0', '12.2', True, True))
        self.assertEqual(LOW_PER_MMBTU, F('2.26796185'))
        self.assertEqual(printed(CMU) * MJ_PER_MMBTU / 1000, F('12.871681401964'))
        self.assertEqual(HIGH_PER_MMBTU, F('9.22085926152'))
        self.assertLess(LOW_PER_MMBTU, HIGH_PER_MMBTU)

    def test_r5_registers_both_as_screening_only_entries_with_both_quotes(self):
        by = {x['id']: x for x in R5['entries']}
        for tid, value in ((NPC, '5.0'), (CMU, '12.2')):
            x = by[tid]
            self.assertEqual((x['value'], x['sheet']), (value, T3[tid]['url']), tid)
            self.assertEqual(x['labelCells'], ['quote1: ' + T3[tid]['quote1'], 'quote2: ' + T3[tid]['quote2']], tid)
            self.assertIn('screening', x['label'].lower(), tid)
            self.assertIn('[transcription: webfetch_double_read; us-upstream-transcriptions-3.json id ' + tid + ']', x['valueCell'])
        self.assertIn('AR4', by[NPC]['unit'])
        self.assertIn('not stated', by[NPC]['unit'])
        self.assertIn('not an IPCC', by[CMU]['unit'])


class CoalScreeningMemo(unittest.TestCase):
    def check_line(self, r, mwh: Fraction, s: str):
        x = region(s)
        self.assertEqual(r['status'], 'complete')
        self.assertEqual(total(r), mwh * x['u'])  # the figure never moves
        coal_mmbtu = mwh * x['coal']
        self.assertEqual(F(r['activity']['coalHeatInputMmbtu']), coal_mmbtu)
        self.assertEqual(memo(r), {LOW: coal_mmbtu * LOW_PER_MMBTU, HIGH: coal_mmbtu * HIGH_PER_MMBTU})
        self.assertTrue(all(m['reportedSeparately'] is True and m['unit'] == 'kg CO2e' for m in r['memoItems']))
        self.assertTrue({RANGE_NOTE, AR5_NOTE, 'coal_upstream_mine_methane_only'} <= set(r['boundary']['notes']))
        self.assertTrue({NPC, CMU} <= {f['key'] for f in r['factorsUsed']})
        self.assertIn('lb_to_kg', {c['id'] for c in r['constantsUsed']})
        self.assertEqual(r['activity']['gwpBasisByFuel']['COAL'], 'IPCC AR5 100-year (EPA GHGI coal mine methane)')

    def test_camx_3b(self):
        r = calc('electricity_upstream', {'period': P, 'quantity': '1234.5', 'unit': 'MWh', 'subregion': 'CAMX', 'zip': '94105'})
        self.check_line(r, F('1234.5'), 'CAMX')
        self.assertEqual(r['activity']['gwpBasisByFuel'], {'COAL': 'IPCC AR5 100-year (EPA GHGI coal mine methane)', 'GAS': 'IPCC AR6 100-year (NETL, as published)',
                                                         'OIL': 'IPCC AR4 100-year, inferred (CA-GREET3.0; CARB states none)'})

    def test_srmw_3b_in_kwh(self):
        r = calc('electricity_upstream', {'period': P, 'quantity': '250000', 'unit': 'kWh', 'subregion': 'SRMW', 'zip': '63101'})
        self.check_line(r, F('250'), 'SRMW')

    def test_ercot_3c_upstream_uses_the_loss_mwh(self):
        r = calc('td_losses_upstream', {'period': P, 'quantity': '1000', 'unit': 'MWh', 'subregion': 'ERCT', 'zip': '75201'})
        ggl = F(next(x['value'] for x in R1['entries'] if x['id'] == 'egrid2023_ggl.ercot'))  # eGRID2023 GGL23 F (ERCOT 0.042)
        self.assertEqual(ggl, F('0.042'))
        self.check_line(r, round12(1000 * ggl / (1 - ggl)), 'ERCT')

    def test_us_average_3d_upstream(self):
        r = calc('energy_resold_upstream', {'period': P, 'quantity': '500', 'unit': 'MWh', 'gridBasis': 'us_average', 'zip': None, 'subregion': None, 'utilityEiaId': None})
        self.check_line(r, F('500'), 'US')

    def test_a_region_without_coal_has_no_memo_and_no_coal_notes(self):
        r = calc('electricity_upstream', {'period': P, 'quantity': '100', 'unit': 'MWh', 'subregion': 'NYCW', 'zip': '10001'})
        self.assertEqual(r['status'], 'complete')
        self.assertNotIn('memoItems', r)
        self.assertFalse({RANGE_NOTE, AR5_NOTE} & set(r['boundary']['notes']))
        self.assertNotIn('COAL', r['activity']['gwpBasisByFuel'])
        self.assertNotIn(NPC, {f['key'] for f in r['factorsUsed']})

    def test_the_category_profile_sums_the_range(self):
        a = calc('electricity_upstream', {'period': P, 'quantity': '1234.5', 'unit': 'MWh', 'subregion': 'CAMX', 'zip': '94105'})
        b = calc('td_losses_upstream', {'period': P, 'quantity': '1000', 'unit': 'MWh', 'subregion': 'ERCT', 'zip': '75201'})
        agg = e.aggregate([a, b])
        got = {k: F(v['unrounded']) for k, v in agg['categoryProfiles']['3']['memoItems'].items()}
        self.assertEqual(got, {LOW: memo(a)[LOW] + memo(b)[LOW], HIGH: memo(a)[HIGH] + memo(b)[HIGH]})
        self.assertEqual(F(agg['categorySubtotals']['3']['unrounded']), total(a) + total(b))  # memos never in the subtotal


class GwpSolarAndQuality(unittest.TestCase):
    def test_solar_thermal_cofiring_is_memoed_and_disclosed(self):
        r = calc('electricity_upstream', {'period': P, 'quantity': '1234.5', 'unit': 'MWh', 'subregion': 'CAMX', 'zip': '94105'})
        x = region('CAMX')
        self.assertEqual(F(r['activity']['solarThermalHeatInputMmbtu']), F('1234.5') * x['solar'])
        self.assertIn(SOLAR_NOTE, r['boundary']['notes'])
        self.assertEqual(r['boundary']['minimumBoundary'], 'partial')
        n = calc('electricity_upstream', {'period': P, 'quantity': '100', 'unit': 'MWh', 'subregion': 'NYCW', 'zip': '10001'})
        self.assertIsNone(n['activity']['solarThermalHeatInputMmbtu'])
        self.assertNotIn(SOLAR_NOTE, n['boundary']['notes'])

    def test_every_solar_region_also_burns_coal_so_no_category_status_moves(self):
        solar = {x['id'].split('.')[1] for x in R3['entries'] if x['id'].startswith('egrid2023_hi.') and x['id'].endswith('.SOLAR') and F(x['value']) > 0}
        coal = {x['id'].split('.')[1] for x in R3['entries'] if x['id'].startswith('egrid2023_hi.') and x['id'].endswith('.COAL') and F(x['value']) > 0}
        self.assertTrue(solar and solar <= coal)

    def test_coal_geography_is_good_for_a_national_factor(self):
        r = calc('electricity_upstream', {'period': P, 'quantity': '100', 'unit': 'MWh', 'subregion': 'SRMW', 'zip': '63101'})
        self.assertEqual(e.default_data_quality(r)['indicators'],
                         {'technological': 'fair', 'temporal': 'good', 'geographical': 'good', 'completeness': 'poor', 'reliability': 'good'})


class EndOfLifeCharge(unittest.TestCase):
    def test_r410a_in_kg(self):
        # C4-179 shape: 5,000 units x 2.6 kg R-410A, 2.5% released during use; Hub 2025 Table 12 R-410A GWP (D575) 1924.
        r = calc('sold_ghg_product', {'period': P, 'quantity': '5000', 'gas': 'R-410A', 'chargePerUnit': '2.6', 'chargeUnit': 'kg', 'useReleasePercent': '2.5'})
        gwp = r3('hub2025_gwp.R-410A')
        self.assertEqual(gwp, 1924)
        self.assertEqual(total(r), 5000 * F('2.6') * F('2.5') / 100 * gwp)  # unchanged
        self.assertEqual(memo(r), {EOL: 5000 * F('2.6') * (100 - F('2.5')) / 100 * gwp})
        self.assertEqual(memo(r)[EOL], 24386700)
        self.assertIn('end_of_life_remaining_charge_memo_upper_bound', r['boundary']['notes'])
        self.assertEqual(F(r['activity']['remainingAtEndOfLifeKg']), 5000 * F('2.6') * F('97.5') / 100)

    def test_hfc134a_in_lb(self):
        r = calc('sold_ghg_product', {'period': P, 'quantity': '12000', 'gas': 'HFC-134a', 'chargePerUnit': '0.55', 'chargeUnit': 'lb', 'useReleasePercent': '10'})
        gwp = r3('hub2025_gwp.HFC-134a')
        self.assertEqual(gwp, 1300)
        self.assertEqual(memo(r), {EOL: 12000 * F('0.55') * KG_PER_LB * F('90') / 100 * gwp})
        self.assertEqual(total(r), 12000 * F('0.55') * KG_PER_LB * F('10') / 100 * gwp)

    def test_all_released_during_use_leaves_a_stated_zero(self):
        r = calc('sold_ghg_product', {'period': P, 'quantity': '10', 'gas': 'HFC-134a', 'chargePerUnit': '1', 'chargeUnit': 'kg', 'useReleasePercent': '100'})
        self.assertEqual(memo(r), {EOL: 0})


class LayerAndComment(unittest.TestCase):
    def test_natural_gas_use_unknown_is_an_engine_hold_with_a_trace(self):
        r = calc('building_average', {'period': P, 'category': 8, 'cbecsActivity': 'food_service', 'usesNaturalGas': 'unknown', 'area': '2500', 'areaUnit': 'sqft',
                                      'coveredDays': 365, 'gridBasis': 'subregion', 'zip': '94105', 'subregion': 'CAMX', 'utilityEiaId': None})
        self.assertEqual((r['status'], r['findings'], r['total']), ('input_needed', ['natural_gas_use_unknown'], None))
        self.assertTrue(r['resultSha256'] and r['inputSha256'])

    def test_the_engine_cap_comment_no_longer_claims_the_0030_text_limit(self):
        src = (Path(e.__file__)).read_text('utf-8')
        line = next(i for i, text in enumerate(src.splitlines()) if text.startswith('MAX_REQUEST_BYTES'))
        comment = '\n'.join(src.splitlines()[max(0, line - 8):line])
        self.assertNotIn('and the 0030 report', comment)  # round 2b's claim (64 MiB = the 0030 text limit) is no longer true
        self.assertIn('128 MiB', comment)


if __name__ == '__main__':
    unittest.main()
