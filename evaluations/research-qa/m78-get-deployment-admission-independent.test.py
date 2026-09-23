from __future__ import annotations

import datetime as dt
import importlib.util
import json
import pathlib
import subprocess
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
MODULE_PATH = ROOT / "evaluations/research-qa/m78-get-deployment-admission-independent-review.py"
spec = importlib.util.spec_from_file_location("m78_get_deployment_admission_review", MODULE_PATH)
review = importlib.util.module_from_spec(spec)
assert spec and spec.loader
sys.modules[spec.name] = review
spec.loader.exec_module(review)
ARCHIVE_BYTES = (ROOT / "evaluations/research-qa/m78-get-deployment-admission-independent-source.json").read_bytes()
ARCHIVE = json.loads(ARCHIVE_BYTES)
FILES = {item["path"]: item for item in ARCHIVE["files"]}
FINALIZER = FILES[".superpowers/m78-get-route-admit-deployment.py"]["text"]
DEPLOY = FILES[".superpowers/m78-get-route-deploy-once.py"]["text"]
OBSERVER = FILES[".superpowers/m78-get-route-observe-deployment.py"]["text"]


class DeploymentAdmissionReview(unittest.TestCase):
    def test_exact_source_and_interoperability(self) -> None:
        self.assertEqual(review.sha(ARCHIVE_BYTES), "f5c651e1186fb92ff745a3aa4770026874a69dedb1a17c48aced327ae86bd1a2")
        self.assertEqual(ARCHIVE["status"], "deployment_admission_source_frozen")
        self.assertEqual(len(FILES), 3)
        for item in FILES.values():
            self.assertEqual(review.sha(item["text"]), item["sha256"])
        result = review.review_source(FINALIZER, DEPLOY, OBSERVER)
        self.assertEqual(result, {"sourcePins": 173, "fixedPins": 7, "dynamicPins": 3, "totalPins": 183, "subprocessReadSites": 3, "writes": 1})

    def test_current_and_commit_source_closure_are_exact(self) -> None:
        self.assertEqual(subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(), review.COMMIT)
        inventory_path = ROOT / "evaluations/research-qa/m78-continuation4-preparation-source-pins.json"
        self.assertEqual(review.sha(inventory_path.read_bytes()), review.INVENTORY_SHA256)
        pins = json.loads(inventory_path.read_bytes())
        self.assertEqual(len(pins), 173)
        for pin in pins:
            expected = review.ROUTE_SHA256 if pin["path"] == "apps/site-api/src/workspace/m78-routes.ts" else pin["sha256"]
            self.assertEqual(review.sha((ROOT / pin["path"]).read_bytes()), expected)
            committed = subprocess.check_output(["git", "show", f"{review.COMMIT}:{pin['path']}"], cwd=ROOT)
            self.assertEqual(review.sha(committed), expected)

    def test_fixed_public_evidence_matches_current_and_commit(self) -> None:
        fixed = {
            "evaluations/research-qa/m78-get-local-comparison-result.json": "caae59a5d5704c53b6d61f901d30dee55be01b7f890c62e7d6e5c1b1b7931417",
            "evaluations/research-qa/m78-get-local-comparison-independent-result.json": "7aeabac30562a0f44d44b6a760b12a199bd42f6dbc360df591fb52f91a9e3b96",
            "evaluations/research-qa/m78-get-deployment-helper-result.json": "72363306eba69c9e3b09a4df12db8a5ebf5596799f66e9e0bdfbabaae8063f85",
            "evaluations/research-qa/m78-get-ci-history-independent-result.json": "35924e7cb2cbea450846c1c06722b1e20d02570e2271c26376a26084079f1851",
            ".github/workflows/verify.yml": "4a7810550658b732741992a79152527348f1b6fdd8c0340c5e0dc0015e7f9a14",
        }
        for path, expected in fixed.items():
            self.assertEqual(review.sha((ROOT / path).read_bytes()), expected)
            self.assertEqual(review.sha(subprocess.check_output(["git", "show", f"{review.COMMIT}:{path}"], cwd=ROOT)), expected)

    def test_offline_ci_fixture_accepts_only_exact_fresh_six(self) -> None:
        now = dt.datetime(2026, 9, 23, 2, 0, tzinfo=dt.timezone.utc)
        rows = [{"name": name, "status": "completed", "conclusion": "success"} for name in review.REQUIRED_CHECKS]
        base = {"sha": review.COMMIT, "pr_head": review.COMMIT, "state": "open", "observed_at": (now - dt.timedelta(seconds=119)).isoformat(), "checks": rows}
        review.validate_ci_fixture(base, now)
        mutations = [
            ("head", {**base, "pr_head": "0" * 40}, "CI head"),
            ("count", {**base, "checks": rows[:-1]}, "CI count"),
            ("names", {**base, "checks": [{**rows[0], "name": "other"}, *rows[1:]]}, "CI names"),
            ("status", {**base, "checks": [{**rows[0], "conclusion": "failure"}, *rows[1:]]}, "CI success"),
            ("stale", {**base, "observed_at": (now - dt.timedelta(seconds=120)).isoformat()}, "CI freshness"),
            ("future", {**base, "observed_at": (now + dt.timedelta(seconds=1)).isoformat()}, "CI freshness"),
        ]
        for name, value, message in mutations:
            with self.subTest(name=name), self.assertRaisesRegex(ValueError, message):
                review.validate_ci_fixture(value, now)

    def test_source_mutations_are_refused(self) -> None:
        cases = [
            (review.COMMIT, "0" * 40, "missing finalizer contract"),
            (review.ROUTE_SHA256, "1" * 64, "missing finalizer contract"),
            ("len(pins)==173", "len(pins)>=173", "missing finalizer contract"),
            ("total_seconds()<120", "total_seconds()<1200", "missing finalizer contract"),
            ("open('x'", "open('w'", "missing finalizer contract"),
            (review.DEPLOY_SHA256, "2" * 64, "missing finalizer contract"),
            (review.OBSERVER_SHA256, "3" * 64, "missing finalizer contract"),
        ]
        for old, new, message in cases:
            with self.subTest(old=old), self.assertRaisesRegex(ValueError, message):
                review.review_source(FINALIZER.replace(old, new, 1), DEPLOY, OBSERVER, exact_hash=False)

    def test_review_does_not_execute_or_create_admission(self) -> None:
        before = (ROOT / ".superpowers/m78-get-route-deployment-admission.json").exists()
        review.review_source(FINALIZER, DEPLOY, OBSERVER)
        after = (ROOT / ".superpowers/m78-get-route-deployment-admission.json").exists()
        self.assertEqual(before, after)


if __name__ == "__main__":
    unittest.main()
