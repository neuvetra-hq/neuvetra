"""Validate feature delivery events and generate deterministic offline scorecards.

Inputs are read-only JSON/JSONL records. Reports are derived artifacts; this tool does
not update the feature registry, event streams, run records, or milestone ledgers.
"""

from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
import json
from pathlib import Path
import re
import sys


class InvalidMetrics(ValueError):
    """The supplied records cannot support a scorecard."""


STATES = {"planned", "implementing", "in_qa", "rework", "accepted", "published",
          "live", "blocked", "superseded"}
EVENT_TYPES = {"started", "qa_handoff", "qa_disposition", "finding_opened",
               "finding_resolved", "finding_reopened", "repair", "criterion_result",
               "accepted", "published", "deployed", "blocked", "superseded"}
PHASES = {"implementation", "review", "retry", "orchestration"}
SEVERITIES = {"low", "medium", "high", "critical"}
ID_PATTERN = re.compile(r"[A-Za-z0-9][A-Za-z0-9._:-]*\Z")
MONEY_PATTERN = re.compile(r"(?:0|[1-9][0-9]*)(?:\.[0-9]+)?\Z")


def require(condition, message):
    if not condition:
        raise InvalidMetrics(message)


def fields(value, required, label):
    require(isinstance(value, dict), f"{label} must be an object")
    missing = set(required) - set(value)
    require(not missing, f"{label} missing fields: {sorted(missing)}")


def nonempty(value):
    return isinstance(value, str) and bool(value.strip())


def identifier(value, label):
    require(nonempty(value) and ID_PATTERN.fullmatch(value), f"Invalid {label}: {value!r}")


def timestamp(value, label):
    require(nonempty(value), f"Missing {label}")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise InvalidMetrics(f"Invalid {label}: {value!r}") from exc
    require(parsed.tzinfo is not None and parsed.utcoffset() is not None,
            f"{label} must include a timezone")
    return parsed.astimezone(timezone.utc)


def money(value, label, nullable=False):
    if value is None and nullable:
        return None
    require(isinstance(value, str) and MONEY_PATTERN.fullmatch(value),
            f"{label} must be a nonnegative decimal string")
    try:
        return Decimal(value)
    except InvalidOperation as exc:  # defensive; the regular expression is stricter
        raise InvalidMetrics(f"Invalid {label}") from exc


def evidence(value, label):
    require(isinstance(value, list) and value and all(nonempty(item) for item in value),
            f"{label} requires nonempty evidence locators")


def nullable_text(value, label):
    require(value is None or nonempty(value), f"Invalid {label}")


def read_json(path):
    def unique_pairs(pairs):
        result = {}
        for key, value in pairs:
            require(key not in result, f"Duplicate JSON key {key!r} in {path}")
            result[key] = value
        return result

    return json.loads(path.read_text(encoding="utf-8-sig"), object_pairs_hook=unique_pairs)


def read_jsonl(path):
    records = []
    for line_number, line in enumerate(path.read_text(encoding="utf-8-sig").splitlines(), 1):
        if not line.strip():
            continue
        try:
            record = json.loads(line, object_pairs_hook=lambda pairs: _unique_line_pairs(
                pairs, path, line_number))
        except json.JSONDecodeError as exc:
            raise InvalidMetrics(f"Invalid JSON in {path}:{line_number}: {exc.msg}") from exc
        require(isinstance(record, dict), f"{path}:{line_number} must contain an object")
        record["_line"] = line_number
        records.append(record)
    return records


def _unique_line_pairs(pairs, path, line_number):
    result = {}
    for key, value in pairs:
        require(key not in result, f"Duplicate JSON key {key!r} in {path}:{line_number}")
        result[key] = value
    return result


