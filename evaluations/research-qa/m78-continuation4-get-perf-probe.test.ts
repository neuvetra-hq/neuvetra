import {describe,expect,test} from 'bun:test'
import {readFile} from 'node:fs/promises'
import {createM78RoutesBaseline as createM78Routes,type M78RouteDatabase} from '../../apps/site-api/src/workspace/m78-get-route-baseline-fixture'
import {assertProbeSqlAllowed,createCountingDatabase,GET_PERF_COMPANY,GET_PERF_ORIGIN,M78_GET_SQL_SOURCE_PIN_COUNT,M78_GET_SQL_TEMPLATE_COUNT,runCurrentRouteCountProbe,verifyM78GetSqlSourcePins} from './m78-continuation4-get-perf-probe'
import {m78FixtureAuthorities} from '../../tools/staging/m78-backend-fixture'
import {M78_REVIEWED_POLICY} from '../../packages/neuvetra-database/src/m78-policy'

const stream='10000000-0000-4000-8000-000000000001',reportId='20000000-0000-4000-8000-000000000001',versionId='30000000-0000-4000-8000-000000000001',user='40000000-0000-4000-8000-000000000001'
const report:any={profile:'synthetic-scope1-report-v1',id:reportId,companyId:GET_PERF_COMPANY,streamId:stream,family:'inventory',versionId,versionSha256:'a'.repeat(64),decisionId:null,decisionSha256:null,reconciliationSha256:'b'.repeat(64),snapshotJson:'{"exact":true}',snapshotSha256:'c'.repeat(64),html:'<p>exact retained</p>',htmlSha256:'d'.repeat(64),reportSha256:'e'.repeat(64),rendererVersion:'m78-retained-report-v1',createdBy:user,createdAt:'2026-09-22T00:00:00.000Z'}
const register:any={inventory:{streamId:stream,versions:[],reports:[report]},process:{streamId:'50000000-0000-4000-8000-000000000001',versions:[],reports:[]}}
const database=(overrides:Partial<M78RouteDatabase>={}):M78RouteDatabase=>({hasStagingAccess:async()=>true,canManageWorkspace:async()=>false,findScope1:async()=>register,findScope1Version:async()=>null,findScope1Report:async()=>report,saveProcessScreen:async()=>{throw Error('write')},saveScope1Inventory:async()=>{throw Error('write')},reviewScope1Version:async()=>{throw Error('write')},createScope1Report:async()=>{throw Error('write')},...overrides})

