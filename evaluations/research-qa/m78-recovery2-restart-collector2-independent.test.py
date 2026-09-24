import importlib.util
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / ".superpowers/m78-recovery2-collect-startup2.py"
EXPECTED_SHA = "bbc03eba8ed216dbfca55b083a9de648790bb530eb98d1e55ad10918f6b0dddb"


def load():
    import hashlib
    assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == EXPECTED_SHA
    spec = importlib.util.spec_from_file_location("m78_collect_startup2", SOURCE)
    module = importlib.util.module_from_spec(spec); assert spec and spec.loader; spec.loader.exec_module(module)
    return module


def row(**value):
    import json
    return (json.dumps(value) + "\n").encode()


def main():
    module = load(); requested = datetime.fromisoformat("2026-09-23T04:33:48.625489+00:00")
    stamp = "2026-09-23T04:34:08.743321887Z"
    flat = row(profile="neuvetra.private-synthetic-staging.v1", timestamp=stamp, message="", level="info", event="staging_started")
    assert module.parse_startup_events(flat, requested) == {"event": "staging_started", "timestamp": stamp}
    nested = row(timestamp=stamp, message='{"event":"staging_started"}')
    assert module.parse_startup_events(nested, requested)["timestamp"] == stamp
    assert module.parse_startup_events(flat + flat, requested)["timestamp"] == stamp
    failures = [
        row(timestamp=stamp, event="not_startup"),
        flat + row(timestamp="2026-09-23T04:34:09Z", event="staging_started"),
        row(event="staging_started", message=""),
        b"[]\n",
        b"not-json\n",
    ]
    for raw in failures:
        try: module.parse_startup_events(raw, requested)
        except (RuntimeError, ValueError): pass
        else: raise AssertionError("collector accepted malformed or ambiguous logs")
    print("PASS collector2 exact flat/nested/dedup/refusal cases")


if __name__ == "__main__": main()