def validate_registry(registry):
    fields(registry, ("schema_version", "features"), "feature registry")
    require(type(registry["schema_version"]) is int and registry["schema_version"] == 1,
            "Unsupported feature registry schema")
    require(isinstance(registry["features"], list), "features must be a list")
    result = {}
    required = ("feature_id", "milestone_id", "title", "problem", "delivered_behavior",
                "state", "owner", "risk_class", "complexity_class", "run_ids",
                "dependencies", "acceptance_criteria")
    for feature in registry["features"]:
        fields(feature, required, "feature")
        feature_id = feature["feature_id"]
        identifier(feature_id, "feature_id")
        require(feature_id not in result, f"Duplicate feature_id: {feature_id}")
        for name in ("milestone_id", "title", "problem", "owner", "risk_class",
                     "complexity_class"):
            require(nonempty(feature[name]), f"{feature_id}: missing {name}")
        nullable_text(feature["delivered_behavior"], f"{feature_id}.delivered_behavior")
        require(feature["state"] in STATES, f"{feature_id}: unsupported state")
        require(isinstance(feature["run_ids"], list), f"{feature_id}: run_ids must be a list")
        run_ids = set()
        for run_id in feature["run_ids"]:
            identifier(run_id, "run_id")
            require(run_id not in run_ids, f"{feature_id}: duplicate run_id {run_id}")
            run_ids.add(run_id)
        require(isinstance(feature["dependencies"], list)
                and all(nonempty(value) for value in feature["dependencies"]),
                f"{feature_id}: invalid dependencies")
        criteria = feature["acceptance_criteria"]
        require(isinstance(criteria, list) and criteria,
                f"{feature_id}: acceptance_criteria must be nonempty")
        criterion_ids = set()
        for criterion in criteria:
            fields(criterion, ("criterion_id", "description", "applicable"), "criterion")
            criterion_id = criterion["criterion_id"]
            identifier(criterion_id, "criterion_id")
            require(criterion_id not in criterion_ids,
                    f"{feature_id}: duplicate criterion_id {criterion_id}")
            require(nonempty(criterion["description"]), f"{feature_id}: empty criterion")
            require(type(criterion["applicable"]) is bool,
                    f"{feature_id}.{criterion_id}: applicable must be boolean")
            criterion_ids.add(criterion_id)
        result[feature_id] = feature
    for feature in result.values():
        for dependency in feature["dependencies"]:
            require(dependency in result and dependency != feature["feature_id"],
                    f"{feature['feature_id']}: unknown/self dependency {dependency}")
    return result


def _validate_common_event(event, features, label):
    fields(event, ("schema_version", "event_id", "feature_id", "occurred_at", "event_type",
                   "actor", "run_id", "artifact_version", "evidence", "correction_of"), label)
    require(type(event["schema_version"]) is int and event["schema_version"] == 1,
            f"{label}: unsupported schema")
    identifier(event["event_id"], "event_id")
    require(event["feature_id"] in features, f"{label}: unknown feature_id")
    timestamp(event["occurred_at"], f"{label}.occurred_at")
    require(nonempty(event["actor"]), f"{label}: missing actor")
    require(event["run_id"] is None or event["run_id"] in features[event["feature_id"]]["run_ids"],
            f"{label}: run_id is not registered to feature")
    require(nonempty(event["artifact_version"]), f"{label}: missing artifact_version")
    evidence(event["evidence"], label)
    require(event["correction_of"] is None or nonempty(event["correction_of"]),
            f"{label}: invalid correction_of")


def _ordered_unique(events, label):
    seen = set()
    previous = None
    for event in events:
        event_label = f"{label} line {event['_line']}"
        require(event["event_id"] not in seen, f"Duplicate event_id: {event['event_id']}")
        seen.add(event["event_id"])
        current = timestamp(event["occurred_at"], f"{event_label}.occurred_at")
        require(previous is None or current >= previous, f"{label} is not append-time ordered")
        previous = current


def _apply_corrections(events, kind):
    slots = []
    active = {}
    for event in events:
        correction = event["correction_of"]
        if correction is None:
            active[event["event_id"]] = len(slots)
            slots.append(event)
            continue
        require(correction in active, f"{event['event_id']}: correction target is not active/earlier")
        index = active.pop(correction)
        target = slots[index]
        require(target["feature_id"] == event["feature_id"]
                and target["event_type"] == event["event_type"],
                f"{event['event_id']}: correction changes feature or event type")
        if kind == "usage":
            require(target["call_id"] == event["call_id"],
                    f"{event['event_id']}: correction changes call_id")
        slots[index] = event
        active[event["event_id"]] = index
    return slots


def validate_feature_events(events, features):
    for event in events:
        label = f"feature event line {event['_line']}"
        _validate_common_event(event, features, label)
        require(event["event_type"] in EVENT_TYPES, f"{label}: unsupported event_type")
        event_type = event["event_type"]
        if event_type in {"qa_handoff", "qa_disposition"}:
            identifier(event.get("round_id"), "round_id")
        if event_type == "qa_disposition":
            require(event.get("disposition") in {"pass", "fail", "insufficient_evidence"},
                    f"{label}: invalid disposition")
            require(type(event.get("independent")) is bool,
                    f"{label}: independent must be boolean")
        if event_type == "finding_opened":
            identifier(event.get("finding_id"), "finding_id")
            require(event.get("severity") in SEVERITIES, f"{label}: invalid severity")
            require(nonempty(event.get("category")) and nonempty(event.get("summary")),
                    f"{label}: finding needs category and summary")
        if event_type in {"finding_resolved", "finding_reopened"}:
            identifier(event.get("finding_id"), "finding_id")
        if event_type == "criterion_result":
            identifier(event.get("criterion_id"), "criterion_id")
            require(event.get("status") in {"pass", "fail"}, f"{label}: invalid criterion status")
    _ordered_unique(events, "feature event stream")
    immutable_history = {"qa_handoff", "qa_disposition", "finding_opened",
                         "finding_resolved", "finding_reopened"}
    require(not any(event["correction_of"] is not None
                    and event["event_type"] in immutable_history for event in events),
            "QA rounds and finding history cannot be replaced by correction")
    active = _apply_corrections(events, "feature")
    grouped = defaultdict(list)
    for event in active:
        grouped[event["feature_id"]].append(event)
    for feature_id, feature in features.items():
        _validate_feature_history(feature_id, grouped[feature_id], feature)
    return active


