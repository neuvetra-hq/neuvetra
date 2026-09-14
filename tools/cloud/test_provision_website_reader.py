"""Offline single-account creation checks; no credentials or live calls."""
import base64
import copy
import importlib.util
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location("provision_website_reader", Path(__file__).with_name("provision-website-reader.py"))
auth = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = auth
SPEC.loader.exec_module(auth)
PASSWORD = "Synthetic-Private-Reader-123456!"
USER = "90000000-0000-4000-8000-000000000009"
KEY = "sb_secret_syntheticKeyMaterial0123456789"


def jwt(role="service_role", ref=auth.PROJECT_REF):
    payload = base64.urlsafe_b64encode(json.dumps({"role": role, "ref": ref}).encode()).decode().rstrip("=")
    return "header." + payload + ".syntheticSignature"


def user():
    return {"id": USER, "email": auth.EMAIL, "role": "authenticated", "is_anonymous": False,
            "email_confirmed_at": "2026-09-09T07:00:00Z", "app_metadata": dict(auth.APP_METADATA)}


class Fake:
    def __init__(self, output=None, error=None, before=None):
        self.output, self.error, self.before, self.calls = output, error, before, []

    def create(self, body):
        auth.validate_body(body)
        if self.before:
            self.before()
        self.calls.append(copy.deepcopy(body))
        if self.error:
            raise self.error
        return user() if self.output is None else copy.deepcopy(self.output)


class ProvisionTests(unittest.TestCase):
    def test_one_exact_account_journaled_before_creation_then_id_before_completion(self):
        state, records = auth.prepare(PASSWORD), []
        fake = Fake(before=lambda: self.assertEqual([r["phase"] for r in records], ["pending", "create_started"]))
        result = auth.provision(auth.Config(KEY), state, records.append, transport=fake)
        self.assertEqual(result["status"], "created")
        self.assertEqual([r["phase"] for r in records], ["pending", "create_started", "create_id_returned_unverified", "created"])
        self.assertEqual(records[2]["auth_user_id"], USER)
        self.assertEqual(len(fake.calls), 1)
        self.assertEqual(fake.calls[0], {"email": "neuvetra-website-epa-20260909@neuvetra.invalid", "password": PASSWORD,
            "role": "authenticated", "email_confirm": True, "app_metadata": {"scope_id": auth.SCOPE_ID, "run_marker": auth.RUN_MARKER, "kind": "private_research_reader"}})
        self.assertEqual(result["attempts"], 1)
        self.assertEqual(result["signins"], 0)
        self.assertEqual(result["membership_writes"], 0)
        self.assertNotIn(PASSWORD, json.dumps(result) + repr(state) + repr(auth.Config(KEY)))
        self.assertNotIn(KEY, repr(auth.Config(KEY)))

    def test_default_password_is_random_and_only_present_in_caller_state(self):
        first, second = auth.prepare(), auth.prepare()
        self.assertTrue(auth.password_ok(first.password))
        self.assertNotEqual(first.password, second.password)
        self.assertNotIn(first.password, repr(first) + json.dumps(first.safe_record()))

    def test_uncertain_create_never_retries_or_adopts_an_existing_user(self):
        state, records, fake = auth.prepare(PASSWORD), [], Fake(error=RuntimeError(PASSWORD + " provider detail"))
        result = auth.provision(auth.Config(KEY), state, records.append, transport=fake)
        self.assertEqual(result["phase"], "create_outcome_unconfirmed")
        self.assertEqual(result["error"], "operation_failed")
        self.assertIsNone(result["auth_user_id"])
        self.assertEqual(len(fake.calls), 1)
        with self.assertRaises(auth.IdentityError):
            auth.provision(auth.Config(KEY), state, records.append, transport=fake)
        self.assertEqual(len(fake.calls), 1)
        self.assertNotIn(PASSWORD, json.dumps(records))

    def test_known_id_is_saved_even_if_email_role_confirmation_or_metadata_is_wrong(self):
        changes = [lambda u: u.update(email="other@neuvetra.invalid"), lambda u: u.update(role="service_role"),
                   lambda u: u.update(email_confirmed_at=None), lambda u: u["app_metadata"].update(scope_id="other"),
                   lambda u: u["app_metadata"].update(run_marker="other"), lambda u: u["app_metadata"].update(kind="other")]
        for change in changes:
            with self.subTest(change=change):
                raw = user(); change(raw)
                state, records, fake = auth.prepare(PASSWORD), [], Fake(output=raw)
                result = auth.provision(auth.Config(KEY), state, records.append, transport=fake)
                self.assertEqual(result["error"], "created_identity_mismatch")
                self.assertEqual(result["auth_user_id"], USER)
                self.assertTrue(any(r["auth_user_id"] == USER for r in records))
                self.assertEqual(result["phase"], "create_id_returned_unverified")
                self.assertEqual(len(fake.calls), 1)

    def test_journal_failure_before_network_and_after_returned_id_stops_safely(self):
        for phase, count, known in [("pending", 0, None), ("create_started", 0, None), ("create_id_returned_unverified", 1, USER)]:
            state, fake = auth.prepare(PASSWORD), Fake()
            def journal(record):
                if record["phase"] == phase:
                    raise OSError("synthetic-private-path")
            result = auth.provision(auth.Config(KEY), state, journal, transport=fake)
            self.assertEqual(result["error"], "journal_failed")
            self.assertEqual(len(fake.calls), count)
            self.assertEqual(state.auth_user_id, known)
            with self.assertRaises(auth.IdentityError):
                auth.provision(auth.Config(KEY), state, journal, transport=fake)

    def test_async_journal_cannot_pretend_durable_persistence_completed(self):
        state, fake = auth.prepare(PASSWORD), Fake()
        async def journal(_):
            pass
        result = auth.provision(auth.Config(KEY), state, journal, transport=fake)
        self.assertEqual(result["error"], "journal_failed")
        self.assertFalse(fake.calls)

    def test_target_credentials_and_mutated_state_fail_before_request(self):
        for config in [auth.Config(KEY, "other.supabase.co"), auth.Config("sb_publishable_synthetic_0123456789"), auth.Config(jwt("anon")), auth.Config(jwt(ref="foreign")), auth.Config(KEY + "\n")]:
            fake = Fake()
            with self.assertRaises(auth.IdentityError):
                auth.provision(config, auth.prepare(PASSWORD), lambda _: None, transport=fake)
            self.assertFalse(fake.calls)
        state, fake = auth.prepare(PASSWORD), Fake()
        state.email = "customer@example.com"
        with self.assertRaises(auth.IdentityError):
            auth.provision(auth.Config(KEY), state, lambda _: None, transport=fake)
        self.assertFalse(fake.calls)
        with self.assertRaises(auth.IdentityError):
            auth.prepare("weak")


