/** Read-only actual isolated55472 role parity controls. No cluster, role or database mutation. */
import {test,expect} from 'bun:test'
import {createPostgresConnection} from '../../packages/neuvetra-database/src/hosted'
import {ROLE_SQL,MEMBERS_SQL,PROJECT,exclusiveJson} from './m73-common'
import {mkdir} from 'node:fs/promises'
import {resolve} from 'node:path'
const native=process.env.M73_OPERATORS_NATIVE==='enabled'?test:test.skip
native('existing55472 matching/mismatched role metadata preflight never alters cluster',async()=>{
 const db=createPostgresConnection('postgres://supabase_admin@127.0.0.1:55472/postgres',{tls:false,maxConnections:1})
 const dir=resolve('.tmp/m73-ops-role-'+Date.now());await mkdir(dir,{recursive:false})
 try{
  const read=()=>db.transaction(async tx=>{await tx.exec('set transaction isolation level repeatable read read only');return {roles:(await tx.query(ROLE_SQL)).rows,memberships:(await tx.query(MEMBERS_SQL)).rows}})
  const original=await read(),source=resolve(dir,'synthetic-role-metadata.json'),output=resolve(dir,'parity.json')
  await exclusiveJson(source,{status:'m73_encrypted_application_backup',schemaVersion:15,project:PROJECT,inventory:original,evidenceScope:'SYNTHETIC ROLE-PREFLIGHT CONTROL; not a backup or hosted source observation'})
  const run=async(input:string,out:string)=>{const child=Bun.spawn(['bun','run','tools/staging/m73-bootstrap-local.ts',input,out],{stdout:'pipe',stderr:'pipe'});const [stdout,,exitCode]=await Promise.all([new Response(child.stdout).text(),new Response(child.stderr).text(),child.exited]);return {stdout,exitCode}}
  const valid=await run(source,output);expect(valid.exitCode).toBe(0);expect(JSON.parse(valid.stdout).status).toBe('m73_existing_isolated_roles_exact')
  const modified=structuredClone(original);(modified.roles[0] as any).rolsuper=!(modified.roles[0] as any).rolsuper
  const mismatch=resolve(dir,'synthetic-role-mismatch.json'),refused=resolve(dir,'must-not-exist.json');await exclusiveJson(mismatch,{status:'m73_encrypted_application_backup',schemaVersion:15,project:PROJECT,inventory:modified,evidenceScope:'SYNTHETIC NEGATIVE ROLE-PREFLIGHT CONTROL'})
  expect((await run(mismatch,refused)).exitCode).toBe(1);expect(await Bun.file(refused).exists()).toBe(false);expect(await read()).toEqual(original)
  await exclusiveJson(resolve(dir,'author-result.json'),{status:'m73_readonly_role_preflight_author_passed',port:55472,matchingAccepted:true,changedFlagRefused:true,rolesAndMembershipsUnchanged:true,hostedEvidence:false,backupEvidence:false})
  console.log(JSON.stringify({status:'m73_readonly_role_preflight_author_passed',evidence:resolve(dir,'author-result.json')}))
 }finally{await db.close()}
},30000)