def _validate_feature_history(feature_id, events, feature):
    rounds = {}
    findings = {}
    criteria = {value["criterion_id"]: value for value in feature["acceptance_criteria"]}
    singleton_counts = Counter()
    for event_index, event in enumerate(events):
        event_type = event["event_type"]
        if event_type == "qa_handoff":
            round_id = event["round_id"]
            require(round_id not in rounds, f"{feature_id}: duplicate QA handoff {round_id}")
            rounds[round_id] = {"artifact": event["artifact_version"], "disposition": None,
                                "handoff_index": len(rounds)}
        elif event_type == "qa_disposition":
            round_id = event["round_id"]
            require(round_id in rounds, f"{feature_id}: disposition before handoff {round_id}")
            require(rounds[round_id]["disposition"] is None,
                    f"{feature_id}: duplicate disposition {round_id}")
            require(rounds[round_id]["artifact"] == event["artifact_version"],
                    f"{feature_id}: disposition is not bound to handed-off artifact")
            rounds[round_id]["disposition"] = event["disposition"]
            rounds[round_id]["independent"] = event["independent"]
            rounds[round_id]["reviewer"] = event["actor"]
            rounds[round_id]["disposition_index"] = event_index
        elif event_type == "finding_opened":
            finding_id = event["finding_id"]
            require(finding_id not in findings, f"{feature_id}: duplicate finding {finding_id}")
            findings[finding_id] = "open"
        elif event_type == "finding_resolved":
            finding_id = event["finding_id"]
            require(findings.get(finding_id) in {"open", "reopened"},
                    f"{feature_id}: cannot resolve finding {finding_id}")
            findings[finding_id] = "resolved"
        elif event_type == "finding_reopened":
            finding_id = event["finding_id"]
            require(findings.get(finding_id) == "resolved",
                    f"{feature_id}: cannot reopen finding {finding_id}")
            findings[finding_id] = "reopened"
        elif event_type == "criterion_result":
            criterion_id = event["criterion_id"]
            require(criterion_id in criteria and criteria[criterion_id]["applicable"],
                    f"{feature_id}: result for unknown/non-applicable criterion {criterion_id}")
        if event_type in {"started", "accepted", "published", "deployed"}:
            singleton_counts[event_type] += 1
            require(singleton_counts[event_type] == 1,
                    f"{feature_id}: duplicate {event_type} event")
    states = {event["event_type"] for event in events}
    required_events = {"accepted": {"accepted"}, "published": {"accepted", "published"},
                       "live": {"accepted", "deployed"}}.get(feature["state"], set())
    if required_events:
        require(required_events <= states,
                f"{feature_id}: state lacks lifecycle events {sorted(required_events - states)}")
        latest = {}
        accepted_index = next(index for index, event in enumerate(events)
                              if event["event_type"] == "accepted")
        accepted = events[accepted_index]
        for index, event in enumerate(events):
            if event["event_type"] == "criterion_result":
                latest[event["criterion_id"]] = (event["status"], event["artifact_version"], index)
        applicable = [criterion_id for criterion_id, item in criteria.items() if item["applicable"]]
        require(all(criterion_id in latest and latest[criterion_id][0] == "pass"
                    and latest[criterion_id][1] == accepted["artifact_version"]
                    and latest[criterion_id][2] < accepted_index for criterion_id in applicable),
                f"{feature_id}: acceptance lacks prior passing criteria on accepted artifact")
        accepted_rounds = [value for value in rounds.values()
                           if value["artifact"] == accepted["artifact_version"]
                           and value["handoff_index"] < accepted_index]
        require(bool(accepted_rounds),
                f"{feature_id}: acceptance lacks QA handoff on accepted artifact")
        latest_round = max(accepted_rounds, key=lambda value: value["handoff_index"])
        require(latest_round.get("disposition") == "pass"
                and latest_round.get("independent") is True
                and latest_round.get("reviewer") != feature["owner"]
                and latest_round.get("disposition_index", accepted_index) < accepted_index,
                f"{feature_id}: latest QA on accepted artifact is not an independent prior pass")
        finding_states = {}
        finding_severity = {}
        for event in events[:accepted_index]:
            if event["event_type"] == "finding_opened":
                finding_states[event["finding_id"]] = "open"
                finding_severity[event["finding_id"]] = event["severity"]
            elif event["event_type"] == "finding_resolved":
                finding_states[event["finding_id"]] = "resolved"
            elif event["event_type"] == "finding_reopened":
                finding_states[event["finding_id"]] = "reopened"
        require(not any(state != "resolved" and finding_severity[finding_id] in {"high", "critical"}
                        for finding_id, state in finding_states.items()),
                f"{feature_id}: acceptance has unresolved material findings")
        require(all(event["artifact_version"] == accepted["artifact_version"]
                    for event in events[accepted_index + 1:]),
                f"{feature_id}: accepted state has later events on a different artifact")
        require(nonempty(feature["delivered_behavior"]),
                f"{feature_id}: accepted/published/live feature lacks delivered_behavior")
        for event_type in ("published", "deployed"):
            matching = [(index, event) for index, event in enumerate(events)
                        if event["event_type"] == event_type]
            for index, event in matching:
                require(index > accepted_index and event["artifact_version"] == accepted["artifact_version"],
                        f"{feature_id}: {event_type} must follow and match accepted artifact")


