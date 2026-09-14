"""Synthetic offline publication checks; fake responses are not cloud receipts."""
import copy
from datetime import datetime, timezone
from pathlib import Path
import unittest
from unittest.mock import patch

import evidence_smoke as e
import publication_setup as p
from test_evidence_smoke import FakeCloud

ROOT = Path(__file__).resolve().parents[2]
FIXTURE = (ROOT / "evaluations/cloud-integration/synthetic-fixture.v1.json").read_bytes()
TARGET = (ROOT / "evaluations/cloud-integration/resource-target.synthetic-01.json").read_bytes()
STAGE = (ROOT / "evaluations/cloud-integration/stage.synthetic-01.json").read_bytes()
NOW = datetime(2026, 9, 9, 6, 0, tzinfo=timezone.utc)


class Clock(datetime):
    @classmethod
    def now(cls, tz=None):
        return NOW


def setup():
    config = e.Config(TARGET, p.TARGET_SHA, e.Secrets(pinecone_key="mock-pinecone", ingestion_key="sb_secret_mock_only_1234567890"))
    report = e.canonical({"project_ref": p.PROJECT_REF, "operation": "stage", "status": "completed", "committed": True,
                          "stage_sha256": p.STAGE_SHA, "migration_sha256": p.MIGRATION_SHA,
                          "stage_rows": 20, "approvals_written": 0, "activations": 0, "auth_users_created": 0})
    plan, _ = p.prepare(config, FIXTURE, STAGE, report, e.sha(report), NOW)
    return config, report, plan


class Cloud(FakeCloud):
    def __init__(self, config, plan):
        super().__init__(config, plan)
        self.bucket = {"id": p.BUCKET, "name": p.BUCKET, "public": False,
                       "file_size_limit": 1_000_000, "allowed_mime_types": ["application/octet-stream"]}
        self.bucket_calls = []
        self.missing_error = e.ProviderStatus(404)

    def request(self, origin, method, path, body=None, **kwargs):
        if origin == "supabase" and path.startswith("/storage/v1/bucket"):
            self.bucket_calls.append((method, path, copy.deepcopy(body)))
            if method == "GET":
                if self.bucket is None:
                    raise self.missing_error
                return e.canonical(self.bucket)
            self.bucket = copy.deepcopy(body)
            return b'{}'
        return super().request(origin, method, path, body, **kwargs)


