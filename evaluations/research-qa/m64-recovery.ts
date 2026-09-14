import postgres from '../../packages/neuvetra-database/node_modules/postgres'
import {collectSourceManifest,hashManifestValue} from '../../tools/staging/create-source-manifest'
import {createPostgresConnection,HostedWorkspaceDatabase} from '../../packages/neuvetra-database/src/hosted'
import type {WorkspaceConnection} from '../../packages/neuvetra-database/src/workspace'
const manifests=[]
for(const name of ['m64_qa','m64_qa_restore']){const sql=postgres(`postgres://m63_test_admin@127.0.0.1:55463/${name}`,{ssl:false,max:1,onnotice:()=>{}});try{manifests.push(await collectSourceManifest(sql as any))}finally{await sql.end()}}
const [a,b]=manifests
if(JSON.stringify(a!.tables)!==JSON.stringify(b!.tables)||JSON.stringify(a!.metadata)!==JSON.stringify(b!.metadata))throw Error('M64 recovery mismatch')
const admin=createPostgresConnection('postgres://m63_test_admin@127.0.0.1:55463/m64_qa',{tls:false})
const subjects=(await admin.query<{company_id:string;created_by:string}>('select distinct company_id,created_by from neuvetra.electricity_worksheet_versions')).rows
await admin.close()
const construct=(name:string)=>new(HostedWorkspaceDatabase as unknown as new(c:WorkspaceConnection,ref:string)=>HostedWorkspaceDatabase)(createPostgresConnection(`postgres://neuvetra_runtime@127.0.0.1:55463/${name}`,{tls:false}),'abcdefghijklmnopqrst')
const source=construct('m64_qa'),restored=construct('m64_qa_restore')
try{await restored.checkReadiness();for(const subject of subjects){const original=await source.findElectricityWorksheet(subject.created_by,subject.company_id);const recovered=await restored.findElectricityWorksheet(subject.created_by,subject.company_id);if(hashManifestValue(original)!==hashManifestValue(recovered))throw Error('Recovered domain verification differs')}}finally{await source.close();await restored.close()}
const receipt={status:'passed',source:'m64_qa',target:'m64_qa_restore',tables:b!.tables,metadata:b!.metadata,worksheetsVerifiedUnderRestrictedRuntime:subjects.length,notes:'Local pg_dump/pg_restore; all rows hashed in memory only; original runtime role remains nonowner NOSUPERUSER NOBYPASSRLS; no Auth provider restore claim'}
await Bun.write(new URL('./m64-recovery-receipt.json',import.meta.url),JSON.stringify(receipt,null,2)+'\n')
console.log(JSON.stringify({status:'passed',tables:b!.tables.length,records:b!.tables.reduce((n,t)=>n+t.count,0),worksheets:subjects.length}))
