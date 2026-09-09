"""Offline Auth boundary checks; synthetic keys/IDs only, no network."""
import base64
import importlib.util
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location("provision_test_identities", Path(__file__).with_name("provision-test-identities.py"))
auth = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = auth
SPEC.loader.exec_module(auth)


def token(payload):
    encode = lambda b: base64.urlsafe_b64encode(b).decode().rstrip("=")
    return encode(b'{"alg":"HS256"}') + "." + encode(json.dumps(payload).encode()) + ".mockSignature"


def keys():
    return auth.Keys(token({"role": "service_role", "ref": auth.PROJECT_REF}), token({"role": "anon", "ref": auth.PROJECT_REF}))


PASSWORDS = ("Synthetic-Password-A-123456!", "Synthetic-Password-B-123456!")
IDS = ("11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222")
NOW = 1_789_000_000


def user(index):
    return {"id": IDS[index], "email": auth.EMAILS[index], "role": "authenticated", "is_anonymous": False,
            "email_confirmed_at": "2026-09-09T06:00:00Z", "app_metadata": {
                "neuvetra_synthetic": True, "neuvetra_run_id": auth.RUN_ID, "neuvetra_scope_id": auth.SCOPES[index]}}


class Fake:
    def __init__(self, fail_at=None, mutate=None):
        self.calls = []
        self.fail_at = fail_at
        self.mutate = mutate

    def post(self, operation, body):
        auth.validate_body(operation, body)
        self.calls.append((operation, body.copy()))
        if len(self.calls) == self.fail_at:
            raise RuntimeError("private-provider-detail " + PASSWORDS[0])
        index = auth.EMAILS.index(body["email"])
        value = user(index) if operation == "create" else {
            "user": user(index), "token_type": "bearer", "refresh_token": "mockrefresh1",
            "access_token": token({"sub": IDS[index], "role": "authenticated", "iss": f"https://{auth.HOST}/auth/v1", "aud": "authenticated", "exp": NOW + 3600})}
        if self.mutate:
            self.mutate(operation, index, value)
        return value


