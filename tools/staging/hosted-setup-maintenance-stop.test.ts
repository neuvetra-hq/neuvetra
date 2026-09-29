import {expect,test} from 'bun:test'
import {mkdtemp,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {
 HOSTED_SETUP_MAINTENANCE_STOP_PROFILE,stopHostedSetupForMaintenance,maintenanceJournal,
 type MaintenanceObservation,type MaintenanceStopDependencies,type MaintenanceStopInput,
} from './hosted-setup-maintenance-stop'
import {
 HOSTED_SETUP_GATE_RAILWAY_PROJECT,HOSTED_SETUP_GATE_RAILWAY_ENVIRONMENT,
 HOSTED_SETUP_GATE_RAILWAY_SERVICE,HOSTED_SETUP_GATE_PRIOR_DEPLOYMENT,
 HOSTED_SETUP_GATE_PRIOR_COMMIT,HOSTED_SETUP_GATE_REGION,
} from './hosted-setup-write-gate'

const input=(dir:string):MaintenanceStopInput=>({profile:HOSTED_SETUP_MAINTENANCE_STOP_PROFILE,
 operatorId:'synthetic-operator',journalPath:join(dir,'maintenance.jsonl'),receiptPath:join(dir,'stop.json')})
function fixture(){
 const current:MaintenanceObservation={projectId:HOSTED_SETUP_GATE_RAILWAY_PROJECT,
  environmentId:HOSTED_SETUP_GATE_RAILWAY_ENVIRONMENT,serviceId:HOSTED_SETUP_GATE_RAILWAY_SERVICE,
  region:HOSTED_SETUP_GATE_REGION,deploymentId:HOSTED_SETUP_GATE_PRIOR_DEPLOYMENT,
  deployedCommit:HOSTED_SETUP_GATE_PRIOR_COMMIT,deploymentStatus:'SUCCESS',replicas:1,
  configurationVersion:'version-one',automaticDeploymentsEnabled:false,pendingChanges:0,
  stagedPatchEmpty:true,
  inventoryComplete:true}
 const calls:string[]=[]
 const deps:MaintenanceStopDependencies={
  observe:async()=>{calls.push('observe');return JSON.stringify({...current})},
  scaleToZero:async target=>{
   calls.push('scale')
   expect(target).toEqual({projectId:HOSTED_SETUP_GATE_RAILWAY_PROJECT,
    environmentId:HOSTED_SETUP_GATE_RAILWAY_ENVIRONMENT,serviceId:HOSTED_SETUP_GATE_RAILWAY_SERVICE,
    region:HOSTED_SETUP_GATE_REGION})
   current.replicas=0;current.configurationVersion='version-two'
  },
  now:()=> '2026-09-26T12:00:00.000Z',
 }
 return {current,calls,deps}
}

test('durable exact maintenance stop, truthful scope and no replay',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'hosted-maintenance-'))
 try{
  const f=fixture(),i=input(dir),receipt=await stopHostedSetupForMaintenance(i,f.deps)
  expect(receipt).toMatchObject({status:'hosted_setup_maintenance_stop_observed',
   replicas:0,availabilityStopObserved:true,databaseWritersExcluded:false,
   deployedCommit:HOSTED_SETUP_GATE_PRIOR_COMMIT,configurationVersion:'version-two'})
  expect(JSON.parse(await readFile(i.receiptPath,'utf8'))).toEqual(receipt)
  const journal=(await readFile(i.journalPath,'utf8')).trim().split('\n').map(line=>JSON.parse(line))
  expect(journal.map(row=>row.data.status)).toEqual([
   'maintenance_stop_reserved','exact_prior_deployment_observed','maintenance_stop_receipt_written'])
  expect(f.calls).toEqual(['observe','observe','scale','observe','observe'])
  await expect(stopHostedSetupForMaintenance(i,f.deps)).rejects.toThrow()
  expect(f.calls.filter(call=>call==='scale')).toHaveLength(1)
 }finally{await rm(dir,{recursive:true,force:true})}
})

