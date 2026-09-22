"""Bounded OpenRouter text-evaluation pilot with an append-only USD ledger.

The default command is offline preflight. Only the explicit ``execute`` command
performs network requests, and it never executes model-produced code or tools.
"""

from __future__ import annotations

import argparse
import contextlib
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
import hashlib
import json
import os
from pathlib import Path
import re
import socket
import sys
import threading
from datetime import datetime, timezone
import urllib.error
import urllib.request


CAP_USD = Decimal("5")
MAX_TOKENS = 8192
PROMPT_OVERHEAD_TOKENS = 1024
TIMEOUT_SECONDS = 90
CATALOG_URL = "https://openrouter.ai/api/v1/models"
COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions"
ALLOWED_MODELS = ("minimax/minimax-m3", "moonshotai/kimi-k2.7-code")
SYSTEM_PROMPT = (
    "Evaluate the supplied synthetic software-engineering fixture. Return text only for "
    "independent human review. Do not call tools, execute code, access files or networks, "
    "change systems, or claim that a proposal was tested. Follow the requested output shape."
)
KNOWN_PRICING_FIELDS = {"prompt", "completion", "input_cache_read"}


class PilotError(ValueError):
    """The requested pilot action cannot be shown to satisfy its safety contract."""


class TransportFailure(RuntimeError):
    """A request may have reached the remote service; its charge is uncertain."""


def _require(condition: bool, code: str) -> None:
    if not condition:
        raise PilotError(code)


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _read_json(path: Path):
    def unique(pairs):
        value = {}
        for key, item in pairs:
            _require(key not in value, "duplicate_json_key")
            value[key] = item
        return value

    try:
        return json.loads(path.read_text(encoding="utf-8-sig"), object_pairs_hook=unique)
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise PilotError("invalid_json_file") from exc


def _json_bytes(value) -> bytes:
    return json.dumps(value, ensure_ascii=False, allow_nan=False, separators=(",", ":")).encode("utf-8")


def _decimal(value, code: str) -> Decimal:
    _require(type(value) in (str, int, float), code)
    try:
        result = Decimal(str(value))
    except InvalidOperation as exc:
        raise PilotError(code) from exc
    _require(result.is_finite() and result >= 0, code)
    return result


def _money(value: Decimal) -> str:
    return format(value, "f")


def load_fixtures(path: Path) -> tuple[list[dict], str]:
    raw = path.read_bytes()
    record = _read_json(path)
    _require(isinstance(record, dict) and record.get("schema_version") == 1, "unsupported_fixture_schema")
    _require(record.get("synthetic") is True, "fixtures_not_marked_synthetic")
    cases = record.get("cases")
    _require(isinstance(cases, list) and 1 <= len(cases) <= 20, "invalid_fixture_count")
    result = []
    seen = set()
    for case in cases:
        _require(isinstance(case, dict) and set(case) == {"id", "feature_id", "prompt"},
                 "invalid_fixture_fields")
        case_id, feature_id, prompt = case["id"], case["feature_id"], case["prompt"]
        _require(isinstance(case_id, str) and re.fullmatch(r"[A-Z0-9][A-Z0-9_-]{0,63}", case_id),
                 "invalid_fixture_id")
        _require(case_id not in seen, "duplicate_fixture_id")
        _require(feature_id == "OPS-PILOT-01", "fixture_outside_pilot")
        _require(isinstance(prompt, str) and 1 <= len(prompt.encode("utf-8")) <= 32768,
                 "invalid_fixture_prompt")
        seen.add(case_id)
        result.append({"id": case_id, "feature_id": feature_id, "prompt": prompt})
    return result, hashlib.sha256(raw).hexdigest()


@dataclass(frozen=True)
class Price:
    prompt: Decimal
    completion: Decimal
    context_length: int
    max_completion_tokens: int


