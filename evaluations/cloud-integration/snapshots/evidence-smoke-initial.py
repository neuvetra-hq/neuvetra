"""Isolated synthetic cloud evidence primitives. Importing performs no I/O.

No environment loading, SDK defaults, local source fallback, or generation client.
The coordinator supplies an independently reviewed target pin and secrets in memory.
"""
from __future__ import annotations

import base64
import copy
from dataclasses import dataclass, field
from datetime import datetime, timezone
import hashlib
import http.client
import json
import math
import re
import ssl
import unicodedata
from urllib.parse import quote, urlencode
import uuid

SCHEMA = "neuvetra_research_dev"
API_VERSION = "2026-04"
PROFILE = {
    "api_version": API_VERSION, "model": "llama-text-embed-v2",
    "dimension": 1024, "metric": "cosine", "field_map": {"text": "text"},
    "read_parameters": {"input_type": "query", "dimension": 1024, "truncate": "NONE"},
    "write_parameters": {"input_type": "passage", "dimension": 1024, "truncate": "NONE"},
}
MAX_BYTES = 1_000_000
MAX_TEXT_BYTES = 4_000  # Conservative fixture boundary, not a tokenizer guarantee.
HEX = re.compile(r"[0-9a-f]{64}\Z")


class GateError(Exception):
    """Contains a fixed safe code, never a provider body or credential."""


class ProviderStatus(GateError):
    def __init__(self, status):
        self.status = status
        super().__init__("provider_http_" + str(status))


def require(ok, code):
    if not ok:
        raise GateError(code)


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode("utf-8")


def sha(data):
    return hashlib.sha256(data).hexdigest()


def normalize(text):
    return " ".join(unicodedata.normalize("NFKC", text).split())


def parse(data):
    def pairs(items):
        result = {}
        for key, value in items:
            require(key not in result, "duplicate_json_key")
            result[key] = value
        return result
    try:
        return json.loads(data, object_pairs_hook=pairs,
                          parse_constant=lambda _: (_ for _ in ()).throw(GateError("invalid_json_number")))
    except (ValueError, UnicodeError, TypeError):
        raise GateError("invalid_json") from None


def valid_uuid(value):
    try:
        return str(uuid.UUID(value)) == value
    except (ValueError, TypeError, AttributeError):
        return False


def not_expired(value, now):
    try:
        expiry = datetime.fromisoformat(value.replace("Z", "+00:00"))
        require(expiry.tzinfo is not None and expiry > now, "review_expired")
    except (ValueError, TypeError, AttributeError):
        raise GateError("invalid_review_deadline") from None


@dataclass(frozen=True)
class Secrets:
    pinecone_key: str = field(default="", repr=False)
    supabase_publishable_key: str = field(default="", repr=False)
    reader_jwt: str = field(default="", repr=False)
    ingestion_key: str = field(default="", repr=False)


class Config:
    def __init__(self, manifest_bytes, approved_sha256, secrets):
        require(HEX.fullmatch(approved_sha256 or "") and sha(manifest_bytes) == approved_sha256, "target_pin_mismatch")
        m = parse(manifest_bytes)
        require(m.get("status") == "approved_synthetic_development" and m.get("synthetic_use_approved") is True, "target_not_approved")
        require(m.get("schema") == SCHEMA and m.get("profile") == PROFILE, "wrong_profile")
        require(m.get("profile_sha256") == sha(canonical(PROFILE)), "profile_pin_mismatch")
        require(HEX.fullmatch(m.get("fixture_sha256", "")), "fixture_pin_missing")
        sb = m.get("supabase_host", "")
        pc = m.get("pinecone_host", "")
        require(re.fullmatch(r"[a-z0-9]{20}\.supabase\.co", sb), "wrong_supabase_host")
        require(re.fullmatch(r"[a-z0-9-]+\.svc\.[a-z0-9-]+\.pinecone\.io", pc), "wrong_pinecone_host")
        require(re.fullmatch(r"[a-z0-9-]{1,45}", m.get("pinecone_index", "")), "wrong_index_name")
        require(re.fullmatch(r"neuvetra-[a-z0-9-]+", m.get("bucket", "")), "wrong_bucket")
        require(re.fullmatch(r"[a-z0-9-]{8,60}", m.get("run_prefix", "")), "wrong_run_prefix")
        for sid, build in m.get("builds", {}).items():
            require(valid_uuid(sid) and valid_uuid(build.get("build_id")), "wrong_build")
            require(build.get("namespace") == "nv-" + build["build_id"].replace("-", ""), "wrong_namespace")
            require(all(HEX.fullmatch(build.get(k, "")) for k in ("release_sha256", "profile_sha256", "manifest_sha256")), "wrong_build_pin")
            require(build["profile_sha256"] == m["profile_sha256"], "wrong_profile")
        self._target_bytes = bytes(manifest_bytes)
        self.pin = approved_sha256
        self.secrets = secrets

    @property
    def target(self):
        # Callers cannot mutate a previously approved target through this view.
        return parse(self._target_bytes)


