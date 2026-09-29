# Publisher import-closure repair: independent QA

Task HOSTED-SETUP-ARTIFACT-PUBLISHER-IMPORT-QA-01, 2026-09-26. Bounded PASS for the repaired publisher's exact import tuples, private dependency classification, and actual clean-tree materialization/import integration. The prior clean63995 publisher failure PATH_ALIAS_OR_EXTERNAL_IMPORT_REFUSED is preserved as an escaped integration defect; earlier publisher QA1-QA4 remain unchanged. No release, deployment, stop, migration or resume authority is granted.

Reviewer /root/compose_qa did not author the publisher or candidate tests. This context previously authored the upstream fresh-restore binder; this is a publisher/import integration review, not a new independent acceptance of that binder. Refreshed qa-lead and agent-improvement guidance. Critical registry manifest requested gpt-6-astra/high; followup model/effort and resource usage are not observable. No candidate edits, shared Git writes, provider actions, database operations or credentials were used. Disposable local Git fixtures only.

## Frozen bytes

- tools/staging/hosted-setup-artifact-publisher.ts: 7e14e5f45199d1bf734a9b9d72d2defebf79f09148fd1c92d59c8f2462d89d33
- tools/staging/hosted-setup-artifact-publisher.test.ts: 7296fde16512f78b9ae1de0d89a9c445ad22e1abe84e1cd50d211108934ac04f

Both matched author freeze and were rehashed unchanged after tests. The new source was loaded from the worktree; the real source archive was read from a fresh, clean disposable clone of committed head63995c1f840599f44fa0f0ab8db23310a04595a0. This does not assert that the repair itself is already committed/published. Repeat the real-head check on the final clean repair commit before publication.

## Evidence and result

1. Independently reran Bun1.3.12 focused candidate suite:16 pass,0fail,87 assertions,81.63s. Scoped strict TypeScript passed: bun node_modules/typescript/bin/tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution bundler --types bun --skipLibCheck tools/staging/hosted-setup-artifact-publisher.ts tools/staging/hosted-setup-artifact-publisher.test.ts.
2. Independent temporary probes:2 pass/37 assertions,38.95s. A separate added dependency-negative probe passed1test/8assertions,4.55s. These exercised the actual exported publisher and real materializer, not copied implementations. Fixture helpers came from frozen candidate tests; expectations and adversarial cases were reviewer-authored.
3. Bare pg, lazy PGlite and require(postgres) at the worker path each refused; arbitrary bare package and pg export subpath refused with ARTIFACT_PUBLISHER_PATH_ALIAS_OR_EXTERNAL_IMPORT_REFUSED. Relative traversal refused PATH_REFUSED. Removing the designated workspace lazy import refused EXTERNAL_IMPORT_SET_REFUSED. All failed before archive/publication output creation. Candidate tests additionally cover changed import kinds/subpaths, dirty source, replacement refs, reconstructed Git object identity and case aliases.
4. Adding either postgres or @electric-sql/pglite to pg's private dependency graph refused EXTERNAL_IMPORT_DEPENDENCY_REFUSED, before outputs. The repaired source requires pg in that graph and both classified inactive alternatives absent from it; the exact importer/kind/specifier set must match all three rules. No wildcard external-package permission was introduced.
5. Real-head clone and publication/materialization at C:/Users/nimab/AppData/Local/Temp/hosted-artifact-real-head-sjRBmn produced117source files (93 executable graph files plus extras/migrations) and138dependency files. Actual materialized fixed bindings and dedicated client imported successfully with no-env-file, no-install, fixed config, cwd=sourceRoot, NODE_PATH=private dependency root; stdout loaded-private-pg, stderr empty. No preparation function or database connection was called.
6. In the same private fixture, create parent node_modules/pg with a throwing QA_ANCESTOR_pg marker and parent postgres/PGlite packages. Launch the actual materialized worker entrypoint with valid artifact pins, upgrade mode,30000msdeadline, empty payload and unused transaction journal. It exited78 with bounded refused_or_uncertain, non-null verified execution-artifact hash,0adapter constructions,0transactions,databaseMayHaveBeenEntered=false, empty stderr, and no transaction journal. Directly importing the dedicated client in a separate child printed QA_ANCESTOR_pg, proving that the ancestor substitution was resolvable and that worker pg-path guarding mattered. Source confirms this guard precedes binding import and preparation.

