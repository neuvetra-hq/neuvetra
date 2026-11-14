"""BI-01: the batch entry point gives, for every engine specification case, exactly what the per-record command line gives.

Every request the Scope 1 and Scope 2 specification suites (scope1_engine_test, scope2_engine_test) send to the engines
is captured, together with malformed and refused requests, and run through both paths: the engine's own per-record
command line (one process per request, as before BI-01) and scope12_batch.py (one process for all of them). Each item
must be byte for byte the per-record output, with the matching status for its exit code, in any order and position.
Run: python -m unittest scope12_batch_test
"""
import io
import os
import json
import subprocess
import sys
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import scope1_engine
import scope2_engine
import scope1_engine_test
import scope2_engine_test

HERE = Path(__file__).resolve().parent
P = {'start': '2025-01-01', 'endExclusive': '2026-01-01'}
EXIT_STATUS = {0: 'ok', 1: 'refused', 2: 'error'}


def canonical(v) -> str:
    return json.dumps(v, ensure_ascii=False, sort_keys=True, separators=(',', ':'))


def capture(module, names, to_item, test_module) -> list:
    """Runs a specification suite with the named engine functions wrapped, and returns every request they received."""
    seen, items, originals = set(), [], {name: getattr(module, name) for name in names}

    def wrap(name):
        def wrapped(*args, **kwargs):
            try:
                item = json.loads(json.dumps(to_item(name, *args, **kwargs)))
            except (TypeError, ValueError):
                item = None  # not JSON (only a direct Python call can send it); the API never can
            if item is not None and canonical(item) not in seen:
                seen.add(canonical(item))
                items.append(item)
            return originals[name](*args, **kwargs)
        return wrapped

    for name in names:
        setattr(module, name, wrap(name))
    try:
        result = unittest.TextTestRunner(stream=io.StringIO(), verbosity=0).run(unittest.defaultTestLoader.loadTestsFromModule(test_module))
    finally:
        for name, original in originals.items():
            setattr(module, name, original)
    if not result.wasSuccessful():
        raise AssertionError('the specification suite itself failed while its cases were captured')
    return items


def scope1_item(name, *args):
    if name == 'calculate':
        return {'action': 'calculate', 'request': args[0]}
    kind = {'natural_gas': 'natural_gas', 'distillate': 'distillate_no2', 'vehicle': 'vehicle', 'fugitive': 'fugitive'}[name]
    return {'action': 'calculate', 'request': {'kind': kind, 'input': args[0]}}


def scope2_item(_name, inp):
    return {'action': 'calculate', 'input': inp}


# Requests the suites do not send: every envelope and shape error a per-record call can meet.
SCOPE1_EXTRA = [
    5, None, [], 'calculate', {}, {'action': 'calculate'}, {'action': 'calculate', 'request': None}, {'action': 'calculate', 'request': {}},
    {'action': 'calculate', 'request': {'kind': 'natural_gas'}}, {'action': 'calculate', 'request': {'kind': 'natural_gas', 'input': []}},
    {'action': 'calculate', 'request': {'kind': 'coal', 'input': {}}}, {'action': 'calculate', 'request': {'kind': 'natural_gas', 'input': {}}, 'extra': 1},
    {'action': 'calculate', 'request': {'kind': 'natural_gas', 'input': {'period': P, 'quantity': '1', 'unit': 'therm', 'heatContent': 5}}},
    {'action': 'calculate', 'request': {'kind': 'natural_gas', 'input': {'period': 'year', 'quantity': '1', 'unit': 'therm'}}},
    {'action': 'calculate', 'request': {'kind': 'vehicle', 'input': {'period': P, 'fuel': 'diesel', 'vehicleType': [], 'modelYear': '2020', 'gallons': '1'}}},
    {'action': 'calculate', 'request': {'kind': 'fugitive', 'input': {'period': P, 'gas': None, 'unit': 'kg', 'terms': 7}}},
    {'action': 'describe'}, {'action': 'aggregate', 'results': []}, {'action': 'lookup_zip', 'zip': '94105'},
]
SCOPE2_EXTRA = [
    5, None, [], {}, {'action': 'calculate'}, {'action': 'calculate', 'input': None}, {'action': 'calculate', 'input': []}, {'action': 'calculate', 'input': {}},
    {'action': 'calculate', 'input': {'period': P, 'quantity': '1', 'unit': 'kWh', 'zip': 94105, 'subregion': 'CAMX'}},
    {'action': 'calculate', 'input': {'period': P, 'quantity': '1', 'unit': 'kWh', 'zip': '94105', 'subregion': 'CAMX', 'instruments': 'none'}},
    {'action': 'calculate', 'input': {'period': P, 'quantity': '1', 'unit': 'kWh', 'zip': '94105', 'subregion': 'CAMX', 'instruments': [None]}},
    {'action': 'calculate', 'input': {'period': P, 'quantity': '1', 'unit': 'kWh', 'zip': '94105', 'subregion': 'CAMX'}, 'extra': True},
    {'action': 'describe'}, {'action': 'lookup_zip', 'zip': '94105'},
]


