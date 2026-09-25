/** Candidate2 QA helpers, prepared only. Importing does not connect or execute native work.
 * Caller must first verify root's frozen candidate and exact newly authorized fixture names.
 * No raw row/identity/token/digest exports: rows are reduced to ordered hashes and counts.
 */
import type { WorkspaceConnection } from "../../packages/neuvetra-database/src/workspace"
import { connect } from "node:net"

type Target = { databaseName: string; runtimeRole: string; ownerRole: string }
type Queryable = Pick<WorkspaceConnection, "query" | "exec">
const quote = (s: string) => `"${s.replaceAll('"', '""')}"`
const hash = (v: unknown) => new Bun.CryptoHasher("sha256").update(JSON.stringify(v)).digest("hex")
const canonical = (v: any): string => Array.isArray(v) ? `[${v.map(canonical).join(",")}]` : v !== null && typeof v === "object" ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical(v[k])}`).join(",")}}` : JSON.stringify(v)

async function assertTarget(db: Queryable, target: Target) {
  if (!/^m80_beta_access_qa_20260925[a-z0-9_]*$/.test(target.databaseName) || !/^m80_beta_access_runtime_qa_20260925[a-z0-9_]*$/.test(target.runtimeRole) || !/^m80_beta_access_owner_qa_20260925[a-z0-9_]*$/.test(target.ownerRole)) throw new Error("Exact root QA target names required")
  const row = (await db.query<{ database_name: string; host: string; port: number }>("select current_database() database_name,inet_server_addr()::text host,inet_server_port() port")).rows[0]
  if (row?.database_name !== target.databaseName || !["127.0.0.1", "::1"].includes(row.host) || row.port !== 55472) throw new Error("QA target mismatch")
}

/** Capture immediately before install, after replay, and after access operations. */
export async function captureLegacy(db: Queryable, target: Target) {
  await assertTarget(db, target)
  const tables = (await db.query<{ name: string }>("select c.relname name from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='neuvetra' and c.relkind in ('r','p') order by 1")).rows
  const rows: Record<string, unknown> = {}
  for (const table of tables) {
    rows[table.name] = (await db.query<{ count: string; sha256: string }>(`select count(*)::text count,encode(sha256(convert_to(coalesce(string_agg(j,E'\\n' order by j),''),'UTF8')),'hex') sha256 from (select to_jsonb(t)::text j from neuvetra.${quote(table.name)} t) x`)).rows[0]
  }
  const queries: Record<string, string> = {
    schemas: "select nspname,pg_get_userbyid(nspowner) owner,nspacl::text acl from pg_namespace where nspname in ('neuvetra','auth','public') order by 1",
    relations: "select c.relname,c.relkind,pg_get_userbyid(c.relowner) owner,c.relacl::text acl,c.relrowsecurity,c.relforcerowsecurity,c.reloptions,c.relpersistence,c.relreplident from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='neuvetra' order by c.relname",
    columns: "select c.relname,a.attnum,a.attname,format_type(a.atttypid,a.atttypmod) type,a.attnotnull,a.attidentity,a.attgenerated,a.attacl::text acl,pg_get_expr(d.adbin,d.adrelid) default_expression from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where n.nspname='neuvetra' and a.attnum>0 and not a.attisdropped order by c.relname,a.attnum",
    functions: "select p.proname,pg_get_function_identity_arguments(p.oid) args,pg_get_userbyid(p.proowner) owner,p.proacl::text acl,p.proconfig,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='neuvetra' and p.prokind in ('f','p') order by p.proname,2",
    constraints: "select c.conrelid::regclass::text relation,c.conname,pg_get_constraintdef(c.oid,true) definition,c.convalidated,c.condeferrable,c.condeferred from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='neuvetra' order by 1,2",
    policies: "select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check from pg_policies where schemaname='neuvetra' order by tablename,policyname",
    indexes: "select tablename,indexname,indexdef from pg_indexes where schemaname='neuvetra' order by tablename,indexname",
    triggers: "select t.tgrelid::regclass::text relation,t.tgname,t.tgenabled,t.tgisinternal,pg_get_triggerdef(t.oid,true) definition from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace left join pg_constraint co on co.oid=t.tgconstraint left join pg_namespace cn on cn.oid=co.connamespace where n.nspname='neuvetra' and not (t.tgisinternal and coalesce(cn.nspname='neuvetra_beta',false)) order by 1,2",
    enums: "select t.typname,e.enumlabel,e.enumsortorder from pg_enum e join pg_type t on t.oid=e.enumtypid join pg_namespace n on n.oid=t.typnamespace where n.nspname='neuvetra' order by t.typname,e.enumsortorder",
    roles: "select rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolbypassrls,rolconnlimit,rolvaliduntil,rolconfig from pg_roles where rolname<>all($1::text[]) order by rolname",
    memberships: "select pg_get_userbyid(roleid) role,pg_get_userbyid(member) member,pg_get_userbyid(grantor) grantor,admin_option,inherit_option,set_option from pg_auth_members where roleid not in (select oid from pg_roles where rolname=any($1::text[])) and member not in (select oid from pg_roles where rolname=any($1::text[])) order by 1,2,3",
    defaults: "select pg_get_userbyid(d.defaclrole) owner,coalesce(n.nspname,'GLOBAL') schema,d.defaclobjtype kind,d.defaclacl::text acl from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace where pg_get_userbyid(d.defaclrole)<>all($1::text[]) order by 1,2,3",
  }
  const hashes: Record<string, { sha256: string; records: number }> = {}
  for (const [name, sql] of Object.entries(queries)) {
    const values = (await db.query(sql, sql.includes("$1") ? [[target.runtimeRole, target.ownerRole]] : [])).rows
    hashes[name] = { sha256: hash(values), records: values.length }
  }
  // Report the exact allowed additive dependency separately; never hide arbitrary trigger drift.
  const allowedAddedFkTriggers = (await db.query("select t.tgrelid::regclass::text parent_relation,co.conrelid::regclass::text child_relation,co.conname,t.tgname from pg_trigger t join pg_constraint co on co.oid=t.tgconstraint join pg_namespace cn on cn.oid=co.connamespace join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='neuvetra' and t.tgisinternal and cn.nspname='neuvetra_beta' order by 1,2,3,4")).rows
  return { databaseName: target.databaseName, rows, hashes, allowedAddedFkTriggers }
}

