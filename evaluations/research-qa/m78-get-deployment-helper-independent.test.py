from __future__ import annotations

import importlib.util
import json
import pathlib
import sys
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
MODULE_PATH = ROOT / "evaluations/research-qa/m78-get-deployment-helper-review.py"
spec = importlib.util.spec_from_file_location("m78_get_deployment_helper_review", MODULE_PATH)
review = importlib.util.module_from_spec(spec)
assert spec and spec.loader
sys.modules[spec.name] = review
spec.loader.exec_module(review)
ARCHIVE_BYTES = (ROOT / "evaluations/research-qa/m78-get-deployment-helper-source.json").read_bytes()
ARCHIVE = json.loads(ARCHIVE_BYTES)
FILES = {item["path"]: item for item in ARCHIVE["files"]}
SOURCE = FILES[".superpowers/m78-get-route-deploy-once.py"]["text"]
OBSERVER = FILES[".superpowers/m78-get-route-observe-deployment.py"]["text"]


class DeploymentHelperSourceReview(unittest.TestCase):
    def rejects(self, old: str, new: str, message: str) -> None:
        self.assertIn(old, SOURCE)
        with self.assertRaisesRegex(ValueError, message):
            review.review_source(SOURCE.replace(old, new, 1), require_exact_hash=False)

    def test_exact_source_contract(self) -> None:
        self.assertEqual(review.sha256(ARCHIVE_BYTES.decode("utf-8")), "831a94cf47a6ce3c94b794980f1db90416062e97e61a8897bef3100f8f79755e")
        self.assertEqual(ARCHIVE["status"], "deployment_helper_source_frozen_for_offline_review")
        self.assertEqual(len(FILES), 4)
        for item in FILES.values():
            self.assertEqual(review.sha256(item["text"]), item["sha256"])
        self.assertEqual(FILES[".superpowers/m78-get-route-deploy-once-candidate1.py"]["sha256"], "36a952b787182effe7047f467aa81f21e7b384f5bf5024e8b4506068051af2f3")
        self.assertEqual(FILES[".superpowers/m78-get-route-observe-deployment-candidate1.py"]["sha256"], "44c8aea72015e34a3da0fe2a0c79225ceebe6d3d9de0b7705b75ed1da2ac1a6c")
        result = review.review_source(SOURCE)
        self.assertEqual(result.sha256, review.EXPECTED_SHA256)
        self.assertEqual((result.mutation_calls, result.freshness_checks, result.exclusive_outputs), (1, 2, 3))
        self.assertGreaterEqual(result.fixed_checks, 30)
        observer = review.review_observer_source(OBSERVER)
        self.assertEqual(observer.sha256, review.EXPECTED_OBSERVER_SHA256)
        self.assertEqual((observer.mutation_calls, observer.exclusive_outputs), (0, 2))

    def test_refuses_changed_identity_route_readiness_and_qa(self) -> None:
        self.rejects("59cda7a62d8dcc6b554c92372e3b032577e410c9", "0" * 40, "missing contract")
        self.rejects("fd9b1115130d523629e58b5fcef06fe5355eedc8afd12d6dacc998623c89ff37", "1" * 64, "missing contract")
        self.rejects("'schemaVersion':21", "'schemaVersion':22", "missing contract")
        self.rejects("m78_get_local_comparison_independently_passed", "unreviewed", "missing contract")

    def test_refuses_weakened_freshness_ci_and_no_other_active_gate(self) -> None:
        self.rejects("<180", "<1800", "freshness must be checked twice")
        self.rejects("and c['conclusion']=='success'", "", "missing contract")
        self.rejects("and r['status'] not in ('REMOVED','FAILED','CRASHED','SKIPPED')", "and False", "missing contract")
        self.rejects("['enabled'] is False", "['enabled'] is not None", "missing contract")

    def test_refuses_replay_or_uncertain_response_weakening(self) -> None:
        self.rejects("query_path.open('x'", "query_path.open('w'", "exclusive output modes")
        self.rejects("intent.open('x'", "intent.open('w'", "exclusive output modes")
        self.rejects("open('xb')", "open('wb')", "exclusive output modes")
        self.rejects("capture_output=True,timeout=120", "capture_output=False,timeout=120", "captured bounded mutation")
        self.rejects("r.returncode==0,'Deployment request uncertain; inspect retained receipt, never retry blindly'", "True", "missing contract")

    def test_source_review_is_offline_and_does_not_execute_helper(self) -> None:
        before = set((ROOT / ".superpowers").glob("m78-get-route-deploy*"))
        with tempfile.TemporaryDirectory() as directory:
            copy = pathlib.Path(directory) / "source.json"
            copy.write_text(json.dumps({"sha256": review.EXPECTED_SHA256, "text": SOURCE}), encoding="utf-8")
            self.assertEqual(review.review_source(json.loads(copy.read_text(encoding="utf-8"))["text"]).mutation_calls, 1)
        after = set((ROOT / ".superpowers").glob("m78-get-route-deploy*"))
        self.assertEqual(before, after)

    def test_observer_refuses_changed_provenance_identity_and_runtime(self) -> None:
        cases = [
            ("intent['admissionSha256']==", "True or ", "missing observer contract"),
            ("r['id']==deployment", "True", "missing observer contract"),
            ("row['meta']['commitHash']==commit", "True", "missing observer contract"),
            ("['enabled'] is False", "['enabled'] is not None", "missing observer contract"),
            ("'schemaVersion':21", "'schemaVersion':22", "missing observer contract"),
            ("open('xb')", "open('wb')", "missing observer contract"),
            ("open('x',encoding", "open('w',encoding", "missing observer contract"),
        ]
        for old, new, message in cases:
            with self.subTest(old=old):
                self.assertIn(old, OBSERVER)
                with self.assertRaisesRegex(ValueError, message):
                    review.review_observer_source(OBSERVER.replace(old, new, 1), require_exact_hash=False)

    def test_observer_refuses_a_provider_mutation_call(self) -> None:
        changed = OBSERVER + "\nsubprocess.run(['provider-mutation'])\n"
        with self.assertRaisesRegex(ValueError, "observer must not mutate provider"):
            review.review_observer_source(changed, require_exact_hash=False)


if __name__ == "__main__":
    unittest.main()
