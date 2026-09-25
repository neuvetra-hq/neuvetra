import copy,importlib.util,io,json,os,tempfile,unittest
from pathlib import Path
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('m80_stop',Path(__file__).with_name('m80-provider-stop-independent-20260924-candidate2-frozen.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class StopTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory(prefix='m80_stop_test_');self.before=Path.cwd();os.chdir(self.tmp.name)
  self.head='7f68f4509074f817e5b584c6f8bcb29d1d32392e';stamp=m.utc().isoformat()
  Path('.superpowers').mkdir()
  def pin(name,verdict):
   body={'verdict':verdict,'reviewer':m.REVIEWER,'helper_sha256':m.digest(m.__file__)}
   if name!='stop':
    source=Path(m.SOURCE_ENTRYPOINTS[name+'_transport_review']);source.write_bytes(b'// fictional transport for admission tests\n');source_pin={'path':source.as_posix(),'sha256':m.digest(source)}
    snapshot=Path(name+'-snapshot.json');snapshot.write_text(json.dumps({'artifacts':[{**source_pin,'text':source.read_bytes().decode()}]}))
    body.update(source_pins=[source_pin],source_snapshot={'path':str(snapshot),'sha256':m.digest(snapshot)})
   p=Path(name+'.json');p.write_text(json.dumps(body));return {'path':str(p),'sha256':m.digest(p)}
  self.gate={'profile':'m80.reviewed-provider-stop.v1','operator':'/root','created_at':stamp,'helper_sha256':m.digest(m.__file__),'project':m.PROJECT,'service':m.SERVICE,'environment':m.ENVIRONMENT,'deployment':m.PRIOR_DEPLOYMENT,'application_commit':self.head,'independent_review':pin('stop','pass_m80_provider_stop_transport_only')}
  for name,verdict in [('backup','pass_m80_backup_transport_only'),('executor','pass_m80_executor_transport_only'),('recovery','pass_m80_recovery_transport_only')]:self.gate[name+'_transport_review']=pin(name,verdict)
  self.checks={'sha':self.head,'pr_head':self.head,'state':'open','pr':'https://github.com/neuvetra-hq/neuvetra/pull/6','observed_at':stamp,'checks':[{'name':name,'status':'completed','conclusion':'success'} for name in sorted(m.REQUIRED_CHECKS)]}
  self.rows=[{'id':m.PRIOR_DEPLOYMENT,'status':'SUCCESS','meta':{'commitHash':m.PRIOR_COMMIT,'imageDigest':m.PRIOR_IMAGE}}]
  self.ready={'status':'ready','profile':'neuvetra.private-synthetic-staging.v1','schemaVersion':21,'legacyContainmentVerified':True}
 def tearDown(self):os.chdir(self.before);self.tmp.cleanup()
 def check(self,gate=None,checks=None,rows=None,auto=False,ready=None):
  m.validate(gate or self.gate,checks or self.checks,rows or self.rows,auto,ready or self.ready,self.head,self.head)
 def test_review_and_target_fail_closed(self):
  self.check()
  for field,value in [('deployment','foreign'),('project','foreign'),('environment','foreign'),('service','foreign'),('application_commit','a'*40),('helper_sha256','0'*64),('created_at','2000-01-01T00:00:00+00:00')]:
   gate=copy.deepcopy(self.gate);gate[field]=value
   with self.assertRaises(Exception):self.check(gate=gate)
  for name in ['backup','executor','recovery']:
   pin=self.gate[name+'_transport_review'];p=Path(pin['path']);original=p.read_bytes();bad=json.loads(original);bad['verdict']='failure';p.write_text(json.dumps(bad));gate=copy.deepcopy(self.gate);gate[name+'_transport_review']['sha256']=m.digest(p)
   with self.assertRaises(Exception):self.check(gate=gate)
   p.write_bytes(original)
  Path(m.SOURCE_ENTRYPOINTS['executor_transport_review']).write_text('// changed after independent review\n')
  with self.assertRaises(Exception):self.check()
 def test_reviewer_and_full_source_closure(self):
  for name in ['independent_review','backup_transport_review','executor_transport_review','recovery_transport_review']:
   p=Path(self.gate[name]['path']);original=p.read_bytes()
   for reviewer in [None,'','arbitrary','/root']:
    bad=json.loads(original);bad['reviewer']=reviewer;p.write_text(json.dumps(bad));gate=copy.deepcopy(self.gate);gate[name]['sha256']=m.digest(p)
    with self.assertRaises(Exception):self.check(gate=gate)
   p.write_bytes(original)
  p=Path('executor.json');receipt=json.loads(p.read_bytes());receipt['source_pins']=[];p.write_text(json.dumps(receipt));gate=copy.deepcopy(self.gate);gate['executor_transport_review']['sha256']=m.digest(p)
  with self.assertRaises(Exception):self.check(gate=gate)
 def test_ci_and_live_identity(self):
  for field,value in [('status','in_progress'),('conclusion','failure'),('name','invented')]:
   checks=copy.deepcopy(self.checks);checks['checks'][0][field]=value
   with self.assertRaises(Exception):self.check(checks=checks)
  rows=copy.deepcopy(self.rows);rows.append({'id':'other','status':'SUCCESS'})
  with self.assertRaises(Exception):self.check(rows=rows)
  with self.assertRaises(Exception):self.check(auto=True)
  with self.assertRaises(Exception):self.check(ready={**self.ready,'schemaVersion':22})
 def test_authoritative_ci_refresh(self):
  from types import SimpleNamespace
  requests=[]
  class Opener:
   def open(inner,request,timeout):
    requests.append(request.full_url)
    data={'head':{'sha':self.head},'state':'open','html_url':self.checks['pr']} if '/pulls/6?' in request.full_url else {'check_runs':self.checks['checks']}
    return io.BytesIO(json.dumps(data).encode())
  with patch.object(m.subprocess,'run',return_value=SimpleNamespace(stdout='password=fictional-test-token\n')),patch.object(m.urllib.request,'build_opener',return_value=Opener()):
   result=m.fetch_current_ci(self.head)
  self.assertEqual(len(requests),2)
  self.assertTrue(requests[0].startswith('https://api.github.com/repos/neuvetra-hq/neuvetra/pulls/6?'))
  self.assertIn('/commits/'+self.head+'/check-runs?',requests[1])
  self.check(checks=result)
 def test_uncertain_mutation_keeps_durable_intent_and_refuses_second_attempt(self):
  class Ready:
   status=200
   def __enter__(inner):return inner
   def __exit__(inner,*args):pass
   def read(inner):return json.dumps(self.ready).encode()
  def load(path):return self.gate if Path(path)==m.GATE else json.loads(Path(path).read_bytes())
  def output(args):return json.dumps(self.rows if 'list' in args else {'data':{'serviceInstanceAutoDeployStatus':{'enabled':False}}}).encode()
  calls=[]
  def uncertain(*args,**kwargs):
   self.assertTrue(m.INTENT.exists());self.assertEqual(json.loads(m.INTENT.read_bytes())['state'],'attempt_reserved_no_retry');calls.append(args);raise TimeoutError('fictional uncertainty')
  m.INTENT.parent.mkdir(parents=True,exist_ok=True)
  m.GATE.write_text(json.dumps(self.gate))
  with patch.object(m,'load',side_effect=load),patch.object(m,'output',side_effect=output),patch.object(m,'git',return_value=self.head),patch.object(m,'fetch_current_ci',return_value=self.checks) as current_ci,patch.object(m.urllib.request,'urlopen',return_value=Ready()),patch.object(m.subprocess,'run',side_effect=uncertain):
   # pinned reviews continue reading actual synthetic files, independently of
   # the mocked top-level gate/check receipt loader.
   def real_pin(pin):
    self.assertEqual(m.digest(pin['path']),pin['sha256']);return json.loads(Path(pin['path']).read_bytes())
   with patch.object(m,'pinned',side_effect=real_pin):
    with self.assertRaises(TimeoutError):m.main()
    original=m.INTENT.read_bytes()
    with self.assertRaises(RuntimeError):m.main()
   current_ci.assert_called_once_with(self.head)
  self.assertEqual(len(calls),1);self.assertEqual(m.INTENT.read_bytes(),original)
  self.assertEqual(json.loads(m.RESPONSE.read_bytes())['outcome'],'uncertain_do_not_retry')

if __name__=='__main__':unittest.main()
