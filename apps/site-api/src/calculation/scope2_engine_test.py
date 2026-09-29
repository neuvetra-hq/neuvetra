"""Scope 2 engine checks. Expected totals were computed separately with exact fractions from the
eGRID2023 rev2 cells named in each case (lb/MWh x 0.45359237, AR5 28/265) and the Green-e 2025 residual-mix
rates in the register. Run: python -m unittest scope2_engine_test"""
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

import scope2_engine as e

P = {'start': '2025-01-01', 'endExclusive': '2026-01-01'}
HERE = Path(__file__).resolve().parent
REF = HERE.parents[3] / 'packages/neuvetra-database/src/method-reference'
REG = json.loads((REF / 'verified-electricity-register-egrid2023-greene2025.json').read_text('utf-8'))
V = {x['id']: F(x['value']) for x in REG['entries']}
LB = F('0.45359237')
GWP = {'co2': 1, 'ch4': 28, 'n2o': 265}


def residual_co2e(mwh, sub: str) -> F:
    """Per-gas residual (decision amendment 2026-09-29), recomputed here from register values: each gas rounded to 12 dp of a kg."""
    gen, vol = V[f'residual_mix_green_e_2025.{sub}.net_generation_mwh'], V[f'residual_mix_green_e_2025.{sub}.voluntary_re_mwh']
    total = F(0)
    for gas, gwp in GWP.items():
        kg = F(mwh) * V[f'egrid2023.{sub}.{gas}'] * LB * gen / (gen - vol)
        total += F(round(kg * 10 ** 12), 10 ** 12) * gwp
    return total


def disp(q: F) -> str:
    return format((Decimal(q.numerator) / Decimal(q.denominator)).quantize(Decimal('0.0001'), rounding=ROUND_HALF_EVEN), '.4f')


def calc(**inp):
    return e.electricity(dict({'period': P, 'zip': '94105'}, **inp))


def eac(mwh, vintage=2025, kind='energy_attribute_certificate', technology='wind', **extra):
    return dict(type=kind, mwh=mwh, qualityCriteriaMet=True, vintageYear=vintage, evidenceReference='REC retirement 2025-001', generationTechnology=technology, **extra)


def totals(r):
    return tuple(x['total']['display'] if x['total'] else None for x in (r['locationBased'], r['marketBased']))


class LocationBased(unittest.TestCase):
    def test_camx_kwh(self):
        # 10 MWh x (428.464 + 0.025 x 28 + 0.003 x 265) lb/MWh (SRL23 W6, X6, Y6) x 0.45359237 = 1,950.2612181283
        r = calc(quantity='10000', unit='kWh', subregion='CAMX')
        self.assertEqual((r['locationBased']['status'], r['activity']['mwh'], r['locationBased']['total']['unrounded'], r['locationBased']['total']['display']),
                         ('complete', '10', '1950.2612181283', '1950.2612'))
        self.assertEqual([f['cell'] for f in r['factorsUsed'] if f['key'].startswith('egrid')], ['X6', 'W6', 'Y6'])

    def test_rfcw_mwh_with_decimals(self):
        # 250.5 MWh x (911.424 + 0.071 x 28 + 0.01 x 265) x 0.45359237 = 104,087.44277855847
        r = calc(quantity='250.5', unit='MWh', subregion='RFCW', zip='15222')
        self.assertEqual(r['locationBased']['total']['display'], '104087.4428')

    def test_refusals(self):
        for bad in (dict(quantity='1', unit='therm', subregion='CAMX'), dict(quantity='1', unit='kWh', subregion='XXXX'),
                    dict(quantity='1.2345', unit='kWh', subregion='CAMX'), dict(quantity='1', unit='kWh'), dict(quantity='1', unit='kWh', subregion='CAMX', zip='9410'),
                    dict(quantity='1', unit='kWh', subregion='CAMX', utilityEiaId='abc')):
            with self.assertRaises(e.Refused):
                calc(**bad)
        with self.assertRaises(e.Refused):
            e.electricity({'period': P, 'quantity': '1', 'unit': 'kWh', 'subregion': 'CAMX'})  # ZIP is required
        with self.assertRaises(e.Refused):
            calc(quantity='1', unit='kWh', subregion='CAMX', period={'start': '2026-01-01', 'endExclusive': '2026-02-01'})

    def test_impossible_calendar_dates_are_refused(self):
        # QA F05
        for start, end in (('2025-02-30', '2025-02-31'), ('2025-04-31', '2025-05-02'), ('2025-13-01', '2025-12-31')):
            with self.assertRaises(e.Refused) as ctx:
                calc(quantity='1', unit='kWh', subregion='CAMX', period={'start': start, 'endExclusive': end})
            self.assertEqual(ctx.exception.code, 'invalid_date')


