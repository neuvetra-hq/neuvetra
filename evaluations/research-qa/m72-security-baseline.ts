/** Independent read-only validation; explicit synthetic local source only. */
import postgres from '../../packages/neuvetra-database/node_modules/postgres'
import {readMigrationManifest} from '../../packages/neuvetra-database/src/staging-migrations'
const name=process.argv[2]
if(!['m68_qa','m72_security'].includes(name??''))throw Error('unauthorized database')
const sql=postgres(`postgres://m63_test_admin@127.0.0.1:55463/${name}`,{ssl:false,max:1,onnotice:()=>{},connection:{default_transaction_read_only:true}})
try{
 const receipts=await sql.unsafe('select name,sha256 from neuvetra.schema_migrations order by name')
 const expected=(await readMigrationManifest()).slice(0,14)
 if(receipts.length!==14||receipts.some((row,i)=>row.name!==expected[i]?.name||row.sha256!==expected[i]?.sha256))throw Error('baseline mismatch')
 console.log(JSON.stringify({database:name,canonical14Receipts:true,receipts}))
}finally{await sql.end()}