def validate_usage_events(events, features):
    for event in events:
        label = f"usage event line {event['_line']}"
        _validate_common_event(event, features, label)
        require(event["event_type"] in {"reservation", "settlement"},
                f"{label}: unsupported event_type")
        identifier(event.get("call_id"), "call_id")
        require(event.get("phase") in PHASES, f"{label}: invalid phase")
        if event["event_type"] == "reservation":
            for name in ("provider", "generation_id"):
                require(nonempty(event.get(name)), f"{label}: missing {name}")
            require(event.get("retry_of") is None or nonempty(event.get("retry_of")),
                    f"{label}: invalid retry_of")
            money(event.get("reserved_usd"), f"{label}.reserved_usd", nullable=True)
            nullable_text(event.get("requested_model"), f"{label}.requested_model")
            nullable_text(event.get("requested_effort"), f"{label}.requested_effort")
            nullable_text(event.get("price_version"), f"{label}.price_version")
        else:
            amount = money(event.get("actual_usd"), f"{label}.actual_usd")
            require(event.get("charge_status") in {"billed", "not_billed"},
                    f"{label}: charge status must explicitly establish a known amount")
            require(event["charge_status"] != "not_billed" or amount == 0,
                    f"{label}: not_billed settlement must be zero")
            nullable_text(event.get("actual_model"), f"{label}.actual_model")
            nullable_text(event.get("actual_effort"), f"{label}.actual_effort")
            _validate_tokens(event.get("tokens"), label)
    _ordered_unique(events, "usage event stream")
    active = _apply_corrections(events, "usage")
    reservations = {}
    settlements = {}
    generations = set()
    for event in active:
        call_id = event["call_id"]
        if event["event_type"] == "reservation":
            require(call_id not in reservations, f"Duplicate reservation for call {call_id}")
            identity = (event["provider"], event["generation_id"])
            require(identity not in generations,
                    f"Provider generation billed/reserved more than once: {identity}")
            retry_of = event["retry_of"]
            require(retry_of is None or retry_of in reservations,
                    f"{call_id}: retry_of must name an earlier call")
            require(event["phase"] == "retry" if retry_of is not None else True,
                    f"{call_id}: retry calls must use retry phase")
            reservations[call_id] = event
            generations.add(identity)
        else:
            require(call_id in reservations, f"Settlement before reservation for call {call_id}")
            require(call_id not in settlements, f"Duplicate settlement for call {call_id}")
            reservation = reservations[call_id]
            require((event["feature_id"], event["run_id"], event["artifact_version"], event["phase"])
                    == (reservation["feature_id"], reservation["run_id"],
                        reservation["artifact_version"], reservation["phase"]),
                    f"{call_id}: settlement does not match reservation binding")
            settlements[call_id] = event
    return active, reservations, settlements


def _validate_tokens(tokens, label):
    fields(tokens, ("input", "cached_input", "output", "reasoning"), f"{label}.tokens")
    require(set(tokens) == {"input", "cached_input", "output", "reasoning"},
            f"{label}.tokens has unknown fields")
    for name, value in tokens.items():
        require(value is None or (type(value) is int and value >= 0),
                f"{label}: invalid {name} token count")
    if tokens["cached_input"] is not None and tokens["input"] is not None:
        require(tokens["cached_input"] <= tokens["input"],
                f"{label}: cached_input exceeds input")
    if tokens["reasoning"] is not None and tokens["output"] is not None:
        require(tokens["reasoning"] <= tokens["output"],
                f"{label}: reasoning exceeds output")


def load_inputs(registry_path, feature_events_path, usage_events_path):
    features = validate_registry(read_json(registry_path))
    feature_events = validate_feature_events(read_jsonl(feature_events_path), features)
    usage_events, reservations, settlements = validate_usage_events(
        read_jsonl(usage_events_path), features)
    return features, feature_events, usage_events, reservations, settlements


