/** Read-only local persistence/restore evidence; never starts/stops/migrates a service. */
import postgres from '../../packages/neuvetra-database/node_modules/postgres'
import {createPostgresConnection,HostedWorkspaceDatabase} from '../../packages/neuvetra-database/src/hosted'
import {decodeCorporateRegister} from '../../apps/site-web/src/lib/m71-api'
import {collectSourceManifest,hashManifestValue} from '../../tools/staging/create-source-manifest'
import {m71Export} from '../../packages/neuvetra-database/src/m71'
import type {WorkspaceConnection} from '../../packages/neuvetra-database/src/workspace'
const candidate=process.env.M71_QA_RECOVERY_CANDIDATE??'final'
if(!['final','release','parity'].includes(candidate))throw Error('Explicit final or release QA candidate required')
const sourceDatabase=candidate==='parity'?'m71_qa_parity':candidate==='release'?'m71_qa_release':'m71_qa_final',targetDatabase=candidate==='parity'?'m71_qa_parity_restore':candidate==='release'?'m71_qa_release_restore':'m71_qa_restore'
const mode=process.argv[2],database=mode==='before'?sourceDatabase:mode==='after'?targetDatabase:null
if(!database)throw Error('Use explicit before or after mode for isolated QA databases')
const fixture=await Bun.file(new URL('./m71-qa-native-fixture.json',import.meta.url)).json()
const admin=postgres(`postgres://m63_test_admin@127.0.0.1:55463/${database}`,{ssl:false,max:1,onnotice:()=>{},connection:{timezone:'UTC',default_transaction_read_only:true}})
const runtime=createPostgresConnection(`postgres://neuvetra_runtime@127.0.0.1:55463/${database}`,{tls:false})
const db=new(HostedWorkspaceDatabase as unknown as new(c:WorkspaceConnection,r:string)=>HostedWorkspaceDatabase)(runtime,'abcdefghijklmnopqrst')
try{
 const readiness=await db.checkReadiness();if(readiness.schemaVersion!==15)throw Error('Expected schema15')
 const register=await db.findCorporateInventory(fixture.actorIds.owner,fixture.company)
 if(!register||hashManifestValue(register)!==hashManifestValue(fixture.register))throw Error('Fresh process readback differs from native fixture')
 await decodeCorporateRegister(register,fixture.company)
 if(m71Export(register.versions[0]!)!==fixture.initialExport)throw Error('Original exported bytes changed')
 const manifest=await collectSourceManifest(admin as any)
 const observation={schemaVersion:15,company:fixture.company,versionCount:register.versions.length,registerSha256:hashManifestValue(register),initialExportSha256:new Bun.CryptoHasher('sha256').update(fixture.initialExport).digest('hex'),manifest}
 if(mode==='before'){await Bun.write(new URL('./m71-qa-before-restore.json',import.meta.url),JSON.stringify(observation,null,2)+'\n')}
 else{
  const before=await Bun.file(new URL('./m71-qa-before-restore.json',import.meta.url)).json()
  const comparable=(value:typeof observation)=>({...value,manifest:{tables:value.manifest.tables,metadata:value.manifest.metadata,roles:value.manifest.roles}})
  // Database name, snapshot timestamp and transaction ID identify the read; they must differ after restore.
  if(hashManifestValue(comparable(before))!==hashManifestValue(comparable(observation)))throw Error('Restored table/catalog/role manifest differs')
  await Bun.write(new URL('./m71-qa-recovery-result.json',import.meta.url),JSON.stringify({status:'pass',checks:['fresh_process_native_readback','production_frontend_decoder','exact_original_export','restored_complete_schema_manifest'],database,sourceDatabase,...observation},null,2)+'\n')
 }
 console.log(JSON.stringify({status:'pass',mode,database,versions:register.versions.length,tables:manifest.tables.length,rows:manifest.tables.reduce((n,t)=>n+t.count,0)}))
}finally{await db.close();await admin.end()}
