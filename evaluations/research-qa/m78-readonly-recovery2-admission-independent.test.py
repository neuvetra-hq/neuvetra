import ast,contextlib,copy,hashlib,io,json,pathlib,subprocess,unittest
from unittest.mock import patch

ROOT=pathlib.Path
ADMIT='.superpowers/m78-readonly-recovery2-admit.py'
CLOSURE='.superpowers/m78-readonly-recovery2-source-closure.ts'
RUNTIME='.superpowers/m78-get-route-recovery2-runtime-verified.json'
COLLECTION='.superpowers/m78-get-route-recovery2-runtime-collection.json'
ROOT_REVIEW='evaluations/research-qa/m78-readonly-recovery2-root-result.json'
ROOT_REVIEW_SHA='1c2325e535d36c942684a3a7f7f598af29c24a7a774af55f244124f63a5aebd2'
FIXED_NOW='2026-09-23T03:00:00+00:00'

def digest(value):return hashlib.sha256(value).hexdigest()
def encoded(value):return json.dumps(value,separators=(',',':')).encode()

SOURCE=ROOT(ADMIT).read_text(encoding='utf-8')
CLOSURE_PINS=json.loads(subprocess.check_output(['C:/Users/nimab/.bun/bin/bun.exe',CLOSURE]))

def fixture():
 data={pin['path']:ROOT(pin['path']).read_bytes() for pin in CLOSURE_PINS}
 root= json.loads(ROOT(ROOT_REVIEW).read_bytes())
 for path in ['evaluations/research-qa/m78-readonly-recovery2-private-independent-result.json','evaluations/research-qa/m78-readonly-failure-review2-result.json','evaluations/research-qa/m78-continuation4-preparation-source-pins.json','.superpowers/m78-continuation4-readonly-recovery.jsonl','.superpowers/m78-continuation4-readonly-recovery-diagnostics.jsonl','.superpowers/m78-get-route-deployment-admission.json',ADMIT,ROOT_REVIEW,*[p['path'] for p in root['sourcePins']]]:data[path]=ROOT(path).read_bytes()
 data[COLLECTION]=b'fixed recovery2 deployment collection\n'
 runtime={'status':'m78_get_route_deployed_runtime_verified','observedAt':'2026-09-23T02:58:20+00:00','deploymentId':'f6d77b2e-6886-429b-a4d2-4873c9199ce8','commit':'9dd9c85fb674528a2c1dd1b0138f5a2d87ba683e','imageDigest':'sha256:3e4c2c91591a5598a85f63b4099b1b4890588ce79ec832b21b7d284b5aa89d1b','deploymentStatus':'SUCCESS','httpStatus':200,'ready':{'status':'ready','profile':'neuvetra.private-synthetic-staging.v1','schemaVersion':21,'legacyContainmentVerified':True},'autodeploy':False,'admissionSha256':digest(data['.superpowers/m78-get-route-deployment-admission.json']),'deploymentCollectionSha256':digest(data[COLLECTION]),'deploymentCollectionPath':COLLECTION,'recoveryExecuted':False,'restartExecuted':False,'revisitExecuted':False}
 data[RUNTIME]=encoded(runtime)
 assert digest(data[ROOT_REVIEW])==ROOT_REVIEW_SHA
 return data,ROOT_REVIEW_SHA