class Transport:
    """Direct TLS sockets: HTTP proxy variables and redirects are never used."""
    def __init__(self, config):
        self.config = config
        self.events = []

    def request(self, origin, method, path, body=None, *, reader=False, ndjson=False):
        targets = {"pinecone": self.config.target["pinecone_host"],
                   "control": "api.pinecone.io", "supabase": self.config.target["supabase_host"]}
        require(origin in targets and method in {"GET", "POST"}, "destination_refused")
        require(isinstance(path, str) and path.startswith("/") and not path.startswith("//")
                and not any(c in path for c in "\r\n#\\"), "path_refused")
        raw = body if isinstance(body, bytes) else canonical(body) if body is not None else None
        require(raw is None or len(raw) <= MAX_BYTES, "request_too_large")
        # Destination validation precedes credential selection/attachment.
        headers = {"Accept": "application/json"}
        if origin in {"pinecone", "control"}:
            require(bool(self.config.secrets.pinecone_key), "pinecone_key_missing")
            headers.update({"Api-Key": self.config.secrets.pinecone_key, "X-Pinecone-Api-Version": API_VERSION})
        elif reader:
            check_reader_secrets(self.config.secrets)
            headers.update({"apikey": self.config.secrets.supabase_publishable_key,
                            "Authorization": "Bearer " + self.config.secrets.reader_jwt,
                            "Accept-Profile": SCHEMA})
        else:
            require(bool(self.config.secrets.ingestion_key), "ingestion_key_missing")
            headers.update({"apikey": self.config.secrets.ingestion_key,
                            "Authorization": "Bearer " + self.config.secrets.ingestion_key,
                            "Accept-Profile": SCHEMA, "Content-Profile": SCHEMA})
        if raw is not None:
            headers["Content-Type"] = "application/x-ndjson" if ndjson else "application/octet-stream" if isinstance(body, bytes) else "application/json"
        connection = http.client.HTTPSConnection(targets[origin], timeout=15, context=ssl.create_default_context())
        event = {"origin": origin, "method": method, "request_bytes": len(raw or b""), "status": "started"}
        self.events.append(event)
        try:
            connection.request(method, path, body=raw, headers=headers)
            response = connection.getresponse()
            event["http_status"] = response.status
            rid = response.getheader("x-pinecone-request-id") or response.getheader("sb-request-id")
            if rid and re.fullmatch(r"[A-Za-z0-9_-]{1,100}", rid):
                event["provider_request_id"] = rid
            if not 200 <= response.status < 300:
                raise ProviderStatus(response.status)
            result = response.read(MAX_BYTES + 1)
            require(len(result) <= MAX_BYTES, "response_too_large")
            event["status"] = "complete"
            return result
        except GateError:
            event["status"] = "refused"
            raise
        except (OSError, http.client.HTTPException):
            event["status"] = "unavailable"
            raise GateError("provider_unavailable") from None
        finally:
            connection.close()


def check_reader_secrets(secrets):
    require(bool(secrets.reader_jwt) and bool(secrets.supabase_publishable_key), "reader_identity_missing")
    require(not secrets.supabase_publishable_key.startswith("sb_secret_"), "admin_reader_refused")
    try:
        segment = secrets.reader_jwt.split(".")[1]
        claims = parse(base64.urlsafe_b64decode(segment + "=" * (-len(segment) % 4)))
        require(claims.get("role") == "authenticated", "admin_reader_refused")
    except (IndexError, ValueError, TypeError):
        raise GateError("reader_token_malformed") from None
    # Decoding is deny-only. Supabase Auth /user actually authenticates the JWT.


