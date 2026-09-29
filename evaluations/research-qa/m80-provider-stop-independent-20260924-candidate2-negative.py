import copy,importlib.util,io,json,subprocess,unittest
from pathlib import Path
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('stop_c2',Path(__file__).with_name('m80-provider-stop-independent-20260924-candidate2-fixture.py'));f=importlib.util.module_from_spec(spec);spec.loader.exec_module(f);m=f.m
class Negative(unittest.TestCase):
 def setUp(self):self.f=f.StopTests('test_review_and_target_fail_closed');self.f.setUp()
 def tearDown(self):self.f.tearDown()
 def test_review_shapes_and_closure(self):
  for key in ['independent_review',*m.SOURCE_ENTRYPOINTS]:
   pin=self.f.gate[key];p=Path(pin['path']);old=p.read_bytes();oldsha=pin['sha256']
   for reviewer in [None,'',[],{},'/root','/root/m80_setup_ui','/root/m80_foundation_runtime']:
    receipt=json.loads(old);receipt['reviewer']=reviewer;p.write_bytes(json.dumps(receipt).encode());pin['sha256']=m.digest(p)
    with self.assertRaises(Exception):self.f.check()
   p.write_bytes(old);pin['sha256']=oldsha
  for key in m.SOURCE_ENTRYPOINTS:
   pin=self.f.gate[key];p=Path(pin['path']);old=p.read_bytes();oldsha=pin['sha256'];original=json.loads(old)
   for change in ['omit','duplicate','extra','snapshot_mismatch']:
    receipt=copy.deepcopy(original)
    if change=='omit':receipt['source_pins']=[]
    elif change=='duplicate':receipt['source_pins']*=2
    elif change=='extra':receipt['source_pins'].append({'path':'unrelated.txt','sha256':'0'*64})
    else:receipt['source_snapshot']['sha256']='0'*64
    p.write_bytes(json.dumps(receipt).encode());pin['sha256']=m.digest(p)
    with self.assertRaises(Exception):self.f.check()
   p.write_bytes(old);pin['sha256']=oldsha
 def test_actual_ci_fetch_controls_preintent_and_never_reads_local_claim(self):
  gate=self.f.gate;ready=self.f.ready;head=self.f.head;Path(m.GATE).write_bytes(json.dumps(gate).encode());Path('.superpowers/m80-current-checks.json').write_bytes(json.dumps(self.f.checks).encode())
  class Ready:
   status=200
   def __enter__(self):return self
   def __exit__(self,*args):pass
   def read(self):return json.dumps(ready).encode()
  for fault in ['failed','pending','wrong_head','closed','missing']:
   calls=[];urls=[];checks=copy.deepcopy(self.f.checks['checks']);pr={'head':{'sha':head},'state':'open','html_url':self.f.checks['pr']}
   if fault=='failed':checks[0]['conclusion']='failure'
   elif fault=='pending':checks[0]['status']='in_progress'
   elif fault=='wrong_head':pr['head']['sha']='f'*40
   elif fault=='closed':pr['state']='closed'
   else:checks.pop()
   class Opener:
    def open(self,request,timeout):
     urls.append(request.full_url);assert request.full_url.startswith('https://api.github.com/repos/neuvetra-hq/neuvetra/');return io.BytesIO(json.dumps(pr if '/pulls/6?' in request.full_url else {'check_runs':checks}).encode())
   def run(args,**kwargs):
    calls.append(args);self.assertEqual(args,['git','credential','fill']);return subprocess.CompletedProcess(args,0,'password=fictional-test-only\n','')
   def output(args):return json.dumps(self.f.rows if 'list' in args else {'data':{'serviceInstanceAutoDeployStatus':{'enabled':False}}}).encode()
   with patch.object(m,'output',side_effect=output),patch.object(m,'git',return_value=head),patch.object(m.subprocess,'run',side_effect=run),patch.object(m.urllib.request,'urlopen',return_value=Ready()),patch.object(m.urllib.request,'build_opener',return_value=Opener()):
    with self.assertRaises(RuntimeError):m.main()
   self.assertEqual(len(calls),1);self.assertEqual(len(urls),2);self.assertFalse(m.QUERY.exists());self.assertFalse(m.INTENT.exists());self.assertFalse(m.RESPONSE.exists())
 def test_gate_check_identity_negatives(self):
  for field,value in [('created_at','2099-01-01T00:00:00+00:00'),('created_at','invalid'),('application_commit','a'*40)]:
   g=copy.deepcopy(self.f.gate);g[field]=value
   with self.assertRaises(Exception):self.f.check(gate=g)
  for key in ['commitHash','imageDigest']:
   rows=copy.deepcopy(self.f.rows);rows[0]['meta'][key]='different'
   with self.assertRaises(Exception):self.f.check(rows=rows)
  for status in ['DEPLOYING','BUILDING','WAITING']:
   rows=copy.deepcopy(self.f.rows)+[{'id':'other','status':status}]
   with self.assertRaises(Exception):self.f.check(rows=rows)
if __name__=='__main__':unittest.main()
