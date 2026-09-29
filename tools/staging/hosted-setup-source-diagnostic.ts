/** Read-only, fixed-project diagnostics for a refused paired backup. Emits counts and fixed codes only. */
import {randomUUID} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {createPostgresConnection} from '../../packages/neuvetra-database/src/hosted'
import {loadStagingDatabaseCa} from '../../packages/neuvetra-database/src/staging-tls'
import {operatorUrlFromExport,selectSyntheticTenantActors} from './hosted-setup-hosted-backup'
import {captureState,captureAuth,sha,requireRecovery} from './hosted-setup-restore-core'

const exportPath='C:\\Users\\nimab\\Neuvetra\\env.json.txt'
const caPath='tools/cloud/fixtures/supabase-prod-ca-2021.crt'
const caSha='700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7'
const refusal=(error:unknown)=>error instanceof Error&&/^HS_RECOVERY_[A-Z0-9_]+$/.test(error.message)?error.message:/^[0-9A-Z]{5}$/.test(String((error as {code?:unknown})?.code))?`POSTGRES_${(error as {code:string}).code}`:'DIAGNOSTIC_STAGE_FAILED'

async function main(){
  let stage='ca'
  try{
  requireRecovery(sha(await readFile(caPath))===caSha,'CA_PIN_CHANGED')
  stage='export'
  const url=operatorUrlFromExport(await readFile(exportPath,'utf8'))
  stage='connect'
  const source=createPostgresConnection(url.toString(),{maxConnections:1,tlsCaPem:await loadStagingDatabaseCa({caFile:caPath})})
  try{
    stage='counts'
    const capability=(await source.query<{can_set_runtime:boolean;can_read_receipts:boolean}>("select pg_has_role(current_user,'neuvetra_runtime','SET') can_set_runtime,has_table_privilege(current_user,'neuvetra.schema_migrations','SELECT') can_read_receipts")).rows[0]
    const counts=(await source.query<{tables:string;views:string;companies:string;members:string}>(`select
      (select count(*)::text from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='neuvetra' and c.relkind='r') tables,
      (select count(*)::text from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='neuvetra' and c.relkind in('v','m','f','p')) views,
      (select count(*)::text from neuvetra.companies) companies,
      (select count(*)::text from neuvetra.company_members) members`)).rows[0]
    stage='members'
    const members=(await source.query<{company_id:string;user_id:string}>('select company_id::text,user_id::text from neuvetra.company_members order by company_id,user_id')).rows
    stage='outsider'
    let outsider:string
    do{outsider=randomUUID()}while((await source.query<{present:boolean}>('select exists(select 1 from auth.users where id=$1) present',[outsider])).rows[0]?.present)
    stage='actors'
    const actors=selectSyntheticTenantActors(members,outsider)
    stage='capture'
    let state='not_run',auth='not_run'
    try{await source.transaction(async tx=>{await tx.exec('set transaction isolation level repeatable read read only');await captureState(tx,actors)});state='pass'}catch(error){state=refusal(error)}
    if(state==='pass')try{await source.transaction(async tx=>{await tx.exec('set transaction isolation level repeatable read read only');await captureAuth(tx,actors)});auth='pass'}catch(error){auth=refusal(error)}
    return {profile:'hosted-setup-source-diagnostic.v1',readOnly:true,counts,actorCount:actors.length,capability,state,auth}
  }finally{await source.close()}
  }catch(error){throw Error(`DIAGNOSTIC_${stage}_${refusal(error)}`)}
}
if(import.meta.main){try{console.log(JSON.stringify(await main()))}catch(error){const status=error instanceof Error&&/^DIAGNOSTIC_[a-z]+_(?:HS_RECOVERY_[A-Z0-9_]+|POSTGRES_[0-9A-Z]{5}|DIAGNOSTIC_STAGE_FAILED)$/.test(error.message)?error.message:'DIAGNOSTIC_FAILED';console.error(JSON.stringify({profile:'hosted-setup-source-diagnostic.v1',status}));process.exitCode=1}}
