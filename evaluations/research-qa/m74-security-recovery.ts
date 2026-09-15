/** Independent reviewer. Local synthetic reads and new m74_security_* clones only. */
import {createHash} from 'node:crypto'
import {mkdir,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {createPostgresConnection,HostedWorkspaceDatabase} from '../../packages/neuvetra-database/src/index'
import {createM73Authority} from '../../apps/site-api/src/calculation/m73-authority'
import {createM74Authority} from '../../apps/site-api/src/calculation/m74-authority'
import {createM73Routes} from '../../apps/site-api/src/workspace/m73-routes'
import {createM74Routes} from '../../apps/site-api/src/workspace/m74-routes'
import {inventory,PROJECT,MIGRATION} from '../../tools/staging/m74-common'
import {createApplicationBundle} from '../../tools/staging/m74-backup'
import {applyExact17} from '../../tools/staging/m74-apply'
export const digest=(v:string|Uint8Array)=>createHash('sha256').update(v).digest('hex')
// Deliberately separate implementation from the operator manifest builder.
export function canonical(v:any):string {if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}'}
export function check(v:unknown,label:string):asserts v {if(!v)throw Error('Independent recovery check: '+label)}
export const connect=(name:string,port=55463,role=port===55472?'supabase_admin':'m63_test_admin')=>createPostgresConnection(`postgres://${role}@127.0.0.1:${port}/${name}`,{tls:false,maxConnections:1})
export async function rebuild(db:any,schemaVersion:16|17){
 const entries:any[]=[];let checks=0
 const add=(table:string,id:string,part:string,content:string|Uint8Array,hash?:string,length?:number)=>{const b=typeof content==='string'?Buffer.from(content,'utf8'):content;const sha256=digest(b);check(hash===undefined||hash===sha256,table+' content hash');check(length===undefined||Number(length)===b.byteLength,table+' byte length');checks+=2;entries.push({table,id,part,sha256,byteLength:b.byteLength})}
 for(const table of ['electricity_sources','worksheet_reports','source_worksheet_reports','annual_electricity_reports','annual_evidence_reports']){
  const source=table==='electricity_sources';for(const r of(await db.query(`select id,encode(${source?'original_bytes':'report_bytes'},'hex') bytes,${source?'sha256':'report_sha256'} hash,${source?'byte_length':'report_byte_length'} size from neuvetra.${table}`)).rows)add(table,r.id,'download',Buffer.from(r.bytes,'hex'),r.hash,r.size)
 }
 const methods=['stationary_gas',...(schemaVersion===17?['mobile_diesel']:[])]
 for(const table of ['stationary_gas_statements',...(schemaVersion===17?['mobile_diesel_fuel_statements','mobile_diesel_mileage_statements']:[])])for(const r of(await db.query(`select * from neuvetra.${table}`)).rows){add(table,r.id,'statement',r.statement_text,r.statement_sha256);add(table,r.id,'metadata',canonical(r.payload))}
 for(const table of ['corporate_inventory_versions',...methods.map(m=>m+'_versions')])for(const r of(await db.query(`select * from neuvetra.${table}`)).rows){add(table,r.id,'export',r.export_text);if(table!=='corporate_inventory_versions'){check(Object.hasOwn(r.payload,'calculation'),'explicit calculation/null');add(table,r.id,'calculation',canonical(r.payload.calculation))}}
 for(const table of methods.map(m=>m+'_reports'))for(const r of(await db.query(`select * from neuvetra.${table}`)).rows){add(table,r.id,'html',r.payload.html,r.payload.htmlSha256,r.payload.htmlByteLength);add(table,r.id,'snapshot',r.payload.snapshotJson,r.payload.snapshotSha256)}
 entries.sort((a,b)=>canonical(a).localeCompare(canonical(b)))
 return {manifest:{profile:'neuvetra.m74.recovery-content.v1',schemaVersion,entries,sha256:digest(canonical(entries))},byteChecks:checks}
}
export async function inspectRecovered(name:string,port=55463){
 const db=connect(name,port),runtime=connect(name,port,'neuvetra_runtime');let downloads=0,gasVersions=0,mobileVersions=0,legacyDownloads=0
 try{
  const schemaVersion=Number((await db.query('select count(*) n from neuvetra.schema_migrations')).rows[0]!.n) as 16|17;check([16,17].includes(schemaVersion),'schema')
  const before=await db.transaction(tx=>inventory(tx)),rebuilt=await db.transaction(tx=>rebuild(tx,schemaVersion));const target=(await db.query('select project_ref from neuvetra.staging_target')).rows[0]!.project_ref as string
  const database=new(HostedWorkspaceDatabase as any)(runtime,target)
  const actors=(await db.query("select distinct on(m.company_id) m.company_id,m.user_id from neuvetra.company_members m join neuvetra.staging_access a on a.company_id=m.company_id and a.user_id=m.user_id where a.active order by m.company_id,case m.role when 'owner' then 0 when 'admin' then 1 else 2 end,m.user_id")).rows
  for(const a of actors){
   for(const mode of ['stationary_gas',...(schemaVersion===17?['mobile_diesel']:[])]){
    const gas=mode==='stationary_gas',authority=gas?createM73Authority():createM74Authority();const reg=await database[gas?'findStationaryGas':'findMobileDiesel'](a.user_id,a.company_id,authority)
    if(!reg)continue
    const route=(gas?createM73Routes:createM74Routes)({database,authority:authority as any,origin:'https://independent.invalid',validateUser:async()=>({id:a.user_id} as any)})
    const base=`/workspace/${a.company_id}/${gas?'stationary-natural-gas':'mobile-diesel'}`
    const exact=async(path:string,expected:string)=>{const r=await route(new Request('https://independent.invalid'+path,{headers:{authorization:'Bearer independent-synthetic'}}));check(r.status===200,'download status');check(Buffer.from(await r.arrayBuffer()).equals(Buffer.from(expected)),'exact runtime download bytes');check(r.headers.get('cache-control')==='no-store','download cache');downloads++}
    for(const w of reg.worksheets){for(const v of w.versions){if(gas)gasVersions++;else mobileVersions++;const raw=(await db.query(`select export_text from neuvetra.${mode}_versions where id=$1`,[v.id])).rows[0]!
     await exact(`${base}/${w.worksheetId}/versions/${v.id}/calculation-export`,raw.export_text as string)
     for(const s of(gas?[v.statement]:[v.fuelStatement,v.mileageStatement]))if(s)await exact(`${base}/${w.worksheetId}/statements/${s.id}/download`,s.text)
    }for(const r of w.reports)await exact(`${base}/${w.worksheetId}/reports/${r.id}/download`,r.html)}
   }
   for(const [table,method]of[['electricity_sources','downloadElectricitySource'],['worksheet_reports','downloadWorksheetReport'],['source_worksheet_reports','downloadSourceWorksheetReport'],['annual_electricity_reports','downloadAnnualWorksheetReport'],['annual_evidence_reports','downloadAnnualEvidenceReport']])for(const row of(await db.query(`select id,encode(${table==='electricity_sources'?'original_bytes':'report_bytes'},'hex') bytes from neuvetra.${table} where company_id=$1`,[a.company_id])).rows){const value=await database[method!](a.user_id,a.company_id,row.id as string);check(value&&Buffer.from(value.bytes).equals(Buffer.from(row.bytes as string,'hex')),'legacy runtime exact bytes '+table);legacyDownloads++}
  }
  const noClaim=await runtime.query('select id from neuvetra.companies');check(noClaim.rows.length===0,'RLS no claim')
  check(canonical(before)===canonical(await db.transaction(tx=>inventory(tx))),'no mutation after replay/downloads')
  const expectedGas=(await db.query('select count(*) n from neuvetra.stationary_gas_versions')).rows[0]!.n;check(gasVersions===Number(expectedGas),'all gas versions replayed')
  if(schemaVersion===17)check(mobileVersions===Number((await db.query('select count(*) n from neuvetra.mobile_diesel_versions')).rows[0]!.n),'all mobile versions replayed')
  const expectedLegacy=(await db.query("select (select count(*) from neuvetra.electricity_sources)+(select count(*) from neuvetra.worksheet_reports)+(select count(*) from neuvetra.source_worksheet_reports)+(select count(*) from neuvetra.annual_electricity_reports)+(select count(*) from neuvetra.annual_evidence_reports) n")).rows[0]!.n;check(legacyDownloads===Number(expectedLegacy),'all legacy downloads')
  return {schemaVersion,recoveryManifest:rebuilt.manifest,byteChecks:rebuilt.byteChecks,gasVersions,mobileVersions,methodDownloads:downloads,legacyDownloads,noMutationVerified:true,runtimeNoClaimDenied:true}
 }finally{await runtime.close();await db.close()}
}
const pg='C:/Users/nimab/Neuvetra/m63-runtime/pgsql/bin/'
export const cleanEnv=(database:string)=>({...Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.toUpperCase().startsWith('PG'))),PGHOST:'127.0.0.1',PGPORT:'55463',PGDATABASE:database,PGUSER:'m63_test_admin',PGSSLMODE:'disable',PGCONNECT_TIMEOUT:'10'})
export async function child(args:string[],input?:Uint8Array|string,env=cleanEnv('postgres')){const p=Bun.spawn(args,{env,stdin:'pipe',stdout:'pipe',stderr:'pipe'});if(input!==undefined)await p.stdin.write(input);await p.stdin.end();const [bytes,error,code]=await Promise.all([new Response(p.stdout).arrayBuffer(),new Response(p.stderr).text(),p.exited]);check(code===0,'local child '+error.slice(0,500));return new Uint8Array(bytes)}
export async function localRehearsal(){
 const stamp=Date.now(),output=resolve(`.tmp/m74-security-${stamp}`);await mkdir(output)
 const results:any[]=[]
 for(const [sourceName,version]of [['m74_ops_restore_1789509587655',16],['m74_ops_restore17_1789509587655',17]] as const){
  const source=connect(sourceName),name=`m74_security_recovery${version}_${stamp}`,receipt=resolve(output,`restore${version}.json`)
  try{const sourceRead=await inspectRecovered(sourceName),bundle=await createApplicationBundle(source,pg+'pg_dump.exe',cleanEnv(sourceName),version);check(canonical(sourceRead.recoveryManifest)===canonical(bundle.recoveryManifest),'independent source manifest agrees')
   await child([process.execPath,'run','tools/staging/m74-restore.ts',pg+'pg_restore.exe',name,receipt,digest(JSON.stringify(bundle)),'55463'],JSON.stringify(bundle))
   const restoredRead=await inspectRecovered(name);check(canonical(sourceRead)===canonical(restoredRead),'independent restored content and runtime replay equal')
   const restored=connect(name);try{check(canonical(await restored.transaction(tx=>inventory(tx)))===canonical(bundle.inventory),'restored full inventory')
    if(version===16){await restored.exec('revoke all on schema public from public, anon, authenticated');let reached=false,rolledBack=false;try{await restored.transaction(async tx=>{await applyExact17(tx,bundle.inventory,bundle.recoveryManifest);reached=true;throw Error('security_expected_rollback')})}catch(e){rolledBack=(e as Error).message==='security_expected_rollback';if(!rolledBack)throw e}check(reached&&rolledBack,'actual migration forced rollback');check(canonical(await restored.transaction(tx=>inventory(tx)))===canonical(bundle.inventory),'rollback exact inventory');await restored.transaction(tx=>applyExact17(tx,bundle.inventory,bundle.recoveryManifest));let refused=false;try{await restored.transaction(tx=>applyExact17(tx,bundle.inventory,bundle.recoveryManifest))}catch{refused=true}check(refused,'repeat migration refuses')}
   }finally{await restored.close()}
   check(canonical(await source.transaction(tx=>inventory(tx)))===canonical(bundle.inventory),'read-only source unchanged')
   results.push({sourceName,database:name,restoreReceipt:receipt,source:sourceRead,restored:restoredRead,sourceUnchanged:true,forcedMigrationRollbackAndReapplyRefusal:version===16,cloneOnlyPublicSchemaContainmentAdapted:version===16})
  }finally{await source.close()}
 }
 const forward=results.find(r=>r.source.schemaVersion===17)
 const forwardReceipt={status:'m74_schema17_forward_recovery_review_passed',reviewerId:'/root/m74_cto',reviewedMigrationHash:MIGRATION,schemaVersion:17,createdAt:new Date().toISOString(),populatedMobileRecoveryVerified:true,m73AndLegacyPreserved:true,runtimeReplayAndDownloadsVerified:true,noMutationVerified:true,sourceContentManifest:forward.source.recoveryManifest,restoredContentManifest:forward.restored.recoveryManifest,localSynthetic:true,port:55463,sourceDatabase:forward.sourceName,restoredDatabase:forward.database,restoreReceiptSha256:digest(await Bun.file(forward.restoreReceipt).bytes()),evidence:{gasVersions:forward.restored.gasVersions,mobileVersions:forward.restored.mobileVersions,methodDownloads:forward.restored.methodDownloads,legacyDownloads:forward.restored.legacyDownloads}}
 await writeFile(resolve(output,'independent-forward17.json'),JSON.stringify(forwardReceipt,null,2)+'\n',{flag:'wx'})
 await writeFile(resolve(output,'independent-result.json'),JSON.stringify({status:'m74_independent_local_recovery_passed',createdAt:new Date().toISOString(),project:PROJECT,results,hostedEvidence:false,dpapiExercisedByReviewer:false},null,2)+'\n',{flag:'wx'})
 console.log(JSON.stringify({status:'m74_independent_local_recovery_passed',output,results:results.map(({sourceName,database,restored})=>({sourceName,database,...restored,recoveryManifest:{sha256:restored.recoveryManifest.sha256,entries:restored.recoveryManifest.entries.length}}))}))
}
if(import.meta.main)await localRehearsal()
