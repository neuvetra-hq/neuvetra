/** Read-only semantic replay of retained families and actual frontend downloads. Schema19 checks its pinned receipts; current schema20 readiness is never invoked against19. */
import {createPostgresConnection,HostedWorkspaceDatabase} from '../../packages/neuvetra-database/src/index'
import {createM73Authority} from '../../apps/site-api/src/calculation/m73-authority'
import {createM74Authority} from '../../apps/site-api/src/calculation/m74-authority'
import {createM73Routes} from '../../apps/site-api/src/workspace/m73-routes'
import {createM74Routes} from '../../apps/site-api/src/workspace/m74-routes'
import {createCorporateInventoryRoutes} from '../../apps/site-api/src/workspace/m71-routes'
import {inventory,canonicalReceipts,requireValue as check,localName} from './m77-common'
import {recoveryManifest} from './m77-recovery-manifest'
import {canonicalManifestJson as canonical} from './create-source-manifest'
const connect=(name:string,port=55463,role=port===55472?'supabase_admin':'m63_test_admin')=>{localName(name,port);return createPostgresConnection(`postgres://${role}@127.0.0.1:${port}/${name}`,{tls:false,maxConnections:1})}
export async function inspectRecovered(name:string,port=55463){
 const db=connect(name,port),runtime=connect(name,port,'neuvetra_runtime');let downloads=0,gasVersions=0,mobileVersions=0,legacyDownloads=0,coverageVersions=0,fleetVersions=0,fleetDownloads=0,fleetProofReads=0,fleetFrontendRegisters=0,fleetFrontendDownloads=0,dieselVersions=0,dieselDownloads=0,equipmentVersions=0,equipmentDownloads=0,equipmentProofReads=0,stationaryFrontendRegisters=0,stationaryFrontendDownloads=0,fugitiveVersions=0,fugitiveReports=0,fugitiveDownloads=0,fugitiveFrontendRegisters=0,fugitiveFrontendDownloads=0
 try{
  const schemaVersion=Number((await db.query('select count(*) n from neuvetra.schema_migrations')).rows[0]!.n) as 19|20;check([19,20].includes(schemaVersion),'schema')
  await canonicalReceipts(db,schemaVersion);const before=await db.transaction(tx=>inventory(tx)),rebuilt=await db.transaction(tx=>recoveryManifest(tx,schemaVersion));const target=(await db.query('select project_ref from neuvetra.staging_target')).rows[0]!.project_ref as string
  const database=new(HostedWorkspaceDatabase as any)(runtime,target)
  const actors=(await db.query("select distinct on(m.company_id) m.company_id,m.user_id from neuvetra.company_members m join neuvetra.staging_access a on a.company_id=m.company_id and a.user_id=m.user_id where a.active order by m.company_id,case m.role when 'owner' then 0 when 'admin' then 1 else 2 end,m.user_id")).rows
  for(const a of actors){
   const coverage=await database.findCorporateInventory(a.user_id,a.company_id)
   const coverageRoute=createCorporateInventoryRoutes({database,origin:'https://author.invalid',validateUser:async()=>({id:a.user_id} as any)})
   for(const v of coverage?.versions??[]){
    const raw=(await db.query<{export_text:string}>('select export_text from neuvetra.corporate_inventory_versions where id=$1',[v.id])).rows[0]!
    const r=await coverageRoute(new Request(`https://author.invalid/workspace/${a.company_id}/corporate-inventories/${coverage.inventoryId}/versions/${v.id}/coverage-export`,{headers:{authorization:'Bearer author-synthetic'}}))
    check(r.status===200&&await r.text()===raw.export_text,'corporate version export');coverageVersions++
   }
   for(const mode of ['stationary_gas',...(schemaVersion>=17?['mobile_diesel']:[])]){
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
   if(schemaVersion>=18){
    const {createM75Routes}=await import('../../apps/site-api/src/workspace/m75-routes')
    const authority=createM74Authority(),reg=await database.findControlledFleet(a.user_id,a.company_id,authority)
    if(reg){
     const route=createM75Routes({database,authority,origin:'https://author.invalid',validateUser:async()=>({id:a.user_id} as any)})
     const exact=async(path:string,expected:string)=>{const r=await route(new Request(`https://author.invalid/workspace/${a.company_id}/controlled-fleet/${reg.rosterId}/`+path,{headers:{authorization:'Bearer author-synthetic'}}));check(r.status===200&&await r.text()===expected,'exact fleet download');check(r.headers.get('cache-control')==='no-store','fleet download cache');fleetDownloads++}
     for(const v of reg.versions){
      const row=(await db.query<{export_text:string}>('select export_text from neuvetra.controlled_fleet_versions where id=$1',[v.id])).rows[0]!
      await exact(`versions/${v.id}/roster-export`,row.export_text);fleetVersions++
      if(v.statement)await exact(`statements/${v.statement.id}/download`,v.statement.text)
     }
     for(const r of(await db.query<{id:string;payload:{html:string;snapshotJson:string}}>('select id,payload from neuvetra.controlled_fleet_reports where company_id=$1',[a.company_id])).rows){await exact(`reports/${r.id}/download`,r.payload.html);await exact(`reports/${r.id}/snapshot`,r.payload.snapshotJson)}
     // Native route transport replaces fetch only for this serial read-only author check.
     // Actual browser rendering is a separate acceptance gate, not claimed here.
     const client=await import('../../apps/site-web/src/lib/m75-api'),savedFetch=globalThis.fetch
     const prefix=`/workspace-api/workspace/${a.company_id}/controlled-fleet`
     try{
      globalThis.fetch=(async(input:any,init?:RequestInit)=>{
       check(typeof input==='string'&&input.startsWith(prefix)&&(input===prefix||input[prefix.length]==='/'),'restricted frontend transport path')
       check((init?.method??'GET')==='GET'&&!init?.body,'read-only frontend transport')
       if(input.endsWith('/proof'))fleetProofReads++
       return route(new Request('https://author.invalid'+input.slice('/workspace-api'.length),init))
      }) as typeof fetch
      const actor={accessToken:'author-synthetic',userId:a.user_id as string,role:'owner' as const}
      const decoded=await client.fleetRegisterRequest(actor,a.company_id as string);check(canonical(decoded)===canonical(reg),'actual frontend register proof and decoder');fleetFrontendRegisters++
      for(const v of decoded.versions){await client.fleetVersionDownload(actor,a.company_id as string,v);fleetFrontendDownloads++;if(v.statement){await client.fleetStatementDownload(actor,a.company_id as string,v);fleetFrontendDownloads++}}
      for(const metadata of decoded.reports){
       const raw=(await db.query<{payload:{html:string;snapshotJson:string}}>('select payload from neuvetra.controlled_fleet_reports where id=$1',[metadata.id])).rows[0]!.payload
       check(await client.fleetReportSnapshotDownload(actor,a.company_id as string,metadata)===raw.snapshotJson,'frontend exact snapshot and historical proof')
       check(await client.fleetReportDownload(actor,a.company_id as string,metadata)===raw.html,'frontend exact HTML and historical proof');fleetFrontendDownloads+=2
      }
     }finally{globalThis.fetch=savedFetch}
    }
   }
  }
  if(schemaVersion>=19){
   const {createM76Authority}=await import('../../apps/site-api/src/calculation/m76-authority')
   const {createM76Routes}=await import('../../apps/site-api/src/workspace/m76-routes')
   const authorities={gas:createM73Authority(),diesel:createM76Authority()}
   for(const a of actors){
    const route=createM76Routes({database,authorities,origin:'https://author.invalid',validateUser:async()=>({id:a.user_id} as any)})
    const exact=async(path:string,expected:string)=>{const r=await route(new Request('https://author.invalid'+path,{headers:{authorization:'Bearer author-synthetic'}}));check(r.status===200&&await r.text()===expected,'exact stationary download');check(r.headers.get('cache-control')==='no-store','stationary cache');return r}
    const root='/workspace/'+a.company_id
    const dr=await database.findStationaryDiesel(a.user_id,a.company_id,authorities.diesel)
    if(dr)for(const w of dr.worksheets){
     for(const v of w.versions){const raw=(await db.query<{export_text:string}>('select export_text from neuvetra.stationary_diesel_versions where id=$1',[v.id])).rows[0]!
      await exact(root+'/stationary-diesel/'+w.worksheetId+'/versions/'+v.id+'/calculation-export',raw.export_text);dieselVersions++;dieselDownloads++
      if(v.statement){await exact(root+'/stationary-diesel/'+w.worksheetId+'/statements/'+v.statement.id+'/download',v.statement.text);dieselDownloads++}
     }
     for(const r of w.reports){await exact(root+'/stationary-diesel/'+w.worksheetId+'/reports/'+r.id+'/download',r.html);dieselDownloads++;await exact(root+'/stationary-diesel/'+w.worksheetId+'/reports/'+r.id+'/snapshot',r.snapshotJson);dieselDownloads++}
    }
    const er=await database.findStationaryEquipment(a.user_id,a.company_id,authorities)
    if(er){for(const v of er.versions){const raw=(await db.query<{export_text:string}>('select export_text from neuvetra.stationary_equipment_versions where id=$1',[v.id])).rows[0]!
     await exact(root+'/stationary-equipment/'+v.rosterId+'/versions/'+v.id+'/roster-export',raw.export_text);equipmentVersions++;equipmentDownloads++
     if(v.statement){await exact(root+'/stationary-equipment/'+v.rosterId+'/statements/'+v.statement.id+'/download',v.statement.text);equipmentDownloads++}
    }
    for(const r of(await db.query<{id:string;payload:{html:string;snapshotJson:string;rosterId:string}}>('select id,payload from neuvetra.stationary_equipment_reports where company_id=$1',[a.company_id])).rows){
     const path=root+'/stationary-equipment/'+r.payload.rosterId+'/reports/'+r.id
     await exact(path+'/download',r.payload.html);await exact(path+'/snapshot',r.payload.snapshotJson);equipmentDownloads+=2
     const proof=await route(new Request('https://author.invalid'+path+'/proof',{headers:{authorization:'Bearer author-synthetic'}}));check(proof.status===200,'stationary historical proof');equipmentProofReads++
    }
    }
    const savedFetch=globalThis.fetch
    try{
     const allowed=['/workspace-api'+root+'/stationary-equipment','/workspace-api'+root+'/stationary-diesel']
     globalThis.fetch=(async(input:any,init?:RequestInit)=>{check(typeof input==='string'&&allowed.some(prefix=>input===prefix||input.startsWith(prefix+'/'))&&(init?.method??'GET')==='GET'&&!init?.body,'read-only stationary frontend transport');if(input.endsWith('/proof'))equipmentProofReads++;return route(new Request('https://author.invalid'+input.slice('/workspace-api'.length),init))}) as typeof fetch
     const actor={accessToken:'author-synthetic',userId:a.user_id as string,role:'owner' as const},equipmentClient=await import('../../apps/site-web/src/lib/m76-api'),dieselClient=await import('../../apps/site-web/src/lib/m76-diesel-api')
     if(dr){const decoded=await dieselClient.generatorRegisterRequest(actor,a.company_id as string);check(canonical(decoded)===canonical(dr),'actual generator frontend register');stationaryFrontendRegisters++
      for(const w of decoded.worksheets){for(const v of w.versions){await dieselClient.generatorExportRequest(actor,a.company_id as string,v);stationaryFrontendDownloads++;if(v.statement){await dieselClient.generatorStatementDownload(actor,a.company_id as string,w.worksheetId,v);stationaryFrontendDownloads++}}for(const r of w.reports){check(await dieselClient.generatorReportDownload(actor,a.company_id as string,w.worksheetId,r)===r.html,'actual generator HTML download');stationaryFrontendDownloads++}}
     }
     if(er){const decoded=await equipmentClient.stationaryRegisterRequest(actor,a.company_id as string);check(canonical(decoded)===canonical(er),'actual stationary frontend register proof');stationaryFrontendRegisters++
      for(const v of decoded.versions){await equipmentClient.stationaryVersionDownload(actor,a.company_id as string,v);stationaryFrontendDownloads++;if(v.statement){await equipmentClient.stationaryStatementDownload(actor,a.company_id as string,v);stationaryFrontendDownloads++}}
      for(const metadata of decoded.reports){const raw=(await db.query<{payload:{html:string;snapshotJson:string}}>('select payload from neuvetra.stationary_equipment_reports where id=$1',[metadata.id])).rows[0]!.payload;check(await equipmentClient.stationaryReportSnapshotDownload(actor,a.company_id as string,metadata)===raw.snapshotJson,'actual historical stationary snapshot/proof');check(await equipmentClient.stationaryReportDownload(actor,a.company_id as string,metadata)===raw.html,'actual historical stationary HTML/proof');stationaryFrontendDownloads+=2}
     }
    }finally{globalThis.fetch=savedFetch}
   }
   check(dieselVersions===Number((await db.query('select count(*) n from neuvetra.stationary_diesel_versions')).rows[0]!.n),'all generator exports')
   check(equipmentVersions===Number((await db.query('select count(*) n from neuvetra.stationary_equipment_versions')).rows[0]!.n),'all equipment exports')
  }
  if(schemaVersion===20){
   const {createM77Authority}=await import('../../apps/site-api/src/calculation/m77-authority'),{createM77Routes}=await import('../../apps/site-api/src/workspace/m77-routes'),client=await import('../../apps/site-web/src/lib/m77-api'),authority=createM77Authority()
   for(const a of actors){
    const reg=await database.findFugitive(a.user_id,a.company_id,authority);check(reg,'fugitive register')
    const route=createM77Routes({database,authority,origin:'https://author.invalid',validateUser:async()=>({id:a.user_id}as any)}),root='/workspace/'+a.company_id
    const exact=async(path:string,expected:string)=>{const response=await route(new Request('https://author.invalid'+path,{headers:{authorization:'Bearer author-synthetic'}}));check(response.status===200&&await response.text()===expected,'exact fugitive download');check(response.headers.get('cache-control')==='no-store','fugitive cache');fugitiveDownloads++}
    for(const v of [...reg.worksheets.flatMap((w:any)=>w.versions),...reg.population.versions]){
     const family=v.family==='source'?'fugitive-sources':'fugitive-population',base=root+'/'+family+'/'+v.streamId,raw=(await db.query<{export_text:string}>('select export_text from neuvetra.fugitive_versions where id=$1',[v.id])).rows[0]!
     await exact(base+'/versions/'+v.id+'/calculation-export',raw.export_text);fugitiveVersions++
     for(const statement of v.statements)await exact(base+'/statements/'+statement.id+'/download',statement.text)
    }
    const allReports=[...reg.worksheets.flatMap((w:any)=>w.reports),...reg.population.reports];for(const r of allReports){const base=root+'/'+(r.family==='source'?'fugitive-sources':'fugitive-population')+'/'+r.streamId+'/reports/'+r.id;await exact(base+'/download',r.html);await exact(base+'/snapshot',r.snapshotJson);fugitiveReports++}
    const savedFetch=globalThis.fetch;try{
     const allowed=['/workspace-api'+root+'/fugitive-sources','/workspace-api'+root+'/fugitive-population']
     globalThis.fetch=(async(input:any,init?:RequestInit)=>{check(typeof input==='string'&&allowed.some(prefix=>input===prefix||input.startsWith(prefix+'/'))&&(init?.method??'GET')==='GET'&&!init?.body,'read-only fugitive frontend transport');return route(new Request('https://author.invalid'+input.slice('/workspace-api'.length),init))})as typeof fetch
     const actor={accessToken:'author-synthetic',userId:a.user_id as string,role:'owner'as const},decoded=await client.fugitiveRegisterRequest(actor,a.company_id as string);check(canonical(decoded)===canonical(reg),'actual fugitive frontend lineage/proof decoder');fugitiveFrontendRegisters++
     for(const v of [...decoded.worksheets.flatMap(w=>w.versions),...decoded.population.versions])for(const statement of v.statements){check(await client.fugitiveStatementDownload(actor,a.company_id as string,v,statement.id)===statement.text,'frontend exact fugitive statement');fugitiveFrontendDownloads++}
     for(const r of [...decoded.worksheets.flatMap(w=>w.reports),...decoded.population.reports]){check(await client.fugitiveReportDownload(actor,a.company_id as string,r)===r.html,'frontend exact historical fugitive HTML');check(await client.fugitiveSnapshotDownload(actor,a.company_id as string,r)===r.snapshotJson,'frontend exact historical fugitive snapshot');fugitiveFrontendDownloads+=2}
    }finally{globalThis.fetch=savedFetch}
   }
   check(fugitiveVersions===Number((await db.query('select count(*) n from neuvetra.fugitive_versions')).rows[0]!.n),'all fugitive versions')
   check(fugitiveReports===Number((await db.query('select count(*) n from neuvetra.fugitive_reports')).rows[0]!.n),'all fugitive reports')
  }
  const noClaim=await runtime.query('select id from neuvetra.companies');check(noClaim.rows.length===0,'RLS no claim')
  check(canonical(before)===canonical(await db.transaction(tx=>inventory(tx))),'no mutation after replay/downloads')
  const expectedGas=(await db.query('select count(*) n from neuvetra.stationary_gas_versions')).rows[0]!.n;check(gasVersions===Number(expectedGas),'all gas versions replayed')
  if(schemaVersion>=17)check(mobileVersions===Number((await db.query('select count(*) n from neuvetra.mobile_diesel_versions')).rows[0]!.n),'all mobile versions replayed')
  const expectedLegacy=(await db.query("select (select count(*) from neuvetra.electricity_sources)+(select count(*) from neuvetra.worksheet_reports)+(select count(*) from neuvetra.source_worksheet_reports)+(select count(*) from neuvetra.annual_electricity_reports)+(select count(*) from neuvetra.annual_evidence_reports) n")).rows[0]!.n;check(legacyDownloads===Number(expectedLegacy),'all legacy downloads')
  check(coverageVersions===Number((await db.query('select count(*) n from neuvetra.corporate_inventory_versions')).rows[0]!.n),'all corporate exports')
  if(schemaVersion>=18)check(fleetVersions===Number((await db.query('select count(*) n from neuvetra.controlled_fleet_versions')).rows[0]!.n),'all fleet exports')
  return {schemaVersion,recoveryManifest:rebuilt,fugitiveVersions,fugitiveReports,fugitiveDownloads,fugitiveFrontendRegisters,fugitiveFrontendDownloads,dieselVersions,dieselDownloads,equipmentVersions,equipmentDownloads,equipmentProofReads,stationaryFrontendRegisters,stationaryFrontendDownloads,gasVersions,mobileVersions,coverageVersions,fleetVersions,fleetDownloads,fleetProofReads,fleetFrontendRegisters,fleetFrontendDownloads,methodDownloads:downloads,legacyDownloads,noMutationVerified:true,runtimeNoClaimDenied:true}
 }finally{await runtime.close();await db.close()}
}


