/** Independent read-only reconstruction of the restored schema15 application archive. */
import {test,expect} from 'bun:test'
import {createPostgresConnection,HostedWorkspaceDatabase,readMigrationManifest,m73CanonicalJson,type WorkspaceConnection} from '../../packages/neuvetra-database/src/index'
import {inventory} from '../../tools/staging/m73-common'

const target=process.env.M73_RECOVERY_DATABASE_URL
if(target){const u=new URL(target);if(u.hostname!=='127.0.0.1'||u.port!=='55472'||u.pathname!=='/m73_qa_recovery_20260915_1624'||u.username!=='supabase_admin'||u.password||u.hash)throw Error('M73 recovery review is pinned to the read-only restored clone.')}
const native=target?test:test.skip,sha=(bytes:string|Uint8Array)=>new Bun.CryptoHasher('sha256').update(bytes).digest('hex')

native('restricted runtime reconstructs exact M64-M71 records and downloads from restored schema15',async()=>{
 const receipt=JSON.parse(await Bun.file('.superpowers/m73-restore-receipt.json').text())
 const adminUrl=new URL(target!);adminUrl.searchParams.set('options','-cdefault_transaction_read_only=on')
 const admin=createPostgresConnection(adminUrl.toString(),{tls:false,maxConnections:1})
 let actor='',company=''
 try{
  const manifest=await readMigrationManifest(),receipts=(await admin.query<{name:string;sha256:string}>('select name,sha256 from neuvetra.schema_migrations order by name')).rows;expect(receipts).toEqual(manifest.slice(0,15).map(({name,sha256})=>({name,sha256})))
  expect((await admin.query<{count:string}>("select count(*)::text count from pg_tables where schemaname='neuvetra' and tablename like 'stationary_gas_%'")).rows[0]?.count).toBe('0')
  const subject=(await admin.query<{user_id:string;company_id:string}>("select a.user_id,a.company_id from neuvetra.staging_access a join neuvetra.company_members m using(company_id,user_id) where a.active and m.role='owner' order by a.user_id limit 1")).rows[0];expect(subject).toBeDefined();actor=subject!.user_id;company=subject!.company_id
  const role=(await admin.query<{safe:boolean}>("select not rolsuper and not rolbypassrls and not rolcreatedb and not rolcreaterole and not rolreplication and not rolinherit and not exists(select 1 from pg_auth_members where member=r.oid) safe from pg_roles r where rolname='neuvetra_runtime'")).rows[0];expect(role?.safe).toBe(true)
  const tables=(await admin.query<{total:string;forced:string}>("select count(*)::text total,count(*) filter(where c.relrowsecurity and c.relforcerowsecurity)::text forced from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='neuvetra' and c.relkind='r'")).rows[0];expect(tables).toEqual({total:'67',forced:'67'})
  expect((await admin.query<{unsafe:string}>("select count(*)::text unsafe from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='neuvetra' and c.relkind='r' and has_table_privilege('neuvetra_runtime',c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')")).rows[0]?.unsafe).toBe('0')
  expect(await inventory(admin)).toEqual(receipt.inventory)
 }finally{await admin.close()}

 // Reader integrity checks intentionally take SELECT ... FOR SHARE locks; runtime has no DML grants.
 const runtimeUrl=new URL(target!);runtimeUrl.username='neuvetra_runtime'
 const connection=createPostgresConnection(runtimeUrl.toString(),{tls:false,maxConnections:1}),database=new(HostedWorkspaceDatabase as unknown as new(c:WorkspaceConnection,r:string)=>HostedWorkspaceDatabase)(connection,'icockcoguyadhryzydvl')
 try{
  const workspace=await database.findStagingWorkspaceForUser(actor);expect(workspace?.workspace.id).toBe(company);expect(workspace?.role).toBe('owner')
  const manual=await database.findElectricityWorksheet(actor,company);expect(manual?.versions.length).toBe(4)
  const manualReports=await database.findWorksheetReports(actor,company);expect(manualReports?.reports.length).toBe(2)
  const sources=await database.findElectricitySources(actor,company);expect(sources?.sources.length).toBe(2)
  const sourceWorksheet=await database.findSourceElectricityWorksheet(actor,company);expect(sourceWorksheet?.versions.length).toBe(3)
  const sourceReports=await database.findSourceWorksheetReports(actor,company);expect(sourceReports?.reports.length).toBe(3)
  const annual=await database.findAnnualElectricityWorksheet(actor,company);expect(annual?.versions.length).toBe(4)
  const annualReports=await database.findAnnualWorksheetReports(actor,company);expect(annualReports?.reports.length).toBe(3)
  const evidence=await database.findAnnualElectricityEvidence(actor,company);expect(evidence?.versions.length).toBe(4)
  const evidenceReports=await database.findAnnualEvidenceReports(actor,company);expect(evidenceReports?.reports.length).toBe(4)
  const corporate=await database.findCorporateInventory(actor,company);expect(corporate?.versions.length).toBe(2);expect(corporate?.headVersionId).toBe(corporate?.versions.at(-1)?.id)

  const downloads:{kind:string;id:string;sha256:string;bytes:number}[]=[]
  for(const source of sources!.sources){const found=await database.downloadElectricitySource(actor,company,source.id);expect(found?.source.sha256).toBe(source.sha256);expect(sha(found!.bytes)).toBe(source.sha256);downloads.push({kind:'source',id:source.id,sha256:source.sha256,bytes:found!.bytes.byteLength})}
  for(const report of manualReports!.reports){const found=await database.downloadWorksheetReport(actor,company,report.id);expect(sha(found!.bytes)).toBe(report.reportSha256);expect(found!.bytes.byteLength).toBe(report.reportByteLength);downloads.push({kind:'m65-report',id:report.id,sha256:report.reportSha256,bytes:found!.bytes.byteLength})}
  for(const report of sourceReports!.reports){const found=await database.downloadSourceWorksheetReport(actor,company,report.id);expect(sha(found!.bytes)).toBe(report.reportSha256);expect(found!.bytes.byteLength).toBe(report.reportByteLength);downloads.push({kind:'m66-report',id:report.id,sha256:report.reportSha256,bytes:found!.bytes.byteLength})}
  for(const report of annualReports!.reports){const found=await database.downloadAnnualWorksheetReport(actor,company,report.id);expect(sha(found!.bytes)).toBe(report.reportSha256);expect(found!.bytes.byteLength).toBe(report.reportByteLength);downloads.push({kind:'m67-report',id:report.id,sha256:report.reportSha256,bytes:found!.bytes.byteLength})}
  for(const report of evidenceReports!.reports){const found=await database.downloadAnnualEvidenceReport(actor,company,report.id);expect(sha(found!.bytes)).toBe(report.reportSha256);expect(found!.bytes.byteLength).toBe(report.reportByteLength);downloads.push({kind:'m68-report',id:report.id,sha256:report.reportSha256,bytes:found!.bytes.byteLength})}
  console.log(m73CanonicalJson({status:'m73_recovery_runtime_reconstruction_passed',companyId:company,versions:{m64:manual!.versions.length,m66:sourceWorksheet!.versions.length,m67:annual!.versions.length,m68:evidence!.versions.length,m71:corporate!.versions.length},downloads,corporateHeadSha256:corporate!.versions.at(-1)!.versionSha256}))
 }finally{await connection.close()}
 const verify=createPostgresConnection(adminUrl.toString(),{tls:false,maxConnections:1});try{expect(await inventory(verify)).toEqual(receipt.inventory)}finally{await verify.close()}
},120000)
