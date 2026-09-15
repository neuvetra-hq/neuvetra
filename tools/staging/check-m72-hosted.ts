/** Reviewer-operated existing synthetic staging journey. Never reads credentials or mode from ENV. */
import path from "node:path"
import { parseJourneyInput, saveJourneyReceipt } from "./check-hosted-journey"
import { decodeElectricityWorksheet } from "../../apps/site-web/src/lib/m64-api"
import { decodeWorksheetReport } from "../../apps/site-web/src/lib/m65-api"
import { decodeSourceElectricityWorksheet, decodeElectricitySource } from "../../apps/site-web/src/lib/m66-api"
import { decodeSourceWorksheetReport } from "../../apps/site-web/src/lib/m66-report-api"
import { decodeAnnualElectricityWorksheet } from "../../apps/site-web/src/lib/m67-api"
import { decodeAnnualWorksheetReport } from "../../apps/site-web/src/lib/m67-report-api"
import { decodeAnnualElectricityEvidence } from "../../apps/site-web/src/lib/m68-api"
import { decodeAnnualEvidenceReport } from "../../apps/site-web/src/lib/m68-report-api"
import { decodeCorporateRegister, decodeCorporateVersion, decodeCorporateReview } from "../../apps/site-web/src/lib/m71-api"
import { createM71Seed, M71_LIMITATIONS, type M71Register, type M71Version } from "../../packages/neuvetra-database/src/m71-contract"
import { m71CanonicalJson } from "../../packages/neuvetra-database/src/m71-validation"
import { verifyInventoryEvidenceArchive } from "../../packages/neuvetra-database/src/m59"

const HOST = "https://www.neuvetra.ai", AUTH = "https://icockcoguyadhryzydvl.supabase.co"
const PROFILE = "neuvetra.private-synthetic-staging.v1"
const RECEIPT = path.resolve(import.meta.dir, "../../.superpowers/m72-hosted-journey.json")
type Mode = "baseline" | "exercise" | "revisit"
type Input = ReturnType<typeof parseJourneyInput> & { mode: Mode }
type Role = Input["accounts"][number]["role"] | "signed_out"
type Observation = { sha256: string; byteLength: number }
type Snapshot = { records: Record<string, string>; downloads: Record<string, Observation> }
type Attempt = { status: string; mode: Mode; stage: string; createdAt: string; applicationPostRequests: number; allCreatedAuthSessionsClosed: boolean; stages: { name: string; status: number }[]; legacy?: Snapshot; corporate?: M71Register | null; exports?: Record<string, Observation> }
type History = { schemaVersion: 1; host: typeof HOST; workspaceId: string; baseline?: Snapshot; attempts: Attempt[] }
const valid = (v: unknown): void => { if (!v) throw new Error("Bounded M72 verification failed.") }
export const canonical = (v: unknown): string => m71CanonicalJson(v)
const sha = (v: Uint8Array | string) => new Bun.CryptoHasher("sha256").update(v).digest("hex")
const uuid = (v: unknown): string => { valid(typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)); return v as string }

export function parseM72Input(value: unknown): Input {
  const mode = (value as { mode?: unknown })?.mode
  valid(mode === "baseline" || mode === "exercise" || mode === "revisit")
  return { ...parseJourneyInput(value), mode: mode as Mode }
}

