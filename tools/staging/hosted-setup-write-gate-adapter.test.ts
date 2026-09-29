import {expect,test} from 'bun:test'
import {
 acquireHostedSetupWriteGate,HOSTED_SETUP_GATE_PROFILE,
 HOSTED_SETUP_GATE_PRIOR_COMMIT,HOSTED_SETUP_GATE_PRIOR_DEPLOYMENT,
 HOSTED_SETUP_GATE_PROJECT,HOSTED_SETUP_GATE_RAILWAY_ENVIRONMENT,
 HOSTED_SETUP_GATE_RAILWAY_PROJECT,HOSTED_SETUP_GATE_RAILWAY_SERVICE,
 HOSTED_SETUP_GATE_REGION,HOSTED_SETUP_GATE_RUNTIME_ROLE,HOSTED_SETUP_GATE_TARGET,
 type HostedSetupWriteGateDependencies,
} from './hosted-setup-write-gate'
import {
 createHostedSetupWriteGateAdapter,HOSTED_SETUP_GATE_ADAPTER_TARGET,
 HOSTED_SETUP_PRIVILEGED_WRITER_HOLD,
 type HostedSetupPostgresGateClient,type HostedSetupRailwayGateClient,
 type HostedSetupOpaqueSecretHandle,type PostgresRuntimeLoginResult,
 type PostgresWriterInventory,type RailwayServiceInventory,
} from './hosted-setup-write-gate-adapter'

const routines=Object.freeze(Array.from({length:66},(_,index)=>`neuvetra.routine_${String(index).padStart(3,'0')}()`))
const railwaySecret:HostedSetupOpaqueSecretHandle={purpose:'railway-api',reference:'vault://railway/gate'}
const adminSecret:HostedSetupOpaqueSecretHandle={purpose:'postgres-admin',reference:'vault://postgres/admin'}
const runtimeSecret:HostedSetupOpaqueSecretHandle={purpose:'postgres-runtime',reference:'vault://postgres/runtime'}
const endpointFingerprintSha256='e'.repeat(64)

