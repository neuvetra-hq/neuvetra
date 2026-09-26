import {expect,test}from'bun:test'
import {createHash}from'node:crypto'
import {chmod,copyFile,lstat,mkdir,mkdtemp,readFile,readdir,realpath,writeFile}from'node:fs/promises'
import {createRequire}from'node:module'
import {tmpdir}from'node:os'
import {dirname,join}from'node:path'
import {ARTIFACT_CONFIG,type ArtifactPaths,type ArtifactTrustPolicy,verifyHostedSetupArtifact}from'./hosted-setup-artifact-source'
import {materializeHostedSetupArtifact}from'./hosted-setup-artifact-materialize'
import {ARTIFACT_PUBLISHER_PROFILE,PR_CHECKS_EVIDENCE_PROFILE,PR_HEAD_EVIDENCE_PROFILE,PR_REVIEW_EVIDENCE_PROFILE,publishHostedSetupArtifact,type ArtifactPublisherPaths,type ArtifactPublisherPolicy}from'./hosted-setup-artifact-publisher'

const GIT=Bun.which('git');if(!GIT)throw Error('git required for artifact publisher tests')
const sha=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex')
async function put(path:string,value:string|Uint8Array){await mkdir(dirname(path),{recursive:true});await writeFile(path,value)}
async function command(root:string,...args:string[]){const child=Bun.spawn([GIT!,'-C',root,...args],{stdin:'ignore',stdout:'pipe',stderr:'pipe',windowsHide:true});const stdout=await new Response(child.stdout).text(),stderr=await new Response(child.stderr).text(),code=await child.exited;if(code!==0)throw Error(stderr);return stdout.trim()}
const migrationNames=[
 '0001_company_workspace.sql','0002_synthetic_bill_intake.sql','0003_synthetic_bill_calculation.sql','0004_inventory_review.sql','0005_annual_electricity_register.sql','0006_inventory_evidence_pack.sql','0007_inventory_draft_report.sql','0008_inventory_draft_report_review.sql','0009_private_staging.sql','0010_manual_electricity_worksheet.sql','0011_worksheet_reports.sql','0012_source_electricity_worksheet.sql','0013_annual_electricity_worksheet.sql','0014_annual_electricity_evidence.sql','0015_corporate_coverage.sql','0016_stationary_natural_gas.sql','0017_mobile_diesel.sql','0018_controlled_fleet.sql','0019_stationary_sources.sql','0020_fugitive_sources.sql','0021_scope1_inventory.sql','0022_scope1_beta_foundation.sql','0023_company_setup.sql',
]
interface FixtureOptions{workerImport?:string;missingDependency?:boolean;missingSource?:boolean;peerMode?:'optional-absent'|'required-absent'|'malformed'|'optional-present';actualDependencies?:boolean}
async function copyInstalledPgClosure(target:string){
 const initial=createRequire(new URL('../../packages/neuvetra-database/package.json',import.meta.url)),seen=new Map<string,string>()
 async function collect(name:string,from:ReturnType<typeof createRequire>,optional=false):Promise<void>{
  let packageFile:string;try{packageFile=await realpath(from.resolve(name+'/package.json'))}catch(error){if(optional&&(error as NodeJS.ErrnoException).code==='MODULE_NOT_FOUND')return;throw error}
  const metadata=JSON.parse(await readFile(packageFile,'utf8')),version=metadata.version as string
  if(seen.has(name)){if(seen.get(name)!==version)throw Error('installed closure version conflict');return}seen.set(name,version)
  const packageRoot=dirname(packageFile)
  async function walk(directory:string,prefix=''){for(const entry of await readdir(directory)){if(entry==='node_modules')continue;const path=join(directory,entry),stat=await lstat(path);if(stat.isSymbolicLink())throw Error('installed dependency link');if(stat.isDirectory())await walk(path,prefix+entry+'/');else if(stat.isFile())await put(join(target,'node_modules',name,prefix+entry),await readFile(path));else throw Error('installed dependency nonregular')}}
  await walk(packageRoot);const require=createRequire(packageFile)
  for(const child of Object.keys({...metadata.dependencies,...metadata.optionalDependencies}).sort())await collect(child,require)
  for(const child of Object.keys(metadata.peerDependencies??{}).sort())await collect(child,require,metadata.peerDependenciesMeta?.[child]?.optional===true)
 }
 await collect('pg',initial);return seen
}
async function fixture(options:FixtureOptions={}){
 const root=await mkdtemp(join(tmpdir(),'hosted-artifact-publisher-')),repo=join(root,'repo'),dependencies=join(root,'private-dependencies'),evidence=join(root,'authenticated-evidence'),output=join(root,'output');await mkdir(repo);await mkdir(dependencies);await mkdir(evidence);await mkdir(output)
 const source=new Map<string,string>([
  ['tools/staging/hosted-setup-artifact-worker.ts',`import './hosted-setup-artifact-bindings';import './hosted-setup-transactional-upgrade';import('./hosted-setup-artifact-source');import('./hosted-setup-dedicated-client');${options.workerImport??''}export const worker=true\n`],
  ['tools/staging/hosted-setup-artifact-bindings.ts',`import './hosted-setup-transactional-upgrade';export const bindings=true\n`],
  ['tools/staging/hosted-setup-transactional-upgrade.ts',`import '../../packages/neuvetra-database/src/staging-migrations';export const runner=true\n`],
  ['tools/staging/hosted-setup-artifact-source.ts',`export const source=true\n`],
  ['tools/staging/hosted-setup-dedicated-client.ts',`import '../../packages/neuvetra-database/src/staging-tls';export const client=true\n`],
  ['packages/neuvetra-database/src/staging-migrations.ts',`import './staging-audit';export const migrations=23\n`],
  ['packages/neuvetra-database/src/staging-audit.ts',`export const audit=true\n`],
  ['packages/neuvetra-database/src/staging-tls.ts',`export const tls=true\n`],
  ['packages/neuvetra-database/package.json','{"name":"@neuvetra/database","private":true,"type":"module"}\n'],
 ])
 if(options.missingSource)source.set('tools/staging/hosted-setup-artifact-bindings.ts',`import './absent-module';export const bindings=true\n`)
 for(const [path,value]of source)await put(join(repo,path),value)
 for(const[index,name]of migrationNames.entries())await put(join(repo,'packages/neuvetra-database/src/migrations',name),`-- synthetic migration ${index+1}\nselect ${index+1};\n`)
 await command(repo,'init','--quiet');await command(repo,'config','core.autocrlf','false');await command(repo,'config','user.email','publisher-fixture@example.invalid');await command(repo,'config','user.name','Publisher Fixture');await command(repo,'add','--all');await command(repo,'commit','--quiet','-m','synthetic reviewed artifact')
 const head=await command(repo,'rev-parse','HEAD'),now=Date.now(),expires=now+10*60*1000
 if(options.actualDependencies)await copyInstalledPgClosure(dependencies)
 else{
  const pg:any={name:'pg',version:'8.23.0',main:'index.js',dependencies:{'dep-a':'1.0.0'}}
  if(options.peerMode==='optional-absent'||options.peerMode==='optional-present')Object.assign(pg,{peerDependencies:{'pg-native':'>=3.0.1'},peerDependenciesMeta:{'pg-native':{optional:true}}})
  if(options.peerMode==='required-absent')pg.peerDependencies={'pg-native':'>=3.0.1'}
  if(options.peerMode==='malformed')Object.assign(pg,{peerDependencies:{'pg-native':'>=3.0.1'},peerDependenciesMeta:{'pg-native':{optional:true,unreviewed:true}}})
  await put(join(dependencies,'node_modules/pg/package.json'),JSON.stringify(pg));await put(join(dependencies,'node_modules/pg/index.js'),`module.exports=require('dep-a')\n`)
  if(!options.missingDependency){await put(join(dependencies,'node_modules/dep-a/package.json'),JSON.stringify({name:'dep-a',version:'1.0.0',main:'index.js'}));await put(join(dependencies,'node_modules/dep-a/index.js'),'module.exports={synthetic:true}\n')}
  if(options.peerMode==='optional-present'){await put(join(dependencies,'node_modules/pg-native/package.json'),JSON.stringify({name:'pg-native',version:'3.0.1',main:'index.js'}));await put(join(dependencies,'node_modules/pg-native/index.js'),'module.exports={syntheticNative:true}\n')}
 }
 const supervisor=join(root,'fixed-supervisor.ts'),config=join(root,'controlled.toml');await put(supervisor,'// synthetic fixed supervisor\n');await put(config,ARTIFACT_CONFIG)
 const docs={
  head:{profile:PR_HEAD_EVIDENCE_PROFILE,repository:'neuvetra-hq/neuvetra',pullRequest:6,head,observedAtMs:now-4000,expiresAtMs:expires},
  checks:{profile:PR_CHECKS_EVIDENCE_PROFILE,repository:'neuvetra-hq/neuvetra',pullRequest:6,head,observedAtMs:now-3000,expiresAtMs:expires,checks:[{name:'synthetic-required',head,conclusion:'success'}]},
  review:{profile:PR_REVIEW_EVIDENCE_PROFILE,repository:'neuvetra-hq/neuvetra',pullRequest:6,head,operatorId:'synthetic-operator',independentReviewerId:'synthetic-reviewer',verdict:'accepted',materialFindingsOpen:0,reviewedAtMs:now-2000,expiresAtMs:expires},
 }
 const evidencePaths={headEvidence:join(evidence,'head.json'),checksEvidence:join(evidence,'checks.json'),reviewEvidence:join(evidence,'review.json')};await put(evidencePaths.headEvidence,JSON.stringify(docs.head));await put(evidencePaths.checksEvidence,JSON.stringify(docs.checks));await put(evidencePaths.reviewEvidence,JSON.stringify(docs.review))
 const paths:ArtifactPublisherPaths={repositoryRoot:repo,dependencyRoot:dependencies,gitExecutable:GIT!,runtimeExecutable:process.execPath,supervisor,config,...evidencePaths,sourceArchive:join(output,'source.archive.json'),dependencyArchive:join(output,'dependency.archive.json'),publication:join(output,'publication.json')}
 const policy:ArtifactPublisherPolicy={reviewedProductHead:head,requiredChecks:['synthetic-required'],operatorId:'synthetic-operator',independentReviewerId:'synthetic-reviewer',nowMs:now,headEvidenceSha256:sha(await readFile(evidencePaths.headEvidence)),checksEvidenceSha256:sha(await readFile(evidencePaths.checksEvidence)),reviewEvidenceSha256:sha(await readFile(evidencePaths.reviewEvidence)),gitSha256:sha(await readFile(GIT!)),runtimeSha256:sha(await readFile(process.execPath)),supervisorSha256:sha(await readFile(supervisor)),configSha256:sha(ARTIFACT_CONFIG)}
 return{root,repo,dependencies,paths,policy,docs,evidencePaths,head}
}
async function rewrite(path:string,value:unknown){await put(path,JSON.stringify(value));return sha(await readFile(path))}
async function repin(f:Awaited<ReturnType<typeof fixture>>){const next=await command(f.repo,'rev-parse','HEAD');f.head=next;f.policy.reviewedProductHead=next;f.docs.head.head=next;f.docs.checks.head=next;f.docs.checks.checks[0]!.head=next;f.docs.review.head=next;f.policy.headEvidenceSha256=await rewrite(f.evidencePaths.headEvidence,f.docs.head);f.policy.checksEvidenceSha256=await rewrite(f.evidencePaths.checksEvidence,f.docs.checks);f.policy.reviewEvidenceSha256=await rewrite(f.evidencePaths.reviewEvidence,f.docs.review)}
const looseObject=(repo:string,oid:string)=>join(repo,'.git','objects',oid.slice(0,2),oid.slice(2))

