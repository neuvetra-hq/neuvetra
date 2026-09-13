import copy
import unittest

import location_based_electricity as engine


ACTIVITY = {
    "asset_id": "Synthetic California office 001",
    "boundary": "Purchased electricity consumed by the reporting company",
    "geography": {"country": "United States", "state": "California", "egrid_subregion": "CAMX"},
    "reporting_period": {"start": "2023-01-01", "end": "2023-12-31"},
    "electricity": "Grid-delivered purchased electricity",
    "quantity": "1",
    "unit": "MWh",
}


class LocationBasedElectricityTests(unittest.TestCase):
    def test_exact_published_total_and_explicit_component_delta(self):
        record = engine.calculate(ACTIVITY)
        self.assertEqual(record["total"]["unrounded"], "195.0402888")
        self.assertEqual(record["total"]["display"], "195.0403")
        self.assertEqual(record["gas_results"]["co2"]["mass"], "194.3512704")
        self.assertEqual(record["gas_results"]["ch4"]["co2e"], "0.31752")
        self.assertEqual(record["gas_results"]["n2o"]["co2e"], "0.360612")
        self.assertEqual(record["reconciliation"]["component_rounding_delta"], "0.0108864")
        self.assertFalse(record["classification"]["release_eligible"])

    def test_replay_and_tamper_refusal(self):
        record = engine.calculate(ACTIVITY)
        self.assertTrue(engine.replay(record)["hash_match"])
        changed = copy.deepcopy(record)
        changed["total"]["display"] = "0.0000"
        with self.assertRaises(engine.ContractError) as caught:
            engine.replay(changed)
        self.assertEqual(caught.exception.code, "replay_hash_mismatch")

    def test_wrong_unit_missing_geography_and_wrong_period_fail_closed(self):
        cases = [
            ("unit", "kWh", "unit_conversion_unapproved"),
            ("geography", None, "geography_required"),
            ("reporting_period", {"start": "2024-01-01", "end": "2024-12-31"}, "reporting_period_mismatch"),
        ]
        for field, value, code in cases:
            activity = copy.deepcopy(ACTIVITY)
            if value is None:
                activity[field] = {}
            else:
                activity[field] = value
            with self.assertRaises(engine.ContractError) as caught:
                engine.calculate(activity)
            self.assertEqual(caught.exception.code, code)

    def test_quantity_is_the_exact_fixed_one_mwh_fixture(self):
        activity = copy.deepcopy(ACTIVITY)
        activity["quantity"] = "2"
        with self.assertRaises(engine.ContractError) as caught:
            engine.calculate(activity)
        self.assertEqual(caught.exception.code, "synthetic_fixture_invalid")


if __name__ == "__main__":
    unittest.main()