def load_runs(runs_dir, features):
    """Read only the native run records explicitly linked by the feature registry."""
    if runs_dir is None:
        return {}
    run_ids = {run_id for feature in features.values() for run_id in feature["run_ids"]}
    runs = {}
    for run_id in sorted(run_ids):
        path = runs_dir / f"{run_id}.json"
        require(path.is_file(), f"Missing linked run record: {path}")
        run = read_json(path)
        fields(run, ("id", "role", "execution_context", "compute", "metrics", "review", "outcome"),
               f"run {run_id}")
        require(run["id"] == run_id, f"Run file identity mismatch: {path}")
        require(nonempty(run["role"]) and nonempty(run["execution_context"]),
                f"{run_id}: invalid role/execution context")
        fields(run["compute"], ("requested", "observed"), f"{run_id}.compute")
        for route_name in ("requested", "observed"):
            fields(run["compute"][route_name], ("model", "effort"),
                   f"{run_id}.{route_name}")
            for setting in ("model", "effort"):
                nullable_text(run["compute"][route_name][setting],
                              f"{run_id}.{route_name}.{setting}")
        fields(run["metrics"], ("cost_usd",), f"{run_id}.metrics")
        _native_cost(run["metrics"]["cost_usd"], f"{run_id}.metrics.cost_usd")
        fields(run["review"], ("reviewer_execution_context", "independent", "verdict"),
               f"{run_id}.review")
        require(type(run["review"]["independent"]) is bool, f"{run_id}: invalid independent flag")
        nullable_text(run["review"]["reviewer_execution_context"], f"{run_id}.reviewer")
        require(run["review"]["verdict"] in {"pending", "pass", "fail", "insufficient_evidence"},
                f"{run_id}: invalid review verdict")
        fields(run["outcome"], ("status", "first_review"), f"{run_id}.outcome")
        runs[run_id] = run
    return runs


def _native_cost(value, label):
    if value is None:
        return None
    require(type(value) in (int, float), f"{label} must be a nonnegative number or null")
    parsed = Decimal(str(value))
    require(parsed.is_finite() and parsed >= 0, f"{label} must be finite and nonnegative")
    return parsed


def _decimal_text(value):
    return None if value is None else format(value, "f")


