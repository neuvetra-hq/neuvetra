/** Independent M80 QA. Only a fresh local synthetic clone is writable. */
import { createPostgresConnection, type WorkspaceConnection, type WorkspaceSql } from '../../packages/neuvetra-database/src/index'
import { createHash } from 'node:crypto'

export const qaHash = (value: string) => createHash('sha256').update(value).digest('hex')
export async function qaBaseline(db: WorkspaceSql, names?: string[]) {
  const tables = names ?? (await db.query<{name:string}>("select tablename name from pg_tables where schemaname='neuvetra' and tablename<>'schema_migrations' order by tablename")).rows.map(r=>r.name)
  const out = []
  for (const name of tables) {
    if (!/^[a-z0-9_]+$/.test(name)) throw Error('Unsafe table name')
    const row = (await db.query<{count:string;bytes:string}>(`select count(*)::text count, coalesce(string_agg(neuvetra.m67_canonical(to_jsonb(t)),E'\n' order by neuvetra.m67_canonical(to_jsonb(t)) collate "C"),'') bytes from neuvetra.${name} t`)).rows[0]!
    out.push({ name, count: row.count, sha256: qaHash(row.bytes) })
  }
  return out
}

export async function qaMetadata(db: WorkspaceSql, original?: {relations:string[]; functions:string[]}) {
  const relations = original?.relations ?? (await db.query<{id:string}>("select c.oid::text id from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('neuvetra','auth') order by c.oid")).rows.map(r=>r.id)
  const functions = original?.functions ?? (await db.query<{id:string}>("select p.oid::text id from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('neuvetra','auth') order by p.oid")).rows.map(r=>r.id)
  const queries: Record<string,[string,unknown[]]> = {
    roles: ["select to_jsonb(r)-'rolpassword' value from pg_roles r order by rolname",[]],
    memberships: ['select to_jsonb(r) value from pg_auth_members r order by roleid,member,grantor',[]],
    defaultAcls: ['select to_jsonb(r) value from pg_default_acl r order by oid',[]],
    namespaces: ["select to_jsonb(r) value from pg_namespace r where nspname in ('neuvetra','auth','public') order by oid",[]],
    relations: ["select to_jsonb(r)-'reltuples'-'relpages'-'relallvisible'-'relallfrozen'-'relfrozenxid'-'relminmxid' value from pg_class r where oid=any($1::oid[]) order by oid",[relations]],
    attributes: ['select to_jsonb(r) value from pg_attribute r where attrelid=any($1::oid[]) order by attrelid,attnum',[relations]],
    constraints: ['select to_jsonb(r) value from pg_constraint r where conrelid=any($1::oid[]) order by oid',[relations]],
    policies: ['select to_jsonb(r) value from pg_policy r where polrelid=any($1::oid[]) order by oid',[relations]],
    triggers: ['select to_jsonb(r) value from pg_trigger r where tgrelid=any($1::oid[]) and (tgconstraint=0 or exists(select 1 from pg_constraint c where c.oid=r.tgconstraint and c.conrelid=any($1::oid[]))) order by oid',[relations]],
    indexes: ['select to_jsonb(r) value from pg_index r where indrelid=any($1::oid[]) order by indexrelid',[relations]],
    functions: ['select to_jsonb(r) value from pg_proc r where oid=any($1::oid[]) order by oid',[functions]],
  }
  const records: Record<string,unknown[]> = {}
  for (const [name,[sql,params]] of Object.entries(queries)) records[name]=(await db.query(sql,params)).rows
  return { identities:{relations,functions}, records }
}

export async function qaClone() {
  const name='m80_qa_foundation_'+Date.now(), baseline='m78_author_native_1789620106488'
  if (!/^m80_qa_foundation_[0-9]+$/.test(name)) throw Error('Isolated QA clone only')
  const admin=createPostgresConnection('postgres://supabase_admin@127.0.0.1:55472/postgres',{tls:false,maxConnections:1})
  try {
    if ((await admin.query('select 1 from pg_database where datname=$1',[name])).rows.length) throw Error('Occupied target refused')
    await admin.exec(`create database ${name} template ${baseline}`)
  } finally { await admin.close() }
  const operator=createPostgresConnection(`postgres://supabase_admin@127.0.0.1:55472/${name}`,{tls:false,maxConnections:1})
  return {name,baseline,operator,runtimeUrl:`postgres://neuvetra_runtime@127.0.0.1:55472/${name}`}
}

export async function qaAs<T>(db: WorkspaceConnection, actor:string, fn:(tx:WorkspaceSql)=>Promise<T>) {
  return db.transaction(async tx=>{ await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[actor]);return fn(tx) })
}