test('publishes a clean exact commit and round-trips through the real materializer and verifier',async()=>{
 const f=await fixture(),published=await publishHostedSetupArtifact(f.paths,f.policy)
 expect(published.profile).toBe(ARTIFACT_PUBLISHER_PROFILE);expect(published.reviewedProductHead).toBe(f.head);expect(published.sourceFileCount).toBeGreaterThan(30);expect(published.dependencyFileCount).toBe(4);expect(published.launchAuthorized).toBe(false);expect(published.productionAuthorized).toBe(false)
 const receipt=JSON.parse(await readFile(f.paths.publication,'utf8'));expect(receipt.publisherEvidence).toEqual({profile:ARTIFACT_PUBLISHER_PROFILE,sourceRead:'exact-clean-git-commit',gitSha256:f.policy.gitSha256,headEvidenceSha256:f.policy.headEvidenceSha256,checksEvidenceSha256:f.policy.checksEvidenceSha256,reviewEvidenceSha256:f.policy.reviewEvidenceSha256})
 const artifactPaths:ArtifactPaths={publication:f.paths.publication,sourceArchive:f.paths.sourceArchive,dependencyArchive:f.paths.dependencyArchive,sourceRoot:join(f.root,'materialized-source'),dependencyRoot:join(f.root,'materialized-dependencies'),runtimeExecutable:f.paths.runtimeExecutable,supervisor:f.paths.supervisor,config:f.paths.config}
 const trust:ArtifactTrustPolicy={publicationSha256:published.publicationSha256,reviewedProductHead:f.head,operatorId:f.policy.operatorId,independentReviewerId:f.policy.independentReviewerId,requiredChecks:f.policy.requiredChecks,activeCheckoutRoots:[f.repo]}
 const materialized=await materializeHostedSetupArtifact(artifactPaths,trust),verified=await verifyHostedSetupArtifact(artifactPaths,trust)
 expect(materialized.sourceFileCount).toBe(published.sourceFileCount);expect(materialized.dependencyFileCount).toBe(published.dependencyFileCount);expect(materialized.inspection.executionArtifactSha256).toBe(verified.executionArtifactSha256);expect(verified.migrationManifestSha256).toBe(published.migrationManifestSha256);expect(verified.launchAuthorized).toBe(false)
},30000)

