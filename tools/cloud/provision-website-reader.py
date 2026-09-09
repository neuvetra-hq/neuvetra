"""One explicitly authorized ordinary private-website Auth account; no sign-in.

Imports never read ENV, disk or network. The coordinator calls prepare(), then
provision(Config(admin_key), state, journal). journal receives safe records but
MUST synchronously persist the caller-held state (including password) through its
private encrypted wrapper. The pending and create_started journals precede POST;
returned IDs are journaled before further response checks. Never log/asdict state.

Only POST /auth/v1/admin/users with email_confirm:true is used. No signup, invite,
email, listing, user updates, membership, sign-in, retries or existing-user adoption.
Supabase's documented admin creation endpoint is distinct from invitation:
https://supabase.com/docs/reference/javascript/auth-admin-createuser
Custom external Auth hooks are outside this helper's control.
"""
from __future__ import annotations

import base64
from dataclasses import dataclass, field
import http.client
import inspect
import json
import re
import secrets
import ssl
import uuid

PROJECT_REF = "icockcoguyadhryzydvl"
HOST = PROJECT_REF + ".supabase.co"
SCOPE_ID = "90000000-0000-4000-8000-00000000000c"
RUN_MARKER = "neuvetra-website-epa-20260909"
EMAIL = RUN_MARKER + "@neuvetra.invalid"
APP_METADATA = {"scope_id": SCOPE_ID, "run_marker": RUN_MARKER, "kind": "private_research_reader"}
MAX_RESPONSE = 64_000
SAFE_ERRORS = frozenset({"target_refused", "admin_key_refused", "password_refused", "state_refused", "request_refused",
                         "journal_failed", "created_identity_mismatch", "created_id_missing", "response_refused",
                         "response_too_large", "auth_transport_failed", "operation_failed"})


class IdentityError(Exception):
    """Fixed safe codes only; no provider text or secret values."""


def require(value, code):
    if not value:
        raise IdentityError(code)


def valid_uuid(value):
    try:
        return isinstance(value, str) and str(uuid.UUID(value)) == value and uuid.UUID(value).int != 0
    except (ValueError, TypeError, AttributeError):
        return False


def password_ok(value):
    return isinstance(value, str) and 24 <= len(value) <= 72 and all(33 <= ord(c) <= 126 for c in value) and all(re.search(p, value) for p in (r"[a-z]", r"[A-Z]", r"[0-9]", r"[^a-zA-Z0-9]"))


@dataclass(frozen=True)
class Config:
    admin_key: str = field(repr=False)
    host: str = HOST

    def validate(self):
        require(self.host == HOST, "target_refused")
        require(isinstance(self.admin_key, str) and 16 <= len(self.admin_key) <= 16_384 and all(33 <= ord(c) <= 126 for c in self.admin_key), "admin_key_refused")
        if self.admin_key.startswith("sb_secret_"):
            require(re.fullmatch(r"sb_secret_[A-Za-z0-9_-]{16,}", self.admin_key), "admin_key_refused")
        else:
            try:
                segments = self.admin_key.split(".")
                require(len(segments) == 3 and all(re.fullmatch(r"[A-Za-z0-9_-]+", s) for s in segments), "admin_key_refused")
                claims = json.loads(base64.urlsafe_b64decode(segments[1] + "=" * (-len(segments[1]) % 4)))
                require(isinstance(claims, dict) and claims.get("role") == "service_role" and claims.get("ref") == PROJECT_REF, "admin_key_refused")
            except (ValueError, UnicodeError, TypeError):
                raise IdentityError("admin_key_refused") from None
        # JWT decoding is deny-only; modern opaque key ownership is established
        # by the coordinator and authenticated fixed project endpoint.


@dataclass
class State:
    password: str = field(repr=False)
    email: str = EMAIL
    auth_user_id: str | None = None
    phase: str = "pending"
    attempts: int = 0
    error: str | None = None

    def safe_record(self):
        return {"operation": "provision_private_website_reader", "project_ref": PROJECT_REF,
                "status": "created" if self.phase == "created" and self.error is None else "incomplete",
                "email": self.email, "auth_user_id": self.auth_user_id, "app_metadata": dict(APP_METADATA),
                "phase": self.phase, "attempts": self.attempts, "error": self.error,
                "automatic_retry": False, "signins": 0, "membership_writes": 0}