def parse_catalog(catalog) -> tuple[dict[str, Price], str]:
    _require(isinstance(catalog, dict) and isinstance(catalog.get("data"), list),
             "invalid_catalog_shape")
    indexed = {}
    for item in catalog["data"]:
        if isinstance(item, dict) and item.get("id") in ALLOWED_MODELS:
            model = item["id"]
            _require(model not in indexed, "duplicate_catalog_model")
            indexed[model] = item
    _require(set(indexed) == set(ALLOWED_MODELS), "catalog_missing_allowed_model")
    result = {}
    for model in ALLOWED_MODELS:
        item = indexed[model]
        pricing = item.get("pricing")
        _require(isinstance(pricing, dict), "catalog_missing_pricing")
        _require(set(pricing) <= KNOWN_PRICING_FIELDS, "catalog_unknown_price_field")
        _require("prompt" in pricing and "completion" in pricing, "catalog_missing_token_price")
        prompt = _decimal(pricing["prompt"], "catalog_invalid_prompt_price")
        completion = _decimal(pricing["completion"], "catalog_invalid_completion_price")
        _require(prompt > 0 and completion > 0, "catalog_zero_token_price")
        if "input_cache_read" in pricing:
            cache_read = _decimal(pricing["input_cache_read"], "catalog_invalid_cache_price")
            _require(cache_read <= prompt, "catalog_ambiguous_cache_price")
        _require(item.get("per_request_limits") is None, "catalog_per_request_limits_ambiguous")
        supported = item.get("supported_parameters")
        _require(isinstance(supported, list) and {"max_tokens", "tool_choice"} <= set(supported),
                 "catalog_missing_required_parameter")
        architecture = item.get("architecture")
        _require(isinstance(architecture, dict)
                 and "text" in architecture.get("input_modalities", [])
                 and architecture.get("output_modalities") == ["text"],
                 "catalog_not_text_only_compatible")
        context_length = item.get("context_length")
        provider = item.get("top_provider")
        _require(type(context_length) is int and context_length > MAX_TOKENS,
                 "catalog_invalid_context_length")
        _require(isinstance(provider, dict)
                 and type(provider.get("max_completion_tokens")) is int
                 and provider["max_completion_tokens"] >= MAX_TOKENS,
                 "catalog_output_cap_unsupported")
        result[model] = Price(prompt, completion, context_length,
                              provider["max_completion_tokens"])
    digest = hashlib.sha256(_json_bytes(catalog)).hexdigest()
    return result, digest


def make_plan(cases: list[dict], prices: dict[str, Price], run_id: str) -> list[dict]:
    plans = []
    for model in ALLOWED_MODELS:
        price = prices[model]
        for case in cases:
            messages = [{"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": case["prompt"]}]
            prompt_bytes = sum(len(message["content"].encode("utf-8")) for message in messages)
            prompt_bound = prompt_bytes + PROMPT_OVERHEAD_TOKENS
            _require(prompt_bound + MAX_TOKENS <= price.context_length, "request_exceeds_context")
            reservation = price.prompt * prompt_bound + price.completion * MAX_TOKENS
            _require(reservation > 0, "invalid_zero_reservation")
            request_id = hashlib.sha256(
                f"{run_id}\0{model}\0{case['id']}".encode("utf-8")
            ).hexdigest()
            body = {
                "model": model,
                "messages": messages,
                "max_tokens": MAX_TOKENS,
                "stream": False,
                "tool_choice": "none",
                "provider": {
                    "allow_fallbacks": False,
                    "require_parameters": True,
                    "data_collection": "deny",
                    "max_price": {
                        "prompt": float(price.prompt * Decimal(1_000_000)),
                        "completion": float(price.completion * Decimal(1_000_000)),
                        "request": 0,
                    },
                },
            }
            plans.append({
                "request_id": request_id,
                "case_id": case["id"],
                "feature_id": case["feature_id"],
                "model": model,
                "prompt_bytes": prompt_bytes,
                "prompt_token_bound": prompt_bound,
                "max_tokens": MAX_TOKENS,
                "reservation_usd": _money(reservation),
                "body": body,
            })
    return plans