class MarketBased(unittest.TestCase):
    def test_uncovered_consumption_uses_the_green_e_residual_mix_per_gas(self):
        # Review A05, decision amendment 2026-09-29: eGRID CAMX rates x 220,986,983 / (220,986,983 - 2,155,596) per gas, AR5
        r = calc(quantity='10000', unit='kWh', subregion='CAMX')
        self.assertEqual((r['status'], r['locationBased']['status'], r['marketBased']['status'], r['estimates'], sorted(r['marketBased']['gases'])),
                         ('complete', 'complete', 'complete', [], ['ch4', 'co2', 'n2o']))
        rm = r['marketBased']['residualMix']
        self.assertEqual((rm['netGenerationMwh'], rm['voluntaryReMwh'], rm['gases'], r['marketBased']['total']['display']),
                         ('220986983', '2155596', r['marketBased']['gases'], disp(residual_co2e(10, 'CAMX'))))
        self.assertEqual(r['marketBased']['total']['display'], '1969.4722')
        # Green-e's own published CAMX rate (434.2188489 lb/MWh, not loaded) would give 1,969.5836; the exact difference from the per-gas result is 0.1113 kg (about 0.006%).
        self.assertLess(abs(F(r['marketBased']['total']['unrounded']) - 10 * F('434.2188489') * LB), F('0.3'))

    def test_zero_emission_certificates_cover_part_of_the_load(self):
        # 4 MWh wind certificates at zero; the other 6 MWh at the CAMX residual mix
        r = calc(quantity='10', unit='MWh', subregion='CAMX', instruments=[eac('4')])
        self.assertEqual((r['activity']['instrumentMwh'], totals(r), r['marketBased']['status'], r['marketBased']['residualMix']['mwh']),
                         ('4', ('1950.2612', disp(residual_co2e(6, 'CAMX'))), 'complete', '6'))
        self.assertEqual(r['activity']['instruments'], [{'type': 'energy_attribute_certificate', 'mwh': '4', 'technology': 'wind', 'rateBasis': 'zero_emission_technology'}])

    def test_subregion_without_a_residual_rate_falls_back_as_provisional(self):
        saved = e.DATA['residual'].pop('CAMX')
        try:
            r = calc(quantity='10', unit='MWh', subregion='CAMX')
        finally:
            e.DATA['residual']['CAMX'] = saved
        self.assertEqual((r['marketBased']['status'], r['estimates'], totals(r)), ('provisional', ['residual_mix_unavailable_location_rate_provisional'], ('1950.2612', '1950.2612')))

    def test_full_zero_emission_coverage_is_complete(self):
        r = calc(quantity='10', unit='MWh', subregion='CAMX', instruments=[eac('6', technology='solar_photovoltaic'), eac('4', vintage=2024, kind='power_purchase_agreement', technology='hydro')])
        self.assertEqual((r['status'], totals(r), r['estimates']), ('complete', ('1950.2612', '0.0000'), ['vintage_outside_reporting_year']))

    def test_emitting_or_unknown_technology_needs_the_instrument_rate(self):
        # QA F07: a gas-fired PPA with no stated rate was counted at zero.
        for tech in ('natural_gas', 'geothermal', 'mixed', 'unknown'):
            for kind in ('energy_attribute_certificate', 'power_purchase_agreement', 'green_tariff'):
                r = calc(quantity='10', unit='MWh', subregion='CAMX', instruments=[eac('10', kind=kind, technology=tech)])
                self.assertEqual((r['locationBased']['status'], r['marketBased']['status'], totals(r), r['findings']),
                                 ('complete', 'input_needed', ('1950.2612', None), ['instrument_rate_required']))
        # With the PPA's stated rate: 10 MWh x (900 + 0.02 x 28 + 0.002 x 265) x 0.45359237 = 4,087.275486833
        r = calc(quantity='10', unit='MWh', subregion='CAMX', instruments=[eac('10', kind='power_purchase_agreement', technology='natural_gas', rateLbPerMwh={'co2': '900', 'ch4': '0.02', 'n2o': '0.002'})])
        self.assertEqual((r['status'], totals(r), r['activity']['instruments'][0]['rateBasis']), ('complete', ('1950.2612', '4087.2755'), 'instrument_rate'))

    def test_zero_rate_for_an_emitting_technology_needs_review(self):
        # v3 accounting review A01: only wind, solar PV, hydro and nuclear may count at zero, even with a stated rate.
        for tech in ('natural_gas', 'geothermal', 'coal', 'oil', 'mixed', 'unknown'):
            r = calc(quantity='10', unit='MWh', subregion='CAMX', instruments=[eac('10', kind='power_purchase_agreement', technology=tech, rateLbPerMwh={'co2': '0', 'ch4': '0', 'n2o': '0'})])
            self.assertEqual((r['locationBased']['status'], r['marketBased']['status'], totals(r), r['findings']),
                             ('complete', 'review_required', ('1950.2612', None), ['instrument_rate_contradicts_technology']))
        r = calc(quantity='10', unit='MWh', subregion='CAMX', instruments=[eac('10', technology='wind', rateLbPerMwh={'co2': '0', 'ch4': '0', 'n2o': '0'})])
        self.assertEqual((r['marketBased']['status'], r['marketBased']['total']['display']), ('complete', '0.0000'))

    def test_bioenergy_is_held(self):
        r = calc(quantity='10', unit='MWh', subregion='CAMX', instruments=[eac('10', technology='biomass', rateLbPerMwh={'co2': '0'})])
        self.assertEqual((r['marketBased']['status'], r['findings'], totals(r)), ('input_needed', ['bioenergy_instrument_not_supported'], ('1950.2612', None)))

    def test_supplier_rate_with_co2_only_uses_egrid_ch4_n2o(self):
        # 10 MWh x (500 + 0.025 x 28 + 0.003 x 265) x 0.45359237 = 2,274.7430559315
        r = calc(quantity='10', unit='MWh', subregion='CAMX', instruments=[eac('10', kind='supplier_specific_rate', technology='mixed', rateLbPerMwh={'co2': '500'})])
        self.assertEqual((r['marketBased']['total']['display'], r['estimates']), ('2274.7431', ['instrument_rate_ch4_n2o_from_egrid']))

    def test_overallocation_keeps_the_location_result(self):
        r = calc(quantity='10', unit='MWh', subregion='CAMX', instruments=[eac('11')])
        self.assertEqual((r['status'], r['locationBased']['status'], r['marketBased']['status'], totals(r), r['findings']),
                         ('review_required', 'complete', 'review_required', ('1950.2612', None), ['instrument_mwh_exceed_consumption']))

    def test_inadmissible_claims_hold_only_the_market_result(self):
        # Re-review P2-1: a well-formed but inadmissible claim never removes the location-based result.
        for bad, finding, status in ((dict(eac('1'), qualityCriteriaMet=False), 'instrument_quality_criteria_not_met', 'review_required'),
                                     (dict(eac('1'), vintageYear=2023), 'instrument_vintage_not_admissible', 'review_required'),
                                     (dict(eac('1'), evidenceReference=' '), 'instrument_evidence_required', 'input_needed')):
            r = calc(quantity='10', unit='MWh', subregion='CAMX', instruments=[bad])
            self.assertEqual((r['locationBased']['status'], r['marketBased']['status'], totals(r), r['findings'], r['activity']['instruments'][0]['rateBasis']),
                             ('complete', status, ('1950.2612', None), [finding], 'not_admissible'))

    def test_zero_technology_applies_to_every_instrument_type(self):
        # Review A06: wind, solar PV, hydro and nuclear count at zero for any instrument type, including supplier_specific_rate.
        for tech in ('wind', 'solar_photovoltaic', 'hydro', 'nuclear'):
            r = calc(quantity='10', unit='MWh', subregion='CAMX', instruments=[eac('10', kind='supplier_specific_rate', technology=tech)])
            self.assertEqual((r['marketBased']['status'], totals(r)[1], r['activity']['instruments'][0]['rateBasis']), ('complete', '0.0000', 'zero_emission_technology'))
        r = calc(quantity='10', unit='MWh', subregion='CAMX', instruments=[eac('10', kind='supplier_specific_rate', technology='mixed')])
        self.assertEqual((r['marketBased']['status'], r['findings'], r['activity']['instruments'][0]['rateBasis']), ('input_needed', ['instrument_rate_required'], 'not_calculated'))

    def test_stated_rate_takes_precedence_over_zero_technology(self):
        # FIELDS version 5 (v5 accounting review disclosure): a stated rate wins; CO2 alone takes CH4 and N2O from eGRID, flagged.
        cases = ((None, '0.0000', []), ({'co2': '0', 'ch4': '0', 'n2o': '0'}, '0.0000', []),
                 ({'co2': '0'}, '6.7812', ['instrument_rate_ch4_n2o_from_egrid']), ({'co2': '100', 'ch4': '0.1', 'n2o': '0.01'}, '478.3132', []))
        for rate, total, estimates in cases:
            r = calc(quantity='10', unit='MWh', subregion='CAMX', instruments=[eac('10', **({'rateLbPerMwh': rate} if rate else {}))])
            self.assertEqual((r['marketBased']['status'], totals(r)[1], r['estimates']), ('complete', total, estimates))

    def test_malformed_instruments_are_refused(self):
        for bad in (dict(eac('1'), type='offset'), dict(eac('1'), generationTechnology='fusion'), dict(eac('1'), qualityCriteriaMet='yes'),
                    dict(eac('1'), vintageYear='2025'), dict(eac('1'), vintageYear=True), dict(eac('1'), evidenceReference=None),
                    {k: v for k, v in eac('1').items() if k != 'generationTechnology'}, dict(eac('1'), mwh=5), dict(eac('1'), mwh=None),
                    eac('1', rateLbPerMwh={'co2': 900}), eac('1', rateLbPerMwh={'co2': '900', 'ch4': None}), eac('1', rateLbPerMwh=None)):
            with self.assertRaises(e.Refused):
                calc(quantity='10', unit='MWh', subregion='CAMX', instruments=[bad])

    def test_incomplete_instrument_values_hold_only_market_based(self):
        # Collection review C08: blank or non-decimal text is unknown, not malformed. Location-based is kept.
        location = calc(quantity='10', unit='MWh', subregion='CAMX')['locationBased']
        cases = ((dict(eac('4'), mwh=''), ['instrument_mwh_required']),
                 (dict(eac('4'), mwh='1.2345'), ['instrument_mwh_required']),
                 (eac('4', technology='natural_gas', rateLbPerMwh={'co2': '-1'}), ['instrument_rate_not_numeric']),
                 (eac('4', technology='natural_gas', rateLbPerMwh={'co2': '900', 'n2o': '0,01'}), ['instrument_rate_not_numeric']),
                 (dict(eac('4', vintage=2023), mwh='', qualityCriteriaMet=False, evidenceReference=''),
                  ['instrument_evidence_required', 'instrument_mwh_required', 'instrument_quality_criteria_not_met', 'instrument_vintage_not_admissible']))
        for instrument, findings in cases:
            r = calc(quantity='10', unit='MWh', subregion='CAMX', instruments=[instrument])
            self.assertEqual(r['locationBased'], location)
            m = r['marketBased']
            self.assertIn(m['status'], ('input_needed', 'review_required'))
            self.assertEqual((m['findings'], m['gases'], m['total'], m['residualMix']), (findings, None, None, None))
            self.assertEqual(r['activity']['instruments'][0]['rateBasis'], 'not_calculated')
            e.recompute(r)
        blank = calc(quantity='10', unit='MWh', subregion='CAMX', instruments=[dict(eac('4'), mwh='')])
        # Unknown is never zero: with one MWh unknown, the covered total is unknown too.
        self.assertEqual((blank['status'], blank['marketBased']['status'], blank['activity']['instrumentMwh'], blank['activity']['instruments'][0]['mwh']), ('input_needed', 'input_needed', None, None))
        both = calc(quantity='10', unit='MWh', subregion='CAMX', instruments=[eac('4'), dict(eac('4'), mwh='')])
        self.assertEqual(both['activity']['instrumentMwh'], None)
        # Every problem with one instrument is reported together, including a missing rate or bioenergy.
        gas = calc(quantity='10', unit='MWh', subregion='CAMX', instruments=[dict(eac('4', technology='natural_gas'), mwh='')])
        self.assertEqual(gas['marketBased']['findings'], ['instrument_mwh_required', 'instrument_rate_required'])
        bio = calc(quantity='10', unit='MWh', subregion='CAMX', instruments=[dict(eac('4', technology='biogas'), qualityCriteriaMet=False)])
        self.assertEqual(bio['marketBased']['findings'], ['bioenergy_instrument_not_supported', 'instrument_quality_criteria_not_met'])


