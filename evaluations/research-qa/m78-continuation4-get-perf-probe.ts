/** Read-only local GET performance probe. Never clones, writes, resets, authenticates remotely, or contacts a provider. */
import {createHash} from 'node:crypto'
import {readFile,writeFile} from 'node:fs/promises'
import {createPostgresConnection,HostedWorkspaceDatabase,type WorkspaceConnection} from '../../packages/neuvetra-database/src/index'
import {createM78Routes,type M78RouteDatabase} from '../../apps/site-api/src/workspace/m78-routes'
import {createM78RoutesBaseline} from '../../apps/site-api/src/workspace/m78-get-route-baseline-fixture'
import {m78FixtureAuthorities} from '../../tools/staging/m78-backend-fixture'
import {M78_REVIEWED_POLICY} from '../../packages/neuvetra-database/src/m78-policy'
import {m78CanonicalJson as canonical} from '../../packages/neuvetra-database/src/m78-validation'

export const GET_PERF_DATABASE='m78_ops_continuation_20260922'
export const GET_PERF_COMPANY='8b90c706-1710-494d-b12d-02eef88eacb7'
export const GET_PERF_PROJECT='icockcoguyadhryzydvl'
export const GET_PERF_ORIGIN='http://127.0.0.1:47821'
export const GET_PERF_RESULT='evaluations/research-qa/m78-continuation4-get-perf-result.json'
const sourcePaths=['apps/site-api/src/workspace/m78-routes.ts','packages/neuvetra-database/src/hosted.ts','packages/neuvetra-database/src/m71.ts','packages/neuvetra-database/src/m73.ts','packages/neuvetra-database/src/m74.ts','packages/neuvetra-database/src/m75.ts','packages/neuvetra-database/src/m76.ts','packages/neuvetra-database/src/m76-diesel.ts','packages/neuvetra-database/src/m77.ts','packages/neuvetra-database/src/m78.ts','packages/neuvetra-database/src/workspace.ts','evaluations/research-qa/m78-continuation4-get-perf-probe.ts'] as const

const sha=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex')
const check:(value:unknown,message:string)=>asserts value=(value,message)=>{if(!value)throw Error(message)}
const same=(left:unknown,right:unknown)=>canonical(left)===canonical(right)
type Metric={operation:string;sampleCount:1;transactions:number;sqlQueries:number;stateReads:number;corporateReads:number;sqlMs:number;totalMs:number;responseBytes:number;responseSha256:string;status:number|null}
type MutableMetric=Omit<Metric,'sqlMs'|'totalMs'>&{sqlMs:number;totalMs:number}

