"""Freeze reviewed helper sources and QA artifacts. It never imports or executes them."""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path


SOURCE_ARCHIVE = Path("evaluations/research-qa/m78-get-deployment-helper-source.json")
SNAPSHOT = Path("operations/agent-improvement/snapshots/M78-GET-DEPLOYMENT-HELPER-REVIEW-01-CANDIDATE1.json")
SOURCE_PATHS = [
    ".superpowers/m78-get-route-deploy-once-candidate1.py",
    ".superpowers/m78-get-route-deploy-once.py",
    ".superpowers/m78-get-route-observe-deployment-candidate1.py",
    ".superpowers/m78-get-route-observe-deployment.py",
]


def sha(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def entry(path: str) -> dict[str, str]:
    value = Path(path).read_bytes()
    return {"path": path, "sha256": sha(value), "text": value.decode("utf-8")}


def archive() -> None:
    value = {
        "taskId": "M78-GET-DEPLOYMENT-HELPER-REVIEW-01",
        "status": "deployment_helper_source_frozen_for_offline_review",
        "files": [entry(path) for path in SOURCE_PATHS],
    }
    with SOURCE_ARCHIVE.open("x", encoding="utf-8", newline="\n") as output:
        json.dump(value, output, indent=2)
        output.write("\n")


def snapshot() -> None:
    paths = [
        "evaluations/research-qa/m78-get-deployment-helper-source.json",
        "evaluations/research-qa/m78-get-deployment-helper-review.py",
        "evaluations/research-qa/m78-get-deployment-helper-independent.test.py",
        "evaluations/research-qa/m78-get-deployment-helper-review.md",
        "evaluations/research-qa/m78-get-deployment-helper-result.json",
        "evaluations/research-qa/m78-get-deployment-helper-freeze.py",
    ]
    value = {
        "task_id": "M78-GET-DEPLOYMENT-HELPER-REVIEW-01",
        "status": "deployment_and_observer_source_review_passed",
        "candidate": 1,
        "files": [entry(path) for path in paths],
    }
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
