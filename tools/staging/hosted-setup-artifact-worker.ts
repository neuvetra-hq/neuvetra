/** Fixed one-shot entrypoint. Authentic evidence/provider bindings are a separate
 * reviewed module, never a caller-selected import or verifier callback. */
import {lstat,realpath} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {isAbsolute,relative,resolve} from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {verifyHostedSetupArtifact,lockHostedSetupArtifactSql,type ArtifactPaths,type ArtifactTrustPolicy,type ArtifactInspection} from './hosted-setup-artifact-source'
import type {HostedSetupDedicatedClientOptions} from './hosted-setup-dedicated-client'
import type {HostedSetupTransactionalDependencies,HostedSetupUncertainCommitReconciliation} from './hosted-setup-transactional-upgrade'
import type {HostedSetupUpgradeInput} from './hosted-setup-upgrade'
import type {WorkspaceConnection,WorkspaceSql} from '../../packages/neuvetra-database/src/workspace'

export const FIXED_WORKER_PROFILE='neuvetra.hosted-setup.fixed-artifact-worker.v1' as const
export const FIXED_WORKER_ENTRY='tools/staging/hosted-setup-artifact-worker.ts' as const
export const FIXED_BINDINGS_ENTRY='tools/staging/hosted-setup-artifact-bindings.ts' as const
export interface FixedWorkerEnvelope {
 profile:typeof FIXED_WORKER_PROFILE;mode:'upgrade'|'reconcile';paths:ArtifactPaths;policy:ArtifactTrustPolicy
 transactionJournalPath:string;payload:unknown;deadlineMs:number
}
export interface FixedBindingContext extends FixedWorkerEnvelope {inspection:ArtifactInspection}
export interface FixedUpgradePreparation {
 clientOptions:HostedSetupDedicatedClientOptions;input:HostedSetupUpgradeInput
 dependencies:Omit<HostedSetupTransactionalDependencies,'artifactSqlLock'>
}
export interface FixedReconciliationPreparation {
 clientOptions:HostedSetupDedicatedClientOptions;reconciliation:HostedSetupUncertainCommitReconciliation
}
export interface FixedArtifactBindings {
 prepareHostedSetupArtifactUpgrade(context:FixedBindingContext):Promise<FixedUpgradePreparation>
 prepareHostedSetupArtifactReconciliation(context:FixedBindingContext):Promise<FixedReconciliationPreparation>
}
export interface FixedWorkerOutcome {
 profile:typeof FIXED_WORKER_PROFILE;status:'completed'|'refused_or_uncertain';mode:'upgrade'|'reconcile'
 workerPid:number;adapterConstructions:number;transactions:number;databaseMayHaveBeenEntered:boolean
 resultStatus:string|null;resultSha256:string|null;executionArtifactSha256:string|null;launchAuthorized:false;noAutomaticRetry:true
}
function check(value:unknown):asserts value{if(!value)throw Error('FIXED_WORKER_REFUSED')}
function same(a:string,b:string){const norm=(p:string)=>process.platform==='win32'?resolve(p).toLowerCase():resolve(p);return norm(a)===norm(b)}
function inside(root:string,path:string){const r=relative(root,path);return r!==''&&!r.startsWith('..')&&!isAbsolute(r)}
async function regular(path:string){const s=await lstat(path);check(s.isFile()&&!s.isSymbolicLink()&&same(await realpath(path),path))}
let consumed=false
/** No factory injection. Imports and construction sites below are fixed. */
export async function runFixedHostedSetupWorker(input:FixedWorkerEnvelope):Promise<FixedWorkerOutcome>{
 check(!consumed);consumed=true
 let mode:'upgrade'|'reconcile'='upgrade',adapterConstructions=0,transactions=0,executionArtifactSha256:string|null=null
 let actualDb:WorkspaceConnection|undefined,timer:ReturnType<typeof setTimeout>|undefined
 try{
  const envelope=JSON.parse(JSON.stringify(input)) as FixedWorkerEnvelope
  check(Object.keys(envelope).sort().join('|')==='deadlineMs|mode|paths|payload|policy|profile|transactionJournalPath')
  check(envelope.profile===FIXED_WORKER_PROFILE&&(envelope.mode==='upgrade'||envelope.mode==='reconcile'));mode=envelope.mode
  check(Number.isSafeInteger(envelope.deadlineMs)&&envelope.deadlineMs>=100&&envelope.deadlineMs<=300000)
  timer=setTimeout(()=>process.exit(124),envelope.deadlineMs)
  const {paths,policy}=envelope
  check(same(fileURLToPath(import.meta.url),resolve(paths.sourceRoot,FIXED_WORKER_ENTRY)))
  check(same(await realpath(process.execPath),await realpath(paths.runtimeExecutable)))
  check(Bun.version==='1.3.12'&&process.argv.length===2)
  const inspection=await verifyHostedSetupArtifact(paths,policy);executionArtifactSha256=inspection.executionArtifactSha256
  // Resolve pg before any application/provider bindings or pg imports. The
  // published artifact pins these bytes; this is not a complete loader graph.
  const require=createRequire(pathToFileURL(resolve(paths.sourceRoot,'packages/neuvetra-database/package.json')))
  const pgPath=require.resolve('pg');await regular(pgPath);check(inside(paths.dependencyRoot,pgPath))
  check(process.env.NODE_PATH===resolve(paths.dependencyRoot,'node_modules'))
  const bindingPath=resolve(paths.sourceRoot,FIXED_BINDINGS_ENTRY);await regular(bindingPath)
  const bindings=await import(pathToFileURL(bindingPath).href) as FixedArtifactBindings
  const context=Object.freeze({...envelope,inspection})
  const artifactSqlLock=mode==='upgrade'?await lockHostedSetupArtifactSql(inspection):undefined
  const preparation=mode==='upgrade'?await bindings.prepareHostedSetupArtifactUpgrade(context):await bindings.prepareHostedSetupArtifactReconciliation(context)
  // Capture private connection configuration before deferred module imports;
  // the binding module must not retain a mutable target used at connection time.
  const clientOptions=JSON.parse(JSON.stringify(preparation.clientOptions)) as HostedSetupDedicatedClientOptions
  if(mode==='upgrade')check((preparation as FixedUpgradePreparation).input.journalPath===envelope.transactionJournalPath)
  const {createHostedSetupDedicatedClient}=await import('./hosted-setup-dedicated-client')
  const {runHostedSetupTransactionalUpgrade,reconcileHostedSetupTransactionalCommit}=await import('./hosted-setup-transactional-upgrade')
  const db:WorkspaceConnection=Object.freeze({
   query:async()=>{throw Error('FIXED_WORKER_ROOT_QUERY_REFUSED')},
   exec:async()=>{throw Error('FIXED_WORKER_ROOT_QUERY_REFUSED')},
   close:async()=>{throw Error('FIXED_WORKER_OWNS_CLOSE')},
   transaction:async<T>(operation:(tx:WorkspaceSql)=>Promise<T>)=>{
    check(transactions===0);transactions++
    check(adapterConstructions===0);adapterConstructions++
    actualDb=await createHostedSetupDedicatedClient(clientOptions)
    return actualDb.transaction(operation)
   },
  })
  const result=mode==='upgrade'
   ?await runHostedSetupTransactionalUpgrade(db,(preparation as FixedUpgradePreparation).input,{...(preparation as FixedUpgradePreparation).dependencies,artifactSqlLock:artifactSqlLock!})
   :await reconcileHostedSetupTransactionalCommit(db,(preparation as FixedReconciliationPreparation).reconciliation)
  check(transactions===1&&adapterConstructions===1)
  const permitted=mode==='upgrade'?['hosted_setup_schema23_transaction_committed_and_observed']:['hosted_setup_no_commit_marker_after_resolution','hosted_setup_commit_marker_present_after_resolution']
  check(permitted.includes(result.status))
  // Only a fixed status and receipt hash leave this process; arbitrary binding
  // outputs and credentials are never copied to stdout or the parent journal.
  const resultSha256=new Bun.CryptoHasher('sha256').update(JSON.stringify(result)).digest('hex')
  await actualDb!.close();actualDb=undefined
  return Object.freeze({profile:FIXED_WORKER_PROFILE,status:'completed',mode,workerPid:process.pid,adapterConstructions,transactions,databaseMayHaveBeenEntered:true,resultStatus:result.status,resultSha256,executionArtifactSha256,launchAuthorized:false,noAutomaticRetry:true})
 }catch{
  return Object.freeze({profile:FIXED_WORKER_PROFILE,status:'refused_or_uncertain',mode,workerPid:process.pid,adapterConstructions,transactions,databaseMayHaveBeenEntered:adapterConstructions>0,resultStatus:null,resultSha256:null,executionArtifactSha256,launchAuthorized:false,noAutomaticRetry:true})
 }finally{try{if(actualDb)await actualDb.close()}catch{}if(timer)clearTimeout(timer)}
}
if(import.meta.main){
 let outcome:FixedWorkerOutcome|undefined
 try{
  const reader=Bun.stdin.stream().getReader(),parts:Uint8Array[]=[];let size=0
  for(;;){const next=await reader.read();if(next.done)break;size+=next.value.length;check(size<=8*1024*1024);parts.push(next.value)}
  const input=JSON.parse(Buffer.concat(parts).toString('utf8')) as FixedWorkerEnvelope
  outcome=await runFixedHostedSetupWorker(input)
  await Bun.write(Bun.stdout,JSON.stringify(outcome)+'\n')
 }catch{/* Never print request, parser errors, binding errors or credentials. */}
 process.exit(outcome?.status==='completed'?0:78)
}
