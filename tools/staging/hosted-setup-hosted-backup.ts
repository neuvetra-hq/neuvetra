/** Root-operated, exact-target transport for the paired application backup. Importing does no I/O. */
import {randomUUID} from 'node:crypto'
import {readFile,realpath} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {createPostgresConnection} from '../../packages/neuvetra-database/src/hosted'
import {loadStagingDatabaseCa} from '../../packages/neuvetra-database/src/staging-tls'
import {createHostedSetupBackup} from './hosted-setup-backup'
import {pinnedTool} from './hosted-setup-restore-io'
import {PROJECT,requireRecovery,sha,type Actor} from './hosted-setup-restore-core'

const EXPORT_PATH='C:\\Users\\nimab\\Neuvetra\\env.json.txt'
const RECOVERY_ROOT='C:\\Users\\nimab\\Neuvetra\\m63-runtime\\recovery'
const DUMP_PATH='C:\\Users\\nimab\\Neuvetra\\m63-runtime\\pgsql\\bin\\pg_dump.exe'
const DUMP_SHA256='e856d19e6b73f351069d2d3d9f442e8c0371bebfc53c7e55b455adfc0b8ee14b'
const CA_PATH='tools/cloud/fixtures/supabase-prod-ca-2021.crt'
const CA_SHA256='700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7'

/** This export is an operator input, never a runtime environment or a source of instructions. */
export function operatorUrlFromExport(text:string):URL {
  const values:string[]=[]
  for(const line of text.split(/\r?\n/)) {
    const shell=line.match(/^\s*(?:export\s+)?DATABASE_URL\s*=\s*(.*?)\s*$/)
    const json=line.match(/^\s*"DATABASE_URL"\s*:\s*("(?:[^"\\]|\\.)*")\s*,?\s*$/)
    if(shell){
      const raw=shell[1]!
      values.push(raw.startsWith('"')?JSON.parse(raw):raw.startsWith("'")&&raw.endsWith("'")?raw.slice(1,-1):raw)
    } else if(json) values.push(JSON.parse(json[1]!))
  }
  requireRecovery(values.length===1 && typeof values[0]==='string' && values[0]!.length<4096,'HOSTED_EXPORT_REFUSED')
  let url:URL
  try{url=new URL(values[0]!)}catch{throw Error('HS_RECOVERY_HOSTED_URL_REFUSED')}
  requireRecovery(['postgres:','postgresql:'].includes(url.protocol) && url.hostname==='aws-1-us-west-1.pooler.supabase.com' && url.port==='5432' && decodeURIComponent(url.username)===`postgres.${PROJECT}` && url.password.length>0 && url.pathname==='/postgres' && !url.search && !url.hash,'HOSTED_URL_REFUSED')
  return url
}

/** The runtime credential is injected by the already deployed Railway service. */
export function runtimeUrlFromEnvironment(value:string|undefined,operator:URL):URL {
  requireRecovery(typeof value==='string'&&value.length>0&&value.length<4096,'RUNTIME_URL_MISSING')
  let url:URL
  try{url=new URL(value)}catch{throw Error('HS_RECOVERY_RUNTIME_URL_REFUSED')}
  requireRecovery(['postgres:','postgresql:'].includes(url.protocol)
    && url.hostname===operator.hostname && url.port===operator.port
    && decodeURIComponent(url.username)===`neuvetra_runtime.${PROJECT}`
    && url.password.length>0 && url.pathname===operator.pathname && !url.search && !url.hash,
  'RUNTIME_URL_REFUSED')
  return url
}

export function selectSyntheticTenantActors(members:{company_id:string;user_id:string}[],outsider:string):Actor[] {
  requireRecovery(members.length>0,'NO_SYNTHETIC_MEMBER')
  const ids=[...new Set(members.map(row=>row.user_id))]
  requireRecovery(ids.length<=32,'TOO_MANY_TENANT_PROBES')
  const actors=ids.map(id=>({id,companies:[...new Set(members.filter(row=>row.user_id===id).map(row=>row.company_id))].sort()}))
  const companies=[...new Set(members.map(row=>row.company_id))]
  // With multiple tenants, require an authenticated actor that must be denied each other tenant.
  if(companies.length>1)requireRecovery(companies.every(id=>actors.some(actor=>actor.companies.length===1&&actor.companies[0]===id)),'CROSS_COMPANY_DENIAL_PROBE_MISSING')
  requireRecovery(!ids.includes(outsider),'OUTSIDER_IS_MEMBER')
  actors.push({id:outsider,companies:[]})
  return actors
}

async function actorsForCurrentSyntheticCompanies(source:ReturnType<typeof createPostgresConnection>):Promise<Actor[]> {
  const members=(await source.query<{company_id:string;user_id:string}>("select company_id::text,user_id::text from neuvetra.company_members order by company_id,user_id")).rows
  let outsider:string
  do{outsider=randomUUID()}while((await source.query<{present:boolean}>('select exists(select 1 from auth.users where id=$1) present',[outsider])).rows[0]?.present)
  return selectSyntheticTenantActors(members,outsider)
}

