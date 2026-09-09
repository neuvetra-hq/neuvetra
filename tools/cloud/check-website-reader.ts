/** Read-only checks for the one private website reader. No CLI, ENV, disk,
 * sign-in, Pinecone calls, POST, RPC execution or import-time I/O.
 * The repository already validates original/extraction/release bytes and spans
 * before answering; this probe adds actual C-versus-A/B and anonymous checks.
 */
import { createHash } from 'node:crypto'

export const HOST = 'icockcoguyadhryzydvl.supabase.co'
export const SCOPE = '90000000-0000-4000-8000-00000000000c'
export const READER = 'f00d7f73-53a9-4e0e-993b-33d47e0330cd'
const SCHEMA = 'neuvetra_research_dev', BUCKET = 'neuvetra-research-dev'
const BUILD = '63f0190c-9694-46db-9ea8-85445a80f6be', NAMESPACE = 'nv-63f0190c969446db9ea885445a80f6be'
const RELEASE = '38f91ceac7aab790cb6faf98d39d8e0c5f2eb734f6a5763d51b6bf6ef7afa43f'
const PROFILE = '756dd7589f918a257dad2fad38e3d8839c7d9c55a007885f0e1505f5528871f5'
const SOURCE = '14159d202f33dc9953bced7d8acdb53c8affd4b4260e2e0c8482f1b174f28cf3'
const EXTRACTION = '6c0dd2224703fa7bd48f6a18a666d3a29212d2435f6348382cef76950ffb36a4'
const EXPIRES = Date.parse('2026-09-15T23:20:32Z')
const A = '90000000-0000-4000-8000-00000000000a', B = '90000000-0000-4000-8000-00000000000b'
const A_SOURCE = `${A}/sha256/5414f37316a224485f93460a544a9f77a34a5f2913dfa0b55d41e8ac0e6ebc01/source.txt`
const B_SOURCE = `${B}/sha256/6712bc0c1aec3abd57d2606861e101f24409c23f64a7162070c7d21e01c60a00/source.txt`
const C_SOURCE = `${SCOPE}/sha256/${SOURCE}/source.pdf`
type Row = Record<string, unknown>
type Fetch = (url: string, init: RequestInit) => Promise<Response>
interface Check { id: string; passed: boolean; http_status: number | null; observed_count?: number; verified_sha256?: string; error?: string }
export class ReaderCheckError extends Error { constructor(public readonly code: string) { super(code) } }
const record = (v: unknown): v is Row => !!v && typeof v === 'object' && !Array.isArray(v)
const need = (ok: unknown, code: string): void => { if (!ok) throw new ReaderCheckError(code) }
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')
const json = (bytes: Uint8Array): unknown => { try { return JSON.parse(new TextDecoder('utf8',{fatal:true}).decode(bytes)) } catch { return null } }
const metadata = (v: unknown) => record(v) && v.scope_id === SCOPE && v.run_marker === 'neuvetra-website-epa-20260909' && v.kind === 'private_research_reader'
const objectPath = (key: string) => `/storage/v1/object/authenticated/${BUCKET}/${key}`
const rowsPath = (table: string, select: string, filters: Record<string,string> = {}) => `/rest/v1/${table}?${new URLSearchParams({select,...filters,limit:'20'})}`

