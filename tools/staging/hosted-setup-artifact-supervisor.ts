/** Trusted-operator-host, fixed-entry supervisor. No provider operations/retries. */
import {copyFile,lstat,mkdir,mkdtemp,open,realpath,rm} from 'node:fs/promises'
import {constants as fsConstants} from 'node:fs'
import {basename,dirname,isAbsolute,join,relative,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {verifyHostedSetupArtifact,type ArtifactPaths,type ArtifactTrustPolicy} from './hosted-setup-artifact-source'
import type {FixedWorkerEnvelope,FixedWorkerOutcome} from './hosted-setup-artifact-worker'

const PROFILE='neuvetra.hosted-setup.fixed-artifact-worker.v1' as const
const ENTRY='tools/staging/hosted-setup-artifact-worker.ts'
export const FIXED_SUPERVISOR_PROFILE='neuvetra.hosted-setup.fixed-supervisor.v1' as const
export interface FixedSupervisorRequest {
 paths:ArtifactPaths;policy:ArtifactTrustPolicy;mode:'upgrade'|'reconcile';payload:unknown
 attemptJournalPath:string;transactionJournalPath:string;deadlineMs:number;railwayCredentialConfigPath:string
}
export interface FixedSupervisorOutcome {
 profile:typeof FIXED_SUPERVISOR_PROFILE;status:'worker_completed'|'refused_or_uncertain';mode:'upgrade'|'reconcile'
 childPid:number|null;worker:FixedWorkerOutcome|null;timedOut:boolean;launchAuthorized:false;noAutomaticRetry:true
}
function check(value:unknown):asserts value{if(!value)throw Error('FIXED_SUPERVISOR_REFUSED')}
function cmp(path:string){return process.platform==='win32'?resolve(path).toLowerCase():resolve(path)}
function overlaps(a:string,b:string){const r=relative(cmp(a),cmp(b));return r===''||(!r.startsWith('..')&&!isAbsolute(r))}
async function regularDirectory(path:string){const s=await lstat(path);check(s.isDirectory()&&!s.isSymbolicLink()&&cmp(await realpath(path))===cmp(path))}
async function externalNewPath(path:string,request:FixedSupervisorRequest){
 check(typeof path==='string'&&isAbsolute(path));await regularDirectory(dirname(path))
 const leaf=basename(path);check(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,150}$/.test(leaf)&&!/[.]$/.test(leaf)&&!/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(leaf))
 for(const root of [request.paths.sourceRoot,request.paths.dependencyRoot,...request.policy.activeCheckoutRoots])check(!overlaps(root,path))
 try{await lstat(path)}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return;throw e}
 throw Error('FIXED_SUPERVISOR_JOURNAL_ALREADY_EXISTS')
}
function workerOutcome(value:unknown,pid:number,mode:string,artifactSha:string):FixedWorkerOutcome{
 check(value!==null&&typeof value==='object'&&!Array.isArray(value));const v=value as FixedWorkerOutcome
 check(Object.keys(v).sort().join('|')==='adapterConstructions|databaseMayHaveBeenEntered|executionArtifactSha256|launchAuthorized|mode|noAutomaticRetry|profile|resultSha256|resultStatus|status|transactions|workerPid')
 check(v.profile===PROFILE&&v.workerPid===pid&&v.mode===mode&&v.launchAuthorized===false&&v.noAutomaticRetry===true)
 check(v.executionArtifactSha256===artifactSha||v.executionArtifactSha256===null)
 check((v.adapterConstructions===0||v.adapterConstructions===1)&&(v.transactions===0||v.transactions===1)&&v.databaseMayHaveBeenEntered===(v.adapterConstructions>0))
 check(v.status==='completed'||v.status==='refused_or_uncertain')
 const permitted=mode==='upgrade'?['hosted_setup_schema23_transaction_committed_and_observed']:['hosted_setup_no_commit_marker_after_resolution','hosted_setup_commit_marker_present_after_resolution']
 if(v.status==='completed')check(v.executionArtifactSha256===artifactSha&&v.adapterConstructions===1&&v.transactions===1&&typeof v.resultSha256==='string'&&/^[a-f0-9]{64}$/.test(v.resultSha256)&&permitted.includes(v.resultStatus!))
 else check(v.resultStatus===null&&v.resultSha256===null)
 return Object.freeze(v)
}
/** A fresh explicit invocation uses a new journal and a new process, including reconciliation. */
export async function superviseHostedSetupArtifact(input:FixedSupervisorRequest):Promise<FixedSupervisorOutcome>{
 const request=JSON.parse(JSON.stringify(input)) as FixedSupervisorRequest
 check(Object.keys(request).sort().join('|')==='attemptJournalPath|deadlineMs|mode|paths|payload|policy|railwayCredentialConfigPath|transactionJournalPath')
 check(request.mode==='upgrade'||request.mode==='reconcile')
 check(Number.isSafeInteger(request.deadlineMs)&&request.deadlineMs>=100&&request.deadlineMs<=300000)
 check(Array.isArray(request.policy.activeCheckoutRoots)&&request.policy.activeCheckoutRoots.length>0)
 for(const root of [request.paths.sourceRoot,request.paths.dependencyRoot,...request.policy.activeCheckoutRoots])await regularDirectory(root)
 check(cmp(request.paths.supervisor)===cmp(fileURLToPath(import.meta.url)))
 check(typeof request.railwayCredentialConfigPath==='string'&&isAbsolute(request.railwayCredentialConfigPath))
 const credentialPath=resolve(request.railwayCredentialConfigPath)
 check(basename(credentialPath).toLowerCase()==='config.json'&&basename(dirname(credentialPath)).toLowerCase()==='.railway')
 for(const root of [request.paths.sourceRoot,request.paths.dependencyRoot,...request.policy.activeCheckoutRoots])check(!overlaps(root,credentialPath))
 const credentialStat=await lstat(credentialPath)
 check(credentialStat.isFile()&&!credentialStat.isSymbolicLink()&&credentialStat.size>0&&credentialStat.size<=64*1024&&cmp(await realpath(credentialPath))===cmp(credentialPath))
 check(cmp(request.attemptJournalPath)!==cmp(request.transactionJournalPath))
 await externalNewPath(request.attemptJournalPath,request);await externalNewPath(request.transactionJournalPath,request)
 const journal=await open(request.attemptJournalPath,'wx',0o600)
 const append=async(status:string,fields:Record<string,unknown>={})=>{await journal.writeFile(JSON.stringify({profile:FIXED_SUPERVISOR_PROFILE,status,mode:request.mode,...fields,noAutomaticRetry:true,launchAuthorized:false})+'\n');await journal.sync()}
 let child:ReturnType<typeof Bun.spawn>|undefined,timedOut=false,worker:FixedWorkerOutcome|null=null,timer:ReturnType<typeof setTimeout>|undefined
 let privateHome:string|undefined
 let childPid:number|null=null,completed=false
 try{
  await append('attempt_reserved')
  const inspection=await verifyHostedSetupArtifact(request.paths,request.policy)
  const workerPath=resolve(request.paths.sourceRoot,ENTRY)
  const s=await lstat(workerPath);check(s.isFile()&&!s.isSymbolicLink()&&cmp(await realpath(workerPath))===cmp(workerPath))
  const home=await mkdtemp(join(dirname(request.attemptJournalPath),'hosted-worker-home-'));privateHome=home
  await mkdir(join(home,'.railway'))
  await copyFile(credentialPath,join(home,'.railway','config.json'),fsConstants.COPYFILE_EXCL)
  await append('private_home_created',{privateHomePath:home})
  const envelope:FixedWorkerEnvelope={profile:PROFILE,mode:request.mode,paths:request.paths,policy:request.policy,payload:request.payload,transactionJournalPath:request.transactionJournalPath,deadlineMs:request.deadlineMs}
  const encoded=JSON.stringify(envelope);check(Buffer.byteLength(encoded)<=8*1024*1024)
  const args=[request.paths.runtimeExecutable,'--no-env-file','--no-install','--config='+request.paths.config,workerPath]
  await append('artifact_verified',{executionArtifactSha256:inspection.executionArtifactSha256,deadlineMs:request.deadlineMs,entrypoint:ENTRY,environmentPolicy:'fixed-private-credential-home-and-node-path.v2'})
  child=Bun.spawn(args,{cwd:request.paths.sourceRoot,env:{SystemRoot:process.env.SystemRoot??'C:\\Windows',HOME:home,USERPROFILE:home,XDG_CONFIG_HOME:home,TEMP:home,TMP:home,NODE_PATH:resolve(request.paths.dependencyRoot,'node_modules')},stdin:'pipe',stdout:'pipe',stderr:'pipe',windowsHide:true})
  childPid=child.pid
  timer=setTimeout(()=>{timedOut=true;child!.kill()},request.deadlineMs)
  const read=async(stream:ReadableStream<Uint8Array>,limit:number)=>{
   const reader=stream.getReader(),chunks:Uint8Array[]=[];let count=0
   for(;;){const next=await reader.read();if(next.done)break;count+=next.value.length;if(count>limit){child!.kill();throw Error('WORKER_OUTPUT_LIMIT')}chunks.push(next.value)}
   return Buffer.concat(chunks).toString('utf8')
  }
  const output=read(child.stdout as ReadableStream<Uint8Array>,64*1024),errors=read(child.stderr as ReadableStream<Uint8Array>,64*1024)
  // Attach rejection handlers immediately, including while journal I/O awaits.
  const drained=Promise.all([output,errors,child.exited]);drained.catch(()=>{})
  await append('worker_spawned',{childPid})
  const stdin=child.stdin as import('bun').FileSink;stdin.write(encoded);await stdin.end()
  const [stdout,stderr,exit]=await drained
  if(timer){clearTimeout(timer);timer=undefined}
  check(!timedOut&&stderr==='')
  worker=workerOutcome(JSON.parse(stdout),childPid,request.mode,inspection.executionArtifactSha256)
  check(exit===(worker.status==='completed'?0:78))
  completed=worker.status==='completed'
  await append(completed?'worker_completed':'worker_refused_or_uncertain',{childPid,adapterConstructions:worker.adapterConstructions,transactions:worker.transactions,resultStatus:worker.resultStatus,resultSha256:worker.resultSha256})
 }catch{
  if(child&&child.exitCode===null){try{child.kill()}catch{}await child.exited.catch(()=>{})}
  completed=false;worker=null
  try{await append('refused_or_uncertain_do_not_retry',{childPid,timedOut})}catch{}
 }finally{
  if(timer)clearTimeout(timer)
  if(privateHome){
   const parent=resolve(dirname(request.attemptJournalPath)),leaf=basename(privateHome)
   try{
    check(dirname(resolve(privateHome))===parent&&leaf.startsWith('hosted-worker-home-'))
    await rm(privateHome,{recursive:true,force:true})
    await append('private_home_removed')
   }catch{completed=false;try{await append('private_home_cleanup_failed',{privateHomePath:privateHome})}catch{}}
  }
  try{await journal.close()}catch{completed=false}
 }
 return Object.freeze({profile:FIXED_SUPERVISOR_PROFILE,status:completed?'worker_completed':'refused_or_uncertain',mode:request.mode,childPid,worker,timedOut,launchAuthorized:false,noAutomaticRetry:true})
}