_THREAD_LOCKS: dict[str, threading.Lock] = {}
_THREAD_LOCKS_GUARD = threading.Lock()


@contextlib.contextmanager
def _exclusive_lock(path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    key = str(path.resolve()).casefold()
    with _THREAD_LOCKS_GUARD:
        thread_lock = _THREAD_LOCKS.setdefault(key, threading.Lock())
    with thread_lock:
        with path.open("a+b") as handle:
            handle.seek(0)
            if os.name == "nt":
                import msvcrt
                if handle.read(1) == b"":
                    handle.write(b"\0")
                    handle.flush()
                    os.fsync(handle.fileno())
                handle.seek(0)
                msvcrt.locking(handle.fileno(), msvcrt.LK_LOCK, 1)
                try:
                    yield
                finally:
                    handle.seek(0)
                    msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                import fcntl
                fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
                try:
                    yield
                finally:
                    fcntl.flock(handle.fileno(), fcntl.LOCK_UN)


class Ledger:
    """Durable append-only reservation ledger guarded by an OS file lock."""

    def __init__(self, path: Path):
        self.path = path
        self.lock_path = path.with_name(path.name + ".lock")

    def _read(self) -> dict[str, dict]:
        requests = {}
        response_ids = set()
        if not self.path.exists():
            return requests
        try:
            lines = self.path.read_text(encoding="utf-8").splitlines()
        except (OSError, UnicodeError) as exc:
            raise PilotError("ledger_unreadable") from exc
        for line in lines:
            _require(bool(line.strip()), "ledger_blank_line")
            try:
                event = json.loads(line)
            except json.JSONDecodeError as exc:
                raise PilotError("ledger_invalid_json") from exc
            _require(isinstance(event, dict) and event.get("cap_usd") == _money(CAP_USD),
                     "ledger_cap_mismatch")
            kind = event.get("event")
            if kind == "reserve_batch":
                reservations = event.get("reservations")
                _require(isinstance(reservations, list) and reservations, "ledger_invalid_reservation")
                for item in reservations:
                    _require(isinstance(item, dict), "ledger_invalid_reservation")
                    request_id = item.get("request_id")
                    _require(isinstance(request_id, str) and request_id not in requests,
                             "ledger_duplicate_request")
                    amount = _decimal(item.get("reservation_usd"), "ledger_invalid_amount")
                    _require(amount > 0, "ledger_invalid_amount")
                    requests[request_id] = {"reservation": amount, "status": "reserved"}
            elif kind in ("settle", "uncertain"):
                request_id = event.get("request_id")
                _require(request_id in requests and requests[request_id]["status"] == "reserved",
                         "ledger_invalid_terminal_event")
                if kind == "settle":
                    charge = _decimal(event.get("charge_usd"), "ledger_invalid_charge")
                    _require(charge <= requests[request_id]["reservation"], "ledger_charge_exceeds_reservation")
                    receipt = event.get("receipt")
                    response_id = receipt.get("response_id") if isinstance(receipt, dict) else None
                    _require(isinstance(response_id, str) and response_id, "ledger_invalid_receipt")
                    _require(response_id not in response_ids, "ledger_duplicate_response_id")
                    response_ids.add(response_id)
                    requests[request_id].update(status="settled", charge=charge,
                                                response_id=response_id)
                else:
                    requests[request_id]["status"] = "uncertain"
            else:
                raise PilotError("ledger_unknown_event")
        _require(self._exposure(requests) <= CAP_USD, "ledger_exceeds_cap")
        return requests

    @staticmethod
    def _exposure(requests: dict[str, dict]) -> Decimal:
        return sum((item.get("charge", item["reservation"]) for item in requests.values()), Decimal(0))

    def _append(self, event: dict) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.path.open("ab") as handle:
            handle.write(_json_bytes(event) + b"\n")
            handle.flush()
            os.fsync(handle.fileno())

    def reserve_batch(self, plans: list[dict], *, run_id: str, catalog_sha256: str) -> Decimal:
        reservations = [{key: plan[key] for key in
                         ("request_id", "case_id", "model", "reservation_usd")}
                        for plan in plans]
        _require(len({item["request_id"] for item in reservations}) == len(reservations),
                 "duplicate_planned_request")
        with _exclusive_lock(self.lock_path):
            requests = self._read()
            _require(not (set(requests) & {item["request_id"] for item in reservations}),
                     "duplicate_request_id")
            requested = sum((_decimal(item["reservation_usd"], "invalid_reservation")
                             for item in reservations), Decimal(0))
            remaining = CAP_USD - self._exposure(requests)
            _require(requested <= remaining, "aggregate_budget_exceeded")
            self._append({"schema_version": 1, "event": "reserve_batch", "cap_usd": _money(CAP_USD),
                          "timestamp": _utc_now(), "run_id": run_id,
                          "catalog_sha256": catalog_sha256, "reservations": reservations})
            return remaining - requested

    def settle(self, request_id: str, charge: Decimal, receipt: dict) -> None:
        with _exclusive_lock(self.lock_path):
            requests = self._read()
            _require(request_id in requests and requests[request_id]["status"] == "reserved",
                     "request_not_open")
            _require(charge <= requests[request_id]["reservation"], "charge_exceeds_reservation")
            response_id = receipt.get("response_id") if isinstance(receipt, dict) else None
            _require(isinstance(response_id, str) and response_id, "invalid_response_id")
            _require(response_id not in {item.get("response_id") for item in requests.values()},
                     "duplicate_response_id")
            self._append({"schema_version": 1, "event": "settle", "cap_usd": _money(CAP_USD),
                          "timestamp": _utc_now(), "request_id": request_id,
                          "charge_usd": _money(charge), "receipt": receipt})

    def uncertain(self, request_id: str, reason_code: str) -> None:
        with _exclusive_lock(self.lock_path):
            requests = self._read()
            _require(request_id in requests and requests[request_id]["status"] == "reserved",
                     "request_not_open")
            self._append({"schema_version": 1, "event": "uncertain", "cap_usd": _money(CAP_USD),
                          "timestamp": _utc_now(), "request_id": request_id,
                          "reason_code": reason_code})

    def exposure(self) -> Decimal:
        with _exclusive_lock(self.lock_path):
            return self._exposure(self._read())


class HttpTransport:
    def get_json(self, url: str, *, timeout: int):
        request = urllib.request.Request(url, headers={"Accept": "application/json"}, method="GET")
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                return json.loads(response.read())
        except (urllib.error.HTTPError, urllib.error.URLError, socket.timeout,
                UnicodeError, json.JSONDecodeError, OSError) as exc:
            raise PilotError("catalog_fetch_failed") from exc

    def post_json(self, url: str, body: dict, *, api_key: str, timeout: int):
        request = urllib.request.Request(
            url, data=_json_bytes(body), method="POST",
            headers={"Accept": "application/json", "Content-Type": "application/json",
                     "Authorization": f"Bearer {api_key}"})
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                return json.loads(response.read())
        except (urllib.error.HTTPError, urllib.error.URLError, socket.timeout, TimeoutError,
                UnicodeError, json.JSONDecodeError, OSError) as exc:
            raise TransportFailure("remote_result_unknown") from exc


def _billing_receipt(response, plan: dict) -> tuple[dict, Decimal]:
    _require(isinstance(response, dict), "invalid_response")
    response_id = response.get("id")
    response_model = response.get("model")
    _require(isinstance(response_id, str) and response_id, "response_missing_id")
    _require(isinstance(response_model, str) and response_model, "response_missing_model")
    usage = response.get("usage")
    _require(isinstance(usage, dict), "response_missing_usage")
    for key in ("prompt_tokens", "completion_tokens", "total_tokens"):
        _require(type(usage.get(key)) is int and usage[key] >= 0, "response_invalid_usage")
    _require(usage["total_tokens"] == usage["prompt_tokens"] + usage["completion_tokens"],
             "response_usage_mismatch")
    charge = _decimal(usage.get("cost"), "response_cost_unknown")
    receipt = {"response_id": response_id, "response_model": response_model,
               "prompt_tokens": usage["prompt_tokens"],
               "completion_tokens": usage["completion_tokens"],
               "total_tokens": usage["total_tokens"], "cost_usd": _money(charge)}
    return receipt, charge


def _response_diagnostic(response, plan: dict) -> dict:
    """Return review-safe metadata/text without copying error bodies or tool arguments."""
    diagnostic = {}
    if not isinstance(response, dict):
        return diagnostic
    if isinstance(response.get("id"), str):
        diagnostic["response_id"] = response["id"]
    if isinstance(response.get("model"), str):
        diagnostic["response_model"] = response["model"]
    choices = response.get("choices")
    choice = choices[0] if isinstance(choices, list) and len(choices) == 1 and isinstance(choices[0], dict) else None
    if choice is not None and isinstance(choice.get("finish_reason"), str):
        diagnostic["finish_reason"] = choice["finish_reason"]
    message = choice.get("message") if choice is not None and isinstance(choice.get("message"), dict) else None
    if message is not None and isinstance(message.get("content"), str):
        diagnostic["output_text"] = message["content"]

    issues = []
    if response.get("model") != plan["model"]:
        issues.append("response_model_mismatch")
    usage = response.get("usage")
    if isinstance(usage, dict):
        if type(usage.get("prompt_tokens")) is int and usage["prompt_tokens"] > plan["prompt_token_bound"]:
            issues.append("prompt_token_bound_exceeded")
        if type(usage.get("completion_tokens")) is int and usage["completion_tokens"] > plan["max_tokens"]:
            issues.append("output_token_bound_exceeded")
    if choice is None:
        issues.append("invalid_choices")
    else:
        finish_reason = choice.get("finish_reason")
        if finish_reason == "length":
            issues.append("truncated_at_output_cap")
        elif finish_reason != "stop":
            issues.append("nonterminal_finish_reason")
        if not isinstance(message, dict) or not isinstance(message.get("content"), str):
            issues.append("missing_text_output")
        else:
            try:
                parsed = json.loads(message["content"])
                if not isinstance(parsed, dict):
                    issues.append("output_json_not_object")
            except json.JSONDecodeError:
                issues.append("output_not_json")
            if message.get("tool_calls"):
                issues.append("tool_call_refused")
    diagnostic["output_status"] = "reviewable" if not issues else "unusable"
    diagnostic["output_issue_codes"] = issues
    return diagnostic


def execute(root: Path, run_id: str, transport=None, environ=None) -> dict:
    _require(bool(re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,63}", run_id)), "invalid_run_id")
    environment = os.environ if environ is None else environ
    api_key = environment.get("OPENROUTER_API_KEY")
    _require(isinstance(api_key, str) and bool(api_key.strip()), "missing_openrouter_api_key")
    fixtures_path = root / "operations/agent-improvement/build-pilot-fixtures.json"
    output_path = root / "operations/agent-improvement/build-pilot-output" / f"{run_id}.json"
    ledger = Ledger(root / "operations/agent-improvement/build-pilot-ledger.jsonl")
    _require(not output_path.exists(), "output_already_exists")
    cases, fixtures_sha256 = load_fixtures(fixtures_path)
    client = HttpTransport() if transport is None else transport
    catalog = client.get_json(CATALOG_URL, timeout=TIMEOUT_SECONDS)
    prices, catalog_sha256 = parse_catalog(catalog)
    plans = make_plan(cases, prices, run_id)
    remaining = ledger.reserve_batch(plans, run_id=run_id, catalog_sha256=catalog_sha256)
    results = []
    for plan in plans:
        response = None
        result = {key: plan[key] for key in
                  ("request_id", "case_id", "feature_id", "model", "reservation_usd")}
        try:
            response = client.post_json(COMPLETIONS_URL, plan["body"], api_key=api_key,
                                        timeout=TIMEOUT_SECONDS)
            diagnostic = _response_diagnostic(response, plan)
            receipt, charge = _billing_receipt(response, plan)
            ledger.settle(plan["request_id"], charge, receipt)
            result.update(status="settled", receipt=receipt, **diagnostic)
        except TransportFailure:
            ledger.uncertain(plan["request_id"], "transport_result_unknown")
            result.update(status="uncertain", reason_code="transport_result_unknown")
        except (PilotError, KeyError, TypeError, TimeoutError):
            ledger.uncertain(plan["request_id"], "response_or_charge_unverifiable")
            result.update(status="uncertain", reason_code="response_or_charge_unverifiable")
            if response is not None:
                result.update(_response_diagnostic(response, plan))
        results.append(result)
    report = {
        "schema_version": 1,
        "run_id": run_id,
        "mode": "executed_text_evaluation",
        "synthetic_fixtures": True,
        "fixtures_sha256": fixtures_sha256,
        "catalog_sha256": catalog_sha256,
        "catalog_fetched_for_run": True,
        "aggregate_cap_usd": _money(CAP_USD),
        "remaining_exposure_capacity_usd": _money(CAP_USD - ledger.exposure()),
        "models": list(ALLOWED_MODELS),
        "max_tokens_per_request": MAX_TOKENS,
        "requests": results,
        "limitations": [
            "Outputs are untrusted text proposals for independent review.",
            "No model code or tool request was executed.",
            "Uncertain charges retain their full reservation.",
        ],
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        with output_path.open("xb") as handle:
            handle.write(json.dumps(report, indent=2, ensure_ascii=False, allow_nan=False).encode("utf-8") + b"\n")
            handle.flush()
            os.fsync(handle.fileno())
    except OSError as exc:
        raise PilotError("output_write_failed") from exc
    return report


def preflight(root: Path) -> dict:
    cases, fixtures_sha256 = load_fixtures(
        root / "operations/agent-improvement/build-pilot-fixtures.json")
    return {
        "schema_version": 1,
        "mode": "offline_preflight",
        "network_used": False,
        "credential_required": False,
        "ledger_changed": False,
        "fixtures_sha256": fixtures_sha256,
        "fixture_count": len(cases),
        "models": list(ALLOWED_MODELS),
        "planned_request_count": len(cases) * len(ALLOWED_MODELS),
        "max_tokens_per_request": MAX_TOKENS,
        "aggregate_cap_usd": _money(CAP_USD),
        "execution_blockers_until_execute": [
            "A fresh public catalog must validate both model prices and request parameters.",
            "OPENROUTER_API_KEY must be bound in the executing process environment.",
            "The complete batch must fit the locked append-only ledger before dispatch.",
        ],
    }


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command")
    commands.add_parser("preflight")
    execute_parser = commands.add_parser("execute")
    execute_parser.add_argument("--run-id", required=True)
    args = parser.parse_args(argv)
    root = Path(__file__).resolve().parents[1]
    try:
        result = execute(root, args.run_id) if args.command == "execute" else preflight(root)
        print(json.dumps(result, indent=2, ensure_ascii=False, allow_nan=False))
        return 0
    except (PilotError, OSError, ValueError, TypeError, KeyError):
        print(json.dumps({"ok": False, "error": "pilot_blocked_fail_closed"}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
