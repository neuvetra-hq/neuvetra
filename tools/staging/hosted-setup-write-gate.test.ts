import {expect,test} from 'bun:test'
import {mkdtemp,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {
 acquireHostedSetupWriteGate,observeHostedSetupWriteGate,exclusiveHostedSetupGateJournal,
 HOSTED_SETUP_GATE_PROFILE,HOSTED_SETUP_GATE_PROJECT,HOSTED_SETUP_GATE_TARGET,
 HOSTED_SETUP_GATE_RAILWAY_PROJECT,HOSTED_SETUP_GATE_RAILWAY_ENVIRONMENT,
 HOSTED_SETUP_GATE_RAILWAY_SERVICE,HOSTED_SETUP_GATE_PRIOR_DEPLOYMENT,
 HOSTED_SETUP_GATE_PRIOR_COMMIT,HOSTED_SETUP_GATE_REGION,HOSTED_SETUP_GATE_RUNTIME_ROLE,
 type HostedSetupWriteGateDependencies,type HostedSetupWriteGateInput,
} from './hosted-setup-write-gate'

const provider=()=>({projectId:HOSTED_SETUP_GATE_RAILWAY_PROJECT,environmentId:HOSTED_SETUP_GATE_RAILWAY_ENVIRONMENT,
 serviceId:HOSTED_SETUP_GATE_RAILWAY_SERVICE,deploymentId:HOSTED_SETUP_GATE_PRIOR_DEPLOYMENT,
 deployedCommit:HOSTED_SETUP_GATE_PRIOR_COMMIT,region:HOSTED_SETUP_GATE_REGION,
 replicas:1,deploymentStatus:'SUCCESS'})
const database=()=>({projectRef:HOSTED_SETUP_GATE_PROJECT,targetProfile:HOSTED_SETUP_GATE_TARGET,schemaVersion:22,
 runtimeRole:HOSTED_SETUP_GATE_RUNTIME_ROLE,runtimeRoleCanLogin:true,runtimeRoleSuperuser:false,runtimeRoleBypassRls:false,
 runtimeConnectionLimit:-1,runtimeSessionCount:1,runtimeActiveSessionCount:0,otherApplicationWriterRoles:0,privilegedActiveSessions:0})

function fixture(){
 const currentProvider=provider(),currentDatabase=database(),actions:string[]=[]
 let refuseLimit=false
 const ops:HostedSetupWriteGateDependencies={
  observeProvider:async()=>({...currentProvider}),
  scaleSiteWebToZero:async()=>{actions.push('scale');currentProvider.replicas=0},
  observeDatabase:async()=>({...currentDatabase}),
  setRuntimeConnectionLimitZero:async()=>{actions.push('limit');if(refuseLimit)throw Error('transport failed');currentDatabase.runtimeConnectionLimit=0},
  terminateRuntimeSessions:async()=>{actions.push('terminate');currentDatabase.runtimeSessionCount=0;currentDatabase.runtimeActiveSessionCount=0},
  runtimeLoginRefused:async()=>{actions.push('login-probe');return currentDatabase.runtimeConnectionLimit===0},
  now:()=> '2026-09-26T12:00:00.000Z',
 }
 return{ops,currentProvider,currentDatabase,actions,failLimit:()=>{refuseLimit=true}}
}
const input=(dir:string):HostedSetupWriteGateInput=>({profile:HOSTED_SETUP_GATE_PROFILE,operatorId:'synthetic-operator',
 journalPath:join(dir,'gate.jsonl'),stopReceiptPath:join(dir,'gate-receipt.json'),
 writerInventorySha256:'a'.repeat(64),gateCapabilitySha256:'b'.repeat(64)})

test('durably reserves the one-time gate, stops the exact app and refuses replay',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'hosted-setup-gate-'))
 try{
  const f=fixture(),i=input(dir)
  const receipt=await acquireHostedSetupWriteGate(i,f.ops)
  expect(receipt).toMatchObject({status:'application-writer-gate-held',providerReplicas:0,
   runtimeConnectionLimit:0,runtimeSessions:0,runtimeLoginRefused:true,hostedSchemaVersion:22})
  expect(f.actions).toEqual(['scale','limit','terminate','login-probe'])
  expect(await observeHostedSetupWriteGate(f.ops)).toBe(true)
  const stored=JSON.parse(await readFile(i.stopReceiptPath,'utf8'))
  expect(stored).toEqual(receipt)
  const journal=(await readFile(i.journalPath,'utf8')).trim().split('\n').map(line=>JSON.parse(line))
  expect(journal.map(item=>item.data.status)).toEqual([
   'gate-attempt-reserved','exact-prior-state-verified','site-web-zero-replicas-observed','application-writer-gate-held'])
  await expect(acquireHostedSetupWriteGate(i,f.ops)).rejects.toThrow()
  expect(f.actions.filter(action=>action==='scale')).toHaveLength(1)
 }finally{await rm(dir,{recursive:true,force:true})}
})

