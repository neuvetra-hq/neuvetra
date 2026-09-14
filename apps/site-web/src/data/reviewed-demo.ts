import { isResearchAnswer, type ResearchAnswer } from "@/lib/research-api"

export type ReviewedDemoId = "W11" | "W03" | "EPA14-B01"

export interface ReviewedDemoCase {
  id: ReviewedDemoId
  step: string
  navigationLabel: string
  question: string
  interpretation: string
  runDisposition: string
  artifact: string
  responseSha256: string
  terminalQaSha256: string
  closureQaSha256: string
  answer: ResearchAnswer
}

export const REVIEWED_DEMO_MANIFEST = [
  {
    id: "W11",
    step: "1 · Needs company context",
    navigationLabel: "Needs company context",
    question: "Our two electricity totals changed in opposite directions. What caused that in our company?",
    interpretation: "Neuvetra did not infer a company-specific cause without the referenced subject.",
    runDisposition: "The W11 result was accepted. Its enclosing run used a truthful conservative emergency closure after an ordinary-closer defect.",
    artifact: "src/data/reviewed-demo-artifacts/W11.bin",
    responseSha256: "521ebac9190dc84c6d0bb96bbe4b46d5f354334b1cd57725c65f434239fc8faa",
    terminalQaSha256: "d541eeee954a74537b8ce912b62f7ec8ce0806850177036993cbf27ebe56e482",
    closureQaSha256: "5441520386f7f54b2395892eb4ad895d16f1df8b99b0a833fc854e76cbd6fe63",
  },
  {
    id: "W03",
    step: "2 · Supported with qualifications",
    navigationLabel: "Supported explanation",
    question: "One electricity footprint reflects the mix on the surrounding grid; another reflects what a business bought under its energy agreements. What does each perspective tell us?",
    interpretation: "Neuvetra explained the two accounting perspectives while preserving company and legal limits.",
    runDisposition: "The W03 result was accepted. Its enclosing two-case run later closed fail-closed after its supervisor stopped before the second case.",
    artifact: "src/data/reviewed-demo-artifacts/W03.bin",
    responseSha256: "dbd1570ad73900a9365b574f72cf9e4e57bd72b13239738b3dd09ae57526d49f",
    terminalQaSha256: "465429e453e787fc2eaa7fded571f1e7c16f69ec1d14d978223e3cbc04e244ca",
    closureQaSha256: "f4aa6cab3b9234591b323c7e77d8218e68a43e114e59314129e0d30e0b902091",
  },
  {
    id: "EPA14-B01",
    step: "3 · More source coverage is needed",
    navigationLabel: "Source gap",
    question: "What if I don’t make specified renewable energy purchases—do I still have to do dual reporting?",
    interpretation: "Neuvetra withheld partial background because the reviewed material did not resolve the conditional rule.",
    runDisposition: "The EPA14-B01 result was accepted and its enclosing run completed ordinary closure.",
    artifact: "src/data/reviewed-demo-artifacts/EPA14-B01.bin",
    responseSha256: "4dca42a33aeb6dad1bfec51da33346151afdc1d773949661345c33e0be6d9cc2",
    terminalQaSha256: "53de5e233d7df60ab3881034c8be2551801daf5d5dd0c324d6bc26cafaf2f333",
    closureQaSha256: "60b3e6fe680c565381236197296019db9517b80ff2bdb37abe9fbeae2742ca3e",
  },
] as const

const EXPECTED = {
  W11: { status: "needs_input", reason: "context_required", claims: 0, evidence: 0, sources: 0 },
  W03: { status: "qualified", reason: "none", claims: 3, evidence: 2, sources: 1 },
  "EPA14-B01": { status: "unsupported", reason: "coverage_missing", claims: 0, evidence: 0, sources: 0 },
} as const

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

async function loadCase(entry: (typeof REVIEWED_DEMO_MANIFEST)[number], fetcher: typeof fetch, basePath: string): Promise<ReviewedDemoCase> {
  const configuredBase = basePath || "/"
  const base = configuredBase.endsWith("/") ? configuredBase : `${configuredBase}/`
  const response = await fetcher(`${base}${entry.artifact}`, { cache: "no-store", credentials: "same-origin" })
  if (!response.ok) throw new Error(`${entry.id}: artifact unavailable`)
  const bytes = await response.arrayBuffer()
  const digest = toHex(await crypto.subtle.digest("SHA-256", bytes))
  if (digest !== entry.responseSha256) throw new Error(`${entry.id}: artifact hash mismatch`)

  const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes))
  if (!isResearchAnswer(parsed)) throw new Error(`${entry.id}: invalid reviewed response`)
  const expected = EXPECTED[entry.id]
  const reason = parsed.status === "needs_input" || parsed.status === "unsupported" ? parsed.scope_gaps?.[0]?.reason : "none"
  if (
    parsed.status !== expected.status ||
    reason !== expected.reason ||
    parsed.claims.length !== expected.claims ||
    parsed.evidence.length !== expected.evidence ||
    parsed.sources.length !== expected.sources ||
    parsed.release?.id !== "scope2-website" ||
    parsed.release.version !== "1" ||
    parsed.release.sha256 !== "38f91ceac7aab790cb6faf98d39d8e0c5f2eb734f6a5763d51b6bf6ef7afa43f"
  ) throw new Error(`${entry.id}: reviewed response contract mismatch`)

  return { ...entry, answer: parsed }
}

export async function loadReviewedDemoCases(fetcher: typeof fetch = fetch, basePath = import.meta.env.BASE_URL || "/"): Promise<ReviewedDemoCase[]> {
  const cases = await Promise.all(REVIEWED_DEMO_MANIFEST.map((entry) => loadCase(entry, fetcher, basePath)))
  if (cases.map((item) => item.id).join(",") !== "W11,W03,EPA14-B01") throw new Error("Reviewed replay order mismatch")
  return cases
}
