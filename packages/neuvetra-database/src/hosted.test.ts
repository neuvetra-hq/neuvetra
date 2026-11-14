import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { fileURLToPath } from "node:url"
import { HostedWorkspaceDatabase, INSTRUMENT_IDENTITY_KEYS, STAGING_SCHEMA_BRIDGE_VERSION, STAGING_SCHEMA_VERSION, STAGING_SCOPE3_COMPLETION_SCHEMA_VERSION, STAGING_SCOPE3_SCHEMA_VERSION, STAGING_INSTRUMENT_IDENTITY_SCHEMA_VERSION, STAGING_INTEGRITY_GUARDS_SCHEMA_VERSION, STAGING_SERVED_SCHEMA_VERSIONS, createPostgresConnection, scope12PayloadAvailable, scope3ActivityAvailable, scope3KindsAvailable, scope3OverlapConfirmationAvailable, validateHostedSchemaReceipts, validateHostedTarget } from "./hosted"
import { SCOPE3_COLLECTION_KINDS, SCOPE3_COLLECTION_SCHEMA, SCOPE3_COMPLETION_SCHEMA, SCOPE3_LEGACY_KINDS } from "./scope3-collection-contract"
import { loadStagingDatabaseCa, validateDatabaseCaPem } from "./staging-tls"
import { auditLegacyStagingExposure, planLegacyStagingContainment } from "./staging-audit"
import { migratePrivateStaging, migratePrivateStagingFromManifest, provisionStagingRoster, readMigrationManifest, revokeStagingAccess } from "./staging-migrations"
import { M57_WARNINGS, M58_WARNINGS, M61_LIMITATION_ACKNOWLEDGMENTS, type WorkspaceConnection } from "./workspace"
import { EXISTING_PROJECT_REF } from "./staging-audit"
import { createStagingSchemaFixture, snapshotStagingTables } from "./staging-schema-fixture"
import { createSyntheticCompanySetup } from "./company-setup-fixture"
import { registerCollectionEvidence, reserveCollectionEvidenceUpload } from "./collection"

async function rejectionMessage(operation: Promise<unknown>): Promise<string> {
  try { await operation; throw new Error("UNEXPECTED_SUCCESS") } catch(error) {
    if (error instanceof Error && error.message !== "UNEXPECTED_SUCCESS") return error.message
    throw error
  }
}

const REF = "abcdefghijklmnopqrst"
const options = { expectedProjectRef: REF, connectionString: `postgresql://neuvetra_runtime:test@db.${REF}.supabase.co:5432/postgres` }
test("hosted target binding refuses wrong projects, privileged users and connection overrides", () => {
  expect(() => validateHostedTarget(options)).not.toThrow()
  expect(() => validateHostedTarget({ ...options, connectionString: `postgresql://neuvetra_runtime.${REF}:test@aws-0-us-west-1.pooler.supabase.com:6543/postgres` })).not.toThrow()
  for (const value of [options.connectionString.replace(REF, "z".repeat(20)), options.connectionString.replace("neuvetra_runtime", "postgres"), `${options.connectionString}?sslmode=disable`, options.connectionString.replace("supabase.co", "supabase.co.attacker.test"), options.connectionString.replace("/postgres", "/customer")]) expect(() => validateHostedTarget({ ...options, connectionString: value })).toThrow()
})

test("the schema-32 image serves the existing project at exactly 28 to 32, and a new project only at 32", () => {
  const manifest = Array.from({ length: 32 }, (_, index) => ({ name: `${String(index + 1).padStart(4, "0")}_migration.sql`, sha256: String(index + 1).padStart(64, "0") }))
  const schema28 = manifest.slice(0, 28), schema29 = manifest.slice(0, 29), schema30 = manifest.slice(0, 30), schema31 = manifest.slice(0, 31)
  const existing = { expectedProjectRef: "icockcoguyadhryzydvl", reuseExistingProject: true }
  expect(STAGING_SCHEMA_VERSION).toBe(32)
  expect(STAGING_SCHEMA_BRIDGE_VERSION).toBe(28)
  expect(STAGING_INTEGRITY_GUARDS_SCHEMA_VERSION).toBe(31)
  expect(STAGING_INSTRUMENT_IDENTITY_SCHEMA_VERSION).toBe(32)
  expect([STAGING_SCOPE3_SCHEMA_VERSION, STAGING_SCOPE3_COMPLETION_SCHEMA_VERSION]).toEqual([SCOPE3_COLLECTION_SCHEMA, SCOPE3_COMPLETION_SCHEMA])
  expect(STAGING_SERVED_SCHEMA_VERSIONS).toEqual([28, 29, 30, 31, 32])
  expect(validateHostedSchemaReceipts(manifest, manifest, options)).toBe(32)
  expect(validateHostedSchemaReceipts(manifest, manifest, existing)).toBe(32)
  // BF-18: hosted staging is at 31 when this image deploys; the owner applies 0032 by hand afterwards.
  expect(validateHostedSchemaReceipts(schema31, manifest, existing)).toBe(31)
  expect(validateHostedSchemaReceipts(schema30, manifest, existing)).toBe(30)
  expect(validateHostedSchemaReceipts(schema29, manifest, existing)).toBe(29)
  expect(validateHostedSchemaReceipts(schema28, manifest, existing)).toBe(28)
  for (const prefix of [schema28, schema29, schema30, schema31]) {
    expect(() => validateHostedSchemaReceipts(prefix, manifest, options)).toThrow("Staging schema receipt mismatch.")
    expect(() => validateHostedSchemaReceipts(prefix, manifest, { ...existing, reuseExistingProject: false })).toThrow("Staging schema receipt mismatch.")
  }
  // The schema-27 bridge is closed: hosted is already at 28.
  for (const length of [22, 23, 24, 25, 26, 27]) expect(() => validateHostedSchemaReceipts(manifest.slice(0, length), manifest, existing)).toThrow("Staging schema receipt mismatch.")
  expect(() => validateHostedSchemaReceipts([...manifest, { name: "0033_unknown.sql", sha256: "f".repeat(64) }], manifest, existing)).toThrow("Staging schema receipt mismatch.")
  for (const [prefix, index] of [[schema28, 27], [schema29, 28], [schema30, 29], [schema31, 30], [manifest, 31]] as const)
    expect(() => validateHostedSchemaReceipts(prefix.map((receipt, i) => i === index ? { ...receipt, sha256: "f".repeat(64) } : receipt), manifest, existing)).toThrow("Staging schema receipt mismatch.")
  for (const prefix of [schema28, schema29, schema30, schema31]) expect(() => validateHostedSchemaReceipts(prefix, prefix, existing)).toThrow("Staging schema receipt mismatch.")
})

test("BF-09: a Scope 1 or 2 payload carrying duplicateConfirmedDistinct needs schema 31; any other payload is unaffected", () => {
  for (const version of [28, 29, 30, 31, 32]) expect(scope12PayloadAvailable({ heatContent: null }, version)).toBe(true)
  expect([28, 29, 30, 31, 32].map(v => scope12PayloadAvailable({ heatContent: null, duplicateConfirmedDistinct: true }, v))).toEqual([false, false, false, true, true])
  expect([30, 31].map(v => scope12PayloadAvailable({ heatContent: null, duplicateConfirmedDistinct: false }, v))).toEqual([false, true])
  expect(scope12PayloadAvailable(null, 30)).toBe(true)
})

test("BF-18: an instrument carrying instrumentId, registry or faceMwh needs schema 32; instruments without them are unaffected", () => {
  expect(INSTRUMENT_IDENTITY_KEYS).toEqual(["instrumentId", "registry", "faceMwh"])
  const instrument = { type: "energy_attribute_certificate", mwh: "250", qualityCriteriaMet: true, vintageYear: 2025, evidenceReference: null, generationTechnology: "wind", rateLbPerMwh: null }
  const electricity = (instruments: unknown[]) => ({ meterOrAccountNumber: "M-2", utilityName: "Utility", site: "Site", zip: "94105", subregion: "CAMX", utilityEiaId: null, instruments })
  for (const version of [28, 29, 30, 31, 32]) {
    expect(scope12PayloadAvailable(electricity([]), version)).toBe(true)
    expect(scope12PayloadAvailable(electricity([instrument]), version)).toBe(true)
  }
  for (const key of INSTRUMENT_IDENTITY_KEYS) {
    const flagged = electricity([instrument, { ...instrument, [key]: key === "registry" ? null : key === "faceMwh" ? "250" : "WREGIS-123" }])
    expect([30, 31, 32].map(v => scope12PayloadAvailable(flagged, v))).toEqual([false, false, true])
  }
  // Both 0031's flag and an identity key: needs 32.
  expect([31, 32].map(v => scope12PayloadAvailable({ ...electricity([{ ...instrument, instrumentId: "GT-2025" }]), duplicateConfirmedDistinct: true }, v))).toEqual([false, true])
})

test("Scope 3 gates: the 0029 kinds from 29, everything 0030 added from 30", () => {
  const travel = (payload: Record<string, unknown>, normalizedUnit: string | null = "mile") => ({ kind: "business_travel", payload, quantity: { normalizedUnit } })
  const legacy = { mode: "air", passengerSegments: 4, haulBasis: null }
  expect([28, 29, 30].map(scope3KindsAvailable)).toEqual([[], SCOPE3_LEGACY_KINDS, SCOPE3_COLLECTION_KINDS])
  expect([28, 29, 30].map(v => scope3ActivityAvailable(travel(legacy), v))).toEqual([false, true, true])
  expect([28, 29, 30].map(v => scope3ActivityAvailable(travel({ ...legacy, dataQuality: null }), v))).toEqual([false, false, true])
  expect([28, 29, 30].map(v => scope3ActivityAvailable(travel({ ...legacy, cabinClass: null, hotelCountry: null }), v))).toEqual([false, false, true])
  expect([28, 29, 30].map(v => scope3ActivityAvailable(travel({ mode: "hotel", passengerSegments: null, haulBasis: null }, "room-night"), v))).toEqual([false, false, true])
  expect([28, 29, 30].map(v => scope3ActivityAvailable(travel({ mode: "hotel", passengerSegments: null, haulBasis: null }, null), v))).toEqual([false, true, true])
  expect([28, 29, 30].map(v => scope3ActivityAvailable({ kind: "purchase_spend", payload: {}, quantity: { normalizedUnit: "USD" } }, v))).toEqual([false, false, true])
  // BF-18 (0032): BF-17's flag on an asset_energy or building_average payload needs 32; without it nothing changes.
  for (const value of [true, false]) expect([30, 31, 32].map(v => scope3OverlapConfirmationAvailable({ category: 8, scope2OverlapConfirmedDistinct: value }, v))).toEqual([false, false, true])
  expect([30, 31, 32].map(v => scope3OverlapConfirmationAvailable({ category: 8 }, v))).toEqual([true, true, true])
  expect(scope3OverlapConfirmationAvailable(null, 30)).toBe(true)
})

test("the image manifest is 0001–0032, ending with the reviewed 0027 to 0032 bytes", async () => {
  const manifest = await readMigrationManifest()
  expect(manifest).toHaveLength(STAGING_SCHEMA_VERSION)
  expect(manifest.slice(26).map(({ name, sha256 }) => ({ name, sha256 }))).toEqual([
    { name: "0027_collection.sql", sha256: "1a0f64c82c9b771f318c06ede468276395f6642bf13fdb86e9146eabfbf7d59e" },
    { name: "0028_collection_zip_check.sql", sha256: "5ae7da9aef3b0d9f5fe4cd679a200722d0603fd201597df67897eec57b212917" },
    { name: "0029_scope3_collection.sql", sha256: "f191ce06fd50edd8c65b7d3f6f659c6713392123a9ea8cba074e3f0c4954f0ad" },
    { name: "0030_scope3_completion.sql", sha256: "8aaec185c30443b0c4f8b2434f0fb4c3565d207c6bba5e1050319860d924105b" },
    { name: "0031_integrity_guards.sql", sha256: "3513b5da55e41133d94faaf3a8b610e1fb66f415a95393272d3f8b1c49246cd7" },
    { name: "0032_instrument_identity_and_bindings.sql", sha256: "1d9a2c5ee01f90f6c1fd6a56baebc92c2d1a70a1442db2a1ff00085a5555033f" },
  ])
  expect(new TextEncoder().encode(manifest[27]!.sql).byteLength).toBe(3155532)
  expect(new TextEncoder().encode(manifest[28]!.sql).byteLength).toBe(26375)
  expect(new TextEncoder().encode(manifest[29]!.sql).byteLength).toBe(162929)
  expect(new TextEncoder().encode(manifest[30]!.sql).byteLength).toBe(63029)
  expect(new TextEncoder().encode(manifest[31]!.sql).byteLength).toBe(78957)
})