def _feature_scorecard(feature, events, calls, settlements, runs):
    criteria = [item for item in feature["acceptance_criteria"] if item["applicable"]]
    criterion_results = {}
    findings = {}
    rounds = []
    dispositions = {}
    accepted_seen = False
    post_acceptance = set()
    lifecycle = {}
    pending_failed_artifacts = set()
    rework_cycles = 0
    for event in events:
        event_type = event["event_type"]
        if event_type in {"started", "accepted", "published", "deployed"}:
            lifecycle[f"{event_type}_at"] = event["occurred_at"]
        if event_type == "accepted":
            accepted_seen = True
        elif event_type == "criterion_result":
            criterion_results[event["criterion_id"]] = event["status"]
        elif event_type == "finding_opened":
            findings[event["finding_id"]] = {"severity": event["severity"],
                                                "category": event["category"], "state": "open"}
            if accepted_seen:
                post_acceptance.add(event["finding_id"])
        elif event_type == "finding_resolved":
            findings[event["finding_id"]]["state"] = "resolved"
        elif event_type == "finding_reopened":
            findings[event["finding_id"]]["state"] = "reopened"
        elif event_type == "qa_handoff":
            if pending_failed_artifacts and event["artifact_version"] not in pending_failed_artifacts:
                rework_cycles += 1
                pending_failed_artifacts.clear()
            rounds.append(event["round_id"])
        elif event_type == "qa_disposition":
            dispositions[event["round_id"]] = event["disposition"]
            if event["disposition"] == "fail":
                pending_failed_artifacts.add(event["artifact_version"])
    latest_statuses = [criterion_results.get(item["criterion_id"], "pending") for item in criteria]
    first_disposition = next((dispositions[round_id] for round_id in rounds
                              if round_id in dispositions), None)
    actual_amounts = [money(settlements[call_id]["actual_usd"], "actual_usd")
                      for call_id in calls if call_id in settlements]
    unsettled = [call_id for call_id in calls if call_id not in settlements]
    known_reserves = [money(calls[call_id]["reserved_usd"], "reserved_usd")
                      for call_id in unsettled if calls[call_id]["reserved_usd"] is not None]
    phase_amounts = defaultdict(list)
    routes = []
    for call_id, reservation in calls.items():
        settlement = settlements.get(call_id)
        if settlement:
            phase_amounts[reservation["phase"]].append(money(settlement["actual_usd"], "actual_usd"))
        routes.append({
            "call_id": call_id,
            "run_id": reservation["run_id"],
            "requested": {"model": reservation["requested_model"],
                          "effort": reservation["requested_effort"]},
            "actual": {"model": settlement["actual_model"] if settlement else None,
                       "effort": settlement["actual_effort"] if settlement else None},
        })
    lead_seconds = None
    if "started_at" in lifecycle and "accepted_at" in lifecycle:
        lead_seconds = int((timestamp(lifecycle["accepted_at"], "accepted_at")
                            - timestamp(lifecycle["started_at"], "started_at")).total_seconds())
    severity = Counter(item["severity"] for item in findings.values())
    native_runs = []
    for run_id in feature["run_ids"]:
        run = runs.get(run_id)
        if run is None:
            native_runs.append({"run_id": run_id, "record_joined": False, "role": None,
                                "execution_context": None,
                                "requested": {"model": None, "effort": None},
                                "observed": {"model": None, "effort": None},
                                "cost_usd": None, "first_review": None,
                                "review": {"reviewer_execution_context": None,
                                           "independent": None, "verdict": None}})
            continue
        cost = _native_cost(run["metrics"]["cost_usd"], f"{run_id}.cost_usd")
        native_runs.append({"run_id": run_id, "record_joined": True, "role": run["role"],
                            "execution_context": run["execution_context"],
                            "requested": run["compute"]["requested"],
                            "observed": run["compute"]["observed"],
                            "cost_usd": _decimal_text(cost),
                            "first_review": run["outcome"]["first_review"],
                            "review": {"reviewer_execution_context": run["review"]["reviewer_execution_context"],
                                       "independent": run["review"]["independent"],
                                       "verdict": run["review"]["verdict"]}})
    return {
        "feature_id": feature["feature_id"],
        "milestone_id": feature["milestone_id"],
        "title": feature["title"],
        "problem": feature["problem"],
        "delivered_behavior": feature["delivered_behavior"],
        "state": feature["state"],
        "owner": feature["owner"],
        "risk_class": feature["risk_class"],
        "complexity_class": feature["complexity_class"],
        "run_ids": feature["run_ids"],
        "lifecycle": {**lifecycle, "lead_time_seconds": lead_seconds},
        "acceptance_coverage": {"passed": latest_statuses.count("pass"),
                                "applicable_denominator": len(criteria),
                                "failed": latest_statuses.count("fail"),
                                "pending": latest_statuses.count("pending")},
        "qa": {"unique_findings": len(findings),
               "findings_by_severity": {level: severity[level] for level in sorted(SEVERITIES)},
               "open_or_reopened_findings": sum(item["state"] != "resolved"
                                                 for item in findings.values()),
               "review_rounds": len(rounds), "completed_rounds": len(dispositions),
               "rework_cycles": rework_cycles,
               "post_acceptance_findings": len(post_acceptance),
               "first_review": {"result": first_disposition,
                                "pass_numerator": int(first_disposition == "pass"),
                                "completed_denominator": int(first_disposition is not None)}},
        "cost": {"actual_usd_lower_bound": _decimal_text(sum(actual_amounts, Decimal(0)))
                 if actual_amounts else None,
                 "actual_usd_known_calls": len(actual_amounts), "total_calls": len(calls),
                 "unknown_actual_usd_calls": len(unsettled),
                 "unsettled_reserved_usd": _decimal_text(sum(known_reserves, Decimal(0)))
                 if known_reserves else None,
                 "unsettled_calls_with_known_reserve": len(known_reserves),
                 "unsettled_calls_with_unknown_reserve": len(unsettled) - len(known_reserves),
                 "actual_by_phase_usd": {phase: _decimal_text(sum(phase_amounts[phase], Decimal(0)))
                                         if phase_amounts[phase] else None
                                         for phase in sorted(PHASES)}},
        "model_settings": {"routes": routes, "total_calls": len(routes),
                           "requested_model_known_calls": sum(route["requested"]["model"] is not None for route in routes),
                           "requested_effort_known_calls": sum(route["requested"]["effort"] is not None for route in routes),
                           "actual_model_known_calls": sum(route["actual"]["model"] is not None for route in routes),
                           "actual_effort_known_calls": sum(route["actual"]["effort"] is not None for route in routes)},
        "native_runs": {"runs": native_runs, "registered_runs": len(native_runs),
                        "joined_records": sum(run["record_joined"] for run in native_runs),
                        "requested_model_known_runs": sum(run["requested"]["model"] is not None for run in native_runs),
                        "observed_model_known_runs": sum(run["observed"]["model"] is not None for run in native_runs),
                        "cost_known_runs": sum(run["cost_usd"] is not None for run in native_runs)},
    }


