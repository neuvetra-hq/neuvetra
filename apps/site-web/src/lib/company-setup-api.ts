import type { CompanySetup, CompanySetupSaveInput, CompanySetupSaveResult, CompanySetupVersion, CompanySetupView } from "../../../../packages/neuvetra-database/src/company-setup-contract"
import type { HostedWorkspaceActor } from "./workspace-api"

export type { CompanySetup, CompanySetupSaveInput, CompanySetupSaveResult, CompanySetupVersion, CompanySetupView }

export class CompanySetupApiError extends Error {
  constructor(message: string, readonly status: number) { super(message) }
  get conflict() { return this.status === 409 }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const HASH = /^[0-9a-f]{64}$/
const fail = (): never => { throw new Error("The company setup response was not recognized.") }
function object(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value) }
function record(value: unknown): Record<string, unknown> { if (!object(value)) throw new Error("The company setup response was not recognized."); return value }
function keys(value: Record<string, unknown>, expected: readonly string[]) { return Object.keys(value).sort().join("|") === [...expected].sort().join("|") }
function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`
}
async function hash(value: unknown) { return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical(value))))].map(byte => byte.toString(16).padStart(2, "0")).join("") }
const SUMMARY_KEYS = ["id", "companyId", "revision", "previousVersionId", "correctionReason", "payloadSha256", "createdBy", "createdAt"] as const
function summary(value: unknown, companyId: string, revision: number, predecessor: string | null): value is Omit<CompanySetupVersion, "setup"> {
  if (!object(value) || !keys(value, SUMMARY_KEYS) || !UUID.test(String(value.id)) || value.companyId !== companyId || value.revision !== revision || value.previousVersionId !== predecessor || !UUID.test(String(value.createdBy)) || !HASH.test(String(value.payloadSha256)) || typeof value.createdAt !== "string" || !Number.isFinite(Date.parse(value.createdAt))) return false
  return revision === 1 ? value.correctionReason === null : typeof value.correctionReason === "string" && value.correctionReason.trim().length >= 3
}
async function version(value: unknown, companyId: string, revision: number, predecessor: string | null): Promise<CompanySetupVersion> {
  const row = record(value)
  if (!keys(row, [...SUMMARY_KEYS, "setup"]) || !object(row.setup)) fail()
  const metadata = Object.fromEntries(Object.entries(row).filter(([key]) => key !== "setup"))
  if (!summary(metadata, companyId, revision, predecessor) || await hash(row.setup) !== row.payloadSha256) fail()
  return row as unknown as CompanySetupVersion
}
async function view(value: unknown, companyId: string): Promise<CompanySetupView> {
  const row = record(value)
  if (!keys(row, ["profile", "syntheticOnly", "canManage", "currentVersion", "history"]) || row.profile !== "neuvetra.company-setup.v1" || row.syntheticOnly !== true || typeof row.canManage !== "boolean" || !Array.isArray(row.history)) fail()
  const history = row.history as unknown[]
  let predecessor: string | null = null
  for (let index = 0; index < history.length; index++) {
    const item = history[index]
    if (!summary(item, companyId, index + 1, predecessor)) throw new Error("The company setup response was not recognized.")
    predecessor = item.id
  }
  if (history.length === 0) { if (row.currentVersion !== null) fail() }
  else {
    const prior = history.length > 1 ? history[history.length - 2] as Omit<CompanySetupVersion, "setup"> : null
    const current = await version(row.currentVersion, companyId, history.length, prior?.id ?? null)
    if (current.id !== predecessor) fail()
    const metadata = Object.fromEntries(Object.entries(current).filter(([key]) => key !== "setup"))
    if (canonical(metadata) !== canonical(history[history.length - 1])) fail()
  }
  return row as unknown as CompanySetupView
}

function url(companyId: string, versionId?: string) {
  if (!UUID.test(companyId) || (versionId && !UUID.test(versionId))) throw new Error("Invalid company setup reference.")
  return `/workspace-api/workspace/${companyId}/setup${versionId ? `/versions/${versionId}` : ""}`
}

async function request<T>(actor: HostedWorkspaceActor, path: string, input?: CompanySetupSaveInput): Promise<T> {
  if (!actor.accessToken || /[\r\n]/.test(actor.accessToken)) throw new Error("Sign in again to continue.")
  actor.signal?.throwIfAborted()
  const response = await fetch(path, {
    method: input ? "POST" : "GET",
    headers: { authorization: `Bearer ${actor.accessToken}`, ...(input ? { "content-type": "application/json" } : {}) },
    body: input ? JSON.stringify(input) : undefined,
    cache: "no-store",
    signal: actor.signal,
  })
  actor.signal?.throwIfAborted()
  if (response.status === 401 || response.status === 403) actor.onUnauthorized?.()
  const value: unknown = await response.json().catch(() => null)
  actor.signal?.throwIfAborted()
  if (!response.ok) throw new CompanySetupApiError(value && typeof value === "object" && "error" in value && typeof value.error === "string" ? value.error : "Company setup is unavailable.", response.status)
  if (!value || typeof value !== "object") throw new Error("The company setup response was not recognized.")
  return value as T
}

export async function loadCompanySetup(companyId: string, actor: HostedWorkspaceActor) {
  return view(await request<unknown>(actor, url(companyId)), companyId)
}

export async function loadCompanySetupVersion(companyId: string, versionId: string, actor: HostedWorkspaceActor) {
  const value = await request<unknown>(actor, url(companyId, versionId))
  const row = record(value)
  if (!Number.isSafeInteger(row.revision) || Number(row.revision) < 1) fail()
  const decoded = await version(row, companyId, Number(row.revision), row.previousVersionId as string | null)
  if (decoded.id !== versionId) fail()
  return decoded
}

export async function saveCompanySetup(companyId: string, input: CompanySetupSaveInput, actor: HostedWorkspaceActor) {
  const value = await request<unknown>(actor, url(companyId), input)
  const row = record(value)
  if (!keys(row, ["foundation", "savedVersion", "replayed"]) || typeof row.replayed !== "boolean") fail()
  const foundation = await view(row.foundation, companyId)
  const savedVersion = await version(row.savedVersion, companyId, input.expectedRevision + 1, input.expectedVersionId)
  if (savedVersion.createdBy !== actor.userId || savedVersion.correctionReason !== input.correctionReason || canonical(savedVersion.setup) !== canonical(input.setup) || !foundation.history.some(item => item.id === savedVersion.id && item.revision === savedVersion.revision && item.payloadSha256 === savedVersion.payloadSha256)) fail()
  if (!row.replayed && foundation.currentVersion?.id !== savedVersion.id) fail()
  return { foundation, savedVersion, replayed: row.replayed }
}
