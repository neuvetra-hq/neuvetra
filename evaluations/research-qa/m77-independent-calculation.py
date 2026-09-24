"""Independent offline review; no persistence/evidence-release acceptance."""
import copy
import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('m77_review_subject', ROOT / 'apps/site-api/src/calculation/m77_fugitive.py')
subject = importlib.util.module_from_spec(spec)
spec.loader.exec_module(subject)


def workpaper():
    return {
        'year': 2025, 'asset_id': 'FICTIONAL-UNIT-77', 'gas': 'HFC-134a',
        'equipment': 'fixed_refrigeration', 'unit': 'kg',
        'opening_date': '2025-01-01', 'closing_date': '2025-12-31',
        'opening_capacity': '8.250000', 'closing_capacity': '8.25',
        'declarations': {k: True for k in (
            'full_year_operational_control', 'california_office_or_distribution',
            'no_installation_retirement_or_retrofit', 'no_stocks_recovery_reuse_or_transfer',
            'complete_all_provider_service_records', 'all_known_releases_recorded',
            'opening_full_charge_verified', 'closing_full_charge_verified')},
        'evidence': {k: 'DOC-' + str(i) for i, k in enumerate((
            'asset_identity', 'capacity', 'opening_full_charge', 'closing_full_charge', 'annual_contractor_record'))},
        'refills': [{'id': 'VISIT-A', 'date': '2025-11-05', 'kg': '1.000000',
                    'contractor': 'CONTRACTOR-A', 'reference': 'ANNUAL-VISIT-A'}],
        'releases': [], 'zero_activity_evidence': None,
        'uncertainty': 'Fictional complete contractor evidence; quantity precision does not establish measurement accuracy.',
    }