def build_scorecards(features, feature_events, reservations, settlements, runs=None):
    runs = runs or {}
    events_by_feature = defaultdict(list)
    calls_by_feature = defaultdict(dict)
    for event in feature_events:
        events_by_feature[event["feature_id"]].append(event)
    for call_id, reservation in reservations.items():
        calls_by_feature[reservation["feature_id"]][call_id] = reservation
    cards = [_feature_scorecard(feature, events_by_feature[feature_id],
                                calls_by_feature[feature_id], settlements, runs)
             for feature_id, feature in features.items()]
    known_costs = [Decimal(card["cost"]["actual_usd_lower_bound"])
                   for card in cards if card["cost"]["actual_usd_lower_bound"] is not None]
    total_calls = sum(card["cost"]["total_calls"] for card in cards)
    first_review_denominator = sum(card["qa"]["first_review"]["completed_denominator"] for card in cards)
    model_groups = defaultdict(lambda: {"calls": 0, "actual_usd": Decimal(0),
                                        "cost_known_calls": 0, "features": set()})
    unknown_settings = 0
    for card in cards:
        for route in card["model_settings"]["routes"]:
            actual = route["actual"]
            if actual["model"] is None or actual["effort"] is None:
                unknown_settings += 1
                continue
            key = (actual["model"], actual["effort"], card["risk_class"], card["complexity_class"])
            group = model_groups[key]
            group["calls"] += 1
            group["features"].add(card["feature_id"])
            settlement = settlements.get(route["call_id"])
            if settlement:
                group["actual_usd"] += money(settlement["actual_usd"], "actual_usd")
                group["cost_known_calls"] += 1
    model_review = [{"actual_model": key[0], "actual_effort": key[1], "risk_class": key[2],
                     "complexity_class": key[3], "calls": value["calls"],
                     "features_touched": len(value["features"]),
                     "actual_usd_lower_bound": _decimal_text(value["actual_usd"])
                     if value["cost_known_calls"] else None,
                     "cost_known_calls": value["cost_known_calls"]}
                    for key, value in sorted(model_groups.items())]
    return {
        "schema_version": 1,
        "features": cards,
        "portfolio": {"features": len(cards),
                      "accepted_or_later_features": sum(card["state"] in {"accepted", "published", "live"}
                                                         for card in cards),
                      "first_review_passes": sum(card["qa"]["first_review"]["pass_numerator"] for card in cards),
                      "first_review_completed_denominator": first_review_denominator,
                      "actual_usd_lower_bound": _decimal_text(sum(known_costs, Decimal(0)))
                      if known_costs else None,
                      "actual_usd_known_calls": sum(card["cost"]["actual_usd_known_calls"] for card in cards),
                      "total_calls": total_calls,
                      "unknown_actual_usd_calls": sum(card["cost"]["unknown_actual_usd_calls"] for card in cards),
                      "actual_model_known_calls": sum(card["model_settings"]["actual_model_known_calls"] for card in cards),
                      "actual_model_total_calls": total_calls,
                      "native_run_records_joined": sum(card["native_runs"]["joined_records"] for card in cards),
                      "native_runs_registered": sum(card["native_runs"]["registered_runs"] for card in cards),
                      "native_run_cost_known": sum(card["native_runs"]["cost_known_runs"] for card in cards),
                      "native_run_observed_model_known": sum(card["native_runs"]["observed_model_known_runs"] for card in cards)},
        "model_performance_review": {"groups": model_review,
                                     "unknown_actual_setting_calls": unknown_settings,
                                     "limitation": "Descriptive comparable-task slices; features touched do not establish model causality."},
        "limitation": "Derived from supplied records only; unknown measurements remain unknown and actual spend is a measured lower bound.",
    }


