import hashlib
import importlib.util
import json
import subprocess
import types
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FINALIZER = ROOT / ".superpowers/m78-readonly-revisit2-admit.py"
SOURCE = ROOT / ".superpowers/m78-readonly-revisit2-source-closure.ts"
ACTUAL = "evaluations/research-qa/m78-readonly-recovery2-actual-independent-result.json"
SOURCE_GATE = ".superpowers/m78-readonly-revisit2-source-gate.json"
EXECUTION_GATE = ".superpowers/m78-readonly-revisit2-execution-admission.json"
sha = lambda value: hashlib.sha256(value).hexdigest()
encode = lambda value: (json.dumps(value, indent=2) + "\n").encode()


def load_finalizer():
    spec = importlib.util.spec_from_file_location("m78_revisit2_admit", FINALIZER)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


def closure_pins():
    raw = subprocess.check_output(["C:/Users/nimab/.bun/bin/bun.exe", str(SOURCE.relative_to(ROOT))], cwd=ROOT)
    pins = json.loads(raw)
    assert len(pins) == 188 and len({row["path"] for row in pins}) == 188
    for row in pins:
        assert sha((ROOT / row["path"]).read_bytes()) == row["sha256"]
    return pins


class FakeHandle:
    def __init__(self, fs, path): self.fs, self.path, self.text = fs, path, ""
    def __enter__(self): return self
    def __exit__(self, *_): self.fs[self.path] = self.text.encode()
    def write(self, text): self.text += text; return len(text)
    def flush(self): pass
    def fileno(self): return 0


class FakePath:
    fs = {}
    def __init__(self, value): self.value = str(value).replace("\\", "/")
    def read_bytes(self): return self.fs[self.value]
    def exists(self): return self.value in self.fs
    def open(self, mode, **_):
        assert mode == "x"
        if self.value in self.fs: raise FileExistsError(self.value)
        return FakeHandle(self.fs, self.value)


def fixture():
    module = load_finalizer()
    pins = closure_pins()
    fs = {row["path"]: (ROOT / row["path"]).read_bytes() for row in pins}
    actual_bytes = (ROOT / ACTUAL).read_bytes(); actual = json.loads(actual_bytes)
    assert sha(actual_bytes) == module.ACTUAL_SHA
    fs[ACTUAL] = actual_bytes
    for row in actual["evidence"].values(): fs[row["path"]] = (ROOT / row["path"]).read_bytes()
    original_gate_path = ".superpowers/m78-readonly-recovery2-source-gate.json"
    fs[original_gate_path] = (ROOT / original_gate_path).read_bytes()
    for row in json.loads(fs[original_gate_path])["sourcePins"]: fs.setdefault(row["path"], (ROOT / row["path"]).read_bytes())

    qa = {"status": "m78_readonly_revisit2_private_independent_review_passed", "reviewerId": "/root/m78_transport_probe", "materialFindingsOpen": 0, "sourcePins": pins}
    fs[module.QA] = encode(qa); qa_sha = sha(fs[module.QA])
    restart = {"status": "m78_readonly_recovery2_restart_admitted", "runtime": module.RUNTIME, "recoveryResultSha256": module.ACTUAL_SHA}
    fs[module.RESTART_ADMISSION] = encode(restart); restart_sha = sha(fs[module.RESTART_ADMISSION])
    request = {"status": "m78_readonly_recovery2_restart_requested", "reason": "scope1_persistence_verification", "runtime": module.RUNTIME, "recoveryResultSha256": module.ACTUAL_SHA, "restartAdmissionSha256": restart_sha, "requestId": "qa-restart", "requestedAt": "2026-09-23T04:00:00.000Z"}
    fs[module.REQUEST] = encode(request); request_sha = sha(fs[module.REQUEST])
    fs[module.ACK] = encode({"data": {"deploymentRestart": True}}); ack_sha = sha(fs[module.ACK])
    startup = {"status": "m78_readonly_recovery2_restart_startup_observed", "runtime": module.RUNTIME, "startupEvents": 1, "ready": {"status": "ready", "profile": "neuvetra.private-synthetic-staging.v1", "schemaVersion": 21, "legacyContainmentVerified": True}, "requestSha256": request_sha, "acknowledgmentSha256": ack_sha, "requestId": request["requestId"], "providerStartup": {"timestamp": "2026-09-23T04:01:00.000Z"}, "observedAt": "2026-09-23T04:02:00.000Z"}
    fs[module.STARTUP] = encode(startup); startup_sha = sha(fs[module.STARTUP])
    review = {"status": "m78_readonly_recovery2_restart_independently_verified", "reviewerId": "/root/m78_transport_probe", "materialFindingsOpen": 0, "exactlyOneStartup": True, "runtime": module.RUNTIME, "recoveryResultSha256": module.ACTUAL_SHA, "startupSha256": startup_sha, "requestSha256": request_sha, "acknowledgmentSha256": ack_sha, "restartAdmissionSha256": restart_sha}
    fs[module.RESTART_QA] = encode(review); review_sha = sha(fs[module.RESTART_QA])
    checks = {"sha": "9dd9c85fb674528a2c1dd1b0138f5a2d87ba683e", "pr_head": "9dd9c85fb674528a2c1dd1b0138f5a2d87ba683e", "checks": [{"name": f"check-{n}", "status": "completed", "conclusion": "success"} for n in range(6)]}
    fs[module.CHECKS] = encode(checks)

    FakePath.fs = fs; module.Path = FakePath; module.os.fsync = lambda _: None
    class FixedDateTime(datetime):
        @classmethod
        def now(cls, tz=None): return cls.fromisoformat("2026-09-23T04:03:00+00:00")
    module.datetime = FixedDateTime
    def command(args):
        if args[0].lower().endswith("bun.exe"): return json.dumps(pins).encode()
        if args[:3] == ["git", "rev-parse", "HEAD"]: return checks["sha"].encode() + b"\n"
        raise AssertionError(args)
    module.subprocess = types.SimpleNamespace(check_output=command)
    return module, fs, pins, qa_sha, review_sha


