"""Durable local workflow tickets; never executes workers, shells, providers, or deploys."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import sqlite3
import sys
import uuid


class WorkflowError(ValueError):
    """The requested state transition is unsafe or unsupported."""


ID_RE = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,63}")
MONEY_RE = re.compile(r"(?:0|[1-9][0-9]*)(?:\.[0-9]{1,6})?")
SHA_RE = re.compile(r"[0-9a-f]{64}")
ACTIVE_TICKETS = ("reserved", "started", "uncertain")
RUNNABLE_STATES = ("pending", "correction_ready", "invalidated")


def require(condition, message):
    if not condition:
        raise WorkflowError(message)


def exact_fields(value, names, label):
    require(isinstance(value, dict), f"{label} must be an object")
    expected = set(names)
    require(set(value) == expected,
            f"{label} fields differ: missing={sorted(expected-set(value))}, extra={sorted(set(value)-expected)}")


def identifier(value, label):
    require(isinstance(value, str) and ID_RE.fullmatch(value), f"Invalid {label}")
    return value


def nonempty(value, label):
    require(isinstance(value, str) and bool(value.strip()), f"Invalid {label}")
    return value.strip()


def money(value, label, nullable=False):
    if value is None and nullable:
        return None
    require(isinstance(value, str) and MONEY_RE.fullmatch(value),
            f"{label} must be a nonnegative exact decimal string with at most 6 places")
    try:
        return Decimal(value)
    except InvalidOperation as exc:  # defensive; the regular expression should prevent this
        raise WorkflowError(f"Invalid {label}") from exc


def money_text(value):
    return format(value, "f")


def clean_path(value, label):
    require(isinstance(value, str) and value != "", f"Invalid {label}")
    require("\\" not in value, f"{label} must use repository-relative '/' separators")
    path = PurePosixPath(value)
    require(not path.is_absolute() and value not in (".", "..") and ".." not in path.parts,
            f"{label} must be a contained repository-relative path")
    normalized = path.as_posix().rstrip("/")
    require(normalized and normalized == value.rstrip("/"), f"{label} is not normalized")
    return normalized


def path_contains(parent, child):
    return child == parent or child.startswith(parent + "/")


def parse_json(path):
    def unique(pairs):
        result = {}
        for key, value in pairs:
            require(key not in result, f"Duplicate JSON key {key!r} in {path}")
            result[key] = value
        return result

    try:
        return json.loads(path.read_text(encoding="utf-8-sig"), object_pairs_hook=unique)
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise WorkflowError(f"Cannot read JSON {path}: {exc}") from exc


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def now():
    return datetime.now(timezone.utc).isoformat(timespec="microseconds").replace("+00:00", "Z")


def validate_plan(plan, workspace):
    exact_fields(plan, ("schema_version", "workflow_id", "max_workers", "budget_usd",
                        "supported_evidence_roots", "tasks"), "plan")
    require(plan["schema_version"] == 1 and type(plan["schema_version"]) is int,
            "Unsupported plan schema")
    identifier(plan["workflow_id"], "workflow_id")
    require(type(plan["max_workers"]) is int and 1 <= plan["max_workers"] <= 3,
            "max_workers must be an integer from 1 through 3")
    money(plan["budget_usd"], "budget_usd")
    roots = plan["supported_evidence_roots"]
    require(isinstance(roots, list) and roots, "supported_evidence_roots must be nonempty")
    roots = [clean_path(item, "supported evidence root") for item in roots]
    require(len(roots) == len(set(roots)), "Duplicate supported evidence root")
    for root in roots:
        resolved = (workspace / Path(root)).resolve()
        require(resolved.is_relative_to(workspace), f"Evidence root escapes workspace: {root}")

    require(isinstance(plan["tasks"], list) and plan["tasks"], "tasks must be nonempty")
    tasks = {}
    for raw in plan["tasks"]:
        exact_fields(raw, ("id", "owner", "risk", "dependencies", "allowed_paths",
                           "reservation_usd", "criteria"), "task")
        task_id = identifier(raw["id"], "task id")
        require(task_id not in tasks, f"Duplicate task id: {task_id}")
        nonempty(raw["owner"], f"owner for {task_id}")
        require(raw["risk"] in ("low", "medium", "high"), f"Invalid risk for {task_id}")
        require(isinstance(raw["dependencies"], list), f"dependencies for {task_id} must be a list")
        dependencies = [identifier(dep, f"dependency for {task_id}") for dep in raw["dependencies"]]
        require(len(dependencies) == len(set(dependencies)) and task_id not in dependencies,
                f"Duplicate or self dependency for {task_id}")
        require(isinstance(raw["allowed_paths"], list) and raw["allowed_paths"],
                f"allowed_paths for {task_id} must be nonempty")
        allowed = [clean_path(item, f"allowed path for {task_id}") for item in raw["allowed_paths"]]
        require(len(allowed) == len(set(allowed)), f"Duplicate allowed path for {task_id}")
        for path in allowed:
            require(any(path_contains(root, path) or path_contains(path, root) for root in roots),
                    f"Allowed path is outside supported evidence roots for {task_id}: {path}")
        money(raw["reservation_usd"], f"reservation_usd for {task_id}", nullable=True)
        require(isinstance(raw["criteria"], list) and raw["criteria"],
                f"criteria for {task_id} must be nonempty")
        criteria = set()
        for criterion in raw["criteria"]:
            exact_fields(criterion, ("id", "description", "evidence_paths"), "criterion")
            criterion_id = identifier(criterion["id"], f"criterion id for {task_id}")
            require(criterion_id not in criteria, f"Duplicate criterion {criterion_id} for {task_id}")
            criteria.add(criterion_id)
            nonempty(criterion["description"], f"criterion description for {task_id}")
            require(isinstance(criterion["evidence_paths"], list) and criterion["evidence_paths"],
                    f"Criterion {criterion_id} requires evidence_paths")
            evidence_paths = [clean_path(item, f"evidence path for {task_id}/{criterion_id}")
                              for item in criterion["evidence_paths"]]
            require(len(evidence_paths) == len(set(evidence_paths)),
                    f"Duplicate evidence path for {task_id}/{criterion_id}")
            for path in evidence_paths:
                require(any(path_contains(allowed_path, path) for allowed_path in allowed),
                        f"Criterion evidence is outside task ownership for {task_id}: {path}")
                require(any(path_contains(root, path) for root in roots),
                        f"Criterion evidence is outside supported roots for {task_id}: {path}")
        tasks[task_id] = raw

    for task_id, task in tasks.items():
        for dep in task["dependencies"]:
            require(dep in tasks, f"Unknown dependency {dep} for {task_id}")
    visiting, visited = set(), set()

    def visit(task_id):
        require(task_id not in visiting, f"Dependency cycle includes {task_id}")
        if task_id in visited:
            return
        visiting.add(task_id)
        for dep in tasks[task_id]["dependencies"]:
            visit(dep)
        visiting.remove(task_id)
        visited.add(task_id)

    for task_id in sorted(tasks):
        visit(task_id)

    def depends_on(task_id, possible_ancestor):
        return any(dep == possible_ancestor or depends_on(dep, possible_ancestor)
                   for dep in tasks[task_id]["dependencies"])

    ids = sorted(tasks)
    for index, left_id in enumerate(ids):
        for right_id in ids[index + 1:]:
            overlap = any(path_contains(left, right) or path_contains(right, left)
                          for left in tasks[left_id]["allowed_paths"]
                          for right in tasks[right_id]["allowed_paths"])
            require(not overlap or depends_on(left_id, right_id) or depends_on(right_id, left_id),
                    f"Independent tasks have overlapping owned paths: {left_id}, {right_id}")
    return tasks


SCHEMA = """
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE tasks (
  id TEXT PRIMARY KEY, owner TEXT NOT NULL, risk TEXT NOT NULL, status TEXT NOT NULL,
  version INTEGER NOT NULL, correction_failures INTEGER NOT NULL DEFAULT 0,
  reservation_usd TEXT, spec_json TEXT NOT NULL
);
CREATE TABLE dependencies (task_id TEXT NOT NULL, dep_id TEXT NOT NULL,
  PRIMARY KEY(task_id, dep_id));
