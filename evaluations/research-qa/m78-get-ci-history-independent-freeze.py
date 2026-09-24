"""Freeze the reviewed CI-history repair and its before/frozen references."""
from __future__ import annotations

import hashlib
import json
import subprocess
import sys
from pathlib import Path

BASE = "7f7a30634d655f2763d5ababf8e9df00a8841df0"
ARCHIVE = Path("evaluations/research-qa/m78-get-ci-history-independent-source.json")
SNAPSHOT = Path("operations/agent-improvement/snapshots/M78-GET-CI-HISTORY-REVIEW-01-CANDIDATE2.json")


def sha(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def file_entry(label: str, path: str) -> dict[str, str]:
    value = Path(path).read_bytes()
    return {"label": label, "path": path, "sha256": sha(value), "text": value.decode("utf-8")}


def git_entry(label: str, path: str) -> dict[str, str]:
    value = subprocess.check_output(["git", "show", f"{BASE}:{path}"])
    return {"label": label, "path": path, "sha256": sha(value), "text": value.decode("utf-8")}


def legacy_entry(label: str, path: str) -> dict[str, str]:
    value = (Path(".superpowers/m78-get-ci-history") / path).read_bytes()
    return {"label": label, "path": path, "sha256": sha(value), "text": value.decode("utf-8")}


def archive() -> None:
    value = {
        "taskId": "M78-GET-CI-HISTORY-REVIEW-01",
        "status": "ci_history_candidate2_source_frozen",
        "baseCommit": BASE,
        "frozenRef": "1042348f2d4849246771fee4be77fe590c34ab8a",
        "files": [
            git_entry("workflow_before", ".github/workflows/verify.yml"),
            file_entry("workflow_candidate2", ".github/workflows/verify.yml"),
            file_entry("historical_gate_candidate2", "evaluations/research-qa/m78-get-historical-gates.test.ts"),
            git_entry("guard_test_first_review", "evaluations/research-qa/m78-get-guard-independent.test.ts"),
            file_entry("guard_test_candidate2", "evaluations/research-qa/m78-get-guard-independent.test.ts"),
            legacy_entry("frozen_inventory", "evaluations/research-qa/m78-continuation4-preparation-source-pins.json"),
            legacy_entry("frozen_route", "apps/site-api/src/workspace/m78-routes.ts"),
            file_entry("current_route", "apps/site-api/src/workspace/m78-routes.ts"),
        ],
    }
    with ARCHIVE.open("x", encoding="utf-8", newline="\n") as output:
        json.dump(value, output, indent=2)
        output.write("\n")


def snapshot() -> None:
    paths = [
        "evaluations/research-qa/m78-get-ci-history-independent-source.json",
        "evaluations/research-qa/m78-get-ci-history-independent-failure.json",
        "evaluations/research-qa/m78-get-ci-history-independent-review.ts",
        "evaluations/research-qa/m78-get-ci-history-independent.test.ts",
        "evaluations/research-qa/m78-get-ci-history-independent-tree.py",
        "evaluations/research-qa/m78-get-ci-history-independent-review.md",
        "evaluations/research-qa/m78-get-ci-history-independent-result.json",
        "evaluations/research-qa/m78-get-ci-history-independent-freeze.py",
    ]
    files = []
    for path in paths:
        value = Path(path).read_bytes()
        files.append({"path": path, "sha256": sha(value), "text": value.decode("utf-8")})
    value = {"task_id": "M78-GET-CI-HISTORY-REVIEW-01", "status": "candidate2_ci_history_review_passed", "candidate": 2, "files": files}
    with SNAPSHOT.open("x", encoding="utf-8", newline="\n") as output:
        json.dump(value, output, indent=2)
        output.write("\n")


if __name__ == "__main__":
    if sys.argv[1:] == ["archive"]:
        archive()
    elif sys.argv[1:] == ["snapshot"]:
        snapshot()
    else:
        raise SystemExit("usage: freeze.py archive|snapshot")
