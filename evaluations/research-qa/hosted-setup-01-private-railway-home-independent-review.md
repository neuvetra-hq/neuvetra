# Private Railway credential home — independent QA/security review

Task HOSTED-SETUP-PRIVATE-RAILWAY-HOME-QA-01. Date 2026-09-26 UTC. Reviewer /root/compose_qa did not author the supervisor or candidate test. Registered critical qa-lead route requested gpt-6-astra/high; observed model/effort unknown in reused independent review context. Parent reported registry dispatch temporarily unavailable while a separate publisher artifact was under repair. This review refreshed QA/security roles and operating guidance; L02/L04/L06 evidence-boundary and failure-path checks apply.

**Verdict: bounded PASS for the frozen credential-home change on this trusted Windows operator host.** Actual pinned Railway read-only collection authenticated inside the supervisor-created copied home, selected the exact target, and the home was removed. No stop, migration, database entry or provider mutation was performed or authorized. This is not full native upgrade integration or proof of hostile-host credential isolation.

## Exact reviewed versions

| Artifact | SHA-256 |
|---|---|
| tools/staging/hosted-setup-artifact-supervisor.ts | fa7535278a12b7664e322ee5b0d10cd8d1a9537925eb5811eb4e2de77a132448 |
| tools/staging/hosted-setup-artifact-supervisor.test.ts | 3a8140c17232a4edd8186ce73dac851cd795ada56689c4bca7889d44637ccace |
| evaluations/research-qa/hosted-setup-01-private-railway-home-author.md | 84ab4a495a6288bbbc0a0be11f4f3c103ca33d4afa9995845e4470c3690c08f5 |

Source and test hashes matched dispatch and remained unchanged after testing. Author updated its report only to describe another operator experiment; the final report hash above is what this review read. No candidate edits by QA.

## Validation and preserved initial failure

Candidate suite: **6 passed / 47 assertions** using Bun1.3.12. Scoped strict TypeScript with `--noEmit --strict --target ESNext --module ESNext --moduleResolution bundler --types bun --skipLibCheck` on supervisor and its test passed. This does not validate third-party declaration files excluded by skipLibCheck; the author's separate no-skipLibCheck failure was not reproduced or overridden.

Independent public-boundary suite initially reported **3 passed, 1 failed / 139 assertions**. Every assertion in the failed credential-path case had passed; Bun's temporary synthetic junction cleanup `rm(junction)` then failed with Windows EFAULT. Native PowerShell inspected LinkType=Junction and removed that exact disposable junction without recursion. The temporary harness retained subsequent disposable fixture junctions instead of using that unsupported Bun cleanup operation. Targeted rerun: **1 passed / 17 assertions**, other three cases filtered out. No candidate defect was hidden or fixed by QA. All four independent cases therefore passed across those runs. A preliminary harness-generation command using `bun -` failed with EPERM before creating/running the probe; switching that generation step to Node stdin succeeded. These are harness failures, not candidate execution failures.

The independent fixture reuses the candidate's synthetic artifact packaging machinery but replaces/adds the adversarial behavior and assertions described below. Its fake database modules perform only local file logging; actual provider acquisition was separately exercised through real modules. Counts do not claim native PostgreSQL coverage.

## Criterion evidence

**Credential source boundary.** The supervisor requires an explicit absolute path ending in .railway/config.json; rejects nonregular/symlink-resolved aliases, zero or >65536-byte source; excludes source/dependency/active-checkout roots. Independent probes rejected relative and missing paths, wrong filename, active-checkout file, empty/oversized file, directory-as-config and a redirected parent junction, before an attempt journal or private home was created. The real source config was copied, never printed or modified. JSON credential semantics are intentionally left to the CLI; merely having a bounded file does not establish authentication.

**Cleanup and output confidentiality.** Independent synthetic cases exercised successful completion, preflight refusal, second-transaction refusal, outer timeout, abrupt worker exit, synthetic credential text written to child stdout, synthetic credential text written to child stderr, output overflow and >8MiB payload rejection after the copy. Each returned the expected status, recorded removal, left no private home/config, retained the original synthetic source, and contained neither sentinel credential text in the supervisor result nor its journal. Zero or one worker was spawned per invocation; no retry. The oversized input path refused after home creation and before worker launch. Child output is captured and rejected, not forwarded to operator output or journal. The synthetic credential-output adversaries used only a harmless fixture sentinel, never the real token.

