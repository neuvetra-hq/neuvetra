import {expect,test} from 'bun:test'
import {createPostgresConnection,HostedWorkspaceDatabase} from '../../packages/neuvetra-database/src/index'
import {qaAs} from './m80-foundation-runtime-independent-20260924-fixture'

test.skipIf(process.env.NEUVETRA_M80_INDEPENDENT_PRIVILEGES!=='1')('M80 exact native new function, sequence and UPDATE authority',async()=>{
 const name='m80_qa_foundation_1790279919377',op=createPostgresConnection('postgres://supabase_admin@127.0.0.1:55472/'+name,{tls:false,maxConnections:1}),runtime=createPostgresConnection('postgres://neuvetra_runtime@127.0.0.1:55472/'+name,{tls:false,maxConnections:1})
 const results:unknown[]=[]
 try{
  const functions=(await op.query<any>("select p.proname,p.prosecdef,p.proconfig,r.rolname owner,has_function_privilege('neuvetra_runtime',p.oid,'EXECUTE') runtime,has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated,has_function_privilege('anon',p.oid,'EXECUTE') anon from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_roles r on r.oid=p.proowner where n.nspname='neuvetra' and p.proname in ('m80_assert_setup','save_scope1_beta_setup') order by p.proname")).rows
  expect(functions).toHaveLength(2)
  for(const f of functions){expect(f.proconfig).toEqual(['search_path=pg_catalog, neuvetra, pg_temp']);expect(f.owner).not.toBe('neuvetra_runtime');expect(f.runtime).toBe(f.proname==='save_scope1_beta_setup');expect(f.prosecdef).toBe(f.proname==='save_scope1_beta_setup');expect(f.authenticated).toBe(false);expect(f.anon).toBe(false)}
  const actor=(await op.query<{created_by:string}>('select created_by from neuvetra.scope1_beta_setup_versions order by created_at limit 1')).rows[0]!.created_by
  for(const [table,column]of [['scope1_beta_release_records','profile_id'],['scope1_beta_fixture_admissions','active'],['scope1_beta_setup_heads','revision'],['scope1_beta_setup_versions','revision'],['scope1_beta_requests','request_sha256'],['scope1_beta_audit','record_sha256']]){
   let code:string|undefined;try{await qaAs(runtime,actor,tx=>tx.exec('update neuvetra.'+table+' set '+column+'='+column+' where false'))}catch(e){code=(e as any).code}expect(code).toBe('42501');results.push({table,updateRefused:true})
  }
  let sequenceCode:string|undefined;try{await qaAs(runtime,actor,tx=>tx.query("select nextval('neuvetra.scope1_beta_audit_sequence_seq')"))}catch(e){sequenceCode=(e as any).code}expect(sequenceCode).toBe('42501')
  const company=(await op.query<{company_id:string}>('select company_id from neuvetra.scope1_beta_setup_versions where created_by=$1 order by created_at limit 1',[actor])).rows[0]!.company_id,ref=(await op.query<{project_ref:string}>('select project_ref from neuvetra.staging_target')).rows[0]!.project_ref
  expect((await new(HostedWorkspaceDatabase as any)(runtime,ref,true).findM80Foundation(actor,company)).currentVersion).toBeDefined()
  for(const sql of ["insert into neuvetra.scope1_beta_release_records select (jsonb_populate_record(null::neuvetra.scope1_beta_release_records,to_jsonb(r)||jsonb_build_object('id',gen_random_uuid(),'engine_sha256',repeat('0',64)))).* from neuvetra.scope1_beta_release_records r where id='81000000-0000-4000-8000-000000000001'","update neuvetra.scope1_beta_release_records set status='released',effective_at='2000-01-01T00:00:00Z',superseded_at='2001-01-01T00:00:00Z' where id='81000000-0000-4000-8000-000000000001'"]){
   await op.transaction(async tx=>{await tx.exec('alter table neuvetra.scope1_beta_release_records disable trigger scope1_beta_release_immutable');await tx.exec(sql);await tx.exec('set local role neuvetra_runtime');const connection={...runtime,transaction:async(fn:any)=>fn(tx)},db=new(HostedWorkspaceDatabase as any)(connection,ref,true);let refused=false;try{await db.findM80Foundation(actor,company)}catch{refused=true}expect(refused).toBe(true);throw Error('rollback duplicate or expired registry')}).catch(e=>{if(e.message!=='rollback duplicate or expired registry')throw e})
  }
  expect((await op.query('select id from neuvetra.scope1_beta_release_records')).rows).toHaveLength(4)
  await Bun.write('evaluations/research-qa/m80-foundation-runtime-independent-20260924-privileges.json',JSON.stringify({database:name,functions,updates:results,sequenceUseRefused:true,duplicateAndExpiredRegistryRefused:true,registryRestored:true,actualPostgres:true,syntheticOnly:true},null,2)+'\n')
 }finally{await runtime.close();await op.close()}
})
