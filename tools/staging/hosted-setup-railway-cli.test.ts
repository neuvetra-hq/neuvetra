import {expect,test} from 'bun:test'
import {
 HOSTED_SETUP_MAINTENANCE_STOP_PROFILE,stopHostedSetupForMaintenance,
 type MaintenanceJournal,type MaintenanceStopReceipt,
} from './hosted-setup-maintenance-stop'
import {
 HOSTED_SETUP_GATE_PRIOR_COMMIT,HOSTED_SETUP_GATE_PRIOR_DEPLOYMENT,
 HOSTED_SETUP_GATE_RAILWAY_ENVIRONMENT,HOSTED_SETUP_GATE_RAILWAY_PROJECT,
 HOSTED_SETUP_GATE_RAILWAY_SERVICE,HOSTED_SETUP_GATE_REGION,
} from './hosted-setup-write-gate'
import {
 createHostedSetupRailwayCliDependencies,HOSTED_SETUP_RAILWAY_CLI_PROFILE,
 HOSTED_SETUP_RAILWAY_CLI_SHA256,HOSTED_SETUP_RAILWAY_INVENTORY_QUERY,
 type HostedSetupRailwayCliInput,
 type HostedSetupRailwayCliInvocation,type HostedSetupRailwayCliResult,
 type HostedSetupRailwayCliRuntime,
} from './hosted-setup-railway-cli'

const OLD_DEPLOYMENT='11111111-1111-4111-8111-111111111111'
const INSTANCE='22222222-2222-4222-8222-222222222222'
const IMAGE='sha256:'+'a'.repeat(64)
const BEFORE='7'.repeat(64),AFTER='8'.repeat(64)
const executable='C:\\private\\railway.exe',workingDirectory='C:\\private\\operator'
const target={projectId:HOSTED_SETUP_GATE_RAILWAY_PROJECT,
 environmentId:HOSTED_SETUP_GATE_RAILWAY_ENVIRONMENT,
 serviceId:HOSTED_SETUP_GATE_RAILWAY_SERVICE,region:HOSTED_SETUP_GATE_REGION} as const

interface State {
 replicas:0|1;etag:string;pending:number|null;patch:Record<string,unknown>
 autoDeploy:boolean;hasNextPage:boolean;deploymentStatus:string
 extraSuccess:boolean;wrongCommit:boolean;extraRegion:boolean;incompleteConfig:boolean
 runtimeMismatch:boolean;postScaleDrift:boolean;postScaleImageDrift:boolean
 instanceId:string;imageDigest:string;oldCommit:string
}
interface Harness {
 state:State;invocations:Readonly<HostedSetupRailwayCliInvocation>[];scaleCalls:number
 runtime:HostedSetupRailwayCliRuntime
}

function status(state:State){
 const runtimeReplicas=state.runtimeMismatch?(state.replicas===1?0:1):state.replicas
 const instances=runtimeReplicas===1?[{id:state.instanceId,status:'RUNNING'}]:[]
 const meta={commitHash:state.wrongCommit?'0'.repeat(40):HOSTED_SETUP_GATE_PRIOR_COMMIT,imageDigest:state.imageDigest}
 const latestDeployment={id:HOSTED_SETUP_GATE_PRIOR_DEPLOYMENT,status:'SUCCESS',instances,meta}
 return JSON.stringify({id:HOSTED_SETUP_GATE_RAILWAY_PROJECT,
  services:{edges:[{node:{id:HOSTED_SETUP_GATE_RAILWAY_SERVICE,name:'Site-Web'}}]},
  environments:{edges:[{node:{id:HOSTED_SETUP_GATE_RAILWAY_ENVIRONMENT,name:'production',canAccess:true,
   unmergedChangesCount:state.pending,serviceInstances:{edges:[{node:{
    serviceId:HOSTED_SETUP_GATE_RAILWAY_SERVICE,environmentId:HOSTED_SETUP_GATE_RAILWAY_ENVIRONMENT,
    serviceName:'Site-Web',numReplicas:null,region:null,
    activeDeployments:[{id:HOSTED_SETUP_GATE_PRIOR_DEPLOYMENT,status:'SUCCESS',deploymentStopped:false,instances,meta}],
    latestDeployment,
   }}]}}}]},
 })
}

