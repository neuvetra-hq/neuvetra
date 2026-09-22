"""Bounded tracked-only POSIX locator validation; no database or network access."""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parents[2]
record = "operations/agent-improvement/runs/M78-CONTINUATION-NATIVE-01.json"
tracked = set(subprocess.check_output(["git", "ls-files", "-z"], cwd=root).decode().split("\0"))
spec = importlib.util.spec_from_file_location("agent_ops", root / "tools/agent_ops.py")
ops = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ops)
original_local_file = ops.local_file
checked = set()
def tracked_file(base, locator):
    path = locator.split("#", 1)[0]
    ops.require("\\" not in path, "Non-POSIX evidence locator: " + path)
    ops.require(path in tracked, "Not in tracked checkout: " + path)
    checked.add(path)
    return original_local_file(base, locator)
ops.local_file = tracked_file
registry = json.loads((root / "operations/agent-improvement/roles.json").read_bytes())
roles = {role["id"]: role for role in registry["roles"]}
lessons = {item["id"] for item in json.loads((root / "operations/agent-improvement/lessons.json").read_bytes())["lessons"]}
old = json.loads(subprocess.check_output(["git", "show", "d139628:" + record], cwd=root))
new = json.loads((root / record).read_bytes())
expected = copy.deepcopy(old)
expected["criteria"][0]["evidence"] = ["operations/agent-improvement/snapshots/M78-CONTINUATION-NATIVE-01-INSPECT.json"]
expected["criteria"][1]["evidence"][1] = "evaluations/research-qa/m78-continuation-native-result.json"
assert new == expected, "Unexpected record change beyond two evidence locators"
failures = []
for candidate in [old, {**old, "criteria": [new["criteria"][0], old["criteria"][1]]}]:
    try:
        ops.validate_run(root, candidate, roles, registry["supported_models"], lessons)
    except ops.InvalidRecord as exc:
        failures.append(str(exc))
    else:
        raise AssertionError("Historical malformed locator unexpectedly accepted")
ops.validate_run(root, new, roles, registry["supported_models"], lessons)
for artifact in new["historical_artifacts"]:
    path = tracked_file(root, artifact["path"])
    assert hashlib.sha256(path.read_bytes()).hexdigest() == artifact["sha256"]
snapshot_path = new["criteria"][0]["evidence"][0]
snapshot = json.loads((root / snapshot_path).read_bytes())
entry = next(item for item in snapshot["artifacts"] if item["path"] == ".superpowers/m78-continuation-native-20260922-inspect.json")
assert hashlib.sha256(entry["text"].encode()).hexdigest() == entry["sha256"] == "c3fc47aef0a671a5dd4eb462f90af3ec892c51274d36973018e53f66717077b9"
inspect = json.loads(entry["text"])
assert inspect["status"] == "m78_continuation_readonly_inspected"
assert inspect["database"] == "m78_ops_continuation_20260922"
public_result = root / new["criteria"][1]["evidence"][1]
assert hashlib.sha256(public_result.read_bytes()).hexdigest() == "beeeb7873bb71a58916a95912c8c3a21d85a24e95ad5f31226726f950116cb30"
print(json.dumps({"status": "tracked_only_record_validation_passed", "historicalCommit": "d139628", "historicalFailuresReproduced": failures, "checkedTrackedLocators": sorted(checked), "onlyTwoEvidenceLocatorsChanged": True, "inspectEmbeddedSha256": entry["sha256"], "nativeExecutions": 0}, indent=2))
