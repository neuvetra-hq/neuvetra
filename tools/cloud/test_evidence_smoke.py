"""Offline boundary tests; FakeCloud is not proof of provider behavior or RLS."""
import base64
import copy
from datetime import datetime, timezone
import json
from pathlib import Path
import unittest
from unittest.mock import patch
from urllib.parse import parse_qs, unquote, urlsplit

import evidence_smoke as e

ROOT = Path(__file__).resolve().parents[2]
FIXTURE = ROOT / "evaluations/cloud-integration/synthetic-fixture.v1.json"
FIXTURE_SHA = "1d048902d03a948d27ea8fc9d08975970de794242a065ae83b0b743be2958098"
NOW = datetime(2026, 9, 9, 4, 30, tzinfo=timezone.utc)
USER = "80000000-0000-4000-8000-00000000000a"


def token(role="authenticated"):
    return "test." + base64.urlsafe_b64encode(e.canonical({"role": role})).decode().rstrip("=") + ".not-a-real-signature"


def setup_data():
    raw = FIXTURE.read_bytes()
    assert e.sha(raw) == FIXTURE_SHA
    target = {"schema_version": 1, "status": "approved_synthetic_development", "synthetic_use_approved": True,
              "schema": e.SCHEMA, "fixture_sha256": e.sha(raw), "profile": copy.deepcopy(e.PROFILE),
              "profile_sha256": e.sha(e.canonical(e.PROFILE)), "supabase_host": "aaaaaaaaaaaaaaaaaaaa.supabase.co",
              "pinecone_host": "offline-test.svc.unit-test.pinecone.io", "pinecone_index": "offline-test",
              "bucket": "neuvetra-synthetic-offline", "run_prefix": "offline-only-20260909", "builds": {}}
    plan = e.build_seed_plan(raw, target)
    target["builds"] = {s["scope_id"]: e.binding(s) for s in plan["scopes"]}
    secrets = e.Secrets("fake-pinecone-secret", "sb_publishable_fake", token(), "fake-ingestion-secret")
    raw_target = e.canonical(target)
    return e.Config(raw_target, e.sha(raw_target), secrets), plan


