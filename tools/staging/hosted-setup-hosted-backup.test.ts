import {describe,expect,test} from 'bun:test'
import {boundedDump,operatorUrlFromExport,runtimeUrlFromEnvironment,selectSyntheticTenantActors} from './hosted-setup-hosted-backup'

const safe='postgresql://postgres.icockcoguyadhryzydvl:synthetic-only@aws-1-us-west-1.pooler.supabase.com:5432/postgres'

describe('fixed hosted backup credential source',()=>{
  test('accepts one exact operator target without rendering credentials',()=>{
    expect(operatorUrlFromExport(`export DATABASE_URL='${safe}'`).hostname).toBe('aws-1-us-west-1.pooler.supabase.com')
    expect(operatorUrlFromExport(`"DATABASE_URL": ${JSON.stringify(safe)},`).port).toBe('5432')
  })
  test('rejects duplicate, redirected, and option-bearing inputs',()=>{
    expect(()=>operatorUrlFromExport(`DATABASE_URL=${safe}\nDATABASE_URL=${safe}`)).toThrow()
    expect(()=>operatorUrlFromExport(`DATABASE_URL=${safe.replace('postgres.icockcoguyadhryzydvl','neuvetra_runtime.icockcoguyadhryzydvl')}`)).toThrow()
    expect(()=>operatorUrlFromExport(`DATABASE_URL=${safe}?sslmode=disable`)).toThrow()
    expect(()=>operatorUrlFromExport(`DATABASE_URL=${safe.replace('aws-1-us-west-1.pooler.supabase.com','localhost')}`)).toThrow()
  })
  test('requires the restricted Railway runtime login on the exact operator endpoint',()=>{
    const operator=new URL(safe)
    const runtime=safe.replace('postgres.icockcoguyadhryzydvl','neuvetra_runtime.icockcoguyadhryzydvl')
    expect(runtimeUrlFromEnvironment(runtime,operator).username).toBe('neuvetra_runtime.icockcoguyadhryzydvl')
    expect(()=>runtimeUrlFromEnvironment(undefined,operator)).toThrow()
    expect(()=>runtimeUrlFromEnvironment(safe,operator)).toThrow()
    expect(()=>runtimeUrlFromEnvironment(runtime.replace(':5432/',':6543/'),operator)).toThrow()
    expect(()=>runtimeUrlFromEnvironment(runtime.replace('aws-1-us-west-1.pooler.supabase.com','localhost'),operator)).toThrow()
    expect(()=>runtimeUrlFromEnvironment(runtime+'?sslmode=disable',operator)).toThrow()
  })
})

describe('tenant probes and dump lifetime',()=>{
  const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222'
  const shared='33333333-3333-4333-8333-333333333333',onlyA='44444444-4444-4444-8444-444444444444',onlyB='55555555-5555-4555-8555-555555555555',outsider='66666666-6666-4666-8666-666666666666'
  test('retains exclusive authenticated controls even when a shared member sorts first',()=>{
    const actors=selectSyntheticTenantActors([{company_id:a,user_id:shared},{company_id:a,user_id:onlyA},{company_id:b,user_id:shared},{company_id:b,user_id:onlyB}],outsider)
    expect(actors.find(actor=>actor.id===onlyA)?.companies).toEqual([a])
    expect(actors.find(actor=>actor.id===onlyB)?.companies).toEqual([b])
    expect(actors.find(actor=>actor.id===shared)?.companies).toEqual([a,b])
    expect(actors.find(actor=>actor.id===outsider)?.companies).toEqual([])
    expect(()=>selectSyntheticTenantActors([{company_id:a,user_id:shared},{company_id:b,user_id:shared}],outsider)).toThrow()
  })
  test('kills and rejects a stalled dump before the source transaction expires',async()=>{
    const start=Date.now()
    await expect(boundedDump([process.execPath,'-e','setInterval(()=>{},1000)'],{PATH:process.env.PATH,SystemRoot:process.env.SystemRoot},100)).rejects.toThrow()
    expect(Date.now()-start).toBeLessThan(3000)
  })
  test('accepts a completed bounded child only with a nonempty archive',async()=>{
    const result=await boundedDump([process.execPath,'-e',"process.stdout.write('PGDMP'+'x'.repeat(11))"],{PATH:process.env.PATH,SystemRoot:process.env.SystemRoot},2000)
    expect(result.toString()).toBe('PGDMP'+'x'.repeat(11))
  })
  test('reaps a stalled child when the overall backup signal is cancelled',async()=>{
    const controller=new AbortController()
    const active={cancel:async()=>{}}
    const pending=boundedDump([process.execPath,'-e','setInterval(()=>{},1000)'],{PATH:process.env.PATH,SystemRoot:process.env.SystemRoot},2000,controller.signal,active)
    setTimeout(()=>controller.abort(),100)
    await expect(pending).rejects.toThrow()
    await active.cancel()
  })
})
