/** Synthetic URL strings and locally spawned children only; never invokes live entrypoint. */
import {expect,test} from 'bun:test'
import {boundedDump,operatorUrlFromExport,runtimeUrlFromEnvironment,selectSyntheticTenantActors} from '../../tools/staging/hosted-setup-hosted-backup'

const operator='postgresql://postgres.icockcoguyadhryzydvl:synthetic-only@aws-1-us-west-1.pooler.supabase.com:5432/postgres'
const runtime=operator.replace('postgres.icockcoguyadhryzydvl','neuvetra_runtime.icockcoguyadhryzydvl')
test('independent exact endpoint and restricted runtime URL mutations',()=>{
 const target=operatorUrlFromExport('DATABASE_URL='+operator)
 expect(runtimeUrlFromEnvironment(runtime,target).hostname).toBe(target.hostname)
 for(const change of [
  (s:string)=>s.replace('icockcoguyadhryzydvl','aaaaaaaaaaaaaaaaaaaa'),
  (s:string)=>s.replace('aws-1-us-west-1.pooler.supabase.com','aws-1-us-west-1.pooler.supabase.com.evil.invalid'),
  (s:string)=>s.replace(':5432/',':6543/'),
  (s:string)=>s.replace('/postgres','/different'),
  (s:string)=>s+'#fragment',
  (s:string)=>s+'?options=-csearch_path%3Dpublic',
  (s:string)=>s.replace('synthetic-only@','@'),
  (s:string)=>s.replace('postgresql:','https:'),
 ]){
  expect(()=>operatorUrlFromExport('DATABASE_URL='+change(operator))).toThrow()
  expect(()=>runtimeUrlFromEnvironment(change(runtime),target)).toThrow()
 }
 expect(()=>runtimeUrlFromEnvironment(operator,target)).toThrow('HS_RECOVERY_RUNTIME_URL_REFUSED')
 expect(()=>operatorUrlFromExport('DATABASE_URL='+operator+'\n"DATABASE_URL": '+JSON.stringify(operator))).toThrow('HS_RECOVERY_HOSTED_EXPORT_REFUSED')
 expect(()=>operatorUrlFromExport('DATABASE_URL='+operator.replace('postgres.icock','postgres.other_icock'))).toThrow()
})

test('independent bounded child cancellation, reaping, no false success and diagnostic suppression',async()=>{
 const original=Bun.spawn,captured:any[]=[]
 ;(Bun as any).spawn=(...args:any[])=>{const proc=(original as any)(...args);captured.push(proc);return proc}
 const env={PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,TEMP:process.env.TEMP,TMP:process.env.TMP}
 const child=(code:string)=>[process.execPath,'-e',code]
 const prefix="process.stdout.write('PGDMP'+'x'.repeat(30));"
 const reaped=async()=>{const proc=captured.at(-1);expect(proc).toBeTruthy();await proc.exited;expect(()=>process.kill(proc.pid,0)).toThrow()}
 try{
  const cancelled=new AbortController();cancelled.abort()
  await expect(boundedDump(child('setInterval(()=>{},1000)'),env,500,cancelled.signal)).rejects.toThrow('HS_RECOVERY_DUMP_CANCELLED')
  expect(captured.length).toBe(0)
  for(const invalid of [0,-1,1.5,20001,Infinity,NaN])await expect(boundedDump(child('setInterval(()=>{},1000)'),env,invalid)).rejects.toThrow('HS_RECOVERY_DUMP_DEADLINE_REFUSED')
  expect(captured.length).toBe(0)
  let start=Date.now()
  await expect(boundedDump(child(prefix+'setInterval(()=>{},1000)'),env,150)).rejects.toThrow('HS_RECOVERY_DUMP_FAILED_OR_TIMED_OUT')
  expect(Date.now()-start).toBeLessThan(3000);await reaped()
  // Explicit core cancelDump hook reaps the same process, idempotently.
  const active={cancel:async()=>{}}
  const direct=boundedDump(child(prefix+'setInterval(()=>{},1000)'),env,2000,undefined,active)
  const directRefusal=expect(direct).rejects.toThrow('HS_RECOVERY_DUMP_FAILED_OR_TIMED_OUT')
  await active.cancel();await active.cancel();await directRefusal;await reaped()
  const signal=new AbortController(),activeSignal={cancel:async()=>{}}
  const signalled=boundedDump(child(prefix+'setInterval(()=>{},1000)'),env,2000,signal.signal,activeSignal)
  const signalRefusal=expect(signalled).rejects.toThrow('HS_RECOVERY_DUMP_FAILED_OR_TIMED_OUT')
  signal.abort();await activeSignal.cancel();await signalRefusal;await reaped()
  // Nonzero child with plausible bytes and sensitive-looking stderr cannot pass
  // or expose raw diagnostics through the transport error.
  let message=''
  try{await boundedDump(child(prefix+"process.stderr.write('SYNTHETIC_PRIVATE_DIAGNOSTIC');process.exit(7)"),env,2000)}catch(e){message=(e as Error).message}
  expect(message).toBe('HS_RECOVERY_DUMP_FAILED_OR_TIMED_OUT');expect(message).not.toContain('SYNTHETIC_PRIVATE_DIAGNOSTIC');await reaped()
  await expect(boundedDump(child("process.stdout.write('PGDMP')"),env,2000)).rejects.toThrow('HS_RECOVERY_DUMP_SIZE_REFUSED');await reaped()
  const completedCancel={cancel:async()=>{}},completedSignal=new AbortController()
  const bytes=await boundedDump(child("setTimeout(()=>{process.stdout.write('PGDMP'+'x'.repeat(30))},60)"),env,2000,completedSignal.signal,completedCancel)
  expect(bytes.toString()).toBe('PGDMP'+'x'.repeat(30));await reaped()
  // Cancellation after successful exit is harmless and never starts a child.
  completedSignal.abort();await completedCancel.cancel();await completedCancel.cancel();expect(captured.length).toBe(6)
 }finally{(Bun as any).spawn=original;for(const proc of captured){proc.kill();await proc.exited}}
},15000)

test('overlapping memberships retain each authenticated cross-company denial control',()=>{
 const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222'
 const shared='33333333-3333-4333-8333-333333333333',onlyA='44444444-4444-4444-8444-444444444444',onlyB='55555555-5555-4555-8555-555555555555',out='66666666-6666-4666-8666-666666666666'
 const selected=selectSyntheticTenantActors([{company_id:a,user_id:shared},{company_id:b,user_id:shared},{company_id:a,user_id:onlyA},{company_id:a,user_id:onlyA},{company_id:b,user_id:onlyB}],out)
 expect(selected.length).toBe(4);expect(selected.find(a=>a.id===onlyA)?.companies).toEqual([a]);expect(selected.find(a=>a.id===onlyB)?.companies).toEqual([b]);expect(selected.find(a=>a.id===shared)?.companies).toEqual([a,b])
 expect(()=>selectSyntheticTenantActors([{company_id:a,user_id:shared},{company_id:b,user_id:shared}],out)).toThrow('HS_RECOVERY_CROSS_COMPANY_DENIAL_PROBE_MISSING')
})