class ZipLookup(unittest.TestCase):
    def test_single_and_multiple_subregions(self):
        self.assertEqual(e.lookup_zip('94105')['subregions'], ['CAMX'])
        multi = e.lookup_zip('07401')
        self.assertEqual((multi['subregions'], multi['needsUtilityChoice']), (['NYUP', 'RFCE'], True))
        self.assertFalse(e.lookup_zip('00000')['found'])
        with self.assertRaises(e.Refused):
            e.lookup_zip('9410')

    def test_subregion_that_does_not_serve_the_zip_needs_review(self):
        r = calc(quantity='1', unit='MWh', subregion='ERCT')
        self.assertEqual((r['status'], r['locationBased']['status'], r['marketBased']['status'], r['findings']),
                         ('review_required', 'review_required', 'review_required', ['subregion_not_listed_for_zip']))
        r = calc(quantity='1', unit='MWh', subregion='CAMX', zip='00000')
        self.assertEqual((r['locationBased']['status'], r['findings']), ('review_required', ['zip_not_in_lookup']))

    def test_multi_subregion_zip_needs_the_utility(self):
        # QA observation: 07401 is served by NYUP and RFCE utilities; the subregion alone is not evidence.
        r = calc(quantity='1', unit='MWh', subregion='RFCE', zip='07401')
        self.assertEqual((r['locationBased']['status'], r['marketBased']['status'], r['findings'], r['estimates']),
                         ('input_needed', 'input_needed', ['utility_required_for_multi_subregion_zip'], []))
        rows = e.lookup_zip('07401')['utilities']
        rfce = next(u['eiaId'] for u in rows if u['subregion'] == 'RFCE')
        nyup = next(u['eiaId'] for u in rows if u['subregion'] == 'NYUP' and u['eiaId'] not in {x['eiaId'] for x in rows if x['subregion'] == 'RFCE'})
        self.assertEqual(calc(quantity='1', unit='MWh', subregion='RFCE', zip='07401', utilityEiaId=rfce)['locationBased']['status'], 'complete')
        r = calc(quantity='1', unit='MWh', subregion='RFCE', zip='07401', utilityEiaId=nyup)
        self.assertEqual((r['locationBased']['status'], r['findings']), ('review_required', ['utility_not_listed_for_zip_and_subregion']))