Real fixture publication SHA256 a040eb6aef2ffc1fde02c3551c77ccd4a42bf29bc8be147f405160cd8c01bd10; source archive fd8898660d751c986e7e8b5e792317a42b86bcdf75c556b93f90d951095aec63; dependency archive bca68ae7179c146267d82fb2014f7af0cf147534d7133ac9e16ce15f113b8fbe. These used explicitly synthetic review/check evidence and establish local mechanics only. They are not authentic publication evidence and must not be launched against a provider/database.

## Loader boundary and remaining limits

The rule label inert-unavailable means absent from this private dependency package graph and not invoked by the reviewed fixed path. It is not a universal runtime loader guarantee. An independently installed inert parent postgres package was resolvable when the separate installedDriver() helper was explicitly called; it returned a function. Thus NODE_PATH does not eliminate ancestor lookup. Direct alternative helper calls must not inherit the fixed worker's acceptance. Source tracing found no DevelopmentWorkspaceDatabase.create or installedDriver call in accepted fixed upgrade/restore binding preparation; the optional imports reside inside those separate exported development/inventory functions. The actual fixed worker's pg containment check refused the exercised ancestor attack before database access. General computed/dynamic loader isolation is not established by Bun's literal scanImports graph, the tuple policy or these tests; trusted operator host and separately reviewed fixed source remain necessary.

No fully valid upgrade payload, database transaction, provider capture, live image or final committed repair tree was exercised. The all-green PR63995 observation from earlier is historical and its five-minute review expired; it does not approve the new uncommitted source. No raw tokens or environment exports were read. The original integration failure was reported by root; independently reading the prior source and scanning the actual93-file graph corroborated its rejected bare import cause. An early read-only scanner run additionally printed a local EPERM after its graph output; scoped escalated test runs completed normally.

One temporary QA harness command initially failed PowerShell quote parsing before writing; its corrected command wrote the probe. The later added test initially concatenated after a closing call without a newline (Bun parse error: Expected semicolon but found test); only the temporary probe was corrected and that added test was rerun. Neither was a candidate failure, and no candidate test/source was changed.

## Reproduction artifacts

- C:/Users/nimab/AppData/Local/Temp/publisher-import-independent.test.ts: f5ce69e044213753b40b3915291fbb25b08583baf5f6b07832d56b092ea52723
- C:/Users/nimab/AppData/Local/Temp/publisher-import-independent-results.json: 0be9583fe72da8f067112682110b3c5579750cb440877579136a5e0c4afb7de2
- C:/Users/nimab/AppData/Local/Temp/publisher-import-independent-extra-results.json: 461ef126d625dedc6df5f002c68699c5bda69180b10f2b4b3f09783b61c74804

The full independent probe is retained below so temporary directory cleanup does not erase reproducibility. Its synthetic fixture helper import paths are local workstation paths; adjust only the worktree location on another machine. Run bun test <probe> --timeout120000; it creates only disposable fixtures.