def verify_index(transport, config):
    t = config.target
    data = parse(transport.request("control", "GET", "/indexes/" + quote(t["pinecone_index"], safe="")))
    require(data.get("name") == t["pinecone_index"] and data.get("host") == t["pinecone_host"], "described_target_mismatch")
    require(data.get("status", {}).get("ready") is True, "index_not_ready")
    require(data.get("dimension") == 1024 and data.get("metric") == "cosine", "described_profile_mismatch")
    embed = data.get("embed", {})
    require(embed.get("model") == PROFILE["model"] and embed.get("field_map") == PROFILE["field_map"], "described_profile_mismatch")
    for key in ("read_parameters", "write_parameters"):
        require(embed.get(key) == PROFILE[key], "described_profile_mismatch")
    return {"host": data["host"], "profile_sha256": t["profile_sha256"], "verified": True}


def build_seed_plan(fixture_bytes, target):
    """Pure dry-run. Produces immutable objects and staged projection; no approval."""
    require(sha(fixture_bytes) == target["fixture_sha256"], "fixture_pin_mismatch")
    fixture = parse(fixture_bytes)
    require(fixture.get("fixture_id") == "cloud-evidence-synthetic-v1" and fixture.get("live_authorization") is False, "wrong_fixture")
    require(fixture.get("top_k") == 4 and target["profile"] == PROFILE, "wrong_profile")
    profile_hash = sha(canonical(PROFILE))
    result = {"fixture_sha256": sha(fixture_bytes), "profile_sha256": profile_hash, "scopes": []}
    require(len(fixture["scopes"]) == 2 and sum(len(s["passages"]) for s in fixture["scopes"]) == 6, "wrong_fixture_size")
    for scope in fixture["scopes"]:
        sid = scope["scope_id"]
        require(valid_uuid(sid), "wrong_scope")
        source = (scope["title"] + "\n\n" + "\n\n".join(p["text"] for p in scope["passages"]) + "\n").encode("utf-8")
        page = normalize(source.decode("utf-8"))
        extraction = canonical({"source_sha256": sha(source), "normalization": "nfkc_whitespace_v1", "pages": [{"page": 1, "text": page}]})
        passages = []
        for p in scope["passages"]:
            text = normalize(p["text"])
            require(len(text.encode("utf-8")) <= MAX_TEXT_BYTES and page.count(text) == 1, "invalid_passage")
            start = page.index(text)
            passages.append({"passage_id": p["id"], "text": text, "text_sha256": sha(text.encode("utf-8")),
                             "source_sha256": sha(source), "extraction_sha256": sha(extraction),
                             "locator": "Synthetic document page 1 / " + p["id"],
                             "spans": [{"page": 1, "start": start, "end": start + len(text), "page_sha256": sha(page.encode("utf-8"))}],
                             "dependency_ids": p["dependency_ids"], "is_active": p["is_active"],
                             "qualifications": ["Fictional test content; not greenhouse-gas guidance."]})
        ids = {p["passage_id"] for p in passages}
        require(len(ids) == len(passages), "duplicate_passage")
        require(all(set(p["dependency_ids"]) <= ids for p in passages), "missing_dependency")
        release = canonical({"fixture_sha256": sha(fixture_bytes), "scope_id": sid, "source_sha256": sha(source),
                             "extraction_sha256": sha(extraction), "passages": passages})
        rh = sha(release)
        build_id = str(uuid.UUID(bytes=hashlib.sha256((target["run_prefix"] + sid + rh + profile_hash).encode()).digest()[:16]))
        namespace = "nv-" + build_id.replace("-", "")
        objects = []
        for kind, raw, suffix in [("source", source, "txt"), ("extraction", extraction, "json"), ("release", release, "json")]:
            oh = sha(raw)
            objects.append({"scope_id": sid, "object_sha256": oh, "kind": kind, "byte_size": len(raw),
                            "bucket": target["bucket"], "object_key": f"{sid}/sha256/{oh}/{kind}.{suffix}", "bytes": raw})
        rows = []
        records = []
        for p in passages:
            vid = sha((sid + rh + p["passage_id"]).encode("utf-8"))
            rows.append(dict(p, scope_id=sid, release_sha256=rh, build_id=build_id, vector_id=vid, review_status="pending"))
            records.append({"_id": vid, "text": p["text"], "scope_id": sid, "release_sha256": rh,
                            "profile_sha256": profile_hash, "passage_id": p["passage_id"],
                            "text_sha256": p["text_sha256"], "is_active": p["is_active"]})
        scope_plan = {"scope_id": sid, "build_id": build_id, "namespace": namespace, "release_sha256": rh,
                      "profile_sha256": profile_hash, "source_sha256": sha(source), "extraction_sha256": sha(extraction),
                      "passages": rows, "objects": objects, "records": records, "status": "staged",
                      "expected_active_passage_ids": sorted(p["passage_id"] for p in passages if p["is_active"])}
        scope_plan["manifest_sha256"] = sha(canonical({k: v for k, v in scope_plan.items() if k != "objects"}))
        result["scopes"].append(scope_plan)
    return result


