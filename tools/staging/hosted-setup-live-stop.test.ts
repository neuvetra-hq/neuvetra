import {expect,mock,test} from 'bun:test'
import {mkdtemp,readFile,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {DEPLOYMENT_TARGET as T,DEPLOYMENT_REVIEW_PROFILE,createHostedSetupDeploymentReceipt,
 deploymentBindingSha256,deploymentCaptureSha256,verifyHostedSetupDeploymentBinding,
 type DeploymentCapture,type DeploymentBindingPolicy} from './hosted-setup-deployment-binding'
import {HOSTED_SETUP_LIVE_STOP_PROFILE,stopHostedSetupExactImage,type LiveStopRuntime} from './hosted-setup-live-stop'
import {RAILWAY_CAPTURE_PROFILE} from './hosted-setup-railway-capture'

const IMAGE={deploymentId:'33333333-3333-4333-8333-333333333333',deployedCommit:'b'.repeat(40),imageDigest:'sha256:'+'c'.repeat(64)}
const INSTANCE='22222222-2222-4222-8222-222222222222'
let closeFaultJournalPath=''
let serial=0
function fixture(){
 const epoch=Date.now()+(++serial)*100_000,at=(ms:number)=>new Date(epoch+ms).toISOString()
 const meta={commitHash:IMAGE.deployedCommit,imageDigest:IMAGE.imageDigest}
 const raw=(replicas:0|1,config:string)=>{
  const deployment={id:IMAGE.deploymentId,status:'SUCCESS',meta,instances:replicas?[{id:INSTANCE,status:'RUNNING'}]:[],deploymentStopped:false}
  const status={id:T.projectId,services:{edges:[{node:{id:T.serviceId,name:'Site-Web'}}]},
   environments:{edges:[{node:{id:T.environmentId,name:'production',canAccess:true,unmergedChangesCount:null,
    serviceInstances:{edges:[{node:{serviceId:T.serviceId,environmentId:T.environmentId,serviceName:'Site-Web',numReplicas:null,
     latestDeployment:structuredClone(deployment),activeDeployments:[structuredClone(deployment)]}}]}}}]}}
  const inventory={data:{service:{id:T.serviceId,projectId:T.projectId,name:'Site-Web'},
   environment:{id:T.environmentId,projectId:T.projectId,name:'production',configEtag:config,unmergedChangesCount:null,
    config:{groups:{},privateNetworkDisabled:false,services:{[T.serviceId]:{build:{},source:{},variables:{},networking:{},
     deploy:{healthcheckPath:'/ready',ipv6EgressEnabled:false,multiRegionConfig:{[T.region]:{numReplicas:replicas}},runtime:'V2',useLegacyStacker:false}}},sharedVariables:{},volumes:{}}},
   environmentStagedChanges:{id:'<empty>',status:'STAGED',patch:{}},serviceInstanceAutoDeployStatus:{enabled:false,canEnable:true,reason:'MANUAL'},
   deployments:{edges:[{cursor:'current',node:{id:IMAGE.deploymentId,status:'SUCCESS',serviceId:T.serviceId,environmentId:T.environmentId,meta:structuredClone(meta)}}],pageInfo:{hasNextPage:false,endCursor:'current'}}}}
  return{statusJson:JSON.stringify(status),inventoryJson:JSON.stringify(inventory)}
 }
 const cap=(ms:number,replicas:0|1,config:string):DeploymentCapture=>({startedUtc:at(ms),completedUtc:at(ms+1000),...raw(replicas,config)})
 const initial:[DeploymentCapture,DeploymentCapture]=[cap(0,1,'d'.repeat(64)),cap(2000,1,'d'.repeat(64))]
 const receiptText=createHostedSetupDeploymentReceipt(initial,IMAGE,'observer')
 const reviewText=JSON.stringify({profile:DEPLOYMENT_REVIEW_PROFILE,verdict:'accepted',receiptSha256:deploymentBindingSha256(receiptText),reviewerId:'reviewer',reviewedUtc:at(4000)})
 const policy:DeploymentBindingPolicy={receiptSha256:deploymentBindingSha256(receiptText),reviewSha256:deploymentBindingSha256(reviewText),authenticatedCaptureSha256:initial.map(deploymentCaptureSha256) as[string,string],expectedImage:{...IMAGE},operatorId:'operator',observerId:'observer',independentReviewerId:'reviewer'}
 const binding=verifyHostedSetupDeploymentBinding(receiptText,reviewText,policy,at(5000))
 return{at,cap,binding}
}

test('exact-image stop consumes fresh reviewed capability once and persists stopped receipt',async()=>{
 const f=fixture(),root=await mkdtemp(join(tmpdir(),'hs-live-stop-')),journalPath=join(root,'attempt.jsonl'),receiptPath=join(root,'receipt.json')
 const captures=[f.cap(6000,1,'d'.repeat(64)),f.cap(8000,1,'d'.repeat(64)),f.cap(10000,0,'e'.repeat(64)),f.cap(12000,0,'e'.repeat(64))]
 let scaleCalls=0,clockCalls=0
 const runtime:LiveStopRuntime={capture:async()=>captures.shift()!,scale:async()=>{scaleCalls++;return JSON.stringify({regions:{[T.region]:null}})},now:()=>f.at(++clockCalls<=3?9500:14000)}
 const input={profile:HOSTED_SETUP_LIVE_STOP_PROFILE,binding:f.binding,railway:{profile:RAILWAY_CAPTURE_PROFILE,executablePath:process.execPath,workingDirectory:root,timeoutMs:1000},journalPath,receiptPath}
 const result=await stopHostedSetupExactImage(input,runtime)
 expect(result.profile).toBe('neuvetra.hosted-setup.stopped-verification.v1')
 expect(result.deploymentId).toBe(IMAGE.deploymentId)
 expect(result.imageDigest).toBe(IMAGE.imageDigest)
 expect(result.stoppedConfigurationVersion).toBe('e'.repeat(64))
 expect(scaleCalls).toBe(1)
 expect(JSON.parse(await readFile(receiptPath,'utf8')).stoppedConfigurationVersion).toBe('e'.repeat(64))
 expect(await readFile(journalPath,'utf8')).toContain('receipt_synced_pending_finalization')
 await expect(stopHostedSetupExactImage(input,runtime)).rejects.toThrow()
 expect(scaleCalls).toBe(1)
})

test('changed preflight or changed stopped image refuses without retry',async()=>{
 for(const phase of ['before','after'] as const){
  const f=fixture(),root=await mkdtemp(join(tmpdir(),'hs-live-stop-')),journalPath=join(root,'attempt.jsonl'),receiptPath=join(root,'receipt.json')
  const captures=[f.cap(6000,1,'d'.repeat(64)),f.cap(8000,1,phase==='before'?'e'.repeat(64):'d'.repeat(64)),f.cap(10000,0,phase==='after'?'d'.repeat(64):'e'.repeat(64)),f.cap(12000,0,phase==='after'?'d'.repeat(64):'e'.repeat(64))]
  let scaleCalls=0,clockCalls=0
  const runtime:LiveStopRuntime={capture:async()=>captures.shift()!,scale:async()=>{scaleCalls++;return JSON.stringify({regions:{[T.region]:null}})},now:()=>f.at(++clockCalls<=3?9500:14000)}
  const input={profile:HOSTED_SETUP_LIVE_STOP_PROFILE,binding:f.binding,railway:{profile:RAILWAY_CAPTURE_PROFILE,executablePath:process.execPath,workingDirectory:root,timeoutMs:1000},journalPath,receiptPath}
  await expect(stopHostedSetupExactImage(input,runtime)).rejects.toThrow(phase==='before'?'REFUSED_BEFORE_SCALE':'OUTCOME_UNCERTAIN')
  expect(scaleCalls).toBe(phase==='before'?0:1)
  expect(await readFile(journalPath,'utf8')).toContain(phase==='before'?'refused_before_scale':'outcome_uncertain_do_not_retry')
 }
})

test('caller replacement of the consumed binding cannot certify a different image',async()=>{
 const f=fixture(),root=await mkdtemp(join(tmpdir(),'hs-live-stop-'))
 const changed={deploymentId:'44444444-4444-4444-8444-444444444444',deployedCommit:'e'.repeat(40),imageDigest:'sha256:'+'f'.repeat(64)}
 const replaced=(c:DeploymentCapture):DeploymentCapture=>({
  ...c,statusJson:c.statusJson.replaceAll(IMAGE.deploymentId,changed.deploymentId).replaceAll(IMAGE.deployedCommit,changed.deployedCommit).replaceAll(IMAGE.imageDigest,changed.imageDigest),
  inventoryJson:c.inventoryJson.replaceAll(IMAGE.deploymentId,changed.deploymentId).replaceAll(IMAGE.deployedCommit,changed.deployedCommit).replaceAll(IMAGE.imageDigest,changed.imageDigest),
 })
 const captures=[f.cap(6000,1,'d'.repeat(64)),f.cap(8000,1,'d'.repeat(64)),replaced(f.cap(10000,0,'e'.repeat(64))),replaced(f.cap(12000,0,'e'.repeat(64)))]
 let scaleCalls=0,clockCalls=0
 const input={profile:HOSTED_SETUP_LIVE_STOP_PROFILE,binding:f.binding,railway:{profile:RAILWAY_CAPTURE_PROFILE,executablePath:process.execPath,workingDirectory:root,timeoutMs:1000},journalPath:join(root,'attempt.jsonl'),receiptPath:join(root,'receipt.json')}
 const runtime:LiveStopRuntime={capture:async()=>captures.shift()!,scale:async()=>{scaleCalls++;input.binding={...f.binding,...changed};return JSON.stringify({regions:{[T.region]:null}})},now:()=>f.at(++clockCalls<=3?9500:14000)}
 await expect(stopHostedSetupExactImage(input,runtime)).rejects.toThrow('OUTCOME_UNCERTAIN_DO_NOT_RETRY')
 expect(scaleCalls).toBe(1)
 expect(await readFile(input.receiptPath,'utf8')).toBe('')
})

test('accessor transport cannot change executable between hash and invocation',async()=>{
 const f=fixture(),root=await mkdtemp(join(tmpdir(),'hs-live-stop-'))
 let getterCalls=0,captures=0,scaleCalls=0
 const railway={profile:RAILWAY_CAPTURE_PROFILE,get executablePath(){getterCalls++;return process.execPath},workingDirectory:root,timeoutMs:1000}
 const input={profile:HOSTED_SETUP_LIVE_STOP_PROFILE,binding:f.binding,railway,journalPath:join(root,'attempt.jsonl'),receiptPath:join(root,'receipt.json')}
 const runtime:LiveStopRuntime={capture:async()=>{captures++;return f.cap(6000,1,'d'.repeat(64))},scale:async()=>{scaleCalls++;return ''},now:()=>f.at(9500)}
 await expect(stopHostedSetupExactImage(input,runtime)).rejects.toThrow('RAILWAY_INPUT_REFUSED')
 expect(getterCalls).toBe(0)
 expect(captures).toBe(0)
 expect(scaleCalls).toBe(0)
})

test('pre-existing receipt refuses before provider capture or scale',async()=>{
 const f=fixture(),root=await mkdtemp(join(tmpdir(),'hs-live-stop-')),receiptPath=join(root,'receipt.json')
 await writeFile(receiptPath,'existing receipt')
 let captureCalls=0,scaleCalls=0
 const runtime:LiveStopRuntime={capture:async()=>{captureCalls++;return f.cap(6000,1,'d'.repeat(64))},scale:async()=>{scaleCalls++;return ''},now:()=>f.at(9500)}
 const input={profile:HOSTED_SETUP_LIVE_STOP_PROFILE,binding:f.binding,railway:{profile:RAILWAY_CAPTURE_PROFILE,executablePath:process.execPath,workingDirectory:root,timeoutMs:1000},journalPath:join(root,'attempt.jsonl'),receiptPath}
 await expect(stopHostedSetupExactImage(input,runtime)).rejects.toThrow('REFUSED_BEFORE_SCALE')
 expect(captureCalls).toBe(0)
 expect(scaleCalls).toBe(0)
 expect(await readFile(receiptPath,'utf8')).toBe('existing receipt')
})

test('stopped captures from before the scale response cannot certify a stop',async()=>{
 const f=fixture(),root=await mkdtemp(join(tmpdir(),'hs-live-stop-'))
 const captures=[f.cap(6000,1,'d'.repeat(64)),f.cap(8000,1,'d'.repeat(64)),f.cap(1000,0,'e'.repeat(64)),f.cap(3000,0,'e'.repeat(64))]
 let scaleCalls=0,clockCalls=0
 const runtime:LiveStopRuntime={capture:async()=>captures.shift()!,scale:async()=>{scaleCalls++;return JSON.stringify({regions:{[T.region]:null}})},now:()=>f.at(++clockCalls<=3?9500:14000)}
 const input={profile:HOSTED_SETUP_LIVE_STOP_PROFILE,binding:f.binding,railway:{profile:RAILWAY_CAPTURE_PROFILE,executablePath:process.execPath,workingDirectory:root,timeoutMs:1000},journalPath:join(root,'attempt.jsonl'),receiptPath:join(root,'receipt.json')}
 await expect(stopHostedSetupExactImage(input,runtime)).rejects.toThrow('OUTCOME_UNCERTAIN_DO_NOT_RETRY')
 expect(scaleCalls).toBe(1)
 expect(await readFile(input.receiptPath,'utf8')).toBe('')
})

test('receipt and journal close faults after scale remain uncertain and both closes are attempted',async()=>{
 const native={...await import('node:fs/promises')}
 let faultPath='',closed:string[]=[]
 mock.module('node:fs/promises',()=>({...native,open:async(...args:Parameters<typeof native.open>)=>{
  const path=String(args[0]),handle=await native.open(...args)
  return new Proxy(handle,{get(target,key){
   if(key==='close')return async()=>{closed.push(path);await target.close();if(path===faultPath)throw Error('SYNTHETIC_PRIVATE_CLOSE_DETAIL')}
   const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value
  }})
 }}))
 try{for(const target of ['receipt','journal'] as const){
  const f=fixture(),root=await mkdtemp(join(tmpdir(),'hs-live-stop-'))
  const input={profile:HOSTED_SETUP_LIVE_STOP_PROFILE,binding:f.binding,railway:{profile:RAILWAY_CAPTURE_PROFILE,executablePath:process.execPath,workingDirectory:root,timeoutMs:1000},journalPath:join(root,'attempt.jsonl'),receiptPath:join(root,'receipt.json')}
  faultPath=target==='receipt'?input.receiptPath:input.journalPath;closed=[]
  if(target==='journal')closeFaultJournalPath=input.journalPath
  const captures=[f.cap(6000,1,'d'.repeat(64)),f.cap(8000,1,'d'.repeat(64)),f.cap(10000,0,'e'.repeat(64)),f.cap(12000,0,'e'.repeat(64))]
  let clockCalls=0,scaleCalls=0
  const runtime:LiveStopRuntime={capture:async()=>captures.shift()!,scale:async()=>{scaleCalls++;return JSON.stringify({regions:{[T.region]:null}})},now:()=>f.at(++clockCalls<=3?9500:14000)}
  let error='';try{await stopHostedSetupExactImage(input,runtime)}catch(e){error=String(e)}
  expect(scaleCalls).toBe(1)
  expect(error).toContain('HS_LIVE_STOP_OUTCOME_UNCERTAIN_DO_NOT_RETRY')
  expect(error).not.toContain('SYNTHETIC_PRIVATE_CLOSE_DETAIL')
  expect(closed).toContain(input.receiptPath)
  expect(closed).toContain(input.journalPath)
  expect(await native.readFile(input.journalPath,'utf8')).toContain('outcome_uncertain_do_not_retry')
 }}finally{mock.module('node:fs/promises',()=>native)}
})

test('fault-test filesystem mock is restored for later tests',async()=>{
 const root=await mkdtemp(join(tmpdir(),'hs-live-stop-isolation-'))
 const path=join(root,'ordinary.txt')
 const fs=await import('node:fs/promises')
 const file=await fs.open(path,'wx')
 await file.writeFile('ordinary')
 await file.close()
 expect(await fs.readFile(path,'utf8')).toBe('ordinary')
 const prior=await fs.open(closeFaultJournalPath,'r')
 await prior.close()
})