test('refuses clean committed sibling directory case aliases before creating archive outputs',async()=>{
 const f=await fixture(),worker='tools/staging/hosted-setup-artifact-worker.ts';await put(join(f.repo,worker),(await readFile(join(f.repo,worker),'utf8'))+`import './A/one';import './a/two';\n`);await put(join(f.repo,'tools/staging/A/one.ts'),'export const one=true\n');await put(join(f.repo,'tools/staging/A/two.ts'),'export const two=true\n')
 await command(f.repo,'add','--all');const oid=await command(f.repo,'hash-object','tools/staging/A/two.ts');await command(f.repo,'update-index','--force-remove','tools/staging/A/two.ts');await command(f.repo,'update-index','--add','--cacheinfo','100644',oid,'tools/staging/a/two.ts');await command(f.repo,'commit','--quiet','-m','synthetic case-alias siblings');await repin(f)
 expect(await command(f.repo,'--no-replace-objects','status','--porcelain=v1','--untracked-files=all')).toBe('');await expect(publishHostedSetupArtifact(f.paths,f.policy)).rejects.toThrow('ARCHIVE_PATH_COLLISION')
 for(const path of[f.paths.sourceArchive,f.paths.dependencyArchive,f.paths.publication])expect(await Bun.file(path).exists()).toBe(false)
},30000)

