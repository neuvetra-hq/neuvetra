import { describe, expect, test } from "bun:test"
import { M80_HELD_REGISTRY, createM80FixtureSetup, m80HashCanonical, M80_FIXTURE_SHA256 } from "../../../../packages/neuvetra-database/src/m80-fixture"
import { classifyM80Foundation, validateM80Setup } from "../../../../packages/neuvetra-database/src/m80-validation"
import {
  M80ApiError,
  cloneM80Setup,
  createM80SaveAttempt,
  decodeM80Foundation,
  decodeM80Version,
  loadM80Foundation,
  saveM80Foundation,
  updateM80Evidence,
  type M80BetaSetupVersion,
  type M80FoundationView,
} from "./m80-beta-api"

const COMPANY = "80000000-0000-4000-8000-000000000010"
const ACTOR = "80000000-0000-4000-8000-000000000020"
const OTHER_ACTOR = "80000000-0000-4000-8000-000000000021"
const VERSION = "80000000-0000-4000-8000-000000000030"
const IDEMPOTENCY = "80000000-0000-4000-8000-000000000040"
const admission = { companyId: COMPANY, fixtureProfileId: "m80-synthetic-scope1-foundation-v1" as const, fixtureVersion: 1 as const, fixtureSha256: M80_FIXTURE_SHA256, active: true }
const rawSetup = createM80FixtureSetup(COMPANY)
const setup = validateM80Setup(rawSetup, admission)
const eligibility = classifyM80Foundation(rawSetup, admission, M80_HELD_REGISTRY)

function persisted() {
  const root = structuredClone(setup) as typeof setup & { fixture?: typeof setup.fixture }
  delete root.fixture
  return { ...root, sources: root.sources.map(source => { const row = { ...source } as typeof source & { sourceIdentitySha256?: string }; delete row.sourceIdentitySha256; return row }) }
}
function version(createdBy = ACTOR): M80BetaSetupVersion {
  const payloadSha256 = m80HashCanonical(persisted())
  const body = { profile: "m80-scope1-beta-foundation-runtime-v1", id: VERSION, companyId: COMPANY, reportingYear: 2025 as const, revision: 1, previousVersionId: null, previousVersionSha256: null, fixtureProfileId: admission.fixtureProfileId, fixtureVersion: 1, fixtureSha256: admission.fixtureSha256, payloadSha256, createdBy, createdAt: "2026-09-24T12:00:00.000Z", dataClassification: "synthetic_rehearsal", completeness: "incomplete", releasedSupportedCount: 0 }
  return { id: VERSION, companyId: COMPANY, reportingYear: 2025, revision: 1, previousVersionId: null, previousVersionSha256: null, setup, payloadSha256, versionSha256: m80HashCanonical(body), createdBy, createdAt: body.createdAt }
}
function rehashVersion(value: M80BetaSetupVersion): M80BetaSetupVersion {
  value.versionSha256 = m80HashCanonical({ profile: "m80-scope1-beta-foundation-runtime-v1", id: value.id, companyId: value.companyId, reportingYear: 2025, revision: value.revision, previousVersionId: value.previousVersionId, previousVersionSha256: value.previousVersionSha256, fixtureProfileId: admission.fixtureProfileId, fixtureVersion: 1, fixtureSha256: admission.fixtureSha256, payloadSha256: value.payloadSha256, createdBy: value.createdBy, createdAt: value.createdAt, dataClassification: "synthetic_rehearsal", completeness: "incomplete", releasedSupportedCount: 0 })
  return value
}
function foundation(saved = false, canManage = true): M80FoundationView {
  const current = saved ? version() : null
  const summary = current ? { ...current } : null
  if (summary) delete (summary as Partial<M80BetaSetupVersion>).setup
  return { profile: "m80-scope1-beta-foundation-runtime-v1", syntheticOnly: true, canManage, fixtureAdmission: admission, releaseRegistry: structuredClone(M80_HELD_REGISTRY) as M80FoundationView["releaseRegistry"], currentVersion: current, history: summary ? [summary] : [], setup, eligibility }
}
const actor = { accessToken: "m80-test-token", userId: ACTOR, role: "admin" as const }

