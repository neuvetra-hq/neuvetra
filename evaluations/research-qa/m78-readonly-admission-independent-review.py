import ast
import hashlib
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path.cwd()
ADMIT = Path(".superpowers/m78-readonly-recovery-admit.py")
CLOSURE = Path(".superpowers/m78-readonly-recovery-source-closure.ts")
RUNTIME = Path(".superpowers/m78-get-route-deployment-verified.json")

def sha(path: str | Path) -> str:
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def load(path: str | Path):
    return json.loads(Path(path).read_bytes())

def canonical(value) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)

def closure():
    raw = subprocess.check_output(["C:/Users/nimab/.bun/bin/bun.exe", str(CLOSURE)], cwd=ROOT)
    return json.loads(raw)

def static_contract():
    source = ADMIT.read_text(encoding="utf-8")
    tree = ast.parse(source)
    imports = {alias.name for n in tree.body if isinstance(n, ast.Import) for alias in n.names}
    calls = [n for n in ast.walk(tree) if isinstance(n, ast.Call)]
    return {
        "imports": sorted(imports),
        "subprocessExecutables": [
            n.args[0].elts[0].value
            for n in calls
            if isinstance(n.func, ast.Attribute)
            and isinstance(n.func.value, ast.Name)
            and n.func.value.id == "subprocess"
            and n.func.attr == "check_output"
            and n.args
            and isinstance(n.args[0], ast.List)
            and n.args[0].elts
            and isinstance(n.args[0].elts[0], ast.Constant)
        ],
        "exclusiveWrites": source.count("exclusive("),
        "usesExclusiveMode": "Path(p).open('x'" in source,
        "optimizedPythonRefused": "if not __debug__:raise RuntimeError" in source,
        "networkTokens": [x for x in ("requests", "urllib", "http.client", "socket") if x in imports],
    }

