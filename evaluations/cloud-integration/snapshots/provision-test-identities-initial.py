"""CLOUD-LIVE-SETUP-01: explicit synthetic Auth creation/sign-in; functions only.

No imports of product APIs, environment reads, user listing, invitations, retries,
deletion, membership writes, schema changes, or automatic approval. Author tests
are offline. The coordinator supplies reviewed keys/passwords in memory, retains
the returned state, and MUST durably journal safe snapshots. A private DPAPI
wrapper can separately persist state secrets; never log/asdict the whole state.

Official sources checked 2026-09-09 UTC:
https://supabase.com/docs/reference/javascript/auth-admin-createuser
  documents email_confirm:true for auto-confirmation.
https://github.com/supabase/auth-js/blob/master/src/GoTrueAdminApi.ts
  createUser issues POST /admin/users, distinct from POST /invite.
https://github.com/supabase/auth/blob/master/internal/api/admin.go
  adminUserCreate inserts user, applies app_metadata/role, calls user.Confirm
  for EmailConfirm, and returns user; this route has no mail-send call.
https://github.com/supabase/auth/blob/master/internal/models/user.go
  Confirm sets the confirmation timestamp and clears tokens, without mail.
https://github.com/supabase/auth/blob/master/openapi.yaml
  POST /token?grant_type=password accepts email/password and returns tokens/user.

That verifies the intended no-confirmation-email Auth path, not custom external
hooks or the target's deployed version. This module never calls invite/signup,
recovery, OTP or email-link endpoints. Host settings may reject .invalid emails
or password login; fail and review rather than switch to a real email address.

Private wrapper contract:
  state = prepare(password_a, password_b)
  # Persist state privately/encrypted before any live operation if required.
  provision_two(Config(Keys(admin_service_role_jwt, public_client_key)), state,
                persist_safe_snapshot)
  # Inspect state.safe_record(); only status=complete supplies both checked JWTs.
  # identity.access_token/password/refresh_token stay private; auth_user_id is
  # recorded for the separately reviewed membership and eventual cleanup step.
"""
from __future__ import annotations

import base64
from dataclasses import dataclass, field
import http.client
import json
import re
import ssl
import time
import uuid

PROJECT_REF = "icockcoguyadhryzydvl"
HOST = PROJECT_REF + ".supabase.co"
RUN_ID = "neuvetra-cloud-smoke-20260909"
SCOPES = ("90000000-0000-4000-8000-00000000000a", "90000000-0000-4000-8000-00000000000b")
EMAILS = (RUN_ID + "-a@neuvetra.invalid", RUN_ID + "-b@neuvetra.invalid")
MAX_RESPONSE = 131_072
SAFE_ERRORS = frozenset({"invalid_token", "target_refused", "invalid_key", "admin_key_refused", "public_key_refused",
                         "password_refused", "request_refused", "auth_http_failed", "response_type_refused",
                         "response_too_large", "response_refused", "auth_transport_or_response_failed",
                         "created_identity_mismatch", "state_refused", "journal_failed", "created_id_missing",
                         "duplicate_created_id", "session_refused", "operation_failed"})


class IdentityError(Exception):
    """Only fixed safe codes are raised; no provider body/credential details."""


def require(value, code):
    if not value:
        raise IdentityError(code)


def valid_uuid(value):
    try:
        return isinstance(value, str) and str(uuid.UUID(value)) == value and uuid.UUID(value).int != 0
    except (ValueError, TypeError, AttributeError):
        return False


def claims(token):
    """Deny-only parsing; not signature verification or application authorization."""
    try:
        require(isinstance(token, str) and len(token) <= 16384, "invalid_token")
        parts = token.split(".")
        require(len(parts) == 3 and all(re.fullmatch(r"[A-Za-z0-9_-]+", p) for p in parts), "invalid_token")
        result = json.loads(base64.urlsafe_b64decode(parts[1] + "=" * (-len(parts[1]) % 4)))
        require(isinstance(result, dict), "invalid_token")
        return result
    except (ValueError, TypeError, UnicodeError):
        raise IdentityError("invalid_token") from None


def header_value(value):
    return isinstance(value, str) and 16 <= len(value) <= 16384 and all(33 <= ord(c) <= 126 for c in value)


@dataclass(frozen=True)
class Keys:
    admin_key: str = field(repr=False)
    public_key: str = field(repr=False)


