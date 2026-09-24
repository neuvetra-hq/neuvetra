/** Author verification only; requires an already-created NEW hosted-shape synthetic clone. */
import {createApplicationBundle} from './m72-backup'
import {connectLocal,requireValue,exclusiveJson,sha,PROJECT} from './m72-common'
import {resolve} from 'node:path'
const [name,archive,receipt]=process.argv.slice(2)
let db:ReturnType<typeof connectLocal>|undefined
try{
 requireValue(name?.startsWith('m72_ops_')&&archive&&receipt)
 db=connectLocal(name)
 const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.toUpperCase().startsWith('PG')))
 Object.assign(env,{PGHOST:'127.0.0.1',PGPORT:'55463',PGDATABASE:name,PGUSER:'m63_test_admin',PGSSLMODE:'disable'})
 const bundle=await createApplicationBundle(db,'C:/Users/nimab/Neuvetra/m63-runtime/pgsql/bin/pg_dump.exe',env)
 const child=Bun.spawn(['powershell.exe','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',resolve('tools/staging/m72-seal.ps1'),'-ArchivePath',resolve(archive)],{stdin:'pipe',stdout:'pipe',stderr:'pipe'});await child.stdin.write(JSON.stringify(bundle));await child.stdin.end()
 const [,,code]=await Promise.all([new Response(child.stdout).text(),new Response(child.stderr).text(),child.exited]);requireValue(code===0)
 await exclusiveJson(receipt,{status:'m72_encrypted_application_backup',createdAt:bundle.createdAt,project:PROJECT,schemaVersion:14,archiveSha256:sha(new Uint8Array(await Bun.file(archive).arrayBuffer())),dumpSha256:bundle.dumpSha256,inventory:bundle.inventory,evidenceScope:'LOCAL SYNTHETIC AUTHOR DRILL; not hosted evidence'})
 console.log(JSON.stringify({status:'m72_local_backup_passed',tables:bundle.inventory.tables.length,records:bundle.inventory.tables.reduce((n,t)=>n+t.count,0)}))
}catch{console.error(JSON.stringify({status:'m72_local_backup_failed'}));process.exitCode=1}finally{await db?.close()}
