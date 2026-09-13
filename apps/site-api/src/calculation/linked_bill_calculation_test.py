import copy
import unittest

import linked_bill_calculation as engine


BINDING = {
    "company_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "evidence_id": "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    "extraction_id": "14141414-1414-4414-8414-141414141414",
    "previous_bill_version_id": "15151515-1515-4515-8515-151515151515",
    "bill_version_id": "ffffffff-ffff-4fff-8fff-ffffffffffff",
    "activity_version_id": "12121212-1212-4212-8212-121212121212",
    "facility_id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "boundary_id": "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    "parser_version": "m55-fixed-pdf-v1",
    "activity_version": 1,
    "bill_version": 2,
    "evidence_sha256": "0a97cd0976c03af0776214fc19bdc3d4f0c00e9c835f3e116574a6f375c8e135",
    "source_quantity_kwh": "12346.000",
    "normalized_quantity_mwh": "12.346000",
    "correction_reason": "Synthetic review exercise",
    "service_period": {"start": "2023-01-01", "end": "2023-01-31"},
    "facility": {"name": "Synthetic California office", "country": "United States", "state": "California", "egrid_subregion": "CAMX"},
    "boundary": {"reporting_year": 2023, "approach": "operational_control", "status": "draft", "version": 1},
}


class LinkedBillCalculationTest(unittest.TestCase):
    def test_exact_result_and_reviewed_authority(self):
        record = engine.calculate(BINDING)
        self.assertEqual(record["total"]["unrounded"], "2407.9674055248")
        self.assertEqual(record["total"]["display"], "2407.9674")
        self.assertEqual(record["reconciliation"]["component_sum"], "2407.8330020304")
        self.assertEqual(record["reconciliation"]["component_rounding_delta"], "0.1344034944")
        self.assertEqual(record["method"]["reviewed_engine_sha256"], "4ad28f3877d13f238bbbf7e8bfb1fc6241922b9def73712ec1b02fd80b51b82c")
        unhashed = {key: value for key, value in record.items() if key != "result_payload_sha256"}
        self.assertEqual(record["result_payload_sha256"], engine.digest(unhashed))

    def test_refuses_every_source_override(self):
        for key, value in (("source_quantity_kwh", "12345.000"), ("normalized_quantity_mwh", "12.345000"), ("bill_version", 1)):
            changed = copy.deepcopy(BINDING)
            changed[key] = value
            with self.assertRaises(engine.ContractError):
                engine.calculate(changed)
        changed = copy.deepcopy(BINDING)
        changed["facility"]["egrid_subregion"] = "NWPP"
        with self.assertRaises(engine.ContractError):
            engine.calculate(changed)


if __name__ == "__main__":
    unittest.main()