test('a wrong prior identity or active privileged writer refuses before touching hosted state',async()=>{
 for(const change of [
  (f:ReturnType<typeof fixture>)=>{f.currentProvider.deployedCommit='other'},
  (f:ReturnType<typeof fixture>)=>{f.currentDatabase.privilegedActiveSessions=1},
  (f:ReturnType<typeof fixture>)=>{f.currentDatabase.otherApplicationWriterRoles=1},
  (f:ReturnType<typeof fixture>)=>{f.currentDatabase.runtimeConnectionLimit=0},
 ]){
  const dir=await mkdtemp(join(tmpdir(),'hosted-setup-gate-'))
  try{
   const f=fixture();change(f)
   await expect(acquireHostedSetupWriteGate(input(dir),f.ops)).rejects.toThrow('HS_GATE_REFUSED_BEFORE_MUTATION')
   expect(f.actions).toEqual([])
   expect((await readFile(input(dir).journalPath,'utf8')).includes('gate-refused-before-mutation')).toBe(true)
  }finally{await rm(dir,{recursive:true,force:true})}
 }
})

test('a post-stop failure stays stopped and requires reconciliation',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'hosted-setup-gate-'))
 try{
  const f=fixture();f.failLimit()
  await expect(acquireHostedSetupWriteGate(input(dir),f.ops)).rejects.toThrow('HS_GATE_OUTCOME_UNCERTAIN_KEEP_STOPPED')
  expect(f.currentProvider.replicas).toBe(0)
  expect(f.actions).toEqual(['scale','limit'])
  const journal=await readFile(input(dir).journalPath,'utf8')
  expect(journal).toContain('gate-outcome-uncertain-keep-old-app-stopped-and-reconcile')
  await expect(acquireHostedSetupWriteGate(input(dir),f.ops)).rejects.toThrow()
  expect(f.actions).toEqual(['scale','limit'])
 }finally{await rm(dir,{recursive:true,force:true})}
})

test('held observation rejects a resumed app, new runtime session or login acceptance',async()=>{
 const f=fixture();f.currentProvider.replicas=0;f.currentDatabase.runtimeConnectionLimit=0
 await expect(observeHostedSetupWriteGate(f.ops)).rejects.toThrow('HS_GATE_RUNTIME_SESSIONS_REMAIN')
 f.currentDatabase.runtimeSessionCount=0
 expect(await observeHostedSetupWriteGate(f.ops)).toBe(true)
 f.currentProvider.replicas=1
 await expect(observeHostedSetupWriteGate(f.ops)).rejects.toThrow('HS_GATE_PROVIDER_REPLICAS_CHANGED')
})

test('unknown privilege flags and an untyped login result never become affirmative receipts',async()=>{
 for(const mutate of [
  (f:ReturnType<typeof fixture>)=>{delete (f.currentDatabase as any).runtimeRoleSuperuser;delete (f.currentDatabase as any).runtimeRoleBypassRls},
  (f:ReturnType<typeof fixture>)=>{(f.currentDatabase as any).runtimeRoleSuperuser=null;(f.currentDatabase as any).runtimeRoleBypassRls=null},
 ]){
  const dir=await mkdtemp(join(tmpdir(),'hosted-setup-gate-'))
  try{
   const f=fixture();mutate(f)
   await expect(acquireHostedSetupWriteGate(input(dir),f.ops)).rejects.toThrow('HS_GATE_REFUSED_BEFORE_MUTATION')
   expect(f.actions).toEqual([])
  }finally{await rm(dir,{recursive:true,force:true})}
 }
 const dir=await mkdtemp(join(tmpdir(),'hosted-setup-gate-'))
 try{
  const f=fixture();f.ops.runtimeLoginRefused=(async()=> 'false')as any
  await expect(acquireHostedSetupWriteGate(input(dir),f.ops)).rejects.toThrow('HS_GATE_OUTCOME_UNCERTAIN_KEEP_STOPPED')
  expect(f.currentProvider.replicas).toBe(0)
 }finally{await rm(dir,{recursive:true,force:true})}
})