// BF-09: 0031 replaces three 0030 functions. Their new bodies are 0030's with exactly these changes and nothing else, so a
// reviewer reads only the deltas below; any other drift (a lost 0030 line, an edited condition) fails here.
test("0031's three functions are 0030's bodies with only the marked BF-09 changes", async () => {
  const manifest = await readMigrationManifest()
  const sql30 = manifest[29]!.sql, sql31 = manifest[30]!.sql
  const body = (sql: string, name: string) => {
    const start = sql.search(new RegExp(`^create (?:or replace )?function neuvetra\\.${name}\\(`, "m"))
    expect(start).toBeGreaterThanOrEqual(0)
    return sql.slice(start, sql.indexOf("\nend $$;", start) + "\nend $$;".length)
  }
  const comment = (lines: number) => `(?:  -- 0031[^\\n]*\\n(?:  --[^\\n]*\\n){${lines - 1}})`
  const strip = (text: string, pattern: string) => { const re = new RegExp(pattern); expect(re.test(text)).toBe(true); return text.replace(re, "") }
  // 1. collection_assert_activity: the five Scope 1/2 key lists read without the flag, and one added type check.
  let assert31 = body(sql31, "collection_assert_activity")
  assert31 = strip(assert31, `${comment(3)}  if a->>'kind' in\\('natural_gas','distillate_no2','vehicle','fugitive','electricity'\\) and jsonb_typeof\\(p\\)='object' and p \\? 'duplicateConfirmedDistinct' and jsonb_typeof\\(p->'duplicateConfirmedDistinct'\\) is distinct from 'boolean' then raise exception 'invalid duplicate confirmation' using errcode='22023'; end if;\\n`)
  expect(assert31.split("m71_keys(p-'duplicateConfirmedDistinct','").length - 1).toBe(5)
  expect(assert31.replaceAll("m71_keys(p-'duplicateConfirmedDistinct','", "m71_keys(p,'")).toBe(body(sql30, "collection_assert_activity"))
  // 2. save_collection_activity: one added cap check, raising 54N31.
  const save31 = body(sql31, "save_collection_activity")
  expect(save31).toContain("errcode='54N31'")
  expect(strip(save31, `${comment(5)}  if a->>'state'='active' and a->>'kind' in\\('natural_gas'[^\\n]*\\n    and \\(select count[^\\n]*\\n      --[^\\n]*\\n(?:      cross join lateral[^\\n]*\\n){2}      where r\\.company_id=target_company and r\\.scope in\\(1,2\\) and v\\.state='active'\\)>400 then raise exception 'Scope 1 and 2 active record limit reached' using errcode='54N31'; end if;\\n`)).toBe(body(sql30, "save_collection_activity"))
  // 3. approve_scope3_report: two more columns read, and one added check raising 55N31, before the hash check.
  let approve31 = body(sql31, "approve_scope3_report").replace("create or replace function", "create function").replace("x.created_by,x.reporting_year,x.revision into v", "x.created_by into v")
  approve31 = strip(approve31, `${comment(4)}  if exists\\(select 1 from neuvetra\\.scope3_report_versions x where x\\.company_id=target_company and x\\.reporting_year=v\\.reporting_year and x\\.revision>v\\.revision\\)\\n    and not exists\\(select 1 from neuvetra\\.scope3_report_approvals x where x\\.version_id=v\\.id and x\\.company_id=target_company\\) then\\n    raise exception 'Scope 3 report version superseded' using errcode='55N31'; end if;\\n`)
  expect(approve31).toBe(body(sql30, "approve_scope3_report"))
  // Outside the function bodies (which run only when called) and comments, 0031 creates, alters or drops no table and writes no row.
  expect(sql31.replace(/\$\$[\s\S]*?\$\$/g, "").replace(/^\s*--.*$/gm, "")).not.toMatch(/\b(?:create|alter|drop) table\b|\binsert into\b|\bupdate neuvetra\.|\bdelete from\b|\btruncate neuvetra\./i)
})

// BF-18: 0032 replaces three 0031 functions and one 0030 function. Their new bodies are the applied bodies with exactly the
// marked changes below and nothing else, so a reviewer reads only these deltas; any other drift fails here.
test("0032's four functions are the applied bodies with only the marked BF-18 changes", async () => {
  const manifest = await readMigrationManifest()
  const sql30 = manifest[29]!.sql, sql31 = manifest[30]!.sql, sql32 = manifest[31]!.sql
  const body = (sql: string, name: string, end = "\nend $$;") => {
    const start = sql.search(new RegExp(`^create (?:or replace )?function neuvetra\\.${name}\\(`, "m"))
    expect(start).toBeGreaterThanOrEqual(0)
    return sql.slice(start, sql.indexOf(end, start) + end.length)
  }
  // Each marked change, undone exactly once: the text must occur exactly once where it is removed or replaced.
  const undo = (text: string, from: string, to = "") => { expect([from.slice(0, 60), text.split(from).length - 1]).toEqual([from.slice(0, 60), 1]); return text.replace(from, () => to) }
  // 1. collection_assert_activity: the instrument identity keys and BF-17's flag on two Scope 3 kinds.
  let assert32 = body(sql32, "collection_assert_activity")
  for (const kind of ["asset_energy", "building_average"]) {
    assert32 = undo(assert32, kind === "asset_energy"
      ? "    -- 0032 (BF-17, B-9): the optional boolean scope2OverlapConfirmedDistinct (the user confirmed that this asset's energy is a\n    -- different meter from any Scope 2 electricity record at the same site). Absent, true or false; never null.\n"
      : "    -- 0032 (BF-17, B-9): the same optional scope2OverlapConfirmedDistinct as asset_energy.\n")
  }
  const overlapCheck = "    if p ? 'scope2OverlapConfirmedDistinct' then perform neuvetra.scope3_assert_bool(p->'scope2OverlapConfirmedDistinct',false,'Scope 2 overlap confirmation'); end if;\n"
  expect(assert32.split(overlapCheck).length - 1).toBe(2)
  assert32 = assert32.replaceAll(overlapCheck, "")
  expect(assert32.split("m71_keys(p-'dataQuality'-'scope2OverlapConfirmedDistinct','").length - 1).toBe(2)
  assert32 = assert32.replaceAll("m71_keys(p-'dataQuality'-'scope2OverlapConfirmedDistinct','", "m71_keys(p-'dataQuality','")
  assert32 = undo(assert32, "      -- 0032 (BF-11, B-1/B-4): an instrument may carry its certificate or contract identity: instrumentId (1-120 characters,\n      -- not blank, no control character), registry (1-80 such characters, or null) and faceMwh (a QUANTITY decimal above 0,\n      -- through collection_assert_numeric_input first). Each optional; the seven keys of 0027 are read without them.\n")
  assert32 = undo(assert32, "m71_keys(x-'instrumentId'-'registry'-'faceMwh','", "m71_keys(x,'")
  assert32 = undo(assert32, "      if (x ? 'instrumentId' and (jsonb_typeof(x->'instrumentId') is distinct from 'string' or length(x->>'instrumentId') not between 1 and 120 or btrim(x->>'instrumentId')='' or x->>'instrumentId' ~ '[\\u0001-\\u001f\\u007f-\\u009f]'))\n        or (x ? 'registry' and x->'registry'<>'null'::jsonb and (jsonb_typeof(x->'registry') is distinct from 'string' or length(x->>'registry') not between 1 and 80 or btrim(x->>'registry')='' or x->>'registry' ~ '[\\u0001-\\u001f\\u007f-\\u009f]')) then raise exception 'invalid electricity instrument identity' using errcode='22023'; end if;\n")
  assert32 = undo(assert32, "      if x ? 'faceMwh' then perform neuvetra.collection_assert_numeric_input(x->'faceMwh'); if (case when x->>'faceMwh' ~ '^(0|[1-9][0-9]{0,11})(\\.[0-9]{1,3})?$' then (x->>'faceMwh')::numeric<=0 else true end) then raise exception 'invalid electricity instrument face value' using errcode='22023'; end if; end if;\n")
  expect(assert32).toBe(body(sql31, "collection_assert_activity"))
  // 2. save_collection_activity: 23N32 for the receipt mismatch, and the instrument insert (identity columns; any plain decimal).
  let save32 = body(sql32, "save_collection_activity")
  save32 = undo(save32, "  -- 0032 (BF-28, BI-11): a receipt for this key that names another actor, request or record is its own SQLSTATE, 23N32, so the\n  -- route can tell it from a revision conflict (23505 below).\n")
  save32 = undo(save32, "then raise exception 'collection idempotency conflict' using errcode='23N32';", "then raise exception 'collection idempotency conflict' using errcode='23505';")
  save32 = undo(save32, "      -- 0032 (BI-06, BF-24): each numeric column is its payload value exactly, whenever that value is a plain decimal\n      -- (unconstrained numeric; no 3-decimal limit), and null only when the payload value is null, blank or not a plain\n      -- decimal (the engine holds those). 0032 (BF-11): the identity columns are the payload's, as given.\n")
  save32 = undo(save32, ",rate_n2o_lb_per_mwh,instrument_id,registry,face_mwh)", ",rate_n2o_lb_per_mwh)")
  save32 = undo(save32, ",instrument->>'instrumentId',instrument->>'registry',case when instrument->>'faceMwh' ~ '^(0|[1-9][0-9]*)(\\.[0-9]+)?$' then (instrument->>'faceMwh')::numeric end);", ");")
  expect(save32.split("~ '^(0|[1-9][0-9]*)(\\.[0-9]+)?$'").length - 1).toBe(4)
  save32 = save32.replaceAll("~ '^(0|[1-9][0-9]*)(\\.[0-9]+)?$'", () => "~ '^(0|[1-9][0-9]{0,11})(\\.[0-9]{1,3})?$'")
  expect(save32).toBe(body(sql31, "save_collection_activity"))
  // 3. approve_scope3_report: the optional csvSha256, the CSV hash read and checked, and written with the approval.
  let approve32 = body(sql32, "approve_scope3_report")
  approve32 = undo(approve32, "  -- 0032 (BF-23, BI-05): the request may also name the CSV hash the approver saw (csvSha256, optional so a request without it\n  -- is still accepted); the approval stores the version's CSV hash either way.\n")
  approve32 = undo(approve32, "m71_keys(request-'csvSha256','", "m71_keys(request,'")
  approve32 = undo(approve32, "  if request ? 'csvSha256' then perform neuvetra.scope3_assert_match(request->'csvSha256','^[0-9a-f]{64}$',false,'CSV SHA-256'); end if;\n")
  approve32 = undo(approve32, "x.report_sha256,x.csv_sha256,x.open_issues", "x.report_sha256,x.open_issues")
  approve32 = undo(approve32, "  -- 0032 (BF-23): a CSV hash other than the stored one is the same refusal as a report hash other than the stored one.\n  if request ? 'csvSha256' and v.csv_sha256<>request->>'csvSha256' then raise exception 'Scope 3 report changed' using errcode='23505'; end if;\n")
  approve32 = undo(approve32, "  -- 0032 (BI-05): the approval binds the CSV as well (its foreign key now covers both hashes of the version).\n")
  approve32 = undo(approve32, "(version_id,company_id,report_sha256,csv_sha256,approved_by", "(version_id,company_id,report_sha256,approved_by")
  approve32 = undo(approve32, "values(v.id,target_company,v.report_sha256,v.csv_sha256,actor", "values(v.id,target_company,v.report_sha256,actor")
  expect(approve32).toBe(body(sql31, "approve_scope3_report"))
  // 4. scope3_active_line_count (0030's): the two branches counting lines derived from Scope 1 and 2 records are gone.
  let count32 = body(sql32, "scope3_active_line_count", "\n$$;").replace("create or replace function", "create function")
  count32 = undo(count32, "  -- 0032 (BF-21 option C, CEO decision 13 Nov 2026): only the lines of stored Scope 3 records count (each record, plus the 3D\n  -- upstream line of an energy-resold record when category 3 is included). The category 3 lines derived from Scope 1 and 2\n  -- records no longer count: they are bounded by the 400 active Scope 1 and 2 records (at most 3 each), so a Scope 1 or 2\n  -- save can never push the Scope 3 budget over.\n")
  count32 = undo(count32, "\n    else 0 end),0)::integer", "\n    when c.yes and r.kind='electricity' then 3 when c.yes and r.kind in('natural_gas','distillate_no2','vehicle') then 1 else 0 end),0)::integer")
  expect(count32).toBe(body(sql30, "scope3_active_line_count", "\n$$;"))
  // Outside the function bodies and comments, 0032 creates no table, function, role, policy or grant, inserts and deletes
  // no row, and updates only the two backfilled tables.
  const outside = sql32.replace(/\$\$[\s\S]*?\$\$/g, "").replace(/\$(drift|columns|projection|grants|approvals|tables)\$[\s\S]*?\$\1\$/g, "").replace(/^\s*--.*$/gm, "")
  expect(outside).not.toMatch(/\bcreate (?:table|role|policy|view)\b|\bgrant\b|\brevoke\b|\binsert into\b|\bdelete from\b|\btruncate neuvetra\.|\bdrop table\b/i)
  expect(outside.match(/\bupdate neuvetra\.\w+/gi)).toEqual(["update neuvetra.collection_electricity_instruments", "update neuvetra.scope3_report_approvals"])
  expect(sql32.match(/^create (?:or replace )?function neuvetra\.\w+/gm)).toEqual(["create or replace function neuvetra.collection_assert_activity", "create or replace function neuvetra.save_collection_activity", "create or replace function neuvetra.approve_scope3_report", "create or replace function neuvetra.scope3_active_line_count"])
})