def prepare(password=None):
    value = "Nv9!" + secrets.token_urlsafe(32) if password is None else password
    require(password_ok(value), "password_refused")
    return State(value)


def validate_body(body):
    require(isinstance(body, dict) and set(body) == {"email", "password", "role", "email_confirm", "app_metadata"}
            and body.get("email") == EMAIL and password_ok(body.get("password")) and body.get("role") == "authenticated"
            and body.get("email_confirm") is True and body.get("app_metadata") == APP_METADATA, "request_refused")


class Transport:
    """Direct verified HTTPS; proxy ENV, redirects and alternate routes are unused."""
    def __init__(self, config):
        config.validate()
        self.config = config

    def create(self, body):
        self.config.validate()
        validate_body(body)
        headers = {"apikey": self.config.admin_key, "Content-Type": "application/json", "Accept": "application/json"}
        if not self.config.admin_key.startswith("sb_secret_"):
            headers["Authorization"] = "Bearer " + self.config.admin_key
        connection = None
        try:
            connection = http.client.HTTPSConnection(HOST, timeout=15, context=ssl.create_default_context())
            connection.request("POST", "/auth/v1/admin/users", json.dumps(body, separators=(",", ":")).encode(), headers)
            response = connection.getresponse()
            require(200 <= response.status < 300, "auth_http_" + str(response.status) if 100 <= response.status <= 599 else "response_refused")
            require(response.getheader("Content-Type", "").split(";", 1)[0].strip().lower() == "application/json", "response_refused")
            raw = response.read(MAX_RESPONSE + 1)
            require(len(raw) <= MAX_RESPONSE, "response_too_large")
            value = json.loads(raw)
            require(isinstance(value, dict), "response_refused")
            return value
        except IdentityError:
            raise
        except Exception:
            raise IdentityError("auth_transport_failed") from None
        finally:
            if connection:
                try:
                    connection.close()
                except Exception:
                    pass


def safe_error(error):
    if isinstance(error, IdentityError) and (str(error) in SAFE_ERRORS or re.fullmatch(r"auth_http_[1-5][0-9]{2}", str(error))):
        return str(error)
    return "operation_failed"


def provision(config, state, journal, *, transport=None):
    """One attempt. Never reuse a started/failed state or adopt an existing user.

    A durable create_started marker means creation may have happened even if the
    last saved attempts count is zero. An uncertain outcome requires coordinator
    investigation, never a fresh prepare()/POST to find out whether it succeeded.
    """
    config.validate()
    require(isinstance(state, State) and state.phase == "pending" and state.attempts == 0 and state.auth_user_id is None
            and state.error is None and state.email == EMAIL and password_ok(state.password) and callable(journal), "state_refused")
    client = transport if transport is not None else Transport(config)

    def save():
        try:
            result = journal(state.safe_record())
            if inspect.isawaitable(result):
                if inspect.iscoroutine(result):
                    result.close()
                raise IdentityError("journal_failed")
        except Exception:
            raise IdentityError("journal_failed") from None

    try:
        save()  # Coordinator encrypts the random password before any I/O.
        state.phase = "create_started"
        save()
        body = {"email": EMAIL, "password": state.password, "role": "authenticated", "email_confirm": True, "app_metadata": dict(APP_METADATA)}
        validate_body(body)
        state.attempts = 1
        user = client.create(body)
        require(isinstance(user, dict) and valid_uuid(user.get("id")), "created_id_missing")
        state.auth_user_id = user["id"]
        state.phase = "create_id_returned_unverified"
        save()  # Preserve the known ID even if remaining response checks fail.
        require(user.get("email") == EMAIL and user.get("role") == "authenticated" and user.get("is_anonymous") is not True
                and isinstance(user.get("email_confirmed_at"), str) and bool(user["email_confirmed_at"])
                and isinstance(user.get("app_metadata"), dict) and all(user["app_metadata"].get(k) == v for k, v in APP_METADATA.items()), "created_identity_mismatch")
        state.phase = "created"
        save()
    except Exception as error:
        state.error = safe_error(error)
        if state.phase == "create_started" and state.attempts:
            state.phase = "create_outcome_unconfirmed"
        try:
            save()
        except IdentityError:
            state.error = "journal_failed"
    return state.safe_record()
