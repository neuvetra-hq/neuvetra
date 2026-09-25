import json,subprocess,time
from pathlib import Path
child='evaluations/research-qa/m80-executor-independent-20260924-candidate9-process-child.ts'
scenarios=['migration_success_execute','admission_success_execute','deployment_success_execute','migration_pending','migration_crash_observation','migration_crash_outcome','deployment_live_success','admission_pending','admission_gate_mismatch','deployment_gate_mismatch','migration_live_execute','admission_live_execute','deployment_live_execute','admission_live_reconcile','deployment_reject_receipt','deployment_reject_target','deployment_reject_provider_id','deployment_reject_commit','deployment_reject_readiness','deployment_reject_provider_status']
cases=[]
for name in scenarios:
 d=Path('evaluations/research-qa')/('m80-executor-independent-20260924-process-c9-'+name+'-'+str(time.time_ns()));d.mkdir();results=[]
 phases=['execute'] if name.endswith(('gate_mismatch','live_execute','success_execute')) else ['execute','reconcile']
 for phase in phases:
  childrun=subprocess.run(['bun','run',child,name,phase,d.as_posix()],capture_output=True,text=True)
  r=json.loads((d/(phase+'.json')).read_bytes());results.append(r)
  assert childrun.returncode==0,(name,phase,childrun.stderr)
  assert r['events'][-1]['event']=='db-close',name
  events=r['events'];mutations=[e for e in events if e['event'].endswith('-mutation')]
  if phase=='reconcile':
   assert not mutations,(name,'replay')
   assert not any(e['event']=='schema21-preflight' for e in events),(name,'schema21')
   if 'reject_' in name or name=='admission_live_reconcile':assert r['outcomeStatus']!='verified_success',name
   else:assert r['outcomeStatus']=='verified_success',(name,r)
  if name.endswith(('gate_mismatch','live_execute')):
   assert not mutations and not any(e['event']=='write-start' for e in events),(name,'preflight journal')
  for i,e in enumerate(events):
   if e['event'].endswith('-mutation'):
    assert any(x['event']=='closed-file' and x.get('path','').endswith('-attempt.json') for x in events[:i]),(name,'attempt not closed')
   if e['event']=='provider-observe' and phase=='execute':assert any(x['event']=='closed-file' and x.get('path','').endswith('-deployment-ack.json') for x in events[:i]),(name,'ack not closed')
 if name=='deployment_live_success':assert results[0]['applicationStateSha256']!=results[1]['applicationStateSha256'],'content not changed'
 cases.append({'scenario':name,'directory':d.as_posix(),'results':results})
out={'boundary':'Actual separate Bun processes executing exact frozen private entry extracted with injected synthetic DB/provider; actual filesystem wx/write/sync/close; no network/credentials. Deployment reconciliation runs with one live runtime session and content recapture forbidden.','durable_order_asserted':True,'cases':cases}
p=Path('evaluations/research-qa/m80-executor-independent-20260924-candidate9-process.json');p.write_bytes((json.dumps(out,indent=2)+'\n').encode());print(json.dumps({'scenarios':len(cases),'processes':sum(len(c['results']) for c in cases),'pass':True}))
