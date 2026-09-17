/** Bounded synthetic M78 replay. Actual routes + browser decoders; never overrides global fetch. */
import {HostedWorkspaceDatabase} from '../../packages/neuvetra-database/src/hosted'
import type {M78Authorities,M78Policy} from '../../packages/neuvetra-database/src/m78-contract'
import {createM78Routes} from '../../apps/site-api/src/workspace/m78-routes'
import {decodeScope1Register,decodeScope1Version,decodeScope1Report} from '../../apps/site-web/src/lib/m78-api'
import {connectLocal,canonicalReceipts,inventory,content,sameExactInventory,check,hash,NEW_TABLES,PROJECT} from './m78-inventory'
export async function replayLocalM78(name:string,companyId:string,actorId:string,authorities:M78Authorities,policy:M78Policy){
 check([companyId,actorId].every(s=>/^[a-f0-9-]{36}$/.test(s)))
 const admin=connectLocal(name),runtime=connectLocal(name,55472,'neuvetra_runtime'),database=new(HostedWorkspaceDatabase as any)(runtime,PROJECT)
 try{
  await canonicalReceipts(admin,21);const before=await admin.transaction(tx=>inventory(tx)),beforeContent=await admin.transaction(tx=>content(tx,21))
  const actor=(await admin.query("select m.role from neuvetra.company_members m join neuvetra.staging_access a on a.company_id=m.company_id and a.user_id=m.user_id where m.company_id=$1 and m.user_id=$2 and a.active",[companyId,actorId])).rows;check(actor.length===1,'Existing synthetic actor required')
  const versions=(await admin.query<{id:string;stream_id:string;family:string;export_text:string;proof:unknown}>('select id,stream_id,family,export_text,proof from neuvetra.scope1_versions where company_id=$1 order by family,version',[companyId])).rows
  const reports=(await admin.query<{id:string;stream_id:string;family:string;payload:{html:string;snapshotJson:string}}>('select id,stream_id,family,payload from neuvetra.scope1_reports where company_id=$1 order by id',[companyId])).rows
  check(versions.length>=2&&versions.length<=12&&new Set(versions.map(v=>v.family)).size===2&&reports.length>=2&&reports.length<=12,'Bounded occupied two-family fixture required')
  const route=createM78Routes({database,origin:'https://m78-local.invalid',validateUser:async token=>token==='synthetic-operator-fixture'?{id:actorId} as any:null,authorities,policy})
  let requests=0,statementDownloads=0,proofReads=0,reportDownloads=0,versionExports=0
  const get=async(path:string)=>{requests++;const response=await route(new Request('https://m78-local.invalid/workspace/'+companyId+'/'+path,{headers:{authorization:'Bearer synthetic-operator-fixture'}}));check(response.status===200&&response.headers.get('cache-control')==='no-store','Runtime GET refused or cache unsafe');return response}
  const exact=async(path:string,expected:string)=>{check(await(await get(path)).text()===expected,'Retained download bytes differ')}
  const reg=await decodeScope1Register(await(await get('scope1-inventory')).json(),companyId)
  check(reg.process.versions.length+reg.inventory.versions.length===versions.length,'Version coverage mismatch')
  for(const v of versions){const base=(v.family==='process_screen'?'process-screen':'scope1-inventory')+'/'+v.stream_id+'/versions/'+v.id
   const decoded=await decodeScope1Version(await(await get(base)).json(),companyId);check(decoded.version.id===v.id&&hash(decoded.proof)===hash(v.proof),'Exact historical proof differs')
   await exact(base+'/inventory-export',v.export_text);versionExports++
   check(hash(await(await get(base+'/proof')).json())===hash(v.proof));proofReads++
   for(const s of decoded.version.statements){await exact((v.family==='process_screen'?'process-screen':'scope1-inventory')+'/'+v.stream_id+'/statements/'+s.id+'/download',s.text);statementDownloads++}
  }
  for(const r of reports){const base=(r.family==='process_screen'?'process-screen':'scope1-inventory')+'/'+r.stream_id+'/reports/'+r.id
   const decoded=await decodeScope1Report(await(await get(base)).json(),companyId);check(decoded.html===r.payload.html&&decoded.snapshotJson===r.payload.snapshotJson)
   await exact(base+'/download',r.payload.html);await exact(base+'/snapshot',r.payload.snapshotJson);reportDownloads+=2
   check(hash(await(await get(base+'/proof')).json())===hash(JSON.parse(r.payload.snapshotJson).proof));proofReads++
  }
  for(const table of NEW_TABLES)check((await runtime.query(`select 1 from neuvetra.${table} limit 1`)).rows.length===0,'No-claim runtime access')
  sameExactInventory(before,await admin.transaction(tx=>inventory(tx)))
  return {status:'m78_local_replay_passed',database:name,companyId,schemaVersion:21,versions:versions.length,reports:reports.length,requests,versionExports,statementDownloads,reportDownloads,proofReads,allM78FixtureVersionsAndReportsVerified:true,legacyExactContentManifest:beforeContent,legacyFullSemanticReplay:false,noMutationVerified:true,noClaimDenied:true,actualBrowserRendering:false,actualFrontendFetchTransport:false}
 }finally{await runtime.close();await admin.close()}
}
