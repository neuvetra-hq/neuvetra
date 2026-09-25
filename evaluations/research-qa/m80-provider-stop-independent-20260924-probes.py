import importlib.util,json,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('author_fixture',ROOT/'.superpowers/m80-provider-stop-test.py')
fixture=importlib.util.module_from_spec(spec);spec.loader.exec_module(fixture)
case=fixture.StopTests('test_review_and_target_fail_closed');results=[]
case.setUp()
try:
 for key in ['independent_review','backup_transport_review','executor_transport_review','recovery_transport_review']:
  pin=case.gate[key];p=Path(pin['path']);original=p.read_bytes();original_hash=pin['sha256']
  for reviewer in [None,'','fictional-unregistered-reviewer','/root/m80_foundation_runtime']:
   value=json.loads(original);value['reviewer']=reviewer;p.write_bytes(json.dumps(value).encode());pin['sha256']=fixture.m.digest(p)
   try:case.check();results.append({'case':'reviewer_shape','receipt':key,'reviewer':reviewer,'accepted':True})
   except Exception as e:results.append({'case':'reviewer_shape','receipt':key,'reviewer':reviewer,'accepted':False,'error':str(e)})
  p.write_bytes(original);pin['sha256']=original_hash
 for key in ['backup_transport_review','executor_transport_review','recovery_transport_review']:
  pin=case.gate[key];p=Path(pin['path']);original=p.read_bytes();original_hash=pin['sha256'];value=json.loads(original)
  Path('unrelated.txt').write_bytes(b'Not a transport implementation\n');value['source_pins']=[{'path':'unrelated.txt','sha256':fixture.m.digest('unrelated.txt')}];p.write_bytes(json.dumps(value).encode());pin['sha256']=fixture.m.digest(p)
  try:case.check();results.append({'case':'unrelated_single_source_pin','receipt':key,'accepted':True})
  except Exception as e:results.append({'case':'unrelated_single_source_pin','receipt':key,'accepted':False,'error':str(e)})
  p.write_bytes(original);pin['sha256']=original_hash
finally:case.tearDown()
report={'candidate_sha256':'5ca69ee0744c54160b1d91e469703f5709ccdc51ea5bbcc5cc7bc54108ac3219','boundary':'Pure validate function with actual synthetic temporary pinned review files. No main/network/provider execution.','results':results}
(ROOT/'evaluations/research-qa/m80-provider-stop-independent-20260924-probes.json').write_bytes((json.dumps(report,indent=2)+'\n').encode())
print(json.dumps(report,indent=2))
