"""Read-only Candidate4 byte/delta/workflow checks; never installs or connects."""
import hashlib
import json
from pathlib import Path
import yaml

root = Path(__file__).resolve().parents[2]
prefix = 'operations/agent-improvement/snapshots/M80-BETA-ACCESS-IMPLEMENTATION-20260925-CANDIDATE'
sha = lambda b: hashlib.sha256(b).hexdigest()
load = lambda p: json.loads((root / p).read_bytes().decode('utf-8'))
snapshots = {n: load(f'{prefix}{n}.json') for n in (2, 3, 4)}
assert sha((root / f'{prefix}3.json').read_bytes()) == '77aba791a6b48e1306138a1bb62cddb16ee99ab4ee4531802921ffbe07a51f7c'
assert sha((root / f'{prefix}4.json').read_bytes()) == '63bc8ca34e40c62be20d2e068580305d2911c9b6e1c6794799008e0c377f6959'
maps = {n: {f['path']: f for f in s['files']} for n, s in snapshots.items()}
assert set(maps[2]) == set(maps[3]) == set(maps[4])
pins = []
for p, f in maps[4].items():
    raw = (root / p).read_bytes()
    embedded = f['text'].encode('utf-8')
    assert sha(raw) == sha(embedded) == f['sha256'], p
    assert raw == embedded, p
    pins.append({'path': p, 'sha256': sha(raw), 'bytes': len(raw), 'current_embedded_exact': True})
assert len(pins) == 18
changes = {n: [p for p, f in maps[4].items() if f['sha256'] != maps[n][p]['sha256']] for n in (2, 3)}
evidence = 'evaluations/research-qa/m80-beta-access-author-20260925.json'
assert set(changes[3]) == {'.github/workflows/verify.yml', evidence}
assert set(changes[2]) == {'.github/workflows/verify.yml', 'packages/neuvetra-database/src/index.ts', evidence}
assert maps[4][evidence]['sha256'] == 'b94a39f4f570211651a3d39b65ca16615e446f78566aa6b5de87c14b7de0f675'
assert maps[4]['packages/neuvetra-database/src/index.ts']['sha256'] == '7f7a96f2fd015ee11a94ed56d5948745f6743c82ac0ba21aa5d06a74e629ad53'
old = yaml.safe_load(maps[3]['.github/workflows/verify.yml']['text'])
new = yaml.safe_load(maps[4]['.github/workflows/verify.yml']['text'])
steps = new['jobs']['native-postgres']['steps']
idx = next(i for i, s in enumerate(steps) if s.get('name') == 'Select PostgreSQL 17 backup and restore clients for beta access')
script = steps[idx]['run']
old_script = old['jobs']['native-postgres']['steps'][idx]['run']
assert script.endswith(old_script)
copy = yaml.safe_load(maps[4]['.github/workflows/verify.yml']['text'])
copy['jobs']['native-postgres']['steps'][idx]['run'] = old_script
assert copy == old, 'Any workflow change outside package provisioning is forbidden'
ordered = ['. /etc/os-release', 'test -n "${VERSION_CODENAME:-}"', 'sudo install -d /usr/share/postgresql-common/pgdg', 'sudo curl --fail', 'https://www.postgresql.org/media/keys/ACCC4CF8.asc', 'signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc', 'https://apt.postgresql.org/pub/repos/apt ${VERSION_CODENAME}-pgdg main', 'sudo apt-get update', 'sudo apt-get install --yes postgresql-client-17', '>> "$GITHUB_PATH"', '/usr/lib/postgresql/17/bin/pg_dump --version', '/usr/lib/postgresql/17/bin/pg_restore --version']
positions = [script.index(s) for s in ordered]
assert positions == sorted(positions)
assert 'trusted=yes' not in script and '--allow-unauthenticated' not in script
assert "^pg_dump \\(PostgreSQL\\) 17\\." in script
assert "^pg_restore \\(PostgreSQL\\) 17\\." in script
native = steps[idx + 1]
assert 'apps/site-api/src/beta-access/postgres.test.ts' in native['run']
assert native['env']['M80_BETA_ACCESS_NATIVE'] == 'enabled'
assert 'if' not in native and 'continue-on-error' not in native
assert new['jobs']['native-postgres']['services']['beta-postgres']['image'] == 'postgres:17'
p = 'tools/beta-access/local-rehearsal.ts'
c3_embedded = maps[3][p]['text'].encode('utf-8')
assert sha(c3_embedded) == maps[3][p]['sha256']
result = {'candidate': 4, 'exact_current_embedded_files': pins, 'changed_declared_files_from_candidate3': changes[3], 'changed_declared_files_from_candidate2': changes[2], 'yaml_parsed': True, 'workflow_only_adds_signed_pgdg_provisioning': True, 'checks': ['actual Ubuntu codename required', 'official HTTPS key and repository with scoped Signed-By', 'repository created before apt update/install', 'client17 PATH and both major17 guards retained', 'unchanged next native step and real restore harness', 'server17 retained', 'all runtime SQL listener bytes preserved from C2', 'shared index preserves reviewed pre-access hash'], 'candidate3_embedding_correction': {'path': p, 'declared_current_sha256': maps[3][p]['sha256'], 'candidate3_embedded_sha256': sha(c3_embedded), 'candidate4_embedded_sha256': sha(maps[4][p]['text'].encode('utf-8')), 'candidate3_bytes': len(c3_embedded), 'candidate4_bytes': len(maps[4][p]['text'].encode('utf-8'))}, 'new_native_or_package_execution': False, 'remote_ci_execution': False}
out = root / 'evaluations/research-qa/m80-beta-access-independent-20260925-review4-checks.json'
with out.open('x', encoding='utf-8', newline='\n') as f:
    json.dump(result, f, indent=2)
    f.write('\n')
print(json.dumps({'exact_files': len(pins), 'source_delta': '.github/workflows/verify.yml only versus C3', 'checks_sha256': sha(out.read_bytes()), 'result': 'pass'}))