def validate(require_current_freshness: bool = False, require_preexecution_absence: bool = False):
    expected = {
        str(ADMIT): "10ea9111ae8ffa90e01682768f849d51b34c18313bdd0db0c1394105d13b2526",
        ".superpowers/m78-readonly-recovery-admit-candidate1.py": "6d90d0a1d37d3f2601c4af77457c1b639df781d6e8ecc105bbf667345ac465ba",
        str(CLOSURE): "f48f35b1e8b40a46351fc14c89a923146c4c6e719205bff95e9212eb36686e20",
        ".superpowers/m78-get-route-refresh-for-recovery.py": "aecaeb88ef0f4bafb2243986a1a633e63c78b7577acdb4ef5767ebe6da380db0",
        ".superpowers/m78-get-route-observe-deployment.py": "99cf83b8db88ad68a5734bd9cadf39220bf26f0d0540b7985ca58d6c41c95003",
        str(RUNTIME): "fbb7a3b3cb1bd060925aaddb1ed44ecf2f234469ab4e5b375fd9a777fefc2ceb",
        "evaluations/research-qa/m78-readonly-recovery-root-candidate3-result.json": "f346310cc79cdd8192525ee4c008d228ca356645647c1c5c26f8c8ef6021f379",
        "operations/agent-improvement/snapshots/M78-CONT4-READONLY-RECOVERY-ROOT-REVIEW-01-CANDIDATE3.json": "8a9b779377ece198a1f1d2900f89da19fcdd92827f8e13e96aeab72a58eb8924",
        "evaluations/research-qa/m78-readonly-private-independent-result.json": "732eaaad1e415a2601523c6efd2b17874dfb35da75292fa382a938ced6c1bcff",
    }
    assert {p: sha(p) for p in expected} == expected
    candidate1 = Path(".superpowers/m78-readonly-recovery-admit-candidate1.py").read_text(encoding="utf-8")
    current = ADMIT.read_text(encoding="utf-8")
    assert current == candidate1.replace(".superpowers/m78-get-route-deployment-verified.json", ".superpowers/m78-get-route-recovery-runtime-verified.json")
    observer = Path(".superpowers/m78-get-route-observe-deployment.py").read_text(encoding="utf-8")
    refresh = Path(".superpowers/m78-get-route-refresh-for-recovery.py").read_text(encoding="utf-8")
    expected_refresh = observer.replace("m78-get-route-deployment-progress.json", "m78-get-route-recovery-runtime-progress.json").replace("m78-get-route-deployment-collection.json", "m78-get-route-recovery-runtime-collection.json").replace("m78-get-route-deployment-verified.json", "m78-get-route-recovery-runtime-verified.json")
    assert refresh == expected_refresh
    pins = closure()
    assert len(pins) == 179 == len({p["path"] for p in pins})
    for pin in pins:
        assert sha(pin["path"]) == pin["sha256"], pin["path"]
    historic = load("evaluations/research-qa/m78-continuation4-preparation-source-pins.json")
    assert len(historic) == 173
    paths = {p["path"] for p in pins}
    assert {p["path"] for p in historic}.issubset(paths)
    required = {
        ".superpowers/m78-readonly-recovery-entry.ts",
        ".superpowers/m78-private-readonly-recovery.ps1",
        ".superpowers/m78-readonly-recovery-source-closure.ts",
        "tools/staging/check-m78-continuation4-readonly-recovery.ts",
        "evaluations/research-qa/m78-continuation4-readonly-recovery-independent-review.ts",
    }
    assert required.issubset(paths)
    review = load("evaluations/research-qa/m78-readonly-recovery-root-candidate3-result.json")
    assert review["status"] == "m78_readonly_recovery_candidate3_independent_source_review_passed"
    assert review["materialFindingsOpen"] == 0
    for pin in review["sourcePins"]:
        assert sha(pin["path"]) == pin["sha256"]
    root_snapshot = load("operations/agent-improvement/snapshots/M78-CONT4-READONLY-RECOVERY-ROOT-REVIEW-01-CANDIDATE3.json")
    for entry in root_snapshot["files"]:
        raw = Path(entry["path"]).read_bytes()
        assert hashlib.sha256(raw).hexdigest() == entry["sha256"]
        assert raw.decode("utf-8") == entry["text"]
    private = load("evaluations/research-qa/m78-readonly-private-independent-result.json")
    assert private["status"] == "m78_readonly_private_independent_review_passed"
    assert private["reviewerId"] == "/root/m78_transport_continuation" and private["materialFindingsOpen"] == 0
    assert {p["path"]: p["sha256"] for p in private["files"]} == {
        ".superpowers/m78-readonly-recovery-entry.ts": "d4a517b1afbf48f135e8caaa2287a7c3b5dd5cc9bb75917e8c935fe9fa53af32",
        ".superpowers/m78-private-readonly-recovery.ps1": "dba7f41da91c5b26872b8b12cb77c95ed31041bd129a6dfbc6896db62e41f130",
    }
    runtime = load(RUNTIME)
    assert runtime["status"] == "m78_get_route_deployed_runtime_verified"
    assert runtime["commit"] == "9dd9c85fb674528a2c1dd1b0138f5a2d87ba683e"
    assert runtime["deploymentId"] == "f6d77b2e-6886-429b-a4d2-4873c9199ce8"
    assert runtime["imageDigest"] == "sha256:3e4c2c91591a5598a85f63b4099b1b4890588ce79ec832b21b7d284b5aa89d1b"
    assert runtime["deploymentStatus"] == "SUCCESS" and runtime["autodeploy"] is False
    assert runtime["ready"] == {"status": "ready", "profile": "neuvetra.private-synthetic-staging.v1", "schemaVersion": 21, "legacyContainmentVerified": True}
    assert sha(runtime["deploymentCollectionPath"]) == runtime["deploymentCollectionSha256"]
    assert sha(".superpowers/m78-get-route-deployment-admission.json") == runtime["admissionSha256"]
    age = (datetime.now(timezone.utc) - datetime.fromisoformat(runtime["observedAt"])).total_seconds()
    if require_current_freshness:
        assert 0 <= age < 600
    preexecution_paths = [
        ".superpowers/m78-continuation4-readonly-recovery.jsonl",
        ".superpowers/m78-continuation4-readonly-recovery-diagnostics.jsonl",
        ".superpowers/m78-continuation4-readonly-recovery-observation.json",
        ".superpowers/m78-continuation4-readonly-recovery.jsonl.lock",
        ".superpowers/m78-readonly-recovery-source-gate.json",
        ".superpowers/m78-readonly-recovery-execution-admission.json",
    ]
    if require_preexecution_absence:
        for path in preexecution_paths:
            assert not Path(path).exists(), path
    admit_text = ADMIT.read_text(encoding="utf-8")
    for path in preexecution_paths:
        assert path.replace(".superpowers/", "") in admit_text or path in (".superpowers/m78-readonly-recovery-source-gate.json", ".superpowers/m78-readonly-recovery-execution-admission.json")
    contract = static_contract()
    assert contract["imports"] == ["hashlib", "json", "subprocess"]
    assert contract["subprocessExecutables"] == ["C:/Users/nimab/.bun/bin/bun.exe"]
    assert contract["usesExclusiveMode"] and contract["exclusiveWrites"] == 2
    assert contract["optimizedPythonRefused"] and contract["networkTokens"] == []
    digest = hashlib.sha256(canonical(pins).encode()).hexdigest()
    return {"pins": pins, "sourcePinsSha256": digest, "runtimeAgeSecondsAtReview": age, "contract": contract}

if __name__ == "__main__":
    value = validate()
    print(json.dumps({"status": "passed", "sourceFiles": len(value["pins"]), "sourcePinsSha256": value["sourcePinsSha256"], "runtimeAgeSecondsAtReview": round(value["runtimeAgeSecondsAtReview"], 3), "contract": value["contract"]}, indent=2))
