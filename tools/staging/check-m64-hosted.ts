/** Bounded synthetic live exercise. Credentials arrive only through private stdin. */
import { parseJourneyInput } from "./check-hosted-journey"
import { decodeElectricityWorksheet, WORKSHEET_LIMITATIONS } from "../../apps/site-web/src/lib/m64-api"
const HOST = "https://www.neuvetra.ai", AUTH = "https://icockcoguyadhryzydvl.supabase.co"
const RECEIPT = ".superpowers/m64-hosted-journey.json"
const stages: { name: string; status: number }[] = []
let stage = "configuration"
const tokens = new Map<string, string>()
let publicKey = ""
function valid(v: unknown): asserts v { if (!v) throw new Error("Bounded check failed") }
function key(label: string) { const s = new Bun.CryptoHasher("sha256").update("m64-live-synthetic-v1:" + label).digest("hex"); return `${s.slice(0,8)}-${s.slice(8,12)}-4${s.slice(13,16)}-8${s.slice(17,20)}-${s.slice(20,32)}` }
let result: Record<string, unknown> = {}
try {
  const input = parseJourneyInput(JSON.parse(await Bun.stdin.text())); publicKey = input.env.SUPABASE_ANON_KEY
  for (const account of input.accounts) {
    stage = `sign_in_${account.role}`
    const response = await fetch(AUTH + "/auth/v1/token?grant_type=password", { method: "POST", redirect: "error", headers: { apikey: publicKey, "content-type": "application/json" }, body: JSON.stringify({ email: account.email, password: account.password }), signal: AbortSignal.timeout(30000) })
    valid(response.ok); const session = await response.json() as { user: { id: string }; access_token: string }; valid(session.user.id === account.id); tokens.set(account.role, session.access_token)
  }
  const companyId = input.roster.workspaceId
  async function request(name: string, role: string, action = "", payload?: unknown, expected = 200) {
    stage = name
    const response = await fetch(`${HOST}/workspace-api/workspace/${companyId}/electricity-worksheet${action}`, { method: payload ? "POST" : "GET", redirect: "error", headers: { origin: HOST, ...(tokens.has(role) ? { authorization: `Bearer ${tokens.get(role)}` } : {}), ...(payload ? { "content-type": "application/json" } : {}) }, body: payload ? JSON.stringify(payload) : undefined, signal: AbortSignal.timeout(30000) })
    stages.push({ name, status: response.status }); valid(response.status === expected)
    const body: unknown = await response.json()
    return expected < 300 ? decodeElectricityWorksheet(body, companyId) : null
  }
  const initial = { companyLabel: "Synthetic Cedar Ltd", facilityLabel: "Synthetic CAMX office", quantityKwh: "12345.678", period: "2023-01", geography: "CAMX", unit: "kWh", idempotencyKey: key("initial") }
  await request("signed_out_refusal", "signed_out", "", undefined, 401)
  await request("outsider_refusal", "outsider", "", undefined, 403)
  await request("member_write_refusal", "member", "", initial, 403)
  const before = await request("initial_read", "manager1"); valid(before)
  if (!before.versions.length) {
    for (const quantityKwh of ["", "-1", "1.0000", "1000000.001", "1e3", "1\n"]) await request("invalid_quantity_refusal", "manager1", "", { ...initial, quantityKwh }, 422)
    for (const context of [{ period: "2024-01" }, { geography: "NYCW" }, { unit: "MWh" }]) await request("unsupported_context_refusal", "manager1", "", { ...initial, ...context }, 422)
  }
  const saved = await request("save_synthetic_first_version", "manager1", "", initial, 201); valid(saved)
  const first = saved.versions[0]; valid(first && first.quantityKwh === "12345.678" && first.total.unrounded === "2407.9046025518064" && first.total.display === "2407.9046")
  const review = { versionId: first.id, expectedResultSha256: first.resultSha256, decision: "accept_bounded_internal_draft", note: null, acknowledgedLimitations: [...WORKSHEET_LIMITATIONS], idempotencyKey: key("review_first") }
  if (!first.review) await request("self_review_refusal", "manager1", "/reviews", review, 409)
  const reviewed = await request("second_manager_review", "manager2", "/reviews", review, 201); valid(reviewed?.versions[0]?.review)
  const correction = { ...initial, quantityKwh: "62500", expectedVersionId: first.id, expectedResultSha256: first.resultSha256, correctionReason: "Synthetic half-even rounding and version-history demonstration", idempotencyKey: key("correction_second") }
  const [a, b] = await Promise.all([request("concurrent_correction_a", "manager1", "/corrections", correction, 201), request("concurrent_correction_b", "manager1", "/corrections", correction, 201)])
  valid(a && b && a.versions.length === 2 && b.versions.length === 2 && a.versions[1]?.id === b.versions[1]?.id)
  const current = a.versions[1]; valid(current && current.review === null && current.total.unrounded === "12190.01805" && current.total.display === "12190.0180")
  valid(a.versions[0]?.review?.decisionSha256 === reviewed.versions[0]?.review?.decisionSha256)
  const member = await request("member_revisit", "member"); valid(member?.versions[1]?.resultSha256 === current.resultSha256)
  await request("stale_correction_refusal", "manager1", "/corrections", { ...correction, quantityKwh: "0", idempotencyKey: key("stale") }, 409)
  result = { status: "pass", createdAt: new Date().toISOString(), companyId, stages, versions: a.versions.map(v => ({ id: v.id, version: v.version, quantityKwh: v.quantityKwh, total: v.total, inputSha256: v.inputSha256, resultSha256: v.resultSha256, reviewSha256: v.review?.decisionSha256 ?? null })), scope: "Real Auth, hosted API and actual frontend decoder. Separate real browser and native PostgreSQL QA required." }
} catch { result = { status: "fail", createdAt: new Date().toISOString(), stage, stages }; process.exitCode = 1 }
finally {
  const logouts: { role: string; status: number | null }[] = []
  for (const [role, token] of tokens) { try { const r = await fetch(AUTH + "/auth/v1/logout?scope=local", { method: "POST", headers: { apikey: publicKey, authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) }); logouts.push({ role, status: r.status }); if (r.status !== 204) process.exitCode = 1 } catch { logouts.push({ role, status: null }); process.exitCode = 1 } }
  const previous = await Bun.file(RECEIPT).exists() ? await Bun.file(RECEIPT).json() : { attempts: [] }
  previous.attempts.push({ ...result, logouts }); await Bun.write(RECEIPT, JSON.stringify(previous, null, 2) + "\n")
  console.log(JSON.stringify({ ...result, logouts }))
}
