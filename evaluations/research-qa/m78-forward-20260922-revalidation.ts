/** Explicit root-approved fictional sources/clones. Read-only; no host or credentials. */
import {createPostgresConnection,HostedWorkspaceDatabase} from '../../packages/neuvetra-database/src/index'
import {inventory,content,sameExactInventory,sameUpgradeInventory,sameContent,PATH_FUNCTIONS,hash} from '../../tools/staging/m78-inventory'
import {createM73Authority} from '../../apps/site-api/src/calculation/m73-authority'
import {createM74Authority} from '../../apps/site-api/src/calculation/m74-authority'
import {createM76DieselAuthority} from '../../apps/site-api/src/calculation/m76-authority'
import {createM77Authority} from '../../apps/site-api/src/calculation/m77-authority'
import {M78_REVIEWED_POLICY} from '../../packages/neuvetra-database/src/m78-policy'
import {createM78Routes} from '../../apps/site-api/src/workspace/m78-routes'
import {decodeScope1Register,decodeScope1Version,decodeScope1Report} from '../../apps/site-web/src/lib/m78-api'
import {createHash} from 'node:crypto'
import {readFile,writeFile} from 'node:fs/promises'
import {hostedSourcePins} from '../../tools/staging/m78-hosted-database'
const names=['m78_author_native_1789620106488','m78_ops_recovery_1789620512810'] as const
const check=(v:unknown,m:string)=>{if(!v)throw Error(m)},sha=(b:string|Uint8Array)=>createHash('sha256').update(b).digest('hex')
const historicalPath='evaluations/research-qa/m78-forward-recovery.json',historicalBytes=await readFile(historicalPath),historical=JSON.parse(historicalBytes.toString())
check(sha(historicalBytes)==='7a3355d1eff82d834ee7e80d513d6e6caa95c766d7828139cd5735502675c923','Original forward proof changed')
for(const pin of [historical.localOperatorReceipt,historical.actualOccupied21Refusal])check(sha(await readFile(pin.path))===pin.sha256,'Original operation provenance changed')
const occupied=JSON.parse(await readFile(historical.actualOccupied21Refusal.path,'utf8')),receipt=JSON.parse(await readFile(historical.localOperatorReceipt.path,'utf8'))
check(occupied.journalEvents.length===2&&occupied.journalEvents[1].stage==='prerequisites'&&occupied.journalEvents[1].cloneCreated===false&&occupied.target===names[1],'Original occupied21 refusal invalid')
const connections=names.map(n=>createPostgresConnection('postgres://supabase_admin@127.0.0.1:55472/'+n,{tls:false,maxConnections:1})),runtime=createPostgresConnection('postgres://neuvetra_runtime@127.0.0.1:55472/'+names[1],{tls:false,maxConnections:1})
try{
 const snapshots=[]
 for(const db of connections)snapshots.push(await db.transaction(async tx=>{await tx.exec('set transaction isolation level repeatable read read only');return {inventory:await inventory(tx),content:await content(tx,21)}}))
 const [source,restored]=snapshots
 sameExactInventory(historical.sourceInventory,source!.inventory);sameExactInventory(historical.restoredInventory,restored!.inventory);sameExactInventory(source!.inventory,restored!.inventory);sameContent(historical.sourceContent,source!.content);sameContent(historical.restoredContent,restored!.content)
 const fixture=JSON.parse(await Bun.file('.superpowers/m78_author_native_1789620106488-result.json').text()),company=fixture.companyId,actor=fixture.users.owner,authorities={gas:createM73Authority(),mobile:createM74Authority(),diesel:createM76DieselAuthority(),fugitive:createM77Authority()},db=new(HostedWorkspaceDatabase as any)(runtime,'icockcoguyadhryzydvl')
 const route=createM78Routes({database:db,authorities,policy:M78_REVIEWED_POLICY,origin:'http://127.0.0.1:47805',validateUser:async t=>t==='fictional-recovery-owner'?{id:actor,email:null,phone:null,fullName:null}:null}),counters={process_screen:{authorizedGetRequests:0,exactDownloadRequests:0},inventory:{authorizedGetRequests:0,exactDownloadRequests:0}}
 const get=async(family:'process_screen'|'inventory',path:string)=>{counters[family].authorizedGetRequests++;const r=await route(new Request('http://127.0.0.1:47805/workspace/'+company+'/'+path,{headers:{authorization:'Bearer fictional-recovery-owner'}}));check(r.status===200&&r.headers.get('cache-control')==='no-store','Authorized read failed');return r}
 const register=await decodeScope1Register(await(await get('inventory','scope1-inventory')).json(),company);check(register.process.versions.length===3&&register.inventory.versions.length===2&&register.reconciliation.totals?.company.kgCo2eExact==='126850.17632025','Complete corrected occupied fixture required')
 let nullReports=0,contributorsChecked=0
 const families=[]
 for(const family of ['process_screen','inventory'] as const){const stream=family==='process_screen'?register.process:register.inventory,prefix=family==='process_screen'?'process-screen':'scope1-inventory';let previous:any=null
  for(const v of stream.versions){const base=prefix+'/'+stream.streamId+'/versions/'+v.id,e=await decodeScope1Version(await(await get(family,base)).json(),company,previous);check(e.version.id===v.id&&e.version.previousVersionId===(previous?.id??null),'Historical lineage differs');if(previous)check(previous.contributorIds.every((id:string)=>v.contributorIds.includes(id)),'Contributor history shrank');contributorsChecked++;const row=(await connections[1]!.query<{export_text:string}>('select export_text from neuvetra.scope1_versions where id=$1',[v.id])).rows[0]!;check(await(await get(family,base+'/inventory-export')).text()===row.export_text,'Version export changed');counters[family].exactDownloadRequests++;previous=v}
  for(const meta of stream.reports){const base=prefix+'/'+stream.streamId+'/reports/'+meta.id,r=await decodeScope1Report(await(await get(family,base)).json(),company);if(JSON.parse(r.snapshotJson).review===null)nullReports++;for(const [suffix,expected]of [['download',r.html],['snapshot',r.snapshotJson]]as const){check(await(await get(family,base+'/'+suffix)).text()===expected,'Report bytes differ');counters[family].exactDownloadRequests++}}
  families.push({family,versionIds:stream.versions.map(v=>v.id),reportIds:stream.reports.map(r=>r.id),...counters[family],semanticAndDownloadVerification:true})
 }
 check(nullReports>=2&&contributorsChecked===5,'Captured null reviews/complete history missing')
 for(const name of ['scope1_heads','scope1_versions','scope1_statements','scope1_reviews','scope1_reports','scope1_requests','scope1_audit','scope1_process_discoveries'])check((await runtime.query('select 1 from neuvetra.'+name+' limit 1')).rows.length===0,'No-claim runtime exposed rows')
 const after=await connections[1]!.transaction(async tx=>{await tx.exec('set transaction isolation level repeatable read read only');return {inventory:await inventory(tx),content:await content(tx,21)}});sameExactInventory(restored.inventory,after.inventory);sameContent(restored.content,after.content)
 const afterSource=await connections[0]!.transaction(async tx=>{await tx.exec('set transaction isolation level repeatable read read only');return {inventory:await inventory(tx),content:await content(tx,21)}});sameExactInventory(source!.inventory,afterSource.inventory);sameContent(source!.content,afterSource.content)
 check(nullReports===3,'All three captured-null reviews required')
 const currentPins=await hostedSourcePins(),priorPins=JSON.parse(await readFile('evaluations/research-qa/m78-application-transfer-source-pins.json','utf8'));check(hash(currentPins)===hash(Array.isArray(priorPins)?priorPins:priorPins.sourcePins),'Current hosted preparation pins changed')
 const attestation={...historical,createdAt:new Date().toISOString(),reviewerId:'/root/resume_release',semanticReplay:{fullHistoricalSemanticReplay:false,families},sourceInventory:source!.inventory,restoredInventory:after.inventory,sourceContent:source!.content,restoredContent:after.content,nullReportsChecked:nullReports,reviewMode:'read-only current revalidation of historical successful restore and occupied-target refusal',freshRestorePerformedThisReview:false,occupiedRefusalPerformedThisReview:false,originalOperationProvenance:{forwardReview:{path:historicalPath,sha256:sha(historicalBytes),createdAt:historical.createdAt},occupiedRefusal:{...historical.actualOccupied21Refusal,createdAt:occupied.createdAt},localOperatorReceipt:historical.localOperatorReceipt},hostedPreparationSourcePins:currentPins}
 const output='evaluations/research-qa/m78-forward-20260922-revalidation.json';await writeFile(output,JSON.stringify(attestation,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:attestation.status,tables:after.inventory.tables.length,content:after.content.entries.length,nullReports,families,pins:currentPins.length,sha256:sha(await readFile(output))}))
}finally{await runtime.close();for(const c of connections)await c.close()}
