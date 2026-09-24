import hashlib, importlib.util, io, json, os, shutil, tempfile, unittest
from datetime import datetime, timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('collector2',ROOT/'.superpowers/m78-recovery2-collect-startup2.py')
collector=importlib.util.module_from_spec(spec);spec.loader.exec_module(collector)
sha=lambda value:hashlib.sha256(value).hexdigest()

class Response(io.BytesIO):
 status=200
 def __enter__(self):return self
 def __exit__(self,*_):self.close()

class Result:
 def __init__(self,stdout=b'',returncode=0):self.stdout=stdout;self.returncode=returncode;self.stderr=b''

class Boundary:
 def __init__(self,validated,logs):self.validated=validated;self.logs=logs;self.log_args=None
 def __call__(self,args,**_kwargs):
  joined=' '.join(args)
  if args[0].endswith('bun.exe'):return Result(json.dumps(self.validated).encode())
  if 'deployment list' in joined:return Result(json.dumps([{'id':collector.DEPLOYMENT,'status':'SUCCESS','meta':{'commitHash':collector.COMMIT,'imageDigest':collector.IMAGE}}]).encode())
  if 'serviceInstanceAutoDeployStatus' in joined:return Result(json.dumps({'data':{'serviceInstanceAutoDeployStatus':{'enabled':False}}}).encode())
  if ' logs ' in ' '+joined+' ':
   self.log_args=args
   return Result(self.logs)
  raise AssertionError(args)

class CollectorRepair(unittest.TestCase):
 def setUp(self):
  self.requested=datetime(2026,9,23,4,33,48,tzinfo=timezone.utc)

 def rows(self,*rows):return ('\n'.join(json.dumps(row) for row in rows)+'\n').encode()

 def test_flat_observed_shape_and_nested_legacy_shape(self):
  flat=self.rows({'profile':'service','timestamp':'2026-09-23T04:34:08.743321887Z','message':'','level':'info','event':'staging_started'})
  nested=self.rows({'timestamp':'2026-09-23T04:34:09Z','message':json.dumps({'event':'staging_started'})})
  self.assertEqual(collector.parse_startup_events(flat,self.requested),{'event':'staging_started','timestamp':'2026-09-23T04:34:08.743321887Z'})
  self.assertEqual(collector.parse_startup_events(nested,self.requested),{'event':'staging_started','timestamp':'2026-09-23T04:34:09Z'})

 def test_exact_duplicates_dedupe_but_distinct_startups_refuse(self):
  row={'timestamp':'2026-09-23T04:34:08Z','message':'','event':'staging_started'}
  self.assertEqual(collector.parse_startup_events(self.rows(row,row),self.requested)['timestamp'],row['timestamp'])
  with self.assertRaisesRegex(RuntimeError,'exactly one'):
   collector.parse_startup_events(self.rows(row,{**row,'timestamp':'2026-09-23T04:34:09Z'}),self.requested)

 def test_malformed_rows_refuse(self):
  with self.assertRaises((json.JSONDecodeError,RuntimeError)):collector.parse_startup_events(b'{broken\n',self.requested)
  with self.assertRaisesRegex(RuntimeError,'timestamp'):
   collector.parse_startup_events(self.rows({'event':'staging_started','message':''}),self.requested)

 def test_full_mock_uses_unfiltered_logs_and_records_collector_provenance(self):
  with tempfile.TemporaryDirectory() as directory:
   old=os.getcwd();os.chdir(directory)
   try:
    Path('.superpowers').mkdir()
    for path in collector.HELPERS+[collector.COLLECTOR,collector.ADMISSION,collector.REQUEST,collector.ACK]:
     target=Path(path);target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(ROOT/path,target)
    request_raw=Path(collector.REQUEST).read_bytes();ack_raw=Path(collector.ACK).read_bytes();request=json.loads(request_raw)
    logs=self.rows({'timestamp':'2026-09-23T04:34:08.743321887Z','event':'staging_started','message':'','profile':'service','level':'info'})
    boundary=Boundary(request['validatedRecovery'],logs)
    ready=lambda *_args,**_kwargs:Response(json.dumps(collector.READY).encode())
    receipt=collector.collect_startup(collector.REQUEST,sha(request_raw),collector.ACK,sha(ack_raw),boundary,ready,lambda:datetime(2026,9,23,4,35,tzinfo=timezone.utc))
    self.assertNotIn('--filter',boundary.log_args)
    self.assertEqual(receipt['providerStartup']['timestamp'],'2026-09-23T04:34:08.743321887Z')
    self.assertEqual(receipt['providerEvidence']['collector'],{'path':collector.COLLECTOR,'sha256':sha(Path(collector.COLLECTOR).read_bytes())})
    self.assertEqual(Path(collector.LOGS).read_text(),'{"event":"staging_started","timestamp":"2026-09-23T04:34:08.743321887Z"}\n')
   finally:os.chdir(old)

if __name__=='__main__':unittest.main()