function fixture(){
 const provider:RailwayServiceInventory={
  projectId:HOSTED_SETUP_GATE_RAILWAY_PROJECT,serviceId:HOSTED_SETUP_GATE_RAILWAY_SERVICE,
  enumerationComplete:true,configurationVersion:'configuration-1',deploymentPagesRead:2,
  deploymentNodeCount:2,deploymentsHasNextPage:false,
  deployments:[
   {id:HOSTED_SETUP_GATE_PRIOR_DEPLOYMENT,environmentId:HOSTED_SETUP_GATE_RAILWAY_ENVIRONMENT,
    commitSha:HOSTED_SETUP_GATE_PRIOR_COMMIT,status:'SUCCESS',active:true,
    regions:[{region:HOSTED_SETUP_GATE_REGION,replicas:1}]},
   {id:'11111111-1111-4111-8111-111111111111',environmentId:'22222222-2222-4222-8222-222222222222',
    commitSha:'1'.repeat(40),status:'REMOVED',active:false,regions:[{region:'us-west1',replicas:0}]},
  ],sourceAutoDeployEnabled:false,imageAutoUpdateEnabled:false,scheduledDeploymentsEnabled:false,
  pendingDeploymentCount:0,pendingConfigurationChangeCount:0,
 }
 const database:PostgresWriterInventory={
  complete:true,database:'postgres',projectRef:HOSTED_SETUP_GATE_PROJECT,targetProfile:HOSTED_SETUP_GATE_TARGET,
  schemaVersion:22,endpointFingerprintSha256,runtimeRole:HOSTED_SETUP_GATE_RUNTIME_ROLE,runtimeRoleCanLogin:true,
  runtimeRoleSuperuser:false,runtimeRoleBypassRls:false,runtimeConnectionLimit:-1,
  runtimeSessions:[{pid:'101',role:HOSTED_SETUP_GATE_RUNTIME_ROLE,state:'idle',active:false,transactionOpen:false}],
  runtimeDirectTableWritePrivileges:0,runtimeDirectColumnWritePrivileges:0,
  runtimeExecutableRoutineSignatures:[...routines],runtimePrivilegeEscalationPaths:[],
  otherApplicationWriterRoles:[],scheduledWriterJobs:[],
  privilegedSessions:[{pid:'201',role:'postgres',state:'idle',active:false,transactionOpen:false}],
 }
 let login:PostgresRuntimeLoginResult|undefined
 const calls:string[]=[],authorizations:HostedSetupOpaqueSecretHandle[]=[]
 const railway:HostedSetupRailwayGateClient={
  enumerateService:async(input)=>{calls.push('provider');authorizations.push(input.authorization);return provider},
  scaleRegions:async(input:any)=>{
   calls.push('scale');authorizations.push(input.authorization)
   expect(input).toMatchObject({projectId:HOSTED_SETUP_GATE_RAILWAY_PROJECT,environmentId:HOSTED_SETUP_GATE_RAILWAY_ENVIRONMENT,
    serviceId:HOSTED_SETUP_GATE_RAILWAY_SERVICE,expectedConfigurationVersion:'configuration-1',
    regions:[{region:HOSTED_SETUP_GATE_REGION,replicas:0}]})
   ;(provider.deployments[0]!.regions[0] as {replicas:number}).replicas=0
   provider.configurationVersion='configuration-2'
   return{projectId:HOSTED_SETUP_GATE_RAILWAY_PROJECT,environmentId:HOSTED_SETUP_GATE_RAILWAY_ENVIRONMENT,
    serviceId:HOSTED_SETUP_GATE_RAILWAY_SERVICE,applied:true,priorConfigurationVersion:'configuration-1',
    configurationVersion:'configuration-2',regions:[{region:HOSTED_SETUP_GATE_REGION,replicas:0}]}
  },
 }
 const postgres:HostedSetupPostgresGateClient={
  inspectWriterInventory:async(input)=>{calls.push('database');authorizations.push(input.authorization);return database},
  setRoleConnectionLimit:async(input)=>{calls.push('limit');authorizations.push(input.authorization);database.runtimeConnectionLimit=0;return{role:input.role,previousLimit:-1,newLimit:0,commandTag:'ALTER ROLE'}},
  terminateRoleSessions:async(input)=>{calls.push('terminate');authorizations.push(input.authorization);const attempted=database.runtimeSessions.map(row=>({pid:row.pid,terminated:true}));database.runtimeSessions=[];return{role:input.role,attempted,remainingPids:[] as string[]}},
  attemptRuntimeLogin:async(input)=>{
   calls.push('login');authorizations.push(input.authorization)
   if(login)return login
   if(database.runtimeConnectionLimit===-1)return {kind:'connected',serverReached:true,authenticated:true,
    role:HOSTED_SETUP_GATE_RUNTIME_ROLE,sessionUser:HOSTED_SETUP_GATE_RUNTIME_ROLE,currentUser:HOSTED_SETUP_GATE_RUNTIME_ROLE,
    projectRef:HOSTED_SETUP_GATE_PROJECT,database:'postgres',endpointFingerprintSha256}
   return {kind:'role-connection-limit-refusal',serverReached:true,authenticated:false,credentialAccepted:true,
    role:HOSTED_SETUP_GATE_RUNTIME_ROLE,projectRef:HOSTED_SETUP_GATE_PROJECT,database:'postgres',endpointFingerprintSha256,
    sqlState:'53300',severity:'FATAL',routine:'InitializeSessionUserId',message:`too many connections for role "${HOSTED_SETUP_GATE_RUNTIME_ROLE}"`}
  },
 }
 const input={target:HOSTED_SETUP_GATE_ADAPTER_TARGET,railwayAuthorization:{...railwaySecret},postgresAdminAuthorization:{...adminSecret},postgresRuntimeAuthorization:{...runtimeSecret}}
 const adapter=()=>createHostedSetupWriteGateAdapter(input,{railway,postgres})
 return{provider,database,calls,authorizations,railway,postgres,input,adapter,setLogin:(value:PostgresRuntimeLoginResult|undefined)=>{login=value}}
}

test('is inert until called and drives the reviewed gate with exact opaque handles',async()=>{
 const f=fixture(),ops=f.adapter()
 expect(f.calls).toEqual([])
 const events:unknown[]=[],receipts:unknown[]=[]
 const deps:HostedSetupWriteGateDependencies={...ops,
  openJournal:async()=>({append:async event=>{events.push(event)},close:async()=>{}}),
  writeReceipt:async(_path,receipt)=>{receipts.push(receipt)},now:()=> '2026-09-26T12:00:00.000Z'}
 const receipt=await acquireHostedSetupWriteGate({profile:HOSTED_SETUP_GATE_PROFILE,operatorId:'synthetic-operator',
  journalPath:'C:\\private\\gate.jsonl',stopReceiptPath:'C:\\private\\gate-receipt.json',
  writerInventorySha256:'a'.repeat(64),gateCapabilitySha256:'b'.repeat(64)},deps)
 expect(receipt).toMatchObject({status:'application-writer-gate-held',providerReplicas:0,runtimeConnectionLimit:0,runtimeSessions:0})
 expect(events).toHaveLength(4);expect(receipts).toEqual([receipt])
 expect(f.authorizations.every(handle=>Object.isFrozen(handle)&&handle.reference.startsWith('vault://'))).toBe(true)
 expect(f.calls.filter(call=>call==='scale')).toHaveLength(1)
 expect(f.calls.filter(call=>call==='limit')).toHaveLength(1)
 expect(f.calls.filter(call=>call==='terminate')).toHaveLength(1)
 expect(JSON.stringify({receipt,events,calls:f.calls})).not.toContain('vault://')
 expect(HOSTED_SETUP_PRIVILEGED_WRITER_HOLD).toBe('unresolved-provider-admin-continuous-write-exclusion')
})

