import {createPostgresConnection} from '../../packages/neuvetra-database/src/hosted'
import {hashManifestValue} from '../../tools/staging/create-source-manifest'
const db=createPostgresConnection('postgres://m63_test_admin@127.0.0.1:55463/m68_qa',{tls:false})
try {
 const schema=(await db.query('select * from neuvetra.schema_migrations order by name')).rows
 if(schema.length!==13)throw Error('Untouched schema13 required')
 const tables=(await db.query<{tablename:string}>("select tablename from pg_tables where schemaname='neuvetra' order by tablename")).rows
 const rowHashes=[]
 for(const {tablename} of tables){if(!/^[a-z_]+$/.test(tablename))throw Error('Unsafe identifier');rowHashes.push({table:tablename,hashes:(await db.query<{value:any}>(`select to_jsonb(t) value from neuvetra.${tablename} t`)).rows.map(r=>hashManifestValue(r.value)).sort()})}
 const receipt={observedAt:new Date().toISOString(),database:'m68_qa',schemaVersion:13,rowHashes}
 const path=new URL('./m68-independent-baseline.json',import.meta.url)
 if(await Bun.file(path).exists())throw Error('Never overwrite baseline')
 await Bun.write(path,JSON.stringify(receipt,null,2)+'\n')
 console.log(JSON.stringify({tables:rowHashes.length,records:rowHashes.reduce((n,t)=>n+t.hashes.length,0),schemaVersion:13}))
}finally{await db.close()}
