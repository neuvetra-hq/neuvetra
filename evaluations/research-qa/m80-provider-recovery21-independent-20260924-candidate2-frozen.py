"""Reviewed, once-only restoration of the prior app before any migration attempt.

Import is inert. This cannot recover schema 22 or reverse a database migration.
"""
import importlib.util,json,re,subprocess,sys
from pathlib import Path

spec=importlib.util.spec_from_file_location('m80_stop',Path(__file__).with_name('m80-provider-recovery21-independent-20260924-candidate2-stop.py'))
s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)
GATE=Path('.superpowers/m80-provider-recover21-gate.json')
INTENT=Path('.superpowers/m80-provider-recover21-intent.json')
RESPONSE=Path('.superpowers/m80-provider-recover21-response.json')
QUERY=Path('.superpowers/m80-provider-recover21.graphql')
INSPECT=Path('.superpowers/m80-backup-recovery21-inspection.json')
BRIDGE='.superpowers/m80-backup-private.ps1'
PWSH='C:/Users/nimab/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe'
PROJECT_REF='icockcoguyadhryzydvl'

def no_migration():
 s.require(not list(Path('.superpowers').glob('m80-foundation-hosted-*-migration-intent.json')),'Migration attempt exists: schema21 recovery forbidden')

def review(pin,verdict,entrypoints):
 receipt=s.pinned(pin)
 s.require(receipt['reviewer']==s.REVIEWER and receipt['verdict']==verdict,'Exact independent transport review required')
 snapshot=s.pinned(receipt['source_snapshot']);artifacts=snapshot['artifacts']
 expected=[{'path':a['path'],'sha256':a['sha256']} for a in artifacts]
 s.require(len(expected)>0 and len({p['path'] for p in expected})==len(expected),'Unique source closure required')
 s.require(sorted(receipt['source_pins'],key=lambda p:p['path'])==sorted(expected,key=lambda p:p['path']),'Complete reviewed source closure required')
 s.require(set(entrypoints)<={p['path'] for p in expected},'Required source entrypoint missing')
 for a in artifacts:
  p=Path(a['path'])
  s.require(not p.is_absolute() and p.resolve().is_relative_to(Path.cwd().resolve()),'Foreign source path')
  s.require(s.digest(p)==a['sha256']==s.hashlib.sha256(a['text'].encode()).hexdigest(),'Changed reviewed source')
 return expected

def validate_gate(gate):
 no_migration()
 s.require(gate['profile']=='m80.reviewed-schema21-recovery.v1' and gate['operator']=='/root' and s.fresh(gate['created_at']),'Fresh root recovery gate required')
 s.require(gate['helper_sha256']==s.digest(__file__) and gate['commit']==s.PRIOR_COMMIT,'Exact prior application required')
 s.require(gate['project']==s.PROJECT and gate['environment']==s.ENVIRONMENT and gate['service']==s.SERVICE,'Foreign recovery target')
 review(gate['independent_review'],'pass_m80_recovery_transport_only',['.superpowers/m80-provider-recover21.py','.superpowers/m80-provider-stop.py'])
 pins=review(gate['backup_transport_review'],'pass_m80_backup_transport_only',[BRIDGE,'.superpowers/m80-backup-hosted-entry.ts'])
 stop=s.load(s.INTENT)
 s.require(s.digest(s.INTENT)==gate['stop_intent_sha256'] and stop['target']==s.PRIOR_DEPLOYMENT and stop['state']=='attempt_reserved_no_retry','Reviewed stop intent required')
 return pins