export function compareLegacy(before: Awaited<ReturnType<typeof captureLegacy>>, after: Awaited<ReturnType<typeof captureLegacy>>) {
  const equalRows = canonical(before.rows) === canonical(after.rows)
  const changedMetadata = Object.keys(before.hashes).filter(k => canonical(before.hashes[k]) !== canonical(after.hashes[k]))
  const allowedFk = after.allowedAddedFkTriggers.every((r: any) => r.parent_relation === "neuvetra.companies" && r.child_relation === "neuvetra_beta.tenant_admissions")
  return { pass: before.databaseName === after.databaseName && equalRows && changedMetadata.length === 0 && allowedFk, equalRows, changedMetadata, allowedFkDependencies: allowedFk, addedFkTriggerCount: after.allowedAddedFkTriggers.length - before.allowedAddedFkTriggers.length }
}

/** Read-only exact privilege inventory; current-user probe performed separately on restricted login. */
export async function inspectOwnerSplit(db: Queryable, target: Target) {
  await assertTarget(db, target)
  const flags = (await db.query("select rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolbypassrls from pg_roles where rolname=any($1::text[]) order by 1", [[target.runtimeRole, target.ownerRole]])).rows
  const memberships = (await db.query("select pg_get_userbyid(roleid) role,pg_get_userbyid(member) member from pg_auth_members where roleid in(select oid from pg_roles where rolname=any($1::text[])) or member in(select oid from pg_roles where rolname=any($1::text[]))", [[target.runtimeRole, target.ownerRole]])).rows
  const crossSchema = (await db.query("select n.nspname,has_schema_privilege($1,n.oid,'USAGE') can_use,has_schema_privilege($1,n.oid,'CREATE') can_create from pg_namespace n where n.nspname in('neuvetra','auth') order by 1", [target.ownerRole])).rows
  const crossObjects = (await db.query("select n.nspname,c.relname,c.relkind,case when c.relkind='S' then has_sequence_privilege($1,c.oid,'USAGE,SELECT,UPDATE') else has_table_privilege($1,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') end effective_privilege from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('neuvetra','auth') and c.relkind in('r','p','v','m','f','S') order by 1,2", [target.ownerRole])).rows
  const functions = (await db.query("select p.proname,pg_get_function_identity_arguments(p.oid) args,pg_get_userbyid(p.proowner) owner,p.prosecdef,p.proconfig,p.proacl::text acl,has_function_privilege($1,p.oid,'EXECUTE') runtime_execute,has_function_privilege($2,p.oid,'EXECUTE') owner_execute from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='neuvetra_beta' order by 1,2", [target.runtimeRole, target.ownerRole])).rows
  const defaults = (await db.query("select coalesce(n.nspname,'GLOBAL') schema,defaclobjtype kind,defaclacl::text acl from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace where d.defaclrole=(select oid from pg_roles where rolname=$1) order by 1,2", [target.ownerRole])).rows
  const crossFunctions = (await db.query("select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) args,has_function_privilege($1,p.oid,'EXECUTE') can_execute from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('neuvetra','auth') order by 1,2,3", [target.ownerRole])).rows
  const owners = (await db.query("select 'schema' kind,n.nspname name,pg_get_userbyid(n.nspowner) owner from pg_namespace n where n.nspname='neuvetra_beta' union all select c.relkind::text,c.relname,pg_get_userbyid(c.relowner) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='neuvetra_beta' and c.relkind in('r','p','S') order by 1,2")).rows
  return { flags, memberships, crossSchema, crossObjects, crossFunctions, owners, functions, defaults }
}

