import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FILES = [
    "evaluations/research-qa/m78-recovery2-restart-actual-independent-review.ts",
    "evaluations/research-qa/m78-recovery2-restart-actual-independent.test.ts",
    "evaluations/research-qa/m78-recovery2-restart-collector2-independent.test.py",
    "evaluations/research-qa/m78-recovery2-restart-actual-independent-review.md",
    "evaluations/research-qa/m78-recovery2-restart-actual-independent-result.json",
]
OUTPUT = ROOT / "operations/agent-improvement/snapshots/M78-RECOVERY2-RESTART-ACTUAL-QA-01-CANDIDATE1.json"
sha = lambda value: hashlib.sha256(value).hexdigest()
entries = []
for name in FILES:
    data = (ROOT / name).read_bytes()
    entries.append({"path": name, "sha256": sha(data), "text": data.decode("utf-8")})
payload = {"schema_version": 1, "task_id": "M78-RECOVERY2-RESTART-ACTUAL-QA-01", "files": entries}
OUTPUT.write_bytes((json.dumps(payload, indent=2, ensure_ascii=False) + "\n").encode())