class Aggregate(unittest.TestCase):
    def test_each_basis_summed_once_with_its_own_status(self):
        a = e.aggregate([calc(quantity='10', unit='MWh', subregion='CAMX', instruments=[eac('10')]), calc(quantity='250.5', unit='MWh', subregion='RFCW', zip='15222'),
                         calc(quantity='10', unit='MWh', subregion='CAMX', instruments=[eac('11')])])
        # location: 1,950.2612181283 + 104,087.44277855847 + 1,950.2612181283 = 107,987.96521481507; market: 0 + RFCW residual mix; the third is held
        self.assertEqual((a['locationBasedSubtotal']['display'], a['locationBasedComplete'], a['marketBasedSubtotal']['display'], len(a['marketBasedNotCalculated']),
                          len(a['marketBasedProvisional']), a['marketBasedComplete']), ('107987.9652', True, disp(residual_co2e(F('250.5'), 'RFCW')), 1, 0, False))

    def test_tampered_or_forged_results_refused(self):
        r = calc(quantity='10', unit='MWh', subregion='CAMX')
        r['locationBased']['total']['unrounded'] = '1'
        with self.assertRaises(e.Refused):
            e.aggregate([r])
        r = calc(quantity='10', unit='MWh', subregion='CAMX')
        body = {k: v for k, v in r.items() if k != 'resultSha256'}
        body['marketBased'] = dict(body['marketBased'], total=dict(body['marketBased']['total'], unrounded='1'))
        with self.assertRaises(e.Refused):
            e.aggregate([dict(body, resultSha256=e.digest(body))])

    def test_empty_is_not_complete(self):
        a = e.aggregate([])
        self.assertEqual((a['locationBasedComplete'], a['marketBasedComplete'], a['resultCount']), (False, False, 0))


