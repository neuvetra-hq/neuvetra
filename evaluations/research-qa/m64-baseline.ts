import postgres from '../../packages/neuvetra-database/node_modules/postgres';
import {collectSourceManifest} from '../../tools/staging/create-source-manifest';
const results=[];
for(const name of ['m63_integration','m64_qa']){const sql=postgres(`postgres://m63_test_admin@127.0.0.1:55463/${name}`,{ssl:false,max:1,onnotice:()=>{}});try{results.push(await collectSourceManifest(sql as any))}finally{await sql.end()}}
const [a,b]=results;
if(JSON.stringify(a!.tables)!==JSON.stringify(b!.tables)||JSON.stringify(a!.metadata)!==JSON.stringify(b!.metadata))throw Error('clone mismatch');
await Bun.write(new URL('./m64-baseline-receipt.json',import.meta.url),JSON.stringify({status:'exact-clone',source:'m63_integration',target:'m64_qa',tables:b!.tables,metadata:b!.metadata},null,2)+'\n');
console.log(JSON.stringify({status:'exact-clone',tables:b!.tables.length,records:b!.tables.reduce((n,t)=>n+t.count,0)}));
