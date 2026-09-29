from __future__ import annotations

import contextlib
from copy import deepcopy
import hashlib
import io
import json
from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).parent))
import agent_workflow


class AgentWorkflowTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        (self.root / "outputs").mkdir()
        (self.root / "reviews").mkdir()
        self.plan_path = self.root / "plan.json"
        self.db = self.root / "workflow.sqlite"
        self.plan = {
            "schema_version": 1,
            "workflow_id": "WF1",
            "max_workers": 3,
            "budget_usd": "1.00",
            "supported_evidence_roots": ["outputs", "reviews"],
            "tasks": [self.task("A")],
        }

    def tearDown(self):
        self.temporary.cleanup()

    def task(self, task_id, dependencies=None, risk="low", reservation="0",
             allowed_path=None):
        artifact = allowed_path or f"outputs/{task_id}.txt"
        return {
            "id": task_id,
            "owner": f"owner-{task_id}",
            "risk": risk,
            "dependencies": dependencies or [],
            "allowed_paths": [artifact],
            "reservation_usd": reservation,
            "criteria": [{
                "id": "C1",
                "description": f"Deterministic evidence for {task_id}",
                "evidence_paths": [artifact],
            }],
        }

    def invoke(self, *args):
        stdout, stderr = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
            code = agent_workflow.main(list(args))
        text = stdout.getvalue() if code == 0 else stderr.getvalue()
        return code, json.loads(text)

    def initialize(self):
        self.plan_path.write_text(json.dumps(self.plan), encoding="utf-8")
        code, result = self.invoke("init", "--db", str(self.db), "--plan", str(self.plan_path),
                                   "--workspace", str(self.root))
        self.assertEqual(code, 0, result)
        return result

    def sha(self, relative):
        return hashlib.sha256((self.root / relative).read_bytes()).hexdigest()

    def dispatch_start(self, task_id, worker="worker"):
        code, dispatched = self.invoke("dispatch", "--db", str(self.db),
                                       "--worker-id", worker, "--task-id", task_id)
        self.assertEqual(code, 0, dispatched)
        code, started = self.invoke("start", "--db", str(self.db),
                                    "--ticket-id", dispatched["ticket_id"])
        self.assertEqual(code, 0, started)
        return dispatched

    def complete(self, ticket, task_id, content=None, actual="0"):
        relative = f"outputs/{task_id}.txt"
        (self.root / relative).write_text(content or f"artifact-{task_id}-{ticket['task_version']}",
                                          encoding="utf-8")
        artifact = {"path": relative, "sha256": self.sha(relative)}
        evidence = {
            "artifacts": [artifact],
            "criteria": {"C1": [artifact]},
            "dependency_versions": ticket["dependency_versions"],
            "actual_cost_usd": actual,
        }
        evidence_path = self.root / f"completion-{ticket['ticket_id']}.json"
        evidence_path.write_text(json.dumps(evidence), encoding="utf-8")
        code, result = self.invoke("complete", "--db", str(self.db),
                                   "--ticket-id", ticket["ticket_id"],
                                   "--evidence", str(evidence_path))
        self.assertEqual(code, 0, result)
        return artifact

    def qa(self, task_id, verdict="accept", reason="reviewed exact evidence"):
        review = self.root / "reviews" / f"{task_id}-{verdict}.txt"
        review.write_text(f"{task_id}:{verdict}:{reason}", encoding="utf-8")
        return self.invoke("qa", "--db", str(self.db), "--task-id", task_id,
                           "--reviewer-id", "independent-qa", "--verdict", verdict,
                           "--reason", reason, "--evidence-path", review.relative_to(self.root).as_posix(),
                           "--sha256", self.sha(review.relative_to(self.root).as_posix()))

    def deliver(self, task_id, verdict="accept", actual="0", content=None):
        ticket = self.dispatch_start(task_id)
        self.complete(ticket, task_id, content=content, actual=actual)
        code, result = self.qa(task_id, verdict)
        self.assertEqual(code, 0, result)
        return ticket, result

    def test_plan_rejects_cycle_and_independent_owned_path_overlap(self):
        self.plan["tasks"] = [self.task("A", ["B"]), self.task("B", ["A"])]
        self.plan_path.write_text(json.dumps(self.plan), encoding="utf-8")
        code, result = self.invoke("init", "--db", str(self.db), "--plan", str(self.plan_path),
                                   "--workspace", str(self.root))
        self.assertEqual(code, 1)
        self.assertIn("cycle", result["error"])
        self.assertFalse(self.db.exists())

        self.plan["tasks"] = [self.task("A", allowed_path="outputs/shared"),
                              self.task("B", allowed_path="outputs/shared/file.txt")]
        self.plan_path.write_text(json.dumps(self.plan), encoding="utf-8")
        code, result = self.invoke("init", "--db", str(self.db), "--plan", str(self.plan_path),
                                   "--workspace", str(self.root))
        self.assertEqual(code, 1)
        self.assertIn("overlapping owned paths", result["error"])

    def test_path_scope_and_duplicate_json_keys_fail_closed(self):
        self.plan["tasks"][0]["criteria"][0]["evidence_paths"] = ["reviews/outside.txt"]
        self.plan_path.write_text(json.dumps(self.plan), encoding="utf-8")
        code, result = self.invoke("init", "--db", str(self.db), "--plan", str(self.plan_path),
                                   "--workspace", str(self.root))
        self.assertEqual(code, 1)
        self.assertIn("outside task ownership", result["error"])

        self.plan_path.write_text('{"schema_version":1,"schema_version":1}', encoding="utf-8")
        code, result = self.invoke("init", "--db", str(self.db), "--plan", str(self.plan_path),
                                   "--workspace", str(self.root))
        self.assertEqual(code, 1)
        self.assertIn("Duplicate JSON key", result["error"])

    def test_ticket_start_survives_restart_and_cannot_replay(self):
        self.initialize()
        ticket = self.dispatch_start("A")
        code, result = self.invoke("start", "--db", str(self.db), "--ticket-id", ticket["ticket_id"])
        self.assertEqual(code, 1)
        self.assertIn("replayed", result["error"])
        code, status = self.invoke("status", "--db", str(self.db))
        self.assertEqual(code, 0)
        self.assertEqual(status["tasks"][0]["status"], "started")
        code, result = self.invoke("dispatch", "--db", str(self.db), "--worker-id", "other")
        self.assertEqual(code, 1)
        self.assertIn("No task is ready", result["error"])

    def test_artifact_drift_blocks_qa_and_exact_restore_allows_acceptance(self):
        self.initialize()
        ticket = self.dispatch_start("A")
        artifact = self.complete(ticket, "A", content="reviewed bytes")
        (self.root / artifact["path"]).write_text("drifted bytes", encoding="utf-8")
        code, result = self.qa("A")
        self.assertEqual(code, 1)
        self.assertIn("digest mismatch", result["error"])
        (self.root / artifact["path"]).write_text("reviewed bytes", encoding="utf-8")
        code, result = self.qa("A")
        self.assertEqual(code, 0, result)
        self.assertEqual(result["status"], "accepted")

    def test_concurrency_budget_and_unknown_reservations_fail_conservatively(self):
        self.plan["budget_usd"] = "0.20"
        self.plan["tasks"] = [self.task("A", reservation="0.10"),
                              self.task("B", reservation="0.10"),
                              self.task("C", reservation="0.01"),
                              self.task("D", reservation=None)]
        self.initialize()
        for task_id in ("A", "B"):
            code, result = self.invoke("dispatch", "--db", str(self.db),
                                       "--worker-id", f"worker-{task_id}", "--task-id", task_id)
            self.assertEqual(code, 0, result)
        code, ready = self.invoke("ready", "--db", str(self.db))
        by_id = {item["task_id"]: item for item in ready["tasks"]}
        self.assertIn("budget_ceiling", by_id["C"]["blockers"])
        self.assertIn("unknown_cost_reservation", by_id["D"]["blockers"])
        code, result = self.invoke("dispatch", "--db", str(self.db),
                                   "--worker-id", "worker-C", "--task-id", "C")
        self.assertEqual(code, 1)
        self.assertIn("budget_ceiling", result["error"])

    def test_unknown_actual_cost_retains_reservation_without_false_savings(self):
        self.plan["budget_usd"] = "0.10"
        self.plan["tasks"] = [self.task("A", reservation="0.10"),
                              self.task("B", reservation="0.01")]
        self.initialize()
        ticket = self.dispatch_start("A")
        self.complete(ticket, "A", actual=None)
        code, accepted = self.qa("A")
        self.assertEqual(code, 0, accepted)
        code, status = self.invoke("status", "--db", str(self.db))
        self.assertEqual(status["budget"]["encumbered_or_spent_usd"], "0.10")
        self.assertEqual(status["budget"]["available_usd"], "0.00")
        code, ready = self.invoke("ready", "--db", str(self.db))
        by_id = {item["task_id"]: item for item in ready["tasks"]}
        self.assertIn("budget_ceiling", by_id["B"]["blockers"])

    def test_initial_rejection_plus_two_failed_corrections_escalates(self):
        self.initialize()
        _, first = self.deliver("A", verdict="reject", content="initial")
        self.assertEqual(first["status"], "correction_ready")
        self.assertEqual(first["correction_failures"], 0)
        _, correction_one = self.deliver("A", verdict="reject", content="correction one")
        self.assertEqual(correction_one["status"], "correction_ready")
        self.assertEqual(correction_one["correction_failures"], 1)
        _, correction_two = self.deliver("A", verdict="reject", content="correction two")
        self.assertEqual(correction_two["status"], "escalated")
        self.assertEqual(correction_two["correction_failures"], 2)
        code, result = self.invoke("dispatch", "--db", str(self.db), "--worker-id", "worker")
        self.assertEqual(code, 1)
        self.assertIn("No task is ready", result["error"])

    def test_dependency_revision_invalidates_descendants_but_keeps_sibling(self):
        self.plan["tasks"] = [self.task("A"), self.task("B", ["A"]),
                              self.task("C", ["B"]), self.task("S")]
        self.initialize()
        for task_id in ("A", "B", "C", "S"):
            self.deliver(task_id)
        code, result = self.invoke("revise", "--db", str(self.db), "--task-id", "A",
                                   "--reason", "new exact dependency bytes")
        self.assertEqual(code, 0, result)
        self.assertEqual(result["invalidated"], ["A", "B", "C"])
        code, status = self.invoke("status", "--db", str(self.db))
        by_id = {task["id"]: task for task in status["tasks"]}
        self.assertEqual((by_id["A"]["status"], by_id["B"]["status"], by_id["C"]["status"]),
                         ("invalidated", "invalidated", "invalidated"))
        self.assertEqual(by_id["S"]["status"], "accepted")
        self.assertEqual(by_id["S"]["version"], 1)
        code, ready = self.invoke("ready", "--db", str(self.db))
        ready_by_id = {task["task_id"]: task for task in ready["tasks"]}
        self.assertTrue(ready_by_id["A"]["ready"])
        self.assertIn("dependency:A:invalidated", ready_by_id["B"]["blockers"])

    def test_upstream_artifact_or_review_drift_blocks_downstream_dispatch(self):
        self.plan["tasks"] = [self.task("A"), self.task("B", ["A"])]
        self.initialize()
        self.deliver("A")
        (self.root / "outputs" / "A.txt").write_text("silent drift", encoding="utf-8")
        code, ready = self.invoke("ready", "--db", str(self.db))
        by_id = {task["task_id"]: task for task in ready["tasks"]}
        self.assertIn("dependency:A:stale_evidence", by_id["B"]["blockers"])
        code, result = self.invoke("dispatch", "--db", str(self.db),
                                   "--worker-id", "worker-B", "--task-id", "B")
        self.assertEqual(code, 1)
        self.assertIn("stale_evidence", result["error"])

    def test_dependency_drift_after_dispatch_blocks_start_and_preserves_reservation(self):
        self.plan["tasks"] = [self.task("A"), self.task("B", ["A"])]
        self.initialize()
        self.deliver("A")
        code, ticket = self.invoke("dispatch", "--db", str(self.db),
                                   "--worker-id", "worker-B", "--task-id", "B")
        self.assertEqual(code, 0, ticket)
        (self.root / "outputs" / "A.txt").write_text("drift after reservation", encoding="utf-8")
        code, result = self.invoke("start", "--db", str(self.db), "--ticket-id", ticket["ticket_id"])
        self.assertEqual(code, 1)
        self.assertIn("digest mismatch", result["error"])
        code, status = self.invoke("status", "--db", str(self.db))
        by_id = {task["id"]: task for task in status["tasks"]}
        self.assertEqual(by_id["B"]["status"], "reserved")
        self.assertEqual(status["active_tickets"], 1)

    def test_revision_refuses_unresolved_uncertain_descendant_without_replay(self):
        self.plan["tasks"] = [self.task("A"), self.task("B", ["A"])]
        self.initialize()
        self.deliver("A")
        ticket = self.dispatch_start("B")
        code, result = self.invoke("mark-uncertain", "--db", str(self.db),
                                   "--ticket-id", ticket["ticket_id"], "--reason", "lost worker")
        self.assertEqual(code, 0, result)
        code, result = self.invoke("revise", "--db", str(self.db), "--task-id", "A",
                                   "--reason", "new bytes")
        self.assertEqual(code, 1)
        self.assertIn("unresolved uncertain ticket", result["error"])
        code, status = self.invoke("status", "--db", str(self.db))
        by_id = {task["id"]: task for task in status["tasks"]}
        self.assertEqual(by_id["A"]["status"], "accepted")
        self.assertEqual(by_id["B"]["status"], "uncertain")
        self.assertEqual(status["active_tickets"], 1)

    def test_high_risk_requires_independent_external_review_record_for_local_ticket(self):
        self.plan["tasks"] = [self.task("A", risk="high")]
        self.initialize()
        code, ready = self.invoke("ready", "--db", str(self.db))
        self.assertIn("external_high_risk_review_required", ready["tasks"][0]["blockers"])
        review = self.root / "reviews" / "risk.txt"
        review.write_text("external reviewer allows local ticket only", encoding="utf-8")
        code, result = self.invoke("risk-review", "--db", str(self.db), "--task-id", "A",
                                   "--reviewer-id", "external-reviewer", "--decision", "allow_ticket",
                                   "--evidence-path", "reviews/risk.txt", "--sha256", self.sha("reviews/risk.txt"))
        self.assertEqual(code, 0, result)
        self.assertEqual(result["scope"], "local_ticket_only")
        code, reserved = self.invoke("dispatch", "--db", str(self.db),
                                     "--worker-id", "worker", "--task-id", "A")
        self.assertEqual(code, 0, reserved)
        review.write_text("silently changed authorization bytes", encoding="utf-8")
        code, ready = self.invoke("ready", "--db", str(self.db))
        self.assertIn("state:reserved", ready["tasks"][0]["blockers"])
        self.assertIn("external_high_risk_review_stale", ready["tasks"][0]["blockers"])
        code, result = self.invoke("start", "--db", str(self.db), "--ticket-id", reserved["ticket_id"])
        self.assertEqual(code, 1)
        self.assertIn("digest mismatch", result["error"])
        review.write_text("external reviewer allows local ticket only", encoding="utf-8")
        code, started = self.invoke("start", "--db", str(self.db), "--ticket-id", reserved["ticket_id"])
        self.assertEqual(code, 0, started)
        self.assertFalse(started["executed"])

    def test_pause_resume_uncertain_and_append_only_event_guards(self):
        self.initialize()
        code, _ = self.invoke("pause", "--db", str(self.db))
        self.assertEqual(code, 0)
        code, result = self.invoke("dispatch", "--db", str(self.db), "--worker-id", "worker")
        self.assertEqual(code, 1)
        self.assertIn("paused", result["error"])
        code, _ = self.invoke("resume", "--db", str(self.db))
        self.assertEqual(code, 0)
        ticket = self.dispatch_start("A")
        code, result = self.invoke("mark-uncertain", "--db", str(self.db),
                                   "--ticket-id", ticket["ticket_id"], "--reason", "worker outcome unknown")
        self.assertEqual(code, 0, result)
        self.assertFalse(result["replayable"])
        code, result = self.invoke("start", "--db", str(self.db), "--ticket-id", ticket["ticket_id"])
        self.assertEqual(code, 1)
        connection = sqlite3.connect(self.db)
        try:
            with self.assertRaises(sqlite3.IntegrityError):
                connection.execute("DELETE FROM events")
        finally:
            connection.close()


if __name__ == "__main__":
    unittest.main()