def per_record(engine: str, item) -> tuple:
    run = subprocess.run([sys.executable, str(HERE / f'{engine}_engine.py')], input=json.dumps(item).encode(), capture_output=True, timeout=60)
    return run.returncode, run.stdout.decode('utf-8')


def batch(engine: str, items) -> list:
    """The batch's items as raw text, exactly as printed (split with the JSON decoder, never re-serialised)."""
    run = subprocess.run([sys.executable, str(HERE / 'scope12_batch.py')], input=json.dumps({'action': 'calculate_many', 'engine': engine, 'items': items}).encode(), capture_output=True, timeout=300)
    assert run.returncode == 0, run.stdout
    text = run.stdout.decode('utf-8')
    prefix, suffix = '{"results":[', '],"status":"ok"}\n'
    assert text.startswith(prefix) and text.endswith(suffix)
    body, decoder, texts, at = text[len(prefix):-len(suffix)], json.JSONDecoder(), [], 0
    while at < len(body):
        _, end = decoder.raw_decode(body, at)
        texts.append(body[at:end])
        at = end + 1 if end < len(body) and body[end] == ',' else end
    assert len(texts) == len(items) and json.loads(text)['results'] == [json.loads(t) for t in texts]
    return texts


class BatchEqualsPerRecord(unittest.TestCase):
    cases: dict = {}

    @classmethod
    def setUpClass(cls):
        cls.cases = {
            'scope1': capture(scope1_engine, ['calculate', 'natural_gas', 'distillate', 'vehicle', 'fugitive'], scope1_item, scope1_engine_test) + SCOPE1_EXTRA,
            'scope2': capture(scope2_engine, ['electricity'], scope2_item, scope2_engine_test) + SCOPE2_EXTRA,
        }

    def check(self, engine: str):
        items = self.cases[engine]
        with ThreadPoolExecutor(max_workers=max(2, os.cpu_count() or 2)) as pool:
            expected = list(pool.map(lambda item: per_record(engine, item), items))
        statuses = {EXIT_STATUS.get(code, 'other') for code, _ in expected}
        # The cases reach every per-record outcome: a result, a refusal and (Scope 1; no Scope 2 input reaches one) an engine error.
        self.assertEqual(statuses, {'ok', 'refused', 'error'} if engine == 'scope1' else {'ok', 'refused'})
        forward, backward = batch(engine, items), batch(engine, list(reversed(items)))[::-1]
        # The same request twice in one process (the second after hundreds of others) gives the same bytes twice.
        head = items[:450]
        twice = batch(engine, head + head)
        refused_here = '{"code":"invalid_request","status":"refused"}\n'
        for i, (code, stdout) in enumerate(expected):
            if isinstance(items[i], dict) and 'action' in items[i] and items[i]['action'] != 'calculate':
                # This entry point only calculates: describe, aggregate and lookup_zip stay per-record calls.
                self.assertEqual({got + '\n' for got in (forward[i], backward[i])}, {refused_here})
                continue
            for got in (forward[i], backward[i]) + ((twice[i], twice[len(head) + i]) if i < len(head) else ()):
                self.assertEqual(stdout, got + '\n', f'{engine} case {i}: {json.dumps(items[i])[:200]}')
                self.assertEqual(json.loads(got)['status'], EXIT_STATUS[code])
        # A batch never changes what any engine reports about itself: the results name the engine file's own hash.
        hashes = {json.loads(got)['result']['engineSha256'] for got in forward if json.loads(got)['status'] == 'ok'}
        self.assertEqual(hashes, {(scope1_engine if engine == 'scope1' else scope2_engine).engine_sha256()})
        return len(items)

    def test_scope1_every_specification_case(self):
        self.assertGreater(self.check('scope1'), 60)

    def test_scope2_every_specification_case(self):
        self.assertGreater(self.check('scope2'), 25)