**One worker and deadline.** Candidate tests showed one adapter/transaction and separate explicit reconciliation process, prior-journal refusal and an unrelated sibling process surviving timeout. An independent harmless descendant inherited worker output streams while the worker hung; with deadline1000ms, supervisor returned uncertainty in1145ms, confirmed the descendant had started, and removed the home. This demonstrates bounded return for the exercised case, not a general process-tree termination guarantee. The descendant's own bounded2200ms lifetime prevented a persistent test process. The implementation kills its direct worker; this review did not prove every possible CLI descendant has exited before return. Worker output and journal statuses retain uncertainty/noAutomaticRetry rather than implying a committed result.

**Real isolated authentication.** Built a new synthetic fixed artifact containing the actual capture, Railway CLI, deployment binder, write-gate and upgrade modules. The unchanged reviewed supervisor copied the existing operator ~/.railway/config.json to a newly created private home and launched its fixed worker with its real allowlisted environment. A test binding invoked the real capture module, then deliberately refused before constructing any database adapter. Its two CLI operations were exact-project/environment status and exact-service inventory query, both read-only; no scale command or database operation was reachable from the test path. The capture module rehashed the CLI before calls and checked version. QA separately prehashed the executable to `f9351033614c86882332a5c82e1856b21792b176ebf84a9417dfd1362c425177` (Railway5.62.1) at `C:/Users/nimab/Neuvetra/m63-runtime/railway-cli/node_modules/@railway/cli/bin/railway.exe`.

Actual collector completion **2026-09-26T16:12:34.364Z**: project119f3652-9d84-4d16-983c-1a17c0fd1aaa, environment6642d65a-15a2-41e9-b25e-b7b01990aa28, servicef43abcf9-72f0-4034-828a-8d83ca26b0db, providerMutationAuthorized=false; canonical capture SHA `87b8e2d9568949e4328b04ebb5c16371d2185ab178daeb2049aa896d1d16247a`. Raw status/inventory/credentials stayed in child memory and were not emitted or saved. Sanitized result only: `C:/Users/nimab/AppData/Local/Temp/hosted-fixed-worker-ewrpcu/readonly-auth-sanitized.json`. Private copied home `.../hosted-worker-home-hEucGl` was absent after return and journal recorded removal. Outcome was deliberately refused_or_uncertain with adapterConstructions0 and no fake or actual DB calls. Supervisor authentication success is established by the sanitized capture result, not by treating that deliberate refusal as an upgrade success.

The actual supervisor environment omits ambient APPDATA/LOCALAPPDATA/PATH and token variables; its HOME/USERPROFILE/XDG_CONFIG_HOME/TEMP/TMP point to the copied home. Thus this test reaches the actual changed environment boundary, not an independently assembled approximation. Root's separate operator experiment was supporting context only.

## Bounds and operational residuals

No material defect was found within the trusted-host credential transport scope. Path regularity and realpath checks do not establish Windows ACL confidentiality, protect against a hostile same-user process, or close source-file time-of-check/time-of-copy races. The new home inherits filesystem permissions from the externally selected journal parent; the implementation does not independently attest or restrict that parent's Windows ACL. Operator-controlled storage and reviewed ACL scope remain prerequisites; this PASS must not be described as multi-user OS isolation.

Cleanup is proven for the ordinary tested return/throw/worker-kill paths while the supervisor remains alive. Forced supervisor termination, machine loss, filesystem denial and cleanup-failure injection were not tested. A catch/finally cannot guarantee removal after parent process death. Static review confirms a deletion failure appends private_home_cleanup_failed where possible and changes the outer status to refused_or_uncertain; the copied credential may remain at the recorded path and needs controlled operator cleanup before any later use. There is no automatic retry/recovery or secure-erasure claim. Error paths before source acceptance create no private copy. The journal stores a temporary path but not credential bytes.

The capture authentication check proves access under the existing operator session and trusted CLI, not approval to mutate the provider or database. Existing broader artifact/supervisor trust, independent externally pinned review, clean publication, concrete binding review, writer exclusion, fresh restore/currentness, durable journals and schema23 native integration are separate gates. No live execution authority is granted by this review. QA run remains pending coordinator review and immutable evidence packaging.

## Reproducible independent probe

