/**
 * E2E-01: a disposable PostgreSQL database for the browser smoke suite, migrated by the repository's own helper
 * (`migratePrivateStaging`, the same call the hosted tests use) to the current staging schema.
 *
 * The database is recreated on every run, so every run starts from the same seed. Because migration 0009 creates the
 * cluster-wide role `neuvetra_runtime`, the cluster must be dedicated to this suite (a CI service container, or a
 * throwaway local cluster): the role is dropped and recreated with the database.
 */
import { createPostgresConnection, migratePrivateStaging, STAGING_SCHEMA_VERSION, type WorkspaceConnection } from "../../../../packages/neuvetra-database/src/index"

/** The only database name this harness will drop and recreate. */
export const E2E_DATABASE_NAME = "neuvetra_e2e"
/** The synthetic staging project reference the migrated database is bound to (never a real project). */
export const E2E_PROJECT_REF = "eeeeeeeeeeeeeeeeeeee"

export interface PreparedDatabase {
  /** Superuser connection to the e2e database (seeding auth.users and rosters, and test assertions). */
  operator: WorkspaceConnection
  /** The restricted runtime role's connection string, as the staging server uses it. */
  runtimeUrl: string
  schemaVersion: number
}

/** Refuses anything but a loopback server and the dedicated database name. */
export function checkE2eDatabaseUrl(raw: string): URL {
  const url = new URL(raw)
  if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.pathname !== `/${E2E_DATABASE_NAME}` || url.search || url.hash || !["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error(`E2E_DATABASE_URL must be a loopback PostgreSQL URL whose database is "${E2E_DATABASE_NAME}" (it is dropped and recreated).`)
  }
  return url
}

/** Drops and recreates the e2e database, provides the Supabase-shaped auth and storage baseline, and migrates it. */
export async function prepareDatabase(raw: string): Promise<PreparedDatabase> {
  const url = checkE2eDatabaseUrl(raw)
  const maintenanceUrl = new URL(url); maintenanceUrl.pathname = "/postgres"
  const maintenance = createPostgresConnection(maintenanceUrl.toString(), { tls: false, maxConnections: 1 })
  try {
    await maintenance.exec(`drop database if exists ${E2E_DATABASE_NAME} with (force)`)
    await maintenance.exec("drop role if exists neuvetra_runtime")
    await maintenance.exec(`create database ${E2E_DATABASE_NAME}`)
  } finally { await maintenance.close() }

  const operator = createPostgresConnection(url.toString(), { tls: false, maxConnections: 4 })
  // The parts of Supabase the migrations expect (as packages/neuvetra-database/src/hosted.test.ts provides them).
  await operator.exec(`do $$ begin if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if; end $$;
    create schema if not exists auth; create table if not exists auth.users(id uuid primary key);
    create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`)
  await operator.exec(`create schema if not exists storage;
    create table if not exists storage.buckets(id text primary key,name text not null,public boolean not null,file_size_limit bigint,allowed_mime_types text[]);
    create table if not exists storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text not null references storage.buckets(id),name text not null,unique(bucket_id,name));
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated,anon; grant select,insert,update,delete on storage.objects to authenticated,anon;`)
  const migrated = await migratePrivateStaging(operator, { expectedProjectRef: E2E_PROJECT_REF, syntheticTargetConfirmed: true })
  if (migrated.schemaVersion !== STAGING_SCHEMA_VERSION) throw new Error(`Migrated to schema ${migrated.schemaVersion}, expected ${STAGING_SCHEMA_VERSION}.`)
  // The hosted project's containment: no PUBLIC schema usage, and a runtime role that can log in (trust auth, loopback).
  await operator.exec("revoke all on schema public from public,anon,authenticated")
  await operator.exec("alter role neuvetra_runtime login")
  const runtime = new URL(url); runtime.username = "neuvetra_runtime"; runtime.password = ""
  return { operator, runtimeUrl: runtime.toString(), schemaVersion: migrated.schemaVersion }
}
