import copy,importlib.util,json,os,tempfile,unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('recovery',Path(__file__).with_name('m80-provider-recovery21-independent-20260924-candidate1-frozen.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class RecoveryTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory(prefix='m80_recovery_test_');self.old=Path.cwd();os.chdir(self.tmp.name);Path('.superpowers').mkdir()
  stamp=m.s.utc().isoformat()
  self.pins=[{'path':m.BRIDGE,'sha256':'1'*64},{'path':'.superpowers/m80-backup-hosted-entry.ts','sha256':'2'*64}]
  self.receipt={'profile':'neuvetra.m80.foundation-backup-source-inspection.v1','observedAt':stamp,'projectRef':m.PROJECT_REF,'sourceSchemaVersion':21,'migrationReceiptCount':21,'activeRuntimeSessionCount':0,'noActiveRuntimeSessions':True,'readOnly':True,'applicationOnly':True,'providerRecoveryExcluded':True,'observedNonReceiptTables':['a','b'],'observedNonReceiptTableCount':2,'applicationStateSha256':'3'*64,'sourceHelperPins':{'pins':self.pins}}
  self.rows=[{'id':m.s.PRIOR_DEPLOYMENT,'status':'REMOVED','meta':{'commitHash':m.s.PRIOR_COMMIT,'imageDigest':m.s.PRIOR_IMAGE}}]
 def tearDown(self):os.chdir(self.old);self.tmp.cleanup()
 def test_observations_refuse_wrong_schema_sessions_stale_and_sources(self):
  m.validate_observations(self.receipt,self.rows,False,self.pins)
  for key,value in [('sourceSchemaVersion',22),('migrationReceiptCount',22),('projectRef','foreign'),('activeRuntimeSessionCount',1),('noActiveRuntimeSessions',False),('readOnly',False),('observedAt','2000-01-01T00:00:00+00:00'),('sourceHelperPins',{'pins':[]})]:
   bad={**self.receipt,key:value}
   with self.assertRaises(Exception):m.validate_observations(bad,self.rows,False,self.pins)
  with self.assertRaises(Exception):m.validate_observations(self.receipt,self.rows,True,self.pins)
  rows=copy.deepcopy(self.rows);rows[0]['status']='SUCCESS'
  with self.assertRaises(Exception):m.validate_observations(self.receipt,rows,False,self.pins)
 def test_any_migration_attempt_blocks_old_app(self):
  Path('.superpowers/m80-foundation-hosted-fictional-migration-intent.json').write_bytes(b'partial')
  with self.assertRaises(Exception):m.no_migration()
  with self.assertRaises(Exception):m.validate_observations(self.receipt,self.rows,False,self.pins)
 def test_review_requires_named_reviewer_and_current_full_sources(self):
  source=Path('.superpowers/example.py');source.write_bytes(b'# test only\n')
  snapshot=Path('snapshot.json');snapshot.write_text(json.dumps({'artifacts':[{'path':source.as_posix(),'sha256':m.s.digest(source),'text':source.read_bytes().decode()}]}))
  body={'reviewer':m.s.REVIEWER,'verdict':'pass_test','source_snapshot':{'path':str(snapshot),'sha256':m.s.digest(snapshot)},'source_pins':[{'path':source.as_posix(),'sha256':m.s.digest(source)}]}
  receipt=Path('review.json')
  def check(value):
   receipt.write_text(json.dumps(value));return m.review({'path':str(receipt),'sha256':m.s.digest(receipt)},'pass_test',[source.as_posix()])
  check(body)
  with self.assertRaises(Exception):check({**body,'reviewer':None})
  with self.assertRaises(Exception):check({**body,'source_pins':[]})
  source.write_bytes(b'changed')
  with self.assertRaises(Exception):check(body)
 def test_actual_main_uncertain_attempt_is_durable_and_not_replayed(self):
  m.GATE.write_text('{}');mutations=[]
  def run(args,**kwargs):
   if args[0]=='powershell':
    m.INSPECT.write_text(json.dumps(self.receipt));return SimpleNamespace(returncode=0)
   self.assertTrue(m.INTENT.exists());self.assertEqual(json.loads(m.INTENT.read_bytes())['state'],'attempt_reserved_no_retry');mutations.append(args);raise TimeoutError('test only')
  def output(args):return json.dumps(self.rows if 'list' in args else {'data':{'serviceInstanceAutoDeployStatus':{'enabled':False}}}).encode()
  with patch.object(m,'validate_gate',return_value=self.pins),patch.object(m.s,'output',side_effect=output),patch.object(m.subprocess,'run',side_effect=run):
   with self.assertRaises(TimeoutError):m.main('fictional-export-path')
   original=m.INTENT.read_bytes()
   with self.assertRaises(RuntimeError):m.main('fictional-export-path')
  self.assertEqual(len(mutations),1);self.assertEqual(original,m.INTENT.read_bytes());self.assertEqual(json.loads(m.RESPONSE.read_bytes())['outcome'],'uncertain_do_not_retry')

if __name__=='__main__':unittest.main()