class TransportTests(unittest.TestCase):
    def test_fixed_tls_host_path_and_modern_or_legacy_key_headers(self):
        captured = []
        class Response:
            status = 200
            def getheader(self, *_): return "application/json"
            def read(self, _): return json.dumps(user()).encode()
        class Connection:
            def __init__(self, host, **options): captured.append(("connect", host, options))
            def request(self, *args): captured.append(args)
            def getresponse(self): return Response()
            def close(self): captured.append(("closed",))
        body = {"email": auth.EMAIL, "password": PASSWORD, "role": "authenticated", "email_confirm": True, "app_metadata": auth.APP_METADATA}
        with patch.object(auth.http.client, "HTTPSConnection", Connection), patch.dict("os.environ", {"HTTPS_PROXY": "https://foreign.invalid"}):
            auth.Transport(auth.Config(KEY)).create(body)
            auth.Transport(auth.Config(jwt())).create(body)
        self.assertEqual(captured[0][1], auth.HOST)
        self.assertTrue(captured[0][2]["context"].check_hostname)
        self.assertEqual(captured[0][2]["timeout"], 15)
        self.assertEqual(captured[1][:2], ("POST", "/auth/v1/admin/users"))
        self.assertEqual(captured[1][3]["apikey"], KEY)
        self.assertNotIn("Authorization", captured[1][3])
        self.assertEqual(captured[4][3]["Authorization"], "Bearer " + jwt())

    def test_redirects_failures_and_oversized_success_do_not_retry_or_read_error_bodies(self):
        body = {"email": auth.EMAIL, "password": PASSWORD, "role": "authenticated", "email_confirm": True, "app_metadata": auth.APP_METADATA}
        for status in [302, 401, 429, 500, 200]:
            calls = []
            class Response:
                def __init__(self): self.status = status
                def getheader(self, *_): return "application/json"
                def read(self, _):
                    if status != 200: raise AssertionError("No error body allowed")
                    return b"x" * (auth.MAX_RESPONSE + 1)
            class Connection:
                def __init__(self, *_a, **_k): pass
                def request(self, *_): calls.append("request")
                def getresponse(self): return Response()
                def close(self): calls.append("close")
            with patch.object(auth.http.client, "HTTPSConnection", Connection), self.assertRaises(auth.IdentityError):
                auth.Transport(auth.Config(KEY)).create(body)
            self.assertEqual(calls, ["request", "close"])


if __name__ == "__main__":
    unittest.main()
