/** QA-only local schema-14 freeze. Stores hashes, never raw inherited records. */
import postgres from '../../packages/neuvetra-database/node_modules/postgres'
import {open} from 'node:fs/promises'
import {hashManifestValue} from '../../tools/staging/create-source-manifest'
import {readMigrationManifest} from '../../packages/neuvetra-database/src/staging-migrations'
const sql=postgres('postgres://m63_test_admin@127.0.0.1:55463/m71_qa_v14',{ssl:false,max:1,onnotice:()=>{},connection:{timezone:'UTC',default_transaction_read_only:true}})
try{
 const receipts=await sql.unsafe('select name,sha256 from neuvetra.schema_migrations order by name')
 if(receipts.length!==14)throw Error('Expected isolated restored schema14')
 const manifest=(await readMigrationManifest()).slice(0,14)
 for(let i=0;i<14;i++)if(receipts[i]!.name!==manifest[i]!.name||receipts[i]!.sha256!==manifest[i]!.sha256)throw Error('Schema14 receipt mismatch')
 const tables=await sql.unsafe("select tablename from pg_tables where schemaname='neuvetra' order by tablename")
 const rowHashes=[]
 for(const {tablename} of tables){
  if(!/^[a-z0-9_]+$/.test(tablename))throw Error('Unsafe table name')
  const rows=await sql.unsafe(`select to_jsonb(t) value from neuvetra.${tablename} t`)
  rowHashes.push({table:tablename,hashes:rows.map(row=>hashManifestValue(row.value)).sort()})
 }
 const file=await open(new URL('./m71-qa-schema14-baseline.json',import.meta.url),'wx')
 try{await file.writeFile(JSON.stringify({database:'m71_qa_v14',schemaVersion:14,receipts,rowHashes},null,2)+'\n')}finally{await file.close()}
 console.log(JSON.stringify({schemaVersion:14,tables:rowHashes.length,rows:rowHashes.reduce((n,t)=>n+t.hashes.length,0)}))
}finally{await sql.end()}