test('distinct sibling directories with repeated basenames publish and materialize',async()=>{
 const f=await fixture(),worker='tools/staging/hosted-setup-artifact-worker.ts';await put(join(f.repo,worker),(await readFile(join(f.repo,worker),'utf8'))+`import './alpha/shared';import './beta/shared';\n`);await put(join(f.repo,'tools/staging/alpha/shared.ts'),`export const identity='alpha'\n`);await put(join(f.repo,'tools/staging/beta/shared.ts'),`export const identity='beta'\n`);await command(f.repo,'add','--all');await command(f.repo,'commit','--quiet','-m','synthetic distinct siblings');await repin(f)
 const published=await publishHostedSetupArtifact(f.paths,f.policy),artifactPaths:ArtifactPaths={publication:f.paths.publication,sourceArchive:f.paths.sourceArchive,dependencyArchive:f.paths.dependencyArchive,sourceRoot:join(f.root,'distinct-materialized-source'),dependencyRoot:join(f.root,'distinct-materialized-dependencies'),runtimeExecutable:f.paths.runtimeExecutable,supervisor:f.paths.supervisor,config:f.paths.config},trust:ArtifactTrustPolicy={publicationSha256:published.publicationSha256,reviewedProductHead:f.head,operatorId:f.policy.operatorId,independentReviewerId:f.policy.independentReviewerId,requiredChecks:f.policy.requiredChecks,activeCheckoutRoots:[f.repo]}
 expect((await materializeHostedSetupArtifact(artifactPaths,trust)).sourceFileCount).toBe(published.sourceFileCount);expect(await readFile(join(artifactPaths.sourceRoot,'tools/staging/alpha/shared.ts'),'utf8')).toContain('alpha');expect(await readFile(join(artifactPaths.sourceRoot,'tools/staging/beta/shared.ts'),'utf8')).toContain('beta')
},30000)