```typescript
import {expect,test}from'bun:test'
import {createHash}from'node:crypto'
import {chmod,copyFile,lstat,mkdir,mkdtemp,readFile,readdir,realpath,writeFile}from'node:fs/promises'
import {createRequire}from'node:module'
import {tmpdir}from'node:os'
import {dirname,join}from'node:path'
import {fileURLToPath,pathToFileURL}from'node:url'
import {ARTIFACT_CONFIG,type ArtifactPaths,type ArtifactTrustPolicy,verifyHostedSetupArtifact}from'C:/Users/nimab/.codex/worktrees/inventory-plan-delivery/Neuvetra/tools/staging/hosted-setup-artifact-source'
import {materializeHostedSetupArtifact}from'C:/Users/nimab/.codex/worktrees/inventory-plan-delivery/Neuvetra/tools/staging/hosted-setup-artifact-materialize'
import {ARTIFACT_PUBLISHER_PROFILE,PR_CHECKS_EVIDENCE_PROFILE,PR_HEAD_EVIDENCE_PROFILE,PR_REVIEW_EVIDENCE_PROFILE,publishHostedSetupArtifact,type ArtifactPublisherPaths,type ArtifactPublisherPolicy}from'C:/Users/nimab/.codex/worktrees/inventory-plan-delivery/Neuvetra/tools/staging/hosted-setup-artifact-publisher'

const GIT=Bun.which('git');if(!GIT)throw Error('git required for artifact publisher tests')
const REAL_REPOSITORY_ROOT='C:/Users/nimab/.codex/worktrees/inventory-plan-delivery/Neuvetra'
const sha=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex')
async function put(path:string,value:string|Uint8Array){await mkdir(dirname(path),{recursive:true});await writeFile(path,value)}
async function command(root:string,...args:string[]){const child=Bun.spawn([GIT!,'-C',root,...args],{stdin:'ignore',stdout:'pipe',stderr:'pipe',windowsHide:true});const stdout=await new Response(child.stdout).text(),stderr=await new Response(child.stderr).text(),code=await child.exited;if(code!==0)throw Error(stderr);return stdout.trim()}
async function gitCommand(...args:string[]){const child=Bun.spawn([GIT!,...args],{stdin:'ignore',stdout:'pipe',stderr:'pipe',windowsHide:true});const stdout=await new Response(child.stdout).text(),stderr=await new Response(child.stderr).text(),code=await child.exited;if(code!==0)throw Error(stderr);return stdout.trim()}
const migrationNames=[
 '0001_company_workspace.sql','0002_synthetic_bill_intake.sql','0003_synthetic_bill_calculation.sql','0004_inventory_review.sql','0005_annual_electricity_register.sql','0006_inventory_evidence_pack.sql','0007_inventory_draft_report.sql','0008_inventory_draft_report_review.sql','0009_private_staging.sql','0010_manual_electricity_worksheet.sql','0011_worksheet_reports.sql','0012_source_electricity_worksheet.sql','0013_annual_electricity_worksheet.sql','0014_annual_electricity_evidence.sql','0015_corporate_coverage.sql','0016_stationary_natural_gas.sql','0017_mobile_diesel.sql','0018_controlled_fleet.sql','0019_stationary_sources.sql','0020_fugitive_sources.sql','0021_scope1_inventory.sql','0022_scope1_beta_foundation.sql','0023_company_setup.sql',
]
interface FixtureOptions{workerImport?:string;missingDependency?:boolean;missingSource?:boolean;peerMode?:'optional-absent'|'required-absent'|'malformed'|'optional-present';actualDependencies?:boolean;externalMutation?:'pg-subpath'|'pglite-kind'|'postgres-subpath'}
async function copyInstalledPgClosure(target:string){
 const initial=createRequire(new URL('file:///C:/Users/nimab/.codex/worktrees/inventory-plan-delivery/Neuvetra/packages/neuvetra-database/package.json')),seen=new Map<string,string>()
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
 const pgSpecifier=options.externalMutation==='pg-subpath'?'pg/lib/client':'pg',postgresSpecifier=options.externalMutation==='postgres-subpath'?'postgres/cjs':'postgres'
 const source=new Map<string,string>([
  ['tools/staging/hosted-setup-artifact-worker.ts',`import './hosted-setup-artifact-bindings';import './hosted-setup-transactional-upgrade';import('./hosted-setup-artifact-source');import('./hosted-setup-dedicated-client');${options.workerImport??''}export const worker=true\n`],
  ['tools/staging/hosted-setup-artifact-bindings.ts',`import './hosted-setup-transactional-upgrade';import '../../packages/neuvetra-database/src/hosted';import '../cloud/database-inventory';export const bindings=true\n`],
  ['tools/staging/hosted-setup-transactional-upgrade.ts',`import '../../packages/neuvetra-database/src/staging-migrations';export const runner=true\n`],
  ['tools/staging/hosted-setup-artifact-source.ts',`export const source=true\n`],
  ['tools/staging/hosted-setup-dedicated-client.ts',`import '../../packages/neuvetra-database/src/staging-tls';export const client=true\n`],
  ['packages/neuvetra-database/src/staging-migrations.ts',`import './staging-audit';export const migrations=23\n`],
  ['packages/neuvetra-database/src/staging-audit.ts',`export const audit=true\n`],
  ['packages/neuvetra-database/src/staging-tls.ts',`export const tls=true\n`],
  ['packages/neuvetra-database/src/hosted.ts',`import '${pgSpecifier}';import './workspace';export const hosted=true\n`],
  ['packages/neuvetra-database/src/workspace.ts',options.externalMutation==='pglite-kind'?`export function syntheticOnly(){return require('@electric-sql/pglite')}\n`:`export async function syntheticOnly(){return import('@electric-sql/pglite')}\n`],
  ['tools/cloud/database-inventory.ts',`import{createRequire}from'node:module';const require=createRequire(import.meta.url);export function historicalOnly(){return require('${postgresSpecifier}')}\n`],
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
async function realHeadFixture(){
 const root=await mkdtemp(join(tmpdir(),'hosted-artifact-real-head-')),repo=join(root,'repo'),dependencies=join(root,'private-dependencies'),evidence=join(root,'synthetic-authenticated-evidence'),output=join(root,'output');await mkdir(dependencies);await mkdir(evidence);await mkdir(output)
 const head=await command(REAL_REPOSITORY_ROOT,'rev-parse','HEAD');await gitCommand('clone','--quiet','--no-local','--no-checkout',REAL_REPOSITORY_ROOT,repo);await command(repo,'checkout','--quiet','--detach',head);expect(await command(repo,'status','--porcelain=v1','--untracked-files=all')).toBe('')
 await copyInstalledPgClosure(dependencies)
 const supervisor=join(repo,'tools/staging/hosted-setup-artifact-supervisor.ts'),config=join(root,'controlled.toml');await put(config,ARTIFACT_CONFIG)
 const now=Date.now(),expires=now+10*60*1000,docs={
  head:{profile:PR_HEAD_EVIDENCE_PROFILE,repository:'neuvetra-hq/neuvetra',pullRequest:6,head,observedAtMs:now-4000,expiresAtMs:expires},
  checks:{profile:PR_CHECKS_EVIDENCE_PROFILE,repository:'neuvetra-hq/neuvetra',pullRequest:6,head,observedAtMs:now-3000,expiresAtMs:expires,checks:[{name:'synthetic-real-head-check',head,conclusion:'success'}]},
  review:{profile:PR_REVIEW_EVIDENCE_PROFILE,repository:'neuvetra-hq/neuvetra',pullRequest:6,head,operatorId:'synthetic-real-head-operator',independentReviewerId:'synthetic-real-head-reviewer',verdict:'accepted',materialFindingsOpen:0,reviewedAtMs:now-2000,expiresAtMs:expires},
 }
 const evidencePaths={headEvidence:join(evidence,'head.json'),checksEvidence:join(evidence,'checks.json'),reviewEvidence:join(evidence,'review.json')};await put(evidencePaths.headEvidence,JSON.stringify(docs.head));await put(evidencePaths.checksEvidence,JSON.stringify(docs.checks));await put(evidencePaths.reviewEvidence,JSON.stringify(docs.review))
 const paths:ArtifactPublisherPaths={repositoryRoot:repo,dependencyRoot:dependencies,gitExecutable:GIT!,runtimeExecutable:process.execPath,supervisor,config,...evidencePaths,sourceArchive:join(output,'source.archive.json'),dependencyArchive:join(output,'dependency.archive.json'),publication:join(output,'publication.json')}
 const policy:ArtifactPublisherPolicy={reviewedProductHead:head,requiredChecks:['synthetic-real-head-check'],operatorId:'synthetic-real-head-operator',independentReviewerId:'synthetic-real-head-reviewer',nowMs:now,headEvidenceSha256:sha(await readFile(evidencePaths.headEvidence)),checksEvidenceSha256:sha(await readFile(evidencePaths.checksEvidence)),reviewEvidenceSha256:sha(await readFile(evidencePaths.reviewEvidence)),gitSha256:sha(await readFile(GIT!)),runtimeSha256:sha(await readFile(process.execPath)),supervisorSha256:sha(await readFile(supervisor)),configSha256:sha(ARTIFACT_CONFIG)}
 return{root,repo,dependencies,paths,policy,head}
}
async function rewrite(path:string,value:unknown){await put(path,JSON.stringify(value));return sha(await readFile(path))}
async function repin(f:Awaited<ReturnType<typeof fixture>>){const next=await command(f.repo,'rev-parse','HEAD');f.head=next;f.policy.reviewedProductHead=next;f.docs.head.head=next;f.docs.checks.head=next;f.docs.checks.checks[0]!.head=next;f.docs.review.head=next;f.policy.headEvidenceSha256=await rewrite(f.evidencePaths.headEvidence,f.docs.head);f.policy.checksEvidenceSha256=await rewrite(f.evidencePaths.checksEvidence,f.docs.checks);f.policy.reviewEvidenceSha256=await rewrite(f.evidencePaths.reviewEvidence,f.docs.review)}
const looseObject=(repo:string,oid:string)=>join(repo,'.git','objects',oid.slice(0,2),oid.slice(2))

const qaRows:any[]=[]
test('QA independent allowlist negative cases',async()=>{
 const cases=[
  ['pg from worker',`import 'pg'`],['pglite from worker',`export async function lazy(){return import('@electric-sql/pglite')}`],['postgres from worker',`export function lazy(){return require('postgres')}`],['arbitrary bare',`import 'unreviewed-external'`],['pg export subpath',`export * from 'pg/lib/client'`],['relative escape',`import '../../../../outside-module'`]
 ]
 for(const[name,workerImport]of cases){const f=await fixture({workerImport:workerImport+';'});let err:string|null=null;try{await publishHostedSetupArtifact(f.paths,f.policy)}catch(e){err=(e as Error).message}qaRows.push({name,error:err});expect(err).not.toBeNull();for(const p of[f.paths.sourceArchive,f.paths.dependencyArchive,f.paths.publication])expect(await Bun.file(p).exists()).toBe(false)}
 const f=await fixture();await put(join(f.repo,'packages/neuvetra-database/src/workspace.ts'),'export const absent=true');await command(f.repo,'add','--all');await command(f.repo,'commit','-qm','independent omit classified lazy import');await repin(f);let error:string|null=null;try{await publishHostedSetupArtifact(f.paths,f.policy)}catch(e){error=(e as Error).message}qaRows.push({name:'missing classified import',error});expect(error).toContain('EXTERNAL_IMPORT_SET_REFUSED')
},120000)
test('QA actual clean tree materialization and ancestor module challenge',async()=>{
 const f=await realHeadFixture(),publication=await publishHostedSetupArtifact(f.paths,f.policy)
 const paths:ArtifactPaths={publication:f.paths.publication,sourceArchive:f.paths.sourceArchive,dependencyArchive:f.paths.dependencyArchive,sourceRoot:join(f.root,'qa-materialized-source'),dependencyRoot:join(f.root,'qa-materialized-dependencies'),runtimeExecutable:f.paths.runtimeExecutable,supervisor:f.paths.supervisor,config:f.paths.config}
 const policy:ArtifactTrustPolicy={publicationSha256:publication.publicationSha256,reviewedProductHead:f.head,operatorId:f.policy.operatorId,independentReviewerId:f.policy.independentReviewerId,requiredChecks:f.policy.requiredChecks,activeCheckoutRoots:[f.repo,REAL_REPOSITORY_ROOT]}
 await materializeHostedSetupArtifact(paths,policy)
 async function child(code:string,worker=false){const args=worker?[join(paths.sourceRoot,'tools/staging/hosted-setup-artifact-worker.ts')]:['-e',code];const envelope={profile:'neuvetra.hosted-setup.fixed-artifact-worker.v1',mode:'upgrade',paths,policy,deadlineMs:30000,transactionJournalPath:join(f.root,'unused-transaction.jsonl'),payload:{}};const p=Bun.spawn([process.execPath,'--no-env-file','--no-install','--config='+paths.config,...args],{cwd:paths.sourceRoot,env:{SystemRoot:process.env.SystemRoot??'C:\\Windows',NODE_PATH:join(paths.dependencyRoot,'node_modules')},stdin:worker?new Blob([JSON.stringify(envelope)]):'ignore',stdout:'pipe',stderr:'pipe',windowsHide:true});const [stdout,stderr,exitCode]=await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text(),p.exited]);return{exitCode,stdout:stdout.trim(),stderr}}
 const moduleUrl=(path:string)=>pathToFileURL(join(paths.sourceRoot,path)).href
 const normal=await child(`await import(${JSON.stringify(moduleUrl('tools/staging/hosted-setup-artifact-bindings.ts'))});await import(${JSON.stringify(moduleUrl('tools/staging/hosted-setup-dedicated-client.ts'))});console.log('loaded-private-pg')`);expect(normal).toEqual({exitCode:0,stdout:'loaded-private-pg',stderr:''});qaRows.push({name:'real tree materialized imports',fixture:f.root,head:f.head,...publication,...normal})
 for(const name of['pg','postgres','@electric-sql/pglite']){await put(join(f.root,'node_modules',name,'package.json'),JSON.stringify({name,version:'0.0.0-qa',main:'index.js'}));await put(join(f.root,'node_modules',name,'index.js'),`throw Error('QA_ANCESTOR_${name.replaceAll('/','_')}')`)}
 const actualWorker=await child('',true);const outcome=JSON.parse(actualWorker.stdout);expect(actualWorker.exitCode).toBe(78);expect(actualWorker.stderr).toBe('');expect(outcome.status).toBe('refused_or_uncertain');expect(outcome.adapterConstructions).toBe(0);expect(outcome.transactions).toBe(0);expect(outcome.databaseMayHaveBeenEntered).toBe(false);expect(outcome.executionArtifactSha256).not.toBeNull();qaRows.push({name:'actual worker rejects ancestor pg',...actualWorker})
 const direct=await child(`try{await import(${JSON.stringify(moduleUrl('tools/staging/hosted-setup-dedicated-client.ts'))})}catch(e){console.log(e.message)}`);expect(direct.stdout).toBe('QA_ANCESTOR_pg');qaRows.push({name:'direct import confirms ancestor pg is resolvable',...direct})
 await put(join(f.root,'node_modules/postgres/index.js'),'module.exports=function qaAncestorPostgres(){}');
 const postgres=await child(`const m=await import(${JSON.stringify(moduleUrl('tools/cloud/database-inventory.ts'))});console.log(typeof m.installedDriver())`);expect(postgres.stdout).toBe('function');qaRows.push({name:'inactive postgres helper can resolve ancestor driver; loader limitation',...postgres})
 expect(await Bun.file(join(f.root,'unused-transaction.jsonl')).exists()).toBe(false)
 await writeFile(join(tmpdir(),'publisher-import-independent-results.json'),JSON.stringify(qaRows,null,2)+'\n')
},120000);
test('QA unavailable alternatives cannot enter private dependency package graph',async()=>{
 for(const name of['postgres','@electric-sql/pglite']){
  const f=await fixture();const meta=JSON.parse(await readFile(join(f.dependencies,'node_modules/pg/package.json'),'utf8'));meta.dependencies[name]='1.0.0';await put(join(f.dependencies,'node_modules/pg/package.json'),JSON.stringify(meta));await put(join(f.dependencies,'node_modules',name,'package.json'),JSON.stringify({name,version:'1.0.0',main:'index.js'}));await put(join(f.dependencies,'node_modules',name,'index.js'),'module.exports={}');let error:string|null=null;try{await publishHostedSetupArtifact(f.paths,f.policy)}catch(e){error=(e as Error).message}expect(error).toContain('EXTERNAL_IMPORT_DEPENDENCY_REFUSED');qaRows.push({name:'unavailable alternative added to packaged graph: '+name,error});for(const path of[f.paths.sourceArchive,f.paths.dependencyArchive,f.paths.publication])expect(await Bun.file(path).exists()).toBe(false)
 }
 await writeFile(join(tmpdir(),'publisher-import-independent-extra-results.json'),JSON.stringify(qaRows,null,2)+'\n')
},30000)

```
