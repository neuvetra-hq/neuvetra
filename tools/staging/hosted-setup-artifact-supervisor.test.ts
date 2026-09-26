import {expect,test} from 'bun:test'
import {mkdtemp,mkdir,readFile,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {dirname,join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {readMigrationManifest} from '../../packages/neuvetra-database/src/staging-migrations'
import {hash,sha256} from './hosted-setup-upgrade'
import {ARTIFACT_CONFIG,PUBLICATION_PROFILE,type ArtifactPaths,type ArtifactTrustPolicy} from './hosted-setup-artifact-source'
import {FILE_ARCHIVE_PROFILE,materializeHostedSetupArtifact} from './hosted-setup-artifact-materialize'
import {superviseHostedSetupArtifact,type FixedSupervisorRequest} from './hosted-setup-artifact-supervisor'

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
const fakeBindings=`export async function prepareHostedSetupArtifactUpgrade(c){
 if(c.payload.fixtureMode==='hang')await new Promise(()=>{});
 if(c.payload.fixtureMode==='exit')process.exit(99);
 if(c.payload.fixtureMode==='noise'){console.error(c.payload.secret);throw Error(c.payload.secret);}
 return{clientOptions:{fixtureLog:c.payload.fixtureLog},input:{journalPath:c.transactionJournalPath},dependencies:{fixtureMode:c.payload.fixtureMode,fixtureSecret:c.payload.secret}};}
 export async function prepareHostedSetupArtifactReconciliation(c){return{clientOptions:{fixtureLog:c.payload.fixtureLog},reconciliation:{observeOriginalTransactionResolved:()=>c.payload.originalResolved===true}};}`
async function fixture(withBindings=true){
 const root=await mkdtemp(join(tmpdir(),'hosted-fixed-worker-')),checkout=join(root,'checkout');await mkdir(checkout)
 const paths:ArtifactPaths={publication:join(root,'publication.json'),sourceArchive:join(root,'source.archive.json'),dependencyArchive:join(root,'dependencies.archive.json'),sourceRoot:join(root,'source'),dependencyRoot:join(root,'dependencies'),runtimeExecutable:process.execPath,supervisor:fileURLToPath(new URL('./hosted-setup-artifact-supervisor.ts',import.meta.url)),config:join(root,'controlled.toml')}
 const source=new Map<string,Uint8Array>(),manifest=await readMigrationManifest()
 for(const path of ['tools/staging/hosted-setup-artifact-worker.ts','tools/staging/hosted-setup-artifact-source.ts','packages/neuvetra-database/src/staging-migrations.ts','packages/neuvetra-database/src/staging-audit.ts'])source.set(path,new Uint8Array(await readFile(new URL('../../'+path,import.meta.url))))
 for(const row of manifest)source.set('packages/neuvetra-database/src/migrations/'+row.name,bytes(row.sql))
 source.set('packages/neuvetra-database/package.json',bytes('{"name":"fixture-anchor"}'))
 source.set('.env',bytes('WORKER_FIXTURE_ENV=unexpected\n'));source.set('bunfig.toml',bytes('preload = ["./preload.ts"]\n'));source.set('preload.ts',bytes('throw Error("UNCONTROLLED_FIXTURE_PRELOAD")'))
 source.set('tools/staging/hosted-setup-dedicated-client.ts',bytes(fakeAdapter));source.set('tools/staging/hosted-setup-transactional-upgrade.ts',bytes(fakeRunner))
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
test('fresh fixed worker performs one adapter/transaction and private input never enters its journal',async()=>{
 const f=await fixture(),oldNode=process.env.NODE_OPTIONS,oldBun=process.env.BUN_OPTIONS
 process.env.NODE_OPTIONS='--require=missing';process.env.BUN_OPTIONS='--preload=missing'
 let outcome:Awaited<ReturnType<typeof superviseHostedSetupArtifact>>
 try{outcome=await superviseHostedSetupArtifact(f.request)}finally{if(oldNode===undefined)delete process.env.NODE_OPTIONS;else process.env.NODE_OPTIONS=oldNode;if(oldBun===undefined)delete process.env.BUN_OPTIONS;else process.env.BUN_OPTIONS=oldBun}
 expect(outcome.status).toBe('worker_completed');expect(outcome.launchAuthorized).toBe(false)
 expect(outcome.worker?.adapterConstructions).toBe(1);expect(outcome.worker?.transactions).toBe(1)
 expect((await f.calls()).map(c=>c.kind)).toEqual(['adapter','transaction','close'])
 expect((await f.calls()).every(c=>c.pid===outcome.childPid&&c.nodeOptions===null&&c.bunOptions===null&&c.ambient===null)).toBe(true)
 expect((await f.calls()).every(c=>c.privateRailwayCredentialPresent===true)).toBe(true)
 const journal=await readFile(f.request.attemptJournalPath,'utf8');expect(journal.includes(f.secret)).toBe(false)
 const privateHome=(JSON.parse(journal.split('\n').find(line=>line.includes('private_home_created'))!) as {privateHomePath:string}).privateHomePath
 expect(await Bun.file(join(privateHome,'.railway','config.json')).exists()).toBe(false)
 expect(journal).toContain('private_home_removed')
 await expect(superviseHostedSetupArtifact(f.request)).rejects.toThrow('JOURNAL_ALREADY_EXISTS')
})
test('missing fixed bindings and runner preflight refusal occur before any adapter',async()=>{
 for(const absent of [true,false]){
  const f=await fixture(!absent);if(!absent)(f.request.payload as any).fixtureMode='preflight-refuse'
  const outcome=await superviseHostedSetupArtifact(f.request)
  expect(outcome.status).toBe('refused_or_uncertain');expect(outcome.worker?.adapterConstructions).toBe(0);expect(await f.calls()).toEqual([])
  expect((await readFile(f.request.attemptJournalPath,'utf8')).includes(f.secret)).toBe(false)
 }
})
test('second transaction is refused; explicit reconciliation uses another fresh process',async()=>{
 const f=await fixture();(f.request.payload as any).fixtureMode='double'
 const first=await superviseHostedSetupArtifact(f.request)
 expect(first.status).toBe('refused_or_uncertain');expect((await f.calls()).filter(c=>c.kind==='adapter')).toHaveLength(1)
 const unresolved=await superviseHostedSetupArtifact({...f.request,mode:'reconcile',payload:{fixtureLog:f.fixtureLog,originalResolved:false},attemptJournalPath:join(f.root,'unresolved-attempt.jsonl'),transactionJournalPath:join(f.root,'unresolved-transaction.jsonl')})
 expect(unresolved.worker?.adapterConstructions).toBe(0)
 const second=await superviseHostedSetupArtifact({...f.request,mode:'reconcile',payload:{fixtureLog:f.fixtureLog,originalResolved:true},attemptJournalPath:join(f.root,'reconcile-attempt.jsonl'),transactionJournalPath:join(f.root,'reconcile-transaction.jsonl')})
 expect(second.status).toBe('worker_completed');expect(second.childPid).not.toBe(first.childPid)
 expect((await f.calls()).filter(c=>c.kind==='adapter')).toHaveLength(2)
})
test('outer deadline kills only its child and records uncertainty without retry',async()=>{
 const f=await fixture();(f.request.payload as any).fixtureMode='hang';f.request.deadlineMs=400
 const sibling=Bun.spawn([process.execPath,'--no-env-file','--no-install','--eval','setInterval(()=>{},1000)'],{stdin:'ignore',stdout:'ignore',stderr:'ignore',windowsHide:true})
 try{
  const outcome=await superviseHostedSetupArtifact(f.request)
  expect(outcome.status).toBe('refused_or_uncertain');expect(outcome.timedOut).toBe(true);expect(outcome.noAutomaticRetry).toBe(true)
  expect(sibling.exitCode).toBe(null);expect(await f.calls()).toEqual([])
  expect(await readFile(f.request.attemptJournalPath,'utf8')).toContain('refused_or_uncertain_do_not_retry')
 }finally{sibling.kill();await sibling.exited}
})
test('tampered artifact and arbitrary flags never start a worker',async()=>{
 const f=await fixture();await put(join(f.request.paths.sourceRoot,'unexpected.ts'),'bad')
 const outcome=await superviseHostedSetupArtifact(f.request);expect(outcome.childPid).toBe(null);expect(outcome.status).toBe('refused_or_uncertain');expect(await f.calls()).toEqual([])
 await expect(superviseHostedSetupArtifact({...f.request,args:['--preload=bad']} as any)).rejects.toThrow('FIXED_SUPERVISOR_REFUSED')
})
test('abrupt worker exit and unexpected stderr remain uncertain and never enter parent journal',async()=>{
 for(const mode of ['exit','noise']){
  const f=await fixture();(f.request.payload as any).fixtureMode=mode
  const outcome=await superviseHostedSetupArtifact(f.request)
  expect(outcome.status).toBe('refused_or_uncertain');expect(outcome.worker).toBe(null);expect(outcome.noAutomaticRetry).toBe(true)
  expect(await f.calls()).toEqual([])
  const journal=await readFile(f.request.attemptJournalPath,'utf8');expect(journal).not.toContain(f.secret);expect(journal).toContain('refused_or_uncertain_do_not_retry')
 }
})