test('interleaved provider resumption or privileged activity invalidates the final gate observation',async()=>{
 for(const race of ['provider','privileged']as const){
  const dir=await mkdtemp(join(tmpdir(),'hosted-setup-gate-'))
  try{
   const f=fixture()
   if(race==='provider'){
    const original=f.ops.observeDatabase
    f.ops.observeDatabase=async()=>{
     if(f.currentDatabase.runtimeConnectionLimit===0)f.currentProvider.replicas=1
     return original()
    }
   }else{
    const original=f.ops.runtimeLoginRefused
    f.ops.runtimeLoginRefused=async()=>{f.currentDatabase.privilegedActiveSessions=1;return original()}
   }
   await expect(acquireHostedSetupWriteGate(input(dir),f.ops)).rejects.toThrow('HS_GATE_OUTCOME_UNCERTAIN_KEEP_STOPPED')
   expect(f.actions.filter(action=>action==='scale')).toHaveLength(1)
  }finally{await rm(dir,{recursive:true,force:true})}
 }
})

test('journal paths are anchored to the module repository and must be absolute',async()=>{
 await expect(exclusiveHostedSetupGateJournal('relative-gate.jsonl')).rejects.toThrow('HS_GATE_ABSOLUTE_PATH_REQUIRED')
 const inside=join(fileURLToPath(new URL('../..',import.meta.url)),'unwritten-gate.jsonl')
 await expect(exclusiveHostedSetupGateJournal(inside)).rejects.toThrow('HS_GATE_PRIVATE_PATH_REQUIRED')
})

test('input and operation handles are captured before asynchronous journal creation',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'hosted-setup-gate-input-'))
 try{
  const f=fixture(),i=input(dir),originalPath=i.stopReceiptPath,originalId=i.operatorId
  let release!:()=>void
  const pending=new Promise<void>(resolve=>{release=resolve})
  const events:unknown[]=[]
  let receiptPath=''
  f.ops.openJournal=async()=>{await pending;return{append:async event=>{events.push(event)},close:async()=>{}}}
  f.ops.writeReceipt=async(path)=>{receiptPath=path}
  const running=acquireHostedSetupWriteGate(i,f.ops)
  i.operatorId='forged-operator';i.stopReceiptPath=join(dir,'forged-receipt.json');i.writerInventorySha256='c'.repeat(64)
  f.ops.scaleSiteWebToZero=async()=>{throw Error('swapped operation')}
  release()
  const receipt=await running
  expect(receipt.operatorId).toBe(originalId)
  expect(receipt.writerInventorySha256).toBe('a'.repeat(64))
  expect(receiptPath).toBe(originalPath)
  expect(f.actions).toEqual(['scale','limit','terminate','login-probe'])
  expect(events).toHaveLength(4)
 }finally{await rm(dir,{recursive:true,force:true})}
})

test('coercible mutable evidence pins refuse before journal creation or provider action',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'hosted-setup-gate-pins-'))
 try{
  for(const field of ['writerInventorySha256','gateCapabilitySha256']as const){
   const f=fixture(),i=input(dir)
   let journalOpened=false
   f.ops.openJournal=async()=>{journalOpened=true;throw Error('unexpected journal')}
   ;(i as any)[field]=['a'.repeat(64)]
   await expect(acquireHostedSetupWriteGate(i,f.ops)).rejects.toThrow('HS_GATE_EVIDENCE_PINS_REQUIRED')
   expect(journalOpened).toBe(false)
   expect(f.actions).toEqual([])
  }
 }finally{await rm(dir,{recursive:true,force:true})}
})
