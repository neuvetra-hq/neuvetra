/** Metadata-only regression against a previously authorized fictional QA clone. */
import {createPostgresConnection} from '../../packages/neuvetra-database/src/hosted'
const db=createPostgresConnection('postgres://supabase_admin@127.0.0.1:55472/m78_qa_ci_1789619016779',{tls:false,maxConnections:1})
try{
 const base="from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='neuvetra' and not t.tgisinternal"
 let refused=false;try{await db.query("select pg_get_triggerdef(t.oid)||':'||t.tgenabled definition "+base)}catch(e){if((e as any).code!=='42725')throw e;refused=true}
 if(!refused)throw Error('Original ambiguity not reproduced.')
 const rows=(await db.query<{definition:string;enabled:string}>("select pg_get_triggerdef(t.oid)||':'||t.tgenabled::text definition,t.tgenabled::text enabled "+base)).rows
 if(!rows.length||rows.some(r=>!r.definition.endsWith(':'+r.enabled)||!/^[ODRA]$/.test(r.enabled)))throw Error('Corrected trigger state not preserved.')
 const receipt={status:'independent_m78_trigger_char_cast_regression_pass',database:'m78_qa_ci_1789619016779',originalExpressionRefusedCode:'42725',correctedExpressionRows:rows.length,exactEnabledSuffixVerified:true,metadataOnly:true,mutations:false}
 await Bun.write('.superpowers/m78-operator-char-regression.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt))
}finally{await db.close()}
