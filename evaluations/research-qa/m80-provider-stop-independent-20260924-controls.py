import importlib.util,json,subprocess,unittest
from pathlib import Path
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('stop_frozen_fixture',Path(__file__).with_name('m80-provider-stop-independent-20260924-candidate1-fixture.py'))
f=importlib.util.module_from_spec(spec);spec.loader.exec_module(f);m=f.m
class Controls(unittest.TestCase):
 def exercise(self,outcome='success',sync_failure=None):
  fixture=f.StopTests('test_review_and_target_fail_closed');fixture.setUp();events=[];commands=[];synced=[]
  try:
   m.GATE.parent.mkdir();m.GATE.write_bytes(json.dumps(fixture.gate).encode());Path('.superpowers/m80-current-checks.json').write_bytes(json.dumps(fixture.checks).encode())
   class Ready:
    status=200
    def __enter__(self):return self
    def __exit__(self,*args):pass
    def read(self):return json.dumps(fixture.ready).encode()
   def output(args):commands.append(args);return json.dumps(fixture.rows if 'list' in args else {'data':{'serviceInstanceAutoDeployStatus':{'enabled':False}}}).encode()
   actual_sync=m.os.fsync
   def sync(fd):
    synced.append(fd);events.append('sync')
    if sync_failure==len(synced):raise OSError('synthetic sync failure')
    actual_sync(fd)
   def mutation(args,**kwargs):
    self.assertEqual(events[:2],['sync','sync']);self.assertEqual(len(synced),2);self.assertTrue(m.INTENT.exists());self.assertIn(m.PRIOR_DEPLOYMENT,m.QUERY.read_text());events.append('mutation')
    if outcome=='timeout':raise subprocess.TimeoutExpired(args,55)
    if outcome=='malformed':return subprocess.CompletedProcess(args,0,b'not-json',b'')
    reply={'data':{'deploymentRemove':outcome=='success'}}
    return subprocess.CompletedProcess(args,0,json.dumps(reply).encode(),b'')
   error=None
   with patch.object(m,'output',side_effect=output),patch.object(m,'git',return_value=fixture.head),patch.object(m.urllib.request,'urlopen',return_value=Ready()),patch.object(m.subprocess,'run',side_effect=mutation),patch.object(m.os,'fsync',side_effect=sync):
    try:m.main()
    except Exception as e:error=type(e).__name__
    original=m.INTENT.read_bytes() if m.INTENT.exists() else None
    with self.assertRaises(RuntimeError):m.main()
    if original is not None:self.assertEqual(m.INTENT.read_bytes(),original)
   if sync_failure:self.assertNotIn('mutation',events)
   else:self.assertEqual(events.count('mutation'),1);self.assertTrue(m.RESPONSE.exists())
   if outcome!='success' or sync_failure:self.assertIsNotNone(error)
   else:self.assertIsNone(error)
   return {'outcome':outcome,'sync_failure':sync_failure,'events':events,'error':error,'observed_read_commands':commands,'response':json.loads(m.RESPONSE.read_bytes()) if m.RESPONSE.exists() else None}
  finally:fixture.tearDown()
 def test_synced_once_and_uncertainty(self):
  self.results=[self.exercise(outcome) for outcome in ['success','timeout','malformed','refused']]
  self.results.extend(self.exercise(sync_failure=i) for i in [1,2])
  (ROOT/'evaluations/research-qa/m80-provider-stop-independent-20260924-controls.json').write_bytes((json.dumps({'boundary':'Frozen main, real isolated file writes/fsync, all network/provider/process observations and mutation mocked','cases':self.results},indent=2)+'\n').encode())
if __name__=='__main__':unittest.main()