class BatchEnvelope(unittest.TestCase):
    def run_raw(self, raw: bytes):
        run = subprocess.run([sys.executable, str(HERE / 'scope12_batch.py')], input=raw, capture_output=True, timeout=60)
        return run.returncode, run.stdout.decode('utf-8').strip()

    def test_an_unreadable_envelope_is_refused_whole(self):
        ok_item = {'action': 'calculate', 'request': {'kind': 'natural_gas', 'input': {'period': P, 'quantity': '1', 'unit': 'MMBtu'}}}
        for envelope in (b'not json', b'[]', b'{}', json.dumps({'action': 'calculate_many', 'engine': 'scope3', 'items': [ok_item]}).encode(), json.dumps({'engine': 'scope1', 'items': [ok_item]}).encode(),
                         json.dumps({'action': 'calculate', 'engine': 'scope1', 'items': [ok_item]}).encode(),
                         json.dumps({'action': 'calculate_many', 'engine': 'scope1', 'items': []}).encode(), json.dumps({'action': 'calculate_many', 'engine': 'scope1', 'items': ok_item}).encode(),
                         json.dumps({'action': 'calculate_many', 'engine': 'scope1', 'items': [ok_item] * 1001}).encode(),
                         json.dumps({'action': 'calculate_many', 'engine': 'scope1', 'items': [ok_item], 'extra': 1}).encode()):
            code, out = self.run_raw(envelope)
            self.assertIn(code, (1, 2), envelope[:60])
            self.assertNotIn('"result"', out)
        self.assertEqual(self.run_raw(b'x' * (32 * 1024 * 1024 + 1)), (1, '{"code":"request_too_large","status":"refused"}'))

    def test_an_item_nested_too_deeply_to_parse_fails_only_itself(self):
        # BI-01b (QA follow-up 4 of PR #68): such an item used to make the whole batch unreadable (every item unavailable).
        deep = '{"action":"calculate","request":{"kind":"natural_gas","input":' + '[' * 200000 + ']' * 200000 + '}}'
        ok1 = {'action': 'calculate', 'request': {'kind': 'natural_gas', 'input': {'period': P, 'quantity': '1', 'unit': 'MMBtu'}}}
        ok2 = {'action': 'calculate', 'input': {'period': P, 'quantity': '1000', 'unit': 'kWh', 'zip': '94105', 'subregion': 'CAMX'}}
        for engine, good, error in (('scope1', ok1, '{"status":"error","code":"scope1_engine_unavailable"}'), ('scope2', ok2, '{"status":"error","code":"scope2_engine_unavailable"}')):
            # Per record, the deep item fails with the engine's own error line (exit 2); the good item answers.
            run = subprocess.run([sys.executable, str(HERE / f'{engine}_engine.py')], input=deep.encode(), capture_output=True, timeout=60)
            self.assertEqual((run.returncode, run.stdout.decode().strip()), (2, error))
            expected = per_record(engine, good)[1].strip()
            envelope = '{"action":"calculate_many","engine":"%s","items":[%s,%s,%s,"x,]}[",%s]}' % (engine, json.dumps(good, separators=(',', ':')), deep, json.dumps(good, separators=(',', ':')), json.dumps(good, separators=(',', ':')))
            code, out = self.run_raw(envelope.encode())
            self.assertEqual(code, 0)
            refused_string = '{"code":"invalid_request","status":"refused"}'
            self.assertEqual(out, '{"results":[%s,%s,%s,%s,%s],"status":"ok"}' % (expected, error, expected, refused_string, expected))
        # Outside the bridge's own envelope the fallback refuses rather than guesses.
        code, out = self.run_raw(('{"engine":"scope1","action":"calculate_many","items":[' + deep + ']}').encode())
        self.assertEqual((code, out), (1, '{"code":"invalid_request","status":"refused"}'))

    def test_the_engine_is_read_from_source_and_writes_no_bytecode(self):
        before = set(HERE.glob('__pycache__/*engine*'))
        code, _ = self.run_raw(json.dumps({'action': 'calculate_many', 'engine': 'scope2', 'items': [{'action': 'calculate', 'input': {}}]}).encode())
        self.assertEqual(code, 0)
        self.assertEqual(set(HERE.glob('__pycache__/*engine*')), before)


if __name__ == '__main__':
    unittest.main()
