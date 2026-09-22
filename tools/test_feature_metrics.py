"""Adversarial offline checks for feature scorecard evidence accounting."""

import contextlib
from copy import deepcopy
import io
import json
from pathlib import Path
import tempfile
import unittest

import feature_metrics


class FeatureMetricsTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.registry_path = self.root / "features.json"
        self.feature_path = self.root / "feature-events.jsonl"
        self.usage_path = self.root / "usage-events.jsonl"
        self.registry = {
            "schema_version": 1,
            "features": [{
                "feature_id": "F1", "milestone_id": "M1", "title": "Bounded feature",
                "problem": "No scorecard", "delivered_behavior": None,
                "state": "implementing", "owner": "engineer", "risk_class": "critical",
                "complexity_class": "bounded_tooling", "run_ids": ["R1", "Q1"],
                "dependencies": [],
                "acceptance_criteria": [
                    {"criterion_id": "C1", "description": "Counts are exact", "applicable": True},
                    {"criterion_id": "C2", "description": "Deferred by contract", "applicable": False},
                ],
            }],
        }
        self.feature_events = []
        self.usage_events = []
        self.write_inputs()

    def write_inputs(self):
        self.registry_path.write_text(json.dumps(self.registry), encoding="utf-8")
        self.feature_path.write_text("".join(json.dumps(item) + "\n" for item in self.feature_events),
                                     encoding="utf-8")
        self.usage_path.write_text("".join(json.dumps(item) + "\n" for item in self.usage_events),
                                   encoding="utf-8")

    def event(self, event_id, event_type, at, artifact="sha-v1", **extra):
        value = {"schema_version": 1, "event_id": event_id, "feature_id": "F1",
                 "occurred_at": at, "event_type": event_type, "actor": "reviewer",
                 "run_id": "Q1", "artifact_version": artifact,
                 "evidence": ["proof.json#item"], "correction_of": None}
        value.update(extra)
        if event_type == "qa_disposition":
            value.setdefault("independent", True)
        return value

    def reservation(self, event_id="U1", call_id="CALL1", at="2026-09-22T10:00:00Z", **extra):
        value = self.event(event_id, "reservation", at, actor="engineer", run_id="R1",
                           call_id=call_id, phase="implementation", provider="test-provider",
                           generation_id="GEN-" + call_id, retry_of=None, reserved_usd="1.00",
                           requested_model="build-model", requested_effort="high",
                           price_version="2026-09")
        value.update(extra)
        return value

    def settlement(self, event_id="U2", call_id="CALL1", at="2026-09-22T10:01:00Z", **extra):
        value = self.event(event_id, "settlement", at, actor="engineer", run_id="R1",
                           call_id=call_id, phase="implementation", actual_usd="0.10",
                           charge_status="billed", actual_model="actual-model",
                           actual_effort="high",
                           tokens={"input": 10, "cached_input": 2, "output": 5, "reasoning": 1})
        value.update(extra)
        return value

    def load(self):
        self.write_inputs()
        return feature_metrics.load_inputs(self.registry_path, self.feature_path, self.usage_path)

    def report(self):
        features, events, _, reservations, settlements = self.load()
        return feature_metrics.build_scorecards(features, events, reservations, settlements)

    def test_empty_streams_preserve_unknown_cost_and_explicit_denominators(self):
        card = self.report()["features"][0]
        self.assertIsNone(card["cost"]["actual_usd_lower_bound"])
        self.assertEqual(card["cost"]["actual_usd_known_calls"], 0)
        self.assertEqual(card["cost"]["total_calls"], 0)
        self.assertEqual(card["qa"]["first_review"]["completed_denominator"], 0)
        self.assertEqual(card["acceptance_coverage"]["applicable_denominator"], 1)

    def test_stable_findings_rounds_rework_and_reopen_do_not_double_count(self):
        self.feature_events = [
            self.event("E1", "started", "2026-09-22T10:00:00Z", run_id="R1"),
            self.event("E2", "qa_handoff", "2026-09-22T10:01:00Z", round_id="ROUND1"),
            self.event("E3", "finding_opened", "2026-09-22T10:02:00Z", finding_id="FIND1",
                       severity="high", category="implementation", summary="Wrong total"),
            self.event("E4", "qa_disposition", "2026-09-22T10:03:00Z", round_id="ROUND1",
                       disposition="fail"),
            self.event("E5", "repair", "2026-09-22T10:04:00Z", artifact="sha-v2", run_id="R1"),
            self.event("E6", "qa_handoff", "2026-09-22T10:05:00Z", artifact="sha-v2",
                       round_id="ROUND2"),
            self.event("E7", "finding_resolved", "2026-09-22T10:06:00Z", artifact="sha-v2",
                       finding_id="FIND1"),
            self.event("E8", "finding_reopened", "2026-09-22T10:07:00Z", artifact="sha-v2",
                       finding_id="FIND1"),
            self.event("E9", "qa_disposition", "2026-09-22T10:08:00Z", artifact="sha-v2",
                       round_id="ROUND2", disposition="fail"),
            self.event("E10", "qa_handoff", "2026-09-22T10:09:00Z", artifact="sha-v3",
                       round_id="ROUND3"),
            self.event("E11", "finding_resolved", "2026-09-22T10:10:00Z", artifact="sha-v3",
                       finding_id="FIND1"),
            self.event("E12", "qa_disposition", "2026-09-22T10:11:00Z", artifact="sha-v3",
                       round_id="ROUND3", disposition="pass"),
        ]
        qa = self.report()["features"][0]["qa"]
        self.assertEqual((qa["unique_findings"], qa["review_rounds"], qa["rework_cycles"]),
                         (1, 3, 2))
        self.assertEqual(qa["open_or_reopened_findings"], 0)
        self.assertEqual(qa["first_review"],
                         {"result": "fail", "pass_numerator": 0, "completed_denominator": 1})

    def test_disposition_must_match_exact_handoff_artifact(self):
        self.feature_events = [
            self.event("E1", "qa_handoff", "2026-09-22T10:00:00Z", round_id="ROUND1"),
            self.event("E2", "qa_disposition", "2026-09-22T10:01:00Z", artifact="sha-v2",
                       round_id="ROUND1", disposition="pass"),
        ]
        with self.assertRaisesRegex(feature_metrics.InvalidMetrics, "not bound"):
            self.load()

    def test_accepted_state_requires_lifecycle_and_passing_applicable_criteria(self):
        self.registry["features"][0]["state"] = "accepted"
        self.registry["features"][0]["delivered_behavior"] = "Scorecard is generated"
        with self.assertRaisesRegex(feature_metrics.InvalidMetrics, "lifecycle"):
            self.load()
        self.feature_events = [
            self.event("E1", "criterion_result", "2026-09-22T10:00:00Z",
                       criterion_id="C1", status="pass"),
            self.event("E2", "qa_handoff", "2026-09-22T10:01:00Z", round_id="ROUND1"),
            self.event("E3", "qa_disposition", "2026-09-22T10:02:00Z", round_id="ROUND1",
                       disposition="pass"),
            self.event("E4", "accepted", "2026-09-22T10:03:00Z"),
        ]
        self.load()

    def test_acceptance_requires_criterion_and_independent_qa_on_exact_accepted_version(self):
        self.registry["features"][0].update(state="accepted", delivered_behavior="Delivered")
        base = [
            self.event("E1", "criterion_result", "2026-09-22T10:00:00Z",
                       criterion_id="C1", status="pass"),
            self.event("E2", "qa_handoff", "2026-09-22T10:01:00Z", round_id="ROUND1"),
            self.event("E3", "qa_disposition", "2026-09-22T10:02:00Z", round_id="ROUND1",
                       disposition="pass"),
            self.event("E4", "accepted", "2026-09-22T10:03:00Z", artifact="sha-v2"),
        ]
        self.feature_events = deepcopy(base)
        with self.assertRaisesRegex(feature_metrics.InvalidMetrics, "accepted artifact"):
            self.load()
        self.feature_events = deepcopy(base)
        self.feature_events[0]["artifact_version"] = "sha-v2"
        self.feature_events[1]["artifact_version"] = "sha-v2"
        self.feature_events[2]["artifact_version"] = "sha-v2"
        self.feature_events[2]["independent"] = False
        with self.assertRaisesRegex(feature_metrics.InvalidMetrics, "independent prior pass"):
            self.load()

    def test_qa_failure_and_finding_history_cannot_be_rewritten_by_correction(self):
        self.feature_events = [
            self.event("E1", "qa_handoff", "2026-09-22T10:00:00Z", round_id="ROUND1"),
            self.event("E2", "qa_disposition", "2026-09-22T10:01:00Z", round_id="ROUND1",
                       disposition="fail"),
            self.event("E3", "qa_disposition", "2026-09-22T10:02:00Z", round_id="ROUND1",
                       disposition="pass", correction_of="E2"),
        ]
        with self.assertRaisesRegex(feature_metrics.InvalidMetrics, "cannot be replaced"):
            self.load()
        self.feature_events = [
            self.event("E1", "finding_opened", "2026-09-22T10:00:00Z", finding_id="FIND1",
                       severity="high", category="implementation", summary="Material defect"),
            self.event("E2", "finding_opened", "2026-09-22T10:01:00Z", finding_id="FIND1",
                       severity="low", category="implementation", summary="Downgraded",
                       correction_of="E1"),
        ]
        with self.assertRaisesRegex(feature_metrics.InvalidMetrics, "cannot be replaced"):
            self.load()

    def test_publication_and_deployment_must_follow_matching_acceptance(self):
        self.registry["features"][0].update(state="published", delivered_behavior="Delivered")
        self.feature_events = [
            self.event("E1", "criterion_result", "2026-09-22T10:00:00Z",
                       criterion_id="C1", status="pass"),
            self.event("E2", "qa_handoff", "2026-09-22T10:01:00Z", round_id="ROUND1"),
            self.event("E3", "qa_disposition", "2026-09-22T10:02:00Z", round_id="ROUND1",
                       disposition="pass"),
            self.event("E4", "accepted", "2026-09-22T10:03:00Z"),
            self.event("E5", "published", "2026-09-22T10:04:00Z", artifact="sha-v2"),
        ]
        with self.assertRaisesRegex(feature_metrics.InvalidMetrics, "later events"):
            self.load()

    def test_latest_review_must_pass_and_no_later_artifact_can_remain_accepted(self):
        self.registry["features"][0].update(state="accepted", delivered_behavior="Delivered")
        events = [
            self.event("E1", "criterion_result", "2026-09-22T10:00:00Z",
                       criterion_id="C1", status="pass"),
            self.event("E2", "qa_handoff", "2026-09-22T10:01:00Z", round_id="ROUND1"),
            self.event("E3", "qa_disposition", "2026-09-22T10:02:00Z", round_id="ROUND1",
                       disposition="pass"),
            self.event("E4", "qa_handoff", "2026-09-22T10:03:00Z", round_id="ROUND2"),
            self.event("E5", "qa_disposition", "2026-09-22T10:04:00Z", round_id="ROUND2",
                       disposition="fail"),
            self.event("E6", "accepted", "2026-09-22T10:05:00Z"),
        ]
        self.feature_events = events
        with self.assertRaisesRegex(feature_metrics.InvalidMetrics, "latest QA"):
            self.load()
        self.feature_events = events[:3] + [self.event("E4", "accepted", "2026-09-22T10:03:00Z"),
                                            self.event("E5", "repair", "2026-09-22T10:04:00Z",
                                                       artifact="sha-v2", run_id="R1")]
        with self.assertRaisesRegex(feature_metrics.InvalidMetrics, "later events"):
            self.load()

    def test_unresolved_material_finding_blocks_acceptance(self):
        self.registry["features"][0].update(state="accepted", delivered_behavior="Delivered")
        self.feature_events = [
            self.event("E1", "criterion_result", "2026-09-22T10:00:00Z",
                       criterion_id="C1", status="pass"),
            self.event("E2", "qa_handoff", "2026-09-22T10:01:00Z", round_id="ROUND1"),
            self.event("E3", "finding_opened", "2026-09-22T10:02:00Z", finding_id="FIND1",
                       severity="high", category="implementation", summary="Material defect"),
            self.event("E4", "qa_disposition", "2026-09-22T10:03:00Z", round_id="ROUND1",
                       disposition="pass"),
            self.event("E5", "accepted", "2026-09-22T10:04:00Z"),
        ]
        with self.assertRaisesRegex(feature_metrics.InvalidMetrics, "unresolved material"):
            self.load()

    def test_optional_native_run_join_keeps_requested_observed_and_cost_distinct(self):
        runs_dir = self.root / "runs"
        runs_dir.mkdir()
        run = {"id": "R1", "role": "software-engineering", "execution_context": "author",
               "compute": {"requested": {"model": "gpt-5.6-sol", "effort": "high"},
                           "observed": {"model": None, "effort": None}},
               "metrics": {"cost_usd": None},
               "review": {"reviewer_execution_context": "qa", "independent": True,
                          "verdict": "fail"},
               "outcome": {"status": "in_progress", "first_review": "fail"}}
        (runs_dir / "R1.json").write_text(json.dumps(run), encoding="utf-8")
        qa_run = deepcopy(run)
        qa_run.update(id="Q1", role="qa-lead", execution_context="qa")
        qa_run["compute"]["requested"] = {"model": "gpt-6-astra", "effort": "high"}
        (runs_dir / "Q1.json").write_text(json.dumps(qa_run), encoding="utf-8")
        features, events, _, reservations, settlements = self.load()
        runs = feature_metrics.load_runs(runs_dir, features)
        native = feature_metrics.build_scorecards(features, events, reservations, settlements,
                                                   runs)["features"][0]["native_runs"]
        self.assertEqual(native["registered_runs"], 2)
        self.assertEqual(native["requested_model_known_runs"], 2)
        self.assertEqual(native["observed_model_known_runs"], 0)
        self.assertEqual(native["cost_known_runs"], 0)
        self.assertEqual(native["runs"][0]["review"]["reviewer_execution_context"], "qa")

    def test_cli_cannot_overwrite_a_joined_native_run_record(self):
        runs_dir = self.root / "runs"
        runs_dir.mkdir()
        run = {"id": "R1", "role": "software-engineering", "execution_context": "author",
               "compute": {"requested": {"model": "gpt-5.6-sol", "effort": "high"},
                           "observed": {"model": None, "effort": None}},
               "metrics": {"cost_usd": None},
               "review": {"reviewer_execution_context": "qa", "independent": True,
                          "verdict": "pending"},
               "outcome": {"status": "in_progress", "first_review": "pending"}}
        for run_id in ("R1", "Q1"):
            value = deepcopy(run)
            value["id"] = run_id
            (runs_dir / f"{run_id}.json").write_text(json.dumps(value), encoding="utf-8")
        original = (runs_dir / "R1.json").read_bytes()
        self.write_inputs()
        error = io.StringIO()
        with contextlib.redirect_stderr(error):
            code = feature_metrics.main([
                "scorecard", "--registry", str(self.registry_path),
                "--feature-events", str(self.feature_path), "--usage-events", str(self.usage_path),
                "--runs-dir", str(runs_dir), "--json-out", str(runs_dir / "R1.json"),
                "--markdown-out", str(self.root / "report.md")])
        self.assertEqual(code, 1)
        self.assertIn("cannot overwrite", error.getvalue())
        self.assertEqual((runs_dir / "R1.json").read_bytes(), original)

    def test_duplicate_settlement_and_duplicate_provider_generation_rejected(self):
        self.usage_events = [self.reservation(), self.settlement(),
                             self.settlement("U3", at="2026-09-22T10:02:00Z")]
        with self.assertRaisesRegex(feature_metrics.InvalidMetrics, "Duplicate settlement"):
            self.load()
        self.usage_events = [self.reservation(),
                             self.reservation("U4", "CALL2", "2026-09-22T10:01:00Z",
                                              generation_id="GEN-CALL1")]
        with self.assertRaisesRegex(feature_metrics.InvalidMetrics, "more than once"):
            self.load()

    def test_decimal_money_partial_measurement_and_model_denominators(self):
        self.usage_events = [
            self.reservation(reserved_usd="0.30"),
            self.settlement(actual_usd="0.10"),
            self.reservation("U3", "CALL2", "2026-09-22T10:02:00Z",
                             reserved_usd=None, requested_model=None, requested_effort=None),
        ]
        card = self.report()["features"][0]
        self.assertEqual(card["cost"]["actual_usd_lower_bound"], "0.10")
        self.assertEqual(card["cost"]["actual_usd_known_calls"], 1)
        self.assertEqual(card["cost"]["unknown_actual_usd_calls"], 1)
        self.assertEqual(card["cost"]["unsettled_calls_with_unknown_reserve"], 1)
        self.assertEqual(card["model_settings"]["actual_model_known_calls"], 1)
        self.assertEqual(card["model_settings"]["total_calls"], 2)

    def test_unknown_charge_cannot_be_encoded_as_null_settlement_or_numeric_float(self):
        for bad in (None, 0.0, "NaN", "-1"):
            with self.subTest(bad=bad):
                self.usage_events = [self.reservation(), self.settlement(actual_usd=bad)]
                with self.assertRaises(feature_metrics.InvalidMetrics):
                    self.load()

    def test_zero_not_billed_requires_explicit_status_and_evidence(self):
        self.usage_events = [self.reservation(),
                             self.settlement(actual_usd="0", charge_status="not_billed")]
        self.load()
        self.usage_events[1]["charge_status"] = "unknown"
        with self.assertRaisesRegex(feature_metrics.InvalidMetrics, "charge status"):
            self.load()
        self.usage_events[1]["charge_status"] = "not_billed"
        self.usage_events[1]["evidence"] = []
        with self.assertRaisesRegex(feature_metrics.InvalidMetrics, "evidence"):
            self.load()

    def test_retry_is_distinct_call_and_requires_retry_phase(self):
        retry = self.reservation("U2", "CALL2", "2026-09-22T10:01:00Z",
                                 retry_of="CALL1", phase="retry")
        self.usage_events = [self.reservation(), retry]
        self.assertEqual(len(self.load()[3]), 2)
        retry["phase"] = "implementation"
        with self.assertRaisesRegex(feature_metrics.InvalidMetrics, "retry phase"):
            self.load()

    def test_settlement_correction_is_append_only_and_not_double_counted(self):
        original = self.settlement(actual_usd="0.10")
        corrected = self.settlement("U3", at="2026-09-22T10:02:00Z", actual_usd="0.11",
                                    correction_of="U2")
        self.usage_events = [self.reservation(), original, corrected]
        card = self.report()["features"][0]
        self.assertEqual(card["cost"]["actual_usd_lower_bound"], "0.11")
        self.assertEqual(card["cost"]["actual_usd_known_calls"], 1)

    def test_out_of_order_stream_and_bad_token_subsets_rejected(self):
        self.usage_events = [self.reservation(at="2026-09-22T10:01:00Z"),
                             self.settlement(at="2026-09-22T10:00:00Z")]
        with self.assertRaisesRegex(feature_metrics.InvalidMetrics, "not append-time ordered"):
            self.load()
        self.usage_events = [self.reservation(),
                             self.settlement(tokens={"input": 1, "cached_input": 2,
                                                     "output": 1, "reasoning": 0})]
        with self.assertRaisesRegex(feature_metrics.InvalidMetrics, "cached_input exceeds"):
            self.load()

    def test_cli_writes_both_reports_and_refuses_to_overwrite_input(self):
        self.usage_events = [self.reservation()]
        self.write_inputs()
        json_out = self.root / "report.json"
        markdown_out = self.root / "report.md"
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            code = feature_metrics.main([
                "scorecard", "--registry", str(self.registry_path),
                "--feature-events", str(self.feature_path), "--usage-events", str(self.usage_path),
                "--json-out", str(json_out), "--markdown-out", str(markdown_out)])
        self.assertEqual(code, 0)
        self.assertEqual(json.loads(json_out.read_text())["features"][0]["feature_id"], "F1")
        self.assertIn("unknown", markdown_out.read_text())
        error = io.StringIO()
        with contextlib.redirect_stderr(error):
            code = feature_metrics.main([
                "scorecard", "--registry", str(self.registry_path),
                "--feature-events", str(self.feature_path), "--usage-events", str(self.usage_path),
                "--json-out", str(self.registry_path), "--markdown-out", str(markdown_out)])
        self.assertEqual(code, 1)
        self.assertIn("cannot overwrite", error.getvalue())

    def test_duplicate_json_keys_fail_without_traceback(self):
        self.registry_path.write_text('{"schema_version":1,"schema_version":1,"features":[]}')
        self.feature_path.write_text("")
        self.usage_path.write_text("")
        error = io.StringIO()
        with contextlib.redirect_stderr(error):
            code = feature_metrics.main(["validate", "--registry", str(self.registry_path),
                                         "--feature-events", str(self.feature_path),
                                         "--usage-events", str(self.usage_path)])
        self.assertEqual(code, 1)
        self.assertIn("Duplicate JSON key", error.getvalue())
        self.assertNotIn("Traceback", error.getvalue())


if __name__ == "__main__":
    unittest.main()