test("explicit database CA accepts certificates only and never disables TLS verification", async () => {
  const file=fileURLToPath(new URL("../../../tools/cloud/fixtures/supabase-prod-ca-2021.crt",import.meta.url))
  const pem=await Bun.file(file).text()
  expect(await loadStagingDatabaseCa({caFile:file})).toBe(validateDatabaseCaPem(pem))
  expect(await loadStagingDatabaseCa({caPem:pem})).toBe(validateDatabaseCaPem(pem))
  expect(await loadStagingDatabaseCa({})).toBeUndefined()
  expect(await rejectionMessage(loadStagingDatabaseCa({caFile:file,caPem:pem}))).toContain("one")
  for(const invalid of ["", "-----BEGIN PRIVATE KEY-----\nsecret\n-----END PRIVATE KEY-----", `${pem}rejectUnauthorized=false`, "x".repeat(65537)]) expect(()=>validateDatabaseCaPem(invalid)).toThrow()
  expect(()=>createPostgresConnection("postgres://localhost/test",{tls:false,tlsCaPem:pem})).toThrow("verified TLS")
})

// Explicit opt-in only. These tests may create fixture Auth solely on this disposable loopback DB.
const testUrl = process.env.M63_TEST_DATABASE_URL
if (testUrl) {
  const url = new URL(testUrl)
  if (url.hostname !== "127.0.0.1" || !["/m63_integration", "/m67_author","/m68_author"].includes(url.pathname) || url.username !== "m63_test_admin" || url.search || url.hash) throw new Error("M63 tests require the named disposable loopback database.")
}
const pg = testUrl ? describe : describe.skip
pg("M63 actual PostgreSQL runtime boundary", () => {
  let operator: WorkspaceConnection
  let runtime: WorkspaceConnection
  let database: HostedWorkspaceDatabase
  let another: HostedWorkspaceDatabase
  let readinessVersions: number[] = []
  let setupTables: Array<string | null> = []
  // This database is the shared CI fixture for the staged API suites below.
  // Keep its project ref stable; the exact existing-project bridge is covered separately.
  const nativeRef = REF
  const owner = crypto.randomUUID(), admin = crypto.randomUUID(), member = crypto.randomUUID(), outsider = crypto.randomUUID(), uninvited = crypto.randomUUID()
  const company = crypto.randomUUID(), otherCompany = crypto.randomUUID()
  const roster = { expectedProjectRef: nativeRef, workspaceId: company, ownerUserId: owner, members: [{ userId: admin, role: "admin" as const }, { userId: member, role: "member" as const }] }
  // Test-only bypass of provider URL validation, while exercising actual restricted-session readiness.
  // Hosted startup itself is tested separately against an isolated provider before release.
  const construct = (connection: WorkspaceConnection) => new (HostedWorkspaceDatabase as unknown as new (db: WorkspaceConnection, ref: string, reuse: boolean) => HostedWorkspaceDatabase)(connection, nativeRef, false)
  const runtimeUrl = () => { const url = new URL(testUrl!); url.username = "neuvetra_runtime"; return url.toString() }
  const scoped = <T>(actor: string, sql: string, params: unknown[] = []) => runtime.transaction(async tx => {
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [actor])
    return tx.query<T>(sql, params)
  })

  beforeAll(async () => {
    operator = createPostgresConnection(testUrl!, { tls: false })
    await operator.exec(`do $$ begin if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if; end $$;
      create schema if not exists auth; create table if not exists auth.users(id uuid primary key);
      create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`)
    await operator.exec(`create schema if not exists storage;
      create table if not exists storage.buckets(id text primary key,name text not null,public boolean not null,file_size_limit bigint,allowed_mime_types text[]);
      create table if not exists storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text not null references storage.buckets(id),name text not null,unique(bucket_id,name));
      alter table storage.objects enable row level security;
      grant usage on schema storage to authenticated,anon; grant select,insert,update,delete on storage.objects to authenticated,anon;`)
    const manifest = await readMigrationManifest()
    for (const migration of manifest.slice(0, 22)) await operator.exec(migration.sql)
    // Reproduce the existing synthetic project's already-reviewed application
    // containment; a stock PostgreSQL cluster grants PUBLIC schema usage.
    await operator.exec("revoke all on schema public from public,anon,authenticated")
    await operator.exec(`create table neuvetra.schema_migrations(name text primary key,sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),applied_at timestamptz not null default now());
      create table neuvetra.staging_target(singleton boolean primary key default true check(singleton),project_ref text not null,profile text not null);
      alter table neuvetra.schema_migrations enable row level security; alter table neuvetra.schema_migrations force row level security;
      alter table neuvetra.staging_target enable row level security; alter table neuvetra.staging_target force row level security;
      create policy m63_receipts_read on neuvetra.schema_migrations for select to neuvetra_runtime using(true);
      create policy m63_target_read on neuvetra.staging_target for select to neuvetra_runtime using(true);
      grant select on neuvetra.schema_migrations,neuvetra.staging_target to neuvetra_runtime;`)
    for (const migration of manifest.slice(0, 22)) await operator.query("insert into neuvetra.schema_migrations(name,sha256) values($1,$2)", [migration.name, migration.sha256])
    await operator.query("insert into neuvetra.staging_target(project_ref,profile) values($1,'neuvetra.private-synthetic-staging.v1')", [nativeRef])
    await operator.exec("alter role neuvetra_runtime login")
    runtime = createPostgresConnection(runtimeUrl(), { tls: false, maxConnections: 2 })
    database = construct(runtime)
    expect(await rejectionMessage(database.checkReadiness())).toContain("Staging schema receipt mismatch.")
    setupTables.push((await operator.query<{ name: string | null }>("select to_regclass('neuvetra.company_setup_versions')::text name")).rows[0]?.name ?? null)
    await migratePrivateStaging(operator, { expectedProjectRef: nativeRef, syntheticTargetConfirmed: true })
    readinessVersions.push((await database.checkReadiness()).schemaVersion)
    setupTables.push((await operator.query<{ name: string | null }>("select to_regclass('neuvetra.company_setup_versions')::text name")).rows[0]?.name ?? null)
    for (const id of [owner, admin, member, outsider, uninvited]) await operator.query("insert into auth.users(id) values($1)", [id])
    await provisionStagingRoster(operator, roster)
    await provisionStagingRoster(operator, { expectedProjectRef: nativeRef, workspaceId: otherCompany, ownerUserId: outsider, members: [] })
    another = construct(createPostgresConnection(runtimeUrl(), { tls: false, maxConnections: 2 }))
  }, 30000)
  afterAll(async () => { await database?.close(); await another?.close(); await operator?.close() })

  test("checks exact migration receipts, restricted role and no ordinary-start migrations", async () => {
    expect(readinessVersions).toEqual([STAGING_SCHEMA_VERSION])
    expect(setupTables).toEqual([null, "neuvetra.company_setup_versions"])
    expect(await database.checkReadiness()).toEqual({ profile: "neuvetra.private-synthetic-staging.v1", schemaVersion: STAGING_SCHEMA_VERSION })
    expect((await migratePrivateStaging(operator, { expectedProjectRef: nativeRef, syntheticTargetConfirmed: true })).migrations).toHaveLength(STAGING_SCHEMA_VERSION)
    expect(await construct(operator).checkReadiness().then(() => "unexpected success", error => error.message)).toBe("Unsafe staging runtime role.")
    expect(await rejectionMessage(migratePrivateStaging(operator, { expectedProjectRef: "z".repeat(20), syntheticTargetConfirmed: true }))).toContain("baseline")
    expect((await readMigrationManifest()).every(m => /^[0-9a-f]{64}$/.test(m.sha256))).toBe(true)
  })

  test("catalog containment covers frontdesk, unknown application schemas and column-only access while separating managed schemas", async () => {
    let checked = false
    expect(await rejectionMessage(operator.transaction(async tx => {
      await tx.exec(`create table public.m63_catalog_probe(value text); insert into public.m63_catalog_probe values('synthetic internal row');
        grant select on public.m63_catalog_probe to authenticated;
        create schema frontdesk; create table frontdesk.business_members(value text); grant usage on schema frontdesk to authenticated; grant all on frontdesk.business_members to authenticated;
        create schema "m63 future app"; create table "m63 future app".records(value text,hidden text); grant usage on schema "m63 future app" to PUBLIC; grant select(value) on "m63 future app".records to PUBLIC;
        create sequence "m63 future app".counter; grant usage on "m63 future app".counter to anon;
        create function "m63 future app".legacy_reader() returns integer language sql security definer as $$ select 1 $$;
        alter default privileges in schema "m63 future app" grant select on tables to authenticated;`)
      const audit = await auditLegacyStagingExposure(tx)
      expect(audit.scope).toBe("all-application-schemas")
      expect(audit.legacyContainmentVerified).toBe(false)
      expect(audit.applicationSchemas).toContain("frontdesk")
      expect(audit.applicationSchemas).toContain("m63 future app")
      expect(audit.tableGrants.some(row => row.schema_name === "frontdesk" && row.table_name === "business_members" && row.role === "authenticated")).toBe(true)
      expect(audit.columnGrants.some(row => row.schema_name === "m63 future app" && row.column_name === "value")).toBe(true)
      expect(audit.sequenceGrants.some(row => row.schema_name === "m63 future app")).toBe(true)
      expect(audit.callableFunctions.some(row => row.schema_name === "m63 future app" && row.security_definer)).toBe(true)
      expect(audit.defaultGrants.some(row => row.schema_name === "m63 future app")).toBe(true)
      expect(audit.managedSchemas).toContainEqual(expect.objectContaining({schema_name:"auth",assessment:"provider-managed-separate-review-required"}))
      expect(JSON.stringify(audit)).not.toContain("synthetic internal row")
      const plan = await planLegacyStagingContainment(tx)
      expect(plan.statements.some(sql => sql.includes('SCHEMA "auth"'))).toBe(false)
      expect(plan.statements.some(sql => sql.includes('SCHEMA "frontdesk"'))).toBe(true)
      expect(plan.statements.some(sql => sql.includes('SELECT ("value") ON TABLE "m63 future app"."records"'))).toBe(true)
      for (const statement of plan.statements) await tx.exec(statement)
      expect((await auditLegacyStagingExposure(tx)).unreviewedApplicationSchemas).toContain("m63 future app")
      expect((await auditLegacyStagingExposure(tx)).legacyContainmentVerified).toBe(false)
      await tx.exec('drop schema "m63 future app" cascade')
      expect((await auditLegacyStagingExposure(tx)).legacyContainmentVerified).toBe(true)
      await tx.exec('create schema m63_future_after; create table m63_future_after.records(value text); grant usage on schema m63_future_after to PUBLIC; grant select on m63_future_after.records to PUBLIC;')
      expect((await auditLegacyStagingExposure(tx)).legacyContainmentVerified).toBe(false)
      checked = true
      throw new Error("rollback isolated catalog probe")
    }))).toContain("rollback isolated catalog probe")
    expect(checked).toBe(true)
  })

  test("only the reviewed collection Storage policy guards pass the legacy function audit", async () => {
    const audit = await auditLegacyStagingExposure(operator)
    expect(audit.legacyContainmentVerified).toBe(true)
    expect(audit.callableFunctions.map(row => `${row.role}:${row.signature}`)).toEqual([
      "anon:neuvetra.collection_storage_can_read(text,text)",
      "anon:neuvetra.collection_storage_can_upload(text,text)",
      "authenticated:neuvetra.collection_storage_can_read(text,text)",
      "authenticated:neuvetra.collection_storage_can_upload(text,text)",
    ])
    expect(await rejectionMessage(operator.transaction(async tx => {
      await tx.exec("create function neuvetra.unreviewed_storage_guard() returns boolean language sql security definer as $$ select true $$")
      expect((await auditLegacyStagingExposure(tx)).legacyContainmentVerified).toBe(false)
      throw new Error("rollback unreviewed guard")
    }))).toContain("rollback unreviewed guard")
    expect(await rejectionMessage(operator.transaction(async tx => {
      await tx.exec("alter function neuvetra.collection_storage_can_read(text,text) security invoker")
      expect((await auditLegacyStagingExposure(tx)).legacyContainmentVerified).toBe(false)
      throw new Error("rollback changed guard")
    }))).toContain("rollback changed guard")
  })

  test("provider defaults remain explicit only behind denied schemas and inherited access never passes", async () => {
    let checked=false
    expect(await rejectionMessage(operator.transaction(async tx=>{
      await tx.exec(`do $$ begin if not exists(select 1 from pg_roles where rolname='supabase_admin') then create role supabase_admin nologin; end if; end $$;
        create role m63_inherited_probe nologin;
        alter default privileges for role supabase_admin in schema public grant select on tables to authenticated;
        alter default privileges for role supabase_admin in schema public grant execute on functions to anon;
        alter default privileges for role supabase_admin in schema public grant usage on sequences to authenticated;`)
      const plan=await planLegacyStagingContainment(tx)
      expect(plan.providerAdminStatements).toHaveLength(3)
      expect(plan.statements.some(sql=>sql.includes('FOR ROLE "supabase_admin"'))).toBe(false)
      expect(plan.deferredProviderDefaultGrants).toHaveLength(3)
      for(const sql of plan.statements) await tx.exec(sql)
      let audit=await auditLegacyStagingExposure(tx)
      expect(audit.legacyContainmentVerified).toBe(true)
      expect(audit.deferredProviderDefaultGrants).toHaveLength(3)
      expect(audit.blockingDefaultGrants).toHaveLength(0)
      await tx.exec('grant usage on schema public to m63_inherited_probe; grant m63_inherited_probe to authenticated;')
      audit=await auditLegacyStagingExposure(tx)
      expect(audit.legacyContainmentVerified).toBe(false)
      expect(audit.schemaUsage).toContainEqual({schema_name:"public",role:"authenticated",allowed:true,create_allowed:false})
      // Reapplying direct revocations cannot hide privileges inherited through another role.
      for(const sql of (await planLegacyStagingContainment(tx)).statements) await tx.exec(sql)
      expect((await auditLegacyStagingExposure(tx)).legacyContainmentVerified).toBe(false)
      await tx.exec('revoke usage on schema public from m63_inherited_probe;')
      expect((await auditLegacyStagingExposure(tx)).legacyContainmentVerified).toBe(true)
      await tx.exec('create table public.m63_inherited_data(value text); grant select on public.m63_inherited_data to m63_inherited_probe;')
      audit=await auditLegacyStagingExposure(tx)
      expect(audit.legacyContainmentVerified).toBe(false)
      expect(audit.tableGrants.some(row=>row.table_name==="m63_inherited_data"&&row.role==="authenticated")).toBe(true)
      await tx.exec('revoke select on public.m63_inherited_data from m63_inherited_probe;')
      expect((await auditLegacyStagingExposure(tx)).legacyContainmentVerified).toBe(true)
      await tx.exec('alter default privileges in schema public grant select on tables to m63_inherited_probe;')
      audit=await auditLegacyStagingExposure(tx)
      expect(audit.legacyContainmentVerified).toBe(false)
      expect(audit.blockingDefaultGrants.some(row=>row.role==="m63_inherited_probe")).toBe(true)
      await tx.exec('alter default privileges in schema public revoke select on tables from m63_inherited_probe;')
      await tx.exec('alter default privileges for role supabase_admin grant select on tables to authenticated;')
      audit=await auditLegacyStagingExposure(tx)
      expect(audit.legacyContainmentVerified).toBe(false)
      expect(audit.blockingDefaultGrants.some(row=>row.owner==="supabase_admin"&&row.schema_name===null)).toBe(true)
      await tx.exec('alter default privileges for role supabase_admin revoke select on tables from authenticated; create schema m63_unreviewed_empty;')
      audit=await auditLegacyStagingExposure(tx)
      expect(audit.unreviewedApplicationSchemas).toContain("m63_unreviewed_empty")
      expect(audit.legacyContainmentVerified).toBe(false)
      checked=true
      throw new Error("rollback provider default probe")
    }))).toContain("rollback provider default probe")
    expect(checked).toBe(true)
  })

  test("discovers only approved membership and denies direct writes, role changes and non-invited subjects", async () => {
    expect(await database.hasStagingAccess(owner)).toBe(true)
    expect(await database.hasStagingAccess(uninvited)).toBe(false)
    expect(await database.findStagingWorkspaceForUser(admin)).toMatchObject({ workspace: { id: company }, role: "admin", evidenceId: null })
    expect(await database.findWorkspace(outsider, company)).toBeNull()
    expect(await rejectionMessage(database.findWorkspace(uninvited, company))).toContain("Private staging access")
    expect(await rejectionMessage(scoped(owner,"insert into neuvetra.company_members(company_id,user_id,role) values($1,$2,$3)",[company,uninvited,"owner"]))).toContain("")
    expect(await rejectionMessage(scoped(owner,"delete from neuvetra.inventory_draft_reports where company_id=$1",[company]))).toContain("")
    expect(await rejectionMessage(scoped(owner,"update neuvetra.staging_access set active=true where user_id=$1",[uninvited]))).toContain("")
    expect(await rejectionMessage(runtime.exec("set role authenticated"))).toContain("")
    expect(await rejectionMessage(scoped(owner, "select neuvetra.create_company_workspace($1,'forged',$2,'forged',$3,2023,$4)", [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()]))).toContain("")
    expect(await rejectionMessage(runtime.exec("create table neuvetra.forged(id int)"))).toContain("")
    expect(await rejectionMessage(database.createWorkspaceWithSyntheticMembers())).toContain("operator provisioning")
  },30000)

  test("uses transaction-local subjects across concurrent pooled connections and rollback", async () => {
    await Promise.all(Array.from({ length: 24 }, async (_, i) => {
      const actor = i % 2 ? owner : outsider
      const visible = await (i % 3 ? database : another).findWorkspace(actor, company)
      expect(visible?.id ?? null).toBe(actor === owner ? company : null)
    }))
    expect(await rejectionMessage(runtime.transaction(async tx => {
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [owner])
      throw new Error("injected rollback")
    }))).toContain("injected rollback")
    for (let i = 0; i < 4; i++) expect((await runtime.query<{ id: string | null }>("select nullif(current_setting('request.jwt.claim.sub',true),'') id")).rows[0]?.id ?? null).toBeNull()
    expect(await database.findWorkspace(outsider, company)).toBeNull()
  })

  test("round-trips bytes and exact decimals, converges real concurrent bill writes, and enforces revocation inside SQL", async () => {
    const workspace = (await database.findWorkspace(owner, company))!
    const bytes = new Uint8Array(await Bun.file(new URL("../../../output/pdf/neuvetra-m55-synthetic-electricity-bill.pdf", import.meta.url)).arrayBuffer())
    const digest = new Bun.CryptoHasher("sha256").update(bytes).digest("hex")
    const bills = await Promise.all([database.ingestSyntheticBill(owner, company, bytes, digest), another.ingestSyntheticBill(admin, company, bytes, digest)])
    expect(bills[0]!.id).toBe(bills[1]!.id)
    const evidenceId = bills[0]!.id
    const corrected = await Promise.all([database.correctSyntheticBill(owner, company, evidenceId, workspace.facility.id), another.correctSyntheticBill(admin, company, evidenceId, workspace.facility.id)])
    expect(corrected[0]!.versions).toEqual(corrected[1]!.versions)
    expect(corrected[0]!.versions[1]?.electricityKwh).toBe("12346.000")
    const linked = await database.linkSyntheticBill(owner, company, evidenceId, workspace.boundary.id)
    expect(linked.draftActivity?.quantityMwh).toBe("12.346000")
    const stored = await scoped<{ original_bytes: Uint8Array }>(member, "select original_bytes from neuvetra.bill_evidence where id=$1", [evidenceId])
    expect(new Bun.CryptoHasher("sha256").update(stored.rows[0]!.original_bytes).digest("hex")).toBe(digest)
    expect(await rejectionMessage(scoped(member, "select neuvetra.correct_synthetic_bill($1,$2,$3,$4,$5,$6,$7,12346.000,'Synthetic review exercise')", [company,workspace.facility.id,evidenceId,corrected[0]!.versions[0]!.id,crypto.randomUUID(),crypto.randomUUID(),crypto.randomUUID()]))).toContain("")
    await revokeStagingAccess(operator, admin)
    expect(await database.hasStagingAccess(admin)).toBe(false)
    expect((await scoped(admin, "select id from neuvetra.bill_evidence where company_id=$1", [company])).rows).toEqual([])
    expect(await rejectionMessage(scoped(admin, "select neuvetra.correct_synthetic_bill($1,$2,$3,$4,$5,$6,$7,12346.000,'Synthetic review exercise')", [company,evidenceId,workspace.facility.id,crypto.randomUUID(),crypto.randomUUID(),crypto.randomUUID(),crypto.randomUUID()]))).toContain("")
    await provisionStagingRoster(operator, roster)
    expect((await another.findStagingWorkspaceForUser(admin))?.evidenceId).toBe(evidenceId)
  })

  test("preserves the complete immutable inventory, archive, report and second-manager decision after pool replacement", async () => {
    const workspace = (await database.findWorkspace(owner, company))!
    const evidenceId = (await database.findStagingWorkspaceForUser(owner))!.evidenceId!
    const bill = (await database.findSyntheticBill(owner, company, evidenceId))!
    const lineage = (await database.findSyntheticCalculationLineage(owner,company,evidenceId))!
    const binding = {
      company_id: company, evidence_id: evidenceId, bill_version_id: bill.versions[1]!.id, activity_version_id: bill.draftActivity!.id,
      facility_id: workspace.facility.id, boundary_id: workspace.boundary.id, bill_version: 2,
      extraction_id:lineage.extractionId,parser_version:lineage.parserVersion,previous_bill_version_id:lineage.previousBillVersionId,activity_version:lineage.activityVersion,
      evidence_sha256: bill.sha256, source_quantity_kwh: "12346.000", normalized_quantity_mwh: "12.346000", correction_reason: "Synthetic review exercise",
      service_period: { start: "2023-01-01", end: "2023-01-31" }, facility: { name: "Synthetic California office", country: "United States", state: "California", egrid_subregion: "CAMX" },
      boundary: { reporting_year: 2023, approach: "operational_control", status: "draft", version: 1 },
    }
    const child = Bun.spawnSync([process.env.PYTHON ?? (process.platform === "win32" ? "python" : "python3"), "linked_bill_calculation.py"], { cwd: fileURLToPath(new URL("../../../apps/site-api/src/calculation/", import.meta.url)), env: {...process.env,PYTHONIOENCODING:"utf-8",PYTHONUTF8:"1"}, stdin: new Blob([JSON.stringify({ action: "calculate_linked_bill", binding })]) })
    expect(child.exitCode).toBe(0)
    const record = JSON.parse(new TextDecoder().decode(child.stdout)).record as Record<string, any>
    const calculated = await database.createSyntheticBillCalculation(owner, company, evidenceId, bill.draftActivity!.id, crypto.randomUUID(), "f".repeat(64), record)
    const calculation = calculated.draftCalculation!
    const snapshot = { profile:"m57-synthetic-scope2-inventory-v1", companyId:company, boundaryId:workspace.boundary.id, calculationId:calculation.id, calculationResultSha256:calculation.resultPayloadSha256, reportingYear:2023, scope:"scope_2_location_based", coverage:{expectedFacilities:1,coveredFacilities:1,expectedPeriods:12,coveredPeriods:1,coveredMonths:["2023-01"],missingMonths:["2023-02","2023-03","2023-04","2023-05","2023-06","2023-07","2023-08","2023-09","2023-10","2023-11","2023-12"]}, warnings:[...M57_WARNINGS],complete:false,releaseEligible:false }
    const canonical = (value: any): string => value === null || typeof value !== "object" ? JSON.stringify(value) : Array.isArray(value) ? `[${value.map(canonical).join(",")}]` : `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}`
    const hash = new Bun.CryptoHasher("sha256").update(canonical(snapshot)).digest("hex")
    const inventory = await database.createSyntheticInventory(owner, company, calculation.id, crypto.randomUUID(), "a".repeat(64), hash)
    await database.recordSyntheticInventoryReview(admin, company, inventory.id, "approve_bounded_draft", "bounded_synthetic_scope_reviewed", [...M57_WARNINGS], crypto.randomUUID(), "b".repeat(64))
    const initial = await database.createAnnualRegister(owner, company, inventory.id, crypto.randomUUID())
    const complete = await database.completeAnnualRegister(owner, company, initial.id, initial.snapshotSha256, crypto.randomUUID())
    const annual = await database.createAnnualInventory(owner, company, complete.id, crypto.randomUUID())
    await database.reviewAnnualInventory(admin, company, annual.id, "approve_bounded_annual_location_draft", "bounded_annual_location_register_reviewed", [...M58_WARNINGS], annual.snapshotSha256, crypto.randomUUID())
    const packs = await Promise.all([database.createAnnualEvidencePack(owner, company, annual.id, annual.snapshotSha256, crypto.randomUUID()), another.createAnnualEvidencePack(admin, company, annual.id, annual.snapshotSha256, crypto.randomUUID())])
    expect(packs[0]!.id).toBe(packs[1]!.id)
    const pack = packs[0]!
    const report = await database.createDraftInventoryReport(owner, company, annual.id, pack.id, annual.snapshotSha256, pack.archiveSha256, crypto.randomUUID())
    const reviewInput = { decision:"accept_bounded_internal_draft" as const,reasonCode:"exact_report_reviewed_for_bounded_internal_use" as const,acknowledgedLimitations:[...M61_LIMITATION_ACKNOWLEDGMENTS],changeRouteCode:null,changeNote:null,expectedReportSha256:report.reportSha256,idempotencyKey:crypto.randomUUID() }
    expect(await rejectionMessage(database.reviewDraftInventoryReport(owner, company, annual.id, report.id, reviewInput))).toContain("")
    const decision = await database.reviewDraftInventoryReport(admin, company, annual.id, report.id, reviewInput)
    await another.close()
    another = construct(createPostgresConnection(runtimeUrl(), { tls:false,maxConnections:2 }))
    expect(await another.checkReadiness()).toMatchObject({schemaVersion:STAGING_SCHEMA_VERSION})
    expect(await another.findDraftInventoryReportReview(member,company,annual.id,report.id)).toEqual(decision)
    expect((await another.findDraftInventoryReport(member,company,annual.id))?.reportSha256).toBe(report.reportSha256)
    expect((await another.findAnnualEvidencePack(member,company,annual.id))?.archiveSha256).toBe(pack.archiveSha256)
    expect(await another.findDraftInventoryReport(outsider,company,annual.id)).toBeNull()
    expect(await rejectionMessage(scoped(admin,"update neuvetra.inventory_draft_report_review_decisions set outcome='changes_requested' where company_id=$1",[company]))).toContain("")
    expect(await rejectionMessage(operator.query("update neuvetra.inventory_draft_report_review_decisions set outcome='changes_requested' where company_id=$1",[company]))).toContain("immutable")
  },30000)
})