const M78_GET_SQL_SOURCE_PINS=Object.freeze([
 {path:'packages/neuvetra-database/src/hosted.ts',sha256:'c0b2a7060991985f9618c606157c3dff0ef000da5e173c21cf95c3d1768b5c01'},
 {path:'packages/neuvetra-database/src/m71.ts',sha256:'e0a1aa8cd01809af115057e46e9911d47ff801c93902ec59aa5bb21852f42385'},
 {path:'packages/neuvetra-database/src/m73.ts',sha256:'207482cc8bfb59b524c8d725b3c14e7592aaa2965fa450e16d88dbb630e1b8fe'},
 {path:'packages/neuvetra-database/src/m74.ts',sha256:'494eb69227a8d18ac5068fcc5225daab1edbc88979fa3694f3f89981898bced9'},
 {path:'packages/neuvetra-database/src/m75.ts',sha256:'541ce11c6dcdfcf5c753173f7d56f68c70ef08eb71981921b7dae09b9cd261e1'},
 {path:'packages/neuvetra-database/src/m76.ts',sha256:'5656449d6f09b1a7d701f6c0d3e4f50cdc1c09fb4e58cbc76c3f6f771f5cad65'},
 {path:'packages/neuvetra-database/src/m76-diesel.ts',sha256:'98dd220d75a46de954d3de7e1b1fda2622afb5a84f18727ad73a43b1dcd95ea0'},
 {path:'packages/neuvetra-database/src/m77.ts',sha256:'ff26595de2d9535810c4ebcf11cb9dc8782bd648e42dc4d79ef965ab2f518ed6'},
 {path:'packages/neuvetra-database/src/m78.ts',sha256:'d492c23983b174662acb8728db88cb590a7446b6e5ec5e1a0a9a99e27ac0bf52'},
 {path:'packages/neuvetra-database/src/workspace.ts',sha256:'fbba5693a8ad1447c470309db4c46dcababa2f51c169d0535dc4a83417bcac7e'},
] as const)
type ExactTemplate={site:string;arity:number;writingFlagIndex?:number;actorIdIndex?:number}
const M78_GET_SQL_TEMPLATES=new Map<string,ExactTemplate>([
 ['8375349348909e01b88d8b528eb5b155c14c7c37ca6ef4bd37492ad22500a79c',{site:'workspace role setter',arity:0}],
 ['e88e2adeda02c40dee3bd109eb0f8049dc99f01a1978e1283f5d4f66607a6be6',{site:'workspace actor setter',arity:1,actorIdIndex:0}],
 ['2de480b59b0a5dc6a9ed9ef1d6893a9e4057721650c7f465ca0c9d5fdefadf72',{site:'hosted actor setter',arity:1,actorIdIndex:0}],
 ['722366b2cc2af0dfa2025bf62efa8beec527c43f7119b2abd10418069a29e304',{site:'hosted staging access read',arity:0}],
 ['dc85a820b0a0ef2bd1ad78596c8098545d827fbeede0b11023308763b6ef3a77',{site:'m71 read lock',arity:1}],
 ['e5c410e9401c6936b3ae54507aa1304d9eb037835238fde7c6935191ad0ba2fb',{site:'m71 register read',arity:1}],
 ['cbd06eee6f1981cd86a3e0b8172c89c189b6c3cfa48e07a6e71bd52d4d391fac',{site:'m73 read lock',arity:1}],
 ['a9a415ee7b39847adc6190f60694fd07535271c92ebab4397d0361a2d99eb8f6',{site:'m73 register read',arity:1}],
 ['d7ff18b86256edea2ae752b8df2ca31fafd4b362698ea6279e4cad1d75df8a7a',{site:'m74 read lock',arity:1}],
 ['3692a31fd171105fc80a1ec0bf1dabceb011507dbd9ae7324c9d33cd31fc1830',{site:'m74 register read',arity:1}],
 ['2a1d2831436701008bc731424970b2ed722a0ad5f148f33039699c905eaaac82',{site:'m75 read lock',arity:2,writingFlagIndex:1}],
 ['6091fea6a06dcb38596ffa9ded112cb3da43c0ba73ff1b64f40ad1950961dcf2',{site:'m75 register read',arity:1}],
 ['154aa333fe28cf00350f66714ee8aa79646f6ed62b3e8d57a60c6c13919791a6',{site:'m76 read lock',arity:2,writingFlagIndex:1}],
 ['ffe34f2943a5462eb451fe14fe95e83067bd7d42617a6dc1b8bae8594ac84eb0',{site:'m76 register read',arity:1}],
 ['5e554d346a207e463c7e5b0c4ccb09cbd2592fef9f6bcb6efdd4d816e9bb88a3',{site:'m76 diesel read lock',arity:1}],
 ['fe6303d16199742c485b738f21c65afe97dbd8def7827b3d8cbeb524f2676eb8',{site:'m76 diesel register read',arity:1}],
 ['61c8c059d842be53dd1c7b350cb238bbe72d08cd9ebb059ddff7c895224834df',{site:'m77 read lock',arity:2,writingFlagIndex:1}],
 ['08d4fdc4925db618d5e3824fe89c197ea0ffdbac76ec9a3a30bbd119406555e9',{site:'m77 register read',arity:1}],
 ['cdee9da1741641e2f44d5123a8e0d04f0cbc31a64f7d6d47fa7eed944ea30b75',{site:'m78 read lock',arity:2,writingFlagIndex:1}],
 ['5ef258151eefe7be1c29bacf687a23055001e86f4f7648954dccb6fa0e693665',{site:'m78 state read',arity:1}],
])
export const M78_GET_SQL_TEMPLATE_COUNT=20;
export const M78_GET_SQL_SOURCE_PIN_COUNT=10;
const normalizeSql=(sql:string)=>sql.replace(/\s+/g,' ').trim()
export function assertProbeSqlAllowed(sql:string,values:unknown[]=[]){const digest=sha(normalizeSql(sql)),template=M78_GET_SQL_TEMPLATES.get(digest);check(template,'SQL template is not one of the 20 pinned GET templates');check(values.length===template.arity,'Exact SQL parameter arity required for '+template.site);if(template.writingFlagIndex!==undefined)check(values[template.writingFlagIndex]===false,'Exact writing=false required for '+template.site);if(template.actorIdIndex!==undefined)check(typeof values[template.actorIdIndex]==='string'&&Boolean((values[template.actorIdIndex] as string).length),'Exact actor id required for '+template.site);return true}
export async function verifyM78GetSqlSourcePins(){for(const pin of M78_GET_SQL_SOURCE_PINS)check(sha(await readFile(pin.path))===pin.sha256,'Changed GET SQL source '+pin.path);return true}

