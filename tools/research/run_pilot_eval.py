"""Explicit, bounded live acceptance run for the private Scope 2 pilot.

Uses only public-source/synthetic questions from the independently reviewed
fixture set. Never called by CI or imported as an automatic test.
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


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def request(base: str, endpoint: str, body: dict | None = None) -> dict:
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(base + endpoint, data=data, headers={
        "Content-Type": "application/json", "Origin": "http://localhost:5174",
    })
    with urllib.request.urlopen(req, timeout=55) as response:
        result = json.load(response)
    if not isinstance(result, dict):
        raise ValueError("Invalid response shape")
    return result


def verify_result(case: dict, response: dict, release: dict, pin: str, calls: int) -> list[str]:
    issues = []
    if response.get("status") not in case["expected_statuses"]:
        issues.append("unexpected_status")
    if case.get("expected_provider_calls") is not None and calls != case["expected_provider_calls"]:
        issues.append("unexpected_provider_call_count")
    if not set(case.get("required_missing_context", [])).issubset(response.get("missing_context", [])):
        issues.append("missing_required_context_request")
    claims, evidence, sources = (response.get(key, []) for key in ("claims", "evidence", "sources"))
    if response.get("status") not in ("supported", "qualified"):
        if claims or evidence or sources:
            issues.append("nonanswer_contains_facts")
        return issues
    if calls != 1 or response.get("provider", {}).get("mode") != "live":
        issues.append("supported_answer_without_one_live_call")
    if response.get("release", {}).get("sha256") != pin:
        issues.append("wrong_release_pin")
    if not claims or response.get("missing_context"):
        issues.append("invalid_supported_state")
    expected = {p["id"]: p for p in release["propositions"] if p["id"] in release["review"]["approved_proposition_ids"]}
    if not set(case.get("required_proposition_ids", [])).issubset(c.get("id") for c in claims):
        issues.append("missing_required_proposition")
    if len({c.get("id") for c in claims}) != len(claims):
        issues.append("duplicate_claim")
    for claim in claims:
        original = expected.get(claim.get("id"))
        if original is None or any(claim.get(key) != original[key] for key in ("text", "qualifications", "evidence_ids")):
            issues.append("unreviewed_or_changed_claim")
    expected_evidence = {e["id"]: e for e in release["evidence"] if e["id"] in release["review"]["approved_evidence_ids"]}
    used_ids = {eid for c in claims for eid in c.get("evidence_ids", [])}
    if used_ids != {e.get("id") for e in evidence} or len(used_ids) != len(evidence):
        issues.append("unresolved_evidence")
    for item in evidence:
        original = expected_evidence.get(item.get("id"))
        if original is None or any(item.get(key) != original[key] for key in ("source_id", "locator", "excerpt")):
            issues.append("changed_evidence")
    expected_sources = {s["id"]: s for s in release["sources"] if s["id"] in release["review"]["approved_source_ids"]}
    used_sources = {e.get("source_id") for e in evidence}
    if used_sources != {s.get("id") for s in sources} or len(used_sources) != len(sources):
        issues.append("unresolved_source")
    for source in sources:
        original = expected_sources.get(source.get("id"))
        if original is None or any(source.get(key) != original[key] for key in ("title", "version", "status", "canonical_url")):
            issues.append("changed_source")
    return issues


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-live", action="store_true", required=True, help="Explicitly allow this run to use the already configured, budgeted local model service")
    parser.add_argument("--base-url", default="http://127.0.0.1:3012")
    parser.add_argument("--fixtures", type=Path, default=ROOT / "evaluations/research-qa/scope2-pilot-feedback-fixtures.json")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    url = urlparse(args.base_url)
    if url.scheme != "http" or url.hostname not in ("localhost", "127.0.0.1") or url.username or url.password or url.path or url.query or url.fragment:
        parser.error("Use the isolated loopback research service")
    if args.output.exists():
        parser.error("Choose a new output filename; earlier evaluation runs are preserved")
    fixtures = json.loads(args.fixtures.read_text(encoding="utf-8"))
    release_path = ROOT / fixtures["release"]["path"]
    pin = digest(release_path)
    if pin != fixtures["release"]["sha256"]:
        parser.error("Fixture and release hashes differ")
    release = json.loads(release_path.read_text(encoding="utf-8"))
    cases = [c for c in fixtures["cases"] if c.get("live_eligible")]
    if not cases or len(cases) > 20:
        parser.error("Invalid bounded case count")
    before = request(args.base_url, "/research/status")
    if before.get("readiness") != "ready" or before.get("provider", {}).get("mode") != "live" or before.get("release", {}).get("sha256") != pin:
        parser.error("Live service is unavailable or has a different approved release")
    model_cases = sum(c.get("expected_provider_calls") != 0 for c in cases)
    if before["limits"]["remaining_calls"] < model_cases:
        parser.error("Insufficient remaining demo calls")
    code_paths = sorted((ROOT / "apps/site-api/src/research").glob("*.ts")) + [ROOT / "apps/site-api/src/research-server.ts", Path(__file__).resolve()]
    code_hashes = {str(p.relative_to(ROOT)).replace("\\", "/"): digest(p) for p in code_paths}
    artifact = {
        "schema_version": 1, "started_at": datetime.now(timezone.utc).isoformat(),
        "git_base_commit": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
        "code_sha256": code_hashes, "release_sha256": pin, "fixture_sha256": digest(args.fixtures),
        "scope": f"{len(cases)} live-eligible HTTP question cases; other adversarial layers are separate offline tests",
        "before": before, "cases": [], "notes": ["Assertions are bounded to this reviewed fixture set, not general model accuracy.", "Reserved spend is a conservative envelope, not measured billing.", "No customer data or credentials are included."]
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    for case in cases:
        case_before = request(args.base_url, "/research/status")
        started = time.monotonic()
        try:
            response = request(args.base_url, "/research/answer", {"question": case["prompt"]})
            case_after = request(args.base_url, "/research/status")
            calls = case_before["limits"]["remaining_calls"] - case_after["limits"]["remaining_calls"]
            issues = verify_result(case, response, release, pin, calls)
        except Exception as error:
            response, calls, issues = {"status": "request_failed", "error_type": type(error).__name__}, None, ["request_failed"]
        row = {"id": case["id"], "question": case["prompt"], "duration_ms": round((time.monotonic() - started) * 1000), "provider_calls": calls, "passed": not issues, "issues": issues, "response": response}
        artifact["cases"].append(row)
        args.output.write_bytes((json.dumps(artifact, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))
        print(json.dumps({"id": row["id"], "status": response.get("status"), "claims": [c["id"] for c in response.get("claims", [])], "passed": row["passed"], "issues": issues}), flush=True)
    artifact["after"] = request(args.base_url, "/research/status")
    artifact["finished_at"] = datetime.now(timezone.utc).isoformat()
    artifact["artifacts_unchanged"] = digest(release_path) == pin and digest(args.fixtures) == artifact["fixture_sha256"] and all(digest(ROOT / p) == sha for p, sha in code_hashes.items())
    artifact["passed"] = artifact["artifacts_unchanged"] and all(r["passed"] for r in artifact["cases"])
    args.output.write_bytes((json.dumps(artifact, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))
    return 0 if artifact["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
