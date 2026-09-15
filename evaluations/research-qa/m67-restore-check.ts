/** Read-only comparison of the authorized local M67 source and restored DBs. No row contents persisted. */
import postgres from '../../packages/neuvetra-database/node_modules/postgres'
import {open} from 'node:fs/promises'
import {collectSourceManifest,hashManifestValue} from '../../tools/staging/create-source-manifest'
import {createPostgresConnection,HostedWorkspaceDatabase} from '../../packages/neuvetra-database/src/hosted'
import type {WorkspaceConnection} from '../../packages/neuvetra-database/src/workspace'
import {decodeSourceElectricityWorksheet} from '../../apps/site-web/src/lib/m66-api'
import {decodeSourceWorksheetReport} from '../../apps/site-web/src/lib/m66-report-api'
import {decodeAnnualElectricityWorksheet} from '../../apps/site-web/src/lib/m67-api'
import {decodeAnnualWorksheetReport} from '../../apps/site-web/src/lib/m67-report-api'
const names=['m67_qa','m67_qa_restore'] as const
const ops=names.map(n=>postgres(`postgres://m63_test_admin@127.0.0.1:55463/${n}`,{ssl:false,max:1,onnotice:()=>{},connection:{timezone:'UTC',default_transaction_read_only:'on'}}))
const connections=names.map(n=>createPostgresConnection(`postgres://neuvetra_runtime@127.0.0.1:55463/${n}`,{tls:false,maxConnections:1}))
const dbs=connections.map(c=>new(HostedWorkspaceDatabase as unknown as new(c:WorkspaceConnection,ref:string)=>HostedWorkspaceDatabase)(c,'abcdefghijklmnopqrst'))
const equal=(a:unknown,b:unknown)=>{if(hashManifestValue(a)!==hashManifestValue(b))throw Error('Restore mismatch')}
try{
 const manifests=await Promise.all(ops.map(op=>collectSourceManifest(op as any)));equal(manifests[0]!.tables,manifests[1]!.tables);equal(manifests[0]!.metadata,manifests[1]!.metadata)
 const companies=await ops[0]!.unsafe('select distinct company_id,created_by from neuvetra.source_worksheet_versions where version=1 order by company_id')
 let sources=0,reports=0,versions=0
 for(const row of companies){
  const [before,after]=await Promise.all(dbs.map(db=>db.findSourceElectricityWorksheet(row.created_by,row.company_id)));if(!before||!after)throw Error('Restored owner access missing');equal(before,after);decodeSourceElectricityWorksheet(after,row.company_id);versions+=after.versions.length
  const lists=await Promise.all(dbs.map(db=>db.findElectricitySources(row.created_by,row.company_id)));equal(lists[0],lists[1]);
  for(const source of lists[0]!.sources){const docs=await Promise.all(dbs.map(db=>db.downloadElectricitySource(row.created_by,row.company_id,source.id)));if(!docs[0]||!docs[1]||!Buffer.from(docs[0].bytes).equals(Buffer.from(docs[1].bytes)))throw Error('Source bytes lost');sources++}
  const reportsBoth=await Promise.all(dbs.map(db=>db.findSourceWorksheetReports(row.created_by,row.company_id)));equal(reportsBoth[0],reportsBoth[1]);
  for(const report of reportsBoth[0]!.reports){decodeSourceWorksheetReport(report,after);const docs=await Promise.all(dbs.map(db=>db.downloadSourceWorksheetReport(row.created_by,row.company_id,report.id)));if(!docs[0]||!docs[1]||!Buffer.from(docs[0].bytes).equals(Buffer.from(docs[1].bytes)))throw Error('Report bytes lost');reports++}
 }
 const annualCompanies=await ops[0]!.unsafe('select distinct company_id,created_by from neuvetra.annual_electricity_worksheet_versions where version=1 order by company_id')
 let annualVersions=0,annualReports=0
 for(const row of annualCompanies){
  const [before,after]=await Promise.all(dbs.map(db=>db.findAnnualElectricityWorksheet(row.created_by,row.company_id)));if(!before||!after)throw Error('Restored annual owner access missing');equal(before,after);decodeAnnualElectricityWorksheet(after,row.company_id);annualVersions+=after.versions.length
  const reportsBoth=await Promise.all(dbs.map(db=>db.findAnnualWorksheetReports(row.created_by,row.company_id)));equal(reportsBoth[0],reportsBoth[1])
  for(const report of reportsBoth[0]!.reports){decodeAnnualWorksheetReport(report,after);const docs=await Promise.all(dbs.map(db=>db.downloadAnnualWorksheetReport(row.created_by,row.company_id,report.id)));if(!docs[0]||!docs[1]||!Buffer.from(docs[0].bytes).equals(Buffer.from(docs[1].bytes)))throw Error('Annual report bytes lost');annualReports++}
 }
 const readiness=await Promise.all(dbs.map(db=>db.checkReadiness()));equal(readiness[0],readiness[1])
 const receipt={status:'passed',scope:'actual local pg_dump/pg_restore plus exact table/metadata hashes and restricted runtime source-to-report reads; not cloud/provider Auth/off-device recovery',sourceDatabase:names[0],restoredDatabase:names[1],schemaVersion:13,tables:manifests[0]!.tables.length,records:manifests[0]!.tables.reduce((n,t)=>n+t.count,0),allTableHashesIdentical:true,allFourMetadataGroupsIdentical:true,annualCompanies:annualCompanies.length,annualVersions,annualReports,sourceWorksheetCompanies:companies.length,sourceWorksheetVersions:versions,sourceFilesVerified:sources,sourceReportsVerified:reports,manifests:manifests.map(m=>({tables:m.tables,metadata:m.metadata}))}
 const file=await open(new URL('./m67-restore-receipt.json',import.meta.url),'wx');try{await file.writeFile(JSON.stringify(receipt,null,2)+'\n');await file.sync()}finally{await file.close()}
 console.log(JSON.stringify({...receipt,manifests:undefined}))
}finally{await Promise.all([...ops.map(op=>op.end()),...dbs.map(db=>db.close())])}
