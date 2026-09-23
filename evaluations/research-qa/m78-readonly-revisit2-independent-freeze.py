import hashlib
import json
from pathlib import Path

FILES = [
    "evaluations/research-qa/m78-readonly-revisit2-independent.test.ts",
    "evaluations/research-qa/m78-readonly-revisit2-independent-review.md",
    "evaluations/research-qa/m78-readonly-revisit2-independent-result.json",
]
OUTPUT = Path("operations/agent-improvement/snapshots/M78-READONLY-REVISIT2-QA-01-CANDIDATE1.json")

entries = []
for name in FILES:
    data = Path(name).read_bytes()
    entries.append({"path": name, "sha256": hashlib.sha256(data).hexdigest(), "text": data.decode("utf-8")})
payload = {"schema_version": 1, "task_id": "M78-READONLY-REVISIT2-QA-01", "files": entries}
OUTPUT.write_bytes((json.dumps(payload, indent=2, ensure_ascii=False) + "\n").encode("utf-8"))