def stage_payload(plan, target, review_expires_at):
    """JSON-safe table rows for the DB owner's transaction; no approval/grants.

    Identities/memberships are provisioned independently, never inferred here.
    """
    _validate_plan(target, plan)
    not_expired(review_expires_at, datetime.now(timezone.utc))
    tables = {name: [] for name in ("research_scopes", "research_objects", "research_sources",
                                   "research_releases", "research_passages", "research_ingestion_runs")}
    for scope in plan["scopes"]:
        sid = scope["scope_id"]
        label = "a" if sid.endswith("00a") else "b"
        tables["research_scopes"].append({"scope_id": sid, "label": "synthetic-" + label, "is_synthetic": True})
        tables["research_objects"].extend({k: v for k, v in o.items() if k != "bytes"} for o in scope["objects"])
        source = next(o for o in scope["objects"] if o["kind"] == "source")
        tables["research_sources"].append({"scope_id": sid, "source_sha256": scope["source_sha256"],
            "source_id": "synthetic-" + label, "title": source["bytes"].decode("utf-8").splitlines()[0],
            "canonical_url": "https://" + target["supabase_host"] + "/storage/v1/object/authenticated/" + quote(source["bucket"], safe="") + "/" + quote(source["object_key"], safe="/"),
            "version": "synthetic-v1", "review_status": "pending"})
        tables["research_releases"].append({k: scope[k] for k in ("scope_id", "release_sha256", "build_id", "profile_sha256", "namespace")} |
            {"version": "synthetic-v1", "status": "candidate", "review_expires_at": review_expires_at, "commercial_runtime_approval": False})
        tables["research_passages"].extend(copy.deepcopy(scope["passages"]))
        tables["research_ingestion_runs"].append({k: scope[k] for k in ("scope_id", "build_id", "release_sha256", "manifest_sha256")} |
            {"expected_passage_ids": scope["expected_active_passage_ids"], "state": "staged"})
    return tables


def object_path(config, obj, authenticated):
    return _object_path(config.target, obj, authenticated)


def _object_path(target, obj, authenticated):
    require(obj["bucket"] == target["bucket"] and valid_uuid(obj["scope_id"]), "foreign_object")
    expected = f"{obj['scope_id']}/sha256/{obj['object_sha256']}/"
    filenames = {"source": "source.txt", "extraction": "extraction.json", "release": "release.json"}
    require(HEX.fullmatch(obj["object_sha256"]) and obj["object_key"].startswith(expected)
            and obj.get("kind") in filenames and obj["object_key"] == expected + filenames[obj["kind"]], "object_path_refused")
    return "/storage/v1/object/" + ("authenticated/" if authenticated else "") + quote(obj["bucket"], safe="") + "/" + quote(obj["object_key"], safe="/")


