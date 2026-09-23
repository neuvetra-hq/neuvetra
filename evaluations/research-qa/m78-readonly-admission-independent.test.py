import copy
import importlib.util
import json
import unittest
from pathlib import Path

SPEC = importlib.util.spec_from_file_location("review", Path(__file__).with_name("m78-readonly-admission-independent-review.py"))
REVIEW = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(REVIEW)

class AdmissionReview(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.actual = REVIEW.validate()
        cls.runtime = REVIEW.load(REVIEW.RUNTIME)

    def test_exact_source_and_complete_closure(self):
        self.assertEqual(len(self.actual["pins"]), 179)
        self.assertEqual(len({p["path"] for p in self.actual["pins"]}), 179)
        self.assertEqual(len(self.actual["sourcePinsSha256"]), 64)

    def test_static_local_only_and_exclusive_contract(self):
        c = self.actual["contract"]
        self.assertEqual(c["networkTokens"], [])
        self.assertEqual(c["subprocessExecutables"], ["C:/Users/nimab/.bun/bin/bun.exe"])
        self.assertTrue(c["usesExclusiveMode"])
        self.assertEqual(c["exclusiveWrites"], 2)

    def test_runtime_mutations_are_not_equivalent(self):
        exact = self.runtime
        cases = [
            ("commit", "0" * 40),
            ("deploymentId", "00000000-0000-0000-0000-000000000000"),
            ("deploymentStatus", "BUILDING"),
            ("autodeploy", True),
        ]
        for key, value in cases:
            changed = copy.deepcopy(exact); changed[key] = value
            self.assertNotEqual(REVIEW.canonical(changed), REVIEW.canonical(exact), key)
        changed = copy.deepcopy(exact); changed["ready"]["schemaVersion"] = 20
        self.assertNotEqual(REVIEW.canonical(changed["ready"]), REVIEW.canonical(exact["ready"]))

    def test_canonical_digest_rejects_pin_mutations_and_reordering_is_stable(self):
        pins = self.actual["pins"]
        reordered_keys = [{"sha256": p["sha256"], "path": p["path"]} for p in pins]
        self.assertEqual(REVIEW.canonical(pins), REVIEW.canonical(reordered_keys))
        changed = copy.deepcopy(pins); changed[0]["sha256"] = "0" * 64
        self.assertNotEqual(REVIEW.canonical(pins), REVIEW.canonical(changed))

    def test_root_and_private_reviews_are_exact_and_independent(self):
        root = REVIEW.load("evaluations/research-qa/m78-readonly-recovery-root-candidate3-result.json")
        private = REVIEW.load("evaluations/research-qa/m78-readonly-private-independent-result.json")
        self.assertEqual(root["reviewerId"], "/root")
        self.assertEqual(private["reviewerId"], "/root/m78_transport_continuation")
        self.assertNotEqual(root["reviewerId"], private["reviewerId"])
        self.assertEqual(root["materialFindingsOpen"], 0)
        self.assertEqual(private["materialFindingsOpen"], 0)

if __name__ == "__main__":
    unittest.main()
