"""Root-only one-attempt removal of the exact prior staging deployment.

No API call occurs on import. Execution requires a fresh separate review gate.
The response does not prove database quiescence; that requires later observation.
"""
import datetime,hashlib,json,os,subprocess,urllib.request
from pathlib import Path

PROJECT='119f3652-9d84-4d16-983c-1a17c0fd1aaa'
SERVICE='f43abcf9-72f0-4034-828a-8d83ca26b0db'
ENVIRONMENT='6642d65a-15a2-41e9-b25e-b7b01990aa28'
PRIOR_DEPLOYMENT='904ac743-2e13-489b-b2a3-62163d297352'
PRIOR_COMMIT='540c71dbea6057f35a8b44074a71ceb9cf6bd6c3'
PRIOR_IMAGE='sha256:ff5fc867ba683f04571ea641db6208ba5d463756b076715e4252ed50dba5de4c'
REQUIRED_CHECKS={'GHG calculation specifications and engine','Offline research catalog tests','Typecheck, lint, unit tests and web builds','Dedicated staging image and offline runtime smoke','Role routing and evidence records','Native PostgreSQL worksheet and tenant regression'}
TERMINAL={'REMOVED','FAILED','CRASHED','SKIPPED'}
CLI=['C:/Users/nimab/.bun/bin/bunx.exe','@railway/cli']
GATE=Path('.superpowers/m80-provider-stop-gate.json')
INTENT=Path('.superpowers/m80-provider-stop-intent.json')
RESPONSE=Path('.superpowers/m80-provider-stop-response.json')
QUERY=Path('.superpowers/m80-provider-stop.graphql')

def require(value,message):
 if not value:raise RuntimeError(message)