def publish_artifacts(config, transport, plan):
    """Explicit immutable uploads + idempotent vectors; NEVER changes approval/pointer.

    Coordinator must stage the DB projection first. Existing object bytes are checked
    before reuse. HTTP failures do not trigger overwrite or alternate destinations.
    """
    validate_plan(config, plan)
    verify_index(transport, config)
    receipts = []
    for scope in plan["scopes"]:
        require(config.target["builds"].get(scope["scope_id"]) == binding(scope), "unapproved_build")
        for obj in scope["objects"]:
            require(sha(obj["bytes"]) == obj["object_sha256"] and len(obj["bytes"]) == obj["byte_size"], "source_hash_mismatch")
            try:
                downloaded = transport.request("supabase", "GET", object_path(config, obj, True))
            except ProviderStatus as error:
                if error.status != 404:
                    raise
                try:
                    transport.request("supabase", "POST", object_path(config, obj, False), obj["bytes"])
                except ProviderStatus as conflict:
                    if conflict.status not in (400, 409):
                        raise
                    # A concurrent no-overwrite upload may already exist. Only
                    # exact downloaded bytes below can establish safe reuse.
                downloaded = transport.request("supabase", "GET", object_path(config, obj, True))
            require(sha(downloaded) == obj["object_sha256"] and len(downloaded) == obj["byte_size"], "source_hash_mismatch")
        data = b"\n".join(canonical(r) for r in scope["records"]) + b"\n"
        transport.request("pinecone", "POST", f"/records/namespaces/{scope['namespace']}/upsert", data, ndjson=True)
        receipts.append({"scope_id": scope["scope_id"], "build_id": scope["build_id"], "artifact_write_completed": True,
                         "readiness_verified": False, "activated": False})
    return receipts


def binding(scope):
    return {k: scope[k] for k in ("build_id", "namespace", "release_sha256", "profile_sha256", "manifest_sha256")}


def validate_plan(config, plan):
    """Revalidate complete approved content before any remote operation."""
    _validate_plan(config.target, plan)


def _validate_plan(target, plan):
    try:
        require(plan["fixture_sha256"] == target["fixture_sha256"] and plan["profile_sha256"] == target["profile_sha256"], "plan_pin_mismatch")
        scopes = plan["scopes"]
        require(len(scopes) == len(target["builds"]) == 2 and {s["scope_id"] for s in scopes} == set(target["builds"]), "plan_scope_mismatch")
        for scope in scopes:
            require(target["builds"][scope["scope_id"]] == binding(scope), "unapproved_build")
            actual = sha(canonical({k: v for k, v in scope.items() if k not in {"objects", "manifest_sha256"}}))
            require(actual == scope["manifest_sha256"], "plan_content_mismatch")
            expected = {"source": scope["source_sha256"], "extraction": scope["extraction_sha256"], "release": scope["release_sha256"]}
            require(len(scope["objects"]) == 3 and {o["kind"] for o in scope["objects"]} == set(expected), "plan_objects_mismatch")
            for obj in scope["objects"]:
                require(obj["scope_id"] == scope["scope_id"] and expected[obj["kind"]] == obj["object_sha256"], "plan_objects_mismatch")
                require(type(obj["byte_size"]) is int and isinstance(obj["bytes"], bytes)
                        and len(obj["bytes"]) == obj["byte_size"] and sha(obj["bytes"]) == obj["object_sha256"], "source_hash_mismatch")
                _object_path(target, obj, True)
    except (KeyError, TypeError, ValueError):
        raise GateError("plan_invalid") from None


def verify_published_once(config, transport, plan):
    """One bounded readiness check. Eventual consistency requires caller polling.

    No pointer activation is performed. The DB owner separately validates staged
    rows/approval and may activate after this result and independent checks.
    """
    validate_plan(config, plan)
    verify_index(transport, config)
    receipts = []
    for scope in plan["scopes"]:
        require(config.target["builds"].get(scope["scope_id"]) == binding(scope), "unapproved_build")
        query = urlencode([("namespace", scope["namespace"])] + [("ids", r["_id"]) for r in scope["records"]])
        data = parse(transport.request("pinecone", "GET", "/vectors/fetch?" + query))
        require(data.get("namespace") == scope["namespace"], "foreign_namespace")
        vectors = data.get("vectors", {})
        require(set(vectors) == {r["_id"] for r in scope["records"]}, "vectors_not_ready")
        for record in scope["records"]:
            vector = vectors[record["_id"]]
            require(vector.get("id") == record["_id"], "candidate_id_mismatch")
            require(all(vector.get("metadata", {}).get(k) == v for k, v in record.items() if k != "_id"), "vector_metadata_mismatch")
            values = vector.get("values", [])
            require(len(values) == 1024 and all(type(v) in (float, int) and math.isfinite(v) for v in values), "vector_profile_mismatch")
        receipts.append(dict(binding(scope), scope_id=scope["scope_id"], vectors_verified=True, activated=False))
    return receipts


