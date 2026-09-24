import io,json,hashlib,importlib.util,os,shutil,tempfile,unittest
from pathlib import Path
from datetime import datetime,timezone,timedelta
ROOT=Path(__file__).resolve().parents[2]
def load(name,path):
 spec=importlib.util.spec_from_file_location(name,ROOT/path);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module
admit=load('restart_admit','.superpowers/m78-recovery2-restart-admit.py');request=load('restart_request','.superpowers/m78-recovery2-request-restart.py');collect=load('restart_collect','.superpowers/m78-recovery2-collect-startup.py')
sha=lambda value:hashlib.sha256(value).hexdigest()
class Response(io.BytesIO):
 status=200
 def __enter__(self):return self
 def __exit__(self,*_):self.close()
def urlopen(*_args,**_kwargs):return Response(json.dumps(admit.READY).encode())
class Result:
 def __init__(self,stdout=b'',returncode=0):self.stdout=stdout;self.returncode=returncode;self.stderr=b''
class Boundary:
 def __init__(self,validated,multiple=False,wrong_image=False,mutation_error=False):self.validated=validated;self.multiple=multiple;self.wrong_image=wrong_image;self.mutation_error=mutation_error;self.mutations=0
 def __call__(self,args,**_kwargs):
  joined=' '.join(args)
  if args[0].endswith('bun.exe'):return Result(json.dumps(self.validated).encode())
  if 'deployment list' in joined:
   image='sha256:'+'0'*64 if self.wrong_image else admit.IMAGE;return Result(json.dumps([{'id':admit.DEPLOYMENT,'status':'SUCCESS','meta':{'commitHash':admit.COMMIT,'imageDigest':image}}]).encode())
  if 'serviceInstanceAutoDeployStatus' in joined:return Result(json.dumps({'data':{'serviceInstanceAutoDeployStatus':{'enabled':False}}}).encode())
  if 'deploymentRestart' in joined:
   self.mutations+=1
   return Result(b'',1) if self.mutation_error else Result(json.dumps({'data':{'deploymentRestart':True}}).encode())
  if ' logs ' in ' '+joined+' ':
   rows=[{'timestamp':'2026-09-23T05:02:00.000Z','message':json.dumps({'event':'staging_started'})}]
   if self.multiple:rows.append({'timestamp':'2026-09-23T05:02:30.000Z','message':json.dumps({'event':'staging_started'})})
   return Result(('\n'.join(json.dumps(row) for row in rows)+'\n').encode())
  raise AssertionError(args)