class ProvisionTests(unittest.TestCase):
    def run_case(self, fake):
        state, journal = auth.prepare(*PASSWORDS), []
        auth.provision_two(auth.Config(keys()), state, journal.append, transport=fake, now=lambda: NOW)
        return state, journal

    def test_two_fixed_accounts_no_email_endpoint_or_privileged_signin(self):
        fake = Fake()
        state, journal = self.run_case(fake)
        self.assertEqual(state.status, "complete")
        self.assertEqual([c[0] for c in fake.calls], ["create", "create", "signin", "signin"])
        self.assertEqual(state.attempts, 4)
        self.assertEqual([x.auth_user_id for x in state.identities], list(IDS))
        for _, body in fake.calls[:2]:
            self.assertIs(body["email_confirm"], True)
            self.assertEqual(body["role"], "authenticated")
            self.assertTrue(body["email"].endswith("@neuvetra.invalid"))
        safe = json.dumps(journal) + repr(state) + repr(keys()) + repr(auth.Config(keys()))
        for secret in (*PASSWORDS, keys().admin_key, keys().public_key, state.identities[0].access_token, state.identities[0].refresh_token):
            self.assertNotIn(secret, safe)

    def test_second_creation_failure_retains_first_id_and_no_retry_or_adoption(self):
        fake = Fake(fail_at=2)
        state, journal = self.run_case(fake)
        self.assertEqual(state.status, "failed_or_outcome_unconfirmed")
        self.assertEqual(state.identities[0].auth_user_id, IDS[0])
        self.assertIsNone(state.identities[1].auth_user_id)
        self.assertEqual(state.identities[1].phase, "create_attempted_outcome_unknown")
        self.assertTrue(any(r["identities"][0]["auth_user_id"] == IDS[0] for r in journal))
        self.assertEqual(state.error, "operation_failed")
        with self.assertRaises(auth.IdentityError):
            auth.provision_two(auth.Config(keys()), state, journal.append, transport=fake)
        self.assertEqual(len(fake.calls), 2)

    def test_signin_failure_keeps_both_created_ids(self):
        fake = Fake(fail_at=3)
        state, _ = self.run_case(fake)
        self.assertEqual([x.auth_user_id for x in state.identities], list(IDS))
        self.assertEqual(len(fake.calls), 3)
        self.assertTrue(all(not x.access_token for x in state.identities))

    def test_id_recorded_before_other_create_response_validation(self):
        def mutate(operation, index, value):
            if operation == "create":
                value["email"] = "unexpected@example.invalid"
        fake = Fake(mutate=mutate)
        state, journal = self.run_case(fake)
        self.assertEqual(state.identities[0].auth_user_id, IDS[0])
        self.assertEqual(state.identities[0].phase, "create_id_returned_unverified")
        self.assertEqual(len(fake.calls), 1)
        self.assertTrue(any(r["identities"][0]["auth_user_id"] == IDS[0] for r in journal))

    def test_wrong_scope_confirmation_role_issuer_sub_and_expiry_fail(self):
        for operation, modify in [
            ("create", lambda r: r["app_metadata"].update(neuvetra_scope_id=auth.SCOPES[1])),
            ("create", lambda r: r.update(email_confirmed_at=None)),
            ("create", lambda r: r.update(role="service_role")),
            ("signin", lambda r: r.update(access_token=token({"role": "service_role", "sub": IDS[0]}))),
            ("signin", lambda r: r.update(access_token=token({"role": "authenticated", "sub": IDS[1], "iss": f"https://{auth.HOST}/auth/v1", "aud": "authenticated", "exp": NOW + 3600}))),
            ("signin", lambda r: r.update(access_token=token({"role": "authenticated", "sub": IDS[0], "iss": "https://foreign.invalid/auth/v1", "aud": "authenticated", "exp": NOW + 3600}))),
            ("signin", lambda r: r.update(access_token=token({"role": "authenticated", "sub": IDS[0], "iss": f"https://{auth.HOST}/auth/v1", "aud": "authenticated", "exp": NOW - 1}))),
        ]:
            with self.subTest(operation=operation):
                def mutate(op, index, value):
                    if op == operation and index == 0:
                        modify(value)
                fake = Fake(mutate=mutate)
                state, _ = self.run_case(fake)
                self.assertNotEqual(state.status, "complete")
                self.assertFalse(state.identities[0].access_token)

    def test_journal_failure_after_id_stops_with_id_in_caller_state(self):
        state = auth.prepare(*PASSWORDS)
        fake = Fake()
        def journal(record):
            if record["identities"][0]["auth_user_id"]:
                raise RuntimeError("private storage path")
        auth.provision_two(auth.Config(keys()), state, journal, transport=fake)
        self.assertEqual(state.error, "journal_failed")
        self.assertEqual(state.identities[0].auth_user_id, IDS[0])
        self.assertEqual(len(fake.calls), 1)

    def test_invalid_target_keys_email_and_password_fail_before_transport(self):
        for config in [auth.Config(keys(), "foreign.supabase.co"), auth.Config(auth.Keys(keys().admin_key, keys().admin_key)),
                       auth.Config(auth.Keys(token({"role": "service_role", "ref": "foreign"}), keys().public_key))]:
            fake = Fake()
            with self.assertRaises(auth.IdentityError):
                auth.provision_two(config, auth.prepare(*PASSWORDS), lambda _: None, transport=fake)
            self.assertFalse(fake.calls)
        with self.assertRaises(auth.IdentityError):
            auth.prepare("weak", PASSWORDS[1])
        state, fake = auth.prepare(*PASSWORDS), Fake()
        state.identities[0].email = "customer@example.com"
        with self.assertRaises(auth.IdentityError):
            auth.provision_two(auth.Config(keys()), state, lambda _: None, transport=fake)
        self.assertFalse(fake.calls)


