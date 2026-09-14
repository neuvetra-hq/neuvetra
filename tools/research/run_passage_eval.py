"""Explicit, bounded evaluation of the opt-in local passage research engine.

Mechanical checks do not establish semantic support or completeness. Independent
review of the saved answers against the original evidence is a separate gate.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import subprocess
import time
import urllib.request
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[2]
ANSWER_STATES = {"supported", "qualified"}
CONTEXT = {"location", "reporting_period", "electricity_supply"}


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def request(base: str, endpoint: str, body: dict | None = None) -> dict:
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(base + endpoint, data=data, headers={
        "Content-Type": "application/json", "Origin": "http://localhost:5174",
    })
    with urllib.request.urlopen(req, timeout=160) as response:
        result = json.load(response)
    if not isinstance(result, dict):
        raise ValueError("Unexpected response shape")
    return result


def context_closure(ids: set[str], passages: dict) -> set[str]:
    result = set(ids)
    pending = list(ids)
    while pending:
        for dependency in passages[pending.pop()]["required_passage_ids"]:
            if dependency not in result:
                result.add(dependency)
                pending.append(dependency)
    return result


def check_response(case: dict, response: dict, release: dict, pin: str, calls: int | None) -> list[str]:
    issues: list[str] = []
    status = response.get("status")
    if status not in case["expected_statuses"]:
        issues.append("unexpected_status")
    if response.get("answer_mode") != "passage_grounded":
        issues.append("unexpected_answer_mode")
    if not isinstance(response.get("reason_code"), str):
        issues.append("missing_diagnostic_code")
    claims, evidence, sources = (response.get(key, []) for key in ("claims", "evidence", "sources"))
    missing = response.get("missing_context", [])
    if not isinstance(missing, list) or not set(missing).issubset(CONTEXT) or len(set(missing)) != len(missing):
        issues.append("invalid_context")
    if (status == "needs_input") != bool(missing):
        issues.append("inconsistent_context_state")
    if status not in ANSWER_STATES:
        if claims or evidence or sources:
            issues.append("withheld_response_contains_facts")
        return issues
    if calls != 3 or response.get("provider", {}).get("mode") != "live":
        issues.append("answer_without_three_live_stages")
    if response.get("release", {}).get("sha256") != pin:
        issues.append("release_pin_mismatch")
    if not claims or not evidence or not sources:
        issues.append("empty_answer_or_references")
        return issues
    approved = set(release["review"]["approved_passage_ids"])
    passages = {p["id"]: p for p in release["passages"] if p["id"] in approved}
    expected_sources = {s["id"]: s for s in release["sources"]}
    for items in (claims, evidence, sources):
        if len({item.get("id") for item in items}) != len(items):
            issues.append("duplicate_identifier")
    used: set[str] = set()
    for claim in claims:
        ids = claim.get("evidence_ids", [])
        if not isinstance(claim.get("text"), str) or not claim["text"].strip() or not ids or len(set(ids)) != len(ids):
            issues.append("invalid_claim")
        if not set(ids).issubset(passages):
            issues.append("unapproved_citation")
            continue
        used.update(ids)
        closure = context_closure(set(ids), passages)
        if closure != set(ids):
            issues.append("missing_required_context_citation")
        required = {q for pid in closure for q in passages[pid]["qualifications"]}
        if not required.issubset(claim.get("qualifications", [])):
            issues.append("missing_reviewed_qualification")
    if used != {item.get("id") for item in evidence}:
        issues.append("unresolved_or_unused_evidence")
    for item in evidence:
        original = passages.get(item.get("id"))
        if original is None or item.get("source_id") != original["source_id"] or item.get("locator") != original["locator"] or item.get("excerpt") != original["text"]:
            issues.append("changed_or_unapproved_evidence")
    if {item.get("source_id") for item in evidence} != {item.get("id") for item in sources}:
        issues.append("unresolved_or_unused_source")
    for item in sources:
        original = expected_sources.get(item.get("id"))
        if original is None or any(item.get(key) != original[key] for key in ("title", "version", "status", "canonical_url")):
            issues.append("changed_source_metadata")
    if (status == "qualified") != any(claim.get("qualifications") for claim in claims):
        issues.append("inconsistent_qualification_state")
    return issues


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-live", action="store_true", required=True)
    parser.add_argument("--base-url", default="http://127.0.0.1:3012")
    parser.add_argument("--fixtures", type=Path, default=ROOT / "evaluations/research-qa/scope2-passages-live-fixtures.json")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    url = urlparse(args.base_url)
    if url.scheme != "http" or url.hostname not in ("localhost", "127.0.0.1") or url.username or url.password or url.path or url.query or url.fragment:
        parser.error("Use the isolated loopback service")
    if args.output.exists():
        parser.error("Earlier evaluation records must be preserved; choose a new filename")
    fixture = json.loads(args.fixtures.read_bytes())
    release_path = ROOT / fixture["release"]["path"]
    pin = digest(release_path)
    if pin != fixture["release"]["sha256"]:
        parser.error("Fixture and release hashes differ")
    release = json.loads(release_path.read_bytes())
    retained_artifacts = [
        {"kind": kind, "id": item["id"], "path": item["local_path"], "sha256": digest(Path(item["local_path"]))}
        for kind, items in (("source", release["sources"]), ("extraction", release["extractions"]))
        for item in items
    ]
    for retained in retained_artifacts:
        items = release["sources"] if retained["kind"] == "source" else release["extractions"]
        expected = next(item["sha256"] for item in items if item["id"] == retained["id"])
        if retained["sha256"] != expected:
            parser.error("Retained source or extraction does not match the reviewed release")
    cases = [case for case in fixture["cases"] if case.get("live_eligible")]
    if not 1 <= len(cases) <= 8:
        parser.error("Expected one to eight independently selected cases")
    before = request(args.base_url, "/research/status")
    if before.get("readiness") != "ready" or before.get("provider", {}).get("mode") != "live" or before.get("release", {}).get("sha256") != pin:
        parser.error("The approved live passage service is not ready")
    if before["limits"]["remaining_calls"] < len(cases) * 3:
        parser.error("Insufficient remaining allowance for the full selected batch")
    code_paths = sorted((ROOT / "apps/site-api/src/research-passages").glob("*.ts")) + [
        ROOT / "apps/site-api/src/research-passages-server.ts",
        ROOT / "apps/site-api/package.json",
        ROOT / "package.json",
        ROOT / "apps/site-web/src/lib/research-api.ts",
        ROOT / "apps/site-web/src/components/ResearchAnswerPanel.tsx",
        Path(__file__).resolve(),
    ]
    code_hashes = {str(path.relative_to(ROOT)).replace("\\", "/"): digest(path) for path in code_paths}
    artifact = {
        "schema_version": 1,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "git_base_commit": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
        "code_sha256": code_hashes,
        "release_sha256": pin, "fixture_sha256": digest(args.fixtures),
        "release_path": str(release_path), "fixture_path": str(args.fixtures.resolve()),
        "retained_artifacts": retained_artifacts,
        "scope": f"{len(cases)} live question cases for the opt-in passage experiment",
        "before": before, "cases": [], "semantic_review": "pending_independent_review",
        "notes": ["Mechanical checks do not establish entailment, completeness or general model accuracy.", "The independent reviewer must assess required_facets and forbidden_claim_kinds from the frozen fixture.", "Service reservations are not measured provider billing.", "No credentials or customer data are included."],
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)

    def save() -> None:
        args.output.write_bytes((json.dumps(artifact, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))

    save()
    for case in cases:
        case_before = request(args.base_url, "/research/status")
        started = time.monotonic()
        response: dict = {}
        calls = None
        try:
            response = request(args.base_url, "/research/answer", {"question": case["prompt"]})
            after = request(args.base_url, "/research/status")
            calls = case_before["limits"]["remaining_calls"] - after["limits"]["remaining_calls"]
            issues = check_response(case, response, release, pin, calls)
        except Exception as error:
            response = {"status": "request_failed", "error_type": type(error).__name__}
            issues = ["request_or_validation_failed"]
        row = {
            "id": case["id"], "question": case["prompt"],
            "duration_ms": round((time.monotonic() - started) * 1000),
            "stage_calls": calls, "mechanical_checks_passed": not issues,
            "issues": issues, "response": response,
        }
        artifact["cases"].append(row)
        save()
        print(json.dumps({key: row[key] for key in ("id", "stage_calls", "mechanical_checks_passed", "issues")}), flush=True)
    artifact["after"] = request(args.base_url, "/research/status")
    artifact["finished_at"] = datetime.now(timezone.utc).isoformat()
    artifact["artifacts_unchanged"] = (
        digest(release_path) == pin
        and digest(args.fixtures) == artifact["fixture_sha256"]
        and all(digest(ROOT / path) == sha for path, sha in code_hashes.items())
        and all(digest(Path(item["path"])) == item["sha256"] for item in retained_artifacts)
    )
    artifact["mechanical_checks_passed"] = artifact["artifacts_unchanged"] and all(row["mechanical_checks_passed"] for row in artifact["cases"])
    save()
    return 0 if artifact["mechanical_checks_passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
