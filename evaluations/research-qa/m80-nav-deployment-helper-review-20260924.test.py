"""Offline mocks only: never invokes Git, Railway, a provider, or a network."""
import contextlib, datetime, hashlib, io, json, os, pathlib, runpy, subprocess, sys, tempfile, unittest
from unittest.mock import patch

ROOT=pathlib.Path(__file__).resolve().parents[2]
HELPER=ROOT/'.superpowers/m80-nav-deploy-once.py'
COMMIT='1'*40
NAV='apps/site-web/src/components/StagingWorkspace.tsx'
NAMES=['GHG calculation specifications and engine','Offline research catalog tests','Typecheck, lint, unit tests and web builds','Dedicated staging image and offline runtime smoke','Role routing and evidence records','Native PostgreSQL worksheet and tenant regression']
BASELINE='9dd9c85fb674528a2c1dd1b0138f5a2d87ba683e'
IMAGE='sha256:3e4c2c91591a5598a85f63b4099b1b4890588ce79ec832b21b7d284b5aa89d1b'

class FakeResponse(io.BytesIO):
 status=200

class Review(unittest.TestCase):
 def exercise(self, change=None, replay=False):
  with tempfile.TemporaryDirectory(prefix='m80-nav-helper-qa-') as tmp:
   tmp=pathlib.Path(tmp);(tmp/'.superpowers').mkdir();digest=hashlib.sha256(HELPER.read_bytes()).hexdigest()
   qa={'verdict':'pass_navigation_deployment_helper_only','helper_sha256':digest}
   ci={'sha':COMMIT,'pr_head':COMMIT,'state':'open','observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'checks':[{'name':n,'status':'completed','conclusion':'success'} for n in NAMES]}
   config={'qa':qa,'ci':ci,'extra':[],'runtimeChanges':[NAV],'corruptBlob':False,'ready':{'status':'ready','profile':'neuvetra.private-synthetic-staging.v1','schemaVersion':21,'legacyContainmentVerified':True},'auto':False,'liveStatus':'SUCCESS','image':IMAGE,'remote':COMMIT,'networkReturn':0,'extraDeployments':[]}
   if change:change(config)
   (tmp/'review.json').write_text(json.dumps(qa),encoding='utf8')
   admission={'commit':COMMIT,'status':'independently_reviewed_navigation_deployment','helper_sha256':digest,'review':{'path':'review.json','sha256':hashlib.sha256((tmp/'review.json').read_bytes()).hexdigest()}}
   (tmp/'.superpowers/m80-nav-deployment-admission.json').write_text(json.dumps(admission),encoding='utf8')
   (tmp/'.superpowers/m80-current-checks.json').write_text(json.dumps(ci),encoding='utf8')
   (tmp/'.superpowers/m78-auto-status.graphql').write_bytes((ROOT/'.superpowers/m78-auto-status.graphql').read_bytes())
   mutations=[];reads=[]
   def read_command(args,**kwargs):
    reads.append(args)
    if args[0]=='git':
     args=args[5:]
     if args[0]=='rev-parse':return (COMMIT+'\n').encode()
     if args[0]=='ls-remote':return (config['remote']+'\trefs/heads/codex/corporate-mvp\n').encode()
     if args[0]=='merge-base':return b''
     if args[0]=='diff':return ('\n'.join(config['runtimeChanges'] if '--' in args else [NAV,*config['extra']])+'\n').encode()
     if args[0]=='show':return (ROOT/args[1].split(':',1)[1]).read_bytes()+(b'CORRUPTED' if config['corruptBlob'] else b'')
     raise AssertionError('Unrecognized mocked Git read '+repr(args))
    if 'deployment' in args:return json.dumps([{'id':'f6d77b2e-6886-429b-a4d2-4873c9199ce8','status':config['liveStatus'],'meta':{'commitHash':BASELINE,'imageDigest':config['image']}},*config['extraDeployments']]).encode()
    if 'api' in args:return json.dumps({'data':{'serviceInstanceAutoDeployStatus':{'enabled':config['auto']}}}).encode()
    raise AssertionError('Unrecognized mocked read')
   def mutate(args,**kwargs):
    if args[:2]==['git','merge-base']:return subprocess.CompletedProcess(args,0,b'',b'')
    self.assertTrue((tmp/'.superpowers/m80-nav-deployment-intent.json').is_file())
    self.assertTrue((tmp/'.superpowers/m80-nav-deployment-response.json').is_file())
    mutations.append(args)
    return subprocess.CompletedProcess(args,config['networkReturn'],json.dumps({'data':{'serviceInstanceDeployV2':'fictional-deployment'}}).encode(),b'')
   original=pathlib.Path.cwd();os.chdir(tmp)
   error=None;second_error=None
   try:
    with patch.object(sys,'argv',[str(HELPER),COMMIT]),patch('subprocess.check_output',read_command),patch('subprocess.check_call',lambda *args,**kw:0),patch('subprocess.run',mutate),patch('urllib.request.urlopen',lambda *args,**kw:FakeResponse(json.dumps(config['ready']).encode())),contextlib.redirect_stdout(io.StringIO()):
     try:runpy.run_path(str(HELPER),run_name='__main__')
     except BaseException as exc:error=type(exc).__name__+':'+str(exc)
     if replay:
      try:runpy.run_path(str(HELPER),run_name='__main__')
      except BaseException as exc:second_error=type(exc).__name__
   finally:os.chdir(original)
   return {'error':error,'second_error':second_error,'mutations':len(mutations),'intent':(tmp/'.superpowers/m80-nav-deployment-intent.json').exists()}

 def test_positive_exact_commit_and_once_only_replay(self):
  result=self.exercise(replay=True);self.assertIsNone(result['error']);self.assertIsNotNone(result['second_error']);self.assertEqual(result['mutations'],1)

 def test_uncertain_mutation_cannot_repeat(self):
  result=self.exercise(lambda c:c.update(networkReturn=1),replay=True);self.assertIsNotNone(result['error']);self.assertIsNotNone(result['second_error']);self.assertTrue(result['intent']);self.assertEqual(result['mutations'],1)

 def test_reject_unsafe_inputs_before_mutation(self):
  cases={
   'old QA bound to other helper':lambda c:c['qa'].update(helper_sha256='0'*64),
   'duplicate successful checks':lambda c:c['ci']['checks'].append(dict(c['ci']['checks'][0])),
   'failed check':lambda c:c['ci']['checks'][0].update(conclusion='failure'),
   'stale checks':lambda c:c['ci'].update(observed_at=(datetime.datetime.now(datetime.timezone.utc)-datetime.timedelta(minutes=4)).isoformat()),
   'future checks':lambda c:c['ci'].update(observed_at=(datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(minutes=4)).isoformat()),
   'mismatched head':lambda c:c.update(remote='2'*40),
   'changed runtime config':lambda c:c['extra'].append('Dockerfile'),
   'unreviewed adapter change':lambda c:c['runtimeChanges'].append('packages/neuvetra-database/src/workspace.ts'),
   'changed accepted blob':lambda c:c.update(corruptBlob=True),
   'auto deployment enabled':lambda c:c.update(auto=True),
   'wrong prior image':lambda c:c.update(image='sha256:'+'0'*64),
   'schema22 readiness':lambda c:c['ready'].update(schemaVersion=22),
   'unknown active deployment':lambda c:c['extraDeployments'].append({'id':'another-deployment','status':'DEPLOYING','meta':{}}),
  }
  for name,change in cases.items():
   with self.subTest(name=name):
    result=self.exercise(change);self.assertIsNotNone(result['error']);self.assertEqual(result['mutations'],0)

if __name__=='__main__':unittest.main()
