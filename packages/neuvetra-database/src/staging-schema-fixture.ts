// BF-09 (test support only; never imported by the server or the web): a disposable loopback database at an exact staging
// schema prefix, so a test can start an image against schema 30 and then apply 0031 through the operator path
// (`migratePrivateStaging`), as the owner will on hosted staging. Used by the native suites that CI runs against its
// PostgreSQL service; refuses anything but a named database on 127.0.0.1.
import { createPostgresConnection, type HostedWorkspaceOptions } from "./hosted"
import { readMigrationManifest } from "./staging-migrations"
import type { WorkspaceConnection } from "./workspace"

/** The Supabase pieces the migrations expect, as hosted.test.ts provides them (auth.uid, auth.users, storage.objects). */
export const SUPABASE_TEST_BASELINE = [
  `do $$ begin if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if; end $$;
    create schema if not exists auth; create table if not exists auth.users(id uuid primary key);
    create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`,
  `create schema if not exists storage;
    create table if not exists storage.buckets(id text primary key,name text not null,public boolean not null,file_size_limit bigint,allowed_mime_types text[]);
    create table if not exists storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text not null references storage.buckets(id),name text not null,unique(bucket_id,name));
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated,anon; grant select,insert,update,delete on storage.objects to authenticated,anon;`,
] as const

const ROLE_LINE = "create role neuvetra_runtime nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;\n"

export interface StagingSchemaFixture {
  /** Superuser connection to the new database (the operator). */
  operator: WorkspaceConnection
  /** Connection string for the restricted runtime role on the new database. */
  runtimeUrl: string
  /** Connection string for the operator on the new database. */
  operatorUrl: string
  close(): Promise<void>
}

/**
 * Drops and recreates `databaseName` next to the database `adminUrl` names, and applies migrations 0001 to `schemaVersion`
 * byte for byte with their receipts, bound to `projectRef`. The cluster-wide runtime role already exists when another
 * database of the cluster was migrated, so 0009's one CREATE ROLE line is skipped then (the database objects are the same).
 */
export async function createStagingSchemaFixture(adminUrl: string, databaseName: string, schemaVersion: number, projectRef: HostedWorkspaceOptions["expectedProjectRef"]): Promise<StagingSchemaFixture> {
  const admin = new URL(adminUrl)
  if (admin.hostname !== "127.0.0.1" || !/^[a-z][a-z0-9_]{2,40}$/.test(databaseName) || !/^[a-z]{20}$/.test(projectRef)) throw new Error("A named disposable loopback database is required.")
  const manifest = await readMigrationManifest()
  if (!Number.isInteger(schemaVersion) || schemaVersion < 9 || schemaVersion > manifest.length) throw new Error("Unknown staging schema.")
  const maintenance = createPostgresConnection(adminUrl, { tls: false })
  try {
    await maintenance.exec(`drop database if exists ${databaseName} with (force)`)
    await maintenance.exec(`create database ${databaseName}`)
  } finally { await maintenance.close() }
  const operatorUrl = new URL(adminUrl); operatorUrl.pathname = `/${databaseName}`
  const operator = createPostgresConnection(operatorUrl.toString(), { tls: false })
  try {
    for (const statement of SUPABASE_TEST_BASELINE) await operator.exec(statement)
    const roleExists = (await operator.query<{ present: boolean }>("select exists(select 1 from pg_roles where rolname='neuvetra_runtime') present")).rows[0]?.present === true
    await operator.transaction(async tx => {
      for (const migration of manifest.slice(0, schemaVersion)) {
        let sql = migration.sql
        if (migration.name === "0009_private_staging.sql" && roleExists) {
          if (sql.split(ROLE_LINE).length !== 2) throw new Error("0009's role statement changed.")
          sql = sql.replace(ROLE_LINE, "")
        }
        await tx.exec(sql)
      }
      // The receipt tables exactly as migratePrivateStagingFromManifest creates them.
      await tx.exec(`create table neuvetra.schema_migrations(name text primary key,sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),applied_at timestamptz not null default now());
        create table neuvetra.staging_target(singleton boolean primary key default true check(singleton),project_ref text not null,profile text not null);
        alter table neuvetra.schema_migrations enable row level security; alter table neuvetra.schema_migrations force row level security;
        alter table neuvetra.staging_target enable row level security; alter table neuvetra.staging_target force row level security;
        create policy m63_receipts_read on neuvetra.schema_migrations for select to neuvetra_runtime using(true);
        create policy m63_target_read on neuvetra.staging_target for select to neuvetra_runtime using(true);
        grant select on neuvetra.schema_migrations,neuvetra.staging_target to neuvetra_runtime;`)
      for (const migration of manifest.slice(0, schemaVersion)) await tx.query("insert into neuvetra.schema_migrations(name,sha256) values($1,$2)", [migration.name, migration.sha256])
      await tx.query("insert into neuvetra.staging_target(project_ref,profile) values($1,'neuvetra.private-synthetic-staging.v1')", [projectRef])
    })
    // The hosted project's containment: no PUBLIC schema usage, and a runtime role that can log in (trust auth, loopback).
    await operator.exec("revoke all on schema public from public,anon,authenticated")
    await operator.exec("alter role neuvetra_runtime login")
  } catch (error) { await operator.close(); throw error }
  const runtimeUrl = new URL(operatorUrl); runtimeUrl.username = "neuvetra_runtime"
  return { operator, runtimeUrl: runtimeUrl.toString(), operatorUrl: operatorUrl.toString(), close: () => operator.close() }
}

/**
 * Every row of every table in the application, Auth and Storage schemas, as a digest per table (the rows' exact text in a
 * fixed order) with its row count, plus each table's column definitions. Two equal snapshots mean every table holds the
 * same rows byte for byte and no table or column changed.
 */
export async function snapshotStagingTables(db: WorkspaceConnection): Promise<Record<string, { rows: number; digest: string; columns: string }>> {
  const tables = await db.query<{ name: string; columns: string }>(`select format('%I.%I',n.nspname,c.relname) name,
      string_agg(format('%s %s %s %s',a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,coalesce(pg_get_expr(d.adbin,d.adrelid),'')),', ' order by a.attnum) columns
    from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped
    left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum
    where n.nspname in('neuvetra','auth','storage') and c.relkind in('r','p') group by 1 order by 1`)
  const out: Record<string, { rows: number; digest: string; columns: string }> = {}
  for (const table of tables.rows) {
    const row = (await db.query<{ rows: string; digest: string | null }>(`select count(*)::text rows,md5(string_agg(t::text,E'\\n' order by t::text)) digest from ${table.name} t`)).rows[0]!
    out[table.name] = { rows: Number(row.rows), digest: row.digest ?? "", columns: table.columns }
  }
  return out
}