class HttpTests(unittest.TestCase):
    def test_modern_admin_key_uses_apikey_only_legacy_keeps_validated_jwt_bearer(self):
        captures = []
        class Response:
            status = 200
            def getheader(self, name, default): return "application/json"
            def read(self, size): return b'{}'
        class Connection:
            def __init__(self, *args, **kwargs): pass
            def request(self, method, path, body, headers): captures.append((method, path, headers))
            def getresponse(self): return Response()
            def close(self): pass
        opaque = "sb_secret_" + "syntheticKeyMaterial0123456789"
        modern = auth.Config(auth.Keys(opaque, keys().public_key))
        legacy = auth.Config(keys())
        body = {"email": auth.EMAILS[0], "password": PASSWORDS[0], "role": "authenticated", "email_confirm": True,
                "app_metadata": {"neuvetra_synthetic": True, "neuvetra_run_id": auth.RUN_ID, "neuvetra_scope_id": auth.SCOPES[0]}}
        with patch.object(auth.http.client, "HTTPSConnection", Connection):
            auth.Transport(modern).post("create", body)
            auth.Transport(legacy).post("create", body)
        self.assertEqual(captures[0][1], "/auth/v1/admin/users")
        self.assertEqual(captures[0][2]["apikey"], opaque)
        self.assertNotIn("Authorization", captures[0][2])
        self.assertEqual(captures[1][2]["Authorization"], "Bearer " + keys().admin_key)
        for invalid in ["sb_secret_short", "sb_secret_" + "x" * 20 + ".JWT", "sb_publishable_" + "x" * 20]:
            with self.assertRaises(auth.IdentityError):
                auth.Config(auth.Keys(invalid, keys().public_key)).validate()

    def test_fixed_direct_host_post_and_public_signin_key_only(self):
        captures = []
        class Response:
            status = 200
            def getheader(self, name, default): return "application/json"
            def read(self, size): return b'{}'
        class Connection:
            def __init__(self, host, **kwargs): captures.append(("connect", host, kwargs))
            def request(self, method, path, body, headers): captures.append((method, path, json.loads(body), headers))
            def getresponse(self): return Response()
            def close(self): captures.append(("closed",))
        client = auth.Transport(auth.Config(keys()))
        with patch.object(auth.http.client, "HTTPSConnection", Connection), patch.dict("os.environ", {"HTTPS_PROXY": "https://foreign.invalid"}):
            client.post("signin", {"email": auth.EMAILS[0], "password": PASSWORDS[0]})
        self.assertEqual(captures[0][1], auth.HOST)
        self.assertTrue(captures[0][2]["context"].check_hostname)
        self.assertEqual(captures[1][1], "/auth/v1/token?grant_type=password")
        self.assertEqual(captures[1][3]["apikey"], keys().public_key)
        self.assertNotIn("Authorization", captures[1][3])

    def test_redirects_provider_errors_and_unknown_routes_never_retry(self):
        for status in [302, 401, 429, 500]:
            calls = []
            class Response:
                def __init__(self): self.status = status
                def read(self, _): raise AssertionError("error body must not be read")
            class Connection:
                def __init__(self, *a, **k): calls.append("connect")
                def request(self, *a): calls.append("request")
                def getresponse(self): return Response()
                def close(self): pass
            client = auth.Transport(auth.Config(keys()))
            with patch.object(auth.http.client, "HTTPSConnection", Connection):
                with self.assertRaisesRegex(auth.IdentityError, "auth_http_" + str(status)):
                    client.post("signin", {"email": auth.EMAILS[0], "password": PASSWORDS[0]})
                with self.assertRaises(auth.IdentityError):
                    client.post("invite", {"email": auth.EMAILS[0], "password": PASSWORDS[0]})
            self.assertEqual(calls, ["connect", "request"])


if __name__ == "__main__":
    unittest.main()
