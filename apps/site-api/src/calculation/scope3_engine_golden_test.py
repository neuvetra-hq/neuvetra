"""Byte-identity golden for the existing Scope 3 kinds (DESIGN A1, section 8.2; Scope 3 completion I-01).

`testdata/scope3-v1-golden.json` was produced by `tools/scope3/make_v1_golden.py` from the BASE engine (969027f6...)
before the I-01 refactor: the base engine's exhaustive existing-kind request set, every r3 Scope 3 input and the
engine's own non-complete and refusal cases. For every case this engine must return the same canonical JSON with only
`engineSha256` and `resultSha256` removed, refuse with the same code, or fail the same way; and the existing aggregate
keys of each r3 company must be unchanged (only `engineSha256` and `aggregateSha256` may differ, and new keys may be
added). The test must pass on the base engine and on every later engine.

Run on another engine directory (for example the base tree) by putting it first on the module path:
  cd /tmp && PYTHONPATH=<engine dir>:<this dir> python3 -B -m unittest scope3_engine_golden_test
"""
import json
import unittest
from pathlib import Path

import scope3_engine as e

HERE = Path(__file__).resolve().parent
GOLDEN = json.loads((HERE / 'testdata' / 'scope3-v1-golden.json').read_text('utf-8'))
BASE_ENGINE_SHA256 = '969027f64f16f6bf347e51daf51b4c01034594209dc552810860c98471139e98'


# Round 2, owner decision 1 (ROUND2.md): the envelope is 2025-01-01 to 2027-01-01. The one golden case the base engine refused
# for its 2026 period now calculates; it must equal the same request in the matching 2025 month except for its period, its
# input hash and the factor-vintage disclosure. Nothing else in the golden may change.
DECISION_1_CASE = {'kind': 'employee_commuting', 'input': {'activity': {'unit': 'passenger-mile', 'value': '1'}, 'mode': 'bus',
                                                           'period': {'endExclusive': '2026-02-01', 'start': '2026-01-01'}}}


def decision_1_matches(got: dict) -> bool:
    if 'result' not in got:
        return False
    r = got['result']
    twin = e.calculate(dict(DECISION_1_CASE, input=dict(DECISION_1_CASE['input'], period={'start': '2025-01-01', 'endExclusive': '2025-02-01'})))
    strip = lambda x: {k: v for k, v in x.items() if k not in ('engineSha256', 'resultSha256', 'input', 'inputSha256', 'boundary')}
    return (r['status'] == 'complete' and e.canonical(strip(r)) == e.canonical(strip(twin))
            and r['boundary']['notes'] == sorted(twin['boundary']['notes'] + ['factor_vintage_precedes_period']))


def outcome(request: dict) -> dict:
    try:
        result = e.calculate(request)
    except e.Refused as x:
        return {'refused': x.code}
    except Exception:  # noqa: BLE001 - the CLI answers {"status":"error"}; never a figure
        return {'error': 'scope3_engine_unavailable'}
    return {'result': result}


class GoldenByteIdentity(unittest.TestCase):
    def test_golden_was_made_by_the_base_engine(self):
        self.assertEqual((GOLDEN['profile'], GOLDEN['baseEngineSha256'], GOLDEN['removedResultKeys']),
                         ('neuvetra.scope3-v1-golden.v1', BASE_ENGINE_SHA256, ['engineSha256', 'resultSha256']))
        self.assertEqual(GOLDEN['counts'], {'exhaustive': 6320, 'r3': 37, 'extra': 54, 'ok': 6372, 'refused': 38, 'error': 1})
        self.assertEqual(len(GOLDEN['cases']), 6411)
        self.assertEqual({a['source'] for a in GOLDEN['aggregates']}, {'C1-results-scope3.json', 'C2-results-scope3.json', 'C3-results-scope3.json'})

    def test_every_existing_kind_result_is_byte_identical_except_the_two_hash_fields(self):
        sha = e.engine_sha256()
        mismatches = []
        for case in GOLDEN['cases']:
            request = case['request'] if 'request' in case else {'kind': case['kind'], 'input': case['result']['input']}
            got = outcome(request)
            if e.canonical(request) == e.canonical(DECISION_1_CASE):
                self.assertEqual(case.get('refused'), 'period_outside_2025_method_envelope')  # what the base engine did
                if not decision_1_matches(got):
                    mismatches.append((request, got))
                continue
            if 'result' in case:
                if 'result' not in got:
                    mismatches.append((request, got))
                    continue
                r = got['result']
                body = {k: v for k, v in r.items() if k not in ('engineSha256', 'resultSha256')}
                if e.canonical(body) != e.canonical(case['result']):
                    mismatches.append((request, 'result bytes differ'))
                # The two fields that may change are this engine's own and still self-consistent.
                self.assertEqual(r['engineSha256'], sha)
                self.assertEqual(r['resultSha256'], e.digest({k: v for k, v in r.items() if k != 'resultSha256'}))
            elif 'refused' in case:
                if got != {'refused': case['refused']}:
                    mismatches.append((request, got))
            else:
                if 'result' in got:
                    mismatches.append((request, 'a figure where the base engine failed'))
        self.assertEqual(mismatches[:5], [])
        self.assertEqual(len(mismatches), 0)

    def test_existing_aggregate_keys_are_unchanged_for_each_r3_company(self):
        def mapped(v, to_base):
            if isinstance(v, dict):
                return {k: mapped(x, to_base) for k, x in v.items()}
            if isinstance(v, list):
                return [mapped(x, to_base) for x in v]
            return to_base.get(v, v) if isinstance(v, str) else v
        for a in GOLDEN['aggregates']:
            results = [e.calculate(r) for r in a['requests']]
            # The aggregate lists results by resultSha256, which contains the engine hash. Each result's base hash is
            # its own body with the base engine hash (every other byte is the base engine's, as the test above proves).
            to_base = {r['resultSha256']: e.digest(dict({k: v for k, v in r.items() if k != 'resultSha256'}, engineSha256=BASE_ENGINE_SHA256)) for r in results}
            agg = e.aggregate(results)
            self.assertTrue(set(a['aggregate']).issubset(agg), a['source'])
            base_view = mapped({k: agg[k] for k in a['aggregate']}, to_base)
            base_view['includedResults'] = sorted(base_view['includedResults'])  # the engine lists these sorted by hash
            self.assertEqual(e.canonical(base_view), e.canonical(a['aggregate']), a['source'])
            self.assertEqual(agg['engineSha256'], e.engine_sha256())
            self.assertEqual(agg['aggregateSha256'], e.digest({k: v for k, v in agg.items() if k != 'aggregateSha256'}))


if __name__ == '__main__':
    unittest.main()