test('fails closed on incomplete provider pages, hidden replicas, automation, or target drift',async()=>{
 const changes:Array<(f:ReturnType<typeof fixture>)=>void>=[
  f=>{f.provider.enumerationComplete=false},
  f=>{f.provider.deploymentsHasNextPage=true},
  f=>{f.provider.deploymentNodeCount=1},
  f=>{(f.provider.deployments as any).push({...f.provider.deployments[0]!,id:'33333333-3333-4333-8333-333333333333'});f.provider.deploymentNodeCount=3},
  f=>{(f.provider.deployments[1] as any).active='true';(f.provider.deployments[1]!.regions[0] as {replicas:number}).replicas=1},
  f=>{(f.provider.deployments[1] as any).active=1;(f.provider.deployments[1]!.regions[0] as {replicas:number}).replicas=1},
  f=>{delete (f.provider.deployments[1] as any).active;(f.provider.deployments[1]!.regions[0] as {replicas:number}).replicas=1},
  f=>{(f.provider.deployments[1]!.regions[0] as {replicas:number}).replicas=1},
  f=>{(f.provider.deployments[0]!.regions as any).push({region:'eu-west4',replicas:1})},
  f=>{f.provider.sourceAutoDeployEnabled=true},
  f=>{f.provider.imageAutoUpdateEnabled=true},
  f=>{f.provider.scheduledDeploymentsEnabled=true},
  f=>{f.provider.pendingDeploymentCount=1},
  f=>{(f.provider.deployments[0] as any).commitSha='2'.repeat(40)},
 ]
 for(const change of changes){const f=fixture();change(f);await expect(f.adapter().observeProvider()).rejects.toThrow('HS_GATE_ADAPTER_')}
})

test('a malformed active flag with a positive replica cannot produce an integrated held receipt',async()=>{
 const f=fixture();(f.provider.deployments[1] as any).active='true';(f.provider.deployments[1]!.regions[0] as {replicas:number}).replicas=1
 let receiptWritten=false
 const deps:HostedSetupWriteGateDependencies={...f.adapter(),openJournal:async()=>({append:async()=>{},close:async()=>{}}),
  writeReceipt:async()=>{receiptWritten=true},now:()=> '2026-09-26T12:00:00.000Z'}
 await expect(acquireHostedSetupWriteGate({profile:HOSTED_SETUP_GATE_PROFILE,operatorId:'synthetic-operator',
  journalPath:'C:\\private\\malformed-gate.jsonl',stopReceiptPath:'C:\\private\\malformed-receipt.json',
  writerInventorySha256:'a'.repeat(64),gateCapabilitySha256:'b'.repeat(64)},deps)).rejects.toThrow('HS_GATE_REFUSED_BEFORE_MUTATION')
 expect(f.calls).not.toContain('scale');expect(receiptWritten).toBe(false)
})

test('snapshots handles and client methods before pending work so caller mutation cannot retarget operations',async()=>{
 const f=fixture()
 let release!:(value:PostgresWriterInventory)=>void
 const pendingInventory=new Promise<PostgresWriterInventory>(resolve=>{release=resolve})
 f.postgres.inspectWriterInventory=async input=>{f.calls.push('database');f.authorizations.push(input.authorization);return pendingInventory}
 const ops=f.adapter(),observation=ops.observeDatabase()
 f.input.postgresAdminAuthorization={purpose:'postgres-runtime',reference:'vault://replacement/wrong-role'} as any
 f.input.postgresRuntimeAuthorization.reference='vault://replacement/runtime'
 f.postgres.inspectWriterInventory=async()=>{throw Error('replacement client used')}
 f.postgres.attemptRuntimeLogin=async()=>{throw Error('replacement client used')}
 f.postgres.setRoleConnectionLimit=async()=>{throw Error('replacement client used')}
 release(f.database)
 expect((await observation).runtimeConnectionLimit).toBe(-1)
 await ops.setRuntimeConnectionLimitZero()
 expect(f.authorizations.map(handle=>`${handle.purpose}:${handle.reference}`)).toEqual([
  'postgres-admin:vault://postgres/admin','postgres-runtime:vault://postgres/runtime','postgres-admin:vault://postgres/admin'])
})