def execute(mutate=None,closure_mutate=None,rebind_root_review=False):
 data,root_hash=fixture();outputs={}
 if mutate:mutate(data)
 if rebind_root_review:root_hash=digest(data[ROOT_REVIEW])
 closure=copy.deepcopy(CLOSURE_PINS)
 if closure_mutate:closure_mutate(closure)
 transformed=SOURCE
 if rebind_root_review:transformed=transformed.replace(ROOT_REVIEW_SHA,root_hash)
 transformed=transformed.replace('datetime.now(timezone.utc)',"datetime.fromisoformat('"+FIXED_NOW+"')")
 assert transformed!=SOURCE and transformed.count(FIXED_NOW)==2
 class Writer:
  def __init__(self,path):self.path=path
  def write(self,text):outputs[self.path]=text.encode();return len(text)
 class FakePath:
  def __init__(self,path):self.path=str(path)
  def read_bytes(self):return outputs[self.path] if self.path in outputs else data[self.path]
  def exists(self):return self.path in outputs or self.path in data
  def open(self,mode,**_):
   if mode!='x' or self.exists():raise FileExistsError(self.path)
   return Writer(self.path)
 def fake_process(args):
  assert args==['C:/Users/nimab/.bun/bin/bun.exe',CLOSURE]
  return json.dumps(closure).encode()
 with patch('pathlib.Path',FakePath),patch('subprocess.check_output',fake_process),contextlib.redirect_stdout(io.StringIO()):
  try:exec(compile(transformed,'recovery2-admission-under-test','exec'),{'__name__':'test'})
  except (AssertionError,FileExistsError,KeyError):return False,outputs
 return True,outputs

def mutate_json(path,key,value):
 def apply(data):obj=json.loads(data[path]);obj[key]=value;data[path]=encoded(obj)
 return apply

