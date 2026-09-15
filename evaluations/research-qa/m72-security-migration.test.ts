import {test,expect,afterAll} from 'bun:test'
import {createPostgresConnection,HostedWorkspaceDatabase} from '../../packages/neuvetra-database/src/hosted'
import {readMigrationManifest} from '../../packages/neuvetra-database/src/staging-migrations'
import {inventory,sameRows} from '../../tools/staging/m72-common'
const db=createPostgresConnection('postgres://m63_test_admin@127.0.0.1:55463/m72_security',{tls:false,maxConnections:1})
const runtime=createPostgresConnection('postgres://neuvetra_runtime@127.0.0.1:55463/m72_security',{tls:false,maxConnections:1})
const native=process.env.M72_SECURITY_NATIVE==='enabled'?test:test.skip
afterAll(async()=>{await db.close();await runtime.close()})
native('new app refuses unmigrated14; failed canonical15 transaction preserves rows, catalogs, roles and receipts',async()=>{
 const hosted=new (HostedWorkspaceDatabase as any)(runtime,'abcdefghijklmnopqrst')
 await expect(hosted.checkReadiness()).rejects.toThrow('Staging schema receipt mismatch')
 const before=await db.transaction(tx=>inventory(tx)),manifest=await readMigrationManifest()
 expect(manifest[14]!.sha256).toBe('2766561decde3ea64bf56f30b1b67a9144318e14b6efecaa71e05e8ae6351d19')
 let created=false
 await expect(db.transaction(async tx=>{
  await tx.exec(manifest[14]!.sql)
  await tx.query('insert into neuvetra.schema_migrations(name,sha256) values($1,$2)',[manifest[14]!.name,manifest[14]!.sha256])
  created=(await tx.query<any>("select to_regclass('neuvetra.corporate_inventory_versions') is not null present")).rows[0].present
  await tx.exec("select 1/0")
 })).rejects.toThrow()
 expect(created).toBe(true)
 const after=await db.transaction(tx=>inventory(tx))
 expect(after).toEqual(before)
 expect(()=>sameRows(before,after)).not.toThrow()
 expect((await db.query<any>('select count(*)::int count from neuvetra.schema_migrations')).rows[0].count).toBe(14)
 expect((await db.query<any>("select to_regclass('neuvetra.corporate_inventory_versions') absent")).rows[0].absent).toBeNull()
},30000)