@dataclass(frozen=True)
class Config:
    keys: Keys = field(repr=False)
    host: str = HOST

    def validate(self):
        require(self.host == HOST, "target_refused")
        require(header_value(self.keys.admin_key) and header_value(self.keys.public_key), "invalid_key")
        admin = claims(self.keys.admin_key)
        require(admin.get("role") == "service_role" and admin.get("ref") == PROJECT_REF, "admin_key_refused")
        if self.keys.public_key.startswith("sb_publishable_"):
            require(re.fullmatch(r"sb_publishable_[A-Za-z0-9_-]{16,}", self.keys.public_key), "public_key_refused")
        else:
            public = claims(self.keys.public_key)
            require(public.get("role") == "anon" and public.get("ref") == PROJECT_REF, "public_key_refused")
        require(self.keys.public_key != self.keys.admin_key, "public_key_refused")


@dataclass
class Identity:
    scope_id: str
    email: str
    password: str = field(repr=False)
    auth_user_id: str | None = None
    phase: str = "pending"
    access_token: str = field(default="", repr=False)
    refresh_token: str = field(default="", repr=False)
    expires_at: int | None = None


@dataclass
class State:
    identities: tuple[Identity, Identity]
    run_id: str = RUN_ID
    status: str = "pending"
    error: str | None = None
    attempts: int = 0

    def safe_record(self):
        return {"project_ref": PROJECT_REF, "run_id": self.run_id, "status": self.status,
                "error": self.error, "attempts": self.attempts, "automatic_retry": False,
                "identities": [{"scope_id": x.scope_id, "email": x.email,
                                "auth_user_id": x.auth_user_id, "phase": x.phase,
                                "expires_at": x.expires_at} for x in self.identities]}


def password_ok(value):
    return (isinstance(value, str) and 24 <= len(value) <= 72
            and all(33 <= ord(c) <= 126 for c in value)
            and all(re.search(pattern, value) for pattern in (r"[a-z]", r"[A-Z]", r"[0-9]", r"[^a-zA-Z0-9]")))


def prepare(password_a, password_b):
    require(password_ok(password_a) and password_ok(password_b) and password_a != password_b, "password_refused")
    return State(tuple(Identity(sid, email, password) for sid, email, password in zip(SCOPES, EMAILS, (password_a, password_b))))


def metadata(identity):
    return {"neuvetra_synthetic": True, "neuvetra_run_id": RUN_ID, "neuvetra_scope_id": identity.scope_id}


def validate_body(operation, body):
    require(isinstance(body, dict) and body.get("email") in EMAILS and password_ok(body.get("password")), "request_refused")
    if operation == "create":
        require(set(body) == {"email", "password", "email_confirm", "role", "app_metadata"}, "request_refused")
        index = EMAILS.index(body["email"])
        require(body["email_confirm"] is True and body["role"] == "authenticated"
                and body["app_metadata"] == {"neuvetra_synthetic": True, "neuvetra_run_id": RUN_ID, "neuvetra_scope_id": SCOPES[index]}, "request_refused")
    else:
        require(operation == "signin" and set(body) == {"email", "password"}, "request_refused")


class Transport:
    """Fixed HTTPS POST routes; no proxy environment, redirects, retries or logs."""
    def __init__(self, config):
        config.validate()
        self.config = config

    def post(self, operation, body):
        self.config.validate()  # Destination validation precedes secret attachment.
        validate_body(operation, body)
        path = "/auth/v1/admin/users" if operation == "create" else "/auth/v1/token?grant_type=password"
        key = self.config.keys.admin_key if operation == "create" else self.config.keys.public_key
        headers = {"apikey": key, "Accept": "application/json", "Content-Type": "application/json"}
        if operation == "create":
            headers["Authorization"] = "Bearer " + key
        connection = None
        try:
            connection = http.client.HTTPSConnection(HOST, timeout=15, context=ssl.create_default_context())
            connection.request("POST", path, json.dumps(body, separators=(",", ":")).encode(), headers)
            response = connection.getresponse()
            require(200 <= response.status < 300, "auth_http_" + str(response.status) if 100 <= response.status <= 599 else "auth_http_failed")
            require(response.getheader("Content-Type", "").split(";", 1)[0].strip().lower() == "application/json", "response_type_refused")
            raw = response.read(MAX_RESPONSE + 1)
            require(len(raw) <= MAX_RESPONSE, "response_too_large")
            result = json.loads(raw)
            require(isinstance(result, dict), "response_refused")
            return result
        except IdentityError:
            raise
        except Exception:
            raise IdentityError("auth_transport_or_response_failed") from None
        finally:
            if connection:
                try:
                    connection.close()
                except Exception:
                    pass


