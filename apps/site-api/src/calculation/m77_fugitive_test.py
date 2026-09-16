"""Offline author checks, not evidence of persistence or a released method."""
import copy
import unittest
from m77_fugitive import calculate, UnsupportedFugitiveInput, DECLARATIONS, EVIDENCE


def fixture(gas='R-410A', equipment='fixed_hvac', masses=('1.25', '0.75')):
    return {
        'year': 2025, 'asset_id': 'SYNTHETIC-HVAC-01', 'gas': gas,
        'equipment': equipment, 'unit': 'kg', 'opening_date': '2025-01-01',
        'closing_date': '2025-12-31', 'opening_capacity': '10', 'closing_capacity': '10.000000',
        'declarations': {key: True for key in DECLARATIONS},
        'evidence': {key: 'SYNTHETIC-' + key.upper() for key in EVIDENCE},
        'refills': [{'id': f'SERVICE-{i}', 'date': '2025-06-20', 'kg': mass,
                    'contractor': 'SYNTHETIC-CONTRACTOR', 'reference': f'SERVICE-REF-{i}'}
                   for i, mass in enumerate(masses)],
        'releases': [], 'zero_activity_evidence': None if masses else 'SYNTHETIC-ZERO',
        'uncertainty': 'Synthetic contractor and full-charge records; method timing and measurement uncertainty remains.',
    }


class FugitiveCandidateTests(unittest.TestCase):
    def test_source_factor_cases(self):
        for gas, device, masses, exact, display in [
            ('R-410A', 'fixed_hvac', ('1.25', '0.75'), '3848', '3848.0000'),
            ('HFC-134a', 'fixed_refrigeration', ('0.125',), '162.5', '162.5000'),
            ('HFC-227ea', 'fixed_fire_suppression', ('2.5',), '8375', '8375.0000'),
            ('HFC-227ea', 'portable_fire_suppression', ('0.000001',), '0.00335', '0.0034'),
            ('HFC-227ea', 'fixed_fire_suppression', ('0.000003',), '0.01005', '0.0100'),
        ]:
            with self.subTest(gas=gas, masses=masses):
                result = calculate(fixture(gas, device, masses))
                self.assertEqual((result['kg_co2e_exact'], result['kg_co2e_display']), (exact, display))
                self.assertFalse(result['evidence_verified'])
                self.assertEqual(result['status'], 'candidate_method_estimate')

    def test_known_discharge_is_counted_once(self):
        v = fixture(masses=('1',))
        v['releases'] = [{'id': 'LEAK-1', 'date': '2025-06-19', 'kg': '1',
                          'evidence': 'LEAK-REF-1', 'refill_id': 'SERVICE-0', 'preceded_refill_verified': True}]
        self.assertEqual(calculate(v)['kg_co2e_exact'], '1924')
        v['releases'][0]['kg'] = '1.000001'
        with self.assertRaises(UnsupportedFugitiveInput):
            calculate(v)

    def test_explicit_zero_only(self):
        v = fixture(masses=())
        self.assertEqual(calculate(v)['kg_co2e_display'], '0.0000')
        v['zero_activity_evidence'] = None
        with self.assertRaises(UnsupportedFugitiveInput):
            calculate(v)

    def test_each_admission_is_required(self):
        for key in DECLARATIONS:
            for bad in [False, 1, 'true', None]:
                v = fixture()
                v['declarations'][key] = bad
                with self.subTest(key=key, value=bad), self.assertRaises(UnsupportedFugitiveInput):
                    calculate(v)

    def test_noncanonical_or_unsupported_input(self):
        edits = [('gas', 'R-22'), ('equipment', 'mobile_ac'), ('year', True), ('year', 2026),
                 ('unit', 'lb'), ('opening_capacity', '0'), ('closing_capacity', '11'),
                 ('opening_date', '2025-01-02'), ('closing_date', '2025-12-30'),
                 ('uncertainty', ''), ('asset_id', 'asset 01'), ('gas', ['R-410A'])]
        for key, bad in edits:
            v = fixture()
            v[key] = bad
            with self.subTest(key=key), self.assertRaises(UnsupportedFugitiveInput):
                calculate(v)
        for bad in [1, True, -1, '-0', '01', '.1', '1e1', 'NaN', 'Infinity', '1,000',
                    ' 1', '1 ', '1.0000001', '1000000', '', None, '1\n']:
            v = fixture(masses=(bad,))
            with self.subTest(mass=bad), self.assertRaises(UnsupportedFugitiveInput):
                calculate(v)

    def test_exact_keys_and_reordering(self):
        v = fixture()
        self.assertEqual(calculate(v), calculate(dict(reversed(list(v.items())))))
        for key in list(v):
            changed = copy.deepcopy(v)
            del changed[key]
            with self.subTest(missing=key), self.assertRaises(UnsupportedFugitiveInput):
                calculate(changed)
        v['gwp'] = 0
        with self.assertRaises(UnsupportedFugitiveInput):
            calculate(v)

    def test_duplicate_and_date_failures(self):
        for key, bad in [('id', 'SERVICE-0'), ('reference', 'SERVICE-REF-0'),
                         ('date', '2025-02-29'), ('date', '2024-12-31')]:
            v = fixture()
            v['refills'][1][key] = bad
            with self.subTest(key=key, bad=bad), self.assertRaises(UnsupportedFugitiveInput):
                calculate(v)

    def test_maximum_is_exact_and_nonmutating(self):
        v = fixture('HFC-227ea', 'fixed_fire_suppression', ('999999.999999',) * 100)
        before = copy.deepcopy(v)
        result = calculate(v)
        self.assertEqual(result['estimated_emitted_kg'], '99999999.9999')
        self.assertEqual(result['kg_co2e_exact'], '334999999999.665')
        self.assertEqual(v, before)
        v['refills'].append(copy.deepcopy(v['refills'][0]))
        with self.assertRaises(UnsupportedFugitiveInput):
            calculate(v)


if __name__ == '__main__':
    unittest.main()