class Reader:
    def __init__(self, config, transport, now=None):
        self.config, self.transport = config, transport
        self.now = now or (lambda: datetime.now(timezone.utc))

    def rows(self, table, filters):
        require(table in {"research_memberships", "research_active_builds", "research_releases", "research_objects", "research_sources", "research_passages"}, "table_refused")
        query = {k: "eq." + str(v) for k, v in filters.items()}
        query["select"] = "*"
        data = parse(self.transport.request("supabase", "GET", "/rest/v1/" + table + "?" + urlencode(query), reader=True))
        require(isinstance(data, list), "metadata_invalid")
        return data

    def one(self, table, filters):
        rows = self.rows(table, filters)
        require(len(rows) == 1 and all(rows[0].get(k) == v for k, v in filters.items()), "metadata_missing_or_foreign")
        return rows[0]

    def authorize(self):
        check_reader_secrets(self.config.secrets)
        user = parse(self.transport.request("supabase", "GET", "/auth/v1/user", reader=True))
        require(valid_uuid(user.get("id")), "identity_refused")
        memberships = self.rows("research_memberships", {"user_id": user["id"]})
        require(len(memberships) == 1 and memberships[0].get("user_id") == user["id"], "membership_refused")
        sid = memberships[0].get("scope_id")
        require(sid in self.config.target["builds"], "scope_refused")
        expected = self.config.target["builds"][sid]
        pointer = self.one("research_active_builds", {"scope_id": sid})
        require(all(pointer.get(k) == expected[k] for k in ("build_id", "release_sha256")), "inactive_or_foreign_build")
        release = self.one("research_releases", {"scope_id": sid, "release_sha256": expected["release_sha256"], "build_id": expected["build_id"]})
        require(release.get("status") == "approved" and release.get("profile_sha256") == self.config.target["profile_sha256"]
                and release.get("namespace") == expected["namespace"], "release_not_approved")
        not_expired(release.get("review_expires_at"), self.now())
        return sid, expected

    def object(self, sid, digest, cache, kind):
        if digest not in cache:
            row = self.one("research_objects", {"scope_id": sid, "object_sha256": digest})
            require(row.get("kind") == kind, "object_kind_mismatch")
            raw = self.transport.request("supabase", "GET", object_path(self.config, row, True), reader=True)
            require(sha(raw) == digest and len(raw) == row.get("byte_size"), "source_hash_mismatch")
            cache[digest] = raw
        return cache[digest]

    def resolve(self, sid, build, candidates):
        cache = {}
        released = parse(self.object(sid, build["release_sha256"], cache, "release"))
        require(released.get("scope_id") == sid and released.get("fixture_sha256") == self.config.target["fixture_sha256"], "release_object_mismatch")
        originals = {p["passage_id"]: p for p in released["passages"]}
        output, visiting = {}, set()
        def visit(pid):
            require(pid not in visiting, "dependency_cycle")
            if pid in output:
                return
            visiting.add(pid)
            row = self.one("research_passages", {"scope_id": sid, "release_sha256": build["release_sha256"], "build_id": build["build_id"], "passage_id": pid})
            require(row.get("is_active") is True and row.get("review_status") == "approved", "passage_not_approved")
            original = originals.get(pid)
            require(original is not None and all(row.get(k) == v for k, v in original.items()), "passage_projection_mismatch")
            require(row.get("vector_id") == sha((sid + build["release_sha256"] + pid).encode()), "vector_id_mismatch")
            source_row = self.one("research_sources", {"scope_id": sid, "source_sha256": row["source_sha256"]})
            require(source_row.get("review_status") == "approved", "source_not_approved")
            source = self.object(sid, row["source_sha256"], cache, "source")
            source_url = "https://" + self.config.target["supabase_host"] + "/storage/v1/object/authenticated/" + self.config.target["bucket"] + "/" + sid + "/sha256/" + row["source_sha256"] + "/source.txt"
            require(source_row.get("title") == source.decode("utf-8").splitlines()[0]
                    and source_row.get("version") == "synthetic-v1"
                    and source_row.get("source_id") == ("synthetic-a" if sid.endswith("00a") else "synthetic-b")
                    and source_row.get("canonical_url") == source_url, "source_identity_mismatch")
            extraction = parse(self.object(sid, row["extraction_sha256"], cache, "extraction"))
            require(extraction.get("source_sha256") == sha(source) and extraction.get("normalization") == "nfkc_whitespace_v1", "extraction_mismatch")
            require(len(extraction.get("pages", [])) == 1 and extraction["pages"][0].get("page") == 1, "extraction_mismatch")
            page = extraction["pages"][0].get("text")
            require(page == normalize(source.decode("utf-8")), "extraction_mismatch")
            parts = []
            for span in row["spans"]:
                require(span["page"] == 1 and type(span["start"]) is int and type(span["end"]) is int
                        and 0 <= span["start"] < span["end"] <= len(page), "locator_mismatch")
                require(sha(page.encode()) == span["page_sha256"], "locator_mismatch")
                parts.append(page[span["start"]:span["end"]])
            require("\n\n".join(parts) == row["text"] and sha(row["text"].encode()) == row["text_sha256"], "locator_mismatch")
            for dep in row["dependency_ids"]:
                visit(dep)
            output[pid] = {"passage_id": pid, "text": row["text"], "text_sha256": row["text_sha256"], "qualifications": row["qualifications"],
                           "citation": {"source_id": source_row["source_id"], "title": source_row["title"], "version": source_row["version"],
                                        "authenticated_source_url": source_url, "source_sha256": row["source_sha256"],
                                        "extraction_sha256": row["extraction_sha256"], "locator": row["locator"]}}
            visiting.remove(pid)
        for pid in candidates:
            visit(pid)
        return list(output.values())

    def retrieve(self, question):
        try:
            require(isinstance(question, str) and question.strip() and len(question.encode()) <= MAX_TEXT_BYTES, "question_refused")
            sid, build = self.authorize()
            verify_index(self.transport, self.config)
            filters = {"scope_id": {"$eq": sid}, "release_sha256": {"$eq": build["release_sha256"]},
                       "profile_sha256": {"$eq": build["profile_sha256"]}, "is_active": {"$eq": True}}
            payload = {"query": {"inputs": {"text": question}, "top_k": 4, "filter": filters},
                       "fields": ["passage_id", "scope_id", "release_sha256", "profile_sha256", "is_active", "text_sha256"]}
            data = parse(self.transport.request("pinecone", "POST", f"/records/namespaces/{build['namespace']}/search", payload))
            hits = data.get("result", {}).get("hits")
            require(isinstance(hits, list) and len(hits) <= 4, "search_invalid")
            if not hits:
                return {"status": "no_result", "evidence": [], "reason": "no_candidates"}
            ids = []
            for hit in hits:
                fields = hit.get("fields", {})
                require(all(fields.get(k) == rule["$eq"] for k, rule in filters.items()), "foreign_or_inactive_hit")
                pid = fields.get("passage_id")
                require(isinstance(pid, str) and pid not in ids and hit.get("_id") == sha((sid + build["release_sha256"] + pid).encode()), "candidate_id_mismatch")
                score = hit.get("_score")
                require(type(score) in (float, int) and math.isfinite(score), "search_invalid")
                ids.append(pid)
            evidence = self.resolve(sid, build, ids)
            evidence_hashes = {p["passage_id"]: p["text_sha256"] for p in evidence}
            require(all(evidence_hashes[h["fields"]["passage_id"]] == h["fields"].get("text_sha256") for h in hits), "vector_metadata_mismatch")
            return {"status": "evidence", "scope_id": sid, "release_sha256": build["release_sha256"],
                    "candidate_ids": ids, "evidence": evidence, "generated_answer": False}
        except (GateError, KeyError, TypeError, UnicodeError, ValueError, OverflowError) as error:
            return {"status": "unavailable", "evidence": [], "reason": str(error) if isinstance(error, GateError) else "metadata_invalid"}