def render_markdown(report):
    portfolio = report["portfolio"]
    lines = ["# Feature delivery scorecard", "",
             f"Features: {portfolio['features']} | Accepted or later: {portfolio['accepted_or_later_features']}",
             f"First-review acceptance: {portfolio['first_review_passes']}/{portfolio['first_review_completed_denominator']}",
             f"Measured actual USD lower bound: {portfolio['actual_usd_lower_bound'] if portfolio['actual_usd_lower_bound'] is not None else 'unknown'} "
             f"({portfolio['actual_usd_known_calls']}/{portfolio['total_calls']} calls measured; "
             f"{portfolio['unknown_actual_usd_calls']} unknown)", ""]
    for card in report["features"]:
        coverage = card["acceptance_coverage"]
        qa = card["qa"]
        cost = card["cost"]
        models = card["model_settings"]
        lines.extend([f"## {card['feature_id']} — {card['title']}", "",
                      f"State: {card['state']} | Owner: {card['owner']} | Milestone: {card['milestone_id']}", "",
                      f"Problem: {card['problem']}", "",
                      f"Delivered: {card['delivered_behavior'] or 'Not yet recorded'}", "",
                      f"Acceptance evidence: {coverage['passed']}/{coverage['applicable_denominator']} applicable criteria passed "
                      f"({coverage['failed']} failed, {coverage['pending']} pending).", "",
                      f"QA: {qa['unique_findings']} unique findings; {qa['review_rounds']} rounds "
                      f"({qa['completed_rounds']} completed); {qa['rework_cycles']} rework cycles; "
                      f"{qa['post_acceptance_findings']} post-acceptance findings.", "",
                      f"Actual USD lower bound: {cost['actual_usd_lower_bound'] if cost['actual_usd_lower_bound'] is not None else 'unknown'} "
                      f"({cost['actual_usd_known_calls']}/{cost['total_calls']} calls measured; "
                      f"{cost['unknown_actual_usd_calls']} unknown).", "",
                      f"Actual model identity: {models['actual_model_known_calls']}/{models['total_calls']} calls measured; "
                      f"actual effort: {models['actual_effort_known_calls']}/{models['total_calls']}.", ""])
        if models["routes"]:
            lines.extend(["| Call | Run | Requested | Actual |", "| --- | --- | --- | --- |"])
            for route in models["routes"]:
                requested = "/".join(value or "unknown" for value in route["requested"].values())
                actual = "/".join(value or "unknown" for value in route["actual"].values())
                lines.append(f"| {route['call_id']} | {route['run_id']} | {requested} | {actual} |")
            lines.append("")
        native = card["native_runs"]
        lines.extend([f"Native run records: {native['joined_records']}/{native['registered_runs']} joined; "
                      f"observed model: {native['observed_model_known_runs']}/{native['registered_runs']}; "
                      f"cost: {native['cost_known_runs']}/{native['registered_runs']} measured.", ""])
        if native["runs"]:
            lines.extend(["| Native run | Role | Requested | Observed | Reviewer / verdict | Cost USD |",
                          "| --- | --- | --- | --- | --- | ---: |"])
            for run in native["runs"]:
                requested = "/".join(value or "unknown" for value in run["requested"].values())
                observed = "/".join(value or "unknown" for value in run["observed"].values())
                reviewer = run["review"]["reviewer_execution_context"] or "unknown"
                verdict = run["review"]["verdict"] or "unknown"
                lines.append(f"| {run['run_id']} | {run['role'] or 'unknown'} | {requested} | {observed} | "
                             f"{reviewer} / {verdict} | {run['cost_usd'] or 'unknown'} |")
            lines.append("")
    lines.extend(["## Model performance review", "",
                  "Descriptive slices by actual route and comparable risk/complexity; features touched do not establish causality.", ""])
    groups = report["model_performance_review"]["groups"]
    if groups:
        lines.extend(["| Actual route | Risk / complexity | Calls | Features touched | Measured USD |",
                      "| --- | --- | ---: | ---: | ---: |"])
        for group in groups:
            lines.append(f"| {group['actual_model']}/{group['actual_effort']} | "
                         f"{group['risk_class']} / {group['complexity_class']} | {group['calls']} | "
                         f"{group['features_touched']} | {group['actual_usd_lower_bound'] or 'unknown'} "
                         f"({group['cost_known_calls']}/{group['calls']}) |")
        lines.append("")
    lines.append(f"Calls with unknown actual model/effort: {report['model_performance_review']['unknown_actual_setting_calls']}.")
    lines.extend(["", f"Limitation: {report['limitation']}", ""])
    return "\n".join(lines)


def _add_inputs(parser):
    parser.add_argument("--registry", type=Path, required=True)
    parser.add_argument("--feature-events", type=Path, required=True)
    parser.add_argument("--usage-events", type=Path, required=True)
    parser.add_argument("--runs-dir", type=Path)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    validate_parser = commands.add_parser("validate")
    _add_inputs(validate_parser)
    scorecard_parser = commands.add_parser("scorecard")
    _add_inputs(scorecard_parser)
    scorecard_parser.add_argument("--json-out", type=Path, required=True)
    scorecard_parser.add_argument("--markdown-out", type=Path, required=True)
    args = parser.parse_args(argv)
    try:
        features, feature_events, _, reservations, settlements = load_inputs(
            args.registry, args.feature_events, args.usage_events)
        runs = load_runs(args.runs_dir, features)
        if args.command == "validate":
            output = {"valid": True, "features": len(features),
                      "feature_events": len(feature_events), "calls": len(reservations),
                      "settled_calls": len(settlements), "joined_runs": len(runs)}
        else:
            inputs = {args.registry.resolve(), args.feature_events.resolve(), args.usage_events.resolve()}
            if args.runs_dir is not None:
                inputs.update((args.runs_dir / f"{run_id}.json").resolve()
                              for feature in features.values() for run_id in feature["run_ids"])
            require(args.json_out.resolve() not in inputs and args.markdown_out.resolve() not in inputs,
                    "Report output cannot overwrite an input")
            require(args.json_out.resolve() != args.markdown_out.resolve(),
                    "JSON and Markdown outputs must differ")
            report = build_scorecards(features, feature_events, reservations, settlements, runs)
            args.json_out.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n",
                                     encoding="utf-8")
            args.markdown_out.write_text(render_markdown(report), encoding="utf-8")
            output = {"valid": True, "features": len(features),
                      "json_out": str(args.json_out), "markdown_out": str(args.markdown_out)}
        print(json.dumps(output, indent=2))
        return 0
    except (InvalidMetrics, OSError, ValueError, TypeError, KeyError) as exc:
        print(json.dumps({"valid": False, "error": str(exc)}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
