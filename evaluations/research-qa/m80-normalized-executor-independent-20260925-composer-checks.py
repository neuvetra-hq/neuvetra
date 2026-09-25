import json,hashlib,copy,datetime,types,ast
from pathlib import Path
P='evaluations/research-qa/m80-normalized-executor-independent-20260925-composer-';module={'__name__':'independent_offline_composer'};source=Path('.superpowers/m80-compose-hosted-input-v4.py').read_bytes();exec(compile(source,'frozen-composer-v2','exec'),module)
f=json.loads(Path(P+'fixture.json').read_bytes());v=f['input'];now=v['publication']['headObservedAt'];H=lambda b:hashlib.sha256(b).hexdigest();B=lambda o:(json.dumps(o,indent=2)+'\n').encode();fakeOwnerPath='.superpowers/m80-signedin-manager-observation-20260925-001.json';manifestPath='.superpowers/m80-normalized-upgrade-publication-manifest.json';publicationPath='.superpowers/m80-normalized-upgrade-published.json'
db={'profile':'neuvetra.m80.foundation-backup-source-preflight.v1','projectRef':v['observedTarget']['projectRef'],'sourceSchemaVersion':21,'migrationReceiptCount':21,'observedNonReceiptTableCount':120,'observedNonReceiptTables':v['observedTarget']['observedNonReceiptTables'],'observedAt':now,'applicationStateSha256':v['observedTarget']['applicationStateSha256'],'existingSyntheticCompanyManagers':[{k:v['admission'][k] for k in ['companyId','managerUserId','managerRole']}],**{k:True for k in ['readOnly','applicationOnly','providerRecoveryExcluded','runtimeSessionsAllowedDuringPreflight','existingSyntheticCompanyVerified','existingManagerMembershipsVerified','noCompanyCreation','noUserCreation','noRoleOrPermissionCreation']}}
owner={'profile':'neuvetra.m80.signed-in-manager-observation.v1',**{k:v['admission'][k] for k in ['companyId','managerUserId','managerRole']},**{k:True for k in ['verifiedUserProvidedEmail','emailConfirmed','existingSyntheticCompanyVerified','existingManagerMembershipVerified','readOnly']}}
provider={'profile':'neuvetra.m80.provider-readonly-observation.v1','mode':'baseline','read_only':True,'automatic_deployments_enabled':False,'active_deployment_count':1,'origin_http_status':200,'project':'119f3652-9d84-4d16-983c-1a17c0fd1aaa','environment':v['observedTarget']['environmentId'],'service':v['observedTarget']['serviceId'],'readiness':{'status':'ready','profile':'neuvetra.private-synthetic-staging.v1','schemaVersion':21,'legacyContainmentVerified':True},'observed_at':v['observedTarget']['observedAt'],'deployments':[{'id':v['observedTarget']['deploymentId'],'status':'SUCCESS','meta':{'commitHash':v['observedTarget']['deployedCommitSha'],'imageDigest':'sha256:'+v['observedTarget']['deployedImageSha256']}}]}
ci={'pr':'https://github.com/neuvetra-hq/neuvetra/pull/6','state':'open','checks':v['publication']['requiredChecks'],'observed_at':now,'sha':v['publication']['reviewedHeadCommitSha'],'pr_head':v['publication']['reviewedHeadCommitSha']}
virtual={fakeOwnerPath:owner,'virtual-db.json':db,'virtual-membership.json':copy.deepcopy(db),'virtual-provider.json':provider,'virtual-ci.json':ci,'virtual-backup.json':f['receipts']['backup']}
virtual['virtual-restore/m80-backup-v2-restore-receipt.json']=f['receipts']['restore'];virtual['virtual-restore/m80-backup-v2-preservation-receipt.json']=f['receipts']['preservation'];virtual['virtual-restore/m80-backup-v2-migration-receipt.json']=f['receipts']['rehearsal']
virtual['virtual-restore/m80-backup-v2-normalization-proof.json']=f['receipts']['normalization']

def pin(p):
 p=str(p).replace('\\','/');return {'path':p,'sha256':'018254d48c562334e08eb045bdb88624cc84d3290b2478cb552dcdab715e6d41' if p==fakeOwnerPath else H(B(virtual[p]) if p in virtual else Path(p).read_bytes())}
def read(p):
 p=str(p).replace('\\','/');return copy.deepcopy(virtual[p]) if p in virtual else json.loads(Path(p).read_bytes())