/** The dump is cancelled and reaped before the shared snapshot is released. */
export async function boundedDump(command:string[],env:Record<string,string|undefined>,deadlineMs=20_000,signal?:AbortSignal,cancelRef?:{cancel:()=>Promise<void>}):Promise<Buffer>{
  requireRecovery(Number.isInteger(deadlineMs)&&deadlineMs>0&&deadlineMs<=20_000,'DUMP_DEADLINE_REFUSED')
  requireRecovery(!signal?.aborted,'DUMP_CANCELLED')
  const proc=Bun.spawn(command,{env,stdin:'ignore',stdout:'pipe',stderr:'pipe'})
  let timedOut=false
  let cancelled=false
  const cancel=async()=>{cancelled=true;proc.kill();await proc.exited}
  if(cancelRef)cancelRef.cancel=cancel
  const onAbort=()=>{void cancel().catch(()=>{})}
  signal?.addEventListener('abort',onAbort,{once:true})
  if(signal?.aborted)onAbort()
  const timer=setTimeout(()=>{timedOut=true;void cancel().catch(()=>{})},deadlineMs)
  try{
    const [output,,exitCode]=await Promise.all([new Response(proc.stdout).arrayBuffer(),new Response(proc.stderr).arrayBuffer(),proc.exited])
    requireRecovery(!timedOut&&!cancelled&&!signal?.aborted&&exitCode===0,'DUMP_FAILED_OR_TIMED_OUT')
    const bytes=Buffer.from(output)
    requireRecovery(bytes.length>=16&&bytes.length<=128*1024*1024,'DUMP_SIZE_REFUSED')
    return bytes
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',onAbort);if(timedOut||cancelled||signal?.aborted){proc.kill();await proc.exited}}
}

/** Only this fixed Supabase project, CA, pg_dump binary and private recovery directory are eligible. */
export async function runExactHostedSetupBackup(){
  requireRecovery(await realpath(EXPORT_PATH)===EXPORT_PATH && await realpath(RECOVERY_ROOT)===RECOVERY_ROOT,'PRIVATE_PATH_REFUSED')
  const ca=resolve(CA_PATH)
  requireRecovery(sha(await readFile(ca))===CA_SHA256,'CA_PIN_CHANGED')
  const tlsCaPem=await loadStagingDatabaseCa({caFile:ca})
  requireRecovery(typeof tlsCaPem==='string','CA_REQUIRED')
  const dumpTool=await pinnedTool(DUMP_PATH,DUMP_SHA256,'pg_dump.exe')
  const url=operatorUrlFromExport(await readFile(EXPORT_PATH,'utf8'))
  const runtimeUrl=runtimeUrlFromEnvironment(process.env.DATABASE_URL,url)
  const source=createPostgresConnection(url.toString(),{maxConnections:1,tlsCaPem})
  const runtimeConnection=createPostgresConnection(runtimeUrl.toString(),{maxConnections:1,tlsCaPem})
  const activeDump:{cancel:()=>Promise<void>}={cancel:async()=>{}}
  try{
    const actors=await actorsForCurrentSyntheticCompanies(source)
    const stamp=new Date().toISOString().replace(/[-:.]/g,'').replace('T','T').replace('Z','Z')
    const prefix=join(RECOVERY_ROOT,`hosted-setup-${stamp}-${randomUUID().slice(0,8)}`)
    const archivePath=prefix+'.snapshot.dpapi',receiptPath=prefix+'.receipt.json'
    const dump=async(snapshotToken:string,signal?:AbortSignal)=>{
      requireRecovery(/^[0-9A-Fa-f-]{8,64}$/.test(snapshotToken),'SNAPSHOT_TOKEN_REFUSED')
      const env={PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,TEMP:process.env.TEMP,TMP:process.env.TMP,PGHOST:url.hostname,PGPORT:url.port,PGDATABASE:'postgres',PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),PGSSLMODE:'verify-full',PGSSLROOTCERT:ca,PGCONNECT_TIMEOUT:'15'}
      return boundedDump([dumpTool,'--format=custom','--no-password','--schema=neuvetra',`--snapshot=${snapshotToken}`],env,20_000,signal,activeDump)
    }
    const receipt=await createHostedSetupBackup({source,runtimeConnection,expectedDatabase:'postgres',sourceMode:'hosted',actors,archivePath,receiptPath,dump,cancelDump:()=>activeDump.cancel()})
    return {status:'paired-hosted-backup-created',archivePath,receiptPath,receiptSha256:sha(await readFile(receiptPath)),...receipt}
  }finally{await Promise.allSettled([source.close(),runtimeConnection.close()])}
}

if(import.meta.main){try{console.log(JSON.stringify(await runExactHostedSetupBackup()))}catch{console.error(JSON.stringify({status:'paired-hosted-backup-failed',code:'HS_RECOVERY_HOSTED_TRANSPORT_FAILED_RECONCILE_BEFORE_RETRY'}));process.exitCode=1}}