test('wrong prior deployment and incomplete provider inventory refuse before scale',async()=>{
 for(const alter of [(o:MaintenanceObservation)=>{o.deployedCommit='0'.repeat(40)},
  (o:MaintenanceObservation)=>{o.inventoryComplete=false},
  (o:MaintenanceObservation)=>{o.automaticDeploymentsEnabled=true},
  (o:MaintenanceObservation)=>{o.stagedPatchEmpty=false},
  (o:MaintenanceObservation)=>{o.pendingChanges=1}]){
  const dir=await mkdtemp(join(tmpdir(),'hosted-maintenance-'))
  try{
   const f=fixture();alter(f.current)
   await expect(stopHostedSetupForMaintenance(input(dir),f.deps)).rejects.toThrow('HS_MAINTENANCE_REFUSED_BEFORE_MUTATION')
   expect(f.calls.includes('scale')).toBe(false)
  }finally{await rm(dir,{recursive:true,force:true})}
 }
})

test('a null Railway change count requires a separately observed empty staged patch',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'hosted-maintenance-staged-'))
 try{
  const f=fixture()
  f.current.pendingChanges=null
  const receipt=await stopHostedSetupForMaintenance(input(dir),f.deps)
  expect(receipt.replicas).toBe(0)
  expect(f.calls.filter(call=>call==='scale')).toHaveLength(1)
 }finally{await rm(dir,{recursive:true,force:true})}
})

test('a post-scale deployment drift is uncertain and never auto-resumes or retries',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'hosted-maintenance-'))
 try{
  const f=fixture(),scale=f.deps.scaleToZero
  f.deps.scaleToZero=async target=>{await scale(target);f.current.deploymentId='changed'}
  await expect(stopHostedSetupForMaintenance(input(dir),f.deps)).rejects.toThrow('HS_MAINTENANCE_OUTCOME_UNCERTAIN_DO_NOT_RETRY')
  expect(f.current.replicas).toBe(0)
  expect(f.calls.filter(call=>call==='scale')).toHaveLength(1)
  expect(await readFile(input(dir).journalPath,'utf8')).toContain('maintenance_stop_outcome_uncertain_do_not_retry')
  await expect(stopHostedSetupForMaintenance(input(dir),f.deps)).rejects.toThrow()
  expect(f.calls.filter(call=>call==='scale')).toHaveLength(1)
 }finally{await rm(dir,{recursive:true,force:true})}
})

test('paths are private and input/dependency swaps cannot redirect a pending stop',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'hosted-maintenance-'))
 try{
  await expect(maintenanceJournal('relative.jsonl')).rejects.toThrow('HS_MAINTENANCE_PRIVATE_ABSOLUTE_PATH_REQUIRED')
  const inside=join(fileURLToPath(new URL('../..',import.meta.url)),'unwritten-maintenance.jsonl')
  await expect(maintenanceJournal(inside)).rejects.toThrow('HS_MAINTENANCE_PRIVATE_ABSOLUTE_PATH_REQUIRED')
  const f=fixture(),i=input(dir),original=i.receiptPath
  let release!:()=>void
  const pending=new Promise<void>(resolve=>{release=resolve})
  const events:unknown[]=[]
  let written=''
  f.deps.openJournal=async()=>{await pending;return {append:async value=>{events.push(value)},close:async()=>{}}}
  f.deps.writeReceipt=async path=>{written=path}
  const running=stopHostedSetupForMaintenance(i,f.deps)
  i.receiptPath=join(dir,'forged.json');i.operatorId='forged'
  f.deps.scaleToZero=async()=>{throw Error('swapped operation')}
  release()
  const receipt=await running
  expect(receipt.operatorId).toBe('synthetic-operator')
  expect(written).toBe(original)
  expect(events).toHaveLength(3)
  expect(f.calls.filter(call=>call==='scale')).toHaveLength(1)
 }finally{await rm(dir,{recursive:true,force:true})}
})

test('async observation cannot rebind an invalid prior deployment into success',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'hosted-maintenance-observation-'))
 try{
  const f=fixture(),old=f.deps.observe
  f.deps.observe=async()=>{
   if(f.current.replicas===1){
    const candidate={...f.current,deploymentId:'wrong'}
    queueMicrotask(()=>{candidate.deploymentId=HOSTED_SETUP_GATE_PRIOR_DEPLOYMENT})
    return JSON.stringify(candidate)
   }
   return old()
  }
  await expect(stopHostedSetupForMaintenance(input(dir),f.deps)).rejects.toThrow('HS_MAINTENANCE_REFUSED_BEFORE_MUTATION')
  expect(f.calls.includes('scale')).toBe(false)
 }finally{await rm(dir,{recursive:true,force:true})}
})

