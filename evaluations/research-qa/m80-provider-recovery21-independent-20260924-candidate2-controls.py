import copy, importlib.util, json, os, subprocess, tempfile, unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
PREFIX = 'm80-provider-recovery21-independent-20260924-candidate2-'
spec = importlib.util.spec_from_file_location('recovery_frozen', Path(__file__).with_name(PREFIX+'frozen.py'))
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
SNAP = json.loads((ROOT/'operations/agent-improvement/snapshots/M80-PROVIDER-RECOVERY21-20260924-CANDIDATE2.json').read_bytes())

def write(path, value):
    path = Path(path); path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes((json.dumps(value, sort_keys=True)+'\n').encode())
    return {'path':path.as_posix(), 'sha256':m.s.digest(path)}

def fixture():
    for a in SNAP['artifacts']:
        p=Path(a['path']);p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(a['text'].encode())
    def review(name, verdict, artifacts):
        pins=[{'path':a['path'],'sha256':a['sha256']} for a in artifacts]
        snap=write(name+'-snapshot.json',{'artifacts':artifacts})
        return write(name+'-review.json',{'reviewer':m.s.REVIEWER,'verdict':verdict,'source_snapshot':snap,'source_pins':pins}),pins
    own,_=review('recovery','pass_m80_recovery_transport_only',SNAP['artifacts'])
    backup=[]
    for path in [m.BRIDGE,'.superpowers/m80-backup-hosted-entry.ts','.superpowers/transitive.ts']:
        p=Path(path);p.write_bytes(b'# mock dependency; never executed\n')
        backup.append({'path':path,'sha256':m.s.digest(p),'text':p.read_text()})
    back,pins=review('backup','pass_m80_backup_transport_only',backup)
    write(m.s.INTENT,{'target':m.s.PRIOR_DEPLOYMENT,'state':'attempt_reserved_no_retry'})
    gate={'profile':'m80.reviewed-schema21-recovery.v1','operator':'/root','created_at':m.s.utc().isoformat(),'helper_sha256':m.s.digest(m.__file__),'commit':m.s.PRIOR_COMMIT,'project':m.s.PROJECT,'environment':m.s.ENVIRONMENT,'service':m.s.SERVICE,'independent_review':own,'backup_transport_review':back,'stop_intent_sha256':m.s.digest(m.s.INTENT)}
    receipt={'profile':'neuvetra.m80.foundation-backup-source-inspection.v1','observedAt':m.s.utc().isoformat(),'projectRef':m.PROJECT_REF,'sourceSchemaVersion':21,'migrationReceiptCount':21,'activeRuntimeSessionCount':0,'noActiveRuntimeSessions':True,'readOnly':True,'applicationOnly':True,'providerRecoveryExcluded':True,'observedNonReceiptTables':['public.a','public.b'],'observedNonReceiptTableCount':2,'applicationStateSha256':'3'*64,'sourceHelperPins':{'pins':pins}}
    rows=[{'id':m.s.PRIOR_DEPLOYMENT,'status':'REMOVED','meta':{'commitHash':m.s.PRIOR_COMMIT,'imageDigest':m.s.PRIOR_IMAGE}}]
    write(m.GATE,gate)
    return gate,receipt,rows,pins

