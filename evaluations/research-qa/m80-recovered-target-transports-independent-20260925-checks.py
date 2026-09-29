import ast,hashlib,json,types,unittest,importlib.util
from pathlib import Path
ROOT=Path.cwd()
P='evaluations/research-qa/m80-recovered-target-transports-independent-20260925'
sha=lambda b:hashlib.sha256(b).hexdigest()
def write(p,v):Path(p).write_bytes((json.dumps(v,indent=2)+'\n').encode())
snaps=[]
for n,h in [(1,'b319c24eff3f57f765052bd244e6093cb5f179a8fb133ecf70ecc89043e58c2d'),(2,'4ca9f69ea372741fd597820ddb9013270d398ceb7c7a2bbde06d91ff9191f56d')]:
 p=Path(f'operations/agent-improvement/snapshots/M80-RECOVERED-TARGET-TRANSPORTS-20260925-CANDIDATE{n}.json');assert sha(p.read_bytes())==h
 s=json.loads(p.read_bytes());snaps.append(s)
 for a in s['artifacts']:assert sha(a['text'].encode())==a['sha256']
for a in snaps[1]['artifacts']:assert sha(Path(a['path']).read_bytes())==a['sha256']
old={a['path']:a for a in snaps[0]['artifacts']};new={a['path']:a for a in snaps[1]['artifacts']}
r='.superpowers/m80-provider-recover21-recovered.py'
assert old[r]['text'].replace("['.superpowers/m80-provider-recover21.py','.superpowers/m80-provider-stop.py']","['.superpowers/m80-provider-recover21-recovered.py','.superpowers/m80-provider-stop-recovered21.py']")==new[r]['text']
for p in ['.superpowers/m80-provider-stop-recovered21.py','.superpowers/m80-provider-observe-recovered21.py']:assert old[p]==new[p]
# Exact additive substitutions from accepted immutable old source.
for change in json.loads(Path('.superpowers/m80-recovered21-transports-draft-map.json').read_bytes())['changes']:
 b=Path(change['source']).read_bytes();assert sha(b)==change['source_sha256'];text=b.decode()
 for before,after in change['exact_substitutions']:assert before in text;text=text.replace(before,after)
 assert text==old[change['candidate']]['text']
# Reuse retained independent negative/main suites against CURRENT frozen C2 modules.
# All process/provider/network calls are mocked by these suites; private outputs use temp roots.
def module(path,name):
 spec=importlib.util.spec_from_file_location(name,ROOT/path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
stop=module('.superpowers/m80-provider-stop-recovered21.py','qa_recovered_stop')
recovery=module(r,'qa_recovered_recovery')
fixture=types.ModuleType('fixture');fixture.__file__=str(ROOT/(P+'-checks.py'))
source=Path('evaluations/research-qa/m80-provider-stop-independent-20260924-candidate2-fixture.py').read_text(encoding='utf8')
start=source.index('spec=importlib');end=source.index('\nclass StopTests')
source=source[:start]+'m=STOP\n'+source[end:];fixture.STOP=stop;fixture.__name__='qa_fixture';exec(compile(source,fixture.__file__,'exec'),fixture.__dict__)
controls=types.ModuleType('controls');controls.__file__=fixture.__file__;controls.FIXTURE=fixture
source=Path('evaluations/research-qa/m80-provider-stop-independent-20260924-candidate2-controls.py').read_text(encoding='utf8')
start=source.index('spec=importlib');end=source.index('\nclass Controls')
source=source[:start]+'f=FIXTURE;m=f.m\n'+source[end:];source=source.replace('m80-provider-stop-independent-20260924-candidate2-controls.json',Path(P+'-stop-controls.json').name)
exec(compile(source,controls.__file__,'exec'),controls.__dict__)
rc=types.ModuleType('recovery_controls');rc.__file__=fixture.__file__;rc.RECOVERY=recovery
source=Path('evaluations/research-qa/m80-provider-recovery21-independent-20260924-candidate2-controls.py').read_text(encoding='utf8')
start=source.index('spec = importlib');end=source.index('\nSNAP =')
source=source[:start]+'m=RECOVERY\n'+source[end:]
source=source.replace('M80-PROVIDER-RECOVERY21-20260924-CANDIDATE2.json','M80-RECOVERED-TARGET-TRANSPORTS-20260925-CANDIDATE2.json').replace("PREFIX = 'm80-provider-recovery21-independent-20260924-candidate2-'","PREFIX = 'm80-recovered-target-transports-independent-20260925-recovery-'")
exec(compile(source,rc.__file__,'exec'),rc.__dict__)
suite=unittest.TestSuite([unittest.defaultTestLoader.loadTestsFromModule(m) for m in [fixture,controls,rc]])
result=unittest.TextTestRunner(verbosity=1).run(suite);assert result.wasSuccessful()
# Observer exact accepted source derivation preserves pre-import pin and no-redirect read logic.
obs=Path('.superpowers/m80-provider-observe-readonly-v2.py').read_bytes();assert sha(obs)=='d521e6290c8feeacb33536c5e17744e74480efae121f1ac9d14aac6f5f691374'
t=obs.decode().replace('\r\n','\n').replace('m80-provider-stop.py','m80-provider-stop-recovered21.py').replace('a555f5d5dfcbb21ae3fe59cc3d4f6f6a803c37b85ab442e31177e329b317d62d','033e4d550aaa490471536deb808b0065f1bf4f36ea1644712b5c1bb6793a7ca2')
assert t==new['.superpowers/m80-provider-observe-recovered21.py']['text']
assert 'm80-foundation-hosted-*-migration-intent.json' in new[r]['text']
write(P+'-checks.json',{'candidate2_exact':True,'candidate1_entrypoint_failure_preserved':True,'derivation_exact':True,'tests':result.testsRun,'stop_mock_cases':6,'recovery_mock_cases':13,'observer':'Exact path/hash substitutions plus CRLF to LF from accepted source; no observer network execution','global_migration_lock':'unchanged across target/version; checked before/after inspection and after durable recovery intent','boundaries':'All network, Git, credential, provider, subprocess observations/mutations mocked. Real isolated temp-file writes and fsync only.'})