def test_positive_and_exact_sources():
    module, fs, pins, qa_sha, review_sha = fixture()
    result = module.admit(qa_sha, module.ACTUAL_SHA, review_sha)
    assert result["status"] == "m78_readonly_revisit2_execution_admitted"
    assert result["sourceFiles"] == 188 and SOURCE_GATE in fs and EXECUTION_GATE in fs
    admission = json.loads(fs[EXECUTION_GATE])
    assert any(row["path"] == ACTUAL and row["sha256"] == module.ACTUAL_SHA for row in admission["pins"])
    expected = {".superpowers/m78-readonly-revisit2-entry.ts", ".superpowers/m78-private-readonly-revisit2.ps1", ".superpowers/m78-readonly-revisit2-source-closure.ts", ".superpowers/m78-readonly-revisit2-admit.py", "tools/staging/m78-readonly-revisit2.ts"}
    assert expected <= {row["path"] for row in pins}


def test_coordinated_actual_receipt_substitution_refuses_before_write():
    module, fs, _, qa_sha, review_sha = fixture()
    forged = encode({"status": "m78_independent_continuation4_readonly_recovery2_passed"}); forged_sha = sha(forged); fs[ACTUAL] = forged
    try: module.admit(qa_sha, forged_sha, review_sha)
    except AssertionError as error: assert "Exact independently accepted recovery2 result required" in str(error)
    else: raise AssertionError("forged actual receipt accepted")
    assert SOURCE_GATE not in fs and EXECUTION_GATE not in fs


def test_source_drift_and_existing_output_refuse_without_new_gate():
    module, fs, pins, qa_sha, review_sha = fixture()
    target = next(row["path"] for row in pins if row["path"] == "tools/staging/m78-readonly-revisit2.ts")
    fs[target] += b"changed"
    try: module.admit(qa_sha, module.ACTUAL_SHA, review_sha)
    except AssertionError as error: assert target in str(error)
    else: raise AssertionError("source drift accepted")
    assert SOURCE_GATE not in fs and EXECUTION_GATE not in fs

    module, fs, _, qa_sha, review_sha = fixture(); fs[EXECUTION_GATE] = b"existing"
    try: module.admit(qa_sha, module.ACTUAL_SHA, review_sha)
    except AssertionError: pass
    else: raise AssertionError("existing output accepted")
    assert SOURCE_GATE not in fs and fs[EXECUTION_GATE] == b"existing"


if __name__ == "__main__":
    tests = [test_positive_and_exact_sources, test_coordinated_actual_receipt_substitution_refuses_before_write, test_source_drift_and_existing_output_refuse_without_new_gate]
    for test in tests: test(); print("PASS", test.__name__)
