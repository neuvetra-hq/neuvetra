"""Batch entry point for the Scope 1 and Scope 2 engines (scope12_batch.py) (BI-01, 12 November 2026).

One process calculates many records. The named engine file is loaded once, so its module-level data (the Scope 1
register; the Scope 2 registers and ZIP table) is read and checked once per process instead of once per record, and
each item is passed to that engine's own, unchanged `handle` function, exactly as the engine's per-record command line
does. The engine files themselves are not changed by this entry point, so their SHA-256 (and with it every result's
engineSha256 and resultSha256, the reviewed engine pins and the method releases that name them) stays the same.

Request (stdin, UTF-8 JSON): {"action": "calculate_many", "engine": "scope1" | "scope2", "items": [<per-record request>, ...]}, where a per-record
request is exactly what the per-record command line reads, with action "calculate".
Response (stdout): {"results":[<item>, ...],"status":"ok"}; each <item> is byte for byte what the per-record command
line prints for that request (without its newline): {"result":...,"status":"ok"}, {"code":"...","status":"refused"}
or {"status":"error","code":"scope1_engine_unavailable"} (scope2 likewise). A refused, failing or malformed item
never affects another item. An envelope that cannot be read is refused as a whole (exit 1); a failure outside any item
(the engine file cannot be loaded) answers an error (exit 2), and the caller treats every item as unavailable.
"""
from __future__ import annotations

import json
import sys
import types
from pathlib import Path

HERE = Path(__file__).resolve().parent
ENGINES = {'scope1': 'scope1_engine.py', 'scope2': 'scope2_engine.py'}
# One call carries at most 1,000 items and 32 MiB (the caller sends chunks of at most 400 items and 8 MiB).
MAX_ITEMS = 1000
MAX_REQUEST_BYTES = 32 * 1024 * 1024


class Refused(ValueError):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


def canonical(v) -> str:
    return json.dumps(v, ensure_ascii=False, sort_keys=True, separators=(',', ':'))


def load_engine(name: str) -> types.ModuleType:
    """Runs the engine file's own source as a module named after the file (never a cached .pyc), with __file__ set to
    the engine file, so engine_sha256() and the data paths it derives from __file__ are exactly the per-record ones."""
    path = HERE / ENGINES[name]
    module = types.ModuleType(path.stem)
    module.__file__ = str(path)
    sys.modules[path.stem] = module
    exec(compile(path.read_bytes(), str(path), 'exec'), module.__dict__)  # noqa: S102 - the pinned engine file itself
    return module


def item_text(engine: types.ModuleType, name: str, item) -> str:
    """What the engine's per-record command line prints for `item` (its __main__ block), without the newline."""
    try:
        if not isinstance(item, dict) or item.get('action') != 'calculate':
            raise engine.Refused('invalid_request')  # this entry point only calculates
        return engine.canonical(engine.handle(item))
    except engine.Refused as e:
        return engine.canonical({'status': 'refused', 'code': e.code})
    except Exception:  # noqa: BLE001 - the same item fails the per-record command line with exit 2
        return '{"status":"error","code":"%s_engine_unavailable"}' % name


UNREADABLE = object()  # an item whose own text cannot be parsed (BI-01b: nested deeper than the parser allows)


def run(request) -> str:
    if not isinstance(request, dict) or set(request) != {'action', 'engine', 'items'} or request['action'] != 'calculate_many' or request['engine'] not in ENGINES:
        raise Refused('invalid_request')
    items = request['items']
    if not isinstance(items, list) or not 1 <= len(items) <= MAX_ITEMS:
        raise Refused('invalid_request')
    engine = load_engine(request['engine'])
    return '{"results":[' + ','.join(
        ('{"status":"error","code":"%s_engine_unavailable"}' % request['engine']) if item is UNREADABLE else item_text(engine, request['engine'], item)
        for item in items) + '],"status":"ok"}'


def item_texts(text: str, start: int) -> tuple:
    """Splits a JSON array, from the character after its '[', into its elements' texts without parsing them (no recursion),
    and returns them with the index just after the closing ']'."""
    out, depth, in_string, escaped, begin, i = [], 0, False, False, start, start
    while i < len(text):
        c = text[i]
        if in_string:
            if escaped: escaped = False
            elif c == '\\': escaped = True
            elif c == '"': in_string = False
        elif c == '"': in_string = True
        elif c in '[{': depth += 1
        elif c in ']}':
            if depth == 0:
                if c != ']': raise ValueError('malformed array')
                if text[begin:i].strip() or out: out.append(text[begin:i])
                return out, i + 1
            depth -= 1
        elif c == ',' and depth == 0:
            out.append(text[begin:i]); begin = i + 1
        i += 1
    raise ValueError('unterminated array')


def run_split(raw: bytes) -> str:
    """BI-01b: the request nests deeper than the parser allows. Each item is then read on its own, so an item that cannot be
    read fails only itself, as its own per-record call would (exit 2), and every other item is answered exactly as before.
    Only the envelope the bridge writes is accepted here: {"action":"calculate_many","engine":"scope1|scope2","items":[...]}."""
    text = raw.decode('utf-8')
    for name in ENGINES:
        head = '{"action":"calculate_many","engine":"%s","items":[' % name
        if text.startswith(head):
            texts, end = item_texts(text, len(head))
            if text[end:].strip() != '}':
                raise Refused('invalid_request')
            items = []
            for item in texts:
                try:
                    items.append(json.loads(item))
                except RecursionError:
                    items.append(UNREADABLE)
            return run({'action': 'calculate_many', 'engine': name, 'items': items})
    raise Refused('invalid_request')


if __name__ == '__main__':
    try:
        raw = sys.stdin.buffer.read(MAX_REQUEST_BYTES + 1)
        if len(raw) > MAX_REQUEST_BYTES:
            raise Refused('request_too_large')
        try:
            request = json.loads(raw)
        except RecursionError:
            print(run_split(raw))
        else:
            print(run(request))
    except Refused as e:
        print(canonical({'status': 'refused', 'code': e.code}))
        sys.exit(1)
    except Exception:  # noqa: BLE001
        print('{"status":"error","code":"scope12_batch_unavailable"}')
        sys.exit(2)
