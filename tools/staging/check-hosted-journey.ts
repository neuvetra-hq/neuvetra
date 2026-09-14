import path from "node:path"
import { mkdir, rename, stat, unlink } from "node:fs/promises"
import { verifyInventoryEvidenceArchive } from "../../packages/neuvetra-database/src/m59"
import { M58_WARNINGS } from "../../packages/neuvetra-database/src/m58"
import { M61_LIMITATION_ACKNOWLEDGMENTS, hashDraftReportDecisionSnapshot } from "../../packages/neuvetra-database/src/m61"

const HOST = "https://www.neuvetra.ai"
const AUTH = "https://icockcoguyadhryzydvl.supabase.co"
const PROFILE = "neuvetra.private-synthetic-staging.v1"
const ROOT = path.resolve(import.meta.dir, "../..")
const RECEIPT = path.join(ROOT, ".superpowers/m63-hosted-journey.json")
const ROLES = ["manager1", "manager2", "member", "outsider"] as const
type Role = typeof ROLES[number]
type Account = { id: string; email: string; password: string; role: Role }
type Input = { env: { SUPABASE_URL: string; SUPABASE_ANON_KEY: string }; roster: { workspaceId: string }; accounts: Account[] }
type Stage = { stage: string; httpStatus: number | null }
type Baseline = { workspaceId: string; billId: string; inventoryId: string; inventorySnapshotSha256: string; packId: string; archiveSha256: string; manifestSha256: string; lineageRootSha256: string; reportId: string; reportSha256: string; reviewId: string; decisionSnapshotSha256: string }
const M57_WARNINGS = ["annual_coverage_incomplete_1_of_12_months", "market_based_scope2_not_included", "factor_and_method_not_released", "synthetic_local_only_no_assurance"]
function valid(value: unknown): asserts value { if (!value) throw new Error("Verification failed.") }
function uuid(value: unknown): string { valid(typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)); return value }
function sha(value: unknown): string { valid(typeof value === "string" && /^[0-9a-f]{64}$/.test(value)); return value }
function hash(bytes: Uint8Array | ArrayBuffer | string) { return new Bun.CryptoHasher("sha256").update(bytes).digest("hex") }
function equal(a: unknown, b: unknown) { return JSON.stringify(a) === JSON.stringify(b) }
const SAFE_ERROR_CODES = new Set(["EACCES", "EPERM", "ENOENT", "ENOTDIR", "EEXIST", "ENOSPC", "EROFS", "EXDEV", "EBUSY", "EMFILE", "ENFILE", "EIO", "EINVAL", "ETIMEDOUT", "ECONNRESET", "ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "ABORT_ERR"])
const SAFE_SYSCALLS = new Set(["mkdir", "open", "write", "writeFile", "rename", "unlink", "read", "readFile", "stat", "connect", "getaddrinfo"])
function safeError(error: unknown): { code?: string; syscall?: string } {
  if (!error || typeof error !== "object") return {}
  const { code, syscall } = error as { code?: unknown; syscall?: unknown }
  return { ...(typeof code === "string" && SAFE_ERROR_CODES.has(code) ? { code } : {}), ...(typeof syscall === "string" && SAFE_SYSCALLS.has(syscall) ? { syscall } : {}) }
}
class ReceiptWriteError extends Error {
  constructor(readonly stage: "receipt_directory" | "receipt_serialize" | "receipt_write" | "receipt_rename", readonly diagnostic: { code?: string; syscall?: string }) { super("Receipt write failed.") }
}
function key(workspaceId: string, operation: string, actor: string) {
  const raw = hash(`${PROFILE}:${workspaceId}:${operation}:${actor}`).slice(0, 32).split("")
  raw[12] = "4"; raw[16] = "8"
  const text = raw.join("")
  return `${text.slice(0, 8)}-${text.slice(8, 12)}-${text.slice(12, 16)}-${text.slice(16, 20)}-${text.slice(20)}`
}

/** Pure validation for local checks; ignores unrelated operator settings without copying them. */
export function parseJourneyInput(value: unknown): Input {
  const source = value as Input
  valid(source && source.env?.SUPABASE_URL === AUTH && typeof source.env.SUPABASE_ANON_KEY === "string")
  const publicKey = source.env.SUPABASE_ANON_KEY
  if (!/^sb_publishable_[A-Za-z0-9_-]{20,200}$/.test(publicKey)) {
    const parts = publicKey.split(".")
    const payload = JSON.parse(Buffer.from(parts[1] ?? "", "base64url").toString("utf8"))
    valid(parts.length === 3 && payload.role === "anon" && payload.ref === "icockcoguyadhryzydvl")
  }
  valid(Array.isArray(source.accounts) && source.accounts.length === 4)
  const accounts = source.accounts.map(account => {
    valid(ROLES.includes(account.role) && typeof account.email === "string" && account.email.length > 3 && account.email.length <= 254 && typeof account.password === "string" && account.password.length >= 8 && account.password.length <= 1024)
    return { id: uuid(account.id), email: account.email, password: account.password, role: account.role }
  })
  valid(new Set(accounts.map(account => account.role)).size === 4 && new Set(accounts.map(account => account.id)).size === 4)
  return { env: { SUPABASE_URL: AUTH, SUPABASE_ANON_KEY: publicKey }, roster: { workspaceId: uuid(source.roster?.workspaceId) }, accounts }
}

/** Local receipt writer; the CLI always uses the fixed workspace receipt path. */
export async function saveJourneyReceipt(value: unknown, receiptPath = RECEIPT) {
  const temporary = `${receiptPath}.${crypto.randomUUID()}.tmp`
  let stage: ReceiptWriteError["stage"] = "receipt_directory"
  try {
    const directory = path.dirname(receiptPath)
    let directoryInfo
    try { directoryInfo = await stat(directory) }
    catch (error) {
      if (safeError(error).code !== "ENOENT") throw error
      try { await mkdir(directory, { recursive: true }) }
      catch (creationError) {
        // Another writer may have created it, or OneDrive may report EEXIST.
        if (safeError(creationError).code !== "EEXIST") throw creationError
      }
      directoryInfo = await stat(directory)
    }
    if (!directoryInfo.isDirectory()) throw Object.assign(new Error("Receipt parent is not a directory."), { code: "ENOTDIR", syscall: "stat" })
    stage = "receipt_serialize"
    const text = JSON.stringify(value, null, 2) + "\n"
    stage = "receipt_write"
    await Bun.write(temporary, text)
    stage = "receipt_rename"
    await rename(temporary, receiptPath)
  } catch (error) { throw new ReceiptWriteError(stage, safeError(error)) }
  finally { await unlink(temporary).catch(() => {}) }
}

/** Called only by the explicit CLI entry; imports never authenticate or contact a host. */
export async function runHostedJourney(input: Input, readOnly: boolean, testDependencies: { fetch?: typeof globalThis.fetch; loadReceipt?: () => Promise<unknown>; saveReceipt?: (receipt: unknown) => Promise<void> } = {}) {
  const fetch = testDependencies.fetch ?? globalThis.fetch
  const startedAt = new Date().toISOString()
  const stages: Stage[] = []
  let stage = "configuration", httpStatus: number | null = null
  let applicationWrites = 0
  const tokens = new Map<Role, string>()
  const accounts = new Map(input.accounts.map(account => [account.role, account]))
  let prior: any = null
  let outcome: any = null
  const logouts: { role: Role; httpStatus: number | null }[] = []
  const setStage = (name: string) => { stage = name; httpStatus = null }
  const observe = (status: number) => { httpStatus = status; stages.push({ stage, httpStatus: status }) }
  const request = async (name: string, route: string, actor: Role | null, body?: unknown, expected = body === undefined ? 200 : 201, optional = false) => {
    setStage(name)
    valid(route.startsWith("/workspace-api/") || route === "/ready")
    if (body !== undefined) { valid(!readOnly); applicationWrites++ }
    const response = await fetch(HOST + route, {
      method: body === undefined ? "GET" : "POST", redirect: "error", signal: AbortSignal.timeout(30_000),
      headers: { origin: HOST, ...(actor ? { authorization: `Bearer ${tokens.get(actor)}` } : {}), ...(body !== undefined && !(body instanceof FormData) ? { "content-type": "application/json" } : {}) },
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    })
    observe(response.status)
    valid(response.headers.get("cache-control")?.includes("no-store"))
    if (optional && response.status === 404) { await response.body?.cancel(); return null }
    valid(response.status === expected)
    return response
  }
  const json = async (...args: Parameters<typeof request>): Promise<any> => {
    const response = await request(...args)
    if (!response) return null
    const text = await response.text(); valid(text.length <= 400_000)
    return JSON.parse(text)
  }
  const optional = (name: string, route: string) => json(name, route, "manager1", undefined, 200, true)
  const post = (name: string, route: string, actor: Role, body: Record<string, unknown>, expected = 201) => json(name, route, actor, { ...body, idempotencyKey: key(input.roster.workspaceId, name, accounts.get(actor)!.id) }, expected)
  const requireMutation = () => valid(!readOnly)
  try {
    setStage("receipt_load")
    prior = testDependencies.loadReceipt ? await testDependencies.loadReceipt() : await Bun.file(RECEIPT).exists() ? await Bun.file(RECEIPT).json() : null
    setStage("receipt_validation")
    if (prior) {
      valid(prior.schemaVersion === 1 && prior.host === HOST && prior.baseline?.workspaceId === input.roster.workspaceId && Array.isArray(prior.runs))
    }
    if (readOnly) valid(prior?.baseline)
    const readiness = await json("hosted_readiness", "/ready", null)
    valid(readiness.status === "ready" && readiness.profile === PROFILE && readiness.schemaVersion === 9 && readiness.legacyContainmentVerified === true)
    const config = await json("hosted_public_config", "/workspace-api/config", null)
    valid(config.profile === PROFILE && config.supabaseUrl === AUTH && config.anonKey === input.env.SUPABASE_ANON_KEY)
    for (const account of input.accounts) {
      setStage(`sign_in_${account.role}`)
      const response = await fetch(`${AUTH}/auth/v1/token?grant_type=password`, { method: "POST", redirect: "error", signal: AbortSignal.timeout(20_000), headers: { apikey: input.env.SUPABASE_ANON_KEY, "content-type": "application/json" }, body: JSON.stringify({ email: account.email, password: account.password }) })
      observe(response.status); valid(response.status === 200)
      const session = await response.json() as { access_token?: unknown; user?: { id?: unknown } }
      valid(session.user?.id === account.id && typeof session.access_token === "string" && session.access_token.length <= 8192)
      tokens.set(account.role, session.access_token)
    }
    for (const actor of ["manager1", "manager2", "member"] as const) {
      const session = await json(`session_${actor}`, "/workspace-api/session", actor)
      valid(session.profile === PROFILE && session.user.id === accounts.get(actor)!.id && session.access.workspaceId === input.roster.workspaceId)
      valid(actor === "member" ? session.access.role === "member" : ["owner", "admin"].includes(session.access.role))
    }
    await request("outsider_session_refused", "/workspace-api/session", "outsider", undefined, 403)
    await request("signed_out_session_refused", "/workspace-api/session", null, undefined, 401)
    const root = `/workspace-api/workspace/${input.roster.workspaceId}`
    const workspace = await json("workspace_revisit", root, "manager1")
    valid(workspace.id === input.roster.workspaceId && workspace.companyName === "Synthetic Acme, Inc." && workspace.facility.name === "Synthetic California office" && workspace.boundary.reportingYear === 2023)
    uuid(workspace.facility.id); uuid(workspace.boundary.id)
    const session = await json("evidence_discovery", "/workspace-api/session", "manager1")
    let bill: any
    if (session.access.evidenceId) bill = await json("bill_revisit", `${root}/bills/${uuid(session.access.evidenceId)}`, "manager1")
    else {
      requireMutation()
      const bytes = await Bun.file(path.join(ROOT, "output/pdf/neuvetra-m55-synthetic-electricity-bill.pdf")).bytes()
      valid(bytes.byteLength === 4605 && hash(bytes) === "0a97cd0976c03af0776214fc19bdc3d4f0c00e9c835f3e116574a6f375c8e135")
      const form = new FormData(); form.set("file", new File([bytes], "neuvetra-m55-synthetic-electricity-bill.pdf", { type: "application/pdf" }))
      bill = await json("bill_upload", `${root}/bills`, "manager1", form, 200)
    }
    uuid(bill.id); valid(bill.companyId === workspace.id)
    const billRoot = `${root}/bills/${bill.id}`
    if (bill.versions.length === 1) {
      requireMutation()
      bill = await json("bill_correction", `${billRoot}/corrections`, "manager1", { facilityId: workspace.facility.id, priorVersionId: uuid(bill.versions[0].id), electricityKwh: "12346.000", reason: "Synthetic review exercise" }, 200)
    }
    valid(bill.versions.length === 2 && bill.versions[1].electricityKwh === "12346.000" && bill.versions[1].facilityId === workspace.facility.id)
    if (!bill.draftActivity) { requireMutation(); bill = await json("bill_link", `${billRoot}/link`, "manager1", { boundaryId: workspace.boundary.id, billVersionId: uuid(bill.versions[1].id) }, 200) }
    if (!bill.draftCalculation) { requireMutation(); bill = await post("bill_calculate", `${billRoot}/calculate`, "manager1", {}, 200) }
    valid(bill.draftCalculation.total.unrounded === "2407.9674055248" && bill.draftCalculation.total.display === "2407.9674" && bill.draftCalculation.normalizedQuantityMwh === "12.346000")
    let inventory = await optional("inventory_revisit", `${root}/inventories/2023/scope2`)
    if (!inventory) { requireMutation(); inventory = await post("inventory_create", `${root}/inventories/2023/scope2/versions`, "manager1", { calculationId: uuid(bill.draftCalculation.id) }) }
    uuid(inventory.id); sha(inventory.snapshotSha256)
    valid(inventory.releaseEligible === false && equal(inventory.warnings, M57_WARNINGS))
    if (!inventory.decision) { requireMutation(); inventory = await post("inventory_review", `${root}/inventories/${inventory.id}/decisions`, "manager2", { decision: "approve_bounded_draft", expectedInventorySnapshotSha256: inventory.snapshotSha256, acknowledgedWarnings: M57_WARNINGS, reasonCode: "bounded_synthetic_scope_reviewed" }) }
    valid(inventory.decision.outcome === "approved_bounded_draft" && inventory.decision.decidedBy !== inventory.submittedBy)
    let registers = await optional("register_revisit", `${root}/annual-registers/2023`)
    if (!registers) { requireMutation(); registers = [await post("register_create", `${root}/annual-registers/2023`, "manager1", { previousInventoryVersionId: inventory.id })] }
    valid(Array.isArray(registers))
    let completed = registers.find((item: any) => item.version === 2)
    if (!completed) {
      requireMutation(); const initial = registers.find((item: any) => item.version === 1); valid(initial)
      completed = await post("register_complete", `${root}/annual-registers/${uuid(initial.id)}/complete`, "manager1", { expectedRegisterSnapshotSha256: sha(initial.snapshotSha256), fixtureId: "m58-fixed-electricity-register-2023-v1" })
    }
    valid(completed.periods?.length === 12 && completed.periods[10].state === "estimated" && completed.periods[11].state === "excluded" && completed.periods[11].quantityMwh === null && completed.totals.includedMwh === "139.281000" && completed.totals.includedKgCo2e === "27165.4064643528")
    let annual = await optional("annual_inventory_revisit", `${root}/annual-inventories/2023/scope2`)
    if (!annual) { requireMutation(); annual = await post("annual_inventory_create", `${root}/annual-inventories/2023/scope2/versions`, "manager1", { registerId: uuid(completed.id) }) }
    uuid(annual.id); sha(annual.snapshotSha256)
    valid(annual.releaseEligible === false && annual.overallInventoryCompleteness === "incomplete" && equal(annual.warnings, M58_WARNINGS))
    const annualRoot = `${root}/annual-inventories/${annual.id}`
    if (!annual.decision) { requireMutation(); annual = await post("annual_inventory_review", `${annualRoot}/decisions`, "manager2", { decision: "approve_bounded_annual_location_draft", reasonCode: "bounded_annual_location_register_reviewed", acknowledgedWarnings: M58_WARNINGS, expectedInventorySnapshotSha256: annual.snapshotSha256 }) }
    valid(annual.decision.outcome === "approved_bounded_annual_location_draft" && annual.decision.decidedBy !== annual.submittedBy)
    let pack = await optional("pack_revisit", `${annualRoot}/evidence-packs/current`)
    if (!pack) { requireMutation(); pack = await post("pack_create", `${annualRoot}/evidence-packs`, "manager1", { expectedInventorySnapshotSha256: annual.snapshotSha256 }) }
    uuid(pack.id); sha(pack.archiveSha256); sha(pack.manifestSha256); sha(pack.lineageRootSha256)
    const download = await request("pack_download_member", `${annualRoot}/evidence-packs/${pack.id}/download`, "member")
    const archive = new Uint8Array(await download!.arrayBuffer())
    valid(archive.byteLength <= 262144 && archive.byteLength === pack.archiveByteLength && hash(archive) === pack.archiveSha256 && download!.headers.get("x-neuvetra-archive-sha256") === pack.archiveSha256)
    setStage("pack_local_replay")
    const replay = verifyInventoryEvidenceArchive(archive, { archiveSha256: pack.archiveSha256, manifestSha256: pack.manifestSha256, lineageRootSha256: pack.lineageRootSha256, companyId: workspace.id, inventoryId: annual.id })
    valid(replay.status === "verified_match" && replay.reconstructed.includedKgCo2e === "27165.4064643528" && replay.releaseEligible === false)
    stages.push({ stage, httpStatus: null })
    if (!readOnly) {
      const replayForm = new FormData(); replayForm.set("file", new File([archive], `neuvetra-m59-${annual.id}.zip`, { type: "application/zip" }))
      const remoteReplay = await json("pack_server_replay", `${annualRoot}/evidence-packs/${pack.id}/replay`, "member", replayForm, 200)
      valid(remoteReplay.archiveSha256 === pack.archiveSha256 && remoteReplay.status === "verified_match")
    }
    let report = await optional("report_revisit", `${annualRoot}/draft-reports/current`)
    if (!report) { requireMutation(); report = await post("report_create", `${annualRoot}/draft-reports`, "manager1", { evidencePackId: pack.id, expectedArchiveSha256: pack.archiveSha256, expectedInventorySnapshotSha256: annual.snapshotSha256 }) }
    uuid(report.id); sha(report.reportSha256)
    valid(report.evidencePackId === pack.id && report.sourceArchiveSha256 === pack.archiveSha256 && report.inventorySnapshotSha256 === annual.snapshotSha256)
    const reportRoot = `${annualRoot}/draft-reports/${report.id}`
    let review = await optional("report_review_revisit", `${reportRoot}/decisions/current`)
    if (!review) {
      requireMutation()
      valid(report.createdBy === accounts.get("manager1")!.id)
      const decision = { decision: "accept_bounded_internal_draft", reasonCode: "exact_report_reviewed_for_bounded_internal_use", acknowledgedLimitations: [...M61_LIMITATION_ACKNOWLEDGMENTS], changeRouteCode: null, changeNote: null, expectedReportSha256: report.reportSha256 }
      await post("report_self_review_refused", `${reportRoot}/decisions`, "manager1", decision, 409)
      review = await post("report_review_create", `${reportRoot}/decisions`, "manager2", decision)
    }
    uuid(review.id); sha(review.decisionSnapshotSha256)
    valid(review.outcome === "accepted_bounded_internal_draft" && review.reportSha256 === report.reportSha256 && review.reportCreatedBy === report.createdBy && review.decidedBy !== report.createdBy && review.releaseEligible === false && equal(review.acknowledgedLimitations, [...M61_LIMITATION_ACKNOWLEDGMENTS]))
    const decisionHash = hashDraftReportDecisionSnapshot({ companyId: workspace.id, reportId: report.id, profile: review.profile, decision: review.decision, outcome: review.outcome, reasonCode: review.reasonCode, acknowledgedLimitations: review.acknowledgedLimitations, changeRouteCode: review.changeRouteCode, changeNote: review.changeNote, reportSha256: report.reportSha256, reportCreatedBy: report.createdBy, inventorySnapshotSha256: annual.snapshotSha256, sourceArchiveSha256: pack.archiveSha256, sourceManifestSha256: pack.manifestSha256, sourceLineageRootSha256: pack.lineageRootSha256, releaseEligible: false, reviewerIdentity: review.decidedBy })
    valid(decisionHash === review.decisionSnapshotSha256)
    const reportResponse = await request("report_download_member", `${reportRoot}/download`, "member")
    const reportBytes = new Uint8Array(await reportResponse!.arrayBuffer())
    valid(reportBytes.byteLength <= 65536 && reportBytes.byteLength === report.reportByteLength && hash(reportBytes) === report.reportSha256 && reportResponse!.headers.get("x-neuvetra-report-sha256") === report.reportSha256)
    const html = new TextDecoder().decode(reportBytes)
    valid(html.includes("27165.4064643528 kg CO2e") && html.includes("2023-11") && html.includes("2023-12"))
    const memberReview = await json("report_review_member", `${reportRoot}/decisions/current`, "member")
    valid(memberReview.decisionSnapshotSha256 === review.decisionSnapshotSha256)
    await request("outsider_report_refused", `${reportRoot}/download`, "outsider", undefined, 403)
    await request("outsider_pack_refused", `${annualRoot}/evidence-packs/${pack.id}/download`, "outsider", undefined, 403)
    await request("signed_out_report_refused", `${reportRoot}/download`, null, undefined, 401)
    await request("signed_out_review_refused", `${reportRoot}/decisions/current`, null, undefined, 401)
    await request("unknown_workspace_refused", `/workspace-api/workspace/${crypto.randomUUID()}`, "manager1", undefined, 404)
    const baseline: Baseline = { workspaceId: workspace.id, billId: bill.id, inventoryId: annual.id, inventorySnapshotSha256: annual.snapshotSha256, packId: pack.id, archiveSha256: pack.archiveSha256, manifestSha256: pack.manifestSha256, lineageRootSha256: pack.lineageRootSha256, reportId: report.id, reportSha256: report.reportSha256, reviewId: review.id, decisionSnapshotSha256: review.decisionSnapshotSha256 }
    setStage("exact_baseline_comparison")
    if (prior) valid(equal(prior.baseline, baseline))
    outcome = { schemaVersion: 1, host: HOST, baseline: prior?.baseline ?? baseline, runs: [...(prior?.runs ?? []), { status: "passed", mode: readOnly ? "read_only" : "resumable_journey", startedAt, completedAt: new Date().toISOString(), applicationPostRequests: applicationWrites, exactPriorBaselineMatched: Boolean(prior), archiveLocalReplay: "verified_match", secondManagerDistinct: true, outsiderBoundary: "uninvited_auth_subject_403", signedOutBoundary: 401, overallInventoryCompleteness: "incomplete", releaseEligible: false, stages }] }
  } catch (error) {
    outcome = { status: "hosted_journey_failed", mode: readOnly ? "read_only" : "resumable_journey", stage, httpStatus, ...safeError(error) }
  } finally {
    for (const [role, token] of tokens) {
      let status: number | null = null
      try {
        const response = await fetch(`${AUTH}/auth/v1/logout?scope=local`, { method: "POST", redirect: "error", signal: AbortSignal.timeout(15_000), headers: { apikey: input.env.SUPABASE_ANON_KEY, authorization: `Bearer ${token}` } })
        status = response.status; await response.body?.cancel()
      } catch { /* Only sanitized status is retained. */ }
      logouts.push({ role, httpStatus: status })
    }
    tokens.clear()
  }
  setStage("receipt_finalize")
  try {
    if (outcome.status === "hosted_journey_failed") return outcome
    const lastRun = outcome.runs[outcome.runs.length - 1]
    lastRun.authLogout = logouts
    lastRun.allAuthSessionsClosed = logouts.length === 4 && logouts.every(item => item.httpStatus === 204)
    if (!lastRun.allAuthSessionsClosed) lastRun.status = "application_checks_passed_auth_cleanup_failed"
    setStage("receipt_save")
    await (testDependencies.saveReceipt ?? saveJourneyReceipt)(outcome)
    if (!lastRun.allAuthSessionsClosed) {
      const failed = logouts.find(item => item.httpStatus !== 204)
      return { status: "hosted_journey_failed", mode: readOnly ? "read_only" : "resumable_journey", stage: failed ? `sign_out_${failed.role}` : "sign_out_count", httpStatus: failed?.httpStatus ?? null }
    }
    return { status: "hosted_journey_passed", mode: readOnly ? "read_only" : "resumable_journey", reportSha256: outcome.baseline.reportSha256, decisionSnapshotSha256: outcome.baseline.decisionSnapshotSha256, applicationPostRequests: applicationWrites, allAuthSessionsClosed: lastRun.allAuthSessionsClosed }
  } catch (error) {
    return { status: "hosted_journey_failed", mode: readOnly ? "read_only" : "resumable_journey", stage: error instanceof ReceiptWriteError ? error.stage : stage, httpStatus: null, ...(error instanceof ReceiptWriteError ? error.diagnostic : safeError(error)) }
  }
}

if (import.meta.main) {
  let stage = "stdin_read"
  try {
    const text = await Bun.stdin.text(); valid(text.length <= 128_000)
    stage = "input_json"
    const value: unknown = JSON.parse(text)
    stage = "input_validation"
    const input = parseJourneyInput(value)
    stage = "mode_validation"
    const mode = process.env.M63_HOSTED_JOURNEY_READ_ONLY
    valid(mode === undefined || mode === "0" || mode === "1")
    stage = "journey_execution"
    const result = await runHostedJourney(input, mode === "1")
    stage = "result_output"
    console.info(JSON.stringify(result))
    if (result.status !== "hosted_journey_passed") process.exitCode = 1
  } catch (error) {
    console.info(JSON.stringify({ status: "hosted_journey_failed", stage, httpStatus: null, ...safeError(error) }))
    process.exitCode = 1
  }
}
