"""Continuation adaptation of preserved 26-case observer evaluator; exact source execution in temporary synthetic filesystem, all network mocked."""
import copy,hashlib,io,json,os,sys,tempfile,urllib.request,contextlib
from pathlib import Path
from datetime import datetime,timezone,timedelta
source_path=Path('.superpowers/m78-continuation-observe-runtime.py').resolve(); source=source_path.read_bytes(); expected='aedfb1164141af8cd108f313ac352d3e2cba37cbeb54ae1f5f1e5cae9105b194';assert hashlib.sha256(source).hexdigest()==expected
now=datetime.now(timezone.utc);stamp=lambda seconds:(now+timedelta(seconds=seconds)).isoformat();commit='d139628cb53f591bfd516a4aac41dd62e1138a53';image='sha256:'+'a'*64;deployment='fixture-deployment'
ready={'status':'ready','profile':'neuvetra.private-synthetic-staging.v1','schemaVersion':21,'legacyContainmentVerified':True}
base={'m78-continuation-deployment-request.json':{'data':{'serviceInstanceDeployV2':deployment}},'m78-continuation-final-deployments.json':[{'id':deployment,'status':'SUCCESS','meta':{'commitHash':commit,'imageDigest':image}}],'m78-continuation-final-deployment-verified.json':{'phase':'deployment','observedAt':stamp(-180),'deploymentId':deployment,'commit':commit,'imageDigest':image,'httpStatus':200,'ready':ready},'m78-continuation-restart-requested.json':{'deploymentId':deployment,'requestedAt':stamp(-120)},'m78-continuation-restart-ack.json':{'data':{'deploymentRestart':True}},'m78-continuation-final-startup-collection.json':{'deploymentId':deployment,'commit':commit,'imageDigest':image,'observedAt':stamp(-20)}}
def run(name,change=None,phase='restart',passing=False,optimize=0):
 state=copy.deepcopy(base);response=copy.deepcopy(ready);logs=[{'event':'staging_started','timestamp':stamp(-60)}];special={'http':200,'existing':False}
 if change:change(state,response,logs,special)
 raw=('\n'.join(json.dumps(x)for x in logs)+'\n').encode();state['m78-continuation-final-startup-collection.json']['logsSha256']=hashlib.sha256(raw).hexdigest()
 if special.get('bad_hash'):state['m78-continuation-final-startup-collection.json']['logsSha256']='b'*64
 with tempfile.TemporaryDirectory(prefix='neuvetra-m78-continuation-observer-review-')as directory:
  folder=Path(directory)/'.superpowers';folder.mkdir()
  for file,value in state.items():
   if phase=='deployment' and file=='m78-continuation-final-deployment-verified.json':continue
   (folder/file).write_text(json.dumps(value),encoding='utf8')
  (folder/'m78-continuation-final-startup-logs.jsonl').write_bytes(raw)
  output=folder/('m78-continuation-final-'+phase+'-verified.json')
  if special['existing']:output.write_text('retained',encoding='utf8')
  def network(url,timeout):
   assert url=='https://www.neuvetra.ai/ready'and timeout==30
   stream=io.BytesIO(json.dumps(response).encode());stream.status=special['http'];return stream
  cwd=os.getcwd();argv=sys.argv;urlopen=urllib.request.urlopen;ok=False;error=None
  try:
   os.chdir(directory);sys.argv=['observer',phase];urllib.request.urlopen=network
   try:
    with contextlib.redirect_stdout(io.StringIO()):exec(compile(source,str(source_path),'exec',optimize=optimize),{'__name__':'__main__'})
    ok=True
   except Exception as exc:error=type(exc).__name__
  finally:urllib.request.urlopen=urlopen;sys.argv=argv;os.chdir(cwd)
  assert ok==passing,(name,ok,error)
  if passing:
   result=json.loads(output.read_text());assert result['status']=='m78_runtime_verified'and result['commit']==commit and result['schemaVersion']==21
   if phase=='restart':assert result['actualStartupEvent']==logs[-1]and result['restartAcknowledged']is True
  elif special['existing']:assert output.read_text()=='retained'
  else:assert not output.exists(),name
  return {'case':name,'accepted':ok,'expectedAccepted':passing,'errorCategory':error}
cases=[run('valid_deployment',phase='deployment',passing=True),run('valid_restart',passing=True)]
def add(name,fn,**kwargs):cases.append(run(name,fn,**kwargs))
add('wrong_commit',lambda s,r,l,x:s['m78-continuation-final-deployments.json'][0]['meta'].update(commitHash='0'*40))
add('invalid_image',lambda s,r,l,x:s['m78-continuation-final-deployments.json'][0]['meta'].update(imageDigest='sha256:short'))
add('substituted_restart_image',lambda s,r,l,x:s['m78-continuation-final-deployments.json'][0]['meta'].update(imageDigest='sha256:'+'b'*64))
add('another_live_deployment',lambda s,r,l,x:s['m78-continuation-final-deployments.json'].append({'id':'other','status':'SUCCESS'}))
for key,value in [('status','starting'),('profile','public'),('schemaVersion',20),('legacyContainmentVerified',False)]:add('wrong_ready_'+key,lambda s,r,l,x,k=key,v=value:r.update({k:v}))
add('wrong_http',lambda s,r,l,x:x.update(http=503))
add('missing_ack',lambda s,r,l,x:s['m78-continuation-restart-ack.json']['data'].update(deploymentRestart=False))
add('prior_wrong_commit',lambda s,r,l,x:s['m78-continuation-final-deployment-verified.json'].update(commit='b'*40))
add('prior_observed_after_request',lambda s,r,l,x:s['m78-continuation-final-deployment-verified.json'].update(observedAt=stamp(-10)))
for key,value in [('deploymentId','other'),('commit','f'*40),('imageDigest','sha256:'+'c'*64)]:add('wrong_collection_'+key,lambda s,r,l,x,k=key,v=value:s['m78-continuation-final-startup-collection.json'].update({k:v}))
add('changed_log_bytes',lambda s,r,l,x:x.update(bad_hash=True))
add('only_old_startup',lambda s,r,l,x:l[0].update(timestamp=stamp(-121)))
add('startup_at_request',lambda s,r,l,x:l[0].update(timestamp=stamp(-120)))
add('startup_after_collection',lambda s,r,l,x:l[0].update(timestamp=stamp(-1)))
add('future_collection',lambda s,r,l,x:s['m78-continuation-final-startup-collection.json'].update(observedAt=stamp(300)))
add('missing_startup_event',lambda s,r,l,x:l[0].update(event='some_other_log'))
add('stale_collection',lambda s,r,l,x:(s['m78-continuation-restart-requested.json'].update(requestedAt=stamp(-2000)),s['m78-continuation-final-deployment-verified.json'].update(observedAt=stamp(-2100)),s['m78-continuation-final-startup-collection.json'].update(observedAt=stamp(-1000)),l[0].update(timestamp=stamp(-1500))))
add('exclusive_output',lambda s,r,l,x:x.update(existing=True))
cases.append(run('optimized_python_refused',optimize=1))
result={'status':'m78_independent_runtime_observer_source_passed','createdAt':datetime.now(timezone.utc).isoformat(),'reviewerId':'/root/resume_release','observerSha256':expected,'cases':cases,'caseCount':len(cases),'positiveCases':sum(x['accepted']for x in cases),'networkMocked':True,'hostedCalls':0,'officialOutputWrites':0,'actualDeploymentOrRestartVerified':False}
Path('evaluations/research-qa/m78-continuation-runtime-observer-independent-result.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf8');print(json.dumps({k:v for k,v in result.items()if k!='cases'}))