test('receipt writer and journal method swaps cannot change a successful receipt',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'hosted-maintenance-capture-'))
 try{
  const f=fixture(),events:unknown[]=[]
  const journal={append:async(value:unknown)=>{events.push(value);
   journal.append=async()=>{throw Error('swapped append')}},close:async()=>{}}
  f.deps.openJournal=async()=>journal
  let writerSawExcluded:unknown
  f.deps.writeReceipt=async(_path,receipt)=>{
   try{(receipt as any).databaseWritersExcluded=true;(receipt as any).operatorId='forged'}catch{}
   writerSawExcluded=receipt.databaseWritersExcluded
  }
  const result=await stopHostedSetupForMaintenance(input(dir),f.deps)
  expect(writerSawExcluded).toBe(false)
  expect(result.databaseWritersExcluded).toBe(false)
  expect(result.operatorId).toBe('synthetic-operator')
  expect(events).toHaveLength(3)
  expect(f.calls.filter(call=>call==='scale')).toHaveLength(1)
 }finally{await rm(dir,{recursive:true,force:true})}
})

test('clock must return a primitive canonical UTC timestamp before scale',async()=>{
 for(const invalid of [undefined,{value:'2026-09-26T12:00:00.000Z'},'invalid-date','2026-09-26'] as unknown[]){
  const dir=await mkdtemp(join(tmpdir(),'hosted-maintenance-clock-'))
  try{
   const f=fixture()
   f.deps.now=(()=>invalid) as MaintenanceStopDependencies['now']
   await expect(stopHostedSetupForMaintenance(input(dir),f.deps)).rejects.toThrow('HS_MAINTENANCE_REFUSED_BEFORE_MUTATION')
   expect(f.calls.includes('scale')).toBe(false)
  }finally{await rm(dir,{recursive:true,force:true})}
 }
})

test('journal methods are validated and captured from one getter read each',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'hosted-maintenance-journal-capture-'))
 try{
  const f=fixture(),events:unknown[]=[]
  let appendReads=0,closeReads=0,closeCalls=0
  const journal={
   get append(){appendReads++;return appendReads===1?async(value:unknown)=>{events.push(value)}:async()=>{}},
   get close(){closeReads++;return closeReads===1?async()=>{closeCalls++}:async()=>{}},
  }
  f.deps.openJournal=async()=>journal
  f.deps.writeReceipt=async()=>{}
  const receipt=await stopHostedSetupForMaintenance(input(dir),f.deps)
  expect(receipt.status).toBe('hosted_setup_maintenance_stop_observed')
  expect(events).toHaveLength(3)
  expect(appendReads).toBe(1)
  expect(closeReads).toBe(1)
  expect(closeCalls).toBe(1)
  expect(f.calls.filter(call=>call==='scale')).toHaveLength(1)
 }finally{await rm(dir,{recursive:true,force:true})}
})

test('clock reversal refuses before scale or records uncertainty after scale',async()=>{
 const scenarios=[
  {times:['2026-09-26T12:00:04.000Z','2026-09-26T12:00:03.000Z'],scaled:false},
  {times:['2026-09-26T12:00:01.000Z','2026-09-26T12:00:02.000Z','2026-09-26T12:00:00.000Z'],scaled:true},
 ]
 for(const scenario of scenarios){
  const dir=await mkdtemp(join(tmpdir(),'hosted-maintenance-clock-order-'))
  try{
   const f=fixture();let index=0
   f.deps.now=()=>scenario.times[Math.min(index++,scenario.times.length-1)]!
   await expect(stopHostedSetupForMaintenance(input(dir),f.deps)).rejects.toThrow(scenario.scaled?'HS_MAINTENANCE_OUTCOME_UNCERTAIN_DO_NOT_RETRY':'HS_MAINTENANCE_REFUSED_BEFORE_MUTATION')
   expect(f.calls.includes('scale')).toBe(scenario.scaled)
   const journal=await readFile(input(dir).journalPath,'utf8')
   expect(journal).toContain(scenario.scaled?'maintenance_stop_outcome_uncertain_do_not_retry':'maintenance_stop_refused_before_mutation')
   expect(journal).toContain('"clockFallback":true')
  }finally{await rm(dir,{recursive:true,force:true})}
 }
})
