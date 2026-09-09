"""CLOUD-PUBLISH-01, six owned fictional passages only; functions, no CLI/I/O on import.

Coordinator provides keys/config and reviewed bytes in memory, plus a synchronous
safe journal callback with private unique-file handling. No ENV, auth creation,
approval, activation, bucket update/delete, object overwrite, retries or polling.
Use publish_once, then verify_once. If visibility lags, call verify_once explicitly
under a bounded new attempt; do not repeat publication merely to check readiness.

Official Storage source checked 2026-09-09:
https://github.com/supabase/storage/blob/master/src/http/routes/bucket/getBucket.ts
  GET /bucket/:bucketId returns id/name/public/file_size_limit/allowed_mime_types.
https://github.com/supabase/storage/blob/master/src/http/routes/bucket/createBucket.ts
  POST /bucket accepts id/name/public/file_size_limit/allowed_mime_types; no upsert.
https://supabase.com/docs/reference/python/storage-getbucket
The frozen evidence_smoke adapter owns direct TLS, host checks and object/vector
requests. Its source hash is checked before any operation. Successful receipts
describe byte/vector readback, not RLS, source approval or complete application QA.
"""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
import copy

import evidence_smoke as e

PROJECT_REF = "icockcoguyadhryzydvl"
BUCKET = "neuvetra-research-dev"
FIXTURE_SHA = "1d048902d03a948d27ea8fc9d08975970de794242a065ae83b0b743be2958098"
TARGET_SHA = "fff2d429b00a4dc31806cf029d386de87be263efa2f55ec366b5e928dd5be055"
STAGE_SHA = "b98ef3e1a52d294a5916f2b2f9cf8972d40a2445a25c6cb98597c05af0311ce5"
ADAPTER_SHA = "3ca78f070155d66be9565a7e9ca76b6cac9b6622c0aeacbfa1137226601dd23b"
MIGRATION_SHA = "5e136e3c859375a427b410d9ea680821e07f5e315610a0fa10ff0e6cfd6ab5fa"
CREATE_BUCKET = {"id": BUCKET, "name": BUCKET, "public": False, "file_size_limit": 1_000_000,
                 "allowed_mime_types": ["application/octet-stream"]}


def prepare(config, fixture_bytes, stage_bytes, stage_report_bytes, stage_report_pin, now=None):
    now = now or datetime.now(timezone.utc)
    e.require(e.sha(Path(__file__).with_name("evidence_smoke.py").read_bytes()) == ADAPTER_SHA, "adapter_pin_mismatch")
    e.require(config.pin == TARGET_SHA and e.sha(config._target_bytes) == TARGET_SHA, "target_pin_mismatch")
    target = config.target
    e.require(target["supabase_host"] == PROJECT_REF + ".supabase.co" and target["bucket"] == BUCKET, "wrong_target")
    e.not_expired(target["review_expires_at"], now)
    e.require(e.sha(fixture_bytes) == FIXTURE_SHA and e.sha(stage_bytes) == STAGE_SHA, "fixture_or_stage_pin_mismatch")
    e.require(e.HEX.fullmatch(stage_report_pin or "") and e.sha(stage_report_bytes) == stage_report_pin, "stage_report_pin_mismatch")
    stage_report = e.parse(stage_report_bytes)
    e.require(stage_report.get("project_ref") == PROJECT_REF and stage_report.get("operation") == "stage"
              and stage_report.get("status") == "completed" and stage_report.get("committed") is True
              and stage_report.get("stage_sha256") == STAGE_SHA and stage_report.get("migration_sha256") == MIGRATION_SHA
              and stage_report.get("stage_rows") == 20 and stage_report.get("approvals_written") == 0
              and stage_report.get("activations") == 0 and stage_report.get("auth_users_created") == 0,
              "stage_not_committed")
    plan = e.build_seed_plan(fixture_bytes, target)
    e.validate_plan(config, plan)
    e.require(e.stage_payload(plan, target, target["review_expires_at"]) == e.parse(stage_bytes), "stage_projection_mismatch")
    return plan, {"project_ref": PROJECT_REF, "target_sha256": TARGET_SHA, "fixture_sha256": FIXTURE_SHA,
                  "stage_sha256": STAGE_SHA, "stage_report_sha256": stage_report_pin,
                  "adapter_sha256": ADAPTER_SHA, "review_expires_at": target["review_expires_at"],
                  "activated": False, "approvals_written": 0}


