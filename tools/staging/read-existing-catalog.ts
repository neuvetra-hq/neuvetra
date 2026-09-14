import { extractDatabaseUrl, connectionOptions, certificateAuthority, installedDriver, initializeClient, INVENTORY_QUERIES } from "../cloud/database-inventory"
const source = process.argv[2]
if (!source || !process.argv[3]) throw new Error("Explicit export and output paths required")
const target = process.argv[3]
let client: ReturnType<typeof initializeClient> | undefined
try {
  if (await Bun.file(target).exists()) throw new Error("existing_output")
  const url = extractDatabaseUrl(await Bun.file(source).text())
  const ca = certificateAuthority(Buffer.from(await Bun.file("tools/cloud/fixtures/supabase-prod-ca-2021.crt").arrayBuffer()))
  client = initializeClient(installedDriver(), connectionOptions(url, ca))
  const connection = await client.reserve()
  try {
    await connection.unsafe("BEGIN READ ONLY")
    await connection.unsafe("SET LOCAL statement_timeout = '10s'")
    const result: Record<string, unknown> = { target: "icockcoguyadhryzydvl", client_tls: "hostname and configured CA verified", scope: "catalog metadata only; pooler backend TLS is a separate observation" }
    for (const [name, sql] of Object.entries(INVENTORY_QUERIES)) result[name] = await connection.unsafe(sql)
    result.managedPolicies = await connection.unsafe("SELECT schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname IN ('auth','storage','realtime') ORDER BY 1,2,3")
    result.storageBuckets = await connection.unsafe("SELECT id,public FROM storage.buckets ORDER BY id")
    result.managedDefiners = await connection.unsafe("SELECT n.nspname schema,p.oid::regprocedure::text signature,pg_get_userbyid(p.proowner) owner FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('auth','storage','extensions','graphql','graphql_public','realtime','vault','pgbouncer','supabase_migrations') AND p.prosecdef AND (has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE')) ORDER BY 1,2")
    result.realtimeRls = await connection.unsafe("SELECT n.nspname schema,c.relname name,c.relrowsecurity rls,c.relforcerowsecurity forced FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='realtime' AND c.relname IN ('messages','subscription')")
    result.managedEffectiveSchema = await connection.unsafe("SELECT n.nspname schema,r.rolname role,has_schema_privilege(r.oid,n.oid,'USAGE') usage,has_schema_privilege(r.oid,n.oid,'CREATE') create_allowed FROM pg_namespace n CROSS JOIN pg_roles r WHERE n.nspname IN ('auth','storage','extensions','graphql','graphql_public','realtime','vault','pgbouncer','supabase_migrations') AND r.rolname IN ('anon','authenticated') ORDER BY 1,2")
    result.managedEffectiveObjects = await connection.unsafe("SELECT n.nspname schema,c.relname name,c.relkind kind,r.rolname role,p.privilege FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN pg_roles r CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) p(privilege) WHERE n.nspname IN ('auth','storage','extensions','graphql','graphql_public','realtime','vault','pgbouncer','supabase_migrations') AND c.relkind IN ('r','p','v','m','f') AND r.rolname IN ('anon','authenticated') AND has_table_privilege(r.oid,c.oid,p.privilege) ORDER BY 1,2,4,5")
    result.managedEffectiveColumns = await connection.unsafe("SELECT n.nspname schema,c.relname name,a.attname column_name,r.rolname role,p.privilege FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped CROSS JOIN pg_roles r CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('REFERENCES')) p(privilege) WHERE n.nspname IN ('auth','storage','extensions','graphql','graphql_public','realtime','vault','pgbouncer','supabase_migrations') AND c.relkind IN ('r','p','v','m','f') AND r.rolname IN ('anon','authenticated') AND has_column_privilege(r.oid,c.oid,a.attnum,p.privilege) AND NOT has_table_privilege(r.oid,c.oid,p.privilege) ORDER BY 1,2,3,4,5")
    result.managedEffectiveSequences = await connection.unsafe("SELECT n.nspname schema,c.relname name,r.rolname role,p.privilege FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN pg_roles r CROSS JOIN (VALUES ('USAGE'),('SELECT'),('UPDATE')) p(privilege) WHERE n.nspname IN ('auth','storage','extensions','graphql','graphql_public','realtime','vault','pgbouncer','supabase_migrations') AND c.relkind='S' AND r.rolname IN ('anon','authenticated') AND has_sequence_privilege(r.oid,c.oid,p.privilege) ORDER BY 1,2,3,4")
    await connection.unsafe("ROLLBACK")
    await Bun.write(target, JSON.stringify(result, null, 2) + "\n")
    console.log(JSON.stringify({ status: "catalog_read", output: target, queryNames: Object.keys(INVENTORY_QUERIES) }))
  } finally { connection.release() }
} catch { console.error(JSON.stringify({ status: "catalog_unavailable" })); process.exitCode = 1 }
finally { await client?.end({ timeout: 3 }) }