class FakeCloud:
    def __init__(self, config, plan):
        self.config, self.plan = config, plan
        self.calls = []
        self.scope = plan["scopes"][0]["scope_id"]
        self.rows = {k: [] for k in ("research_memberships", "research_active_builds", "research_releases", "research_objects", "research_sources", "research_passages")}
        self.objects, self.vectors = {}, {}
        self.mutate_hit = None
        self.failure = None
        self.description = {"name": config.target["pinecone_index"], "host": config.target["pinecone_host"],
                            "status": {"ready": True}, "dimension": 1024, "metric": "cosine",
                            "embed": {k: copy.deepcopy(e.PROFILE[k]) for k in ("model", "field_map", "read_parameters", "write_parameters")}}
        projection = e.stage_payload(plan, config.target, "2099-01-01T00:00:00Z")
        for scope in plan["scopes"]:
            sid = scope["scope_id"]
            self.rows["research_active_builds"].append(dict(scope_id=sid, **e.binding(scope)))
            self.rows["research_releases"].append(dict(scope_id=sid, **e.binding(scope), status="approved", review_expires_at="2026-09-10T00:00:00Z"))
            source_row = next(s for s in projection["research_sources"] if s["scope_id"] == sid)
            self.rows["research_sources"].append(dict(source_row, review_status="approved"))
            for obj in scope["objects"]:
                self.rows["research_objects"].append({k: v for k, v in obj.items() if k != "bytes"})
                self.objects[obj["object_key"]] = obj["bytes"]
            self.rows["research_passages"].extend(dict(p, review_status="approved") for p in scope["passages"])
            self.vectors[scope["namespace"]] = {r["_id"]: copy.deepcopy(r) for r in scope["records"]}

    def request(self, origin, method, path, body=None, **kwargs):
        self.calls.append((origin, method, path, copy.deepcopy(body), kwargs))
        if self.failure == origin:
            raise e.ProviderStatus(403)
        if origin == "control":
            return e.canonical(self.description)
        if origin == "supabase":
            if path == "/auth/v1/user":
                return e.canonical({"id": USER})
            if path.startswith("/rest/v1/"):
                table = urlsplit(path).path.split("/")[-1]
                data = [{"user_id": USER, "scope_id": self.scope}] if table == "research_memberships" else self.rows[table]
                filters = {k: v[0][3:] for k, v in parse_qs(urlsplit(path).query).items() if k != "select"}
                return e.canonical([r for r in data if all(str(r.get(k)) == v for k, v in filters.items())])
            marker = "/storage/v1/object/"
            parts = unquote(path[len(marker):]).split("/")
            if parts[0] == "authenticated":
                parts.pop(0)
            key = "/".join(parts[1:])
            if method == "POST":
                if key in self.objects:
                    raise e.ProviderStatus(409)
                self.objects[key] = body
                return b"{}"
            if key not in self.objects:
                raise e.ProviderStatus(404)
            return self.objects[key]
        if path.startswith("/vectors/fetch?"):
            query = parse_qs(urlsplit(path).query)
            ns = query["namespace"][0]
            records = self.vectors.get(ns, {})
            return e.canonical({"namespace": ns, "vectors": {vid: {"id": vid, "values": [0.1] * 1024,
                                "metadata": {k: v for k, v in records[vid].items() if k != "_id"}}
                               for vid in query["ids"] if vid in records}})
        namespace = path.split("/")[3]
        if path.endswith("/upsert"):
            records = [e.parse(line) for line in body.splitlines()]
            self.vectors.setdefault(namespace, {}).update({r["_id"]: r for r in records})
            return b""
        filters = body["query"]["filter"]
        records = [r for r in self.vectors[namespace].values() if all(r.get(k) == v["$eq"] for k, v in filters.items())]
        hits = [{"_id": r["_id"], "_score": 0.7, "fields": {k: r[k] for k in body["fields"]}} for r in records[:4]]
        if self.mutate_hit:
            self.mutate_hit(hits)
        return e.canonical({"result": {"hits": hits}})


