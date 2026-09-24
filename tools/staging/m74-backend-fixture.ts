/** New local author DB only; copies preserved canonical14 fixture then appends15/16. */
import {createPostgresConnection,readMigrationManifest} from '../../packages/neuvetra-database/src/index'
const name=process.argv[2],option=process.argv[3]
if(option!==undefined&&option!=='--ci-baseline=m63_integration'||process.argv.length>4)throw Error('Only the explicit CI baseline option is supported.')
const baseline=option?'m63_integration':'m68_qa',baselineVersion=option?(await readMigrationManifest()).length:14,port='55463'
if(!/^m74_author_[a-z0-9_]+$/.test(name??''))throw Error('New author database name required.')
const admin=createPostgresConnection(`postgres://m63_test_admin@127.0.0.1:${port}/postgres`,{tls:false,maxConnections:1})
let db:ReturnType<typeof createPostgresConnection>|undefined
try{
 if((await admin.query('select 1 from pg_database where datname=$1',[name])).rows.length)throw Error('Existing database refused.')
 await admin.exec(`create database ${name} template ${baseline}`)
 db=createPostgresConnection(`postgres://m63_test_admin@127.0.0.1:${port}/${name}`,{tls:false,maxConnections:1})
 const manifest=await readMigrationManifest(),before=(await db.query<{name:string;sha256:string}>('select name,sha256 from neuvetra.schema_migrations order by name')).rows
 if(before.length!==baselineVersion||before.some((r,i)=>r.name!==manifest[i]?.name||r.sha256!==manifest[i]?.sha256))throw Error('Baseline mismatch.')
 const preserved=async()=>{const tables=(await db!.query<{tablename:string}>("select tablename from pg_tables where schemaname='neuvetra' and tablename<>'schema_migrations' and tablename not like 'mobile_diesel_%' order by tablename")).rows;const out:Record<string,any>={};for(const {tablename} of tables)out[tablename]=(await db!.query(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) data from neuvetra.${tablename} t`)).rows[0];return out}
 const original=await preserved()
 await db.transaction(async tx=>{for(const migration of manifest.slice(baselineVersion)){await tx.exec(migration.sql);await tx.query('insert into neuvetra.schema_migrations(name,sha256) values($1,$2)',[migration.name,migration.sha256])}})
 const after=await preserved();for(const [table,value] of Object.entries(original)){const retained=new Set(after[table].data.map((row:unknown)=>JSON.stringify(row)));if(value.data.some((row:unknown)=>!retained.has(JSON.stringify(row))))throw Error('Historical application row changed during additive migration.')}
 console.log(JSON.stringify({status:'m74_new_author_fixture_ready',database:name,schemaVersion:manifest.length,historicalRowsPreserved:true}))
}catch(e){console.error(JSON.stringify({status:'m74_author_fixture_failed',code:(e as any)?.code,message:(e as Error).message}));process.exitCode=1}finally{await db?.close();await admin.close()}