export async function checkWebsiteReader(config: { publicKey: string; readerJwt: string; fetch?: Fetch; now?: () => number }) {
  const now = config.now ?? Date.now, fetcher = config.fetch ?? fetch
  need(/^sb_publishable_[A-Za-z0-9_-]{16,300}$/.test(config.publicKey) && typeof config.readerJwt === 'string' && config.readerJwt.length < 16000 && !/[\r\n]/.test(config.readerJwt), 'reader_configuration_refused')
  const segments = config.readerJwt.split('.'); let claims: unknown
  try { need(segments.length === 3 && segments.every(s=>/^[A-Za-z0-9_-]+$/.test(s)), 'reader_configuration_refused'); claims=json(Buffer.from(segments[1]!,'base64url')) } catch { throw new ReaderCheckError('reader_configuration_refused') }
  need(record(claims) && claims.sub === READER && claims.role === 'authenticated' && claims.aud === 'authenticated'
    && claims.iss === `https://${HOST}/auth/v1` && typeof claims.exp === 'number' && claims.exp*1000 > now() && metadata(claims.app_metadata) && now() < EXPIRES, 'reader_configuration_refused')
  // Deliberately retain the original signature after altering the claimed role.
  // The fixed read-only endpoint must reject this forgery; no admin key is used.
  const forged = `${segments[0]}.${Buffer.from(JSON.stringify({...claims as Row,role:'service_role'})).toString('base64url')}.${segments[2]}`
  const checks: Check[] = []; let requestsAttempted=0
  async function get(route: string, mode: 'reader'|'anonymous'|'forged', cap = 64000) {
    need(now() < EXPIRES, 'resource_expired')
    const headers: Record<string,string> = {apikey:config.publicKey}
    if(mode!=='anonymous') headers.Authorization=`Bearer ${mode==='forged'?forged:config.readerJwt}`
    if(route.startsWith('/rest/v1/')) headers['Accept-Profile']=SCHEMA
    requestsAttempted++
    const response=await fetcher(`https://${HOST}${route}`,{method:'GET',headers,redirect:'error',signal:AbortSignal.timeout(15000)})
    need(response.status < 300 || response.status >= 400,'redirect_refused')
    need(response.body,'response_empty')
    const reader=response.body!.getReader(),chunks:Uint8Array[]=[];let size=0
    try { while(true) { const part=await reader.read();if(part.done)break;size+=part.value.length;need(size<=cap,'response_too_large');chunks.push(part.value) } }
    finally { await reader.cancel().catch(()=>{}) }
    return {status:response.status,bytes:Buffer.concat(chunks)}
  }
  async function rows(id:string,route:string,predicate:(rows:Row[])=>boolean,mode:'reader'|'anonymous'='reader') {
    const r=await get(route,mode),v=json(r.bytes),valid=Array.isArray(v)&&v.every(record)
    const passed=r.status===200&&valid&&predicate(v as Row[])
    checks.push({id,passed,http_status:r.status,...(valid?{observed_count:v.length}:{})})
    return passed
  }
  async function denied(id:string,route:string,mode:'reader'|'anonymous'|'forged',storage=false) {
    const r=await get(route,mode),v=json(r.bytes)
    const typedMissing=storage&&r.status===400&&record(v)&&String(v.statusCode)==='404'&&v.code==='NoSuchKey'
    const passed=[401,403].includes(r.status)||(storage&&r.status===404)||typedMissing
    checks.push({id,passed,http_status:r.status})
  }
  const cPassages=rowsPath('research_passages','scope_id,build_id,release_sha256,passage_id,source_sha256,extraction_sha256,review_status,is_active',{scope_id:`eq.${SCOPE}`})
  let stopped_reason:string|null=null
  try {
    const auth=await get('/auth/v1/user','reader'),user=json(auth.bytes)
    const identity=auth.status===200&&record(user)&&user.id===READER&&user.role==='authenticated'&&metadata(user.app_metadata)
    checks.push({id:'ordinary_reader_identity',passed:identity,http_status:auth.status});need(identity,'identity_refused')
    const member=await rows('membership_exactly_c',rowsPath('research_memberships','scope_id,user_id',{user_id:`eq.${READER}`}),v=>v.length===1&&v[0]!.scope_id===SCOPE&&v[0]!.user_id===READER)
    need(member,'membership_refused')
    await rows('c_active_build',rowsPath('research_active_builds','scope_id,build_id,release_sha256',{scope_id:`eq.${SCOPE}`}),v=>v.length===1&&v[0]!.scope_id===SCOPE&&v[0]!.build_id===BUILD&&v[0]!.release_sha256===RELEASE)
    await rows('c_approved_release',rowsPath('research_releases','scope_id,build_id,release_sha256,profile_sha256,namespace,status,review_expires_at,commercial_runtime_approval',{scope_id:`eq.${SCOPE}`}),v=>v.length===1&&v[0]!.scope_id===SCOPE&&v[0]!.build_id===BUILD&&v[0]!.release_sha256===RELEASE&&v[0]!.profile_sha256===PROFILE&&v[0]!.namespace===NAMESPACE&&v[0]!.status==='approved'&&v[0]!.commercial_runtime_approval===false&&Date.parse(String(v[0]!.review_expires_at))===EXPIRES&&now()<EXPIRES)
    await rows('c_18_approved_passages',cPassages,v=>v.length===18&&new Set(v.map(p=>p.passage_id)).size===18&&v.every(p=>p.scope_id===SCOPE&&p.build_id===BUILD&&p.release_sha256===RELEASE&&p.source_sha256===SOURCE&&p.extraction_sha256===EXTRACTION&&p.review_status==='approved'&&p.is_active===true&&/^S(?:0[1-9]|1[0-8])$/.test(String(p.passage_id))))
    const original=await get(objectPath(C_SOURCE),'reader',1_000_000),originalOk=original.status===200&&original.bytes.length===396931&&hash(original.bytes)===SOURCE
    checks.push({id:'c_private_original_bytes',passed:originalOk,http_status:original.status,...(originalOk?{verified_sha256:SOURCE}:{})})
    await rows('a_b_passages_invisible',rowsPath('research_passages','scope_id,passage_id',{scope_id:`in.(${A},${B})`}),v=>v.length===0)
    await denied('a_private_original_denied',objectPath(A_SOURCE),'reader',true)
    await denied('b_private_original_denied',objectPath(B_SOURCE),'reader',true)
    await denied('anonymous_c_rows_denied',cPassages,'anonymous')
    await denied('anonymous_c_original_denied',objectPath(C_SOURCE),'anonymous',true)
    await denied('forged_service_role_read_denied',cPassages,'forged')
  } catch(error) { stopped_reason=error instanceof ReaderCheckError?error.code:'reader_probe_failed' }
  return {status:checks.length===12&&checks.every(c=>c.passed)&&!stopped_reason?'passed':'failed',checks,stopped_reason,
    observed_at:new Date(now()).toISOString(),project_ref:'icockcoguyadhryzydvl',scope_id:SCOPE,auth_user_id:READER,read_only:true,requests_attempted:requestsAttempted,
    mutations_attempted:0,rpc_execution:'untested_for_c_existing_execute_grant_review_retained',credentials_logged:false}
}
