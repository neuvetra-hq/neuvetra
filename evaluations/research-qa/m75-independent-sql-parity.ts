/** Independent scenarios and expectations against the root-authored SQL
 * derivation and renderer. Pure structural data is deliberately not a native
 * saved-version validation substitute; direct SQL and lifecycle checks differ. */
import {createPostgresConnection} from '../../packages/neuvetra-database/src/hosted'
import {classificationCases,independentGraph,qaHash} from './m75-independent-scenarios'
import {buildM75Dependencies,deriveM75RosterFindings,deriveM75Reconciliation,m75CanonicalJson} from '../../packages/neuvetra-database/src/m75-validation'
import {m75ReportSnapshot,m75RenderReport} from '../../packages/neuvetra-database/src/m75-report'
const previous=await Bun.file(new URL('./m75-independent-direct-sql-result.json',import.meta.url)).json(),name=process.env.M75_QA_PARITY_DB??previous.database
if(!/^m75_qa_[a-z0-9_]+$/.test(name))throw Error('Independent synthetic clone required')
const db=createPostgresConnection(`postgres://m63_test_admin@127.0.0.1:55463/${name}`,{tls:false,maxConnections:1}),hash=(v:unknown)=>qaHash(m75CanonicalJson(v)),cases:any[]=[]
try{
 const candidate=qaHash((await Bun.file('packages/neuvetra-database/src/migrations/0018_controlled_fleet.sql').text()).replace(/\r\n/g,'\n'))
 const receipt=(await db.query<{sha256:string}>("select sha256 from neuvetra.schema_migrations where name='0018_controlled_fleet.sql'")).rows[0]!.sha256;if(receipt!==candidate)throw Error('SQL clone must match exact current migration')
 await db.transaction(async tx=>{
  await tx.exec('SET TRANSACTION READ ONLY')
  for(const c of classificationCases){
   const g=independentGraph(),cv=()=>g.coverage.versions[0],heads=()=>g.mobile.worksheets.map((w:any)=>w.versions.find((v:any)=>v.id===w.headVersionId))
   const capture=()=>{g.version.dependencies=buildM75Dependencies(cv(),heads(),hash);g.reviews.forEach(r=>{r.dependencies=g.version.dependencies})}
   capture();c.mutate(g);if(c.refreshDependencies)capture();g.version.findings=deriveM75RosterFindings(g.version.activity,cv())
   const expected=deriveM75Reconciliation(g.companyId,cv(),heads(),g.version,g.reviews,hash)
   if(expected.status!==c.expectedStatus)throw Error('Independent expectation changed: '+c.id)
   const roster=(await tx.query<{v:unknown}>('select neuvetra.m75_roster_findings($1::text::jsonb,$2::text::jsonb) v',[JSON.stringify(g.version.activity),JSON.stringify(cv())])).rows[0]!.v
   const reconciliation=(await tx.query<{v:unknown}>('select neuvetra.m75_derive_reconciliation($1,$2::text::jsonb,$3::text::jsonb,$4::text::jsonb,$5::text::jsonb) v',[g.companyId,JSON.stringify(cv()),JSON.stringify(heads()),JSON.stringify(g.version),JSON.stringify(g.reviews)])).rows[0]!.v
   const snapshot=m75ReportSnapshot(g.version,g.reviews[0]??null,expected),html=(await tx.query<{v:string}>('select neuvetra.m75_render_report($1::text::jsonb) v',[JSON.stringify(snapshot)])).rows[0]!.v
   cases.push({id:c.id,expectedStatus:c.expectedStatus,rosterEqual:m75CanonicalJson(roster)===m75CanonicalJson(g.version.findings),reconciliationEqual:m75CanonicalJson(reconciliation)===m75CanonicalJson(expected),htmlEqual:html===m75RenderReport(snapshot)})
  }
  for(const marker of ['{{rows}} {{summary}} {{snapshot}} $& $$ $` $\'','<script>alert(1)</script> & " \u03c0\n']){
   const g=independentGraph(),cv=g.coverage.versions[0],heads=g.mobile.worksheets.map((w:any)=>w.versions[0]);g.version.dependencies=buildM75Dependencies(cv,heads,hash);g.version.statement.input.issuer=marker;g.version.findings=deriveM75RosterFindings(g.version.activity,cv);const r=deriveM75Reconciliation(g.companyId,cv,heads,g.version,[],hash),snapshot=m75ReportSnapshot(g.version,null,r),html=(await tx.query<{v:string}>('select neuvetra.m75_render_report($1::text::jsonb) v',[JSON.stringify(snapshot)])).rows[0]!.v
   cases.push({id:'literal_'+cases.length,rosterEqual:true,reconciliationEqual:true,htmlEqual:html===m75RenderReport(snapshot)})
  }
  for(const missingCoverage of [true,false]){const g=independentGraph(),coverage=missingCoverage?null:g.coverage.versions[0],heads=missingCoverage?[]:g.mobile.worksheets.map((w:any)=>w.versions[0]),expected=deriveM75Reconciliation(g.companyId,coverage,heads,null,[],hash),actual=(await tx.query<{v:unknown}>('select neuvetra.m75_derive_reconciliation($1,$2::text::jsonb,$3::text::jsonb,$4::text::jsonb,$5::text::jsonb) v',[g.companyId,JSON.stringify(coverage),JSON.stringify(heads),'null','[]'])).rows[0]!.v;if(expected.status!=='blocked'||expected.emissionsTotals!==null)throw Error('Empty state must remain blocked and unknown');cases.push({id:missingCoverage?'null_coverage_and_roster':'null_roster_retains_orphans',rosterEqual:true,reconciliationEqual:m75CanonicalJson(actual)===m75CanonicalJson(expected),htmlEqual:true})}
 })
 const failures=cases.filter(c=>!c.rosterEqual||!c.reconciliationEqual||!c.htmlEqual),result={status:failures.length?'fail':'pass',database:name,canonicalSqlSha256:receipt,count:cases.length,cases,scriptSha256:qaHash(await Bun.file(import.meta.path).text()),createdAt:new Date().toISOString()};await Bun.write('evaluations/research-qa/m75-independent-sql-parity-result.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,count:cases.length,failures}));if(failures.length)process.exitCode=1
}finally{await db.close()}
