/** Read-only metadata comparison of approved synthetic20 source and its failed fresh restore. */
import {createPostgresConnection} from '../../packages/neuvetra-database/src/hosted'
import {createHash} from 'node:crypto'
const names=['m77_ops_failed_state20','m78_ops_upgrade_1789619903954'],dbs=names.map(n=>createPostgresConnection('postgres://supabase_admin@127.0.0.1:55472/'+n,{tls:false,maxConnections:1})),hash=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex')
try{
 const query="select table_name,column_name,to_jsonb(c)-'table_catalog' raw,((to_jsonb(c)-'table_catalog')||jsonb_build_object('udt_catalog',case when c.udt_catalog=current_database() then '<current-database>' else c.udt_catalog end,'domain_catalog',case when c.domain_catalog=current_database() then '<current-database>' else c.domain_catalog end)) normalized from information_schema.columns c where table_schema='neuvetra' order by table_name,ordinal_position"
 const data=await Promise.all(dbs.map(db=>db.query<{table_name:string;column_name:string;raw:any;normalized:any}>(query))),[a,b]=data.map(x=>x.rows),fields=new Set<string>()
 if(!a.length||a.length!==b.length)throw Error('Column count changed.')
 for(let i=0;i<a.length;i++){if(a[i]!.table_name!==b[i]!.table_name||a[i]!.column_name!==b[i]!.column_name)throw Error('Column identity changed.');for(const key of Object.keys(a[i]!.raw))if(JSON.stringify(a[i]!.raw[key])!==JSON.stringify(b[i]!.raw[key]))fields.add(key);if(hash(a[i]!.normalized)!==hash(b[i]!.normalized))throw Error('Unexpected column drift remains.')}
 if([...fields].sort().join(',')!=='udt_catalog')throw Error('Expected only current-db UDT catalog discrepancy.')
 const controls=(await dbs[0]!.query<{value:string|null;normalized:string|null}>("select value,case when value=current_database() then '<current-database>' else value end normalized from (values(current_database()),(null::text),('foreign-catalog'::text)) v(value)")).rows
 if(controls[0]!.normalized!=='<current-database>'||controls[1]!.normalized!==null||controls[2]!.normalized!=='foreign-catalog')throw Error('Null/foreign catalog values lost.')
 const receipt={status:'independent_m78_current_catalog_normalization_pass',sources:names,metadataOnly:true,mutations:false,columnCount:a.length,rawChangedFields:[...fields],allOtherAttributesExact:true,normalizedColumnMetadataEqual:true,nullForeignValuesPreserved:true,sourceNormalizedSha256:hash(a.map(x=>x.normalized)),restoredNormalizedSha256:hash(b.map(x=>x.normalized))}
 await Bun.write('.superpowers/m78-operator-catalog-regression.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt))
}finally{await Promise.all(dbs.map(db=>db.close()))}
