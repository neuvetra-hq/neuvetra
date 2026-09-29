import { readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { createPostgresConnection } from "../../packages/neuvetra-database/src/hosted"
import * as api from "../../packages/neuvetra-database/src/beta-access"
import { installBetaAccess } from "../../packages/neuvetra-database/src/beta-access-migrations"
import { createBetaAccessServer } from "../../apps/site-api/src/beta-access/server"
import { startLocalBetaAccessListener } from "../../apps/site-api/src/beta-access/listener"
import { captureLegacy, compareLegacy } from "./m80-beta-access-independent-20260925-c2-checks"
const root = resolve(import.meta.dir, "../.."), prefix = "evaluations/research-qa/m80-beta-access-independent-20260925-"
const candidateSha = "1c4e9adfc358fddf20f79ab89747a29989624de456fe8faeab36d6787344e676"
const db = "m80_beta_access_qa_20260925c", role = "m80_beta_access_runtime_qa_20260925c", owner = "m80_beta_access_owner_qa_20260925c"
const runtimeUrl = `postgres://${role}@127.0.0.1:55472/${db}`
const operator = createPostgresConnection(`postgres://supabase_admin@127.0.0.1:55472/${db}`, { tls: false, maxConnections: 2 })
const uid = (prefix: string, n: number) => `${prefix}000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const users = Array.from({ length: 8 }, (_, i) => ({ id: uid("9a", i + 1), email: `qa-${i + 1}@beta.invalid` }))
const manifest = { sha256: "", identities: users.map(u => u.email), tenants: [0, 1].map(i => ({ companyId: uid("9b", i + 1), admissionId: uid("9c", i + 1), displayLabel: `Synthetic QA ${i + 1}`, fixtureManifestSha256: "" })) }
manifest.sha256 = api.syntheticBetaFixtureManifestSha256(manifest); manifest.tenants.forEach(t => t.fixtureManifestSha256 = manifest.sha256)
const checks: { id: string; pass: boolean; details?: unknown }[] = []
const notes: Record<string, unknown> = {}
let phase = "gate", completed = false
const check = (id: string, pass: boolean, details?: unknown) => { checks.push({ id, pass, ...(details === undefined ? {} : { details }) }); if (!pass) throw new Error(id) }
const hash = (v: Uint8Array | string) => new Bun.CryptoHasher("sha256").update(v).digest("hex")
async function verify() { const bytes = await readFile(resolve(root, "operations/agent-improvement/snapshots/M80-BETA-ACCESS-IMPLEMENTATION-20260925-CANDIDATE2.json")); if (hash(bytes) !== candidateSha || process.argv[2] !== candidateSha) throw new Error("freeze_gate"); for (const f of JSON.parse(bytes.toString()).files) if (hash(await readFile(resolve(root, f.path))) !== f.sha256) throw new Error("source_pin") }
const options = { connectionString: runtimeUrl, databaseName: db, runtimeRole: role }
const approval = { databaseName: db, runtimeRole: role, ownerRole: owner, fixtureManifestSha256: manifest.sha256, syntheticTargetConfirmed: true as const }
async function readinessDenied() { try { const d = await api.BetaAccessDatabase.create(options); await d.close(); return false } catch { return true } }
async function drift(id: string, mutate: string, restore: string) {
  await operator.exec(mutate)
  try {
    check(`Q07.drift_runtime.${id}`, await readinessDenied())
    let denied = false; try { await installBetaAccess(operator, approval) } catch { denied = true }
    check(`Q07.drift_install.${id}`, denied)
  } finally { await operator.exec(restore) }
  const d = await api.BetaAccessDatabase.create(options); await d.close()
  check(`Q07.restored_ready.${id}`, true)
}
let app: Awaited<ReturnType<typeof createBetaAccessServer>> | undefined, listener: Awaited<ReturnType<typeof startLocalBetaAccessListener>> | undefined
const logs: unknown[] = [], secretCanaries: string[] = []
try {
  await verify()
  phase = "new_owner_runtime_privilege_drift"
  await drift("owner_default_public", `alter default privileges for role "${owner}" grant execute on functions to public`, `alter default privileges for role "${owner}" revoke execute on functions from public`)
  await drift("owner_login", `alter role "${owner}" login`, `alter role "${owner}" nologin`)
  await drift("owner_member_runtime", `grant "${owner}" to "${role}"`, `revoke "${owner}" from "${role}"`)
  await drift("runtime_member_owner", `grant "${role}" to "${owner}"`, `revoke "${role}" from "${owner}"`)
  await drift("private_helper_grant", `grant execute on function neuvetra_beta.require_identity(text) to "${role}"`, `revoke execute on function neuvetra_beta.require_identity(text) from "${role}"`)
  await drift("wrong_table_owner", "alter table neuvetra_beta.audit owner to supabase_admin", `alter table neuvetra_beta.audit owner to "${owner}"`)
  phase = "competing_invitation_inputs"
  app = await createBetaAccessServer({ profile: "neuvetra.beta-access.synthetic-rehearsal.v1", databaseName: db, runtimeRole: role, databaseUrl: runtimeUrl, origin: "http://127.0.0.1:3080", port: 3080 }, { validateIdentity: async token => users[Number(token.slice(3))] ?? null, log: e => logs.push(e) })
  listener = await startLocalBetaAccessListener(app.fetch)
  const issue = async (actor: number, accessRole: "owner" | "member") => { const v = await api.issueBetaInvitation(operator, manifest, { companyId: manifest.tenants[1]!.companyId, recipientEmail: users[actor]!.email, role: accessRole, decisionReference: "QA-C2-RACE" }); secretCanaries.push(v.token, hash(v.token)); return v }
  const post = async (actor: number, body: string, bearer = `qa-${actor}`) => { const r = await fetch(`http://127.0.0.1:${listener!.port}/beta-api/invitations/redeem`, { method: "POST", headers: { origin: "http://127.0.0.1:3080", authorization: `Bearer ${bearer}`, "content-type": "application/json" }, body }); return { status: r.status, body: await r.text() } }
  const invitation = await issue(4, "member")
  const keys = [crypto.randomUUID(), crypto.randomUUID()]
  const race = await Promise.all(keys.map(requestId => post(4, JSON.stringify({ token: invitation.token, requestId }))))
  check("Q04.same_token_different_keys_one_winner", race.map(r => r.status).sort().join() === "201,404")
  const member = (await operator.query<{ n: number }>("select count(*)::int n from neuvetra_beta.memberships where company_id=$1 and user_id=$2", [manifest.tenants[1]!.companyId, users[4]!.id])).rows[0]!
  check("Q04.one_membership", member.n === 1)
  const competing = await Promise.all([issue(7, "owner"), issue(7, "member")])
  const outcomes = await Promise.all(competing.map(v => post(7, JSON.stringify({ token: v.token, requestId: crypto.randomUUID() }))))
  check("Q04.competing_role_invites_one_winner", outcomes.map(r => r.status).sort().join() === "201,404")
  const win = outcomes.findIndex(r => r.status === 201)
  const record = (await operator.query<{ role: string; n: number }>("select role,count(*)::int n from neuvetra_beta.memberships where company_id=$1 and user_id=$2 group by role", [manifest.tenants[1]!.companyId, users[7]!.id])).rows
  check("Q04.no_upgrade_or_duplicate", record.length === 1 && record[0]?.n === 1 && record[0]?.role === (win === 0 ? "owner" : "member"))
  const unauthorizedFields = JSON.stringify({ token: "0".repeat(64), requestId: crypto.randomUUID(), actorId: users[1]!.id, companyId: manifest.tenants[1]!.companyId, role: "owner" })
  check("Q06.caller_authority_rejected", (await post(0, unauthorizedFields)).status === 422)
  check("Q08.missing_identity_denied", (await post(0, JSON.stringify({ token: "0".repeat(64), requestId: crypto.randomUUID() }), "invalid")).status === 401)
  // These post-backup additions are revoked using supported operations. The earlier restore lacks these grants.
  await api.revokeBetaMembership(operator, manifest.tenants[1]!.companyId, users[4]!.id, "QA-C2-POST-RACE-REVOKE")
  await api.revokeBetaMembership(operator, manifest.tenants[1]!.companyId, users[7]!.id, "QA-C2-POST-RACE-REVOKE")
  const restoreRuntime = await api.BetaAccessDatabase.create({ connectionString: `postgres://${role}@127.0.0.1:55472/m80_beta_access_restore_qa_20260925c`, databaseName: "m80_beta_access_restore_qa_20260925c", runtimeRole: role })
  try { check("Q10.earlier_backup_cannot_restore_later_test_grants", (await restoreRuntime.readSession(users[4]!.id, users[4]!.email)).length === 0 && (await restoreRuntime.readSession(users[7]!.id, users[7]!.email)).length === 0) } finally { await restoreRuntime.close() }
  check("Q08.final_log_canaries_absent", !secretCanaries.some(c => JSON.stringify(logs).includes(c)) && !users.some(u => JSON.stringify(logs).includes(u.email)))
  const current = await captureLegacy(operator, { databaseName: db, runtimeRole: role, ownerRole: owner })
  const previous = JSON.parse(await readFile(resolve(root, prefix + "c2-result-1790322732930.json"), "utf8"))
  const parity = compareLegacy(previous.details.legacyBefore, current)
  notes.legacyParity = parity
  check("Q09.final_all_legacy_parity", parity.pass)
  await verify(); completed = true
} catch { /* Findings are named above; exceptions remain an explicit incomplete execution. */ }
finally { await listener?.stop(true); await app?.close(); await operator.close() }
const verdict = completed && checks.every(c => c.pass) ? "pass_executed_drift_and_races" : "fail_or_incomplete_preserved"
const path = resolve(root, prefix + `c2-drift-result-${Date.now()}.json`)
await writeFile(path, JSON.stringify({ verdict, candidateSha256: candidateSha, phase, completed, checks, notes, actualCostUsd: null }, null, 2) + "\n", { flag: "wx" })
console.log(JSON.stringify({ verdict, phase, checkCount: checks.length, resultPath: path }))
