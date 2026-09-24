/** Reviewer invocation of frozen replay plus independently implemented all-row/content reconstruction.
 * All database targets are literal local restored clones; no provider or migration call. */
import {createHash} from 'node:crypto'
import {createPostgresConnection} from '../../packages/neuvetra-database/src/hosted'
import {inspectRecovered} from '../../tools/staging/m75-replay'
const sha=(s:string|Uint8Array)=>createHash('sha256').update(s).digest('hex')
const canonical=(v:any):string=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}'
const assert=(v:unknown,m:string)=>{if(!v)throw Error(m)}
const read=async(p:string)=>JSON.parse(await Bun.file(p).text())
const fileHash=async(p:string)=>sha(await Bun.file(p).bytes())
async function rebuild(name:string,port:number,expected:any){
 const db=createPostgresConnection(`postgres://${port===55472?'supabase_admin':'m63_test_admin'}@127.0.0.1:${port}/${name}`,{tls:false,maxConnections:1})
 try{return await db.transaction(async tx=>{
  await tx.exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY')
  const names=(await tx.query<{name:string}>("select tablename name from pg_tables where schemaname='neuvetra' order by tablename")).rows.map(x=>x.name)
  assert(canonical(names)===canonical(expected.inventory.tables.map((x:any)=>x.name).sort()),'complete table names')
  const entries:any[]=[],tables:any[]=[]
  const add=(table:string,id:string,part:string,value:string|Uint8Array)=>entries.push({table,id,part,sha256:sha(value),byteLength:Buffer.byteLength(value)})
  for(const table of names){
   assert(/^[a-z_]+$/.test(table),'identifier')
   const values=(await tx.query<{value:any}>(`select to_jsonb(t) value from neuvetra.${table} t`)).rows.map(x=>x.value)
   const hashes=values.map(x=>sha(canonical(x))).sort(),pin=expected.inventory.tables.find((x:any)=>x.name===table)
   assert(values.length===pin.count&&canonical(hashes)===canonical(pin.rowHashes),'exact all rows '+table)
   tables.push({name:table,count:values.length,rowHashes:hashes})
   for(const r of values){
    if(['electricity_sources','worksheet_reports','source_worksheet_reports','annual_electricity_reports','annual_evidence_reports'].includes(table))add(table,r.id,'download',Buffer.from((r[table==='electricity_sources'?'original_bytes':'report_bytes'] as string).slice(2),'hex'))
    if(['stationary_gas_statements','mobile_diesel_fuel_statements','mobile_diesel_mileage_statements','controlled_fleet_statements'].includes(table)){add(table,r.id,'statement',r.statement_text);add(table,r.id,'metadata',canonical(r.payload))}
    if(['corporate_inventory_versions','stationary_gas_versions','mobile_diesel_versions','controlled_fleet_versions'].includes(table)){add(table,r.id,'export',r.export_text);if(table!=='corporate_inventory_versions'){const part=table==='controlled_fleet_versions'?'dependencies':'calculation';assert(Object.hasOwn(r.payload,part),'missing retained '+part);add(table,r.id,part,canonical(r.payload[part]))}}
    if(['stationary_gas_reports','mobile_diesel_reports','controlled_fleet_reports'].includes(table)){add(table,r.id,'html',r.payload.html);add(table,r.id,'snapshot',r.payload.snapshotJson)}
   }
  }
  entries.sort((a,b)=>canonical(a).localeCompare(canonical(b)))
  const manifest={profile:'neuvetra.m75.recovery-content.v1',schemaVersion:expected.schemaVersion,entries,sha256:sha(canonical(entries))}
  assert(canonical(manifest)===canonical(expected.recoveryManifest),'independent all-content manifest exact')
  return {manifest,tables,tableCount:tables.length,rowCount:tables.reduce((n,x)=>n+x.count,0),rowsSha256:sha(canonical(tables))}
 })}finally{await db.close()}
}
const backupPath='.superpowers/m75-hosted-backup-candidate1.json',restorePath='.superpowers/m75-hosted-restore-candidate1.json'
const backup=await read(backupPath),restore=await read(restorePath)
assert(restore.database==='m75_security_hosted17_candidate1'&&restore.port===55472&&restore.schemaVersion===17,'fixed restored target')
assert(backup.archiveSha256===restore.archiveSha256&&backup.dumpSha256===restore.dumpSha256,'receipt archive pair')
for(const key of ['tables','metadata','catalogRowHashes','roles','memberships','dependencies'])assert(canonical(backup.inventory[key])===canonical(restore.inventory[key]),'backup restore '+key)
for(const receipt of [backup,restore])assert(!receipt.inventory.defaultAcls.some((r:any)=>r.schema==='*'||r.schema==='neuvetra'),'no application/global default ACL')
console.log('stage: independent restored17 reconstruction')
const before=await rebuild(restore.database,55472,restore)
console.log('stage: restored17 exact runtime replay/downloads')
const replay=await inspectRecovered(restore.database,55472)
const after=await rebuild(restore.database,55472,restore)
assert(before.rowsSha256===after.rowsSha256&&replay.noMutationVerified,'restored17 unchanged')
const recovery={status:'m75_independent_recovery_passed',createdAt:new Date().toISOString(),project:restore.project,schemaVersion:17,port:55472,database:restore.database,archiveSha256:backup.archiveSha256,dumpSha256:backup.dumpSha256,restoreReceiptSha256:await fileHash(restorePath),backupReceiptSha256:await fileHash(backupPath),reviewerId:'/root/m74_accounting',applicationReadsAndDownloadsVerified:true,m73CalculationReplayVerified:true,m74CalculationReplayVerified:true,legacyDownloadsVerified:true,noMutationVerified:true,recoveryManifest:before.manifest,independentReconstruction:{tableCount:before.tableCount,rowCount:before.rowCount,rowsSha256:before.rowsSha256},replay,limitations:['Existing frozen operator replay invoked by independent reviewer; manifest and every table row reconstructed by separate implementation.','Local restored clone only; no live provider, Auth session or deployment approval.']}
await Bun.write('.superpowers/m75-security-hosted-recovery-candidate1.json',JSON.stringify(recovery,null,2)+'\n')
console.log('stage: fresh populated18 reconstruction and replay')
const root='.tmp/m75-ops-1789539665453/',forwardRestore=await read(root+'restore18.json')
const sourceReceipt={...forwardRestore,database:'m75_ops_author_1789539665453'}
const source=await rebuild('m75_ops_author_1789539665453',55463,sourceReceipt),restoredBefore=await rebuild('m75_ops_forward18_1789539665453',55463,forwardRestore)
const replay18=await inspectRecovered('m75_ops_forward18_1789539665453',55463)
const restoredAfter=await rebuild('m75_ops_forward18_1789539665453',55463,forwardRestore)
assert(source.rowsSha256===restoredBefore.rowsSha256&&restoredBefore.rowsSha256===restoredAfter.rowsSha256,'populated18 exact unchanged rows')
assert(replay18.fleetVersions>0&&replay18.fleetDownloads>0&&replay18.fleetProofReads>0&&replay18.noMutationVerified,'populated18 replay')
const forward={status:'m75_schema18_forward_recovery_review_passed',createdAt:new Date().toISOString(),reviewerId:'/root/m74_accounting',reviewedMigrationHash:'76c8a17a46d96b40ed98213ceb3cf79caf564c5a639583197bd0adaf1c8a98f3',schemaVersion:18,populatedFleetRecoveryVerified:true,m73M74AndLegacyPreserved:true,runtimeReplayAndDownloadsVerified:true,noMutationVerified:true,sourceContentManifest:source.manifest,restoredContentManifest:restoredBefore.manifest,restoreReceiptSha256:await fileHash(root+'restore18.json'),authorResultSha256:await fileHash(root+'author-result.json'),independentCatalogComparisonSha256:await fileHash('evaluations/research-qa/m75-independent-recovery18-final.json'),independentReconstruction:{tableCount:source.tableCount,rowCount:source.rowCount,rowsSha256:source.rowsSha256},replay:replay18,limitations:['Reviewer executed retained restored-clone replay and independent reconstruction; CTO executed DPAPI seal/unseal and restore.','Root operator safety and actual hosted deployment remain separate.']}
await Bun.write('.superpowers/m75-security-forward-review-candidate1.json',JSON.stringify(forward,null,2)+'\n')
console.log(JSON.stringify({restored17:{tables:before.tableCount,rows:before.rowCount,gas:replay.gasVersions,mobile:replay.mobileVersions,legacy:replay.legacyDownloads},restored18:{tables:source.tableCount,rows:source.rowCount,gas:replay18.gasVersions,mobile:replay18.mobileVersions,legacy:replay18.legacyDownloads,fleet:replay18.fleetVersions},recoverySha256:await fileHash('.superpowers/m75-security-hosted-recovery-candidate1.json'),forwardSha256:await fileHash('.superpowers/m75-security-forward-review-candidate1.json')}))