def validated():return {'status':'m78_readonly_recovery2_restart_validation_passed','actualQa':{'path':admit.QA_PATH,'sha256':'a'*64},'reviewAdmission':{'observationSha256':'b'*64},'runtime':{'commit':admit.COMMIT,'deploymentId':admit.DEPLOYMENT,'imageDigest':admit.IMAGE,'autodeploy':False},'completedAt':'2026-09-23T05:00:00.000Z','recoveryObservationSha256':'b'*64,'recoverySourceGateSha256':'c'*64,'failedRecoveryLock':{'path':'failed.lock','sha256':'d'*64},'recovery2Lock':{'path':'recovery2.lock','sha256':'e'*64}}
class RestartPreparation(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.old=os.getcwd();os.chdir(self.temp.name);Path('.superpowers').mkdir();self.now=datetime(2026,9,23,5,1,tzinfo=timezone.utc)
  for path in admit.HELPERS:shutil.copy2(ROOT/path,Path(path))
 def tearDown(self):os.chdir(self.old);self.temp.cleanup()
 def prepare_admission(self,boundary=None):
  boundary=boundary or Boundary(validated());value=admit.build_admission(admit.QA_PATH,'a'*64,boundary,urlopen,lambda:self.now);raw=Path(admit.OUT).read_bytes();return value,raw,boundary
 def test_complete_mocked_chain_has_four_status_contract_inputs_and_one_mutation(self):
  admission,raw,boundary=self.prepare_admission();self.assertEqual(admission['status'],'m78_readonly_recovery2_restart_admitted');self.assertFalse(admission['runtime']['autodeploy'])
  intent,ack=request.request_restart(request.ADMISSION,sha(raw),boundary,lambda:self.now+timedelta(seconds=30),lambda:'fixed-request-id');self.assertEqual(intent['status'],'m78_readonly_recovery2_restart_requested');self.assertEqual(ack,{'data':{'deploymentRestart':True}});self.assertEqual(boundary.mutations,1)
  request_raw=Path(request.INTENT).read_bytes();ack_raw=Path(request.ACK).read_bytes();receipt=collect.collect_startup(collect.REQUEST,sha(request_raw),collect.ACK,sha(ack_raw),boundary,urlopen,lambda:self.now+timedelta(minutes=3));self.assertEqual(receipt['status'],'m78_readonly_recovery2_restart_startup_observed');self.assertEqual(receipt['startupEvents'],1);self.assertEqual(receipt['providerStartup']['event'],'staging_started');self.assertEqual(receipt['ready']['schemaVersion'],21);self.assertTrue(Path(collect.LOGS).exists())
 def test_wrong_provider_state_refuses_before_admission(self):
  boundary=Boundary(validated(),wrong_image=True)
  with self.assertRaisesRegex(RuntimeError,'wrong provider deployment'):admit.build_admission(admit.QA_PATH,'a'*64,boundary,urlopen,lambda:self.now)
  self.assertFalse(Path(admit.OUT).exists());self.assertEqual(boundary.mutations,0)
 def test_stale_admission_refuses_before_intent_or_mutation(self):
  _,raw,boundary=self.prepare_admission()
  with self.assertRaisesRegex(RuntimeError,'stale admission'):request.request_restart(request.ADMISSION,sha(raw),boundary,lambda:self.now+timedelta(hours=1),lambda:'id')
  self.assertFalse(Path(request.INTENT).exists());self.assertEqual(boundary.mutations,0)
 def test_helper_source_drift_refuses_before_intent_and_collection(self):
  _,raw,boundary=self.prepare_admission();Path(admit.HELPERS[0]).write_text('changed',encoding='utf-8')
  with self.assertRaisesRegex(RuntimeError,'restart helper changed'):request.request_restart(request.ADMISSION,sha(raw),boundary,lambda:self.now+timedelta(seconds=30),lambda:'id')
  self.assertFalse(Path(request.INTENT).exists());self.assertEqual(boundary.mutations,0)
  shutil.copy2(ROOT/admit.HELPERS[0],Path(admit.HELPERS[0]));request.request_restart(request.ADMISSION,sha(raw),boundary,lambda:self.now+timedelta(seconds=30),lambda:'id');request_raw=Path(request.INTENT).read_bytes();ack_raw=Path(request.ACK).read_bytes();Path(admit.HELPERS[3]).write_text('changed collector',encoding='utf-8')
  with self.assertRaisesRegex(RuntimeError,'restart helper changed'):collect.collect_startup(collect.REQUEST,sha(request_raw),collect.ACK,sha(ack_raw),boundary,urlopen,lambda:self.now+timedelta(minutes=3))
  self.assertFalse(Path(collect.LOGS).exists());self.assertFalse(Path(collect.STARTUP).exists())
 def test_uncertain_restart_retains_exactly_one_intent_and_no_ack(self):
  _,raw,_=self.prepare_admission();boundary=Boundary(validated(),mutation_error=True)
  with self.assertRaisesRegex(RuntimeError,'uncertain'):request.request_restart(request.ADMISSION,sha(raw),boundary,lambda:self.now+timedelta(seconds=30),lambda:'id')
  self.assertTrue(Path(request.INTENT).exists());self.assertFalse(Path(request.ACK).exists());self.assertEqual(boundary.mutations,1)
  with self.assertRaisesRegex(RuntimeError,'already attempted'):request.request_restart(request.ADMISSION,sha(raw),boundary,lambda:self.now+timedelta(seconds=40),lambda:'id2')
  self.assertEqual(boundary.mutations,1)
 def test_ambiguous_startups_write_no_collection(self):
  _,raw,boundary=self.prepare_admission();request.request_restart(request.ADMISSION,sha(raw),boundary,lambda:self.now+timedelta(seconds=30),lambda:'id');request_raw=Path(request.INTENT).read_bytes();ack_raw=Path(request.ACK).read_bytes();collector=Boundary(validated(),multiple=True)
  with self.assertRaisesRegex(RuntimeError,'exactly one'):collect.collect_startup(collect.REQUEST,sha(request_raw),collect.ACK,sha(ack_raw),collector,urlopen,lambda:self.now+timedelta(minutes=3))
  self.assertFalse(Path(collect.LOGS).exists());self.assertFalse(Path(collect.STARTUP).exists())
if __name__=='__main__':unittest.main()
