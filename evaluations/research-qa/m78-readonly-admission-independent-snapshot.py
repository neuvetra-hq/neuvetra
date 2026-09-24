import hashlib
import json
from pathlib import Path

FILES = [
    "evaluations/research-qa/m78-readonly-admission-independent-source.json",
    "evaluations/research-qa/m78-readonly-admission-independent-review.py",
    "evaluations/research-qa/m78-readonly-admission-independent.test.py",
    "evaluations/research-qa/m78-readonly-admission-independent-review.md",
    "evaluations/research-qa/m78-readonly-admission-independent-result.json",
]
sha = lambda b: hashlib.sha256(b).hexdigest()
entries = []
for name in FILES:
    data = Path(name).read_bytes()
    entries.append({"path": name, "sha256": sha(data), "text": data.decode("utf-8")})
out = Path("operations/agent-improvement/snapshots/M78-READONLY-ADMISSION-REVIEW-01-CANDIDATE2.json")
out.write_text(json.dumps({"status": "candidate", "task_id": "M78-READONLY-ADMISSION-REVIEW-01", "files": entries}, indent=2) + "\n", encoding="utf-8", newline="\n")
print(json.dumps({"path": out.as_posix(), "sha256": sha(out.read_bytes()), "files": len(entries)}))