class Controls(unittest.TestCase):
    def isolated(self, callback):
        old=Path.cwd()
        with tempfile.TemporaryDirectory(prefix='m80_recovery_qa_') as directory:
            try:
                os.chdir(directory);Path('.superpowers').mkdir();return callback(*fixture())
            finally:os.chdir(old)

    def test_real_gate_negative_controls(self):
        def exercise(gate,receipt,rows,pins):
            self.assertEqual(m.validate_gate(gate),pins)
            for field,value in [('operator',None),('commit','0'*40),('project','foreign'),('environment','foreign'),('service','foreign'),('created_at','2000-01-01T00:00:00+00:00'),('helper_sha256','0'*64),('stop_intent_sha256','0'*64)]:
                with self.assertRaises(Exception):m.validate_gate({**gate,field:value})
            Path('.superpowers/transitive.ts').write_bytes(b'changed dependency')
            with self.assertRaises(Exception):m.validate_gate(gate)
        self.isolated(exercise)

    def test_actual_main_order_uncertainty_and_failed_observations(self):
        outcomes=[]
        for scenario in ['success','timeout','bad_json','provider_refused','inspection_failed','schema22','active_session','live_deployment','autodeploy','bridge_changes_dependency','migration_during_inspection','query_sync_failure','intent_sync_failure']:
            def exercise(gate,receipt,rows,pins):
                events=[];actual_sync=m.s.os.fsync
                def sync(fd):
                    events.append('sync')
                    target={'query_sync_failure':1,'intent_sync_failure':2}.get(scenario)
                    if target==events.count('sync'):raise OSError('mock sync failure')
                    actual_sync(fd)
                def run(args,**kwargs):
                    if args[0]==str(m.PWSH):
                        events.append('inspect')
                        if scenario=='inspection_failed':return subprocess.CompletedProcess(args,1,b'',b'')
                        if scenario=='schema22':receipt['sourceSchemaVersion']=22
                        if scenario=='active_session':receipt['activeRuntimeSessionCount']=1
                        write(m.INSPECT,receipt)
                        if scenario=='bridge_changes_dependency':Path('.superpowers/transitive.ts').write_bytes(b'changed')
                        if scenario=='migration_during_inspection':Path('.superpowers/m80-foundation-hosted-foreign-migration-intent.json').write_bytes(b'partial')
                        return subprocess.CompletedProcess(args,0,b'',b'')
                    self.assertEqual(events,['inspect','sync','sync']);self.assertTrue(m.INTENT.exists())
                    self.assertIn(m.s.PRIOR_COMMIT,m.QUERY.read_text());self.assertIn(m.s.SERVICE,m.QUERY.read_text());events.append('mutation')
                    if scenario=='timeout':raise subprocess.TimeoutExpired(args,55)
                    if scenario=='bad_json':return subprocess.CompletedProcess(args,0,b'?',b'')
                    body={'errors':['refused']} if scenario=='provider_refused' else {'data':{'serviceInstanceDeployV2':'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'}}
                    return subprocess.CompletedProcess(args,0,json.dumps(body).encode(),b'')
                def output(args):
                    if 'list' in args:
                        if scenario=='live_deployment':rows.append({'id':'other','status':'SUCCESS'})
                        return json.dumps(rows).encode()
                    return json.dumps({'data':{'serviceInstanceAutoDeployStatus':{'enabled':scenario=='autodeploy'}}}).encode()
                error=None
                with patch.object(m.subprocess,'run',side_effect=run),patch.object(m.s,'output',side_effect=output),patch.object(m.s.os,'fsync',side_effect=sync):
                    try:m.main('fictional-never-opened-export')
                    except Exception as exc:error=type(exc).__name__
                    before=len(events)
                    if scenario!='inspection_failed':
                        with self.assertRaises(Exception):m.main('fictional-never-opened-export')
                        self.assertEqual(len(events),before)
                self.assertEqual(events.count('mutation'),int(scenario in ['success','timeout','bad_json','provider_refused']))
                self.assertEqual(error is None,scenario=='success')
                outcomes.append({'scenario':scenario,'events':events,'error':error,'intent_retained':m.INTENT.exists(),'response':json.loads(m.RESPONSE.read_bytes()) if m.RESPONSE.exists() else None})
            self.isolated(exercise)
        write(ROOT/'evaluations/research-qa'/f'{PREFIX}controls.json',{'boundary':'Real frozen admission/main and isolated files/fsync; all subprocess/network/provider observations mocked; no credential read','cases':outcomes})

if __name__=='__main__':unittest.main()