class PublicationTests(unittest.TestCase):
    def setUp(self):
        self.clock = patch.object(p, "datetime", Clock)
        self.source_clock = patch.object(e, "datetime", Clock)
        self.clock.start(); self.source_clock.start()
        self.addCleanup(self.clock.stop); self.addCleanup(self.source_clock.stop)
        self.config, self.report, self.plan = setup()
        self.cloud = Cloud(self.config, self.plan)
        self.journal = []

    def run_operation(self, operation):
        return operation(self.config, FIXTURE, STAGE, self.report, e.sha(self.report), self.journal.append, transport=self.cloud)

    def test_missing_bucket_created_private_and_never_overwritten(self):
        self.cloud.bucket = None
        self.cloud.objects = {}; self.cloud.vectors = {}
        first = self.run_operation(p.publish_once)
        self.assertEqual(first["status"], "uploaded_objects_readback_verified")
        self.assertFalse(first["readiness_verified"])
        creates = [x for x in self.cloud.bucket_calls if x[0] == "POST"]
        self.assertEqual(creates, [("POST", "/storage/v1/bucket", p.CREATE_BUCKET)])
        existing = copy.deepcopy(self.cloud.objects)
        second = self.run_operation(p.publish_once)
        self.assertEqual(second["status"], first["status"])
        self.assertEqual(self.cloud.objects, existing)
        self.assertEqual(len([x for x in self.cloud.bucket_calls if x[0] == "POST"]), 1)
        self.assertTrue(all(r["activated"] is False for r in second["publication_receipts"]))

    def test_only_typed_bucket_missing_permits_create_not_generic400_or_object_missing(self):
        for missing, allowed in [(e.StorageMissing("bucket"), True), (e.StorageMissing("object"), False), (e.ProviderStatus(400), False)]:
            self.cloud = Cloud(self.config, self.plan); self.cloud.bucket = None; self.cloud.missing_error = missing
            result = self.run_operation(p.publish_once)
            self.assertEqual(any(c[0] == "POST" for c in self.cloud.bucket_calls), allowed)
            self.assertEqual(result["status"] == "uploaded_objects_readback_verified", allowed)

    def test_existing_unsafe_bucket_refuses_without_any_update_or_upload(self):
        for change in [{"public": True}, {"file_size_limit": None}, {"file_size_limit": 1_000_001}, {"allowed_mime_types": None}, {"id": "foreign"}]:
            self.cloud = Cloud(self.config, self.plan); self.cloud.bucket.update(change)
            result = self.run_operation(p.publish_once)
            self.assertEqual(result["status"], "failed_or_outcome_unconfirmed")
            self.assertFalse(self.cloud.calls)
            self.assertEqual([x[0] for x in self.cloud.bucket_calls], ["GET"])

    def test_verify_is_read_only_and_binds_all_six_objects_and_two_builds(self):
        result = self.run_operation(p.verify_once)
        self.assertEqual(result["status"], "verified")
        self.assertEqual(len(result["object_receipts"]), 6)
        self.assertEqual(len(result["vector_receipts"]), 2)
        self.assertEqual(result["target_sha256"], p.TARGET_SHA)
        self.assertEqual(result["stage_report_sha256"], e.sha(self.report))
        self.assertFalse(result["activated"])
        self.assertEqual(result["approvals_written"], 0)
        self.assertTrue(all(call[1] == "GET" for call in self.cloud.calls))
        self.assertTrue(all(call[0] == "GET" for call in self.cloud.bucket_calls))

    def test_verify_missing_bucket_or_vectors_has_no_create_upsert_or_retry(self):
        self.cloud.bucket = None
        result = self.run_operation(p.verify_once)
        self.assertEqual(result["error"], "provider_http_404")
        self.assertFalse(self.cloud.calls)
        self.cloud = Cloud(self.config, self.plan); self.cloud.vectors = {}
        result = self.run_operation(p.verify_once)
        self.assertEqual(result["error"], "vectors_not_ready")
        self.assertTrue(all(call[1] == "GET" for call in self.cloud.calls))

    def test_corrupt_source_or_vector_metadata_never_becomes_verified(self):
        self.cloud.objects[self.plan["scopes"][0]["objects"][0]["object_key"]] = b"changed"
        result = self.run_operation(p.verify_once)
        self.assertEqual(result["error"], "source_hash_mismatch")
        self.cloud = Cloud(self.config, self.plan)
        record = self.plan["scopes"][0]["records"][0]
        self.cloud.vectors[self.plan["scopes"][0]["namespace"]][record["_id"]]["scope_id"] = self.plan["scopes"][1]["scope_id"]
        result = self.run_operation(p.verify_once)
        self.assertEqual(result["error"], "vector_metadata_mismatch")
        self.assertFalse(result["readiness_verified"])

    def test_changed_pins_or_uncommitted_stage_refuse_before_cloud_io(self):
        with self.assertRaises(e.GateError):
            p.publish_once(self.config, FIXTURE, STAGE + b" ", self.report, e.sha(self.report), self.journal.append, transport=self.cloud)
        wrong = e.parse(self.report); wrong["committed"] = False; raw = e.canonical(wrong)
        with self.assertRaises(e.GateError):
            p.verify_once(self.config, FIXTURE, STAGE, raw, e.sha(raw), self.journal.append, transport=self.cloud)
        self.assertFalse(self.cloud.calls or self.cloud.bucket_calls)

    def test_initial_journal_failure_prevents_all_io(self):
        def fail(_): raise RuntimeError("private output path")
        result = p.publish_once(self.config, FIXTURE, STAGE, self.report, e.sha(self.report), fail, transport=self.cloud)
        self.assertEqual(result["error"], "journal_failed")
        self.assertFalse(self.cloud.calls or self.cloud.bucket_calls)


if __name__ == "__main__":
    unittest.main()