// BF-09: the release order for 0031. The schema-31 image first runs against the existing project at schema 30 (the bridge);
// later the operator applies 0031 with the same call tools/staging/apply-existing.ts makes (migratePrivateStaging, existing
// project confirmed). A populated schema-30 database on its own disposable loopback database migrates to 31 in one
// transaction, every pre-existing table keeps every row byte for byte (and every column), the only new row is 0031's receipt,
// readiness moves from 30 to 31 with no restart, and both a second operator run and a second run of 0031's SQL change nothing.
pg("BF-09 migration 0031 on a populated schema-30 existing-project database", () => {
  test("migrates 30 to 31 cleanly, preserving every pre-existing table's contents", async () => {
    const fixture = await createStagingSchemaFixture(testUrl!, "m63_bf09_upgrade", 30, EXISTING_PROJECT_REF)
    const runtime = createPostgresConnection(fixture.runtimeUrl, { tls: false, maxConnections: 2 })
    const database = new (HostedWorkspaceDatabase as unknown as new (db: WorkspaceConnection, ref: string, reuse: boolean) => HostedWorkspaceDatabase)(runtime, EXISTING_PROJECT_REF, true)
    const operator = fixture.operator
    try {
      expect(await database.checkReadiness()).toEqual({ profile: "neuvetra.private-synthetic-staging.v1", schemaVersion: 30, legacyContainmentVerified: true })
      // Populate at 30 through the same database methods (and RPCs) the routes use.
      const owner = crypto.randomUUID(), company = crypto.randomUUID()
      await operator.query("insert into auth.users(id) values($1)", [owner])
      // provisionStagingRoster's statements (it validates a complete schema-31 receipt set, so it cannot run at 30).
      await operator.transaction(async tx => {
        await tx.query("insert into neuvetra.staging_access(user_id,active) values($1,true)", [owner])
        await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [owner])
        await tx.query("select neuvetra.create_company_workspace($1,'Synthetic Acme, Inc.',$2,'Synthetic California office',$3,2023,$4)", [company, crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()])
      })
      await operator.query("insert into neuvetra.company_members(company_id,user_id,role) values($1,$2,'owner') on conflict(company_id,user_id) do update set role=excluded.role", [company, owner])
      await operator.query("insert into neuvetra.staging_access(user_id,company_id,active) values($1,$2,true) on conflict(user_id) do update set company_id=excluded.company_id,active=true", [owner, company])
      const base = createSyntheticCompanySetup()
      const site = { ...base.locations[0]!, inclusion: "included" as const, control: "reporting_company" as const, startMode: "period_start" as const, endMode: "period_end" as const }
      const setup = { ...base, boundary: { ...base.boundary, approach: "operational_control" as const }, entities: base.entities.map(entity => ({ ...entity, inclusion: "included" as const, control: "operational_control" as const })), locations: [site] }
      const saved = await database.saveCompanySetup(owner, company, { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, expectedVersionId: null, correctionReason: null, setup })
      const setupVersionId = (saved as { savedVersion: { id: string } }).savedVersion.id
      const common = { locationId: site.id, setupVersionId, state: "active", withdrawalReason: null, quality: "actual", estimateBasis: null, period: { start: "2025-01-01", endExclusive: "2026-01-01" }, reference: "Synthetic BF-09", notes: "", evidenceIds: [] }
      const q = (value: string, unit: string) => ({ originalValue: value, originalUnit: unit, normalizedValue: value, normalizedUnit: unit })
      const activities = [
        { ...common, kind: "natural_gas", sourceId: "GAS-1", quantity: q("12500", "therm"), payload: { heatContent: null } },
        { ...common, kind: "distillate_no2", sourceId: "GEN-1", quantity: q("25", "US_gallon"), payload: { consumption: { basis: "measured", gallons: "25" }, statedHhvMmbtuPerGallon: null } },
        { ...common, kind: "vehicle", sourceId: "VANS", quantity: q("1200", "US_gallon"), payload: { vehicleGroupId: "VANS", fuel: "diesel", vehicleType: "diesel_light_duty_truck", modelYear: 2021, gallons: "1200", vehicleCount: 4, miles: null, fuelEconomy: null } },
        { ...common, kind: "fugitive", sourceId: "HVAC-1", quantity: q("1", "kg"), payload: { gas: "R-410A", unit: "kg", terms: { PN: "0", CN: "0", PS: "1", CD: "0", RD: "0" }, insideBoundary: true, maintainsRefrigerantStock: false, retrofitInPeriod: false, contractorRecordsComplete: true, eventChronologyComplete: true } },
        { ...common, kind: "electricity", sourceId: "M-1", quantity: q("250000", "kWh"), payload: { meterOrAccountNumber: "M-1", utilityName: "City & County of San Francisco", site: "Office", zip: "94105", subregion: "CAMX", utilityEiaId: "16612", instruments: [] } },
        { ...common, kind: "business_travel", sourceId: "T-1", quantity: q("2400", "mile"), payload: { mode: "air", passengerSegments: 4, haulBasis: null } },
      ]
      const ids: string[] = []
      for (const activity of activities) { const id = crypto.randomUUID(); ids.push(id); await database.saveCollectionActivity(owner, company, id, { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, expectedVersionId: null, correctionReason: null, activity }) }
      const revise = async (index: number, change: Record<string, unknown>, reason: string) => {
        const current = (await database.findCollectionActivities(owner, company)).find(record => record.id === ids[index])!.currentVersion
        return database.saveCollectionActivity(owner, company, ids[index]!, { idempotencyKey: crypto.randomUUID(), expectedRevision: current.revision, expectedVersionId: current.id, correctionReason: reason, activity: { ...activities[index]!, ...change } })
      }
      await revise(0, { quantity: q("12600", "therm") }, "Corrected therms")
      await revise(1, { state: "withdrawn", withdrawalReason: "Entered twice." }, "Withdrawn: entered twice")
      await revise(4, { state: "withdrawn", withdrawalReason: "Wrong meter." }, "Withdrawn: wrong meter")
      await revise(4, {}, "Reactivated: right meter after all")
      // At 30 the database refuses the 0031 flag (the route refuses it first; scope12PayloadAvailable).
      expect(await rejectionMessage(revise(0, { quantity: q("12600", "therm"), payload: { heatContent: null, duplicateConfirmedDistinct: true } }, "Confirmed distinct"))).not.toBe("")
      const recordsAt30 = await database.findCollectionActivities(owner, company)

      const before = await snapshotStagingTables(operator)
      expect(before["neuvetra.collection_activity_versions"]!.rows).toBe(10)
      // 0031's drift guard: over a function that is not 0030's (here changed by hand) it stops with 55000 and changes nothing.
      const manifest = await readMigrationManifest()
      const drift = await operator.transaction(async tx => {
        await tx.exec("create or replace function neuvetra.approve_scope3_report(target_company uuid,request jsonb) returns table(version_id uuid,approved_by uuid,approved_at timestamptz,self_approved boolean,replayed boolean) language sql as $$ select null::uuid,null::uuid,null::timestamptz,null::boolean,null::boolean $$")
        await tx.exec(manifest[30]!.sql)
      }).then(() => null, (error: { code?: string; message: string }) => [error.code, error.message])
      expect(drift).toEqual(["55000", "0031: neuvetra.approve_scope3_report(uuid,jsonb) differs from 0030; re-derive 0031 from the applied 0030"])
      expect(await snapshotStagingTables(operator)).toEqual(before)
      const migrated = await migratePrivateStaging(operator, { expectedProjectRef: EXISTING_PROJECT_REF, syntheticTargetConfirmed: true, reuseExistingProject: true })
      expect(migrated.schemaVersion).toBe(32)
      const after = await snapshotStagingTables(operator)
      expect(Object.keys(after)).toEqual(Object.keys(before))
      const changed = Object.keys(before).filter(table => JSON.stringify(before[table]) !== JSON.stringify(after[table]))
      // From 32 (BF-18) the two tables 0032 alters gain columns; this database has no instrument or approval row to backfill.
      expect(changed).toEqual(["neuvetra.collection_electricity_instruments", "neuvetra.schema_migrations", "neuvetra.scope3_report_approvals"])
      expect([before["neuvetra.schema_migrations"]!.rows, after["neuvetra.schema_migrations"]!.rows, after["neuvetra.schema_migrations"]!.columns]).toEqual([30, 32, before["neuvetra.schema_migrations"]!.columns])
      const receipts = await operator.query<{ name: string; sha256: string }>("select name,sha256 from neuvetra.schema_migrations order by name")
      expect(receipts.rows).toEqual(manifest.map(({ name, sha256 }) => ({ name, sha256 })))
      // Readiness moves to the image schema (32: 0031 and 0032) with no restart, and the records read back exactly as at 30.
      expect(await database.checkReadiness()).toEqual({ profile: "neuvetra.private-synthetic-staging.v1", schemaVersion: 32, legacyContainmentVerified: true })
      expect(await database.findCollectionActivities(owner, company)).toEqual(recordsAt30)
      // A second operator run applies nothing; the newest migration (0032) run again changes nothing.
      expect((await migratePrivateStaging(operator, { expectedProjectRef: EXISTING_PROJECT_REF, syntheticTargetConfirmed: true, reuseExistingProject: true })).schemaVersion).toBe(32)
      await operator.transaction(tx => tx.exec(manifest[31]!.sql))
      expect(await snapshotStagingTables(operator)).toEqual(after)
      expect((await database.checkReadiness()).schemaVersion).toBe(32)
      // At 31 the flag is stored, and the record reads back with it.
      await revise(0, { quantity: q("12600", "therm"), payload: { heatContent: null, duplicateConfirmedDistinct: true } }, "Confirmed distinct")
      expect((await database.findCollectionActivities(owner, company)).find(record => record.id === ids[0])!.currentVersion.activity.payload).toEqual({ heatContent: null, duplicateConfirmedDistinct: true })
    } finally { await database.close(); await fixture.close() }
  }, 120_000)
})

