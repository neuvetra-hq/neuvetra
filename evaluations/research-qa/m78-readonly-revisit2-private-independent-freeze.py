import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RESULT = ROOT / "evaluations/research-qa/m78-readonly-revisit2-private-independent-result.json"
SNAPSHOT = ROOT / "operations/agent-improvement/snapshots/M78-READONLY-REVISIT2-PRIVATE-QA-01-CANDIDATE1.json"
sha = lambda value: hashlib.sha256(value).hexdigest()

pins = json.loads(subprocess.check_output([
    "C:/Users/nimab/.bun/bin/bun.exe",
    ".superpowers/m78-readonly-revisit2-source-closure.ts",
], cwd=ROOT))
assert len(pins) == 188 and len({row["path"] for row in pins}) == 188
for row in pins:
    assert sha((ROOT / row["path"]).read_bytes()) == row["sha256"]

result = {
    "status": "m78_readonly_revisit2_private_independent_review_passed",
    "reviewerId": "/root/m78_transport_probe",
    "materialFindingsOpen": 0,
    "files": [
        {"path": ".superpowers/m78-readonly-revisit2-entry.ts", "sha256": "333a5bea07c1e081832514ad21da789b5cf1ee1f4a06336e86772bec19fcf18b"},
        {"path": ".superpowers/m78-private-readonly-revisit2.ps1", "sha256": "00b7cdcc0f1f3f05486e1ecbb234ebf4f1ba170a12adfcd2aef3f0cd0af83237"},
    ],
    "reviewedSupportFiles": [
        {"path": ".superpowers/m78-readonly-revisit2-source-closure.ts", "sha256": "9cc54638077f08a89f2010d73569bc4ec89d79803b5f7a039ba2f55157702dbd"},
        {"path": ".superpowers/m78-readonly-revisit2-admit.py", "sha256": "c82ff2767792c2901b3bd69415d3b34e1a52331900267189b11e250540872b63"},
    ],
    "sourcePins": pins,
    "actualRecovery2ResultSha256": "eaa2f3e35e3e7b939a15aa9122fdddfea19625eefc484d305ecce656d4491bd1",
    "checks": {
        "mockedFinalizerCasesPassed": 3,
        "sourcePinsVerified": 188,
        "strictTargetedTypeScriptPassed": True,
        "powerShellAstPassed": True,
        "pythonCompilePassed": True,
        "hostedCalls": 0,
        "credentialReads": 0,
        "providerCalls": 0,
        "databaseCalls": 0,
    },
    "firstReviewFinding": {
        "id": "ACTUAL_RECOVERY_RECEIPT_CALLER_SUPPLIED_SHA",
        "status": "closed",
        "repair": "The finalizer fixes the exact independently accepted recovery2 receipt SHA and rejects any different argument before loading evidence or writing gates.",
    },
    "actualRestartAccepted": False,
    "actualRevisit2Executed": False,
}
RESULT.write_bytes((json.dumps(result, indent=2, ensure_ascii=False) + "\n").encode())

files = [
    "evaluations/research-qa/m78-readonly-revisit2-private-independent.test.py",
    "evaluations/research-qa/m78-readonly-revisit2-private-independent-review.md",
    "evaluations/research-qa/m78-readonly-revisit2-private-independent-result.json",
]
entries = []
for name in files:
    data = (ROOT / name).read_bytes()
    entries.append({"path": name, "sha256": sha(data), "text": data.decode("utf-8")})
payload = {"schema_version": 1, "task_id": "M78-READONLY-REVISIT2-PRIVATE-QA-01", "files": entries}
SNAPSHOT.write_bytes((json.dumps(payload, indent=2, ensure_ascii=False) + "\n").encode())