class DataIntegrity(unittest.TestCase):
    def test_describe_matches_register_and_all_27_subregions(self):
        reg = REG
        hub = {x['id']: x['value'] for x in json.loads((REF / 'verified-factor-register-2025.json').read_text('utf-8'))['entries']}
        egrid = {x['id']: x['value'] for x in json.loads((REF / 'verified-electricity-register-egrid2023.json').read_text('utf-8'))['entries']}
        m = e.describe()['methods'][0]
        self.assertEqual((len(m['factorKeys']), len(e.DATA['subregions']), len(e.DATA['residual'])), (138, 27, 27))
        self.assertEqual({k: v for k, v in m['factorValues'].items() if not k.startswith('residual_mix_')}, egrid)  # eGRID part unchanged
        self.assertEqual(m['constantValues'], {'kwh_to_mwh': {'value': '0.001', 'unit': 'MWh per kWh'}, 'lb_to_kg': {'value': '0.45359237', 'unit': 'kg per lb'}})
        for x in reg['entries']:
            self.assertEqual(m['factorValues'][x['id']], x['value'])
            if x['id'].startswith('gwp_ar5.'):
                self.assertEqual(x['value'], hub[x['id']])  # GWPs identical to the verified Hub register

    def test_engine_refuses_changed_data(self):
        for name, old, new in (('verified-electricity-register-egrid2023-greene2025.json', '"220986983"', '"220986984"'), ('verified-electricity-register-egrid2023-greene2025.json', '"428.464"', '"428.465"'), ('egrid2023-zip-subregion-utility.csv', '94105,CA', '94105,NV')):
            with tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                (root / 'apps/site-api/src/calculation').mkdir(parents=True)
                shutil.copytree(REF, root / 'packages/neuvetra-database/src/method-reference')
                shutil.copy(HERE / 'scope2_engine.py', root / 'apps/site-api/src/calculation/scope2_engine.py')
                target = root / 'packages/neuvetra-database/src/method-reference' / name
                text = target.read_bytes().decode('utf-8')
                self.assertIn(old, text)
                target.write_bytes(text.replace(old, new, 1).encode('utf-8'))
                p = subprocess.run([sys.executable, str(root / 'apps/site-api/src/calculation/scope2_engine.py')], input=b'{"action":"describe"}', capture_output=True, env={**os.environ})
                self.assertEqual((p.returncode, json.loads(p.stdout)['status']), (2, 'error'))

    def test_cli(self):
        p = subprocess.run([sys.executable, str(HERE / 'scope2_engine.py')], input=json.dumps({'action': 'lookup_zip', 'zip': '94105'}).encode(), capture_output=True)
        self.assertEqual((p.returncode, json.loads(p.stdout)['lookup']['subregions']), (0, ['CAMX']))


if __name__ == '__main__':
    unittest.main()