def check_user(user, identity):
    require(isinstance(user, dict) and user.get("id") == identity.auth_user_id and user.get("email") == identity.email
            and user.get("role") == "authenticated" and user.get("is_anonymous") is not True
            and bool(user.get("email_confirmed_at")), "created_identity_mismatch")
    app = user.get("app_metadata")
    require(isinstance(app, dict) and all(app.get(k) == v for k, v in metadata(identity).items()), "created_identity_mismatch")


def provision_two(config, state, journal, *, transport=None, now=time.time):
    """Four attempts maximum. Caller-held state retains known IDs on every failure.

    journal(safe_record) MUST persist synchronously; it receives no credentials.
    A failed/uncertain run cannot be reused or automatically adopt existing users.
    A create response ID is retained and journaled BEFORE other response checks.
    A missing response after POST means creation outcome unknown, not 'no user'.
    """
    config.validate()
    require(callable(journal) and isinstance(state, State) and state.run_id == RUN_ID
            and state.status == "pending" and state.attempts == 0 and len(state.identities) == 2, "state_refused")
    for index, identity in enumerate(state.identities):
        require(identity.scope_id == SCOPES[index] and identity.email == EMAILS[index] and password_ok(identity.password)
                and identity.phase == "pending" and identity.auth_user_id is None
                and not identity.access_token and not identity.refresh_token, "state_refused")
    require(state.identities[0].password != state.identities[1].password, "password_refused")
    client = transport if transport is not None else Transport(config)

    def save():
        try:
            journal(state.safe_record())
        except Exception:
            raise IdentityError("journal_failed") from None

    try:
        state.status = "running"
        save()
        for identity in state.identities:
            identity.phase = "create_attempted_outcome_unknown"
            state.attempts += 1
            save()
            user = client.post("create", {"email": identity.email, "password": identity.password,
                                         "email_confirm": True, "role": "authenticated", "app_metadata": metadata(identity)})
            if isinstance(user, dict) and valid_uuid(user.get("id")):
                identity.auth_user_id = user["id"]
                identity.phase = "create_id_returned_unverified"
                save()
            require(identity.auth_user_id is not None, "created_id_missing")
            check_user(user, identity)
            require(len({x.auth_user_id for x in state.identities if x.auth_user_id}) == sum(x.auth_user_id is not None for x in state.identities), "duplicate_created_id")
            identity.phase = "created_verified"
            save()
        for identity in state.identities:
            identity.phase = "signin_attempted"
            state.attempts += 1
            save()
            response = client.post("signin", {"email": identity.email, "password": identity.password})
            check_user(response.get("user"), identity)
            token = response.get("access_token")
            parsed = claims(token)
            require(parsed.get("sub") == identity.auth_user_id and parsed.get("role") == "authenticated"
                    and parsed.get("iss") == f"https://{HOST}/auth/v1" and parsed.get("aud") == "authenticated"
                    and isinstance(parsed.get("exp"), int) and parsed["exp"] > now()
                    and response.get("token_type", "").lower() == "bearer", "session_refused")
            require(isinstance(response.get("refresh_token"), str) and re.fullmatch(r"[A-Za-z0-9_-]{8,4096}", response["refresh_token"]), "session_refused")
            identity.access_token = token
            identity.refresh_token = response["refresh_token"]
            identity.expires_at = parsed["exp"]
            identity.phase = "signed_in"
            save()
        state.status = "complete"
        save()
    except Exception as error:
        state.status = "failed_or_outcome_unconfirmed"
        # Only this module's fixed codes, never an injected provider message.
        safe = str(error) if isinstance(error, IdentityError) else "operation_failed"
        state.error = safe if safe in SAFE_ERRORS or re.fullmatch(r"auth_http_[1-5][0-9]{2}", safe) else "operation_failed"
        try:
            save()
        except IdentityError:
            state.error = "journal_failed"
    return state
