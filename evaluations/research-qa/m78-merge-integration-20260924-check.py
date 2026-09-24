"""Independent read-only checks of the integrated records; no provider calls."""
import hashlib
import json
import sys
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OPS = ROOT / 'operations/agent-improvement'

def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))

def rows(path):
    return [json.loads(line) for line in path.read_text(encoding='utf-8-sig').splitlines() if line]

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

manifest_path = Path(sys.argv[1])
manifest = read(manifest_path)
pins = manifest['files']
assert len({p['path'] for p in pins}) == len(pins)
for pin in pins:
    assert sha(ROOT / pin['path']) == pin['sha256'], pin['path']

# Frozen native reviews remain immutable and their embedded bytes remain bound.
snapshot_entries = 0
for name in ('OPS-METRICS-01', 'OPS-PILOT-01', 'OPS-METRICS-QA-01'):
    run = read(OPS / 'runs' / (name + '.json'))
    assert run['review']['independent'] and run['review']['verdict'] == 'pass'
    for pin in run['review']['reviewed_artifacts']:
        assert sha(ROOT / pin['path']) == pin['sha256']
        for entry in read(ROOT / pin['path'])['files']:
            assert hashlib.sha256(entry['text'].encode('utf-8')).hexdigest() == entry['sha256']
            snapshot_entries += 1
    if name != 'OPS-METRICS-QA-01':
        assert run['outcome']['first_review'] == 'fail'

original = rows(OPS / 'build-feature-events.jsonl')
active = rows(OPS / 'build-feature-events-v1.jsonl')
assert (OPS / 'build-feature-events.jsonl').read_bytes() == (OPS / 'snapshots/OPS-METRICS-EVENTS-PRE-INDEPENDENCE.jsonl').read_bytes()
by_id = {r['event_id']: r for r in active}
for old in original:
    new = dict(by_id[old['event_id']])
    if 'independent' not in old:
        new.pop('independent', None)
    assert old == new, old['event_id']

ledger = rows(OPS / 'build-pilot-ledger.jsonl')
output = read(OPS / 'build-pilot-output/OPS-PILOT-01-A.json')
summary = read(OPS / 'build-pilot-output/OPS-PILOT-01-A-summary.json')
usage = rows(OPS / 'build-usage-events.jsonl')
reservations = ledger[0]['reservations']
settled = {r['request_id']: r for r in ledger[1:]}
assert len(ledger) == 7 and ledger[0]['event'] == 'reserve_batch'
assert len(reservations) == len(settled) == len(output['requests']) == 6
assert len({r['receipt']['response_id'] for r in settled.values()}) == 6
assert {r['request_id'] for r in reservations} == set(settled)
assert len(usage) == 12
usage_settled = {r['call_id']: r for r in usage if r['event_type'] == 'settlement'}
usage_reserved = {r['call_id']: r for r in usage if r['event_type'] == 'reservation'}
assert set(usage_settled) == set(usage_reserved) == set(settled)
for request in output['requests']:
    call = request['request_id']
    receipt = request['receipt']
    assert request['status'] == 'settled' and request['finish_reason'] == 'stop'
    assert receipt == settled[call]['receipt']
    assert request['model'] == receipt['response_model'] == usage_settled[call]['actual_model']
    assert receipt['response_id'] == usage_reserved[call]['generation_id']
    assert Decimal(receipt['cost_usd']) == Decimal(settled[call]['charge_usd']) == Decimal(usage_settled[call]['actual_usd'])
    assert receipt['prompt_tokens'] == usage_settled[call]['tokens']['input']
    assert receipt['completion_tokens'] == usage_settled[call]['tokens']['output']