CREATE TABLE tickets (
  id TEXT PRIMARY KEY, task_id TEXT NOT NULL, task_version INTEGER NOT NULL,
  worker_id TEXT NOT NULL, kind TEXT NOT NULL, status TEXT NOT NULL,
  reserved_usd TEXT NOT NULL, dependency_versions_json TEXT NOT NULL,
  evidence_json TEXT, actual_cost_usd TEXT, created_at TEXT NOT NULL,
  started_at TEXT, completed_at TEXT
);
CREATE TABLE risk_reviews (
  task_id TEXT NOT NULL, task_version INTEGER NOT NULL, reviewer_id TEXT NOT NULL,
  decision TEXT NOT NULL, evidence_path TEXT NOT NULL, sha256 TEXT NOT NULL,
  PRIMARY KEY(task_id, task_version)
);
CREATE TABLE qa_reviews (
  task_id TEXT NOT NULL, task_version INTEGER NOT NULL, reviewer_id TEXT NOT NULL,
  verdict TEXT NOT NULL, reason TEXT NOT NULL, evidence_path TEXT NOT NULL,
  sha256 TEXT NOT NULL, binding_json TEXT NOT NULL,
  PRIMARY KEY(task_id, task_version)
);
CREATE TABLE events (
  seq INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, event_type TEXT NOT NULL,
  task_id TEXT, payload_json TEXT NOT NULL
);
CREATE TRIGGER events_no_update BEFORE UPDATE ON events BEGIN
  SELECT RAISE(ABORT, 'events are append-only'); END;