class EvidenceTests(unittest.TestCase):
    def setUp(self):
        self.config, self.plan = setup_data()
        self.cloud = FakeCloud(self.config, self.plan)
        self.reader = e.Reader(self.config, self.cloud, now=lambda: NOW)

    def assert_withheld(self):
        result = self.reader.retrieve("Synthetic record question")
        self.assertEqual(result["status"], "unavailable")
        self.assertEqual(result["evidence"], [])
        return result

    def test_pinned_fixture_and_six_records(self):
        self.assertEqual(sum(len(s["passages"]) for s in self.plan["scopes"]), 6)
        self.assertEqual(self.plan, e.build_seed_plan(FIXTURE.read_bytes(), self.config.target))

    def test_pending_template_and_sql_contract(self):
        target = e.parse((ROOT / "evaluations/cloud-integration/resource-target.template.json").read_bytes())
        sql = (ROOT / "infra/cloud/001-neuvetra-research-dev.sql").read_text(encoding="utf-8")
        self.assertEqual(target["bucket"], "neuvetra-research-dev")
        self.assertIn("bucket = '" + target["bucket"] + "'", sql)
        self.assertEqual(target["pinecone_host"], "neuvetra-ghg-dev-0msj1fa.svc.aped-4627-b74a.pinecone.io")
        self.assertFalse(target["synthetic_use_approved"])
        with self.assertRaises(e.GateError):
            raw = e.canonical(target)
            e.Config(raw, e.sha(raw), self.config.secrets)

    def test_source_identity_cannot_redirect_citation(self):
        self.cloud.rows["research_sources"][0]["canonical_url"] = "https://attacker.example/"
        self.assert_withheld()

    def test_paraphrase_contract_offline_only(self):
        for case in e.parse(FIXTURE.read_bytes())["semantic_cases"]:
            self.cloud.scope = self.plan["scopes"][0 if case["scope_label"] == "A" else 1]["scope_id"]
            result = self.reader.retrieve(case["question"])
            self.assertEqual(result["status"], "evidence", result)
            found = {p["passage_id"] for p in result["evidence"]}
            self.assertTrue(set(case["required_passage_ids"]) <= found)
            self.assertFalse(set(case["forbidden_passage_ids"]) & found)
            self.assertFalse(result["generated_answer"])

    def test_search_always_explicit_namespace_and_all_filters(self):
        self.reader.retrieve("Synthetic record question")
        call = next(c for c in self.cloud.calls if c[2].endswith("/search"))
        scope = self.plan["scopes"][0]
        self.assertIn(scope["namespace"], call[2])
        self.assertEqual(call[3]["query"]["top_k"], 4)
        self.assertEqual(set(call[3]["query"]["filter"]), {"scope_id", "release_sha256", "profile_sha256", "is_active"})
        self.assertNotIn("text", call[3]["fields"])

    def test_dependency_added_when_not_a_candidate(self):
        self.cloud.mutate_hit = lambda hits: hits.__setitem__(slice(None), [h for h in hits if h["fields"]["passage_id"] == "A01"])
        result = self.reader.retrieve("Synthetic record question")
        self.assertEqual(result["candidate_ids"], ["A01"])
        self.assertEqual({x["passage_id"] for x in result["evidence"]}, {"A01", "A02"})

    def test_foreign_returned_hit(self):
        self.cloud.mutate_hit = lambda hits: hits[0]["fields"].update(scope_id=self.plan["scopes"][1]["scope_id"])
        self.assert_withheld()

    def test_wrong_profile_filter_result(self):
        self.cloud.mutate_hit = lambda hits: hits[0]["fields"].update(profile_sha256="0" * 64)
        self.assert_withheld()

    def test_inactive_returned_hit(self):
        self.cloud.mutate_hit = lambda hits: hits[0]["fields"].update(is_active=False)
        self.assert_withheld()

    def test_pinecone_text_cannot_replace_evidence(self):
        self.cloud.mutate_hit = lambda hits: hits[0]["fields"].update(text="UNTRUSTED REPLACEMENT")
        result = self.reader.retrieve("Synthetic record question")
        self.assertEqual(result["status"], "evidence")
        self.assertNotIn("UNTRUSTED REPLACEMENT", json.dumps(result))

    def test_source_bytes_corrupt(self):
        obj = self.plan["scopes"][0]["objects"][0]
        self.cloud.objects[obj["object_key"]] = b"corrupt"
        self.assert_withheld()

    def test_wrong_locator_projection(self):
        self.cloud.rows["research_passages"][0]["spans"][0]["start"] += 1
        self.assert_withheld()

    def test_missing_dependency(self):
        self.cloud.rows["research_passages"] = [p for p in self.cloud.rows["research_passages"] if p["passage_id"] != "A02"]
        self.assert_withheld()

    def test_pending_source(self):
        self.cloud.rows["research_sources"][0]["review_status"] = "candidate"
        self.assert_withheld()

    def test_expired_review_before_search(self):
        self.cloud.rows["research_releases"][0]["review_expires_at"] = "2020-01-01T00:00:00Z"
        self.assert_withheld()
        self.assertFalse(any(c[0] == "pinecone" for c in self.cloud.calls))

    def test_profile_truncation_refused(self):
        self.cloud.description["embed"]["read_parameters"]["truncate"] = "END"
        self.assert_withheld()

    def test_provider_refusal_no_local_fallback(self):
        for origin in ("supabase", "pinecone"):
            self.cloud.failure = origin
            with patch("builtins.open", side_effect=AssertionError("local fallback forbidden")):
                self.assert_withheld()

    def test_no_result_does_not_relax_filters(self):
        self.cloud.mutate_hit = lambda hits: hits.clear()
        result = self.reader.retrieve("Synthetic record question")
        self.assertEqual(result["status"], "no_result")
        self.assertEqual(len([c for c in self.cloud.calls if c[0] == "pinecone"]), 1)

    def test_admin_identity_refused(self):
        self.config.secrets = e.Secrets("fake", "sb_publishable_fake", token("service_role"))
        self.assert_withheld()
        self.assertEqual(self.cloud.calls, [])

    def test_overlong_text_before_dispatch(self):
        result = self.reader.retrieve("a" * (e.MAX_TEXT_BYTES + 1))
        self.assertEqual(result["reason"], "question_refused")
        self.assertEqual(self.cloud.calls, [])

    def test_target_pin_and_cloud_host_boundary(self):
        for change in ({"pinecone_host": "http://127.0.0.1"}, {"pinecone_host": "safe.pinecone.io.attacker.example"}, {"supabase_host": "other.example"}, {"status": "candidate"}):
            target = dict(self.config.target, **change)
            data = e.canonical(target)
            with self.assertRaises(e.GateError):
                e.Config(data, e.sha(data), self.config.secrets)
        with self.assertRaises(e.GateError):
            e.Config(e.canonical(self.config.target), "0" * 64, self.config.secrets)

    def test_idempotent_publication_does_not_activate_or_approve(self):
        self.cloud.objects = {}
        self.cloud.vectors = {}
        before = copy.deepcopy(self.cloud.rows)
        for _ in range(2):
            receipts = e.publish_artifacts(self.config, self.cloud, self.plan)
            self.assertTrue(all(r["activated"] is False for r in receipts))
        self.assertEqual(len(self.cloud.objects), 6)
        self.assertEqual(sum(len(v) for v in self.cloud.vectors.values()), 6)
        self.assertEqual(self.cloud.rows, before)
        self.assertTrue(all(r["activated"] is False for r in e.verify_published_once(self.config, self.cloud, self.plan)))

    def test_changed_bytes_refused_before_write(self):
        plan = copy.deepcopy(self.plan)
        plan["scopes"][0]["objects"][0]["bytes"] = b"changed"
        with self.assertRaises(e.GateError):
            e.publish_artifacts(self.config, self.cloud, plan)
        self.assertEqual(self.cloud.calls, [])

    def test_full_plan_tamper_rejected_before_any_io(self):
        mutations = [lambda p: p["scopes"][0]["records"][0].update(text="unapproved"),
                     lambda p: p["scopes"].pop(),
                     lambda p: p["scopes"][0]["records"].pop(),
                     lambda p: p["scopes"][0]["passages"][0].update(review_status="approved"),
                     lambda p: p["scopes"][1]["objects"][0].update(object_key="foreign/path"),
                     lambda p: p["scopes"][0]["objects"][0].update(object_key=p["scopes"][0]["objects"][0]["object_key"].replace("source.txt", "release.json"))]
        for mutate in mutations:
            for operation in (e.publish_artifacts, e.verify_published_once):
                with self.subTest(operation=operation.__name__, mutation=mutations.index(mutate)):
                    plan = copy.deepcopy(self.plan)
                    mutate(plan)
                    with self.assertRaises(e.GateError):
                        operation(self.config, self.cloud, plan)
                    self.assertEqual(self.cloud.calls, [])

    def test_config_view_cannot_mutate_approved_host(self):
        changed = self.config.target
        changed["pinecone_host"] = "attacker.example"
        self.assertNotEqual(self.config.target["pinecone_host"], "attacker.example")

    def test_existing_object_conflict_not_overwritten(self):
        key = self.plan["scopes"][0]["objects"][0]["object_key"]
        self.cloud.objects[key] = b"wrong"
        with self.assertRaises(e.GateError):
            e.publish_artifacts(self.config, self.cloud, self.plan)
        self.assertEqual(self.cloud.objects[key], b"wrong")

    def test_publication_typed_object_missing_only_allows_owned_object_create(self):
        for kind in ("object", "bucket"):
            cloud = FakeCloud(self.config, self.plan)
            cloud.objects = {}
            original = cloud.request
            def request(*args, **kwargs):
                try:
                    return original(*args, **kwargs)
                except e.ProviderStatus as error:
                    if error.status == 404:
                        raise e.StorageMissing(kind)
                    raise
            cloud.request = request
            if kind == "object":
                self.assertEqual(len(e.publish_artifacts(self.config, cloud, self.plan)), 2)
                self.assertEqual(len(cloud.objects), 6)
            else:
                with self.assertRaises(e.StorageMissing):
                    e.publish_artifacts(self.config, cloud, self.plan)
                self.assertFalse(any(c[0] == "supabase" and c[1] == "POST" for c in cloud.calls))

    def test_interrupted_write_has_no_activation(self):
        self.cloud.failure = "pinecone"
        before = copy.deepcopy(self.cloud.rows)
        with self.assertRaises(e.GateError):
            e.publish_artifacts(self.config, self.cloud, self.plan)
        self.assertEqual(self.cloud.rows, before)

    def test_stage_projection_is_candidate(self):
        projection = e.stage_payload(self.plan, self.config.target, "2099-01-01T00:00:00Z")
        self.assertTrue(all(p["review_status"] == "pending" for p in projection["research_passages"]))
        self.assertTrue(all(p["status"] == "candidate" for p in projection["research_releases"]))
        self.assertTrue(all(p["state"] == "staged" for p in projection["research_ingestion_runs"]))
        self.assertNotIn("research_memberships", projection)
        self.assertNotIn("research_active_builds", projection)
        json.dumps(projection)

    def test_stage_projection_rejects_post_plan_approval(self):
        plan = copy.deepcopy(self.plan)
        plan["scopes"][0]["passages"][0]["review_status"] = "approved"
        with self.assertRaises(e.GateError):
            e.stage_payload(plan, self.config.target, "2099-01-01T00:00:00Z")
        self.assertEqual(self.cloud.calls, [])