/** Imports do not authenticate. Dependencies permit offline failure-path tests. */
export async function runM72Journey(input: Input, dependencies: {
  fetch?: typeof globalThis.fetch; load?: () => Promise<History | null>; save?: (history: History) => Promise<void>
} = {}) {
  const fetch = dependencies.fetch ?? globalThis.fetch
  const tokens = new Map<Role, string>(), stages: Attempt["stages"] = []
  let stage = "receipt_load", writes = 0, failed = false, logoutFailed = false, unaccountedSignIns = 0, receiptValidated = false
  let history: History = { schemaVersion: 1, host: HOST, workspaceId: input.roster.workspaceId, attempts: [] }
  let legacy: Snapshot | undefined, corporate: M71Register | null | undefined, exports: Record<string, Observation> | undefined
  const company = uuid(input.roster.workspaceId), root = `/workspace-api/workspace/${company}`, registerPath = root + "/corporate-inventories"
  const request = async (name: string, route: string, role: Role = "manager1", payload?: unknown, expected = payload === undefined ? 200 : 201) => {
    stage = name
    valid(route === "/ready" || route === "/workspace-api/config" || route === "/workspace-api/session" || route === root || route.startsWith(root + "/"))
    if (payload !== undefined) { valid(input.mode === "exercise" && route.startsWith(registerPath)); writes++ }
    const r = await fetch(HOST + route, { method: payload === undefined ? "GET" : "POST", redirect: "error", signal: AbortSignal.timeout(30000), headers: { origin: HOST, ...(tokens.has(role) ? { authorization: `Bearer ${tokens.get(role)}` } : {}), ...(payload === undefined ? {} : { "content-type": "application/json" }) }, body: payload === undefined ? undefined : JSON.stringify(payload) })
    stages.push({ name, status: r.status }); valid(r.status === expected)
    valid(r.headers.get("cache-control")?.includes("no-store")); return r
  }
  const json = async (...args: Parameters<typeof request>): Promise<any> => { const r = await request(...args); const bytes = new Uint8Array(await r.arrayBuffer()); valid(bytes.length <= 4_000_000); return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) }
  const download = async (name: string, route: string, expectedHash?: string, expectedLength?: number): Promise<Observation> => {
    const r = await request(name, route, "member"), b = new Uint8Array(await r.arrayBuffer()); valid(b.length > 0 && b.length <= 4_000_000)
    const value = { sha256: sha(b), byteLength: b.length }
    if (expectedHash !== undefined) valid(value.sha256 === expectedHash)
    if (expectedLength !== undefined) valid(value.byteLength === expectedLength)
    return value
  }
  const legacySnapshot = async (): Promise<Snapshot> => {
    const records: Record<string, string> = {}, downloads: Record<string, Observation> = {}
    const keep = (name: string, value: unknown) => { records[name] = sha(canonical(value)); return value }
    const get = async (name: string, route: string) => { const value = await json(name, route); keep(name, value); return value }
    const workspace = await get("m63_workspace", root)
    valid(workspace.companyName === "Synthetic Acme, Inc." && workspace.boundary.reportingYear === 2023)
    const session = await json("m63_evidence_discovery", "/workspace-api/session")
    await get("m63_bill", root + `/bills/${uuid(session.access.evidenceId)}`)
    await get("m63_inventory", root + "/inventories/2023/scope2")
    await get("m63_registers", root + "/annual-registers/2023")
    const annual = await get("m63_annual", root + "/annual-inventories/2023/scope2"), annualRoot = root + `/annual-inventories/${uuid(annual.id)}`
    const pack = await get("m63_pack", annualRoot + "/evidence-packs/current")
    const packResponse = await request("m63_pack_bytes", annualRoot + `/evidence-packs/${uuid(pack.id)}/download`, "member")
    const packBytes = new Uint8Array(await packResponse.arrayBuffer())
    valid(packBytes.length === pack.archiveByteLength && sha(packBytes) === pack.archiveSha256)
    const replay = verifyInventoryEvidenceArchive(packBytes, { archiveSha256: pack.archiveSha256, manifestSha256: pack.manifestSha256, lineageRootSha256: pack.lineageRootSha256, companyId: company, inventoryId: annual.id })
    valid(replay.status === "verified_match" && replay.releaseEligible === false)
    downloads.m63_pack = { sha256: sha(packBytes), byteLength: packBytes.length }
    const report = await get("m63_report", annualRoot + "/draft-reports/current"), reportRoot = annualRoot + `/draft-reports/${uuid(report.id)}`
    await get("m63_review", reportRoot + "/decisions/current")
    downloads.m63_report = await download("m63_report_bytes", reportRoot + "/download", report.reportSha256, report.reportByteLength)
    const worksheet = decodeElectricityWorksheet(await get("m64_worksheet", root + "/electricity-worksheet"), company)
    const source = decodeSourceElectricityWorksheet(await get("m66_worksheet", root + "/source-electricity-worksheet"), company)
    const year = decodeAnnualElectricityWorksheet(await get("m67_worksheet", root + "/annual-electricity-worksheet"), company)
    const evidence = decodeAnnualElectricityEvidence(await get("m68_evidence", root + "/annual-electricity-evidence"), company, year)
    const sources = (await get("m66_sources", root + "/source-electricity-worksheet/sources")).sources.map((v: unknown) => decodeElectricitySource(v, company))
    for (const source of sources) downloads[`m66_source_${source.id}`] = await download("m66_source_bytes", root + `/source-electricity-worksheet/sources/${uuid(source.id)}/download`, source.sha256, source.byteLength)
    for (const [name, route, decode] of [
      ["m65", "/electricity-worksheet", (v: unknown) => decodeWorksheetReport(v, worksheet)],
      ["m66", "/source-electricity-worksheet", (v: unknown) => decodeSourceWorksheetReport(v, source)],
      ["m67", "/annual-electricity-worksheet", (v: unknown) => decodeAnnualWorksheetReport(v, year)],
      ["m68", "/annual-electricity-evidence", (v: unknown) => decodeAnnualEvidenceReport(v, evidence, year)],
    ] as const) {
      const reports = (await get(name + "_reports", root + route + "/reports")).reports.map(decode)
      for (const report of reports) downloads[`${name}_report_${report.id}`] = await download(name + "_report_bytes", root + route + `/reports/${uuid(report.id)}/download`, report.reportSha256, report.reportByteLength)
    }
    return { records, downloads }
  }
  const readRegister = async (name: string, role: Role = "manager1") => decodeCorporateRegister(await json(name, registerPath, role), company)
  const readExports = async (value: M71Register) => {
    const result: Record<string, Observation> = {}
    for (const v of value.versions) result[v.id] = await download("m71_exact_export", `${registerPath}/${uuid(v.inventoryId)}/versions/${uuid(v.id)}/coverage-export`, sha(canonical({ ...v, review: null })), new TextEncoder().encode(canonical({ ...v, review: null })).length)
    return result
  }
  try {
    const prior = await (dependencies.load ? dependencies.load() : Bun.file(RECEIPT).exists().then(exists => exists ? Bun.file(RECEIPT).json() : null))
    if (prior) { valid(prior.schemaVersion === 1 && prior.host === HOST && prior.workspaceId === company && Array.isArray(prior.attempts)); history = prior }
    receiptValidated = true
    stage = "mode_preconditions"
    if (input.mode === "baseline") valid(!history.baseline)
    else valid(history.baseline)
    if (input.mode === "revisit") valid(history.attempts.some(a => a.mode === "exercise" && a.status === "passed"))
    const ready = await json("readiness", "/ready", "signed_out")
    valid(ready.status === "ready" && ready.profile === PROFILE && ready.legacyContainmentVerified === true && ready.schemaVersion === (input.mode === "baseline" ? 14 : 15))
    const config = await json("public_config", "/workspace-api/config", "signed_out")
    valid(config.profile === PROFILE && config.supabaseUrl === AUTH && config.anonKey === input.env.SUPABASE_ANON_KEY)
    for (const account of input.accounts) {
      stage = `sign_in_${account.role}`
      // A timeout/malformed response can leave a provider session we cannot close.
      unaccountedSignIns++
      const r = await fetch(AUTH + "/auth/v1/token?grant_type=password", { method: "POST", redirect: "error", signal: AbortSignal.timeout(30000), headers: { apikey: input.env.SUPABASE_ANON_KEY, "content-type": "application/json" }, body: JSON.stringify({ email: account.email, password: account.password }) })
      stages.push({ name: stage, status: r.status }); valid(r.status === 200)
      const session = await r.json() as any
      // Retain a returned token for cleanup even if subject validation then fails.
      if (typeof session.access_token === "string" && session.access_token.length > 0 && session.access_token.length <= 8192) { tokens.set(account.role, session.access_token); unaccountedSignIns-- }
      valid(tokens.has(account.role) && session.user?.id === account.id)
    }
    for (const role of ["manager1", "manager2", "member"] as const) {
      const s = await json("session_" + role, "/workspace-api/session", role)
      valid(s.profile === PROFILE && s.user.id === input.accounts.find(a => a.role === role)!.id && s.access.workspaceId === company)
      valid(role === "member" ? s.access.role === "member" : ["admin", "owner"].includes(s.access.role))
    }
    await request("outsider_session", "/workspace-api/session", "outsider", undefined, 403)
    await request("signed_out_session", "/workspace-api/session", "signed_out", undefined, 401)
    legacy = await legacySnapshot()
    stage = "preserved_legacy_baseline"; if (history.baseline) valid(canonical(legacy) === canonical(history.baseline))
    if (input.mode === "baseline") { corporate = null }
    else {
      await request("m71_outsider_read", registerPath, "outsider", undefined, 403)
      await request("m71_signed_out_read", registerPath, "signed_out", undefined, 401)
      corporate = await readRegister("m71_initial_register")
      if (input.mode === "exercise") {
        stage = "m71_empty_register_precondition"; valid(corporate.versions.length === 0 && !history.attempts.some(a => a.mode === "exercise" && a.applicationPostRequests > 0))
        const firstInput = { snapshot: createM71Seed(), expectedVersionId: null, expectedVersionSha256: null, correctionReason: null, idempotencyKey: crypto.randomUUID() }
        await request("m71_member_save_refused", registerPath, "member", firstInput, 403)
        await request("m71_outsider_save_refused", registerPath, "outsider", firstInput, 403)
        await request("m71_signed_out_save_refused", registerPath, "signed_out", firstInput, 401)
        const first = await decodeCorporateVersion(await json("m71_save", registerPath, "manager1", firstInput), company)
        const retry = await decodeCorporateVersion(await json("m71_save_retry", registerPath, "manager1", firstInput), company)
        valid(canonical(first) === canonical(retry) && first.review === null && first.version === 1)
        const firstExport = await readExports(await readRegister("m71_saved_register"))
        const correction = { snapshot: structuredClone(first.snapshot), expectedVersionId: first.id, expectedVersionSha256: first.versionSha256, correctionReason: "M72 hosted synthetic correction preserves unresolved company coverage.", idempotencyKey: crypto.randomUUID() }
        correction.snapshot.companyLabel = "Synthetic Juniper group — hosted correction"
        const versionsPath = `${registerPath}/${uuid(first.inventoryId)}/versions`
        const second = await decodeCorporateVersion(await json("m71_correction", versionsPath, "manager1", correction), company, first)
        valid(second.review === null && second.snapshot.companyLabel === correction.snapshot.companyLabel && second.contributorIds.length === 1)
        valid(canonical(second) === canonical(await json("m71_correction_retry", versionsPath, "manager1", correction)))
        await request("m71_changed_retry_refused", versionsPath, "manager1", { ...correction, correctionReason: "Conflicting retry" }, 409)
        const review = { versionId: second.id, expectedVersionSha256: second.versionSha256, decision: "accepted_bounded_internal", note: "Bounded internal synthetic coverage review. All unresolved gaps remain; no external assurance.", acknowledgedLimitations: [...M71_LIMITATIONS], idempotencyKey: crypto.randomUUID() }
        const reviewPath = `${registerPath}/${uuid(first.inventoryId)}/reviews`
        await request("m71_contributor_review_refused", reviewPath, "manager1", review, 409)
        await request("m71_member_review_refused", reviewPath, "member", review, 403)
        const decision = await decodeCorporateReview(await json("m71_independent_review", reviewPath, "manager2", review), company, second)
        valid(decision.reviewerId === input.accounts.find(a => a.role === "manager2")!.id)
        valid(canonical(decision) === canonical(await json("m71_review_retry", reviewPath, "manager2", review)))
        corporate = await readRegister("m71_reviewed_register")
        valid(corporate.versions.length === 2 && corporate.versions[1].review?.id === decision.id)
        exports = await readExports(corporate); valid(canonical(exports[first.id]) === canonical(firstExport[first.id]))
        // Recheck the entire baseline after all attempted writes, not just before them.
        const after = await legacySnapshot(); stage = "legacy_unchanged_after_exercise"; valid(canonical(after) === canonical(legacy))
      }
      valid(canonical(await readRegister("m71_member_register", "member")) === canonical(corporate))
      exports = await readExports(corporate)
      for (const v of corporate.versions) {
        valid(v.synthetic && v.emissionsTotals === null && v.corporateCompleteness === "incomplete" && v.assurance === "none" && !v.releaseEligible)
        valid(Array.from({ length: 15 }, (_, i) => `scope3_${i + 1}`).every(domain => v.snapshot.coverageItems.some(c => c.domain === domain)))
        valid(v.findings.length > 0)
      }
      if (corporate.versions.length) {
        const v = corporate.versions[0], route = `${registerPath}/${uuid(v.inventoryId)}/versions/${uuid(v.id)}/coverage-export`
        await request("m71_outsider_export", route, "outsider", undefined, 403)
        await request("m71_signed_out_export", route, "signed_out", undefined, 401)
      }
      if (input.mode === "revisit") {
        const prior = history.attempts.filter(a => a.mode === "exercise" && a.status === "passed").at(-1)!
        stage = "restart_exact_saved_register"; valid(canonical(corporate) === canonical(prior.corporate) && canonical(exports) === canonical(prior.exports))
      }
    }
  } catch { failed = true }
  finally {
    for (const [role, token] of tokens) {
      try { const r = await fetch(AUTH + "/auth/v1/logout?scope=local", { method: "POST", redirect: "error", headers: { apikey: input.env.SUPABASE_ANON_KEY, authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) }); stages.push({ name: "logout_" + role, status: r.status }); await r.body?.cancel(); if (r.status !== 204) logoutFailed = true }
      catch { logoutFailed = true }
    }
    tokens.clear()
  }
  const allCreatedAuthSessionsClosed = !logoutFailed && unaccountedSignIns === 0
  failed ||= !allCreatedAuthSessionsClosed
  const attempt: Attempt = { status: failed ? "failed" : "passed", mode: input.mode, stage, createdAt: new Date().toISOString(), applicationPostRequests: writes, allCreatedAuthSessionsClosed, stages, ...(legacy ? { legacy } : {}), ...(corporate !== undefined ? { corporate } : {}), ...(exports ? { exports } : {}) }
  // Never replace an unreadable or differently bound evidence file with an empty history.
  if (!receiptValidated) return { status: "failed", mode: input.mode, stage: "receipt_load", applicationPostRequests: writes, allCreatedAuthSessionsClosed, stages }
  if (!failed && input.mode === "baseline") history.baseline = legacy
  history.attempts.push(attempt)
  try { await (dependencies.save ?? ((h: History) => saveJourneyReceipt(h, RECEIPT)))(history) }
  catch { return { status: "failed", mode: input.mode, stage: "receipt_save", applicationPostRequests: writes, allCreatedAuthSessionsClosed } }
  return { status: attempt.status, mode: input.mode, stage, applicationPostRequests: writes, allCreatedAuthSessionsClosed, stages }
}

if (import.meta.main) {
  try { const text = await Bun.stdin.text(); valid(text.length <= 128_000); const result = await runM72Journey(parseM72Input(JSON.parse(text))); console.log(JSON.stringify(result)); if (result.status !== "passed") process.exitCode = 1 }
  catch { console.log(JSON.stringify({ status: "failed", stage: "stdin_validation" })); process.exitCode = 1 }
}
