"""Read-only verification of the publication representation supplement; no result writes."""
from pathlib import Path
import hashlib,json

ROOT=Path(__file__).resolve().parents[2]
H=lambda b:hashlib.sha256(b).hexdigest()
SUPPLEMENT='operations/agent-improvement/snapshots/M78-PUBLICATION-BYTE-REPRESENTATION-SUPPLEMENT-01.json'
EXPECTED='b4c541e82996dd76694d22de64966061407dd174e82bab4369028212b8063cf7'
EXPECTED_PAIRS={
 ('M78-INTERRUPTED-SESSION-CLEANUP-SOURCE-01-CANDIDATE2.json','m78-private-interrupted-session-cleanup.ps1'),
 ('M78-INTERRUPTED-SESSION-CLEANUP-SOURCE-01-CANDIDATE2.json','m78-interrupted-session-cleanup-v2.ts'),
 ('M78-INTERRUPTED-SESSION-CLEANUP-SOURCE-01-CANDIDATE2.json','m78-private-interrupted-session-cleanup-v2.ps1'),
 ('M78-INTERRUPTED-SESSION-CLEANUP-V3-REVIEW-01-CANDIDATE1.json','m78-interrupted-session-cleanup-v3.ts'),
 ('M78-INTERRUPTED-SESSION-CLEANUP-V3-REVIEW-01-CANDIDATE1.json','m78-private-interrupted-session-cleanup-v3.ps1'),
 ('M78-INTERRUPTED-SESSION-OBSERVER-01-CANDIDATE1.json','m78-private-interrupted-session-observe.ps1'),
 ('M78-INTERRUPTED-SESSION-POSTOBSERVER-01-CANDIDATE1.json','m78-interrupted-session-postobserve.ts'),
 ('M78-INTERRUPTED-SESSION-POSTOBSERVER-01-CANDIDATE1.json','m78-private-interrupted-session-postobserve.ps1'),
 ('M78-PLATFORM-INTERRUPTION-REVIEW-01-CANDIDATE1.json','m78-platform-resume-observation.json'),
 ('M78-SESSION-CLEANUP-DIAGNOSTIC-REVIEW-01-CANDIDATE1.json','m78-private-session-cleanup-diagnose.ps1'),
}
raw=(ROOT/SUPPLEMENT).read_bytes();assert H(raw)==EXPECTED
d=json.loads(raw);assert len(d['files'])==10
pairs={(Path(e['original_snapshot']['path']).name,Path(e['path']).name)for e in d['files']};assert pairs==EXPECTED_PAIRS
historical={};entries=[]
for e in d['files']:
 p=e['original_snapshot'];prior_bytes=(ROOT/p['path']).read_bytes();assert H(prior_bytes)==p['sha256'];historical[p['path']]=p['sha256']
 prior=json.loads(prior_bytes);found=[x for x in prior['files']if x['path']==e['path']];assert len(found)==1;old=found[0]
 current=(ROOT/e['path']).read_bytes();embedded=e['text'].encode('utf-8');old_bytes=old['text'].encode('utf-8')
 assert e['sha256']==old['sha256']==H(current)==H(embedded)
 assert embedded==current and b'\r\n'in embedded
 assert old_bytes!=embedded and old_bytes==embedded.replace(b'\r\n',b'\n')
 entries.append({'path':e['path'],'sha256':e['sha256'],'originalSnapshot':p,'crlfCount':embedded.count(b'\r\n'),'onlyRepresentationChanged':True})
assert len(historical)==6
run_pins={}
for path in (ROOT/'operations/agent-improvement/runs').glob('M78-*.json'):
 run=json.loads(path.read_bytes())
 for a in run.get('artifacts',[]):run_pins.setdefault(a['path'],set()).add(a['sha256'])
for path,digest in historical.items():assert digest in run_pins[path]
locator_run=ROOT/'operations/agent-improvement/runs/M78-INTERRUPTED-SESSION-ACTUAL-DISPOSITION-01.json'
run=json.loads(locator_run.read_bytes());criterion=next(c for c in run['criteria']if c['id']=='ACTUAL-SCOPED-DISPOSITION')
assert '.superpowers/m78-continuation3-cleanup-disposition.json'not in criterion['evidence']
disposition_snapshot='operations/agent-improvement/snapshots/M78-INTERRUPTED-SESSION-ACTUAL-DISPOSITION-01-CANDIDATE1.json'
assert disposition_snapshot in criterion['evidence']
assert H((ROOT/disposition_snapshot).read_bytes())=='7f12eb25e1cd33767e1228e788e2b502b271d1adfe85aa5b033d790e40a89157'
print(json.dumps({'status':'m78_publication_byte_representation_independently_passed','reviewerId':'/root/m78_cont3_review','supplement':{'path':SUPPLEMENT,'sha256':EXPECTED},'entriesVerified':len(entries),'originalSnapshotsPreserved':historical,'entries':entries,'originalFailurePreserved':True,'privateDispositionLocatorRepaired':True,'sourceOrExecutionChange':False,'hostedAcceptance':False},indent=2))