test('refuses clean committed file-directory case aliases before creating archive outputs',async()=>{
 const f=await fixture(),worker='tools/staging/hosted-setup-artifact-worker.ts',fileSource=join(f.root,'case-file.ts'),innerSource=join(f.root,'case-inner.ts');await put(join(f.repo,worker),(await readFile(join(f.repo,worker),'utf8'))+`import './Mix.ts';import './mix.ts/inside';\n`);await put(fileSource,'export const file=true\n');await put(innerSource,'export const inner=true\n');await command(f.repo,'add',worker)
 const fileOid=await command(f.repo,'hash-object','-w',fileSource),innerOid=await command(f.repo,'hash-object','-w',innerSource);await command(f.repo,'update-index','--add','--cacheinfo','100644',fileOid,'tools/staging/Mix.ts');await command(f.repo,'update-index','--add','--cacheinfo','100644',innerOid,'tools/staging/mix.ts/inside.ts');await command(f.repo,'commit','--quiet','-m','synthetic file-directory alias');await command(f.repo,'update-index','--skip-worktree','tools/staging/Mix.ts','tools/staging/mix.ts/inside.ts');await repin(f)
 expect(await command(f.repo,'--no-replace-objects','status','--porcelain=v1','--untracked-files=all')).toBe('');await expect(publishHostedSetupArtifact(f.paths,f.policy)).rejects.toThrow('ARCHIVE_PATH_COLLISION');for(const path of[f.paths.sourceArchive,f.paths.dependencyArchive,f.paths.publication])expect(await Bun.file(path).exists()).toBe(false)
},30000)

test('replacement refs cannot substitute reviewed commit or blob bytes and real consumers retain the original',async()=>{
 for(const kind of['commit','blob']as const){
  const f=await fixture(),path='tools/staging/hosted-setup-artifact-worker.ts',unreviewed=`import './hosted-setup-artifact-bindings';import './hosted-setup-transactional-upgrade';export const worker='UNREVIEWED-${kind}'\n`
  const originalBlob=await command(f.repo,'--no-replace-objects','rev-parse',f.head+':'+path);await put(join(f.repo,path),unreviewed);await command(f.repo,'add','--all');await command(f.repo,'commit','--quiet','-m','unreviewed replacement')
  const replacementCommit=await command(f.repo,'rev-parse','HEAD'),replacementBlob=await command(f.repo,'rev-parse',replacementCommit+':'+path)
  await command(f.repo,'replace',kind==='commit'?f.head:originalBlob,kind==='commit'?replacementCommit:replacementBlob);await command(f.repo,'--no-replace-objects','reset','--hard',f.head)
  expect(await command(f.repo,'--no-replace-objects','status','--porcelain=v1','--untracked-files=all')).toBe('')
  expect(await command(f.repo,'show',f.head+':'+path)).toContain('UNREVIEWED-'+kind)
  const published=await publishHostedSetupArtifact(f.paths,f.policy),archive=JSON.parse(await readFile(f.paths.sourceArchive,'utf8')),worker=Buffer.from(archive.files.find((row:any)=>row.path===path).contentBase64,'base64').toString()
  expect(worker).not.toContain('UNREVIEWED');expect(worker).toContain('export const worker=true')
  const artifactPaths:ArtifactPaths={publication:f.paths.publication,sourceArchive:f.paths.sourceArchive,dependencyArchive:f.paths.dependencyArchive,sourceRoot:join(f.root,'replacement-materialized-source'),dependencyRoot:join(f.root,'replacement-materialized-dependencies'),runtimeExecutable:f.paths.runtimeExecutable,supervisor:f.paths.supervisor,config:f.paths.config}
  const trust:ArtifactTrustPolicy={publicationSha256:published.publicationSha256,reviewedProductHead:f.head,operatorId:f.policy.operatorId,independentReviewerId:f.policy.independentReviewerId,requiredChecks:f.policy.requiredChecks,activeCheckoutRoots:[f.repo]}
  expect((await materializeHostedSetupArtifact(artifactPaths,trust)).inspection.reviewedProductHead).toBe(f.head)
 }
},30000)