def digest(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def load(path):return json.loads(Path(path).read_bytes())
def utc():return datetime.datetime.now(datetime.timezone.utc)
def fresh(stamp,seconds=180):
 try:age=(utc()-datetime.datetime.fromisoformat(stamp)).total_seconds()
 except (TypeError,ValueError):return False
 return 0<=age<=seconds
def exclusive(path,value):
 with Path(path).open('xb') as stream:
  stream.write((json.dumps(value,sort_keys=True,indent=2)+'\n').encode());stream.flush();os.fsync(stream.fileno())
def pinned(pin):
 require(isinstance(pin,dict) and set(pin)=={'path','sha256'},'Closed review pin required')
 p=Path(pin['path']);root=Path.cwd().resolve();resolved=p.resolve()
 require(not p.is_absolute() and resolved.is_relative_to(root) and p.suffix=='.json','Local JSON review required')
 require(digest(p)==pin['sha256'],'Changed review bytes')
 return load(p)
def validate(gate,checks,rows,auto,ready,head,remote):
 require(gate['profile']=='m80.reviewed-provider-stop.v1' and gate['operator']=='/root','Root stop gate required')
 require(fresh(gate['created_at']) and gate['helper_sha256']==digest(__file__),'Fresh exact helper gate required')
 require(gate['project']==PROJECT and gate['service']==SERVICE and gate['environment']==ENVIRONMENT and gate['deployment']==PRIOR_DEPLOYMENT,'Foreign stop target')
 review=pinned(gate['independent_review'])
 require(review['verdict']=='pass_m80_provider_stop_transport_only' and review['reviewer']!='/root' and review['helper_sha256']==digest(__file__),'Independent exact stop review required')
 # These are reviewed local transport readiness receipts, not a claim that a
 # fresh hosted backup or migration has already happened.
 verdicts={'backup_transport_review':'pass_m80_backup_transport_only','executor_transport_review':'pass_m80_executor_transport_only','recovery_transport_review':'pass_m80_recovery_transport_only'}
 for name,verdict in verdicts.items():
  receipt=pinned(gate[name]);require(receipt['verdict']==verdict and receipt['reviewer']!='/root','Missing accepted transport dependency')
  source_pins=receipt['source_pins'];require(isinstance(source_pins,list) and len(source_pins)>0,'Reviewed concrete transport sources required')
  for pin in source_pins:
   path=Path(pin['path']);require(not path.is_absolute() and path.resolve().is_relative_to(Path.cwd().resolve()),'Foreign transport source')
   require(digest(path)==pin['sha256'],'Changed reviewed transport source')
 require(head==remote==gate['application_commit']==checks['sha']==checks['pr_head'],'Application head changed')
 require(checks['state']=='open' and checks['pr']=='https://github.com/neuvetra-hq/neuvetra/pull/6' and fresh(checks['observed_at']),'Fresh PR6 check receipt required')
 require(len(checks['checks'])==6 and {c['name'] for c in checks['checks']}==REQUIRED_CHECKS and all(c['status']=='completed' and c['conclusion']=='success' for c in checks['checks']),'Six completed checks required')
 live=[r for r in rows if r['id']==PRIOR_DEPLOYMENT]
 require(len(live)==1 and live[0]['status']=='SUCCESS' and live[0]['meta']['commitHash']==PRIOR_COMMIT and live[0]['meta']['imageDigest']==PRIOR_IMAGE,'Prior deployment changed')
 require(all(r['id']==PRIOR_DEPLOYMENT or r['status'] in TERMINAL for r in rows),'Another live deployment exists')
 require(auto is False,'Autodeploy must be paused')
 require(ready=={'status':'ready','profile':'neuvetra.private-synthetic-staging.v1','schemaVersion':21,'legacyContainmentVerified':True},'Prior readiness changed')

def output(args):return subprocess.check_output(args,timeout=55)
def git(*args):return output(['git','-c','maintenance.auto=false','-c','gc.auto=0',*args]).decode().strip()
def main():
 require(not INTENT.exists() and not RESPONSE.exists() and not QUERY.exists(),'Prior stop attempt exists; inspect without retry')
 gate=load(GATE);checks=load('.superpowers/m80-current-checks.json')
 rows=json.loads(output(CLI+['deployment','list','--project',PROJECT,'--service',SERVICE,'--environment',ENVIRONMENT,'--json']).decode('utf-8-sig'))
 auto_query='query { serviceInstanceAutoDeployStatus(environmentId:"'+ENVIRONMENT+'",projectId:"'+PROJECT+'",serviceId:"'+SERVICE+'") { enabled } }'
 auto=json.loads(output(CLI+['api',auto_query,'--compact']))
 require(not auto.get('errors'),'Autodeploy observation failed')
 with urllib.request.urlopen('https://www.neuvetra.ai/ready',timeout=25) as response:
  require(response.status==200,'Prior application not ready');ready=json.load(response)
 head=git('rev-parse','HEAD');remote=git('ls-remote','origin','refs/heads/codex/corporate-mvp').split()[0]
 validate(gate,checks,rows,auto['data']['serviceInstanceAutoDeployStatus']['enabled'],ready,head,remote)
 query='mutation { deploymentRemove(id:"'+PRIOR_DEPLOYMENT+'") }\n'
 with QUERY.open('xb') as stream:stream.write(query.encode());stream.flush();os.fsync(stream.fileno())
 exclusive(INTENT,{'profile':'m80.provider-stop-intent.v1','created_at':utc().isoformat(),'target':PRIOR_DEPLOYMENT,'gate_sha256':digest(GATE),'helper_sha256':digest(__file__),'query_sha256':digest(QUERY),'application_commit':head,'state':'attempt_reserved_no_retry'})
 # Exclusive intent is durable before the only mutation invocation. Any timeout,
 # parse error or incomplete receipt keeps the attempt closed against replay.
 try:
  result=subprocess.run(CLI+['api','--file',str(QUERY),'--compact'],capture_output=True,timeout=55)
  reply=json.loads(result.stdout)
  ok=result.returncode==0 and not reply.get('errors') and reply.get('data',{}).get('deploymentRemove') is True
  exclusive(RESPONSE,{'observed_at':utc().isoformat(),'target':PRIOR_DEPLOYMENT,'request_acknowledged':ok,'transport_exit_code':result.returncode,'next':'Observe provider REMOVED and database quiescence; acknowledgment alone is insufficient.'})
  require(ok,'Stop outcome uncertain or refused; inspect, never repeat blindly')
 except Exception:
  if not RESPONSE.exists():exclusive(RESPONSE,{'observed_at':utc().isoformat(),'target':PRIOR_DEPLOYMENT,'request_acknowledged':False,'outcome':'uncertain_do_not_retry'})
  raise
 print('Stop request acknowledged once; independent quiescence observation is pending.')

if __name__=='__main__':
 try:main()
 except Exception:
  print('M80 provider stop halted. Inspect private receipts; no automatic retry. Sensitive diagnostics withheld.')
  raise SystemExit(1)