function api(state:State){
 const multiRegionConfig:Record<string,unknown>=state.replicas===1
  ?{[HOSTED_SETUP_GATE_REGION]:{numReplicas:1}}
  :{[HOSTED_SETUP_GATE_REGION]:null}
 if(state.extraRegion)multiRegionConfig['us-west1']={numReplicas:1}
 const serviceConfig:Record<string,unknown>={build:{},deploy:{healthcheckPath:'/ready',
  ipv6EgressEnabled:false,multiRegionConfig,runtime:'V2',useLegacyStacker:false},
  networking:{},source:{},variables:{}}
 if(state.incompleteConfig)delete serviceConfig.networking
 const pinned={id:HOSTED_SETUP_GATE_PRIOR_DEPLOYMENT,status:state.deploymentStatus,
  serviceId:HOSTED_SETUP_GATE_RAILWAY_SERVICE,environmentId:HOSTED_SETUP_GATE_RAILWAY_ENVIRONMENT,
  meta:{commitHash:state.wrongCommit?'0'.repeat(40):HOSTED_SETUP_GATE_PRIOR_COMMIT}}
 const old={id:OLD_DEPLOYMENT,status:state.extraSuccess?'SUCCESS':'REMOVED',
  serviceId:HOSTED_SETUP_GATE_RAILWAY_SERVICE,environmentId:HOSTED_SETUP_GATE_RAILWAY_ENVIRONMENT,
  meta:{commitHash:state.oldCommit}}
 return JSON.stringify({data:{
  project:{id:HOSTED_SETUP_GATE_RAILWAY_PROJECT},
  service:{id:HOSTED_SETUP_GATE_RAILWAY_SERVICE,name:'Site-Web',projectId:HOSTED_SETUP_GATE_RAILWAY_PROJECT},
  environment:{id:HOSTED_SETUP_GATE_RAILWAY_ENVIRONMENT,name:'production',
   projectId:HOSTED_SETUP_GATE_RAILWAY_PROJECT,configEtag:state.etag,
   unmergedChangesCount:state.pending,config:{groups:{},privateNetworkDisabled:false,
    services:{[HOSTED_SETUP_GATE_RAILWAY_SERVICE]:serviceConfig},sharedVariables:{},volumes:{}}},
  environmentStagedChanges:{id:'<empty>',status:'STAGED',patch:state.patch},
  serviceInstanceAutoDeployStatus:{enabled:state.autoDeploy,canEnable:true,reason:'MANUAL'},
  deployments:{edges:[{cursor:'pinned',node:pinned},{cursor:'old',node:old}],
   pageInfo:{hasNextPage:state.hasNextPage,endCursor:'old'}},
 }})
}

function harness(alter:Partial<State>={}):Harness{
 const state:State={replicas:1,etag:BEFORE,pending:null,patch:{},autoDeploy:false,
  hasNextPage:false,deploymentStatus:'SUCCESS',extraSuccess:false,wrongCommit:false,
  extraRegion:false,incompleteConfig:false,runtimeMismatch:false,postScaleDrift:false,
  postScaleImageDrift:false,instanceId:INSTANCE,imageDigest:IMAGE,oldCommit:'1'.repeat(40),...alter}
 const invocations:Readonly<HostedSetupRailwayCliInvocation>[]=[]
 let scaleCalls=0
 const runtime:HostedSetupRailwayCliRuntime={
  sha256File:async path=>{expect(path).toBe(executable);return HOSTED_SETUP_RAILWAY_CLI_SHA256},
  execFile:async invocation=>{
   expect(Object.isFrozen(invocation)).toBe(true)
   expect(Object.isFrozen(invocation.args)).toBe(true)
   invocations.push(invocation)
   if(invocation.args[0]==='--version')return ok('railway 5.62.1')
   if(invocation.args[0]==='status')return ok(status(state))
   if(invocation.args[0]==='api')return ok(api(state))
   if(invocation.args[0]==='scale'){
    scaleCalls++
    state.replicas=0;state.etag=AFTER
    if(state.postScaleDrift)state.autoDeploy=true
    if(state.postScaleImageDrift)state.imageDigest='sha256:'+'b'.repeat(64)
    return ok(JSON.stringify({regions:{[HOSTED_SETUP_GATE_REGION]:null}}))
   }
   throw Error('unexpected mock command')
  },
 }
 return{state,invocations,get scaleCalls(){return scaleCalls},runtime}
}
function ok(stdout:string):HostedSetupRailwayCliResult{return{exitCode:0,signal:null,stdout,stderr:''}}
function adapter(f:Harness){return createHostedSetupRailwayCliDependencies({
 profile:HOSTED_SETUP_RAILWAY_CLI_PROFILE,executablePath:executable,
 workingDirectory,timeoutMs:5_000,
},f.runtime)}
function journal(events:unknown[]):MaintenanceJournal{return{append:async event=>{events.push(event)},close:async()=>{}}}