test('nested loose-tree substitution at multiple depths is rejected before publication',async()=>{
 for(const treePath of['tools','tools/staging']){
  const f=await fixture(),worker='tools/staging/hosted-setup-artifact-worker.ts',oldTree=await command(f.repo,'--no-replace-objects','rev-parse',f.head+':'+treePath)
  await put(join(f.repo,worker),`import './hosted-setup-artifact-bindings';export const worker='UNREVIEWED-NESTED-${treePath}'\n`);await command(f.repo,'add','--all');await command(f.repo,'commit','--quiet','-m','unreviewed nested tree')
  const replacementHead=await command(f.repo,'rev-parse','HEAD'),newTree=await command(f.repo,'rev-parse',replacementHead+':'+treePath),oldObject=looseObject(f.repo,oldTree)
  await chmod(oldObject,0o600);await copyFile(looseObject(f.repo,newTree),oldObject);await command(f.repo,'--no-replace-objects','reset','--hard',f.head)
  expect(await command(f.repo,'--no-replace-objects','status','--porcelain=v1','--untracked-files=all')).toBe('');expect(await command(f.repo,'--no-replace-objects','show',f.head+':'+worker)).toContain('UNREVIEWED-NESTED')
  await expect(publishHostedSetupArtifact(f.paths,f.policy)).rejects.toThrow('GIT_TREE_IDENTITY_REFUSED');expect(await Bun.file(f.paths.publication).exists()).toBe(false)
 }
},30000)

test('loose commit and blob substitutions are rejected by reconstructed object identity',async()=>{
 for(const kind of['commit','blob']as const){
  const f=await fixture(),worker='tools/staging/hosted-setup-artifact-worker.ts',original=kind==='commit'?f.head:await command(f.repo,'--no-replace-objects','rev-parse',f.head+':'+worker)
  await put(join(f.repo,worker),`import './hosted-setup-artifact-bindings';export const worker='UNREVIEWED-LOOSE-${kind}'\n`);await command(f.repo,'add','--all');await command(f.repo,'commit','--quiet','-m','unreviewed loose object')
  const replacementHead=await command(f.repo,'rev-parse','HEAD'),replacement=kind==='commit'?replacementHead:await command(f.repo,'rev-parse',replacementHead+':'+worker),originalObject=looseObject(f.repo,original)
  await chmod(originalObject,0o600);await copyFile(looseObject(f.repo,replacement),originalObject);await command(f.repo,'--no-replace-objects','reset','--hard',f.head);if(kind==='blob')await command(f.repo,'update-index','--assume-unchanged',worker)
  expect(await command(f.repo,'--no-replace-objects','status','--porcelain=v1','--untracked-files=all')).toBe('')
  await expect(publishHostedSetupArtifact(f.paths,f.policy)).rejects.toThrow(kind==='commit'?/GIT_(?:COMMAND|COMMIT_IDENTITY)_REFUSED/:'GIT_BLOB_IDENTITY_REFUSED');expect(await Bun.file(f.paths.publication).exists()).toBe(false)
 }
},30000)

test('actual pg 8.23 private closure accepts its absent explicitly optional pg-native peer',async()=>{
 const f=await fixture({actualDependencies:true}),published=await publishHostedSetupArtifact(f.paths,f.policy),archive=JSON.parse(await readFile(f.paths.dependencyArchive,'utf8'))
 expect(published.dependencyFileCount).toBeGreaterThan(10);expect(archive.files.some((row:any)=>row.path.startsWith('node_modules/pg-native/'))).toBe(false)
},30000)

test('optional peer metadata is exact while required and present peers retain full closure checks',async()=>{
 {const f=await fixture({peerMode:'optional-absent'});expect((await publishHostedSetupArtifact(f.paths,f.policy)).dependencyFileCount).toBe(4)}
 {const f=await fixture({peerMode:'optional-present'});expect((await publishHostedSetupArtifact(f.paths,f.policy)).dependencyFileCount).toBe(6)}
 {const f=await fixture({peerMode:'required-absent'});await expect(publishHostedSetupArtifact(f.paths,f.policy)).rejects.toThrow('DEPENDENCY_MISSING')}
 {const f=await fixture({peerMode:'malformed'});await expect(publishHostedSetupArtifact(f.paths,f.policy)).rejects.toThrow('SHAPE_REFUSED')}
},30000)