describe("M80 browser trust boundary", () => {
  test("accepts the exact held synthetic foundation and authoritative view-only flag", async () => {
    expect((await decodeM80Foundation(foundation(false, false), COMPANY)).canManage).toBe(false)
    expect((await decodeM80Foundation(foundation(true), COMPANY)).history).toHaveLength(1)
  })

  test("rejects added authority, release escalation, changed fixture authority, and corrupt version hashes", async () => {
    const base = foundation(true) as unknown as Record<string, unknown>
    await expect(decodeM80Foundation({ ...base, canInvite: true }, COMPANY)).rejects.toThrow("not recognized")
    const release = structuredClone(foundation())
    ;(release.releaseRegistry[0] as { status: string }).status = "released_supported"
    await expect(decodeM80Foundation(release, COMPANY)).rejects.toThrow("not recognized")
    const changedRelease = structuredClone(foundation())
    changedRelease.releaseRegistry[0]!.methodSha256 = "0".repeat(64)
    await expect(decodeM80Foundation(changedRelease, COMPANY)).rejects.toThrow("not recognized")
    const fixture = structuredClone(foundation())
    fixture.fixtureAdmission.fixtureSha256 = "0".repeat(64)
    await expect(decodeM80Foundation(fixture, COMPANY)).rejects.toThrow("not recognized")
    const corrupt = structuredClone(foundation(true))
    corrupt.currentVersion!.versionSha256 = "0".repeat(64)
    corrupt.history[0]!.versionSha256 = "0".repeat(64)
    await expect(decodeM80Foundation(corrupt, COMPANY)).rejects.toThrow("not recognized")
  })

  test("requires all fourteen sources, nineteen evidence rows, and seven-by-seven process screening", async () => {
    const missingSource = structuredClone(foundation())
    missingSource.setup.sources.pop()
    await expect(decodeM80Foundation(missingSource, COMPANY)).rejects.toThrow("not recognized")
    const missingEvidence = structuredClone(foundation())
    missingEvidence.setup.evidenceRequirements.pop()
    await expect(decodeM80Foundation(missingEvidence, COMPANY)).rejects.toThrow("not recognized")
    const shortenedScreen = structuredClone(foundation())
    shortenedScreen.setup.sources.find(source => source.processScreen)!.processScreen!.gasGroups.pop()
    await expect(decodeM80Foundation(shortenedScreen, COMPANY)).rejects.toThrow("not recognized")
  })

  test("rejects JSON arrays where exact scalar setup values are required", async () => {
    const probes = [
      (value: M80FoundationView) => { (value.setup.boundaryProposal as unknown as Record<string, unknown>).jointVentureState = [value.setup.boundaryProposal.jointVentureState] },
      (value: M80FoundationView) => { (value.setup.sources[0]!.knownFacts as unknown as Record<string, unknown>).fuelOrGas = [value.setup.sources[0]!.knownFacts.fuelOrGas] },
      (value: M80FoundationView) => { (value.setup.evidenceRequirements[0] as unknown as Record<string, unknown>).state = [value.setup.evidenceRequirements[0]!.state] },
      (value: M80FoundationView) => { (value.eligibility.results[0] as unknown as Record<string, unknown>).state = [value.eligibility.results[0]!.state] },
    ]
    for (const mutate of probes) {
      const value = structuredClone(foundation())
      mutate(value)
      await expect(decodeM80Foundation(value, COMPANY)).rejects.toThrow("not recognized")
    }
  })

  test("binds every source to its fixed fixture location and recomputed classification", async () => {
    const moved = structuredClone(foundation())
    moved.setup.sources[0]!.locationId = moved.setup.locations[1]!.locationId
    await expect(decodeM80Foundation(moved, COMPANY)).rejects.toThrow("not recognized")

    const invented = structuredClone(foundation())
    const result = invented.eligibility.results[13]!
    result.state = "held_candidate"
    result.candidateProfileId = invented.releaseRegistry[0]!.profileId
    result.blockerCodes = []
    result.requiredFactCodes = []
    await expect(decodeM80Foundation(invented, COMPANY)).rejects.toThrow("not recognized")
  })

  test("rehashes every history summary and binds the complete head to currentVersion", async () => {
    const corruptHistory = structuredClone(foundation(true))
    corruptHistory.history[0]!.createdAt = "2026-09-24T12:00:01.000Z"
    await expect(decodeM80Foundation(corruptHistory, COMPANY)).rejects.toThrow("not recognized")

    const mismatchedHead = structuredClone(foundation(true))
    mismatchedHead.history[0]!.createdBy = OTHER_ACTOR
    const summaryAsVersion = { ...mismatchedHead.currentVersion!, ...mismatchedHead.history[0]! }
    mismatchedHead.history[0]!.versionSha256 = rehashVersion(summaryAsVersion).versionSha256
    await expect(decodeM80Foundation(mismatchedHead, COMPANY)).rejects.toThrow("not recognized")
  })

  test("rejects impossible timestamps and structurally impossible standalone lineage", async () => {
    const impossibleDate = rehashVersion({ ...version(), createdAt: "2026-02-30T00:00:00.000Z" })
    await expect(decodeM80Version(impossibleDate, COMPANY)).rejects.toThrow("not recognized")

    const firstWithPredecessor = rehashVersion({ ...version(), previousVersionId: OTHER_ACTOR, previousVersionSha256: "1".repeat(64) })
    await expect(decodeM80Version(firstWithPredecessor, COMPANY)).rejects.toThrow("not recognized")

    const secondWithoutPredecessor = rehashVersion({ ...version(), revision: 2 })
    await expect(decodeM80Version(secondWithoutPredecessor, COMPANY)).rejects.toThrow("not recognized")

    const selfPredecessor = rehashVersion({ ...version(), revision: 2, previousVersionId: VERSION, previousVersionSha256: "1".repeat(64) })
    await expect(decodeM80Version(selfPredecessor, COMPANY)).rejects.toThrow("not recognized")
  })
})

