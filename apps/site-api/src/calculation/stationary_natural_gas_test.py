import copy
import importlib.util
import pathlib
import unittest


MODULE_PATH = pathlib.Path(__file__).with_name("stationary_natural_gas.py")
SPEC = importlib.util.spec_from_file_location("stationary_natural_gas", MODULE_PATH)
ENGINE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(ENGINE)


def activity():
    return {
        "asset_id": "Synthetic boiler 001",
        "boundary": "Owned stationary combustion source",
        "geography": "United States",
        "reporting_period": {"start": "2025-01-01", "end": "2025-12-31"},
        "fuel": "Natural Gas",
        "quantity": "1",
        "unit": "MMBtu",
    }


class StationaryNaturalGasTests(unittest.TestCase):
    def test_exact_fixture_and_repeat_hash(self):
        first = ENGINE.calculate(activity())
        second = ENGINE.calculate(activity())
        self.assertEqual(first, second)
        self.assertEqual(first["gas_results"]["co2"]["mass"], "53.06")
        self.assertEqual(first["gas_results"]["ch4"]["mass"], "0.001")
        self.assertEqual(first["gas_results"]["ch4"]["co2e"], "0.028")
        self.assertEqual(first["gas_results"]["n2o"]["mass"], "0.0001")
        self.assertEqual(first["gas_results"]["n2o"]["co2e"], "0.0265")
        self.assertEqual(first["total"]["unrounded"], "53.1145")
        self.assertEqual(first["total"]["display"], "53.1145")
        self.assertEqual(first["factor"]["source"]["method_note_cells"]["hhv"], "C94")
        self.assertEqual(first["factor"]["source"]["method_note_cells"]["combustion_only_upstream_excluded"], "C99")
        self.assertEqual(first["gwp_policy"]["source"]["workbook_sha256"], ENGINE.SOURCE_SHA256)
        self.assertEqual(first["gwp_policy"]["source"]["horizon_cell"], "E523")
        self.assertEqual(first["gwp_policy"]["source"]["assessment_note_cells"], ["C10", "C556"])

    def test_zero_is_distinct_from_missing(self):
        zero = activity()
        zero["quantity"] = "0"
        self.assertEqual(ENGINE.calculate(zero)["total"]["display"], "0.0000")
        missing = activity()
        missing["quantity"] = ""
        with self.assertRaisesRegex(ENGINE.ContractError, "non-negative plain decimal"):
            ENGINE.calculate(missing)

    def test_required_negative_examples(self):
        cases = [("unit", "therm", "unit_conversion_unapproved"), ("geography", "", "geography_required")]
        for field, value, code in cases:
            changed = activity()
            changed[field] = value
            with self.assertRaises(ENGINE.ContractError) as caught:
                ENGINE.calculate(changed)
            self.assertEqual(caught.exception.code, code)
        changed = activity()
        changed["reporting_period"] = {"start": "2024-01-01", "end": "2024-12-31"}
        with self.assertRaises(ENGINE.ContractError) as caught:
            ENGINE.calculate(changed)
        self.assertEqual(caught.exception.code, "reporting_period_mismatch")

    def test_rejects_numbers_signs_exponents_and_unknown_keys(self):
        bad_values = [1, "-1", "+1", "1e2", "NaN", "01", "1.1234567890123456789"]
        for bad in bad_values:
            changed = activity()
            changed["quantity"] = bad
            with self.assertRaises(ENGINE.ContractError):
                ENGINE.calculate(changed)
        changed = activity()
        changed["extra"] = "no"
        with self.assertRaises(ENGINE.ContractError):
            ENGINE.calculate(changed)

    def test_replay_rejects_tampering_and_binding_changes(self):
        record = ENGINE.calculate(activity())
        self.assertTrue(ENGINE.replay(record)["hash_match"])
        tampered = copy.deepcopy(record)
        tampered["total"]["display"] = "53.1146"
        with self.assertRaises(ENGINE.ContractError) as caught:
            ENGINE.replay(tampered)
        self.assertEqual(caught.exception.code, "replay_hash_mismatch")

    def test_upper_bound_remains_exact(self):
        maximum = activity()
        maximum["quantity"] = "999999999999999999999999999999.999999999999999999"
        record = ENGINE.calculate(maximum)
        self.assertEqual(
            record["total"]["unrounded"],
            "53114499999999999999999999999999.9999999999999999468855",
        )


if __name__ == "__main__":
    unittest.main()