class Recovery2AdmissionReview(unittest.TestCase):
 def test_positive_writes_exact_two_gates(self):
  passed,outputs=execute();self.assertTrue(passed);self.assertEqual(set(outputs),{'.superpowers/m78-readonly-recovery2-source-gate.json','.superpowers/m78-readonly-recovery2-execution-admission.json'})
  source=json.loads(outputs['.superpowers/m78-readonly-recovery2-source-gate.json']);gate=json.loads(outputs['.superpowers/m78-readonly-recovery2-execution-admission.json'])
  self.assertEqual(source['status'],'m78_continuation4_readonly_recovery2_source_admitted');self.assertEqual(len(source['sourcePins']),182);self.assertEqual(source['failedRecoveryReviewSha256'],'7e46ba485e77c132113ac78d8dd4d0ef3ffb440f3a790afcdaa7874532923cac')
  self.assertEqual(gate['status'],'m78_readonly_recovery2_execution_admitted');self.assertEqual(gate['applicationPostRequests'],0);self.assertEqual(gate['workspaceId'],'8b90c706-1710-494d-b12d-02eef88eacb7');self.assertEqual(len(gate['pins']),189)

 def test_runtime_mutations_refuse_before_write(self):
  cases=[('autodeploy',True),('commit','0'*40),('deploymentId','wrong'),('deploymentStatus','BUILDING'),('imageDigest','sha256:'+'0'*64),('observedAt','2020-01-01T00:00:00+00:00')]
  for key,value in cases:
   with self.subTest(key=key):passed,outputs=execute(mutate_json(RUNTIME,key,value));self.assertFalse(passed);self.assertEqual(outputs,{})

 def test_review_failure_and_source_mutations_refuse_before_write(self):
  def changed_private(data):data['evaluations/research-qa/m78-readonly-recovery2-private-independent-result.json']=b'{}'
  def changed_failure(data):data['evaluations/research-qa/m78-readonly-failure-review2-result.json']=b'{}'
  def changed_journal(data):data['.superpowers/m78-continuation4-readonly-recovery.jsonl']+=b'x'
  def changed_runner(data):data['tools/staging/check-m78-continuation4-readonly-recovery2.ts']=b'changed'
  def open_finding(data):obj=json.loads(data[ROOT_REVIEW]);obj['materialFindingsOpen']=1;data[ROOT_REVIEW]=encoded(obj)
  for name,mutation in [('private',changed_private),('failure',changed_failure),('journal',changed_journal),('runner',changed_runner)]:
   with self.subTest(name=name):passed,outputs=execute(mutation);self.assertFalse(passed);self.assertEqual(outputs,{})
  passed,outputs=execute(open_finding,rebind_root_review=True);self.assertFalse(passed);self.assertEqual(outputs,{})

 def test_existing_outputs_and_lock_refuse_without_overwrite(self):
  paths=['.superpowers/m78-continuation4-readonly-recovery2.jsonl','.superpowers/m78-continuation4-readonly-recovery2-diagnostics.jsonl','.superpowers/m78-continuation4-readonly-recovery2-observation.json','.superpowers/m78-continuation4-readonly-recovery2-raw-capture.jsonl','.superpowers/m78-continuation4-readonly-recovery2.jsonl.lock','.superpowers/m78-readonly-recovery2-source-gate.json','.superpowers/m78-readonly-recovery2-execution-admission.json']
  for path in paths:
   with self.subTest(path=path):passed,outputs=execute(lambda data,p=path:data.__setitem__(p,b'preserve'));self.assertFalse(passed);self.assertEqual(outputs,{})

 def test_closure_omission_duplicate_and_changed_pin_refuse(self):
  mutations=[lambda pins:pins.pop(),lambda pins:pins.append(copy.deepcopy(pins[0])),lambda pins:pins.__setitem__(0,{**pins[0],'sha256':'0'*64})]
  for mutation in mutations:
   passed,outputs=execute(closure_mutate=mutation);self.assertFalse(passed);self.assertEqual(outputs,{})

 def test_source_closure_and_observer_are_exact_read_only_derivatives(self):
  self.assertEqual(len(CLOSURE_PINS),182);self.assertEqual(len({p['path'] for p in CLOSURE_PINS}),182)
  for pin in CLOSURE_PINS:self.assertEqual(digest(ROOT(pin['path']).read_bytes()),pin['sha256'],pin['path'])
  historic=json.loads(ROOT('evaluations/research-qa/m78-continuation4-preparation-source-pins.json').read_bytes());self.assertEqual(len(historic),173);self.assertTrue({p['path'] for p in historic}.issubset({p['path'] for p in CLOSURE_PINS}))
  for pin in historic:
   expected='fd9b1115130d523629e58b5fcef06fe5355eedc8afd12d6dacc998623c89ff37' if pin['path']=='apps/site-api/src/workspace/m78-routes.ts' else pin['sha256'];self.assertEqual(digest(ROOT(pin['path']).read_bytes()),expected,pin['path'])
  prior=ROOT('.superpowers/m78-get-route-refresh-for-recovery.py').read_text(encoding='utf-8');current=ROOT('.superpowers/m78-get-route-refresh-for-recovery2.py').read_text(encoding='utf-8')
  expected=prior.replace('m78-get-route-recovery-runtime-progress.json','m78-get-route-recovery2-runtime-progress.json').replace('m78-get-route-recovery-runtime-collection.json','m78-get-route-recovery2-runtime-collection.json').replace('m78-get-route-recovery-runtime-verified.json','m78-get-route-recovery2-runtime-verified.json');self.assertEqual(current,expected)
  self.assertEqual(current.count('serviceInstanceDeployV2'),2);self.assertNotIn('mutation ',current);self.assertIn("['deployment','list'",current);self.assertIn("['api','--file'",current);self.assertIn("urlopen('https://www.neuvetra.ai/ready'",current);self.assertIn("open('xb')",current);self.assertIn("open('x',encoding='utf-8'",current)
  tree=ast.parse(SOURCE);imports={alias.name for node in tree.body if isinstance(node,ast.Import) for alias in node.names};self.assertEqual(imports,{'json','hashlib','subprocess'})
  closure_source=ROOT(CLOSURE).read_text(encoding='utf-8');self.assertIn("import ts from 'typescript'",closure_source);self.assertNotIn('fetch(',closure_source);self.assertNotIn('Bun.spawn',closure_source)
  evaluator=ROOT('.superpowers/m78-readonly-recovery2-evaluate.ts').read_text(encoding='utf-8');self.assertNotIn('globalThis.fetch',evaluator);self.assertNotIn('/auth/v1/',evaluator);self.assertNotIn('Bun.spawn',evaluator);self.assertIn("open('.superpowers/m78-readonly-recovery2-evaluation.json','wx',0o600)",evaluator)

if __name__=='__main__':unittest.main()