test('composes with the maintenance helper and emits only the exact scale mutation',async()=>{
 const f=harness(),events:unknown[]=[];let receipt:MaintenanceStopReceipt|undefined
 const dependencies={...adapter(f),openJournal:async()=>journal(events),
  writeReceipt:async(_path:string,value:MaintenanceStopReceipt)=>{receipt=value},
  now:()=> '2026-09-26T14:00:00.000Z'}
 const result=await stopHostedSetupForMaintenance({profile:HOSTED_SETUP_MAINTENANCE_STOP_PROFILE,
  operatorId:'reviewed-operator',journalPath:'C:\\private\\maintenance.jsonl',
  receiptPath:'C:\\private\\maintenance.json'},dependencies)
 expect(receipt).toBeDefined()
 expect(result).toEqual(receipt!)
 expect(result).toMatchObject({replicas:0,configurationVersion:AFTER,
  availabilityStopObserved:true,databaseWritersExcluded:false})
 expect(events).toHaveLength(3)
 expect(f.scaleCalls).toBe(1)
 const scale=f.invocations.find(call=>call.args[0]==='scale')
 expect(scale?.args).toEqual(['scale','--project',HOSTED_SETUP_GATE_RAILWAY_PROJECT,
  '--environment',HOSTED_SETUP_GATE_RAILWAY_ENVIRONMENT,'--service',
  HOSTED_SETUP_GATE_RAILWAY_SERVICE,'--json',HOSTED_SETUP_GATE_REGION+'=0'])
 const apis=f.invocations.filter(call=>call.args[0]==='api')
 expect(apis).toHaveLength(4)
 expect(apis[0]?.args[1]).toBe(HOSTED_SETUP_RAILWAY_INVENTORY_QUERY)
 expect(apis[0]?.args[1]).toContain('config(decryptVariables:false)')
 expect(apis[0]?.args.join(' ')).not.toContain('decryptVariables:true')
 expect(f.invocations.filter(call=>call.args[0]==='--version')).toHaveLength(1)
})

test('preserves null and zero pending-change observations distinctly',async()=>{
 for(const value of [null,0] as const){
  const f=harness({pending:value}),deps=adapter(f)
  const observed=JSON.parse(await deps.observe())
  expect(observed.pendingChanges).toBe(value)
  expect(observed.replicas).toBe(1)
 }
})

test('rejects incomplete, changing, paginated, or in-flight preflight state without scaling',async()=>{
 const cases:Partial<State>[]=[
  {patch:{unexpected:true}},{pending:1},{autoDeploy:true},{hasNextPage:true},
  {deploymentStatus:'DEPLOYING'},{extraSuccess:true},{wrongCommit:true},
  {extraRegion:true},{incompleteConfig:true},{runtimeMismatch:true},
 ]
 for(const change of cases){
  const f=harness(change),deps=adapter(f)
  await expect(deps.observe()).rejects.toThrow()
  expect(f.scaleCalls).toBe(0)
 }
})

