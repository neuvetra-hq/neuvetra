import {test,expect} from 'bun:test'
import {checkWebsiteReader,HOST,SCOPE,READER} from './check-website-reader'
const now=Date.parse('2026-09-09T10:00:00Z'),key='sb_publishable_offline_synthetic_key_1234'
const meta={scope_id:SCOPE,run_marker:'neuvetra-website-epa-20260909',kind:'private_research_reader'}
const claims={sub:READER,role:'authenticated',aud:'authenticated',iss:`https://${HOST}/auth/v1`,exp:now/1000+3600,app_metadata:meta}
const token=(v:unknown)=>`eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify(v)).toString('base64url')}.b2ZmbGluZVNpZ25hdHVyZQ`
const jwt=token(claims)
const build='63f0190c-9694-46db-9ea8-85445a80f6be',release='38f91ceac7aab790cb6faf98d39d8e0c5f2eb734f6a5763d51b6bf6ef7afa43f'
const source='14159d202f33dc9953bced7d8acdb53c8affd4b4260e2e0c8482f1b174f28cf3',extraction='6c0dd2224703fa7bd48f6a18a666d3a29212d2435f6348382cef76950ffb36a4'
const payload=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json'}})
function transport(options:{identity?:boolean;foreignMember?:boolean;leak?:boolean;badMissing?:boolean;throwOn?:number}={}) {
  const calls:{url:string;init:RequestInit}[]=[]
  const fetch=async(url:string,init:RequestInit)=>{
    calls.push({url,init});if(calls.length===options.throwOn)throw Error('RAW PRIVATE PROVIDER MESSAGE')
    const u=new URL(url),headers=init.headers as Record<string,string>
    if(u.pathname==='/auth/v1/user')return payload({id:options.identity?'wrong':READER,role:'authenticated',app_metadata:meta})
    if(!headers.Authorization || headers.Authorization!==`Bearer ${jwt}`)return payload({code:'42501'},403)
    if(u.pathname.startsWith('/storage/v1/')) {
      if(u.pathname.includes(SCOPE))return new Response('tampered synthetic PDF bytes')
      if(options.leak)return payload({text:'synthetic cross-scope leak'})
      return payload({statusCode:'404',code:options.badMissing?'NoSuchBucket':'NoSuchKey'},400)
    }
    const table=u.pathname.split('/').at(-1)
    if(table==='research_memberships')return payload([{scope_id:options.foreignMember?'other':SCOPE,user_id:READER}])
    if(table==='research_active_builds')return payload([{scope_id:SCOPE,build_id:build,release_sha256:release}])
    if(table==='research_releases')return payload([{scope_id:SCOPE,build_id:build,release_sha256:release,profile_sha256:'756dd7589f918a257dad2fad38e3d8839c7d9c55a007885f0e1505f5528871f5',namespace:'nv-63f0190c969446db9ea885445a80f6be',status:'approved',review_expires_at:'2026-09-15T23:20:32Z',commercial_runtime_approval:false}])
    if(table==='research_passages') {
      if(u.searchParams.get('scope_id')?.startsWith('in.'))return payload(options.leak?[{scope_id:'foreign',passage_id:'A01'}]:[])
      return payload(Array.from({length:18},(_,i)=>({scope_id:SCOPE,build_id:build,release_sha256:release,source_sha256:source,extraction_sha256:extraction,passage_id:`S${String(i+1).padStart(2,'0')}`,review_status:'approved',is_active:true})))
    }
    throw Error('unexpected test route')
  }
  return {fetch,calls}
}
test('all12 checks use fixed GET-only routes; original-byte tamper alone prevents a false complete pass',async()=>{
  const t=transport(),r=await checkWebsiteReader({publicKey:key,readerJwt:jwt,fetch:t.fetch,now:()=>now})
  expect(r.checks.length).toBe(12);expect(r.requests_attempted).toBe(12);expect(r.status).toBe('failed')
  expect(r.checks.filter(c=>!c.passed).map(c=>c.id)).toEqual(['c_private_original_bytes'])
  expect(t.calls.every(c=>new URL(c.url).host===HOST&&c.init.method==='GET'&&c.init.redirect==='error'&&c.init.body===undefined&&c.init.signal instanceof AbortSignal)).toBe(true)
  expect(t.calls.some(c=>c.url.includes('/rpc/')||c.url.includes('/admin/'))).toBe(false)
  expect(r.mutations_attempted).toBe(0);expect(r.rpc_execution).toContain('untested')
  expect(JSON.stringify(r)).not.toContain(jwt);expect(JSON.stringify(r)).not.toContain(key)
})
test('identity or membership failure stops before source or cross-scope requests',async()=>{
  for(const option of [{identity:true},{foreignMember:true}]) {
    const t=transport(option),r=await checkWebsiteReader({publicKey:key,readerJwt:jwt,fetch:t.fetch,now:()=>now})
    expect(r.status).toBe('failed');expect(t.calls.length).toBe(option.identity?1:2)
    expect(t.calls.some(c=>c.url.includes('/storage/'))).toBe(false)
  }
})
test('cross-scope row/object leaks and wrong missing-resource category never count as denials',async()=>{
  for(const option of [{leak:true},{badMissing:true}]) {
    const t=transport(option),r=await checkWebsiteReader({publicKey:key,readerJwt:jwt,fetch:t.fetch,now:()=>now})
    expect(r.checks.filter(c=>c.id==='a_private_original_denied'||c.id==='b_private_original_denied').every(c=>!c.passed)).toBe(true)
    if(option.leak)expect(r.checks.find(c=>c.id==='a_b_passages_invisible')!.passed).toBe(false)
  }
})
test('anonymous headers omit bearer and role-forgery preserves signature but changes claimed role only',async()=>{
  const t=transport();await checkWebsiteReader({publicKey:key,readerJwt:jwt,fetch:t.fetch,now:()=>now})
  const anonymous=t.calls.slice(9,11)
  expect(anonymous.every(c=>!('Authorization'in(c.init.headers as object)))).toBe(true)
  const forged=(t.calls[11]!.init.headers as Record<string,string>).Authorization!.slice(7).split('.')
  expect(forged[0]).toBe(jwt.split('.')[0]);expect(forged[2]).toBe(jwt.split('.')[2])
  expect(JSON.parse(Buffer.from(forged[1]!,'base64url').toString())).toEqual({...claims,role:'service_role'})
})
test('admin, wrong identity, expired JWT or expired resource refuse before transport',async()=>{
  for(const [publicKey,readerJwt,clock] of [[key,token({...claims,role:'service_role'}),now],[key,token({...claims,sub:'wrong'}),now],
    [key,token({...claims,exp:now/1000-1}),now],['sb_secret_not_a_reader_key_1234',jwt,now],[key,jwt,Date.parse('2026-09-16T00:00:00Z')]] as const) {
    const t=transport();await expect(checkWebsiteReader({publicKey,readerJwt,fetch:t.fetch,now:()=>clock})).rejects.toThrow('reader_configuration_refused');expect(t.calls.length).toBe(0)
  }
})
test('transport failure is sanitized, counted and never retried',async()=>{
  const t=transport({throwOn:3}),r=await checkWebsiteReader({publicKey:key,readerJwt:jwt,fetch:t.fetch,now:()=>now})
  expect(r.status).toBe('failed');expect(r.requests_attempted).toBe(3);expect(r.stopped_reason).toBe('reader_probe_failed');expect(t.calls.length).toBe(3)
  expect(JSON.stringify(r)).not.toContain('RAW PRIVATE')
})
