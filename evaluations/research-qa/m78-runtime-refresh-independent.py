"""Offline independent tests for the exact M78 fresh runtime preflight helper."""
import copy,hashlib,io,json,os,sys,tempfile,urllib.request,contextlib
from pathlib import Path
from datetime import datetime,timezone,timedelta
source_path=Path('.superpowers/m78-refresh-runtime.py').resolve();source=source_path.read_bytes();expected='e9f0b0b9926dccc504d5f181b9a92513429b3988b489e52975d304254e2a0b85';assert hashlib.sha256(source).hexdigest()==expected
now=datetime.now(timezone.utc);stamp=lambda seconds:(now+timedelta(seconds=seconds)).isoformat();deployment='b1f30f80-b536-4eb0-a376-6db76c0d1115';commit='2002feacd26c48c1beb0a4412b5524b935528084';image='sha256:e728799699e97b45d5afc5dcb3ced8912841cb6684185243e867e798ca1c47cc';ready={'status':'ready','profile':'neuvetra.private-synthetic-staging.v1','schemaVersion':21,'legacyContainmentVerified':True}
base={'status':'m78_runtime_verified','schemaVersion':21,'phase':'deployment','observedAt':stamp(-7200),'deploymentId':deployment,'commit':commit,'imageDigest':image,'deploymentStatus':'SUCCESS','httpStatus':200,'ready':ready};rows=[{'id':deployment,'status':'SUCCESS','meta':{'commitHash':commit,'imageDigest':image}}]
def run(name,change=None,phase='exercise',passing=False,optimize=0):
 b=copy.deepcopy(base);r=copy.deepcopy(rows);response=copy.deepcopy(ready);collection={'observedAt':stamp(-30)};special={'http':200,'existing':False,'bad_hash':False}
 if change:change(b,r,response,collection,special)
 raw=json.dumps(r).encode();collection['sha256']='b'*64 if special['bad_hash']else hashlib.sha256(raw).hexdigest()
 with tempfile.TemporaryDirectory(prefix='neuvetra-m78-refresh-review-')as directory:
  folder=Path(directory)/'.superpowers';folder.mkdir();(folder/'m78-final-deployment-verified.json').write_text(json.dumps(b));(folder/'m78-refresh-deployments-collection.json').write_text(json.dumps(collection));(folder/'m78-refresh-deployments.json').write_bytes(raw);output=folder/('m78-'+phase+'-runtime-verified.json')
  if special['existing']:output.write_text('retained')
  def network(url,timeout):
   assert url=='https://www.neuvetra.ai/ready'and timeout==30
   stream=io.BytesIO(json.dumps(response).encode());stream.status=special['http'];return stream
  cwd=os.getcwd();argv=sys.argv;urlopen=urllib.request.urlopen;ok=False;error=None
  try:
   os.chdir(directory);sys.argv=['refresh',phase];urllib.request.urlopen=network
   try:
    with contextlib.redirect_stdout(io.StringIO()):exec(compile(source,str(source_path),'exec',optimize=optimize),{'__name__':'__main__'})
    ok=True
   except Exception as exc:error=type(exc).__name__
  finally:urllib.request.urlopen=urlopen;sys.argv=argv;os.chdir(cwd)
  assert ok==passing,(name,ok,error)
  if passing:
   result=json.loads(output.read_text());assert result['phase']==phase+'_preflight'and result['status']=='m78_runtime_verified'and result['ready']==ready and result['deploymentCollection']==collection;assert 'actualStartupEvent'not in result and 'restartAcknowledged'not in result
  elif special['existing']:assert output.read_text()=='retained'
  else:assert not output.exists(),name
  return {'case':name,'accepted':ok,'expectedAccepted':passing,'errorCategory':error}
cases=[run('valid_exercise',passing=True),run('valid_revisit_is_preflight_only',phase='revisit',passing=True)]
def add(name,fn,**kwargs):cases.append(run(name,fn,**kwargs))
add('stale_collection',lambda b,r,s,c,x:c.update(observedAt=stamp(-121)))
add('future_collection',lambda b,r,s,c,x:c.update(observedAt=stamp(30)))
add('wrong_raw_hash',lambda b,r,s,c,x:x.update(bad_hash=True))
add('wrong_deployment',lambda b,r,s,c,x:r[0].update(id='other'))
add('coordinated_wrong_deployment',lambda b,r,s,c,x:(r[0].update(id='other'),b.update(deploymentId='other')))
add('wrong_status',lambda b,r,s,c,x:r[0].update(status='BUILDING'))
add('wrong_commit',lambda b,r,s,c,x:r[0]['meta'].update(commitHash='a'*40))
add('coordinated_wrong_commit',lambda b,r,s,c,x:(r[0]['meta'].update(commitHash='a'*40),b.update(commit='a'*40)))
add('wrong_image',lambda b,r,s,c,x:r[0]['meta'].update(imageDigest='sha256:'+'a'*64))
add('coordinated_wrong_image',lambda b,r,s,c,x:(r[0]['meta'].update(imageDigest='sha256:'+'a'*64),b.update(imageDigest='sha256:'+'a'*64)))
for status in ['SUCCESS','BUILDING','DEPLOYING','WAITING']:add('other_live_'+status,lambda b,r,s,c,x,st=status:r.append({'id':'other','status':st}))
add('old_terminal_deployments_allowed',lambda b,r,s,c,x:r.extend([{'id':'old-'+st,'status':st}for st in ['REMOVED','FAILED','CRASHED','SKIPPED']]),passing=True)
add('http_503',lambda b,r,s,c,x:x.update(http=503))
for key,value in [('status','starting'),('profile','public'),('schemaVersion',20),('legacyContainmentVerified',False)]:add('wrong_readiness_'+key,lambda b,r,s,c,x,k=key,v=value:s.update({k:v}))
add('coordinated_wrong_readiness',lambda b,r,s,c,x:(s.update(schemaVersion=20),b['ready'].update(schemaVersion=20)))
add('extra_readiness_field',lambda b,r,s,c,x:s.update(extra=True))
add('exclusive_output',lambda b,r,s,c,x:x.update(existing=True))
cases.append(run('invalid_phase',phase='restart'));cases.append(run('optimized_python_refused',optimize=1))
result={'status':'m78_independent_runtime_refresh_source_passed','createdAt':datetime.now(timezone.utc).isoformat(),'reviewerId':'/root/resume_recovery','helperSha256':expected,'caseCount':len(cases),'positiveCases':sum(x['accepted']for x in cases),'cases':cases,'networkMocked':True,'hostedCalls':0,'officialOutputWrites':0,'actualDeploymentOrRestartVerified':False}
Path('evaluations/research-qa/m78-runtime-refresh-independent-result.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items()if k!='cases'}))