CREATE TRIGGER events_no_delete BEFORE DELETE ON events BEGIN
  SELECT RAISE(ABORT, 'events are append-only'); END;
"""


def connect(path, must_exist=True):
    require(not must_exist or path.is_file(), f"Missing workflow database: {path}")
    connection = sqlite3.connect(path, timeout=5, isolation_level=None)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys=ON")
    return connection


def meta(connection, key):
    row = connection.execute("SELECT value FROM meta WHERE key=?", (key,)).fetchone()
    require(row is not None, f"Missing workflow metadata: {key}")
    return row["value"]


def event(connection, event_type, task_id, payload):
    connection.execute("INSERT INTO events(at,event_type,task_id,payload_json) VALUES(?,?,?,?)",
                       (now(), event_type, task_id, canonical(payload)))


def transaction(connection):
    connection.execute("BEGIN IMMEDIATE")


def commit(connection):
    connection.execute("COMMIT")


def rollback(connection):
    if connection.in_transaction:
        connection.execute("ROLLBACK")


def workspace_path(connection, relative, supported_only=True):
    relative = clean_path(relative, "evidence path")
    workspace = Path(meta(connection, "workspace")).resolve()
    candidate = (workspace / Path(relative)).resolve()
    require(candidate.is_relative_to(workspace), f"Path escapes workspace: {relative}")
    if supported_only:
        roots = json.loads(meta(connection, "supported_evidence_roots"))
        require(any(path_contains(root, relative) for root in roots),
                f"Path is outside supported evidence roots: {relative}")
    require(candidate.is_file(), f"Missing evidence file: {relative}")
    return candidate


def checked_hash(connection, path, claimed):
    require(isinstance(claimed, str) and SHA_RE.fullmatch(claimed), "Expected lowercase SHA-256 digest")
    actual = digest(workspace_path(connection, path))
    require(actual == claimed, f"Artifact digest mismatch: {path}")


def task_spec(row):
    return json.loads(row["spec_json"])


def dependencies(connection, task_id):
    return connection.execute(
        "SELECT t.id,t.status,t.version FROM dependencies d JOIN tasks t ON t.id=d.dep_id "
        "WHERE d.task_id=? ORDER BY t.id", (task_id,)).fetchall()


def active_count(connection):
    placeholders = ",".join("?" for _ in ACTIVE_TICKETS)
    return connection.execute(f"SELECT count(*) n FROM tickets WHERE status IN ({placeholders})",
                              ACTIVE_TICKETS).fetchone()["n"]


def budget_used(connection):
    total = Decimal("0")
    for row in connection.execute("SELECT status,reserved_usd,actual_cost_usd FROM tickets"):
        if row["status"] != "canceled":
            total += Decimal(row["actual_cost_usd"] if row["actual_cost_usd"] is not None
                             else row["reserved_usd"])
    return total


def accepted_integrity(connection, task_id, seen=None):
    """Recheck current bytes and bindings before a dependent can inherit acceptance."""
    seen = set() if seen is None else seen
    require(task_id not in seen, f"Accepted dependency recursion includes {task_id}")
    seen.add(task_id)
    task = connection.execute("SELECT * FROM tasks WHERE id=?", (task_id,)).fetchone()
    require(task is not None and task["status"] == "accepted", f"Dependency is not accepted: {task_id}")
    ticket = connection.execute(
        "SELECT * FROM tickets WHERE task_id=? AND task_version=? AND status='accepted'",
        (task_id, task["version"])).fetchone()
    require(ticket is not None and ticket["evidence_json"] is not None,
            f"Missing accepted submission: {task_id}")
    evidence = json.loads(ticket["evidence_json"])
    for artifact in evidence["artifacts"]:
        checked_hash(connection, artifact["path"], artifact["sha256"])
    review = connection.execute(
        "SELECT * FROM qa_reviews WHERE task_id=? AND task_version=? AND verdict='accept'",
        (task_id, task["version"])).fetchone()
    require(review is not None, f"Missing accepted QA binding: {task_id}")
    checked_hash(connection, review["evidence_path"], review["sha256"])
    current = {row["id"]: row["version"] for row in dependencies(connection, task_id)
               if row["status"] == "accepted"}
    require(evidence["dependency_versions"] == current,
            f"Accepted dependency versions are stale: {task_id}")
    for dependency_id in current:
        accepted_integrity(connection, dependency_id, seen.copy())


def blockers(connection, task):
    result = []
    if meta(connection, "paused") == "1":
        result.append("workflow_paused")
    if task["status"] not in RUNNABLE_STATES:
        result.append(f"state:{task['status']}")
    deps = dependencies(connection, task["id"])
    for dep in deps:
        if dep["status"] != "accepted":
            result.append(f"dependency:{dep['id']}:{dep['status']}")
        else:
            try:
                accepted_integrity(connection, dep["id"])
            except (WorkflowError, OSError, json.JSONDecodeError):
                result.append(f"dependency:{dep['id']}:stale_evidence")
    if task["risk"] == "high":
        review = connection.execute(
            "SELECT * FROM risk_reviews WHERE task_id=? AND task_version=?",
            (task["id"], task["version"])).fetchone()
        if review is None or review["decision"] != "allow_ticket":
            result.append("external_high_risk_review_required")
        else:
            try:
                checked_hash(connection, review["evidence_path"], review["sha256"])
            except (WorkflowError, OSError):
                result.append("external_high_risk_review_stale")
    if task["reservation_usd"] is None:
        result.append("unknown_cost_reservation")
    if active_count(connection) >= int(meta(connection, "max_workers")):
        result.append("concurrency_limit")
    if task["reservation_usd"] is not None:
        ceiling = Decimal(meta(connection, "budget_usd"))
        if budget_used(connection) + Decimal(task["reservation_usd"]) > ceiling:
            result.append("budget_ceiling")
    return result


def validate_ticket_prerequisites(connection, task, ticket):
    expected = json.loads(ticket["dependency_versions_json"])
    current = {row["id"]: row["version"] for row in dependencies(connection, task["id"])
               if row["status"] == "accepted"}
    require(current == expected, "Ticket dependency versions are stale")
    for dependency_id in current:
        accepted_integrity(connection, dependency_id)
    if task["risk"] == "high":
        review = connection.execute(
            "SELECT * FROM risk_reviews WHERE task_id=? AND task_version=?",
            (task["id"], task["version"])).fetchone()
        require(review is not None and review["decision"] == "allow_ticket",
                "High-risk ticket lacks an allowing external review record")
        checked_hash(connection, review["evidence_path"], review["sha256"])


def command_init(args):
    require(not args.db.exists(), f"Refusing to overwrite workflow database: {args.db}")
    workspace = args.workspace.resolve()
    require(workspace.is_dir(), f"Missing workspace: {workspace}")
    plan = parse_json(args.plan)
    tasks = validate_plan(plan, workspace)
    connection = connect(args.db, must_exist=False)
    try:
        connection.executescript(SCHEMA)
        transaction(connection)
        values = {
            "schema_version": "1", "workflow_id": plan["workflow_id"],
            "workspace": str(workspace), "max_workers": str(plan["max_workers"]),
            "budget_usd": money_text(money(plan["budget_usd"], "budget_usd")), "paused": "0",
            "supported_evidence_roots": canonical(plan["supported_evidence_roots"]),
            "plan_sha256": digest(args.plan),
        }
        connection.executemany("INSERT INTO meta(key,value) VALUES(?,?)", values.items())
        for task_id in sorted(tasks):
            task = tasks[task_id]
            reservation = money(task["reservation_usd"], "reservation", nullable=True)
            connection.execute(
                "INSERT INTO tasks(id,owner,risk,status,version,reservation_usd,spec_json) "
                "VALUES(?,?,?,?,?,?,?)",
                (task_id, task["owner"].strip(), task["risk"], "pending", 1,
                 None if reservation is None else money_text(reservation), canonical(task)))
            connection.executemany("INSERT INTO dependencies(task_id,dep_id) VALUES(?,?)",
                                   ((task_id, dep) for dep in sorted(task["dependencies"])))
        event(connection, "workflow_initialized", None,
              {"plan_sha256": values["plan_sha256"], "task_count": len(tasks)})
        commit(connection)
        return {"valid": True, "workflow_id": plan["workflow_id"], "tasks": len(tasks),
                "database": str(args.db)}
    except Exception:
        rollback(connection)
        connection.close()
        if args.db.exists():
            args.db.unlink()
        raise
    finally:
        connection.close()


def command_status(args):
    connection = connect(args.db)
    try:
        ceiling = Decimal(meta(connection, "budget_usd"))
        used = budget_used(connection)
        tasks = [dict(row) for row in connection.execute(
            "SELECT id,owner,risk,status,version,correction_failures,reservation_usd FROM tasks ORDER BY id")]
        return {
            "workflow_id": meta(connection, "workflow_id"), "paused": meta(connection, "paused") == "1",
            "max_workers": int(meta(connection, "max_workers")), "active_tickets": active_count(connection),
            "budget": {"ceiling_usd": money_text(ceiling), "encumbered_or_spent_usd": money_text(used),
                       "available_usd": money_text(ceiling - used)},
            "tasks": tasks,
            "events": connection.execute("SELECT count(*) n FROM events").fetchone()["n"],
        }
    finally:
        connection.close()


def command_ready(args):
    connection = connect(args.db)
    try:
        values = []
        for task in connection.execute("SELECT * FROM tasks ORDER BY id"):
            reasons = blockers(connection, task)
            values.append({"task_id": task["id"], "version": task["version"],
                           "ready": not reasons, "blockers": reasons})
        return {"tasks": values}
    finally:
        connection.close()


def command_dispatch(args):
    worker = identifier(args.worker_id, "worker_id")
    connection = connect(args.db)
    try:
        transaction(connection)
        require(meta(connection, "paused") == "0", "Workflow is paused")
        selected = None
        if args.task_id is not None:
            identifier(args.task_id, "task_id")
            selected = connection.execute("SELECT * FROM tasks WHERE id=?", (args.task_id,)).fetchone()
            require(selected is not None, f"Unknown task: {args.task_id}")
            reasons = blockers(connection, selected)
            require(not reasons, f"Task is not ready: {', '.join(reasons)}")
        else:
            for candidate in connection.execute("SELECT * FROM tasks ORDER BY id"):
                if not blockers(connection, candidate):
                    selected = candidate
                    break
            require(selected is not None, "No task is ready")
        dep_versions = {row["id"]: row["version"] for row in dependencies(connection, selected["id"])}
        ticket_id = uuid.uuid4().hex
        kind = {"pending": "initial", "correction_ready": "correction",
                "invalidated": "revision"}[selected["status"]]
        connection.execute(
            "INSERT INTO tickets(id,task_id,task_version,worker_id,kind,status,reserved_usd,"
            "dependency_versions_json,created_at) VALUES(?,?,?,?,?,?,?,?,?)",
            (ticket_id, selected["id"], selected["version"], worker, kind, "reserved",
             selected["reservation_usd"], canonical(dep_versions), now()))
        connection.execute("UPDATE tasks SET status='reserved' WHERE id=?", (selected["id"],))
        event(connection, "ticket_dispatched", selected["id"],
              {"ticket_id": ticket_id, "task_version": selected["version"], "worker_id": worker,
               "kind": kind, "reserved_usd": selected["reservation_usd"],
               "dependency_versions": dep_versions,
               "limitation": "Local ticket only; no worker or external action was executed."})
        commit(connection)
        return {"ticket_id": ticket_id, "task_id": selected["id"], "task_version": selected["version"],
                "kind": kind, "reserved_usd": selected["reservation_usd"],
                "dependency_versions": dep_versions,
                "executed": False, "next": "start"}
    except Exception:
        rollback(connection)
        raise
    finally:
        connection.close()


def command_start(args):
    connection = connect(args.db)
    try:
        transaction(connection)
        require(meta(connection, "paused") == "0", "Workflow is paused")
        ticket = connection.execute("SELECT * FROM tickets WHERE id=?", (args.ticket_id,)).fetchone()
        require(ticket is not None, "Unknown ticket")
        require(ticket["status"] == "reserved", "Ticket cannot be started or replayed")
        task = connection.execute("SELECT * FROM tasks WHERE id=?", (ticket["task_id"],)).fetchone()
        require(task["status"] == "reserved" and task["version"] == ticket["task_version"],
                "Ticket is stale")
        validate_ticket_prerequisites(connection, task, ticket)
        connection.execute("UPDATE tickets SET status='started',started_at=? WHERE id=?", (now(), ticket["id"]))
        connection.execute("UPDATE tasks SET status='started' WHERE id=?", (task["id"],))
        event(connection, "ticket_started", task["id"], {"ticket_id": ticket["id"]})
        commit(connection)
        return {"ticket_id": ticket["id"], "task_id": task["id"], "status": "started",
                "executed": False}
    except Exception:
        rollback(connection)
        raise
    finally:
        connection.close()


def validate_completion(connection, task, ticket, evidence):
    validate_ticket_prerequisites(connection, task, ticket)
    exact_fields(evidence, ("artifacts", "criteria", "dependency_versions", "actual_cost_usd"),
                 "completion evidence")
    require(isinstance(evidence["artifacts"], list) and evidence["artifacts"],
            "Completion requires artifacts")
    spec = task_spec(task)
    allowed = spec["allowed_paths"]
    artifacts = {}
    for artifact in evidence["artifacts"]:
        exact_fields(artifact, ("path", "sha256"), "artifact")
        path = clean_path(artifact["path"], "artifact path")
        require(path not in artifacts, f"Duplicate artifact path: {path}")
        require(any(path_contains(root, path) for root in allowed),
                f"Artifact is outside task ownership: {path}")
        checked_hash(connection, path, artifact["sha256"])
        artifacts[path] = artifact["sha256"]
    expected_criteria = {criterion["id"]: criterion for criterion in spec["criteria"]}
    require(isinstance(evidence["criteria"], dict) and set(evidence["criteria"]) == set(expected_criteria),
            "Completion criteria must exactly match the plan")
    for criterion_id, refs in evidence["criteria"].items():
        require(isinstance(refs, list) and refs, f"Criterion {criterion_id} requires evidence")
        permitted = expected_criteria[criterion_id]["evidence_paths"]
        for ref in refs:
            exact_fields(ref, ("path", "sha256"), "criterion evidence")
            require(ref["path"] in artifacts and artifacts[ref["path"]] == ref["sha256"],
                    f"Criterion evidence is not an exact submitted artifact: {criterion_id}")
            require(ref["path"] in permitted,
                    f"Criterion evidence path is unsupported for {criterion_id}: {ref['path']}")
    expected_versions = json.loads(ticket["dependency_versions_json"])
    require(evidence["dependency_versions"] == expected_versions,
            "Completion dependency versions differ from dispatch")
    current_versions = {row["id"]: row["version"] for row in dependencies(connection, task["id"])
                        if row["status"] == "accepted"}
    require(current_versions == expected_versions,
            "A dependency changed or is no longer accepted")
    for dependency_id in current_versions:
        accepted_integrity(connection, dependency_id)
    actual = money(evidence["actual_cost_usd"], "actual_cost_usd", nullable=True)
    if actual is not None:
        require(actual <= Decimal(ticket["reserved_usd"]),
                "Actual cost exceeds its conservative reservation")
    return None if actual is None else money_text(actual)


def command_complete(args):
    evidence = parse_json(args.evidence)
    connection = connect(args.db)
    try:
        transaction(connection)
        ticket = connection.execute("SELECT * FROM tickets WHERE id=?", (args.ticket_id,)).fetchone()
        require(ticket is not None, "Unknown ticket")
        require(ticket["status"] == "started", "Only a started, unreplayed ticket can complete")
        task = connection.execute("SELECT * FROM tasks WHERE id=?", (ticket["task_id"],)).fetchone()
        require(task["status"] == "started" and task["version"] == ticket["task_version"],
                "Ticket is stale or uncertain")
        actual = validate_completion(connection, task, ticket, evidence)
        connection.execute(
            "UPDATE tickets SET status='completed',completed_at=?,evidence_json=?,actual_cost_usd=? WHERE id=?",
            (now(), canonical(evidence), actual, ticket["id"]))
        connection.execute("UPDATE tasks SET status='awaiting_qa' WHERE id=?", (task["id"],))
        event(connection, "ticket_completed", task["id"],
              {"ticket_id": ticket["id"], "task_version": task["version"],
               "evidence_sha256": hashlib.sha256(canonical(evidence).encode()).hexdigest(),
               "actual_cost_usd": actual,
               "cost_limitation": "Unknown actual cost retains the full reservation." if actual is None else None})
        commit(connection)
        return {"task_id": task["id"], "task_version": task["version"], "status": "awaiting_qa",
                "actual_cost_usd": actual}
    except Exception:
        rollback(connection)
        raise
    finally:
        connection.close()


def revalidate_submission(connection, task, ticket):
    validate_ticket_prerequisites(connection, task, ticket)
    evidence = json.loads(ticket["evidence_json"])
    for artifact in evidence["artifacts"]:
        checked_hash(connection, artifact["path"], artifact["sha256"])
    require(evidence["dependency_versions"] ==
            {row["id"]: row["version"] for row in dependencies(connection, task["id"])
             if row["status"] == "accepted"}, "Dependency acceptance is stale")
    for dependency_id in evidence["dependency_versions"]:
        accepted_integrity(connection, dependency_id)
    return evidence


def command_qa(args):
    reviewer = identifier(args.reviewer_id, "reviewer_id")
    reason = nonempty(args.reason, "QA reason")
    evidence_path = clean_path(args.evidence_path, "QA evidence path")
    connection = connect(args.db)
    try:
        transaction(connection)
        checked_hash(connection, evidence_path, args.sha256)
        task = connection.execute("SELECT * FROM tasks WHERE id=?", (args.task_id,)).fetchone()
        require(task is not None, "Unknown task")
        require(task["status"] == "awaiting_qa", "Task is not awaiting QA")
        ticket = connection.execute(
            "SELECT * FROM tickets WHERE task_id=? AND task_version=? AND status='completed'",
            (task["id"], task["version"])).fetchone()
        require(ticket is not None, "Missing completed ticket for current task version")
        require(reviewer != task["owner"] and reviewer != ticket["worker_id"],
                "QA reviewer must be independent of owner and worker")
        evidence = revalidate_submission(connection, task, ticket)
        review_binding = {
            "reviewer_id": reviewer, "verdict": args.verdict, "reason": reason,
            "review_evidence": {"path": evidence_path, "sha256": args.sha256},
            "task_version": task["version"], "ticket_id": ticket["id"],
            "artifacts": evidence["artifacts"], "dependency_versions": evidence["dependency_versions"],
        }
        connection.execute(
            "INSERT INTO qa_reviews(task_id,task_version,reviewer_id,verdict,reason,evidence_path,sha256,binding_json) "
            "VALUES(?,?,?,?,?,?,?,?)",
            (task["id"], task["version"], reviewer, args.verdict, reason, evidence_path,
             args.sha256, canonical(review_binding)))
        if args.verdict == "accept":
            connection.execute("UPDATE tickets SET status='accepted' WHERE id=?", (ticket["id"],))
            connection.execute("UPDATE tasks SET status='accepted' WHERE id=?", (task["id"],))
            next_status = "accepted"
        else:
            connection.execute("UPDATE tickets SET status='rejected' WHERE id=?", (ticket["id"],))
            failures = task["correction_failures"] + (1 if ticket["kind"] == "correction" else 0)
            if ticket["kind"] == "correction" and failures >= 2:
                next_status = "escalated"
                connection.execute("UPDATE tasks SET status=?,correction_failures=? WHERE id=?",
                                   (next_status, failures, task["id"]))
            else:
                next_status = "correction_ready"
                connection.execute(
                    "UPDATE tasks SET status=?,version=version+1,correction_failures=? WHERE id=?",
                    (next_status, failures, task["id"]))
            review_binding["correction_failures"] = failures
            review_binding["repair_policy"] = (
                "Initial rejection plus at most two rejected correction tickets; the second failed correction escalates.")
        event(connection, "qa_disposition", task["id"], review_binding)
        commit(connection)
        return {"task_id": task["id"], "reviewed_version": task["version"],
                "verdict": args.verdict, "status": next_status,
                "correction_failures": review_binding.get("correction_failures", task["correction_failures"])}
    except Exception:
        rollback(connection)
        raise
    finally:
        connection.close()


def command_risk_review(args):
    reviewer = identifier(args.reviewer_id, "reviewer_id")
    evidence_path = clean_path(args.evidence_path, "risk review evidence path")
    connection = connect(args.db)
    try:
        transaction(connection)
        checked_hash(connection, evidence_path, args.sha256)
        task = connection.execute("SELECT * FROM tasks WHERE id=?", (args.task_id,)).fetchone()
        require(task is not None and task["risk"] == "high", "Task is not a known high-risk task")
        require(reviewer != task["owner"], "High-risk reviewer must be independent of the task owner")
        connection.execute(
            "INSERT INTO risk_reviews(task_id,task_version,reviewer_id,decision,evidence_path,sha256) "
            "VALUES(?,?,?,?,?,?)",
            (task["id"], task["version"], reviewer, args.decision, evidence_path, args.sha256))
        event(connection, "high_risk_review_recorded", task["id"],
              {"task_version": task["version"], "reviewer_id": reviewer,
               "decision": args.decision, "evidence_path": evidence_path, "sha256": args.sha256,
               "limitation": "Permits or denies a local dispatch ticket only; it is not production authorization."})
        commit(connection)
        return {"task_id": task["id"], "task_version": task["version"],
                "decision": args.decision, "scope": "local_ticket_only"}
    except sqlite3.IntegrityError as exc:
        rollback(connection)
        raise WorkflowError("High-risk review already recorded for this task version") from exc
    except Exception:
        rollback(connection)
        raise
    finally:
        connection.close()


def descendants(connection, task_id):
    rows = connection.execute(
        "WITH RECURSIVE child(id) AS (SELECT task_id FROM dependencies WHERE dep_id=? "
        "UNION SELECT d.task_id FROM dependencies d JOIN child c ON d.dep_id=c.id) SELECT id FROM child ORDER BY id",
        (task_id,)).fetchall()
    return [row["id"] for row in rows]


def command_revise(args):
    reason = nonempty(args.reason, "revision reason")
    connection = connect(args.db)
    try:
        transaction(connection)
        task = connection.execute("SELECT * FROM tasks WHERE id=?", (args.task_id,)).fetchone()
        require(task is not None and task["status"] == "accepted", "Only an accepted task can be revised")
        child_ids = descendants(connection, task["id"])
        for child_id in child_ids:
            unresolved = connection.execute(
                "SELECT id,status FROM tickets WHERE task_id=? AND status IN ('reserved','started','uncertain') "
                "ORDER BY created_at LIMIT 1", (child_id,)).fetchone()
            require(unresolved is None,
                    f"Cannot revise while descendant {child_id} has unresolved "
                    f"{unresolved['status']} ticket {unresolved['id']}" if unresolved is not None else "")
        changed = []
        connection.execute("UPDATE tasks SET status='invalidated',version=version+1,correction_failures=0 WHERE id=?",
                           (task["id"],))
        changed.append(task["id"])
        for child_id in child_ids:
            connection.execute("UPDATE tasks SET status='invalidated',version=version+1,correction_failures=0 WHERE id=?",
                               (child_id,))
            changed.append(child_id)
        event(connection, "dependency_revision", task["id"],
              {"reason": reason, "revised_from_version": task["version"], "invalidated": changed})
        commit(connection)
        return {"task_id": task["id"], "new_version": task["version"] + 1,
                "invalidated": changed}
    except Exception:
        rollback(connection)
        raise
    finally:
        connection.close()


def command_mark_uncertain(args):
    reason = nonempty(args.reason, "uncertainty reason")
    connection = connect(args.db)
    try:
        transaction(connection)
        ticket = connection.execute("SELECT * FROM tickets WHERE id=?", (args.ticket_id,)).fetchone()
        require(ticket is not None and ticket["status"] == "started",
                "Only a started ticket can be marked uncertain")
        connection.execute("UPDATE tickets SET status='uncertain' WHERE id=?", (ticket["id"],))
        connection.execute("UPDATE tasks SET status='uncertain' WHERE id=?", (ticket["task_id"],))
        event(connection, "ticket_uncertain", ticket["task_id"],
              {"ticket_id": ticket["id"], "reason": reason,
               "limitation": "Reservation remains encumbered and work cannot be replayed automatically."})
        commit(connection)
        return {"ticket_id": ticket["id"], "status": "uncertain", "replayable": False}
    except Exception:
        rollback(connection)
        raise
    finally:
        connection.close()


def command_pause(args, paused):
    connection = connect(args.db)
    try:
        transaction(connection)
        current = meta(connection, "paused") == "1"
        require(current != paused, "Workflow already has requested pause state")
        connection.execute("UPDATE meta SET value=? WHERE key='paused'", ("1" if paused else "0",))
        event(connection, "workflow_paused" if paused else "workflow_resumed", None, {})
        commit(connection)
        return {"paused": paused}
    except Exception:
        rollback(connection)
        raise
    finally:
        connection.close()


def add_db(parser):
    parser.add_argument("--db", type=Path, required=True, help="SQLite workflow state file")


def build_parser():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    init = commands.add_parser("init", help="Validate a trusted local plan and create durable state")
    add_db(init)
    init.add_argument("--plan", type=Path, required=True)
    init.add_argument("--workspace", type=Path, required=True)
    for name, help_text in (("status", "Show durable state and conservative budget"),
                            ("ready", "Explain readiness without changing state"),
                            ("pause", "Pause new starts and dispatches"),
                            ("resume", "Resume new starts and dispatches")):
        sub = commands.add_parser(name, help=help_text)
        add_db(sub)
    dispatch = commands.add_parser("dispatch", help="Reserve one ready local ticket; executes nothing")
    add_db(dispatch)
    dispatch.add_argument("--worker-id", required=True)
    dispatch.add_argument("--task-id", help="Optional exact task; otherwise choose lexically first ready task")
    start = commands.add_parser("start", help="Consume a reserved ticket exactly once")
    add_db(start)
    start.add_argument("--ticket-id", required=True)
    complete = commands.add_parser("complete", help="Bind deterministic evidence to a started ticket")
    add_db(complete)
    complete.add_argument("--ticket-id", required=True)
    complete.add_argument("--evidence", type=Path, required=True)
    qa = commands.add_parser("qa", help="Independently accept or reject the exact current submission")
    add_db(qa)
    qa.add_argument("--task-id", required=True)
    qa.add_argument("--reviewer-id", required=True)
    qa.add_argument("--verdict", choices=("accept", "reject"), required=True)
    qa.add_argument("--reason", required=True)
    qa.add_argument("--evidence-path", required=True, help="Repository-relative review evidence")
    qa.add_argument("--sha256", required=True)
    risk = commands.add_parser(
        "risk-review", help="Record an external review decision for local high-risk ticket readiness only")
    add_db(risk)
    risk.add_argument("--task-id", required=True)
    risk.add_argument("--reviewer-id", required=True)
    risk.add_argument("--decision", choices=("allow_ticket", "deny_ticket"), required=True)
    risk.add_argument("--evidence-path", required=True)
    risk.add_argument("--sha256", required=True)
    revise = commands.add_parser("revise", help="Revise accepted work and invalidate descendants")
    add_db(revise)
    revise.add_argument("--task-id", required=True)
    revise.add_argument("--reason", required=True)
    uncertain = commands.add_parser("mark-uncertain", help="Durably stop automatic replay of started work")
    add_db(uncertain)
    uncertain.add_argument("--ticket-id", required=True)
    uncertain.add_argument("--reason", required=True)
    return parser


def main(argv=None):
    args = build_parser().parse_args(argv)
    handlers = {
        "init": command_init, "status": command_status, "ready": command_ready,
        "dispatch": command_dispatch, "start": command_start, "complete": command_complete,
        "qa": command_qa, "risk-review": command_risk_review, "revise": command_revise,
        "mark-uncertain": command_mark_uncertain,
        "pause": lambda value: command_pause(value, True),
        "resume": lambda value: command_pause(value, False),
    }
    try:
        print(json.dumps(handlers[args.command](args), indent=2, ensure_ascii=False))
        return 0
    except (WorkflowError, sqlite3.Error, OSError, ValueError, TypeError, KeyError) as exc:
        print(json.dumps({"valid": False, "error": str(exc)}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