class TransportTests(unittest.TestCase):
    def test_typed_storage_missing_is_bound_to_exact_get_route_code_and_status(self):
        config, _ = setup_data()
        bucket = config.target["bucket"]
        bucket_path = "/storage/v1/bucket/" + bucket
        object_path = "/storage/v1/object/authenticated/" + bucket + "/owned/path"
        cases = [
            ("supabase", "GET", bucket_path, {"statusCode": "404", "code": "NoSuchBucket", "message": "private_provider_detail"}, "bucket"),
            ("supabase", "GET", object_path, {"statusCode": 404, "code": "NoSuchKey"}, "object"),
            ("supabase", "GET", bucket_path, {"statusCode": "404", "code": "NoSuchKey"}, None),
            ("supabase", "GET", object_path, {"statusCode": "404", "code": "NoSuchBucket"}, None),
            ("supabase", "GET", bucket_path, {"statusCode": "403", "code": "NoSuchBucket"}, None),
            ("supabase", "GET", bucket_path, {"statusCode": "404", "code": "AccessDenied"}, None),
            ("supabase", "GET", "/storage/v1/bucket/foreign", {"statusCode": "404", "code": "NoSuchBucket"}, None),
            ("supabase", "POST", bucket_path, {"statusCode": "404", "code": "NoSuchBucket"}, None),
            ("supabase", "GET", "/auth/v1/user", {"statusCode": "404", "code": "NoSuchBucket"}, None),
            ("pinecone", "GET", bucket_path, {"statusCode": "404", "code": "NoSuchBucket"}, None),
        ]
        for origin, method, path, body, kind in cases:
            reads = []
            class Response:
                status = 400
                def getheader(self, name): return "application/json" if name == "Content-Type" else None
                def read(self, size): reads.append(size); return e.canonical(body)
            class Connection:
                def __init__(self, *a, **k): pass
                def request(self, *a, **k): pass
                def getresponse(self): return Response()
                def close(self): pass
            transport = e.Transport(config)
            with patch.object(e.http.client, "HTTPSConnection", Connection):
                with self.assertRaises(e.ProviderStatus) as caught:
                    transport.request(origin, method, path)
            self.assertEqual(isinstance(caught.exception, e.StorageMissing), kind is not None)
            if kind:
                self.assertEqual(caught.exception.resource_kind, kind)
            self.assertLessEqual(len(reads), 1)
            self.assertNotIn("private_provider_detail", json.dumps(transport.events) + str(caught.exception))

    def test_oversized_or_non_json_missing_error_remains_http400(self):
        config, _ = setup_data()
        for content_type, raw in [("text/plain", b'{}'), ("application/json", b'x' * 2049), ("application/json", b'not json')]:
            class Response:
                status = 400
                def getheader(self, name): return content_type if name == "Content-Type" else None
                def read(self, size): self.asserted_size = size; return raw
            class Connection:
                def __init__(self, *a, **k): pass
                def request(self, *a, **k): pass
                def getresponse(self): return Response()
                def close(self): pass
            with patch.object(e.http.client, "HTTPSConnection", Connection):
                with self.assertRaises(e.ProviderStatus) as caught:
                    e.Transport(config).request("supabase", "GET", "/storage/v1/bucket/" + config.target["bucket"])
            self.assertNotIsInstance(caught.exception, e.StorageMissing)

    def test_modern_admin_apikey_only_preserves_legacy_and_reader_bearer_paths(self):
        base, _ = setup_data()
        captures = []
        class Response:
            status = 200
            def getheader(self, name): return None
            def read(self, count): return b'{}'
        class Connection:
            def __init__(self, host, **kwargs): pass
            def request(self, method, path, **kwargs): captures.append(kwargs["headers"])
            def getresponse(self): return Response()
            def close(self): pass
        modern = "sb_secret_synthetic_only_1234567890"
        legacy = token("service_role")
        for admin_key in (modern, legacy):
            config = e.Config(base._target_bytes, base.pin, e.Secrets("fake-pinecone", "sb_publishable_fake", token(), admin_key))
            transport = e.Transport(config)
            with patch.object(e.http.client, "HTTPSConnection", Connection):
                transport.request("supabase", "GET", "/storage/v1/bucket/neuvetra-research-dev")
                transport.request("supabase", "GET", "/auth/v1/user", reader=True)
            self.assertEqual(captures[-2]["apikey"], admin_key)
            if admin_key == modern:
                self.assertNotIn("Authorization", captures[-2])
            else:
                self.assertEqual(captures[-2]["Authorization"], "Bearer " + legacy)
            self.assertEqual(captures[-1]["apikey"], "sb_publishable_fake")
            self.assertEqual(captures[-1]["Authorization"], "Bearer " + token())
            self.assertNotIn(admin_key, json.dumps(transport.events))

    def test_redirect_refused_without_followup_or_body_exposure(self):
        config, _ = setup_data()
        class Response:
            status = 302
            def getheader(self, name):
                return "https://attacker.example/secret" if name == "Location" else None
            def read(self, count):
                raise AssertionError("must not read rejected response body")
        class Connection:
            calls = []
            def __init__(self, host, **kwargs):
                self.calls.append((host, kwargs))
            def request(self, method, path, **kwargs):
                self.request_headers = kwargs["headers"]
            def getresponse(self):
                return Response()
            def close(self):
                pass
        t = e.Transport(config)
        with patch.object(e.http.client, "HTTPSConnection", Connection):
            with self.assertRaises(e.ProviderStatus) as error:
                t.request("pinecone", "GET", "/safe")
        self.assertEqual(str(error.exception), "provider_http_302")
        self.assertEqual(len(Connection.calls), 1)
        self.assertEqual(Connection.calls[0][0], config.target["pinecone_host"])
        self.assertNotIn("fake-pinecone-secret", json.dumps(t.events))
        self.assertNotIn("attacker", json.dumps(t.events))

    def test_destination_and_path_rejected_before_network(self):
        config, _ = setup_data()
        with patch.object(e.http.client, "HTTPSConnection", side_effect=AssertionError("network forbidden")):
            for origin, path in (("cloud-fallback", "/x"), ("pinecone", "//attacker.example"), ("pinecone", "/x\r\nInjected: true")):
                with self.assertRaises(e.GateError):
                    e.Transport(config).request(origin, "GET", path)


if __name__ == "__main__":
    unittest.main()
