"""Read-only exact publication audit. Does not invoke Git or any network/DB tool."""
from pathlib import Path
import hashlib, json, re, tarfile, subprocess

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / '.superpowers/m80-normalized-upgrade-publication-manifest.json'
OUT = ROOT / 'evaluations/research-qa/m80-normalized-upgrade-publication-independent-20260925-checks.json'
def sha(b): return hashlib.sha256(b).hexdigest()
m = json.loads(MANIFEST.read_bytes())
base = ROOT / '.superpowers/m80-normalized-clean-portability-1790308072941502400'
checkout = base / 'checkout'
paths = [x['path'] for x in m['files']]
assert len(paths) == len(set(paths)) == m['file_count']
assert sum(x['bytes'] for x in m['files']) == m['total_bytes']
bad = []; embedded_bad = []; embedded_count = 0; embedded_historical_current_differences = []
private_criteria = []; crlf = []; privacy_hits = []; credential_candidates = []
owner = json.loads((ROOT / '.superpowers/m80-signedin-manager-observation-20260925-001.json').read_bytes())
private_values = [owner[k] for k in ('companyId','managerUserId','verifiedUserProvidedEmail') if isinstance(owner.get(k),str)]
def walk(obj, container):
    global embedded_count
    if isinstance(obj,dict):
        if isinstance(obj.get('path'),str) and isinstance(obj.get('sha256'),str) and isinstance(obj.get('text'),str):
            embedded_count += 1
            if sha(obj['text'].encode()) != obj['sha256']: embedded_bad.append([container,obj['path']])
            current = ROOT / obj['path']
            if current.is_file() and sha(current.read_bytes()) != obj['sha256']:
                embedded_historical_current_differences.append([container,obj['path']])
        for v in obj.values(): walk(v,container)
    elif isinstance(obj,list):
        for v in obj: walk(v,container)
for x in m['files']:
    p = ROOT / x['path']; b = p.read_bytes()
    assert p.resolve().is_relative_to(ROOT)
    if len(b)!=x['bytes'] or sha(b)!=x['sha256']: bad.append(x['path'])
    if (checkout/x['path']).read_bytes()!=b: bad.append('clean-overlay:'+x['path'])
    if b'\r\n' in b: crlf.append(x['path'])
    s=b.decode('utf8')
    for v in private_values:
        if v in s: privacy_hits.append(x['path'])
    if re.search(r'(?i)(postgres(?:ql)?://[^\s\"\']+:[^\s\"\']+@|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:sb_secret_|sk-proj-)[A-Za-z0-9_-]{15,})',s): credential_candidates.append(x['path'])
    if p.suffix=='.json':
        obj=json.loads(b); walk(obj,x['path'])
        if '/runs/' in x['path']:
            for c in obj.get('criteria',[]):
                for e in c.get('evidence',[]):
                    if e.startswith(('.superpowers/','.tmp/')): private_criteria.append([x['path'],c['id'],e])
with tarfile.open(base/'base.tar') as t:
    original=t.extractfile('.gitattributes').read()
    attrs=(ROOT/'.gitattributes').read_bytes()
    assert attrs.startswith(original)
    additions=attrs[len(original):].decode().splitlines()
    rules=[a for a in additions if a.strip() and not a.startswith('#')]
    expected=[p+' -text whitespace=cr-at-eol' for p in [
        'operations/agent-improvement/snapshots/M80-NORMALIZED-COMPOSER-INTEGRATION-CHECK-20260925-DELIVERABLE.json',
        'operations/agent-improvement/snapshots/M80-NORMALIZED-PREP-CONSUMER-20260925-CANDIDATE1.json',
        'operations/agent-improvement/snapshots/M80-NORMALIZED-PREP-CONSUMER-20260925-CANDIDATE2.json']]
    assert rules==expected
    attr_missing=[p for p in crlf if p+' -text whitespace=cr-at-eol' not in attrs.decode()]
    run_changes={}
    for p in paths:
        if '/runs/' not in p: continue
        try: before=json.loads(t.extractfile(p).read())
        except KeyError: continue
        after=json.loads((ROOT/p).read_bytes())
        run_changes[p]=[k for k in set(before)|set(after) if before.get(k)!=after.get(k)]
proc=subprocess.run(['python','tools/agent_ops.py','validate'],cwd=checkout,capture_output=True,text=True)
result={'manifest':{'path':MANIFEST.relative_to(ROOT).as_posix(),'sha256':sha(MANIFEST.read_bytes())},'file_count':len(paths),'total_bytes':m['total_bytes'],'file_or_overlay_mismatches':bad,'embedded_entries_checked':embedded_count,'embedded_hash_mismatches':embedded_bad,'historical_embedded_current_differences':embedded_historical_current_differences,'private_active_criterion_references':private_criteria,'private_owner_value_hits':privacy_hits,'credential_pattern_candidate_paths':credential_candidates,'crlf_files':crlf,'missing_crlf_exact_rules':attr_missing,'attribute_additions':rules,'existing_run_changed_fields':run_changes,'clean_validation':{'exit_code':proc.returncode,'stdout':proc.stdout,'stderr':proc.stderr},'no_git_provider_credentials_or_db_calls':True}
OUT.write_bytes((json.dumps(result,indent=2)+'\n').encode())
print(json.dumps({k:v for k,v in result.items() if k not in ('crlf_files','historical_embedded_current_differences')},indent=2))