test('reads authorization properties and client methods exactly once at construction',async()=>{
 const f=fixture(),originalSet=f.postgres.setRoleConnectionLimit
 let purposeReads=0,referenceReads=0,setMethodReads=0
 const statefulAdmin={} as HostedSetupOpaqueSecretHandle
 Object.defineProperties(statefulAdmin,{
  purpose:{get:()=>++purposeReads===1?'postgres-admin':'postgres-runtime'},
  reference:{get:()=>++referenceReads===1?'vault://postgres/admin':'vault://replacement/admin'},
 })
 const postgres=Object.create(null) as HostedSetupPostgresGateClient
 Object.defineProperties(postgres,{
  inspectWriterInventory:{value:f.postgres.inspectWriterInventory},
  setRoleConnectionLimit:{get:()=>++setMethodReads===1?originalSet:async()=>{throw Error('replacement method used')}},
  terminateRoleSessions:{value:f.postgres.terminateRoleSessions},attemptRuntimeLogin:{value:f.postgres.attemptRuntimeLogin},
 })
 const ops=createHostedSetupWriteGateAdapter({...f.input,postgresAdminAuthorization:statefulAdmin},{railway:f.railway,postgres})
 await ops.observeDatabase();await ops.setRuntimeConnectionLimitZero()
 expect({purposeReads,referenceReads,setMethodReads}).toEqual({purposeReads:1,referenceReads:1,setMethodReads:1})
})

test('serializes provider operations and binds a scale response to its exact request version',async()=>{
 const f=fixture()
 let release!:(value:any)=>void
 const pendingScale=new Promise<any>(resolve=>{release=resolve})
 f.railway.scaleRegions=async input=>{f.calls.push(`scale:${input.expectedConfigurationVersion}`);return pendingScale}
 const ops=f.adapter();await ops.observeProvider()
 const scale=ops.scaleSiteWebToZero()
 await expect(ops.observeProvider()).rejects.toThrow('HS_GATE_ADAPTER_PROVIDER_OPERATION_OVERLAP_OR_UNCERTAIN')
 release({projectId:HOSTED_SETUP_GATE_RAILWAY_PROJECT,environmentId:HOSTED_SETUP_GATE_RAILWAY_ENVIRONMENT,
  serviceId:HOSTED_SETUP_GATE_RAILWAY_SERVICE,applied:true,priorConfigurationVersion:'configuration-2',configurationVersion:'configuration-3',
  regions:[{region:HOSTED_SETUP_GATE_REGION,replicas:0}]})
 await expect(scale).rejects.toThrow('HS_GATE_ADAPTER_SCALE_VERSION_REFUSED')
 expect(f.calls).toContain('scale:configuration-1')
 await expect(ops.observeProvider()).rejects.toThrow('HS_GATE_ADAPTER_PROVIDER_OPERATION_OVERLAP_OR_UNCERTAIN')
})

test('fails closed on unbounded database writers, escalation, routines, jobs, and active privileged sessions',async()=>{
 const changes:Array<(f:ReturnType<typeof fixture>)=>void>=[
  f=>{f.database.complete=false},f=>{f.database.runtimeDirectTableWritePrivileges=1},
  f=>{f.database.runtimeDirectColumnWritePrivileges=1},f=>{f.database.runtimeExecutableRoutineSignatures=f.database.runtimeExecutableRoutineSignatures.slice(1)},
  f=>{f.database.runtimePrivilegeEscalationPaths=['SET ROLE owner']},f=>{f.database.otherApplicationWriterRoles=['other_writer']},
  f=>{f.database.scheduledWriterJobs=['cron:1']},f=>{(f.database.runtimeSessions[0] as any).role='other'},
 ]
 for(const change of changes){const f=fixture();change(f);await expect(f.adapter().observeDatabase()).rejects.toThrow('HS_GATE_ADAPTER_')}
 const f=fixture();(f.database.privilegedSessions[0] as any).active=true
 expect((await f.adapter().observeDatabase()).privilegedActiveSessions).toBe(1)
})

