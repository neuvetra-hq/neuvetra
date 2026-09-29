import { createPostgresConnection } from "../../packages/neuvetra-database/src/hosted"

if (import.meta.main) {
  if (process.env.M80_BETA_ACCESS_CI !== "enabled" || process.env.CI !== "true") throw new Error("Dedicated ephemeral CI PostgreSQL required.")
  const db = createPostgresConnection("postgres://supabase_admin@127.0.0.1:55472/postgres", { tls: false, maxConnections: 1 })
  try {
    const current = await db.query<{ current_user: string; database_name: string; superuser: boolean }>("select current_user,current_database() database_name,(select rolsuper from pg_roles where rolname=current_user) superuser")
    if (current.rows[0]?.current_user !== "supabase_admin" || current.rows[0]?.database_name !== "postgres" || current.rows[0]?.superuser !== true) throw new Error("Dedicated ephemeral CI owner required.")
    for (const statement of [
      "create role authenticated nologin nosuperuser noinherit nocreatedb nocreaterole noreplication nobypassrls",
      "create role anon nologin nosuperuser noinherit nocreatedb nocreaterole noreplication nobypassrls",
      "create role neuvetra_runtime nologin nosuperuser noinherit nocreatedb nocreaterole noreplication nobypassrls",
    ]) await db.exec(statement)
    console.info(JSON.stringify({ profile: "neuvetra.beta-access.ci-prerequisites.v1", status: "created", host: "127.0.0.1", port: 55472 }))
  } finally { await db.close() }
}