async function tableDigests(connection:WorkspaceConnection){
 return connection.transaction(async tx=>{
  await tx.exec('set transaction isolation level repeatable read read only')
  const names=(await tx.query<{name:string}>("select table_name name from information_schema.tables where table_schema='neuvetra' and table_type='BASE TABLE' order by table_name")).rows.map(row=>row.name)
  const tables=[] as {table:string;count:number;sha256:string}[]
  for(const name of names){
   check(/^[a-z0-9_]+$/.test(name),'Unsafe table name')
   const rows=(await tx.query<{row:string}>(`select neuvetra.m67_canonical(to_jsonb(t)) row from neuvetra.${name} t order by neuvetra.m67_canonical(to_jsonb(t)) collate "C"`)).rows.map(row=>row.row)
   tables.push({table:name,count:rows.length,sha256:sha(rows.join('\n'))})
  }
  return {tableCount:tables.length,sha256:sha(canonical(tables)),tables}
 })
}

export function createCountingDatabase(database:M78RouteDatabase){
 const calls={findScope1:0,findScope1Version:0,findScope1Report:0}
 return {calls,database:{...database,
  findScope1:async(userId,companyId,authorities,policy)=>{calls.findScope1++;return database.findScope1(userId,companyId,authorities,policy)},
  findScope1Version:async(userId,companyId,streamId,versionId,authorities,policy)=>{calls.findScope1Version++;return database.findScope1Version(userId,companyId,streamId,versionId,authorities,policy)},
  findScope1Report:async(userId,companyId,streamId,reportId,authorities,policy)=>{calls.findScope1Report++;return database.findScope1Report(userId,companyId,streamId,reportId,authorities,policy)},
 } satisfies M78RouteDatabase}
}

export async function runCurrentRouteCountProbe(input:{database:M78RouteDatabase;userId:string;companyId:string;streamId:string;reportId:string}){
 const counted=createCountingDatabase(input.database),route=createM78RoutesBaseline({database:counted.database,origin:GET_PERF_ORIGIN,authorities:m78FixtureAuthorities(),policy:M78_REVIEWED_POLICY,validateUser:async token=>token==='local-read-only'?{id:input.userId,email:null,phone:null,fullName:null}:null})
 const results=[] as {operation:string;status:number;bytes:number;sha256:string;calls:{findScope1:number;findScope1Version:number;findScope1Report:number}}[]
 for(const [operation,suffix] of [['metadata',''],['download','/download'],['snapshot','/snapshot']] as const){
  Object.assign(counted.calls,{findScope1:0,findScope1Version:0,findScope1Report:0})
  const response=await route(new Request(`${GET_PERF_ORIGIN}/workspace/${input.companyId}/scope1-inventory/${input.streamId}/reports/${input.reportId}${suffix}`,{headers:{authorization:'Bearer local-read-only'}})),bytes=new Uint8Array(await response.arrayBuffer())
  results.push({operation,status:response.status,bytes:bytes.byteLength,sha256:sha(bytes),calls:{...counted.calls}})
 }
 return results
}