class IndependentCalculation(unittest.TestCase):
    def refuses(self, v):
        with self.assertRaises(subject.UnsupportedFugitiveInput):
            subject.calculate(v)

    def test_service_consumption_includes_escape(self):
        # Source record: .9 retained + .1 servicing escape = 1 used.
        # Calculator cannot verify this decomposition; caller supplies total PS.
        v = workpaper()
        r = subject.calculate(v)
        self.assertEqual(r['estimated_emitted_kg'], '1')
        self.assertEqual(r['kg_co2e_exact'], '1300')
        self.assertFalse(r['evidence_verified'])
        self.assertEqual(r['status'], 'candidate_method_estimate')
        v['refills'][0]['retained_kg'] = '.9'
        self.refuses(v)  # An unsupported alternate quantity field cannot redefine PS.

    def test_source_pins_and_independent_quantities(self):
        for gas, device, mass, factor, exact, locator in [
            ('R-410A', 'fixed_hvac', '0.03125', '1924', '60.125', 'D575'),
            ('HFC-134a', 'fixed_refrigeration', '0.03125', '1300', '40.625', 'E532'),
            ('HFC-227ea', 'fixed_fire_suppression', '0.03125', '3350', '104.6875', 'E538'),
            ('HFC-227ea', 'portable_fire_suppression', '0.03125', '3350', '104.6875', 'E538'),
        ]:
            v = workpaper(); v.update(gas=gas, equipment=device)
            v['refills'][0]['kg'] = mass
            r = subject.calculate(v)
            self.assertEqual((r['gwp'], r['kg_co2e_exact']), (factor, exact))
            self.assertEqual(r['factor_locator'], 'Emission Factors Hub!' + locator)
            self.assertEqual(r['factor_source_sha256'], '43afb91d79b2ae765b3a447549d9e1021a144a407cec5eb804be9fcf69a668a7')
            self.assertEqual(r['guidance_sha256'], 'fb3dd5c9677096094c2acef769c7fe2fb90def6feac403cf9c817f5810928d88')

    def test_known_discharge_not_added_and_chronology(self):
        v = workpaper()
        v['releases'] = [{'id': 'DISCHARGE-A', 'date': '2025-11-05', 'kg': '.5',
            'evidence': 'DISCHARGE-DOC', 'refill_id': 'VISIT-A', 'preceded_refill_verified': True}]
        v['releases'][0]['kg'] = '0.5'
        self.assertEqual(subject.calculate(v)['kg_co2e_exact'], '1300')
        for key, bad in [('preceded_refill_verified', False), ('preceded_refill_verified', 1),
                         ('date', '2025-11-06'), ('refill_id', 'ABSENT'), ('date', '2025-02-29')]:
            changed = copy.deepcopy(v); changed['releases'][0][key] = bad
            self.refuses(changed)
        v['releases'].append(dict(v['releases'][0], id='DISCHARGE-B', evidence='SECOND-DOC', kg='0.500001'))
        self.refuses(v)

    def test_zero_needs_explicit_evidence_and_all_eligibility(self):
        v = workpaper(); v['refills'] = []
        self.refuses(v)
        v['zero_activity_evidence'] = 'ZERO-ANNUAL-ATTESTATION'
        self.assertEqual(subject.calculate(v)['kg_co2e_exact'], '0')
        for key in v['declarations']:
            for bad in (False, 1, 'true', None):
                changed = copy.deepcopy(v); changed['declarations'][key] = bad
                self.refuses(changed)
        v['closing_capacity'] = '8.249999'
        self.refuses(v)

    def test_mass_precision_and_half_even(self):
        v = workpaper(); v.update(gas='HFC-227ea', equipment='portable_fire_suppression')
        for mass, exact, display in [('0.000001','0.00335','0.0034'), ('0.000003','0.01005','0.0100'),
                                     ('999999.999999','3349999999.99665','3349999999.9966')]:
            v['refills'][0]['kg'] = mass
            r = subject.calculate(v)
            self.assertEqual((r['kg_co2e_exact'], r['kg_co2e_display']), (exact, display))
        for bad in ('1000000', '0.0000001', '1e-6', '-0', '00.1', 'NaN', '１', 1, True):
            v['refills'][0]['kg'] = bad
            self.refuses(v)

    def test_caps_and_identity_overlap(self):
        v = workpaper()
        v['refills'] = [dict(v['refills'][0], id='VISIT-' + str(i), reference='REF-' + str(i), kg='0.01') for i in range(100)]
        self.assertEqual(subject.calculate(v)['estimated_emitted_kg'], '1')
        v['refills'].append(dict(v['refills'][0], id='EXTRA', reference='EXTRA'))
        self.refuses(v)
        v = workpaper(); v['refills'].append(dict(v['refills'][0], id='NEW-ID'))
        self.refuses(v)
        v = workpaper(); v['releases'] = [{'id': 'VISIT-A', 'date': '2025-11-04', 'kg':'0.1',
            'evidence':'LOSS-DOC', 'refill_id':'VISIT-A', 'preceded_refill_verified':True}]
        self.refuses(v)

    def test_unsupported_and_forged_input(self):
        for key, bad in [('gas','HFC-32'), ('equipment','mobile_refrigeration'), ('unit','lb'),
                         ('year',True), ('opening_capacity','0'), ('opening_date','2025-01-02')]:
            v = workpaper(); v[key] = bad
            self.refuses(v)
        for key in ('gwp', 'method', 'factor_locator', 'offset_kg'):
            v = workpaper(); v[key] = '0'
            self.refuses(v)

    def test_nonmutation_reordering_and_changed_activity(self):
        v = workpaper(); before = copy.deepcopy(v)
        r = subject.calculate(v)
        self.assertEqual(v, before)
        self.assertEqual(r, subject.calculate(dict(reversed(list(v.items())))))
        v['refills'][0]['kg'] = '1.000001'
        self.assertEqual(subject.calculate(v)['kg_co2e_exact'], '1300.0013')


if __name__ == '__main__':
    unittest.main()