test('rejects exact-scope and staged-patch omissions before scaling',async()=>{
 const mutations=[
  (command:string,value:any)=>{if(command==='status')value.id='wrong'},
  (command:string,value:any)=>{if(command==='status')value.environments.edges[0].node.serviceInstances.edges[0].node.activeDeployments.push(
   value.environments.edges[0].node.serviceInstances.edges[0].node.activeDeployments[0])},
  (command:string,value:any)=>{if(command==='api')value.data.environment.id='wrong'},
  (command:string,value:any)=>{if(command==='api')value.data.service.id='wrong'},
  (command:string,value:any)=>{if(command==='api')delete value.data.environmentStagedChanges.patch},
  (command:string,value:any)=>{if(command==='api')value.data.environmentStagedChanges.status='CHANGED'},
 ]
 for(const mutate of mutations){
  const f=harness(),base=f.runtime.execFile
  f.runtime.execFile=async invocation=>{
   const result=await base(invocation),command=invocation.args[0]!
   if((command==='status'||command==='api')&&result.exitCode===0){
    const value=JSON.parse(result.stdout);mutate(command,value);return ok(JSON.stringify(value))
   }
   return result
  }
  await expect(adapter(f).observe()).rejects.toThrow()
  expect(f.scaleCalls).toBe(0)
 }
})

test('requires two byte-identical preflights and an exact target before scale',async()=>{
 {
  const f=harness(),deps=adapter(f)
  await expect(deps.scaleToZero(target)).rejects.toThrow('HS_RAILWAY_CLI_SCALE_WITHOUT_EXACT_PREFLIGHT')
  expect(f.scaleCalls).toBe(0)
 }
 {
  const f=harness(),deps=adapter(f)
  await deps.observe()
  await expect(deps.scaleToZero(target)).rejects.toThrow('HS_RAILWAY_CLI_SCALE_WITHOUT_EXACT_PREFLIGHT')
  expect(f.scaleCalls).toBe(0)
 }
 {
  const f=harness(),deps=adapter(f)
  await deps.observe();await deps.observe()
  await expect(deps.scaleToZero({...target,region:'wrong'} as never)).rejects.toThrow('HS_RAILWAY_CLI_SCALE_TARGET_REFUSED')
  expect(f.scaleCalls).toBe(0)
 }
 {
  const f=harness(),deps=adapter(f)
  await deps.observe();f.state.etag='9'.repeat(64)
  await expect(deps.observe()).rejects.toThrow('HS_RAILWAY_CLI_PREFLIGHT_CHANGED')
  expect(f.scaleCalls).toBe(0)
 }
})

test('instance, image and complete deployment inventory drift refuse before scale',async()=>{
 const changes=[
  (state:State)=>{state.instanceId='33333333-3333-4333-8333-333333333333'},
  (state:State)=>{state.imageDigest='sha256:'+'b'.repeat(64)},
  (state:State)=>{state.oldCommit='2'.repeat(40)},
 ]
 for(const change of changes){
  const f=harness(),deps=adapter(f)
  await deps.observe();change(f.state)
  await expect(deps.observe()).rejects.toThrow('HS_RAILWAY_CLI_PREFLIGHT_CHANGED')
  await expect(deps.scaleToZero(target)).rejects.toThrow('HS_RAILWAY_CLI_OPERATION_REFUSED_AFTER_FAILURE')
  expect(f.scaleCalls).toBe(0)
 }
})

test('a failed or malformed scale is uncertain and cannot be replayed',async()=>{
 for(const mode of ['exit','shape'] as const){
  const f=harness(),base=f.runtime.execFile;let attempts=0
  f.runtime.execFile=async invocation=>{
   if(invocation.args[0]!=='scale')return base(invocation)
   attempts++
   return mode==='exit'?{exitCode:1,stdout:'',stderr:'SECRET_MARKER'}
    :ok(JSON.stringify({regions:{unexpected:null}}))
  }
  const deps=adapter(f)
  await deps.observe();await deps.observe()
  let first='';try{await deps.scaleToZero(target)}catch(error){first=String(error)}
  expect(first).not.toContain('SECRET_MARKER')
  let second='';try{await deps.scaleToZero(target)}catch(error){second=String(error)}
  expect(second).not.toContain('SECRET_MARKER')
  expect(attempts).toBe(1)
 }
})

test('rejects concurrent operations and poisons the one-shot adapter',async()=>{
 const f=harness(),base=f.runtime.execFile;let release!:()=>void
 const pending=new Promise<void>(resolve=>{release=resolve})
 f.runtime.execFile=async invocation=>{
  if(invocation.args[0]==='--version')await pending
  return base(invocation)
 }
 const deps=adapter(f),first=deps.observe()
 await expect(deps.observe()).rejects.toThrow('HS_RAILWAY_CLI_OPERATION_OVERLAP_OR_UNCERTAIN')
 release()
 await first
 await expect(deps.observe()).rejects.toThrow('HS_RAILWAY_CLI_OPERATION_REFUSED_AFTER_FAILURE')
 expect(f.scaleCalls).toBe(0)
})