/** Create under the new owner (not create-as-operator then ALTER OWNER); drop only own probe. */
export async function challengeFutureDefault(operator: WorkspaceConnection, runtime: WorkspaceConnection, target: Target) {
  await assertTarget(operator, target)
  await operator.transaction(async tx => {
    await tx.exec(`set local role ${quote(target.ownerRole)}`)
    await tx.exec("create function neuvetra_beta.qa_c2_future_helper() returns integer language sql security definer set search_path=pg_catalog as $$select 719$$")
  })
  let callable = false, sqlstate: string | null = null
  try { await runtime.query("select neuvetra_beta.qa_c2_future_helper()"); callable = true } catch (error) { sqlstate = (error as any)?.code ?? null }
  finally { await operator.exec("drop function neuvetra_beta.qa_c2_future_helper()") }
  return { pass: !callable && sqlstate === "42501", callable, sqlstate }
}

/** Send real chunked bytes, observe server EOF; no invitation token in request. */
export async function rawOversizeClose(port: number, origin: string, bearer: string) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535 || /[\r\n]/.test(origin + bearer)) throw new Error("Loopback test parameters")
  return new Promise<{ status: number | null; closeHeader: boolean; noStore: boolean; eof: boolean; timeout: boolean }>((resolve, reject) => {
    let data = "", done = false
    const socket = connect({ host: "127.0.0.1", port })
    const timer = setTimeout(() => finish(false, true), 3000)
    function finish(eof: boolean, timeout: boolean) {
      if (done) return; done = true; clearTimeout(timer); socket.destroy()
      resolve({ status: /^HTTP\/1\.[01] (\d+)/.exec(data)?.[1] ? Number(/^HTTP\/1\.[01] (\d+)/.exec(data)![1]) : null, closeHeader: /\r\nconnection:\s*close\r\n/i.test(data), noStore: /\r\ncache-control:\s*no-store\r\n/i.test(data), eof, timeout })
    }
    socket.once("connect", () => socket.write(`POST /beta-api/invitations/redeem HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nOrigin: ${origin}\r\nAuthorization: Bearer ${bearer}\r\nContent-Type: application/json\r\nTransfer-Encoding: chunked\r\nConnection: keep-alive\r\n\r\n801\r\n${" ".repeat(2049)}\r\n0\r\n\r\n`))
    socket.on("data", chunk => { data += chunk.toString("latin1"); if (data.length > 16384) { socket.destroy(); reject(new Error("Bounded response exceeded")) } })
    socket.once("end", () => finish(true, false))
    socket.once("error", () => { if (!done) { clearTimeout(timer); done = true; reject(new Error("Loopback socket failed")) } })
  })
}