// BF-18: the release order for 0032, as for 0031. The schema-32 image first serves the existing project at schema 31 (hosted
// staging today); later the owner applies 0032 through tools/staging/apply-existing.ts, which makes exactly this call. A
// populated schema-31 database (electricity instruments whose numbers 0027/0031 stored rounded or as null, a corrected
// version, a frozen and approved Scope 3 report version) migrates to 32 in one transaction. Only the two backfilled tables and
// the receipts change; every instrument row then equals its payload (BF-24); every approval carries its version's CSV hash;
// every payload, version, receipt and report is byte for byte as before; readiness moves to 32 with no restart; and a second
// operator run, and a second run of 0032's SQL, change nothing.
pg("BF-18 migration 0032 on a populated schema-31 existing-project database", () => {
  test("migrates 31 to 32: backfills the instrument projection and the approval CSV hash, and changes nothing else", async () => {
    const fixture = await createStagingSchemaFixture(testUrl!, "m63_bf18_upgrade", 31, EXISTING_PROJECT_REF)
    const runtime = createPostgresConnection(fixture.runtimeUrl, { tls: false, maxConnections: 2 })
    const database = new (HostedWorkspaceDatabase as unknown as new (db: WorkspaceConnection, ref: string, reuse: boolean) => HostedWorkspaceDatabase)(runtime, EXISTING_PROJECT_REF, true)
    const operator = fixture.operator
    const failure = (promise: Promise<unknown>) => promise.then(() => "ok", (error: { code?: string; message?: string }) => `${error.code ?? "no code"} ${error.message ?? ""}`)
    try {
      expect(await database.checkReadiness()).toEqual({ profile: "neuvetra.private-synthetic-staging.v1", schemaVersion: 31, legacyContainmentVerified: true })
      const owner = crypto.randomUUID(), company = crypto.randomUUID()
      await operator.query("insert into auth.users(id) values($1)", [owner])
      // provisionStagingRoster's statements (it validates a complete receipt set, so it cannot run below the image schema).
      await operator.transaction(async tx => {
        await tx.query("insert into neuvetra.staging_access(user_id,active) values($1,true)", [owner])
        await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [owner])
        await tx.query("select neuvetra.create_company_workspace($1,'Synthetic Acme, Inc.',$2,'Synthetic California office',$3,2023,$4)", [company, crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()])
      })
      await operator.query("insert into neuvetra.company_members(company_id,user_id,role) values($1,$2,'owner') on conflict(company_id,user_id) do update set role=excluded.role", [company, owner])
      await operator.query("insert into neuvetra.staging_access(user_id,company_id,active) values($1,$2,true) on conflict(user_id) do update set company_id=excluded.company_id,active=true", [owner, company])
      const base = createSyntheticCompanySetup()
      const site = { ...base.locations[0]!, inclusion: "included" as const, control: "reporting_company" as const, startMode: "period_start" as const, endMode: "period_end" as const }
      // Category 3 included, so the line count before 0032 also counts the lines derived from Scope 1 and 2 records.
      const setup = { ...base, boundary: { ...base.boundary, approach: "operational_control" as const }, entities: base.entities.map(entity => ({ ...entity, inclusion: "included" as const, control: "operational_control" as const })), locations: [site],
        screening: [...base.screening, { id: "fuel", scope: 3 as const, category: "fuel_and_energy_related_activities", state: "yes" as const, reason: "", details: "", locationId: null }] }
      const saved = await database.saveCompanySetup(owner, company, { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, expectedVersionId: null, correctionReason: null, setup: setup as typeof base })
      const setupVersionId = (saved as { savedVersion: { id: string } }).savedVersion.id
      const common = { locationId: site.id, setupVersionId, state: "active", withdrawalReason: null, quality: "actual", estimateBasis: null, period: { start: "2025-01-01", endExclusive: "2026-01-01" }, reference: "Synthetic BF-18", notes: "", evidenceIds: [] }
      const q = (value: string, unit: string) => ({ originalValue: value, originalUnit: unit, normalizedValue: value, normalizedUnit: unit })
      const instrument = (extra: Record<string, unknown>) => ({ type: "energy_attribute_certificate", mwh: "250", qualityCriteriaMet: true, vintageYear: 2025, evidenceReference: null, generationTechnology: "wind", rateLbPerMwh: null, ...extra })
      const electricity = (sourceId: string, instruments: unknown[]) => ({ ...common, kind: "electricity", sourceId, quantity: q("250000", "kWh"), payload: { meterOrAccountNumber: sourceId, utilityName: "City & County of San Francisco", site: "Office", zip: "94105", subregion: "CAMX", utilityEiaId: "16612", instruments } })
      const activities = [
        // 12.5 was stored as 12.500 (numeric(15,3)); the auditor's J1 rate (four decimals) was stored as null.
        electricity("M-1", [instrument({ mwh: "12.5" }), instrument({ type: "supplier_specific_rate", mwh: "250.125", generationTechnology: "natural_gas", rateLbPerMwh: { co2: "800.1234", ch4: "0.0331", n2o: "0.0045" } })]),
        // Blank and non-decimal input: null before and after.
        electricity("M-2", [instrument({ type: "power_purchase_agreement", mwh: "", rateLbPerMwh: null }), instrument({ type: "supplier_specific_rate", mwh: "1.2345", generationTechnology: "natural_gas", rateLbPerMwh: { co2: "", ch4: "0.0001", n2o: null } })]),
        electricity("M-3", []),
        { ...common, kind: "natural_gas", sourceId: "GAS-1", quantity: q("12500", "therm"), payload: { heatContent: null } },
        { ...common, kind: "business_travel", sourceId: "T-1", quantity: q("2400", "mile"), payload: { mode: "air", passengerSegments: 4, haulBasis: null } },
      ]
      const ids: string[] = [], keys: string[] = []
      for (const activity of activities) { const id = crypto.randomUUID(), key = crypto.randomUUID(); ids.push(id); keys.push(key); await database.saveCollectionActivity(owner, company, id, { idempotencyKey: key, expectedRevision: 0, expectedVersionId: null, correctionReason: null, activity }) }
      // A corrected version of M-1: both versions keep their own instrument rows.
      const m1 = (await database.findCollectionActivities(owner, company)).find(record => record.id === ids[0])!.currentVersion
      await database.saveCollectionActivity(owner, company, ids[0]!, { idempotencyKey: crypto.randomUUID(), expectedRevision: m1.revision, expectedVersionId: m1.id, correctionReason: "Corrected certificate MWh",
        activity: electricity("M-1", [instrument({ mwh: "12.75" }), instrument({ type: "supplier_specific_rate", mwh: "250.125", generationTechnology: "natural_gas", rateLbPerMwh: { co2: "800.1234", ch4: "0.0331", n2o: "0.0045" } })]) })
      // At 31 an idempotency key reused for different content is 23505 (BI-11).
      const reuse = { idempotencyKey: keys[3]!, expectedRevision: 0, expectedVersionId: null, correctionReason: null, activity: activities[3] }
      expect(await failure(database.saveCollectionActivity(owner, company, crypto.randomUUID(), reuse))).toStartWith("23505 ")
      // At 31 the identity keys are refused by the database (the route refuses them first).
      expect(await failure(operator.transaction(async tx => {
        await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [owner])
        await tx.query("select * from neuvetra.save_collection_activity($1,$2,$3::jsonb)", [company, crypto.randomUUID(), JSON.stringify({ idempotencyKey: crypto.randomUUID(), expectedRevision: 0, expectedVersionId: null, correctionReason: null, activity: electricity("M-9", [instrument({ instrumentId: "WREGIS-123" })]) })])
      }))).toStartWith("22023 ")
      // A frozen, approved Scope 3 report version (written as the operator: the table checks recompute both hashes).
      const version = crypto.randomUUID()
      await operator.query(`insert into neuvetra.scope3_report_versions(id,company_id,reporting_year,revision,previous_id,setup_version_id,reason,report_text,report_sha256,csv_text,csv_sha256,engine_sha256,register_sha256s,input_version_ids,change_log_basis,open_issues,created_by)
        values($1,$2,2025,1,null,$3,null,$4,encode(sha256(convert_to($4,'UTF8')),'hex'),$5,encode(sha256(convert_to($5,'UTF8')),'hex'),$6,'{}'::jsonb,$7::uuid[],'{}','[]'::jsonb,$8)`,
        [version, company, setupVersionId, '{"synthetic":"report"}', "line,total\r\n1,2.000\r\n", "e".repeat(64), [ids[4]], owner])
      await operator.query("insert into neuvetra.scope3_report_approvals(version_id,company_id,report_sha256,approved_by,self_approved,self_approval_confirmed) select id,company_id,report_sha256,$2,true,true from neuvetra.scope3_report_versions where id=$1", [version, owner])
      const lineCount = async () => Number((await operator.query<{ n: number }>("select neuvetra.scope3_active_line_count($1) n", [company])).rows[0]!.n)
      // Before 0032: 1 Scope 3 record + 3 lines for each of the 3 electricity records + 1 for the gas record.
      expect(await lineCount()).toBe(11)
      const instrumentRows = () => operator.query<Record<string, string | number | null>>(`select i.version_id,i.ordinal,i.mwh::text mwh,i.rate_co2_lb_per_mwh::text co2,i.rate_ch4_lb_per_mwh::text ch4,i.rate_n2o_lb_per_mwh::text n2o
        from neuvetra.collection_electricity_instruments i join neuvetra.collection_activity_versions v on v.id=i.version_id where v.company_id=$1 order by v.source_id,v.revision,i.ordinal`, [company]).then(r => r.rows.map(({ version_id: _v, ...row }) => row))
      expect(await instrumentRows()).toEqual([
        { ordinal: 1, mwh: "12.500", co2: null, ch4: null, n2o: null }, { ordinal: 2, mwh: "250.125", co2: null, ch4: null, n2o: null },
        { ordinal: 1, mwh: "12.750", co2: null, ch4: null, n2o: null }, { ordinal: 2, mwh: "250.125", co2: null, ch4: null, n2o: null },
        { ordinal: 1, mwh: null, co2: null, ch4: null, n2o: null }, { ordinal: 2, mwh: null, co2: null, ch4: null, n2o: null },
      ])
      const recordsAt31 = await database.findCollectionActivities(owner, company)
      const before = await snapshotStagingTables(operator)
      const manifest = await readMigrationManifest()

      // 0032's drift guard: over a function that is not 0031's (here the line count changed by hand) it stops with 55000.
      const drift = await operator.transaction(async tx => {
        await tx.exec("create or replace function neuvetra.scope3_active_line_count(target_company uuid) returns integer language sql stable security definer set search_path=pg_catalog,neuvetra,pg_temp as $$ select 0 $$")
        await tx.exec(manifest[31]!.sql)
      }).then(() => null, (error: { code?: string; message: string }) => [error.code, error.message])
      expect(drift).toEqual(["55000", "0032: neuvetra.scope3_active_line_count(uuid) differs from 0031; re-derive 0032 from the applied 0031"])
      expect(await snapshotStagingTables(operator)).toEqual(before)
      // The operator migration refuses to commit anything that a migration would expose: here 0032 plus a stray function
      // left executable by PUBLIC (which readiness would also refuse); nothing is applied.
      const leaky = manifest.map(m => m.name !== "0032_instrument_identity_and_bindings.sql" ? m : (() => { const sql = `${m.sql}\ncreate function neuvetra.bf18_probe() returns integer language sql as $$ select 1 $$;\n`; return { ...m, sql, sha256: new Bun.CryptoHasher("sha256").update(sql).digest("hex") } })())
      expect(await failure(migratePrivateStagingFromManifest(operator, { expectedProjectRef: EXISTING_PROJECT_REF, syntheticTargetConfirmed: true, reuseExistingProject: true }, leaky))).toBe("no code A migration would break the verified legacy containment.")
      expect(await snapshotStagingTables(operator)).toEqual(before)
      expect((await database.checkReadiness()).schemaVersion).toBe(31)

      // The owner's step.
      const migrated = await migratePrivateStaging(operator, { expectedProjectRef: EXISTING_PROJECT_REF, syntheticTargetConfirmed: true, reuseExistingProject: true })
      expect([migrated.schemaVersion, migrated.postMigrationAudit]).toEqual([32, { legacyContainmentVerified: true, storageGuardGrantsVerified: true }])
      const after = await snapshotStagingTables(operator)
      expect(Object.keys(after)).toEqual(Object.keys(before))
      expect(Object.keys(before).filter(table => JSON.stringify(before[table]) !== JSON.stringify(after[table]))).toEqual(["neuvetra.collection_electricity_instruments", "neuvetra.schema_migrations", "neuvetra.scope3_report_approvals"])
      // Same rows in each (none added or lost); the instrument columns gain the identity and lose the numeric(15,3) limit.
      for (const table of ["neuvetra.collection_electricity_instruments", "neuvetra.scope3_report_approvals"]) expect(after[table]!.rows).toBe(before[table]!.rows)
      expect(after["neuvetra.collection_electricity_instruments"]!.columns).toBe(before["neuvetra.collection_electricity_instruments"]!.columns.replaceAll("numeric(15,3)", "numeric") + ", instrument_id text f , registry text f , face_mwh numeric f ")
      expect(after["neuvetra.scope3_report_approvals"]!.columns).toBe(before["neuvetra.scope3_report_approvals"]!.columns + ", csv_sha256 text t ")
      expect([before["neuvetra.schema_migrations"]!.rows, after["neuvetra.schema_migrations"]!.rows]).toEqual([31, 32])
      // BF-24 (auditor J1): every instrument column now equals its payload value.
      expect(await instrumentRows()).toEqual([
        { ordinal: 1, mwh: "12.5", co2: null, ch4: null, n2o: null }, { ordinal: 2, mwh: "250.125", co2: "800.1234", ch4: "0.0331", n2o: "0.0045" },
        { ordinal: 1, mwh: "12.75", co2: null, ch4: null, n2o: null }, { ordinal: 2, mwh: "250.125", co2: "800.1234", ch4: "0.0331", n2o: "0.0045" },
        { ordinal: 1, mwh: null, co2: null, ch4: null, n2o: null }, { ordinal: 2, mwh: "1.2345", co2: null, ch4: "0.0001", n2o: null },
      ])
      expect((await operator.query("select version_id from neuvetra.scope3_report_approvals a join neuvetra.scope3_report_versions v on v.id=a.version_id where a.csv_sha256=v.csv_sha256 and a.report_sha256=v.report_sha256")).rows).toEqual([{ version_id: version }])
      // Readiness moves to 32 with no restart; every record reads back exactly as at 31.
      expect(await database.checkReadiness()).toEqual({ profile: "neuvetra.private-synthetic-staging.v1", schemaVersion: 32, legacyContainmentVerified: true })
      expect(await database.findCollectionActivities(owner, company)).toEqual(recordsAt31)
      // BF-21 option C: the count is the stored Scope 3 records only (the one travel record).
      expect(await lineCount()).toBe(1)
      // A second operator run applies nothing; 0032's SQL run again changes nothing.
      expect((await migratePrivateStaging(operator, { expectedProjectRef: EXISTING_PROJECT_REF, syntheticTargetConfirmed: true, reuseExistingProject: true })).schemaVersion).toBe(32)
      await operator.transaction(tx => tx.exec(manifest[31]!.sql))
      expect(await snapshotStagingTables(operator)).toEqual(after)

      // At 32: the identity keys are saved, read back and projected (BF-24 with BF-11's faceMwh); the receipt mismatch is 23N32.
      const certified = electricity("M-4", [instrument({ mwh: "250.000", instrumentId: "WREGIS-123", registry: "WREGIS", faceMwh: "250" }), instrument({ type: "green_tariff", mwh: "10", instrumentId: "GT-2025", registry: null, faceMwh: "120.5" }),
        instrument({ type: "supplier_specific_rate", mwh: "1.25", generationTechnology: "natural_gas", rateLbPerMwh: { co2: "800.1234", ch4: "0.0331", n2o: "0.0045" }, instrumentId: "PG&E 2025 disclosure" })])
      const m4 = crypto.randomUUID()
      const stored = await database.saveCollectionActivity(owner, company, m4, { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, expectedVersionId: null, correctionReason: null, activity: certified })
      expect(stored.version.activity.payload as unknown).toEqual(certified.payload)
      expect((await operator.query(`select i.ordinal,i.instrument_type,i.mwh::text mwh,i.rate_co2_lb_per_mwh::text co2,i.rate_ch4_lb_per_mwh::text ch4,i.rate_n2o_lb_per_mwh::text n2o,i.instrument_id,i.registry,i.face_mwh::text face_mwh
        from neuvetra.collection_electricity_instruments i where i.version_id=$1 order by i.ordinal`, [stored.version.id])).rows).toEqual([
        { ordinal: 1, instrument_type: "energy_attribute_certificate", mwh: "250.000", co2: null, ch4: null, n2o: null, instrument_id: "WREGIS-123", registry: "WREGIS", face_mwh: "250" },
        { ordinal: 2, instrument_type: "green_tariff", mwh: "10", co2: null, ch4: null, n2o: null, instrument_id: "GT-2025", registry: null, face_mwh: "120.5" },
        { ordinal: 3, instrument_type: "supplier_specific_rate", mwh: "1.25", co2: "800.1234", ch4: "0.0331", n2o: "0.0045", instrument_id: "PG&E 2025 disclosure", registry: null, face_mwh: null },
      ])
      expect(await failure(database.saveCollectionActivity(owner, company, crypto.randomUUID(), reuse))).toStartWith("23N32 ")
      // The database refuses what the contract refuses: a zero face value, a blank or over-long identity, a control character.
      for (const bad of [{ faceMwh: "0" }, { faceMwh: "0.000" }, { faceMwh: "1.2345" }, { faceMwh: "" }, { instrumentId: " " }, { instrumentId: "x".repeat(121) }, { instrumentId: "A\tB" }, { registry: "" }, { registry: "r".repeat(81) }, { instrumentId: 7 }]) {
        const sent = { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, expectedVersionId: null, correctionReason: null, activity: electricity("M-8", [instrument(bad)]) }
        expect([JSON.stringify(bad), await failure(operator.transaction(async tx => {
          await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [owner])
          await tx.query("select * from neuvetra.save_collection_activity($1,$2,$3::jsonb)", [company, crypto.randomUUID(), JSON.stringify(sent)])
        }))]).toEqual([JSON.stringify(bad), expect.stringMatching(/^22023 /)])
      }
      // BI-05: an approval row must match both hashes of its version (the foreign key), and the approval function writes the
      // CSV hash, refusing a csvSha256 the version does not have (23505, as for the report hash).
      const second = crypto.randomUUID()
      await operator.query(`insert into neuvetra.scope3_report_versions(id,company_id,reporting_year,revision,previous_id,setup_version_id,reason,report_text,report_sha256,csv_text,csv_sha256,engine_sha256,register_sha256s,input_version_ids,change_log_basis,open_issues,created_by)
        values($1,$2,2025,2,$9,$3,'Second revision',$4,encode(sha256(convert_to($4,'UTF8')),'hex'),$5,encode(sha256(convert_to($5,'UTF8')),'hex'),$6,'{}'::jsonb,$7::uuid[],'{}','[]'::jsonb,$8)`,
        [second, company, setupVersionId, '{"synthetic":"report 2"}', "line,total\r\n1,3.000\r\n", "e".repeat(64), [ids[4]], owner, version])
      expect(await failure(operator.query("insert into neuvetra.scope3_report_approvals(version_id,company_id,report_sha256,csv_sha256,approved_by,self_approved,self_approval_confirmed) select id,company_id,report_sha256,$2,$3,true,true from neuvetra.scope3_report_versions where id=$1", [second, "0".repeat(64), owner]))).toStartWith("23503 ")
      const hashes = (await operator.query<{ report_sha256: string; csv_sha256: string }>("select report_sha256,csv_sha256 from neuvetra.scope3_report_versions where id=$1", [second])).rows[0]!
      const approve = (request: Record<string, unknown>) => operator.transaction(async tx => {
        await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [owner])
        return (await tx.query<{ version_id: string; replayed: boolean }>("select * from neuvetra.approve_scope3_report($1,$2::jsonb)", [company, JSON.stringify(request)])).rows[0]
      })
      const flags = { versionId: second, reportSha256: hashes.report_sha256, acknowledgeOpenIssues: false, confirmSelfApproval: true }
      expect(await failure(approve({ ...flags, csvSha256: "0".repeat(64) }))).toStartWith("23505 ")
      expect(await failure(approve({ ...flags, csvSha256: "not a hash" }))).toStartWith("22023 ")
      expect(await approve({ ...flags, csvSha256: hashes.csv_sha256 })).toMatchObject({ version_id: second, replayed: false })
      // A request without csvSha256 (today's route) is still accepted, and replays.
      expect(await approve(flags)).toMatchObject({ version_id: second, replayed: true })
      expect((await operator.query("select csv_sha256 from neuvetra.scope3_report_approvals where version_id=$1", [second])).rows).toEqual([{ csv_sha256: hashes.csv_sha256 }])
      // The approval stays immutable after the backfill (its row trigger is back on).
      expect(await failure(operator.query("update neuvetra.scope3_report_approvals set csv_sha256=$2 where version_id=$1", [version, "0".repeat(64)]))).not.toBe("ok")
      expect(await failure(operator.query("update neuvetra.collection_electricity_instruments set mwh=1 where version_id=$1", [stored.version.id]))).not.toBe("ok")
      // The runtime still reads both tables and still cannot write them; the containment audit is unchanged.
      expect(await failure(runtime.query("update neuvetra.collection_electricity_instruments set mwh=1"))).toStartWith("42501 ")
      const audit = await auditLegacyStagingExposure(operator)
      expect([audit.legacyContainmentVerified, audit.storageGuardGrantsVerified, audit.callableFunctions.map(f => f.signature).sort()]).toEqual([true, true, [
        "neuvetra.collection_storage_can_read(text,text)", "neuvetra.collection_storage_can_read(text,text)", "neuvetra.collection_storage_can_upload(text,text)", "neuvetra.collection_storage_can_upload(text,text)"]])
    } finally { await database.close(); await fixture.close() }
  }, 180_000)
})

