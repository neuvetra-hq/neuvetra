/** Independent read-only application reconstruction from exact hosted archive restore. */
import {createPostgresConnection,HostedWorkspaceDatabase} from '../../packages/neuvetra-database/src/hosted'
import {m71CanonicalJson} from '../../packages/neuvetra-database/src/m71-validation'
import {exclusiveJson} from '../../tools/staging/m72-common'
const operator=createPostgresConnection('postgres://supabase_admin@127.0.0.1:55472/m72_security_hosted_restore01',{tls:false,maxConnections:1})
const runtime=createPostgresConnection('postgres://neuvetra_runtime@127.0.0.1:55472/m72_security_hosted_restore01',{tls:false,maxConnections:1})
const database=new (HostedWorkspaceDatabase as any)(runtime,'icockcoguyadhryzydvl') as HostedWorkspaceDatabase
const sha=(v:Uint8Array|string)=>new Bun.CryptoHasher('sha256').update(v).digest('hex')
const assert=(v:unknown)=>{if(!v)throw Error('Restored application verification failed')}
try{
 const history=await Bun.file('.superpowers/m72-hosted-journey.json').json(),baseline=history.baseline
 assert(baseline)
 const actor=(await operator.query<any>("select m.user_id,m.company_id from neuvetra.company_members m join neuvetra.staging_access a on a.user_id=m.user_id and a.company_id=m.company_id where m.role='owner' and a.active order by m.user_id limit 1")).rows[0]
 assert(actor?.company_id===history.workspaceId)
 const uid=actor.user_id,company=actor.company_id
 let recordChecks=0,downloadChecks=0
 const records:[string,unknown][]=[
  ['m64_worksheet',await database.findElectricityWorksheet(uid,company)],
  ['m66_worksheet',await database.findSourceElectricityWorksheet(uid,company)],
  ['m67_worksheet',await database.findAnnualElectricityWorksheet(uid,company)],
  ['m68_evidence',await database.findAnnualElectricityEvidence(uid,company)],
  ['m66_sources',await database.findElectricitySources(uid,company)],
  ['m65_reports',await database.findWorksheetReports(uid,company)],
  ['m66_reports',await database.findSourceWorksheetReports(uid,company)],
  ['m67_reports',await database.findAnnualWorksheetReports(uid,company)],
  ['m68_reports',await database.findAnnualEvidenceReports(uid,company)],
 ]
 for(const [name,value]of records){assert(value&&sha(m71CanonicalJson(value))===baseline.records[name]);recordChecks++}
 const checkDownload=(name:string,bytes:Uint8Array)=>{assert(baseline.downloads[name]?.sha256===sha(bytes)&&baseline.downloads[name]?.byteLength===bytes.byteLength);downloadChecks++}
 const sources=await database.findElectricitySources(uid,company);assert(sources)
 for(const source of sources!.sources){const doc=await database.downloadElectricitySource(uid,company,source.id);assert(doc);checkDownload('m66_source_'+source.id,doc!.bytes)}
 for(const [prefix,list,download]of [
  ['m65',await database.findWorksheetReports(uid,company),(id:string)=>database.downloadWorksheetReport(uid,company,id)],
  ['m66',await database.findSourceWorksheetReports(uid,company),(id:string)=>database.downloadSourceWorksheetReport(uid,company,id)],
  ['m67',await database.findAnnualWorksheetReports(uid,company),(id:string)=>database.downloadAnnualWorksheetReport(uid,company,id)],
  ['m68',await database.findAnnualEvidenceReports(uid,company),(id:string)=>database.downloadAnnualEvidenceReport(uid,company,id)],
 ] as const){assert(list);for(const report of list!.reports){const doc=await download(report.id);assert(doc);checkDownload(prefix+'_report_'+report.id,doc!.bytes)}}
 await exclusiveJson('evaluations/research-qa/m72-security-restored-read.json',{status:'passed',createdAt:new Date().toISOString(),database:'m72_security_hosted_restore01',scope:'Actual separate restricted runtime connection reconstructs M64-M68 records and retained bytes equal to independently reviewed live pre-rollout baseline; local Auth UUIDs only',recordChecks,downloadChecks,baselineReceiptSha256:sha(await Bun.file('.superpowers/m72-hosted-journey.json').text()),restoreReceiptSha256:sha(await Bun.file('evaluations/research-qa/m72-security-hosted-restore.json').text())})
 console.log(JSON.stringify({status:'passed',recordChecks,downloadChecks}))
}finally{await runtime.close();await operator.close()}
