/** Fictional QA only. Imports do not connect or apply migrations. */
import {createPostgresConnection,readMigrationManifest,HostedWorkspaceDatabase,provisionStagingRoster,createM71Seed,type WorkspaceConnection} from '../../packages/neuvetra-database/src/index'
import {createM73Authority} from '../../apps/site-api/src/calculation/m73-authority'
import {createM74Authority} from '../../apps/site-api/src/calculation/m74-authority'
import {createM76DieselAuthority} from '../../apps/site-api/src/calculation/m76-authority'
import {createM77Authority} from '../../apps/site-api/src/calculation/m77-authority'
import {blankProcessScreen} from '../../apps/site-web/src/lib/m78-form'
import {buildM78Dependencies} from '../../packages/neuvetra-database/src/m78-reconciliation'
import {m78Hash} from '../../packages/neuvetra-database/src/m78'
import {M78_PERIOD,type M78Register} from '../../packages/neuvetra-database/src/m78-contract'

export const M78_QA_MIGRATION='546673470c33da80dc1e0b377646fa09b921e1231535da7c1af43ec866d48736'
// CI clones the exact current manifest; historical local schema21–23 fixtures remain supported.
// This test-only admission never applies SQL or changes closed hosted operator gates.
export function validateM78QaManifest(manifest:ReadonlyArray<{name:string;sha256:string}>){
 if(![21,22,23].includes(manifest.length)||manifest[20]?.name!=='0021_scope1_inventory.sql'||manifest[20]?.sha256!==M78_QA_MIGRATION)throw Error('Exact reviewed Scope 1 QA manifest required.')
 if(manifest.length>=22&&(manifest[21]?.name!=='0022_scope1_beta_foundation.sql'||manifest[21]?.sha256!=='0ee148b366e803e8cf28187393f9e5a6f19b29f5bb54578e359db7cbcd795e35'))throw Error('Unreviewed setup migration refused by QA fixture.')
 if(manifest.length===23&&(manifest[22]?.name!=='0023_company_setup.sql'||manifest[22]?.sha256!=='d9f4a69bfcd0c6fe19201d2893c19bb8a0356edb647b522812c7fce51d62babb'))throw Error('Unreviewed company setup migration refused by QA fixture.')
}
export function m78QaBaseline(raw:string){const u=new URL(raw),ci=u.port==='55463'&&u.username==='m63_test_admin'&&u.pathname==='/m63_integration',local=u.port==='55472'&&u.username==='supabase_admin'&&u.pathname==='/m78_author_native_1789620106488';if(u.hostname!=='127.0.0.1'||(!ci&&!local)||u.password||u.search||u.hash)throw Error('Only exact board-approved fictional baseline is allowed.');return u}
export function m78QaName(name:string){if(!/^m78_qa_[a-z0-9_]+$/.test(name))throw Error('Fresh isolated M78 QA database required.');return name}
export async function createM78QaFixture(raw:string,name:string){
 const baseline=m78QaBaseline(raw);m78QaName(name)
 const manifest=await readMigrationManifest()
 const adminUrl=new URL(raw);adminUrl.pathname='/postgres';const admin=createPostgresConnection(adminUrl.toString(),{tls:false,maxConnections:1}),source=createPostgresConnection(raw,{tls:false,maxConnections:1});let operator:WorkspaceConnection|undefined,runtime:WorkspaceConnection|undefined
 try{
  const receipts=(await source.query<{name:string;sha256:string}>('select name,sha256 from neuvetra.schema_migrations order by name')).rows
  validateM78QaManifest(manifest.slice(0,23))
  if(receipts.length!==manifest.length)validateM78QaManifest(receipts)
  if(JSON.stringify(receipts)!==JSON.stringify(manifest.slice(0,receipts.length).map(({name,sha256})=>({name,sha256}))))throw Error('Baseline must already contain the exact reviewed manifest prefix; QA never applies SQL.')
  await source.close() // PostgreSQL template must have no active source connection.
  if((await admin.query('select 1 from pg_database where datname=$1',[name])).rows.length)throw Error('Occupied QA database refused.')
  await admin.exec(`create database ${name} template ${baseline.pathname.slice(1)}`)
  const target=new URL(raw);target.pathname='/'+name;operator=createPostgresConnection(target.toString(),{tls:false,maxConnections:1})
  const projectRef=(await operator.query<{project_ref:string}>('select project_ref from neuvetra.staging_target')).rows[0]!.project_ref
  const users={owner:crypto.randomUUID(),preparer:crypto.randomUUID(),reviewer:crypto.randomUUID(),member:crypto.randomUUID(),outsider:crypto.randomUUID(),uninvited:crypto.randomUUID()},companyId=crypto.randomUUID(),otherCompanyId=crypto.randomUUID()
  for(const id of Object.values(users))await operator.query('insert into auth.users(id)values($1)',[id])
  await provisionStagingRoster(operator,{expectedProjectRef:projectRef,workspaceId:companyId,ownerUserId:users.owner,members:[{userId:users.preparer,role:'admin'},{userId:users.reviewer,role:'admin'},{userId:users.member,role:'member'}]})
  await provisionStagingRoster(operator,{expectedProjectRef:projectRef,workspaceId:otherCompanyId,ownerUserId:users.outsider,members:[]})
  target.username='neuvetra_runtime';runtime=createPostgresConnection(target.toString(),{tls:false,maxConnections:4})
  const database=new(HostedWorkspaceDatabase as unknown as new(c:WorkspaceConnection,r:string)=>HostedWorkspaceDatabase)(runtime,projectRef),authorities={gas:createM73Authority(),mobile:createM74Authority(),diesel:createM76DieselAuthority(),fugitive:createM77Authority()}
  await database.saveCorporateInventory(users.owner,companyId,null,{snapshot:createM71Seed(),expectedVersionId:null,expectedVersionSha256:null,correctionReason:null,idempotencyKey:crypto.randomUUID()})
  return {name,operator,runtime,database,authorities,users,companyId,otherCompanyId,migrationSha256:manifest[20]!.sha256,schemaVersion:receipts.length,close:async()=>{await runtime!.close();await operator!.close()}}
 }catch(error){await runtime?.close();await operator?.close();throw error}finally{await source.close();await admin.close()}
}
export function m78QaProcessInput(r:M78Register){const c=r.coverageVersion,draft=blankProcessScreen({coverageVersionId:c.id,coverageVersionSha256:c.versionSha256,processCoverageItemId:c.snapshot.coverageItems.find(i=>i.domain==='process'&&i.entityId===null&&i.sourceId===null)!.id,period:M78_PERIOD}),facility=c.snapshot.facilities[0];draft.declaration=null;draft.evidenceStatements=[{reference:'M78-QA-FICTIONAL-INSPECTION',issuer:'Fictional local QA inspector',description:'Fictional inspection with unresolved process and seven-gas applicability; does not assert absence.',issuedOn:'2025-12-31',purpose:'process_inspection',entityId:facility.entityId,facilityId:facility.id}];return {...draft,expectedVersionId:null,expectedVersionSha256:null,expectedDependencySha256:buildM78Dependencies(r.proof,'process_screen',m78Hash).dependencySha256,correctionReason:null,idempotencyKey:crypto.randomUUID()}}