// BF-10: tools/staging/apply-existing.ts runs every containment statement before migrating. The blanket
// "REVOKE ALL ON ALL FUNCTIONS IN SCHEMA neuvetra" also took away 0027's deliberate PUBLIC EXECUTE on the two Storage policy
// guards, so every Supabase Storage insert and select with a user token failed with 42501 in every bucket (the restrictive
// "to public" policies call the guards), while the audit still reported containment verified.
const BF10_GUARDS = ["neuvetra.collection_storage_can_read(text,text)", "neuvetra.collection_storage_can_upload(text,text)"]
const BF10_GRANTS = BF10_GUARDS.map(signature => `GRANT EXECUTE ON FUNCTION ${signature} TO PUBLIC;`)
pg("BF-10 the legacy containment plan keeps the Storage policy guards callable", () => {
  test("running the plan's statements leaves Storage behaving exactly as before, the guards executable and the audit verified", async () => {
    const fixture = await createStagingSchemaFixture(testUrl!, "m63_bf10_containment", 30, EXISTING_PROJECT_REF)
    const operator = fixture.operator
    const runtime = createPostgresConnection(fixture.runtimeUrl, { tls: false, maxConnections: 2 })
    const database = new (HostedWorkspaceDatabase as unknown as new (db: WorkspaceConnection, ref: string, reuse: boolean) => HostedWorkspaceDatabase)(runtime, EXISTING_PROJECT_REF, true)
    const EVIDENCE = "neuvetra-private-company-evidence", OTHER = "bf10-other-bucket"
    try {
      const owner = crypto.randomUUID(), company = crypto.randomUUID()
      await operator.query("insert into auth.users(id) values($1)", [owner])
      await operator.transaction(async tx => {
        await tx.query("insert into neuvetra.staging_access(user_id,active) values($1,true)", [owner])
        await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [owner])
        await tx.query("select neuvetra.create_company_workspace($1,'Synthetic Storage Co.',$2,'Synthetic office',$3,2023,$4)", [company, crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()])
      })
      await operator.query("insert into neuvetra.company_members(company_id,user_id,role) values($1,$2,'owner') on conflict(company_id,user_id) do update set role=excluded.role", [company, owner])
      await operator.query("insert into neuvetra.staging_access(user_id,company_id,active) values($1,$2,true) on conflict(user_id) do update set company_id=excluded.company_id,active=true", [owner, company])
      // Another bucket with ordinary policies, standing in for every other bucket on the hosted project.
      await operator.exec(`insert into storage.buckets(id,name,public) values('${OTHER}','${OTHER}',false);
        create policy bf10_other_insert on storage.objects for insert to authenticated with check(bucket_id='${OTHER}');
        create policy bf10_other_select on storage.objects for select to authenticated using(bucket_id='${OTHER}');
        insert into storage.objects(bucket_id,name) values('${OTHER}','existing/one.csv');`)
      const asOwner = <T>(operation: (tx: WorkspaceConnection | Parameters<Parameters<WorkspaceConnection["transaction"]>[0]>[0]) => Promise<T>) => runtime.transaction(async tx => {
        await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [owner])
        return operation(tx)
      })
      const evidence = () => ({ uploadId: crypto.randomUUID(), evidenceId: crypto.randomUUID(), objectKey: `${company}/original/${crypto.randomUUID()}`, originalName: "synthetic-bill.pdf", mediaType: "application/pdf" as const, byteLength: 1200, sha256: Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join("") })
      // One clean evidence file, through the real collection functions, and one reserved upload that is not yet stored.
      const clean = evidence(), reserved = evidence()
      await asOwner(tx => reserveCollectionEvidenceUpload(tx, owner, company, clean))
      await operator.query("insert into storage.objects(bucket_id,name) values($1,$2)", [EVIDENCE, clean.objectKey])
      await asOwner(tx => registerCollectionEvidence(tx, owner, company, clean))
      await operator.query("select neuvetra.record_collection_evidence_quarantine($1,$2,'clean','synthetic-scanner-v1','Synthetic fixture accepted.')", [company, clean.evidenceId])
      await asOwner(tx => reserveCollectionEvidenceUpload(tx, owner, company, reserved))
      // Supabase Storage runs each insert and select as the caller's role; every probe is rolled back.
      const as = async (role: "anon" | "authenticated", sql: string, params: unknown[] = []) => {
        const rollback = new Error("bf10 rollback")
        let outcome = ""
        await operator.transaction(async tx => {
          if (role === "authenticated") await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [owner])
          await tx.exec(`set local role ${role}`)
          try { outcome = "ok " + JSON.stringify((await tx.query(sql, params)).rows) } catch (error) { outcome = `error ${(error as { code?: string }).code} ${(error as Error).message}` }
          throw rollback
        }).catch(error => { if (error !== rollback) throw error })
        return outcome
      }
      const probes = async () => ({
        uploadReserved: await as("authenticated", "insert into storage.objects(bucket_id,name) values($1,$2)", [EVIDENCE, reserved.objectKey]),
        uploadUnreserved: await as("authenticated", "insert into storage.objects(bucket_id,name) values($1,$2)", [EVIDENCE, `${company}/original/${crypto.randomUUID()}`]),
        readEvidence: await as("authenticated", "select name from storage.objects where bucket_id=$1 order by name", [EVIDENCE]),
        uploadOther: await as("authenticated", "insert into storage.objects(bucket_id,name) values($1,'new/two.csv')", [OTHER]),
        readOther: await as("authenticated", "select name from storage.objects where bucket_id=$1 order by name", [OTHER]),
        anonReadEvidence: await as("anon", "select name from storage.objects where bucket_id=$1", [EVIDENCE]),
      })
      const privileges = async () => (await operator.query<{ signature: string; public: boolean; anon: boolean; authenticated: boolean }>(`select s signature,
          exists(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid=s::regprocedure and a.grantee=0 and a.privilege_type='EXECUTE') public,
          has_function_privilege('anon',s,'EXECUTE') anon,has_function_privilege('authenticated',s,'EXECUTE') authenticated
        from unnest($1::text[]) s order by s`, [BF10_GUARDS])).rows
      const callable = BF10_GUARDS.map(signature => ({ signature, public: true, anon: true, authenticated: true }))

      const before = await probes()
      expect(before.uploadReserved).toBe("ok []")
      expect(before.uploadUnreserved).toStartWith("error 42501 new row violates row-level security policy")
      expect(before.readEvidence).toBe(`ok [{"name":"${clean.objectKey}"}]`)
      expect(before.uploadOther).toBe("ok []")
      expect(before.readOther).toBe('ok [{"name":"existing/one.csv"}]')
      expect(before.anonReadEvidence).toBe("ok []")
      expect(await privileges()).toEqual(callable)
      expect((await auditLegacyStagingExposure(operator)).legacyContainmentVerified).toBe(true)

      // The same transaction tools/staging/apply-existing.ts runs: plan, every statement in order, audit.
      const plan = await planLegacyStagingContainment(operator)
      const audit = await operator.transaction(async tx => {
        for (const statement of plan.statements) await tx.exec(statement)
        return auditLegacyStagingExposure(tx)
      })
      // On 8d15de7 both guards lost every EXECUTE grant here and each Storage probe failed with 42501.
      expect(await privileges()).toEqual(callable)
      expect(await probes()).toEqual(before)
      expect([audit.legacyContainmentVerified, audit.storageGuardGrantsVerified, audit.missingStorageGuardGrants, audit.storagePolicyGuards.map(g => g.signature)]).toEqual([true, true, [], BF10_GUARDS])
      const revoke = plan.statements.indexOf('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA "neuvetra" FROM PUBLIC, anon, authenticated;')
      expect(revoke).toBeGreaterThan(0)
      expect(plan.statements.slice(revoke + 1, revoke + 3)).toEqual(BF10_GRANTS)
      expect(plan.statements.filter(sql => sql.startsWith("GRANT"))).toEqual(BF10_GRANTS)
      // The image keeps serving this database at schema 30, and at 31 after the operator migration.
      expect(await database.checkReadiness()).toEqual({ profile: "neuvetra.private-synthetic-staging.v1", schemaVersion: 30, legacyContainmentVerified: true })
      expect((await migratePrivateStaging(operator, { expectedProjectRef: EXISTING_PROJECT_REF, syntheticTargetConfirmed: true, reuseExistingProject: true })).schemaVersion).toBe(32)
      expect(await database.checkReadiness()).toEqual({ profile: "neuvetra.private-synthetic-staging.v1", schemaVersion: 32, legacyContainmentVerified: true })
      expect(await probes()).toEqual(before)
      // A second plan on the contained database is the same list, and running it again changes nothing.
      expect((await planLegacyStagingContainment(operator)).statements).toEqual(plan.statements)

      // A guard revoked by hand: the separate Storage verdict fails and names the missing grants. Operator paths that apply
      // something refuse; readiness (the serving path) keeps serving and reports it (CEO ruling, QA F1). Storage fails as before.
      await operator.exec("revoke execute on function neuvetra.collection_storage_can_read(text,text) from public")
      const revoked = await auditLegacyStagingExposure(operator)
      const missingRead = [
        { signature: "neuvetra.collection_storage_can_read(text,text)", role: "anon" },
        { signature: "neuvetra.collection_storage_can_read(text,text)", role: "authenticated" },
      ]
      expect([revoked.legacyContainmentVerified, revoked.storageGuardGrantsVerified, revoked.missingStorageGuardGrants]).toEqual([true, false, missingRead])
      expect((await probes()).readEvidence).toStartWith("error 42501 permission denied for function collection_storage_can_read")
      expect(await database.checkReadiness()).toEqual({ profile: "neuvetra.private-synthetic-staging.v1", schemaVersion: 32, legacyContainmentVerified: true, storageGuardGrantsMissing: true, missingStorageGuardGrants: missingRead })
      expect(await rejectionMessage(migratePrivateStaging(operator, { expectedProjectRef: EXISTING_PROJECT_REF, syntheticTargetConfirmed: true, reuseExistingProject: true }))).toBe("Confirmed existing project reuse and verified legacy containment required.")
      // Granted to authenticated only: anon still missing, still not verified.
      await operator.exec("grant execute on function neuvetra.collection_storage_can_read(text,text) to authenticated")
      expect((await auditLegacyStagingExposure(operator)).missingStorageGuardGrants).toEqual([{ signature: "neuvetra.collection_storage_can_read(text,text)", role: "anon" }])
      // The plan restores it, and readiness is back to its exact healthy shape.
      for (const statement of (await planLegacyStagingContainment(operator)).statements) await operator.exec(statement)
      expect(await privileges()).toEqual(callable)
      const restored = await auditLegacyStagingExposure(operator)
      expect([restored.legacyContainmentVerified, restored.storageGuardGrantsVerified]).toEqual([true, true])
      expect(await database.checkReadiness()).toEqual({ profile: "neuvetra.private-synthetic-staging.v1", schemaVersion: 32, legacyContainmentVerified: true })
      expect(await probes()).toEqual(before)
    } finally { await database.close(); await fixture.close() }
  }, 120_000)

  test("before 0027 there are no guards: no GRANT is planned and the audit is unchanged", async () => {
    const fixture = await createStagingSchemaFixture(testUrl!, "m63_bf10_pre0027", 26, EXISTING_PROJECT_REF)
    try {
      const plan = await planLegacyStagingContainment(fixture.operator)
      expect([plan.audit.storagePolicyGuards, plan.audit.missingStorageGuardGrants, plan.audit.legacyContainmentVerified, plan.audit.storageGuardGrantsVerified]).toEqual([[], [], true, true])
      expect(plan.statements.some(sql => sql.startsWith("GRANT"))).toBe(false)
    } finally { await fixture.close() }
  }, 120_000)

  test("a staging-shaped database (7 application schemas, provider defaults) plans the reviewed 29 statements plus exactly the two GRANTs", async () => {
    const fixture = await createStagingSchemaFixture(testUrl!, "m63_bf10_shape", 30, EXISTING_PROJECT_REF)
    const rollback = new Error("bf10 shape rollback")
    let checked = false
    try {
      await fixture.operator.transaction(async tx => {
        await tx.exec(`create schema drizzle; create schema frontdesk; create schema neuvetra_research_dev; create schema site; create schema terrascope;
          do $$ begin if not exists(select 1 from pg_roles where rolname='supabase_admin') then create role supabase_admin nologin; end if; end $$;
          alter default privileges for role supabase_admin in schema public grant execute on functions to anon,authenticated;
          alter default privileges for role supabase_admin in schema public grant all on tables to anon,authenticated;
          alter default privileges for role supabase_admin in schema public grant all on sequences to anon,authenticated;`)
        const plan = await planLegacyStagingContainment(tx)
        expect(plan.audit.applicationSchemas).toEqual(["drizzle", "frontdesk", "neuvetra", "neuvetra_research_dev", "public", "site", "terrascope"])
        // The 29 statements of the plan reviewed on hosted staging for 0031 (its database is "postgres").
        const reviewed = ['REVOKE CREATE ON DATABASE "postgres" FROM PUBLIC, anon, authenticated;']
        for (const schema of plan.audit.applicationSchemas) for (const target of ["SCHEMA", "ALL TABLES IN SCHEMA", "ALL SEQUENCES IN SCHEMA", "ALL FUNCTIONS IN SCHEMA"]) reviewed.push(`REVOKE ALL ON ${target} "${schema}" FROM PUBLIC, anon, authenticated;`)
        expect(reviewed).toHaveLength(29)
        const statements = plan.statements.map(sql => sql.replace('DATABASE "m63_bf10_shape"', 'DATABASE "postgres"'))
        expect(statements).toHaveLength(31)
        expect(statements.filter(sql => !sql.startsWith("GRANT"))).toEqual(reviewed)
        const revoke = statements.indexOf('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA "neuvetra" FROM PUBLIC, anon, authenticated;')
        expect(revoke).toBe(12)
        expect(statements.slice(13, 15)).toEqual(BF10_GRANTS)
        expect(statements.slice(15)).toEqual(reviewed.slice(13))
        // Order follows the catalog collation (hosted lists FUNCTIONS, TABLES, SEQUENCES); the set is what matters.
        expect([...plan.providerAdminStatements].sort()).toEqual([
          'ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated;',
          'ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;',
          'ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;',
        ])
        // Not executed by the tool, and never part of statements.
        expect(statements.some(sql => sql.startsWith("ALTER DEFAULT PRIVILEGES"))).toBe(false)
        checked = true
        throw rollback
      }).catch(error => { if (error !== rollback) throw error })
      expect(checked).toBe(true)
    } finally { await fixture.close() }
  }, 120_000)
})