reviewPath='evaluations/research-qa/m80-normalized-upgrade-publication-independent-20260925-review.json'
virtual[manifestPath]={'profile':'m80.normalized-upgrade-publication-manifest.v1','base_commit':'d6d590aa0b46df0521127ef114d27deb101b0561','files':[pin('packages/neuvetra-database/src/migrations/0022_scope1_beta_foundation.sql')],'file_count':1}
virtual[reviewPath]={'reviewer':'/root/m80_foundation_runtime_qa','verdict':'pass_exact_normalized_upgrade_publication_manifest_only','manifest':pin(manifestPath)}
virtual[publicationPath]={'head':ci['sha'],'remote':ci['sha'],'manifest_sha256':pin(manifestPath)['sha256'],'review_sha256':pin(reviewPath)['sha256']}
class Clock(datetime.datetime):
 @classmethod
 def now(cls,tz=None):return datetime.datetime.fromisoformat(now.replace('Z','+00:00'))
module['datetime']=types.SimpleNamespace(datetime=Clock,timezone=datetime.timezone)
module.update(read=read,pin=pin)
args=[db,provider,copy.deepcopy(db),ci,owner];results=[]
assert module['validate_sources'](*copy.deepcopy(args));results.append({'case':'positive_with_real_public_accepted_closures','accepted':True})
neg=[]
for i,key,value in [(0,'profile','wrong'),(0,'projectRef','foreign'),(0,'sourceSchemaVersion',22),(0,'migrationReceiptCount',22),(0,'readOnly',False),(2,'existingManagerMembershipsVerified',False),(4,'emailConfirmed',False),(4,'verifiedUserProvidedEmail',False),(4,'managerRole','admin'),(1,'automatic_deployments_enabled',True),(1,'environment','foreign'),(1,'service','foreign'),(1,'project','foreign'),(1,'active_deployment_count',2),(1,'mode','stopped'),(1,'read_only',False),(3,'pr','https://github.com/other/repo/pull/6'),(3,'state','closed'),(3,'observed_at','2026-01-01T00:00:00.000Z'),(2,'observedAt','2026-01-01T00:00:00.000Z')]:
 a=copy.deepcopy(args);a[i][key]=value;neg.append((f'{i}_{key}',a))
a=copy.deepcopy(args);a[3]['checks'][0]['name']=a[3]['checks'][1]['name'];neg.append(('duplicate_check',a))
a=copy.deepcopy(args);a[3]['checks'][0]['conclusion']='failure';neg.append(('failed_check',a))
a=copy.deepcopy(args);a[1]['readiness']['schemaVersion']=22;neg.append(('wrong_readiness',a))
a=copy.deepcopy(args);a[1]['deployments'][0]['meta']['commitHash']='f'*40;neg.append(('wrong_commit',a))
for name,a in neg:
 rejected=False
 try:module['validate_sources'](*a)
 except (AssertionError,KeyError):rejected=True
 assert rejected,name;results.append({'case':name,'accepted':False})
# Run main only with injected read/pin/git/stdout/write; no real writes or subprocess.
for name in ['restore-receipt','preservation-receipt','normalization-proof']:virtual['virtual-restore/m80-backup-v2-'+name+'.json']['sourceBackupReceiptSha256']=pin('virtual-backup.json')['sha256']
virtual['virtual-restore/m80-backup-v2-preservation-receipt.json']['normalizationProof']=pin('virtual-restore/m80-backup-v2-normalization-proof.json')
written={}
def write(name,d):
 p='.superpowers/m80-foundation-hosted-live002-'+name+'.json';assert p not in written;written[p]=copy.deepcopy(d);virtual[p]=copy.deepcopy(d);return pin(p)
module.update(write=write,subprocess=types.SimpleNamespace(check_output=lambda argv:(ci['sha']+'\n').encode()),sys=types.SimpleNamespace(argv=['composer','virtual-db.json','virtual-provider.json','virtual-membership.json','virtual-ci.json','virtual-backup.json','virtual-restore']),print=lambda *a,**kw:None)
module['main']()
Path(P+'composed-synthetic.json').write_bytes(B({'synthetic':True,'input':written['.superpowers/m80-foundation-hosted-live002-input.json'],'evidence':virtual}))
Path(P+'checks.json').write_bytes(B({'boundary':'Exact composer loaded without main, validate_sources and main exercised with synthetic private observations/mocked publication, Git and writes; actual accepted public closure pins read. No network/DB/credentials/real helper outputs.', 'source_sha256':H(source),'results':results,'mocked_main_outputs':len(written)}))
print(json.dumps({'validation_cases':len(results),'mocked_main_outputs':len(written),'pass':True}))