Temporary probe SHA-256 after the cleanup-only harness correction: `2dd1386a1a6bcef3d7e27a5e185fcd3515d91001bda4d1e7c54482dc398e2ef1`. Original location `%TEMP%/hosted-private-railway-home-independent.test.ts`. It contains no real credential bytes. The fixed dependency and fake runner definitions below are synthetic; the live-readonly branch uses only the operator's credential file reference and stops before the adapter.

```typescript
import {expect,test} from 'bun:test'
import {mkdtemp,mkdir,readFile,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {dirname,join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {readMigrationManifest} from 'C:/Users/nimab/.codex/worktrees/inventory-plan-delivery/Neuvetra/packages/neuvetra-database/src/staging-migrations'
import {hash,sha256} from 'C:/Users/nimab/.codex/worktrees/inventory-plan-delivery/Neuvetra/tools/staging/hosted-setup-upgrade'
import {ARTIFACT_CONFIG,PUBLICATION_PROFILE,type ArtifactPaths,type ArtifactTrustPolicy} from 'C:/Users/nimab/.codex/worktrees/inventory-plan-delivery/Neuvetra/tools/staging/hosted-setup-artifact-source'
import {FILE_ARCHIVE_PROFILE,materializeHostedSetupArtifact} from 'C:/Users/nimab/.codex/worktrees/inventory-plan-delivery/Neuvetra/tools/staging/hosted-setup-artifact-materialize'
import {superviseHostedSetupArtifact,type FixedSupervisorRequest} from 'C:/Users/nimab/.codex/worktrees/inventory-plan-delivery/Neuvetra/tools/staging/hosted-setup-artifact-supervisor'

const HEAD='a'.repeat(40)
const bytes=(s:string)=>new TextEncoder().encode(s)
async function put(path:string,value:string|Uint8Array){await mkdir(dirname(path),{recursive:true});await writeFile(path,value)}
const toArchive=(files:Map<string,Uint8Array>)=>({profile:FILE_ARCHIVE_PROFILE,files:[...files].sort(([a],[b])=>a<b?-1:1).map(([path,value])=>({path,kind:'file',contentBase64:Buffer.from(value).toString('base64')}))})
const pins=(a:ReturnType<typeof toArchive>)=>a.files.map(f=>({path:f.path,sha256:sha256(Buffer.from(f.contentBase64,'base64'))}))
let runtimeHash:Promise<string>|undefined
// These are explicit synthetic lifecycle modules, not native DB or evidence
// binding implementations. Actual API compatibility is checked by TypeScript.
const fakeAdapter=`import {appendFileSync,existsSync} from 'node:fs';import {join} from 'node:path';
 export async function createHostedSetupDedicatedClient(options){
 const log=(kind)=>appendFileSync(options.fixtureLog,JSON.stringify({kind,pid:process.pid,nodeOptions:process.env.NODE_OPTIONS??null,bunOptions:process.env.BUN_OPTIONS??null,ambient:process.env.WORKER_FIXTURE_ENV??null,privateRailwayCredentialPresent:existsSync(join(process.env.HOME,'.railway','config.json'))})+'\\n');
 log('adapter');return{transaction:async operation=>{log('transaction');return operation({query:async()=>({rows:[]}),exec:async()=>{}})},close:async()=>{log('close')}};}`
const fakeRunner=`export async function runHostedSetupTransactionalUpgrade(db,input,deps){
 if(deps.fixtureMode==='preflight-refuse')throw Error(deps.fixtureSecret);
 const result=await db.transaction(async tx=>{await tx.query('fixture');return {status:'hosted_setup_schema23_transaction_committed_and_observed'}});
 if(deps.fixtureMode==='double')await db.transaction(async()=>{});return result;}
 export async function reconcileHostedSetupTransactionalCommit(db,input){if(!await input.observeOriginalTransactionResolved())throw Error('unresolved');return db.transaction(async()=>({status:'hosted_setup_commit_marker_present_after_resolution'}));}`
const fakeBindings=`import {readFileSync,writeFileSync} from 'node:fs';import {join} from 'node:path';export async function prepareHostedSetupArtifactUpgrade(c){
 if(c.payload.fixtureMode==='credential-stdout'){console.log(readFileSync(join(process.env.HOME,'.railway','config.json'),'utf8'));throw Error('refuse')}
 if(c.payload.fixtureMode==='credential-stderr'){console.error(readFileSync(join(process.env.HOME,'.railway','config.json'),'utf8'));throw Error('refuse')}
 if(c.payload.fixtureMode==='overflow'){console.log('X'.repeat(100000));throw Error('refuse')}
 if(c.payload.fixtureMode==='descendant'){const child=Bun.spawn([process.execPath,'--eval',"setTimeout(()=>process.exit(0),2200)"],{stdout:'inherit',stderr:'inherit',stdin:'ignore',windowsHide:true});writeFileSync(c.payload.descendantPid,String(child.pid));await new Promise(()=>{})}
 if(c.payload.fixtureMode==='live-readonly'){
  const {captureHostedSetupRailwayDeployment,RAILWAY_CAPTURE_PROFILE}=await import('./hosted-setup-railway-capture');
  const r=await captureHostedSetupRailwayDeployment({profile:RAILWAY_CAPTURE_PROFILE,executablePath:c.payload.cli,workingDirectory:process.cwd(),timeoutMs:15000});
  const status=JSON.parse(r.capture.statusJson),data=JSON.parse(r.capture.inventoryJson).data;
  if(status.id!==r.target.projectId||data.service.id!==r.target.serviceId||data.environment.id!==r.target.environmentId)throw Error('target');
  writeFileSync(c.payload.safeResult,JSON.stringify({observedUtc:r.capture.completedUtc,captureSha256:r.sha256,projectId:status.id,environmentId:data.environment.id,serviceId:data.service.id,providerMutationAuthorized:r.providerMutationAuthorized,privateHome:process.env.HOME}));throw Error('read-only QA ends before adapter');
 }
 if(c.payload.fixtureMode==='hang')await new Promise(()=>{});
 if(c.payload.fixtureMode==='exit')process.exit(99);
 if(c.payload.fixtureMode==='noise'){console.error(c.payload.secret);throw Error(c.payload.secret);}
 return{clientOptions:{fixtureLog:c.payload.fixtureLog},input:{journalPath:c.transactionJournalPath},dependencies:{fixtureMode:c.payload.fixtureMode,fixtureSecret:c.payload.secret}};}
 export async function prepareHostedSetupArtifactReconciliation(c){return{clientOptions:{fixtureLog:c.payload.fixtureLog},reconciliation:{observeOriginalTransactionResolved:()=>c.payload.originalResolved===true}};}`
async function fixture(withBindings=true,realCollector=false){
 const root=await mkdtemp(join(tmpdir(),'hosted-fixed-worker-')),checkout=join(root,'checkout');await mkdir(checkout)
 const paths:ArtifactPaths={publication:join(root,'publication.json'),sourceArchive:join(root,'source.archive.json'),dependencyArchive:join(root,'dependencies.archive.json'),sourceRoot:join(root,'source'),dependencyRoot:join(root,'dependencies'),runtimeExecutable:process.execPath,supervisor:"C:/Users/nimab/.codex/worktrees/inventory-plan-delivery/Neuvetra/tools/staging/hosted-setup-artifact-supervisor.ts",config:join(root,'controlled.toml')}
 const source=new Map<string,Uint8Array>(),manifest=await readMigrationManifest()
 for(const path of ['tools/staging/hosted-setup-artifact-worker.ts','tools/staging/hosted-setup-artifact-source.ts','packages/neuvetra-database/src/staging-migrations.ts','packages/neuvetra-database/src/staging-audit.ts'])source.set(path,new Uint8Array(await readFile(join("C:/Users/nimab/.codex/worktrees/inventory-plan-delivery/Neuvetra",path))))
 for(const row of manifest)source.set('packages/neuvetra-database/src/migrations/'+row.name,bytes(row.sql))
 source.set('packages/neuvetra-database/package.json',bytes('{"name":"fixture-anchor"}'))
 source.set('.env',bytes('WORKER_FIXTURE_ENV=unexpected\n'));source.set('bunfig.toml',bytes('preload = ["./preload.ts"]\n'));source.set('preload.ts',bytes('throw Error("UNCONTROLLED_FIXTURE_PRELOAD")'))
 source.set('tools/staging/hosted-setup-dedicated-client.ts',bytes(fakeAdapter));source.set('tools/staging/hosted-setup-transactional-upgrade.ts',bytes(fakeRunner))
 if(realCollector)for(const p of ['hosted-setup-railway-capture.ts','hosted-setup-railway-cli.ts','hosted-setup-deployment-binding.ts','hosted-setup-write-gate.ts','hosted-setup-upgrade.ts'])source.set('tools/staging/'+p,new Uint8Array(await readFile(join("C:/Users/nimab/.codex/worktrees/inventory-plan-delivery/Neuvetra",'tools/staging',p))));
 if(withBindings)source.set('tools/staging/hosted-setup-artifact-bindings.ts',bytes(fakeBindings))
 const dependency=new Map([['node_modules/pg/package.json',bytes('{"name":"pg","main":"index.js"}')],['node_modules/pg/index.js',bytes('module.exports={};')]])
 const src=toArchive(source),dep=toArchive(dependency),srcText=JSON.stringify(src),depText=JSON.stringify(dep)
 await put(paths.sourceArchive,srcText);await put(paths.dependencyArchive,depText);await put(paths.config,ARTIFACT_CONFIG)
 const receipt={profile:PUBLICATION_PROFILE,trustBoundary:'trusted-operator-host',reviewedProductHead:HEAD,repository:'neuvetra-hq/neuvetra',pullRequest:6,operatorId:'fixture-operator',independentReviewerId:'fixture-reviewer',materialFindingsOpen:0,observedAtMs:Date.now()-1000,expiresAtMs:Date.now()+600000,checks:[{name:'synthetic',head:HEAD,conclusion:'success'}],sourceFiles:pins(src),dependencyFiles:pins(dep),migrations:manifest.map(row=>({name:row.name,path:'packages/neuvetra-database/src/migrations/'+row.name,sha256:sha256(row.sql),normalizedSha256:row.sha256})),migrationManifestSha256:hash(manifest),artifact:{sourceArchiveSha256:sha256(srcText),dependencyArchiveSha256:sha256(depText),runtimeSha256:await(runtimeHash??=readFile(process.execPath).then(sha256)),supervisorSha256:sha256(await readFile(paths.supervisor)),configSha256:sha256(ARTIFACT_CONFIG),entrypoint:'tools/staging/hosted-setup-artifact-worker.ts',launchPolicy:'neuvetra.hosted-setup.fixed-bun-worker.v1'}}
 const publication=JSON.stringify(receipt);await put(paths.publication,publication)
 const policy:ArtifactTrustPolicy={publicationSha256:sha256(publication),reviewedProductHead:HEAD,operatorId:'fixture-operator',independentReviewerId:'fixture-reviewer',requiredChecks:['synthetic'],activeCheckoutRoots:[checkout]}
 await materializeHostedSetupArtifact(paths,policy)
 const fixtureLog=join(root,'synthetic-db-calls.jsonl'),secret='PRIVATE-FIXTURE-SENTINEL'
 const railwayCredentialConfigPath=join(root,'railway-auth','.railway','config.json')
 await put(railwayCredentialConfigPath,JSON.stringify({token:secret}))
 const request:FixedSupervisorRequest={paths,policy,mode:'upgrade',payload:{fixtureMode:'success',fixtureLog,secret},attemptJournalPath:join(root,'attempt.jsonl'),transactionJournalPath:join(root,'transaction.jsonl'),deadlineMs:5000,railwayCredentialConfigPath}
 const calls=async()=>await Bun.file(fixtureLog).exists()?(await readFile(fixtureLog,'utf8')).trim().split('\n').map(s=>JSON.parse(s)):[]
 return{root,request,calls,fixtureLog,secret}
}
import {lstat,readdir,symlink,rm} from 'node:fs/promises';
async function cleanupChecked(f:any,out:any){
 const journal=await readFile(f.request.attemptJournalPath,'utf8');
 expect(journal).not.toContain(f.secret);expect(JSON.stringify(out)).not.toContain(f.secret);
 const row=journal.trim().split('\n').map(l=>JSON.parse(l)).find(r=>r.status==='private_home_created');
 expect(row).toBeDefined();expect(journal).toContain('private_home_removed');
 expect(await lstat(row.privateHomePath).then(()=>true,()=>false)).toBe(false);
 expect(journal.trim().split('\n').map(l=>JSON.parse(l)).filter(r=>r.status==='worker_spawned').length).toBeLessThanOrEqual(1);
 expect(out.launchAuthorized).toBe(false);expect(out.noAutomaticRetry).toBe(true);
 return row.privateHomePath;
}
test('independent path validation refuses missing, wrong leaf, checkout, empty, oversized, directory and redirected ancestor',async()=>{
 const f=await fixture();
 const empty=join(f.root,'empty','.railway','config.json'),large=join(f.root,'large','.railway','config.json'),dir=join(f.root,'dir','.railway','config.json'),wrong=join(f.root,'.railway','other.json'),checkout=join(f.request.policy.activeCheckoutRoots[0]!,'.railway','config.json');
 await put(empty,'');await put(large,'X'.repeat(65537));await mkdir(dir,{recursive:true});await put(wrong,'{}');await put(checkout,'{}');
 const linked=join(f.root,'junction');await symlink(dirname(dirname(f.request.railwayCredentialConfigPath)),linked,'junction');
 for(const p of ['relative/.railway/config.json',join(f.root,'missing','.railway','config.json'),empty,large,dir,wrong,checkout,join(linked,'.railway','config.json')]){
  await expect(superviseHostedSetupArtifact({...f.request,railwayCredentialConfigPath:p})).rejects.toThrow();
  expect(await Bun.file(f.request.attemptJournalPath).exists()).toBe(false);
 }
 expect((await readdir(f.root)).filter(n=>n.startsWith('hosted-worker-home-'))).toEqual([]);
 // Synthetic junction retained with disposable fixture; cleanup tested separately with native PowerShell.
});
test('private copied credential is removed on all exercised ordinary exit paths and never forwarded',async()=>{
 for(const mode of ['success','preflight-refuse','double','hang','exit','credential-stdout','credential-stderr','overflow','oversize']){
  const f=await fixture();(f.request.payload as any).fixtureMode=mode;
  if(mode==='hang')f.request.deadlineMs=400;
  if(mode==='oversize')(f.request.payload as any).large='A'.repeat(8*1024*1024);
  const out=await superviseHostedSetupArtifact(f.request);
  expect(out.status).toBe(mode==='success'?'worker_completed':'refused_or_uncertain');
  await cleanupChecked(f,out);
  expect(await Bun.file(f.request.railwayCredentialConfigPath).exists()).toBe(true);
  if(mode!=='success'&&mode!=='double')expect(await f.calls()).toEqual([]);
 }
},30000);
test('deadline bounds worker with a harmless descendant inheriting its output streams',async()=>{
 const f=await fixture();(f.request.payload as any).fixtureMode='descendant';(f.request.payload as any).descendantPid=join(f.root,'descendant.pid');f.request.deadlineMs=1000;
 const start=Date.now();const out=await superviseHostedSetupArtifact(f.request);const elapsed=Date.now()-start;
 await cleanupChecked(f,out);expect(out.status).toBe('refused_or_uncertain');expect(out.timedOut).toBe(true);
 console.log(JSON.stringify({probe:'deadline-descendant',elapsedMs:elapsed,deadlineMs:1000,descendantStarted:await Bun.file((f.request.payload as any).descendantPid).exists()}));
 expect(elapsed).toBeLessThan(1800);
},10000);
test('real pinned Railway collector authenticates from supervisor copied private home then ends before DB',async()=>{
 const cli='C:/Users/nimab/Neuvetra/m63-runtime/railway-cli/node_modules/@railway/cli/bin/railway.exe';
 expect(sha256(await readFile(cli))).toBe('f9351033614c86882332a5c82e1856b21792b176ebf84a9417dfd1362c425177');
 const f=await fixture(true,true),safeResult=join(f.root,'readonly-auth-sanitized.json');
 f.request.railwayCredentialConfigPath=join(process.env.USERPROFILE!,'.railway','config.json');
 f.request.deadlineMs=45000;f.request.payload={fixtureMode:'live-readonly',cli,safeResult,fixtureLog:f.fixtureLog};
 const out=await superviseHostedSetupArtifact(f.request);
 expect(out.status).toBe('refused_or_uncertain');expect(out.worker?.adapterConstructions).toBe(0);expect(await f.calls()).toEqual([]);
 await cleanupChecked(f,out);
 expect(await Bun.file(safeResult).exists()).toBe(true);
 if(await Bun.file(safeResult).exists()){
  const safe=JSON.parse(await readFile(safeResult,'utf8'));
  expect(safe).toMatchObject({projectId:'119f3652-9d84-4d16-983c-1a17c0fd1aaa',environmentId:'6642d65a-15a2-41e9-b25e-b7b01990aa28',serviceId:'f43abcf9-72f0-4034-828a-8d83ca26b0db',providerMutationAuthorized:false});
  console.log(JSON.stringify({probe:'real-readonly-auth',safeEvidence:safeResult,...safe}));
 }
},60000);
```