export async function runGetPerformanceProbe(){
 const admin=createPostgresConnection(`postgres://supabase_admin@127.0.0.1:55472/${GET_PERF_DATABASE}`,{tls:false,maxConnections:1})
 const runtime=createPostgresConnection(`postgres://neuvetra_runtime@127.0.0.1:55472/${GET_PERF_DATABASE}`,{tls:false,maxConnections:1})
 let active:MutableMetric|null=null
 try{
  await admin.exec('set default_transaction_read_only=on')
  await verifyM78GetSqlSourcePins();const before=await tableDigests(admin);check(before.tableCount===121,'Expected exact 121-table database')
  const wrapped={...runtime,transaction:async(fn:any)=>runtime.transaction(async tx=>{
   if(active)active.transactions++
   const proxy={...tx,
    exec:async(sql:string)=>{assertProbeSqlAllowed(sql);return tx.exec(sql)},
    query:async(sql:string,values?:unknown[])=>{assertProbeSqlAllowed(sql,values);if(active){active.sqlQueries++;if(sql.includes('from neuvetra.scope1_heads x'))active.stateReads++;if(sql.includes('jsonb_agg(h) from neuvetra.corporate_inventory_heads'))active.corporateReads++}const start=performance.now();const result=await tx.query(sql,values);if(active)active.sqlMs+=performance.now()-start;return result}}
   return fn(proxy)
  })} as WorkspaceConnection
  const db=new(HostedWorkspaceDatabase as any)(wrapped,GET_PERF_PROJECT) as HostedWorkspaceDatabase
  const member=(await admin.transaction(async tx=>{await tx.exec('set transaction isolation level repeatable read read only');return (await tx.query<{user_id:string}>('select user_id from neuvetra.company_members where company_id=$1 order by role::text,user_id limit 1',[GET_PERF_COMPANY])).rows[0]?.user_id}))
  check(member,'Missing local member')
  const metrics:Metric[]=[]
  const measure=async<T>(operation:string,call:()=>Promise<T>,encode:(value:T)=>Promise<{bytes:Uint8Array;status:number|null}>)=>{
   const row:MutableMetric={operation,sampleCount:1,transactions:0,sqlQueries:0,stateReads:0,corporateReads:0,sqlMs:0,totalMs:0,responseBytes:0,responseSha256:'',status:null};active=row;const start=performance.now()
   try{const value=await call(),encoded=await encode(value);row.totalMs=performance.now()-start;row.responseBytes=encoded.bytes.byteLength;row.responseSha256=sha(encoded.bytes);row.status=encoded.status;metrics.push({...row});return value}finally{active=null}
  }
  const objectBytes=async(value:unknown)=>({bytes:new TextEncoder().encode(canonical(value)),status:null})
  const register=await measure('direct_findScope1',()=>db.findScope1(member,GET_PERF_COMPANY,m78FixtureAuthorities(),M78_REVIEWED_POLICY),objectBytes)
  check(register,'Missing Scope 1 register');const reportMeta=register.inventory.reports.at(-1);check(reportMeta,'Missing final inventory report')
  const report=await measure('direct_findScope1Report',()=>db.findScope1Report(member,GET_PERF_COMPANY,reportMeta.streamId,reportMeta.id,m78FixtureAuthorities(),M78_REVIEWED_POLICY),objectBytes)
  check(report&&report.family==='inventory','Missing exact final inventory report')
  const route=createM78Routes({database:db,origin:GET_PERF_ORIGIN,authorities:m78FixtureAuthorities(),policy:M78_REVIEWED_POLICY,validateUser:async token=>token==='local-read-only'?{id:member,email:null,phone:null,fullName:null}:null})
  const routeRead=async(operation:string,suffix:string)=>measure(operation,()=>route(new Request(`${GET_PERF_ORIGIN}/workspace/${GET_PERF_COMPANY}/scope1-inventory/${reportMeta.streamId}/reports/${reportMeta.id}${suffix}`,{headers:{authorization:'Bearer local-read-only'}})),async response=>({bytes:new Uint8Array(await response.clone().arrayBuffer()),status:response.status}))
  const metadata=await routeRead('route_report_metadata',''),download=await routeRead('route_report_download','/download'),snapshot=await routeRead('route_report_snapshot','/snapshot')
  check(metadata.status===200&&download.status===200&&snapshot.status===200,'Current report route failed')
  check(same(await metadata.json(),report),'Metadata body changed');check(sha(new Uint8Array(await download.arrayBuffer()))===sha(report.html),'HTML bytes changed');check(sha(new Uint8Array(await snapshot.arrayBuffer()))===sha(report.snapshotJson),'Snapshot bytes changed')
  const counts=await runCurrentRouteCountProbe({database:db,userId:member,companyId:GET_PERF_COMPANY,streamId:reportMeta.streamId,reportId:reportMeta.id})
  for(const item of counts)check(item.status===200&&item.calls.findScope1===1&&item.calls.findScope1Report===1&&item.calls.findScope1Version===0,'Current route structural count changed: '+item.operation)
  const after=await tableDigests(admin);check(same(before,after),'Read-only probe changed database rows')
  const sourcePins=[] as {path:string;sha256:string}[];for(const path of sourcePaths)sourcePins.push({path,sha256:sha(await readFile(path))})
  return {status:'m78_continuation4_get_performance_probe_passed',createdAt:new Date().toISOString(),database:GET_PERF_DATABASE,companyId:GET_PERF_COMPANY,productionGetTransactionsUseSharedReadLocks:true,sqlAdapterAllowlist:'SELECT/SET only; writer statements/functions refused; native locks require writing=false',digestTransactionsReadOnly:true,sampleCountPerOperation:1,noSlaClaim:true,hostCalls:0,providerSessions:0,httpPostRequests:0,applicationWrites:0,tableCount:before.tableCount,rowsBeforeSha256:before.sha256,rowsAfterSha256:after.sha256,dataPreserved:same(before,after),exactReport:{family:report.family,streamId:report.streamId,id:report.id,versionId:report.versionId,htmlBytes:Buffer.byteLength(report.html),htmlSha256:sha(report.html),snapshotBytes:Buffer.byteLength(report.snapshotJson),snapshotSha256:sha(report.snapshotJson)},metrics,routeCallCounts:counts,sourcePins,interpretation:'The current report metadata, download, and snapshot routes each perform one root findScope1 plus one specific findScope1Report. This structural duplication is demonstrated locally; timings do not establish the complete hosted cause.',candidateImplemented:false,source173Changed:false}
 }finally{await runtime.close();await admin.close()}
}

if(import.meta.main){
 const result=await runGetPerformanceProbe(),text=JSON.stringify(result,null,2)+'\n'
 if(process.argv.includes('--write-result'))await writeFile(GET_PERF_RESULT,text,{flag:'wx'})
 console.log(text)
}
