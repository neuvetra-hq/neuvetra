import hashlib
import json
from pathlib import Path

FILES = [
    ".superpowers/m78-readonly-recovery-admit.py",
    ".superpowers/m78-readonly-recovery-admit-candidate1.py",
    ".superpowers/m78-readonly-recovery-source-closure.ts",
    ".superpowers/m78-get-route-refresh-for-recovery.py",
    ".superpowers/m78-get-route-observe-deployment.py",
    ".superpowers/m78-get-route-recovery-runtime-verified.json",
    ".superpowers/m78-get-route-deployment-verified.json",
    "evaluations/research-qa/m78-readonly-recovery-root-candidate3-result.json",
    "operations/agent-improvement/snapshots/M78-CONT4-READONLY-RECOVERY-ROOT-REVIEW-01-CANDIDATE3.json",
    "evaluations/research-qa/m78-readonly-private-independent-result.json",
]

def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

entries = []
for name in FILES:
    data = Path(name).read_bytes()
    entries.append({"path": name, "sha256": sha(data), "text": data.decode("utf-8")})
out = Path("evaluations/research-qa/m78-readonly-admission-independent-source.json")
out.write_text(json.dumps({"schemaVersion": 1, "files": entries}, indent=2) + "\n", encoding="utf-8", newline="\n")
print(json.dumps({"path": out.as_posix(), "sha256": sha(out.read_bytes()), "files": len(entries)}))