describe("M80 request and retry boundary", () => {
  test("uses one exact idempotency key and exact predecessor binding for a correction", () => {
    const view = foundation(true)
    const attempt = createM80SaveAttempt(view, cloneM80Setup(view.setup), IDEMPOTENCY)
    expect(attempt).toMatchObject({ idempotencyKey: IDEMPOTENCY, request: { idempotencyKey: IDEMPOTENCY, expectedRevision: 1, expectedVersionId: VERSION, expectedVersionSha256: view.currentVersion!.versionSha256, correctionReason: "synthetic_fact_correction" } })
    expect(createM80SaveAttempt(foundation(), setup, IDEMPOTENCY).request).toMatchObject({ expectedRevision: 0, expectedVersionId: null, expectedVersionSha256: null, correctionReason: null })
  })

  test("sends the strict route and bearer request, then decodes the saved server result", async () => {
    const view = foundation(false), savedView = foundation(true), attempt = createM80SaveAttempt(view, view.setup, IDEMPOTENCY)
    let observed: { url: string; method?: string; authorization: string | null; body: unknown } | null = null
    const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
      observed = { url: String(input), method: init?.method, authorization: new Headers(init?.headers).get("authorization"), body: JSON.parse(String(init?.body)) }
      return Response.json({ foundation: savedView, savedVersion: savedView.currentVersion, replayed: false })
    }) as typeof fetch
    const result = await saveM80Foundation(COMPANY, attempt, actor, fetcher)
    expect(result.replayed).toBe(false)
    expect(observed).toEqual({ url: `/workspace-api/workspace/${COMPANY}/scope1-beta-setup`, method: "POST", authorization: "Bearer m80-test-token", body: attempt.request })
  })

  test("preserves conflict status and does not convert it into a local save", async () => {
    const fetcher = (async () => Response.json({ error: "Scope 1 beta setup changed. Refresh current setup." }, { status: 409 })) as typeof fetch
    const attempt = createM80SaveAttempt(foundation(), setup, IDEMPOTENCY)
    await expect(saveM80Foundation(COMPANY, attempt, actor, fetcher)).rejects.toMatchObject({ status: 409, conflict: true })
  })

  test("GET binds the selected actor token and strictly decodes server authority", async () => {
    const fetcher = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer m80-test-token")
      return Response.json(foundation(false, false))
    }) as typeof fetch
    expect((await loadM80Foundation(COMPANY, actor, fetcher)).canManage).toBe(false)
  })

  test("rejects duplicate-key and oversized JSON responses", async () => {
    const json = JSON.stringify(foundation()).replace('{"profile":', '{"profile":"m80-scope1-beta-foundation-runtime-v1","profile":')
    await expect(loadM80Foundation(COMPANY, actor, (async () => new Response(json)) as typeof fetch)).rejects.toThrow("not recognized")
    await expect(loadM80Foundation(COMPANY, actor, (async () => new Response("{}", { headers: { "content-length": "250001" } })) as typeof fetch)).rejects.toThrow("too large")
  })

  test("rejects a valid saved version that is not bound to the attempted payload", async () => {
    const view = foundation(true), changed = cloneM80Setup(view.setup)
    changed.evidenceRequirements[0]!.state = "synthetic_fixture_reference"
    const attempt = createM80SaveAttempt(view, changed, IDEMPOTENCY)
    const fetcher = (async () => Response.json({ foundation: view, savedVersion: view.currentVersion, replayed: true })) as typeof fetch
    await expect(saveM80Foundation(COMPANY, attempt, actor, fetcher)).rejects.toThrow("not recognized")
  })

  test("rejects another manager's otherwise valid same-content save result", async () => {
    const attempt = createM80SaveAttempt(foundation(false), setup, IDEMPOTENCY), otherVersion = version(OTHER_ACTOR), otherView = foundation(false)
    otherView.currentVersion = otherVersion
    const summary = { ...otherVersion } as Partial<M80BetaSetupVersion>
    delete summary.setup
    otherView.history = [summary as M80FoundationView["history"][number]]
    const fetcher = (async () => Response.json({ foundation: otherView, savedVersion: otherVersion, replayed: false })) as typeof fetch
    await expect(saveM80Foundation(COMPANY, attempt, actor, fetcher)).rejects.toThrow("not recognized")
  })

  test("does not return decoded data after the actor signal is aborted", async () => {
    const controller = new AbortController(), scoped = { ...actor, signal: controller.signal }
    const fetcher = (async () => { controller.abort(); return Response.json(foundation()) }) as typeof fetch
    await expect(loadM80Foundation(COMPANY, scoped, fetcher)).rejects.toHaveProperty("name", "AbortError")
  })
})

describe("M80 draft state", () => {
  test("edits a clone while preserving the saved setup until the server responds", () => {
    const original = cloneM80Setup(setup), requirement = original.evidenceRequirements[0]!
    const next = updateM80Evidence(original, requirement.requirementId, "synthetic_fixture_reference")
    expect(original.evidenceRequirements[0]!.state).toBe("missing")
    expect(next.evidenceRequirements[0]!.state).toBe("synthetic_fixture_reference")
    expect(next.sources).toHaveLength(14)
    expect(next.evidenceRequirements).toHaveLength(19)
  })

  test("exposes typed API failures for honest UI recovery", () => {
    const error = new M80ApiError("retry", 503, null)
    expect(error.conflict).toBe(false)
  })
})
