"""Verify the private test archive is a byte-exact materialization of frozen ref 104."""
from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path

REF = "1042348f2d4849246771fee4be77fe590c34ab8a"
ARCHIVE = Path(".superpowers/m78-get-ci-history")


def blob_id(value: bytes) -> str:
    return hashlib.sha1(b"blob " + str(len(value)).encode() + b"\0" + value).hexdigest()


def main() -> None:
    raw = subprocess.check_output(["git", "ls-tree", "-rz", "-r", REF])
    entries = [entry for entry in raw.split(b"\0") if entry]
    missing: list[str] = []
    changed: list[str] = []
    crlf_materialized: list[str] = []
    for entry in entries:
        metadata, path_bytes = entry.split(b"\t", 1)
        _mode, kind, expected = metadata.decode().split()
        path = path_bytes.decode("utf-8")
        target = ARCHIVE / path
        if not target.is_file():
            missing.append(path)
        else:
            value = target.read_bytes()
            if kind != "blob":
                changed.append(path)
            elif blob_id(value) != expected:
                normalized = value.replace(b"\r\n", b"\n")
                if path.endswith(".ps1") and normalized != value and blob_id(normalized) == expected:
                    crlf_materialized.append(path)
                else:
                    changed.append(path)
    if missing or changed:
        raise SystemExit(json.dumps({"missing": missing, "changed": changed}))
    print(json.dumps({"status": "frozen_ref_worktree_exact", "ref": REF, "trackedBlobs": len(entries), "missing": 0, "changed": 0, "gitattributesCrlfMaterialized": len(crlf_materialized)}))


if __name__ == "__main__":
    main()