test('post-scale drift yields helper uncertainty, one mutation, and no receipt',async()=>{
 const f=harness({postScaleDrift:true}),events:unknown[]=[];let writes=0
 await expect(stopHostedSetupForMaintenance({profile:HOSTED_SETUP_MAINTENANCE_STOP_PROFILE,
  operatorId:'reviewed-operator',journalPath:'C:\\private\\uncertain.jsonl',
  receiptPath:'C:\\private\\uncertain.json'},{...adapter(f),openJournal:async()=>journal(events),
   writeReceipt:async()=>{writes++},now:()=> '2026-09-26T14:00:00.000Z'}))
  .rejects.toThrow('HS_MAINTENANCE_OUTCOME_UNCERTAIN_DO_NOT_RETRY')
 expect(f.scaleCalls).toBe(1)
 expect(writes).toBe(0)
 expect(JSON.stringify(events)).toContain('maintenance_stop_outcome_uncertain_do_not_retry')
})

test('post-scale immutable image identity drift is uncertain and never receipts',async()=>{
 const f=harness({postScaleImageDrift:true}),events:unknown[]=[];let writes=0
 await expect(stopHostedSetupForMaintenance({profile:HOSTED_SETUP_MAINTENANCE_STOP_PROFILE,
  operatorId:'reviewed-operator',journalPath:'C:\\private\\image-uncertain.jsonl',
  receiptPath:'C:\\private\\image-uncertain.json'},{...adapter(f),openJournal:async()=>journal(events),
   writeReceipt:async()=>{writes++},now:()=> '2026-09-26T14:00:00.000Z'}))
  .rejects.toThrow('HS_MAINTENANCE_OUTCOME_UNCERTAIN_DO_NOT_RETRY')
 expect(f.scaleCalls).toBe(1)
 expect(writes).toBe(0)
 expect(JSON.stringify(events)).toContain('maintenance_stop_outcome_uncertain_do_not_retry')
})

test('captures input, runtime methods, invocation arrays, and result fields once',async()=>{
 const base=harness(),input:HostedSetupRailwayCliInput={profile:HOSTED_SETUP_RAILWAY_CLI_PROFILE,
  executablePath:executable,workingDirectory,timeoutMs:5_000}
 let execReads=0,hashReads=0,stdoutReads=0
 const runtime={
  get execFile(){execReads++;return async(invocation:Readonly<HostedSetupRailwayCliInvocation>)=>{
   const result=await base.runtime.execFile(invocation)
   return{get exitCode(){return result.exitCode},get signal(){return result.signal},
    get stdout(){stdoutReads++;return result.stdout},get stderr(){return result.stderr}}
  }},
  get sha256File(){hashReads++;return base.runtime.sha256File},
 }
 const deps=createHostedSetupRailwayCliDependencies(input,runtime)
 input.executablePath='C:\\forged\\railway.exe';input.timeoutMs=30_000
 await deps.observe()
 expect(execReads).toBe(1);expect(hashReads).toBe(1)
 expect(stdoutReads).toBe(3)
 expect(base.invocations.every(call=>call.executablePath===executable&&call.timeoutMs===5_000)).toBe(true)
})

test('binary or version mismatch fails before provider inventory or mutation',async()=>{
 {
  const f=harness();f.runtime.sha256File=async()=> '0'.repeat(64)
  await expect(adapter(f).observe()).rejects.toThrow('HS_RAILWAY_CLI_VERSION_EXECUTABLE_HASH_REFUSED')
  expect(f.invocations).toHaveLength(0);expect(f.scaleCalls).toBe(0)
 }
 {
  const f=harness(),base=f.runtime.execFile
  f.runtime.execFile=async invocation=>invocation.args[0]==='--version'?ok('railway 0.0.0'):base(invocation)
  await expect(adapter(f).observe()).rejects.toThrow('HS_RAILWAY_CLI_VERSION_REFUSED')
  expect(f.invocations.filter(call=>call.args[0]==='status')).toHaveLength(0)
  expect(f.scaleCalls).toBe(0)
 }
})