def check_bucket(raw, plan):
    bucket = e.parse(raw)
    e.require(bucket.get("id") == BUCKET and bucket.get("name") == BUCKET, "bucket_id_mismatch")
    e.require(bucket.get("public") is False, "bucket_not_private")
    limit = bucket.get("file_size_limit")
    e.require(type(limit) is int and 0 < limit <= 1_000_000
              and all(obj["byte_size"] <= limit for scope in plan["scopes"] for obj in scope["objects"]), "bucket_limit_refused")
    e.require(bucket.get("allowed_mime_types") == ["application/octet-stream"], "bucket_mime_refused")
    return {"id": BUCKET, "public": False, "file_size_limit": limit, "allowed_mime_types": ["application/octet-stream"]}


def ensure_bucket(config, transport, plan, *, allow_create):
    e.validate_plan(config, plan)
    e.require(config.pin == TARGET_SHA and config.target["bucket"] == BUCKET, "target_pin_mismatch")
    path = "/storage/v1/bucket/" + BUCKET
    try:
        raw = transport.request("supabase", "GET", path)
    except e.ProviderStatus as error:
        missing_bucket = error.status == 404 or isinstance(error, e.StorageMissing) and error.resource_kind == "bucket"
        if not missing_bucket or not allow_create:
            raise
        # A concurrent create may succeed elsewhere. Never update/adopt a bucket
        # until a fresh GET proves the exact private policy; no blind retry.
        try:
            transport.request("supabase", "POST", "/storage/v1/bucket", copy.deepcopy(CREATE_BUCKET))
        except e.ProviderStatus as conflict:
            if conflict.status not in (400, 409):
                raise
        raw = transport.request("supabase", "GET", path)
    return check_bucket(raw, plan)


def safe_error(error):
    if isinstance(error, e.ProviderStatus) and type(error.status) is int and 100 <= error.status <= 599:
        return "provider_http_" + str(error.status)
    allowed = {"bucket_id_mismatch", "bucket_not_private", "bucket_limit_refused", "bucket_mime_refused",
               "source_hash_mismatch", "vectors_not_ready", "vector_metadata_mismatch", "vector_profile_mismatch",
               "candidate_id_mismatch", "foreign_namespace", "described_target_mismatch", "index_not_ready",
               "described_profile_mismatch", "provider_unavailable", "response_too_large", "journal_failed"}
    return str(error) if isinstance(error, e.GateError) and str(error) in allowed else "publication_failed"


def _operate(operation, config, fixture_bytes, stage_bytes, stage_report_bytes, stage_report_pin, journal, transport):
    plan, report = prepare(config, fixture_bytes, stage_bytes, stage_report_bytes, stage_report_pin)
    e.require(callable(journal), "journal_required")
    transport = transport if transport is not None else e.Transport(config)
    report.update(operation=operation, status="started", phase="bucket", observed_at=datetime.now(timezone.utc).isoformat())

    def save():
        try:
            journal(copy.deepcopy(report))
        except Exception:
            raise e.GateError("journal_failed") from None

    try:
        save()
        report["bucket"] = ensure_bucket(config, transport, plan, allow_create=operation == "publish_synthetic_artifacts")
        if operation == "publish_synthetic_artifacts":
            report["phase"] = "publish"
            save()
            report["publication_receipts"] = e.publish_artifacts(config, transport, plan)
            report["status"] = "uploaded_objects_readback_verified"
            report["readiness_verified"] = False
        else:
            report["phase"] = "verify_objects"
            save()
            objects = []
            for scope in plan["scopes"]:
                for obj in scope["objects"]:
                    raw = transport.request("supabase", "GET", e.object_path(config, obj, True))
                    e.require(e.sha(raw) == obj["object_sha256"] and len(raw) == obj["byte_size"], "source_hash_mismatch")
                    objects.append({k: obj[k] for k in ("scope_id", "kind", "object_sha256", "byte_size", "bucket", "object_key")})
            report["object_receipts"] = objects
            report["phase"] = "verify_vectors"
            save()
            report["vector_receipts"] = e.verify_published_once(config, transport, plan)
            report["status"] = "verified"
            report["readiness_verified"] = True
        report["phase"] = "complete"
        report["finished_at"] = datetime.now(timezone.utc).isoformat()
        save()
    except Exception as error:
        report.update(status="failed_or_outcome_unconfirmed", readiness_verified=False, error=safe_error(error))
        try:
            save()
        except e.GateError:
            report["error"] = "journal_failed"
    return report


def publish_once(config, fixture_bytes, stage_bytes, stage_report_bytes, stage_report_pin, journal, *, transport=None):
    return _operate("publish_synthetic_artifacts", config, fixture_bytes, stage_bytes, stage_report_bytes, stage_report_pin, journal, transport)


def verify_once(config, fixture_bytes, stage_bytes, stage_report_bytes, stage_report_pin, journal, *, transport=None):
    return _operate("verify_synthetic_publication", config, fixture_bytes, stage_bytes, stage_report_bytes, stage_report_pin, journal, transport)