describe('continuation4 current GET route structure',()=>{
 test('finite SQL templates cover the pinned hosted GET call chain and require exact read flags',async()=>{
  expect(M78_GET_SQL_TEMPLATE_COUNT).toBe(20);expect(M78_GET_SQL_SOURCE_PIN_COUNT).toBe(10);expect(await verifyM78GetSqlSourcePins()).toBeTrue()
  for(const [sql,values] of [
   ['set local role authenticated',[]],
   ["select set_config('request.jwt.claim.sub', $1, true)",[user]],
   ["select set_config('request.jwt.claim.sub',$1,true)",[user]],
   ['select neuvetra.has_staging_access() allowed',[]],
   ['select neuvetra.m71_lock($1,false) allowed',[GET_PERF_COMPANY]],
   ['select neuvetra.m73_lock($1,false) allowed',[GET_PERF_COMPANY]],
   ['select neuvetra.m74_lock($1,false) allowed',[GET_PERF_COMPANY]],
   ['select neuvetra.m75_lock($1,$2) allowed',[GET_PERF_COMPANY,false]],
   ['select neuvetra.m76_lock($1,$2) allowed',[GET_PERF_COMPANY,false]],
   ['select neuvetra.m76_diesel_lock($1,false) allowed',[GET_PERF_COMPANY]],
   ['select neuvetra.m77_lock($1,$2) allowed',[GET_PERF_COMPANY,false]],
   ['select neuvetra.m78_lock($1,$2)allowed',[GET_PERF_COMPANY,false]],
  ] as [string,unknown[]][])expect(assertProbeSqlAllowed(sql,values)).toBeTrue()
  for(const [sql,values] of [
   ['insert into x values(1)',[]],['update x set y=1',[]],['delete from x',[]],['create table x(y int)',[]],
   ['select neuvetra.save_scope1_version($1)',[GET_PERF_COMPANY]],
   ['select neuvetra.some_mutator(coalesce(1, 2))',[]],
   ['select neuvetra.m78_lock($1, coalesce($2,false))',[GET_PERF_COMPANY,true]],
   ['select $1::neuvetra.side_effect_type',[GET_PERF_COMPANY]],
   ['select neuvetra."some_mutator"()',[]],
   ['with changed as (update x set y=1 returning *) select * from changed',[]],
   ["select pg_catalog.set_config('x','y',false)",[]],
   ['set search_path=public',[]],
   ['select * from x; select neuvetra.m78_lock($1,false)',[GET_PERF_COMPANY]],
   ['select neuvetra.m78_lock($1,$2)allowed',[GET_PERF_COMPANY,true]],
   ['select neuvetra.m75_lock($1,$2) allowed',[GET_PERF_COMPANY,true]],
   ["select set_config('request.jwt.claim.sub',$1,true)",[]],
   ["select set_config('request.jwt.claim.sub',$1,true)",['']],
   ['select neuvetra.has_staging_access() allowed',[user]],
  ] as [string,unknown[]][])expect(()=>assertProbeSqlAllowed(sql,values)).toThrow()
 })
 test('metadata, download and snapshot each execute root plus report reads with exact bytes',async()=>{
  const rows=await runCurrentRouteCountProbe({database:database(),userId:user,companyId:GET_PERF_COMPANY,streamId:stream,reportId})
  expect(rows.map(row=>({operation:row.operation,status:row.status,calls:row.calls}))).toEqual([
   {operation:'metadata',status:200,calls:{findScope1:1,findScope1Version:0,findScope1Report:1}},
   {operation:'download',status:200,calls:{findScope1:1,findScope1Version:0,findScope1Report:1}},
   {operation:'snapshot',status:200,calls:{findScope1:1,findScope1Version:0,findScope1Report:1}},
  ])
  expect(rows[1]!.bytes).toBe(Buffer.byteLength(report.html));expect(rows[2]!.bytes).toBe(Buffer.byteLength(report.snapshotJson))
 })
 test('authentication, stream, family and read failures preserve refusal ordering without writes',async()=>{
  let writes=0;const counted=createCountingDatabase(database({findScope1Report:async()=>({...report,family:'process_screen'}),createScope1Report:async()=>{writes++;return report}})),route=createM78Routes({database:counted.database,origin:GET_PERF_ORIGIN,authorities:m78FixtureAuthorities(),policy:M78_REVIEWED_POLICY,validateUser:async token=>token==='ok'?{id:user,email:null,phone:null,fullName:null}:null})
  const call=(path:string,token='ok')=>route(new Request(GET_PERF_ORIGIN+'/workspace/'+GET_PERF_COMPANY+path,{headers:token?{authorization:'Bearer '+token}:{}}))
  expect((await call('/scope1-inventory/'+stream+'/reports/'+reportId,'')).status).toBe(401)
  expect((await call('/scope1-inventory/60000000-0000-4000-8000-000000000001/reports/'+reportId)).status).toBe(404)
  expect((await call('/scope1-inventory/'+stream+'/reports/'+reportId)).status).toBe(404)
  const failing=createM78Routes({database:database({findScope1:async()=>{throw Error('corrupt')}}),origin:GET_PERF_ORIGIN,authorities:m78FixtureAuthorities(),policy:M78_REVIEWED_POLICY,validateUser:async()=>({id:user,email:null,phone:null,fullName:null})})
  expect((await failing(new Request(GET_PERF_ORIGIN+'/workspace/'+GET_PERF_COMPANY+'/scope1-inventory/'+stream+'/reports/'+reportId,{headers:{authorization:'Bearer ok'}}))).status).toBe(503)
  expect(writes).toBe(0)
 })
})

test('historical candidate1 result proves structural duplication and exact data preservation',async()=>{
 const result=JSON.parse(await readFile('evaluations/research-qa/m78-continuation4-get-perf-result.json','utf8'))
 expect(result.status).toBe('m78_continuation4_get_performance_probe_passed');expect(result.tableCount).toBe(121);expect(result.rowsBeforeSha256).toBe(result.rowsAfterSha256);expect(result.dataPreserved).toBeTrue()
 expect(result.httpPostRequests).toBe(0);expect(result.applicationWrites).toBe(0);expect(result.hostCalls).toBe(0);expect(result.providerSessions).toBe(0);expect(result.sampleCountPerOperation).toBe(1);expect(result.noSlaClaim).toBeTrue()
 expect(result.metrics.map((row:any)=>[row.operation,row.stateReads,row.corporateReads,row.sqlQueries])).toEqual([
  ['direct_findScope1',1,10,42],['direct_findScope1Report',1,10,42],['route_report_metadata',2,20,86],['route_report_download',2,20,86],['route_report_snapshot',2,20,86],
 ])
 expect(result.routeCallCounts.every((row:any)=>row.status===200&&row.calls.findScope1===1&&row.calls.findScope1Report===1&&row.calls.findScope1Version===0)).toBeTrue()
})
