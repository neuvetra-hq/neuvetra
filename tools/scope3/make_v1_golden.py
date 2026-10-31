"""Builds the Scope 3 v1 byte-identity golden (DESIGN A1, section 8.2; Scope 3 completion I-01).

Runs the BASE Scope 3 engine (engine 969027f6..., register 5a534d33...) over:
- the exhaustive existing-kind request set of the base engine's own test (`ContextIndependence.requests`: every waste
  material x treatment x unit, every transport vehicle x load basis x unit, every travel and commuting mode x unit, air
  segments, and td_losses for every single-subregion ZIP), each with ordinary, smallest, longest and maximum quantities;
- every Scope 3 engine input of the r3 three-company pack, taken from the `result.input` echoed in the captured
  `/results/scope3` responses passed with --r3-results (37 inputs from the package 3 r2 end-to-end run);
- the engine's own non-complete and refusal cases (input_needed, review_required, each refusal code, one input the base
  engine cannot process at all, recorded as an error),
and writes each result with `engineSha256` and `resultSha256` removed (the only two fields a changed engine may change),
plus the base aggregate of each r3 company's results with `engineSha256` and `aggregateSha256` removed.

Read only: run it with `python3 -B` so the base tree gets no bytecode files. The base engine's SHA-256 is checked before
anything is written. The output has one case per line so a diff shows exactly which case moved.

  python3 -B tools/scope3/make_v1_golden.py --base-calculation-dir $S/bc/apps/site-api/src/calculation \
      --r3-results $S/e2e-p3r2/C1-results-scope3.json $S/e2e-p3r2/C2-results-scope3.json $S/e2e-p3r2/C3-results-scope3.json \
      --out apps/site-api/src/calculation/testdata/scope3-v1-golden.json
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

BASE_ENGINE_SHA256 = '969027f64f16f6bf347e51daf51b4c01034594209dc552810860c98471139e98'
BASE_REGISTER_SHA256 = '5a534d33e70f7eb83bd8b0870da4cd8530e1d3429b3cb7e610b7941abce354f2'
PROFILE = 'neuvetra.scope3-v1-golden.v1'
RESULT_REMOVED = ('engineSha256', 'resultSha256')
AGGREGATE_REMOVED = ('engineSha256', 'aggregateSha256')
P = {'start': '2025-01-01', 'endExclusive': '2026-01-01'}


def canonical(v) -> str:
    return json.dumps(v, ensure_ascii=False, sort_keys=True, separators=(',', ':'))


def extra_requests() -> list[dict]:
    """Non-complete results and refusals, from the base engine's own tests (scope3_engine_test.py)."""
    td = lambda **kw: {'kind': 'td_losses', 'input': dict({'period': P, 'zip': '94105'}, **kw)}
    tr = lambda **kw: {'kind': 'transport', 'input': dict({'period': P, 'thirdPartyFacilities': 'none'}, **kw)}
    wa = lambda **kw: {'kind': 'waste', 'input': dict({'period': P}, **kw)}
    bt = lambda **kw: {'kind': 'business_travel', 'input': dict({'period': P}, **kw)}
    ec = lambda **kw: {'kind': 'employee_commuting', 'input': dict({'period': P}, **kw)}
    rail = dict(category=9, vehicle='rail', loadBasis='shared_vehicle', activity={'value': '100', 'unit': 'short ton-mile'})
    return [
        # non-complete results (status input_needed / review_required)
        td(quantity='1', unit='MWh', subregion='ERCT'),
        td(quantity='1', unit='MWh', subregion='RFCE', zip='07401'),
        td(quantity='1', unit='MWh', subregion='RFCE', zip='07401', utilityEiaId='15477'),
        td(quantity='1', unit='MWh', subregion='RFCE', zip='07401', utilityEiaId='16213'),
        td(quantity='1', unit='MWh', subregion='CAMX', zip='00000'),
        td(quantity='1', unit='MWh', subregion='PRMS', zip='00901'),
        wa(category=5, material='mixed_msw', treatment='recycled', quantity='1', unit='short_ton'),
        tr(**dict(rail, thirdPartyFacilities='present_not_included')),
        tr(**dict(rail, thirdPartyFacilities='unknown')),
        bt(mode='air_medium_haul', activity={'value': '10000', 'unit': 'passenger-mile'}, haulBasis='Agency report FY2025'),
        bt(mode='air', segmentDistance={'value': '2475', 'unit': 'mile'}, passengerSegments=2),
        bt(mode='air', segmentDistance={'value': '482.803', 'unit': 'km'}, passengerSegments=3),
        bt(mode='air', segmentDistance={'value': '482.804', 'unit': 'km'}, passengerSegments=3),
        wa(category=12, material='asphalt_concrete', treatment='recycled', quantity='17.125', unit='metric_ton'),
        wa(category=5, material='mixed_msw', treatment='landfilled', quantity='0', unit='short_ton'),
        # refusals
        td(quantity='1', unit='therm', subregion='CAMX'), td(quantity='1', unit='kWh', subregion='XXXX'),
        td(quantity='1.2345', unit='kWh', subregion='CAMX'), td(quantity='1', unit='kWh', subregion='CAMX', zip='9410'),
        td(quantity='1', unit='kWh', subregion='CAMX', utilityEiaId=16612), td(quantity='1', unit='kWh', subregion='CAMX', instruments=[]),
        {'kind': 'td_losses', 'input': {'period': P, 'quantity': '1', 'unit': 'kWh', 'subregion': 'CAMX'}},
        tr(category=5, vehicle='rail', loadBasis='shared_vehicle', activity={'value': '1', 'unit': 'short ton-mile'}),
        tr(category=True, vehicle='rail', loadBasis='shared_vehicle', activity={'value': '1', 'unit': 'short ton-mile'}),
        tr(category=4, vehicle='rail', loadBasis='dedicated_vehicle', activity={'value': '1', 'unit': 'vehicle-mile'}),
        tr(category=4, vehicle='passenger_car', loadBasis='shared_vehicle', activity={'value': '1', 'unit': 'short ton-mile'}),
        tr(category=4, vehicle='rail', loadBasis='shared_vehicle', activity={'value': '1', 'unit': 'vehicle-mile'}),
        tr(category=4, vehicle='barge', loadBasis='shared_vehicle', activity={'value': '1', 'unit': 'short ton-mile'}),
        tr(category=4, vehicle='rail', loadBasis='unknown', activity={'value': '1', 'unit': 'short ton-mile'}),
        tr(**dict(rail, thirdPartyFacilities=None)), tr(**dict(rail, thirdPartyFacilities=True)), tr(**dict(rail, thirdPartyFacilities='maybe')),
        {'kind': 'transport', 'input': dict(period=P, **rail)},
        wa(category=6, material='mixed_msw', treatment='landfilled', quantity='1', unit='short_ton'),
        wa(category=5, material='plutonium', treatment='landfilled', quantity='1', unit='short_ton'),
        wa(category=5, material='mixed_msw', treatment='buried', quantity='1', unit='short_ton'),
        wa(category=5, material='mixed_msw', treatment='landfilled', quantity='1', unit='cubic_yard'),
        wa(category=5, material='mixed_msw', treatment='landfilled', quantity='', unit='short_ton'),
        wa(category=5, material='mixed_msw', treatment='landfilled', quantity='1', unit='short_ton', period={'start': '2025-02-29', 'endExclusive': '2025-03-01'}),
        bt(mode='air_medium_haul', activity={'value': '1', 'unit': 'passenger-mile'}),
        bt(mode='air_medium_haul', activity={'value': '1', 'unit': 'passenger-mile'}, haulBasis=' '),
        bt(mode='air', segmentDistance={'value': '0', 'unit': 'mile'}, passengerSegments=1),
        bt(mode='air', segmentDistance={'value': '10', 'unit': 'mile'}, passengerSegments=0),
        bt(mode='air', segmentDistance={'value': '10', 'unit': 'mile'}, passengerSegments=True),
        bt(mode='bus', activity={'value': '1', 'unit': 'vehicle-mile'}),
        bt(mode='bus', activity={'value': '1', 'unit': 'passenger-mile'}, period={'start': '2025-02-29', 'endExclusive': '2025-03-01'}),
        ec(mode='air', activity={'value': '1', 'unit': 'passenger-mile'}), ec(mode='air_short_haul', activity={'value': '1', 'unit': 'passenger-mile'}),
        ec(mode='bus', activity={'value': '1', 'unit': 'passenger-mile'}, period={'start': '2026-01-01', 'endExclusive': '2026-02-01'}),
        {'kind': 'hotel', 'input': {}}, {'kind': 'waste', 'input': []}, {'kind': 'waste'}, {'kind': 7, 'input': {}},
        # the base engine cannot process this input at all (unhashable unit): an error, never a figure
        tr(category=4, vehicle='passenger_car', loadBasis='dedicated_vehicle', activity={'value': '1', 'unit': []}),
    ]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--base-calculation-dir', required=True, type=Path)
    ap.add_argument('--r3-results', nargs='+', required=True, type=Path)
    ap.add_argument('--out', required=True, type=Path)
    args = ap.parse_args()
    base = args.base_calculation_dir.resolve()
    if hashlib.sha256((base / 'scope3_engine.py').read_bytes()).hexdigest() != BASE_ENGINE_SHA256:
        raise SystemExit('the base engine is not 969027f6')
    sys.dont_write_bytecode = True
    sys.path.insert(0, str(base))
    import scope3_engine as e  # noqa: E402  (the base engine)
    import scope3_engine_test as t  # noqa: E402  (its exhaustive request generator)
    assert Path(e.__file__).resolve().parent == base and Path(t.__file__).resolve().parent == base
    assert e.engine_sha256() == BASE_ENGINE_SHA256 and e.REGISTER_SHA256 == BASE_REGISTER_SHA256

    exhaustive = list(t.ContextIndependence().requests())
    r3: list[dict] = []
    companies: list[dict] = []
    for path in args.r3_results:
        response = json.loads(path.read_text('utf-8'))
        mine = [{'kind': row['kind'], 'input': row['result']['input']} for row in response['records'] if row.get('result')]
        for row in response['records']:
            if row.get('result') and row['result']['engineSha256'] != BASE_ENGINE_SHA256:
                raise SystemExit('a captured r3 result was not produced by the base engine')
        r3 += mine
        companies.append({'source': path.name, 'requests': mine})
    extra = extra_requests()

    def run(req):
        try:
            res = e.calculate(req)
        except e.Refused as x:
            return {'request': req, 'refused': x.code}
        except Exception:  # the base CLI answers {"status":"error"} for these
            return {'request': req, 'error': 'scope3_engine_unavailable'}
        if canonical(res['input']) != canonical(req['input']):
            raise SystemExit('the base engine did not echo its input')
        return {'kind': req['kind'], 'result': {k: v for k, v in res.items() if k not in RESULT_REMOVED}}

    cases = [dict(run(r), set=s) for s, rs in (('exhaustive', exhaustive), ('r3', r3), ('extra', extra)) for r in rs]
    aggregates = []
    for c in companies:
        results = [e.calculate(r) for r in c['requests']]
        a = e.aggregate(results)
        aggregates.append({'source': c['source'], 'requests': c['requests'], 'aggregate': {k: v for k, v in a.items() if k not in AGGREGATE_REMOVED}})
    counts = {s: sum(1 for c in cases if c['set'] == s) for s in ('exhaustive', 'r3', 'extra')}
    counts.update(ok=sum(1 for c in cases if 'result' in c), refused=sum(1 for c in cases if 'refused' in c), error=sum(1 for c in cases if 'error' in c))
    head = {'profile': PROFILE, 'baseEngineSha256': BASE_ENGINE_SHA256, 'baseRegisterSha256': BASE_REGISTER_SHA256,
            'removedResultKeys': list(RESULT_REMOVED), 'removedAggregateKeys': list(AGGREGATE_REMOVED), 'counts': counts,
            'generator': 'tools/scope3/make_v1_golden.py', 'r3Sources': [p.name for p in args.r3_results]}
    lines = [canonical(head)[:-1] + ',"cases":[']
    lines += [canonical(c) + (',' if i < len(cases) - 1 else '') for i, c in enumerate(cases)]
    lines += ['],"aggregates":[']
    lines += [canonical(a) + (',' if i < len(aggregates) - 1 else '') for i, a in enumerate(aggregates)]
    lines += [']}']
    text = '\n'.join(lines) + '\n'
    json.loads(text)
    args.out.write_bytes(text.encode('utf-8'))
    print(json.dumps(counts), hashlib.sha256(text.encode('utf-8')).hexdigest(), len(text))


if __name__ == '__main__':
    main()
