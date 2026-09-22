"""Offline adversarial checks for the bounded build-model pilot."""

from __future__ import annotations

import json
from pathlib import Path
import tempfile
import threading
import unittest

import build_model_pilot as pilot


def catalog():
    data = []
    rates = {
        "minimax/minimax-m3": ("0.0000003", "0.0000012", "0.00000006"),
        "moonshotai/kimi-k2.7-code": ("0.0000007062", "0.0000033", "0.00000018"),
    }
    for model, (prompt, completion, cache) in rates.items():
        data.append({
            "id": model,
            "context_length": 262144,
            "architecture": {"input_modalities": ["text"], "output_modalities": ["text"]},
            "pricing": {"prompt": prompt, "completion": completion, "input_cache_read": cache},
            "top_provider": {"max_completion_tokens": 65536},
            "per_request_limits": None,
            "supported_parameters": ["max_tokens", "tool_choice"],
        })
    return {"data": data}


class FakeTransport:
    def __init__(self, mode="ok"):
        self.mode = mode
        self.posts = []
        self.catalog_gets = 0

    def get_json(self, url, *, timeout):
        self.catalog_gets += 1
        self.catalog_url = url
        return catalog()

    def post_json(self, url, body, *, api_key, timeout):
        self.posts.append((url, body, api_key, timeout))
        number = len(self.posts)
        if self.mode == "timeout" and number == 1:
            raise TimeoutError("simulated secret-bearing transport detail")
        usage = {"prompt_tokens": 100, "completion_tokens": 50, "total_tokens": 150}
        if self.mode != "unknown_usage":
            usage["cost"] = 0.0001
        content = "not JSON" if self.mode == "invalid_output" else '{"review":"proposal"}'
        finish_reason = "length" if self.mode == "invalid_output" else "stop"
        return {
            "id": "duplicate-response" if self.mode == "duplicate_response" else f"response-{number}",
            "model": body["model"],
            "usage": usage,
            "choices": [{"finish_reason": finish_reason,
                         "message": {"role": "assistant", "content": content}}],
        }


class BuildModelPilotTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.base = self.root / "operations/agent-improvement"
        self.base.mkdir(parents=True)
        self.fixtures = {
            "schema_version": 1,
            "synthetic": True,
            "purpose": "test",
            "cases": [
                {"id": "CASE-1", "feature_id": "OPS-PILOT-01", "prompt": "Review synthetic A."},
                {"id": "CASE-2", "feature_id": "OPS-PILOT-01", "prompt": "Review synthetic B."},
            ],
        }
        (self.base / "build-pilot-fixtures.json").write_text(
            json.dumps(self.fixtures), encoding="utf-8")

    def test_offline_preflight_uses_no_key_network_or_ledger(self):
        result = pilot.preflight(self.root)
        self.assertEqual(result["mode"], "offline_preflight")
        self.assertFalse(result["network_used"])
        self.assertFalse(result["credential_required"])
        self.assertEqual(result["planned_request_count"], 4)
        self.assertFalse((self.base / "build-pilot-ledger.jsonl").exists())

    def test_execute_requires_only_named_key_before_catalog_access(self):
        transport = FakeTransport()
        with self.assertRaisesRegex(pilot.PilotError, "missing_openrouter_api_key"):
            pilot.execute(self.root, "missing-key", transport=transport, environ={})
        self.assertEqual(transport.catalog_gets, 0)
        self.assertEqual(transport.posts, [])

    def test_fixed_requests_refresh_catalog_and_disable_tools_and_fallbacks(self):
        transport = FakeTransport()
        report = pilot.execute(self.root, "bounded-run", transport=transport,
                               environ={"OPENROUTER_API_KEY": "not-a-real-key"})
        self.assertEqual(transport.catalog_gets, 1)
        self.assertEqual(len(transport.posts), 4)
        self.assertTrue(all(item["status"] == "settled" for item in report["requests"]))
        for _, body, key, timeout in transport.posts:
            self.assertEqual(key, "not-a-real-key")
            self.assertEqual(timeout, pilot.TIMEOUT_SECONDS)
            self.assertIn(body["model"], pilot.ALLOWED_MODELS)
            self.assertEqual(body["max_tokens"], pilot.MAX_TOKENS)
            self.assertEqual(body["tool_choice"], "none")
            self.assertNotIn("tools", body)
            self.assertNotIn("plugins", body)
            self.assertFalse(body["provider"]["allow_fallbacks"])
            self.assertTrue(body["provider"]["require_parameters"])
            self.assertEqual(body["provider"]["max_price"]["request"], 0)
        ledger_text = (self.base / "build-pilot-ledger.jsonl").read_text(encoding="utf-8")
        self.assertNotIn("not-a-real-key", ledger_text)

    def test_timeout_and_unknown_usage_retain_reservations_without_error_text(self):
        for mode in ("timeout", "unknown_usage"):
            with self.subTest(mode=mode):
                root = self.root / mode
                base = root / "operations/agent-improvement"
                base.mkdir(parents=True)
                (base / "build-pilot-fixtures.json").write_text(
                    json.dumps(self.fixtures), encoding="utf-8")
                report = pilot.execute(root, mode, transport=FakeTransport(mode),
                                       environ={"OPENROUTER_API_KEY": "secret-value"})
                uncertain = [item for item in report["requests"] if item["status"] == "uncertain"]
                expected = 1 if mode == "timeout" else 4
                self.assertEqual(len(uncertain), expected)
                ledger = (base / "build-pilot-ledger.jsonl").read_text(encoding="utf-8")
                self.assertNotIn("secret-value", ledger)
                self.assertNotIn("simulated secret-bearing", ledger)
                self.assertGreater(pilot.Ledger(base / "build-pilot-ledger.jsonl").exposure(), 0)
                if mode == "unknown_usage":
                    self.assertTrue(all(item["output_text"] == '{"review":"proposal"}'
                                        for item in uncertain))

    def test_duplicate_generation_id_retains_later_reservations(self):
        report = pilot.execute(self.root, "duplicate-generation",
                               transport=FakeTransport("duplicate_response"),
                               environ={"OPENROUTER_API_KEY": "test-key"})
        self.assertEqual(report["requests"][0]["status"], "settled")
        self.assertTrue(all(item["status"] == "uncertain" for item in report["requests"][1:]))
        events = [json.loads(line) for line in
                  (self.base / "build-pilot-ledger.jsonl").read_text(encoding="utf-8").splitlines()]
        self.assertEqual(sum(event["event"] == "settle" for event in events), 1)
        self.assertEqual(sum(event["event"] == "uncertain" for event in events), 3)

    def test_truncated_non_json_output_is_preserved_but_not_reviewable(self):
        report = pilot.execute(self.root, "invalid-output",
                               transport=FakeTransport("invalid_output"),
                               environ={"OPENROUTER_API_KEY": "test-key"})
        for item in report["requests"]:
            self.assertEqual(item["status"], "settled")
            self.assertEqual(item["output_status"], "unusable")
            self.assertEqual(item["output_text"], "not JSON")
            self.assertIn("truncated_at_output_cap", item["output_issue_codes"])
            self.assertIn("output_not_json", item["output_issue_codes"])

    def test_budget_failure_happens_before_dispatch(self):
        transport = FakeTransport()
        ledger = pilot.Ledger(self.base / "build-pilot-ledger.jsonl")
        ledger.reserve_batch([{"request_id": "old", "case_id": "OLD", "model": pilot.ALLOWED_MODELS[0],
                               "reservation_usd": "4.999"}],
                             run_id="old", catalog_sha256="0" * 64)
        with self.assertRaisesRegex(pilot.PilotError, "aggregate_budget_exceeded"):
            pilot.execute(self.root, "over-budget", transport=transport,
                          environ={"OPENROUTER_API_KEY": "test-key"})
        self.assertEqual(transport.posts, [])

    def test_duplicate_request_id_is_refused(self):
        ledger = pilot.Ledger(self.base / "build-pilot-ledger.jsonl")
        plan = {"request_id": "same", "case_id": "CASE", "model": pilot.ALLOWED_MODELS[0],
                "reservation_usd": "0.10"}
        ledger.reserve_batch([plan], run_id="first", catalog_sha256="1" * 64)
        with self.assertRaisesRegex(pilot.PilotError, "duplicate_request_id"):
            ledger.reserve_batch([plan], run_id="second", catalog_sha256="1" * 64)

    def test_locked_concurrent_reservations_cannot_cross_cap(self):
        ledger = pilot.Ledger(self.base / "build-pilot-ledger.jsonl")
        barrier = threading.Barrier(2)
        outcomes = []

        def reserve(name):
            barrier.wait()
            try:
                ledger.reserve_batch([{"request_id": name, "case_id": name,
                                       "model": pilot.ALLOWED_MODELS[0],
                                       "reservation_usd": "3"}],
                                     run_id=name, catalog_sha256="2" * 64)
                outcomes.append("reserved")
            except pilot.PilotError as exc:
                outcomes.append(str(exc))

        threads = [threading.Thread(target=reserve, args=(name,)) for name in ("a", "b")]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()
        self.assertEqual(outcomes.count("reserved"), 1)
        self.assertEqual(outcomes.count("aggregate_budget_exceeded"), 1)
        self.assertEqual(ledger.exposure(), pilot.Decimal("3"))

    def test_catalog_missing_model_or_unknown_price_field_fails_closed(self):
        missing = catalog()
        missing["data"].pop()
        with self.assertRaisesRegex(pilot.PilotError, "catalog_missing_allowed_model"):
            pilot.parse_catalog(missing)
        unknown = catalog()
        unknown["data"][0]["pricing"]["mystery_fee"] = "0.01"
        with self.assertRaisesRegex(pilot.PilotError, "catalog_unknown_price_field"):
            pilot.parse_catalog(unknown)


if __name__ == "__main__":
    unittest.main()