def validate_observations(receipt,rows,auto,pins):
 no_migration()
 s.require(receipt['profile']=='neuvetra.m80.foundation-backup-source-inspection.v1' and s.fresh(receipt['observedAt']),'Fresh actual database inspection required')
 s.require(receipt['projectRef']==PROJECT_REF and receipt['sourceSchemaVersion']==21 and receipt['migrationReceiptCount']==21,'Exact prior database required')
 s.require(receipt['activeRuntimeSessionCount']==0 and receipt['noActiveRuntimeSessions'] is True and receipt['readOnly'] is True,'Database quiescence required')
 s.require(receipt['applicationOnly'] is True and receipt['providerRecoveryExcluded'] is True,'Application-only boundary required')
 names=receipt['observedNonReceiptTables']
 s.require(isinstance(names,list) and len(names)>0 and all(isinstance(n,str) for n in names) and len(set(names))==len(names)==receipt['observedNonReceiptTableCount'],'Exact derived table list required')
 s.require(re.fullmatch('[0-9a-f]{64}',receipt['applicationStateSha256']) is not None,'Application state hash required')
 observed=receipt['sourceHelperPins']['pins']
 s.require(observed and all(p in pins for p in observed) and {BRIDGE,'.superpowers/m80-backup-hosted-entry.ts'}<={p['path'] for p in observed},'Inspection source not reviewed')
 prior=[r for r in rows if r['id']==s.PRIOR_DEPLOYMENT]
 s.require(len(prior)==1 and prior[0]['status']=='REMOVED' and prior[0]['meta']['commitHash']==s.PRIOR_COMMIT and prior[0]['meta']['imageDigest']==s.PRIOR_IMAGE,'Prior deployment not removed or changed')
 s.require(all(r['status'] in s.TERMINAL for r in rows) and auto is False,'Live deployment or autodeploy prevents recovery')

def main(export_path):
 s.require(not any(p.exists() for p in [INTENT,RESPONSE,QUERY,INSPECT]),'Recovery attempt/inspection already exists; inspect without replay')
 gate=s.load(GATE);pins=validate_gate(gate)
 # The explicit named credential export is handled only by the reviewed bridge;
 # credential contents never enter this Python process or its command line.
 result=subprocess.run([PWSH,'-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',BRIDGE,'-Mode','Inspect','-ExportPath',export_path,'-OutputPath',str(INSPECT.resolve())],capture_output=True,timeout=55)
 s.require(result.returncode==0,'Actual private database inspection failed')
 receipt=s.load(INSPECT)
 rows=json.loads(s.output(s.CLI+['deployment','list','--project',s.PROJECT,'--service',s.SERVICE,'--environment',s.ENVIRONMENT,'--json']).decode('utf-8-sig'))
 query='query { serviceInstanceAutoDeployStatus(environmentId:"'+s.ENVIRONMENT+'",projectId:"'+s.PROJECT+'",serviceId:"'+s.SERVICE+'") { enabled } }'
 auto=json.loads(s.output(s.CLI+['api',query,'--compact']))
 s.require(not auto.get('errors'),'Autodeploy observation failed')
 validate_observations(receipt,rows,auto['data']['serviceInstanceAutoDeployStatus']['enabled'],pins)
 validate_gate(gate)
 mutation='mutation { serviceInstanceDeployV2(environmentId:"'+s.ENVIRONMENT+'",serviceId:"'+s.SERVICE+'",commitSha:"'+s.PRIOR_COMMIT+'") }\n'
 with QUERY.open('xb') as stream:stream.write(mutation.encode());stream.flush();s.os.fsync(stream.fileno())
 s.exclusive(INTENT,{'profile':'m80.schema21-recovery-intent.v1','observed_at':s.utc().isoformat(),'commit':s.PRIOR_COMMIT,'gate_sha256':s.digest(GATE),'inspection_sha256':s.digest(INSPECT),'query_sha256':s.digest(QUERY),'state':'attempt_reserved_no_retry'})
 no_migration()
 try:
  result=subprocess.run(s.CLI+['api','--file',str(QUERY),'--compact'],capture_output=True,timeout=55)
  reply=json.loads(result.stdout);deployment=reply.get('data',{}).get('serviceInstanceDeployV2')
  ok=result.returncode==0 and not reply.get('errors') and isinstance(deployment,str) and re.fullmatch('[0-9a-f-]{36}',deployment) is not None
  s.exclusive(RESPONSE,{'observed_at':s.utc().isoformat(),'request_acknowledged':ok,'deployment_id':deployment if ok else None,'commit':s.PRIOR_COMMIT,'availability_verified':False})
  s.require(ok,'Recovery uncertain or refused; no automatic retry')
 except Exception:
  if not RESPONSE.exists():s.exclusive(RESPONSE,{'observed_at':s.utc().isoformat(),'request_acknowledged':False,'outcome':'uncertain_do_not_retry'})
  raise
 print('Prior application recovery requested once. Provider success and schema21 readiness still require verification.')

if __name__=='__main__':
 try:
  s.require(len(sys.argv)==2,'Explicit reviewed private credential export path required')
  main(sys.argv[1])
 except Exception:
  print('M80 prior application recovery halted. Inspect private receipts; sensitive diagnostics withheld.')
  raise SystemExit(1)