test('refuses tracked or untracked dirty source instead of reading checkout bytes',async()=>{
 {const f=await fixture();await put(join(f.repo,'tools/staging/hosted-setup-artifact-worker.ts'),'dirty working tree\n');await expect(publishHostedSetupArtifact(f.paths,f.policy)).rejects.toThrow('DIRTY_CHECKOUT_REFUSED')}
 {const f=await fixture();await put(join(f.repo,'untracked.ts'),'unreviewed\n');await expect(publishHostedSetupArtifact(f.paths,f.policy)).rejects.toThrow('DIRTY_CHECKOUT_REFUSED')}
})

test('refuses stale or mismatched authenticated head, check and review evidence',async()=>{
 {
  const f=await fixture();f.docs.head.head='f'.repeat(40);f.policy.headEvidenceSha256=await rewrite(f.evidencePaths.headEvidence,f.docs.head)
  await expect(publishHostedSetupArtifact(f.paths,f.policy)).rejects.toThrow('EVIDENCE_TARGET_REFUSED')
 }
 {
  const f=await fixture();f.docs.checks.checks[0]!.conclusion='failure';f.policy.checksEvidenceSha256=await rewrite(f.evidencePaths.checksEvidence,f.docs.checks)
  await expect(publishHostedSetupArtifact(f.paths,f.policy)).rejects.toThrow('CHECKS_REFUSED')
 }
 {
  const f=await fixture();f.docs.review.expiresAtMs=f.policy.nowMs-1;f.policy.reviewEvidenceSha256=await rewrite(f.evidencePaths.reviewEvidence,f.docs.review)
  await expect(publishHostedSetupArtifact(f.paths,f.policy)).rejects.toThrow('EVIDENCE_TIME_REFUSED')
 }
})

test('refuses missing private dependency closure and unmanifested dependency bytes',async()=>{
 {const f=await fixture({missingDependency:true});await expect(publishHostedSetupArtifact(f.paths,f.policy)).rejects.toThrow('DEPENDENCY_MISSING')}
 {const f=await fixture();await put(join(f.dependencies,'node_modules/unreviewed/package.json'),'{"name":"unreviewed","version":"1.0.0"}');await expect(publishHostedSetupArtifact(f.paths,f.policy)).rejects.toThrow('DEPENDENCY_ROOT_NOT_PRIVATE_CLOSURE')}
})

test('refuses source path aliases, unresolved relative imports and missing fixed bindings',async()=>{
 {const f=await fixture({workerImport:`import '@private/alias'\n`});await expect(publishHostedSetupArtifact(f.paths,f.policy)).rejects.toThrow('PATH_ALIAS_OR_EXTERNAL_IMPORT_REFUSED')}
 {const f=await fixture({missingSource:true});await expect(publishHostedSetupArtifact(f.paths,f.policy)).rejects.toThrow('IMPORT_RESOLUTION_REFUSED')}
 {const f=await fixture();await command(f.repo,'rm','tools/staging/hosted-setup-artifact-bindings.ts');await command(f.repo,'commit','--quiet','-m','remove binding');const newHead=await command(f.repo,'rev-parse','HEAD');f.policy.reviewedProductHead=newHead;for(const doc of Object.values(f.docs)){doc.head=newHead}f.docs.checks.checks[0]!.head=newHead;f.policy.headEvidenceSha256=await rewrite(f.evidencePaths.headEvidence,f.docs.head);f.policy.checksEvidenceSha256=await rewrite(f.evidencePaths.checksEvidence,f.docs.checks);f.policy.reviewEvidenceSha256=await rewrite(f.evidencePaths.reviewEvidence,f.docs.review);await expect(publishHostedSetupArtifact(f.paths,f.policy)).rejects.toThrow('IMPORT_RESOLUTION_REFUSED')}
})

test('refuses caller-selected executable/config bytes and never treats publication as authorization',async()=>{
 const f=await fixture();f.policy.runtimeSha256='0'.repeat(64);await expect(publishHostedSetupArtifact(f.paths,f.policy)).rejects.toThrow('EXECUTABLE_OR_CONFIG_PIN_MISMATCH')
 expect(await Bun.file(f.paths.publication).exists()).toBe(false)
})
