/** Read-only application bundle preflight on an already authorized fictional QA clone. */
import {createPostgresConnection} from '../../packages/neuvetra-database/src/hosted'
import {createLocalBundle,localSource} from '../../tools/staging/m78-backup'
const name='m78_qa_ci_1789619016779',db=createPostgresConnection('postgres://supabase_admin@127.0.0.1:55472/'+name,{tls:false,maxConnections:1})
try{
 const shape=(await db.query<{cast_address:string;host_address:string}>("select inet_server_addr()::text cast_address,host(inet_server_addr()) host_address")).rows[0]!
 if(shape.cast_address!=='127.0.0.1/32'||shape.host_address!=='127.0.0.1')throw Error('Observed IPv4 address fixture changed.')
 const source=await localSource(db);if(source.name!==name||source.address!==shape.host_address||source.port!==55472||source.actor!=='supabase_admin')throw Error('Exact local source fence not satisfied.')
 const bundle=await createLocalBundle(db,'C:/Users/nimab/Neuvetra/m63-runtime/pgsql/bin/pg_dump.exe',21)
 const receipt={status:'independent_m78_readonly_bundle_source_regression_pass',database:name,source,observedAddress:shape,tables:bundle.inventory.tables.length,contentEntries:bundle.content.entries.length,dumpBytes:Buffer.from(bundle.dumpBase64,'base64').length,dumpSha256:bundle.dumpSha256,metadataRowsAndDumpReadOnly:true,plaintextArchivesWritten:false,customerData:false,mutations:false}
 await Bun.write('.superpowers/m78-operator-source-regression.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt))
}finally{await db.close()}
