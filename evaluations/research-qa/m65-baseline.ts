/** Dedicated local QA baseline; no cloud target or raw rows persisted. */
import postgres from '../../packages/neuvetra-database/node_modules/postgres'
import {open} from 'node:fs/promises'
import {collectSourceManifest,hashManifestValue} from '../../tools/staging/create-source-manifest'
const sql=postgres('postgres://m63_test_admin@127.0.0.1:55463/m65_qa',{ssl:false,max:1,onnotice:()=>{}})
try{
 const versions=await sql.unsafe('select name,sha256 from neuvetra.schema_migrations order by name')
 if(versions.length!==10)throw Error('M65 QA requires preserved schema10 baseline before migration')
 const manifest=await collectSourceManifest(sql as any)
 const rowHashes=[]
 for(const table of manifest.tables){const rows=await sql.unsafe(`select to_jsonb(t) value from neuvetra.${table.name} t`);rowHashes.push({table:table.name,hashes:rows.map(row=>hashManifestValue(row.value)).sort()})}
 const target=await open(new URL('./m65-baseline-receipt.json',import.meta.url),'wx')
 try{await target.writeFile(JSON.stringify({status:'schema10_baseline_frozen',database:'m65_qa',manifest,rowHashes},null,2)+'\n');await target.sync()}finally{await target.close()}
 console.log(JSON.stringify({status:'schema10_baseline_frozen',tables:manifest.tables.length,records:manifest.tables.reduce((n,t)=>n+t.count,0)}))
}finally{await sql.end()}