total = sum(Decimal(r['charge_usd']) for r in settled.values())
assert total == Decimal('0.0631382848') == Decimal(summary['total_api_usd'])
assert Decimal('5') - total == Decimal(output['remaining_exposure_capacity_usd'])
assert sha(OPS / 'build-pilot-output/OPS-PILOT-01-A.json') == summary['output_sha256']
assert sum(r['output_status'] == 'reviewable' for r in output['requests']) == 1
for model in output['models']:
    requests = [r for r in output['requests'] if r['model'] == model]
    assert {r['case_id'] for r in requests} == {'PILOT-DECIMAL-01', 'PILOT-TENANT-01', 'PILOT-QA-01'}
    observed = summary['models'][model]
    assert sum(Decimal(r['receipt']['cost_usd']) for r in requests) == Decimal(observed['provider_reported_cost_usd'])
    assert sum(r['receipt']['prompt_tokens'] for r in requests) == observed['input_tokens']
    assert sum(r['receipt']['completion_tokens'] for r in requests) == observed['output_tokens']

# Reproduce the published scorecard in memory, leaving all inputs untouched.
sys.path.insert(0, str(ROOT / 'tools'))
import feature_metrics
features, events, _, reserved, settlements = feature_metrics.load_inputs(OPS / 'build-feature-registry.json', OPS / 'build-feature-events-v1.jsonl', OPS / 'build-usage-events.jsonl')
cards = feature_metrics.build_scorecards(features, events, reserved, settlements, feature_metrics.load_runs(OPS / 'runs', features))
assert cards == read(OPS / 'build-scorecard.json')
reviews = read(OPS / 'model-performance-reviews.json')
routes = {r['id']: r for r in read(OPS / 'roles.json')['roles']}
for role in reviews['roles']:
    assert role['default'] == routes[role['role']]['default']
    assert role['critical'] == routes[role['role']]['critical']
assert all(c['decision'] == 'restricted' for c in reviews['candidates'])
assert reviews['continuous_monitor_running'] is False

receipts = {
    'evaluations/research-qa/m78-readonly-recovery2-actual-independent-result.json': 'eaa2f3e35e3e7b939a15aa9122fdddfea19625eefc484d305ecce656d4491bd1',
    'evaluations/research-qa/m78-recovery2-restart-actual-independent-result.json': '70211489',
    'evaluations/research-qa/m78-readonly-revisit2-actual-independent-result.json': '76b481e6b740fa1cee629d90964c13cedd8aef7e46b4a00e9b168fafcec12922',
}
for path, expected in receipts.items():
    assert sha(ROOT / path).startswith(expected)
    assert read(ROOT / path)['materialFindingsOpen'] == 0
recovery, restart, revisit = [read(ROOT / p) for p in receipts]
assert restart['recoveryResultSha256'] == sha(ROOT / next(iter(receipts)))
assert restart['exactlyOneStartup'] and restart['originalAdmissionHelperPinsPreserved']
for receipt in (recovery, revisit):
    assert receipt['requests'] == 97 and receipt['applicationPostRequests'] == 0
    assert receipt['allCreatedAuthSessionsClosed'] and receipt['unknownAuthSessions'] == 0
    assert (receipt['addedTypedRecords'], receipt['sourceUnion'], receipt['reports'], receipt['grossKgCo2eExact']) == (37, 10, 5, '126850.17632025')
assert revisit['retainedStateExact'] and revisit['predecessorLocksUnchanged']
assert not revisit['furtherRestartAuthorized'] and not revisit['furtherRevisitAuthorized']
closure = read(ROOT / 'evaluations/research-qa/m78-readonly-revisit2-actual-root-closure.json')
assert closure['syntheticFunctionalAccepted'] and not closure['customerScope1Complete']
print(json.dumps({'status': 'pass', 'manifest_files': len(pins), 'native_snapshot_entries': snapshot_entries, 'preserved_original_events': len(original), 'active_events': len(active), 'settled_unique_calls': 6, 'provider_reported_usd': str(total), 'scorecard_reproduced': True, 'm78_public_receipt_chain': 'pass', 'scope': 'Exact local integration and dated public receipts only; no provider actions or fresh remote checks.'}, indent=2))