test('requires a known-good exact credential and accepts only a role-specific diagnostic on the same endpoint',async()=>{
 const refused:PostgresRuntimeLoginResult[]=[
  {kind:'authentication-refusal',serverReached:true,authenticated:false,sqlState:'28P01'},
  {kind:'network-error',serverReached:false},{kind:'dns-error',serverReached:false},
  {kind:'tls-error',serverReached:false},{kind:'timeout',serverReached:false},
  {kind:'connected',serverReached:true,authenticated:true,role:HOSTED_SETUP_GATE_RUNTIME_ROLE,sessionUser:HOSTED_SETUP_GATE_RUNTIME_ROLE,currentUser:HOSTED_SETUP_GATE_RUNTIME_ROLE,projectRef:HOSTED_SETUP_GATE_PROJECT,database:'postgres',endpointFingerprintSha256},
  {kind:'role-connection-limit-refusal',serverReached:true,authenticated:false,credentialAccepted:true,role:HOSTED_SETUP_GATE_RUNTIME_ROLE,projectRef:HOSTED_SETUP_GATE_PROJECT,database:'postgres',endpointFingerprintSha256,sqlState:'53300',severity:'FATAL',routine:'InitPostgres',message:`too many connections for role "${HOSTED_SETUP_GATE_RUNTIME_ROLE}"`},
  {kind:'role-connection-limit-refusal',serverReached:true,authenticated:false,credentialAccepted:true,role:HOSTED_SETUP_GATE_RUNTIME_ROLE,projectRef:HOSTED_SETUP_GATE_PROJECT,database:'postgres',endpointFingerprintSha256,sqlState:'53300',severity:'FATAL',routine:'InitializeSessionUserId',message:'remaining connection slots are reserved'},
  {kind:'role-connection-limit-refusal',serverReached:true,authenticated:false,credentialAccepted:true,role:'other_runtime',projectRef:HOSTED_SETUP_GATE_PROJECT,database:'postgres',endpointFingerprintSha256,sqlState:'53300',severity:'FATAL',routine:'InitializeSessionUserId',message:'too many connections for role "other_runtime"'},
  {kind:'role-connection-limit-refusal',serverReached:true,authenticated:false,credentialAccepted:true,role:HOSTED_SETUP_GATE_RUNTIME_ROLE,projectRef:HOSTED_SETUP_GATE_PROJECT,database:'postgres',endpointFingerprintSha256:'f'.repeat(64),sqlState:'53300',severity:'FATAL',routine:'InitializeSessionUserId',message:`too many connections for role "${HOSTED_SETUP_GATE_RUNTIME_ROLE}"`},
 ]
 for(const result of refused){const f=fixture(),ops=f.adapter();await ops.observeDatabase();await ops.setRuntimeConnectionLimitZero();f.setLogin(result);expect(await ops.runtimeLoginRefused()).toBe(false)}
 const f=fixture(),ops=f.adapter();expect(await ops.runtimeLoginRefused()).toBe(false);await ops.observeDatabase();await ops.setRuntimeConnectionLimitZero();expect(await ops.runtimeLoginRefused()).toBe(true)
})

test('refuses secret-purpose confusion and inconclusive mutation results',async()=>{
 const f=fixture()
 expect(()=>createHostedSetupWriteGateAdapter({target:HOSTED_SETUP_GATE_ADAPTER_TARGET,
  railwayAuthorization:adminSecret,postgresAdminAuthorization:adminSecret,postgresRuntimeAuthorization:runtimeSecret},f)).toThrow('HS_GATE_ADAPTER_SECRET_HANDLE_REFUSED')
 f.railway.scaleRegions=async()=>({projectId:HOSTED_SETUP_GATE_RAILWAY_PROJECT,environmentId:HOSTED_SETUP_GATE_RAILWAY_ENVIRONMENT,
  serviceId:HOSTED_SETUP_GATE_RAILWAY_SERVICE,applied:true,priorConfigurationVersion:'configuration-1',configurationVersion:'configuration-1',
  regions:[{region:HOSTED_SETUP_GATE_REGION,replicas:0}]})
 const ops=f.adapter();await ops.observeProvider()
 await expect(ops.scaleSiteWebToZero()).rejects.toThrow('HS_GATE_ADAPTER_SCALE_VERSION_REFUSED')
 const g=fixture();g.postgres.terminateRoleSessions=async()=>({role:HOSTED_SETUP_GATE_RUNTIME_ROLE,attempted:[{pid:'101',terminated:false}],remainingPids:['101'] as string[]})
 const gops=g.adapter();await gops.observeDatabase();await gops.setRuntimeConnectionLimitZero()
 await expect(gops.terminateRuntimeSessions()).rejects.toThrow('HS_GATE_ADAPTER_SESSION_TERMINATION_FAILED')
})
