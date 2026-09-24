import { describe, expect, test } from "bun:test"
import { m71CanonicalJson } from "./m71-validation"
import { M80_FIXTURE_PROFILE, M80_FIXTURE_VERSION, M80_MAX_CANONICAL_BYTES, type M80HeldProfile } from "./m80-contract"
import { createM80FixtureSetup, m80HashCanonical, M80_FIXTURE, M80_FIXTURE_SHA256, M80_HELD_REGISTRY } from "./m80-fixture"
import { classifyM80Foundation, M80RegistryError, M80ValidationError, parseM80Json, validateM80Setup } from "./m80-validation"

const COMPANY_ID = "80000000-0000-4000-8000-000000000901"
const OTHER_COMPANY_ID = "80000000-0000-4000-8000-000000000902"
const admission = () => ({ companyId: COMPANY_ID, fixtureProfileId: M80_FIXTURE_PROFILE, fixtureVersion: M80_FIXTURE_VERSION, fixtureSha256: M80_FIXTURE_SHA256, active: true })
const setup = () => createM80FixtureSetup(COMPANY_ID)
const cloneRegistry = (): M80HeldProfile[] => structuredClone(M80_HELD_REGISTRY) as M80HeldProfile[]

function collectKeys(value: unknown, found = new Set<string>()): Set<string> {
  if (Array.isArray(value)) for (const child of value) collectKeys(child, found)
  else if (value && typeof value === "object") for (const [key, child] of Object.entries(value)) { found.add(key); collectKeys(child, found) }
  return found
}

describe("M80 fixed synthetic foundation", () => {
  test("binds exact canonical fixture and source identities", () => {
    expect(m80HashCanonical(M80_FIXTURE)).toBe(M80_FIXTURE_SHA256)
    expect(Object.isFrozen(M80_FIXTURE)).toBe(true)
    expect(Object.isFrozen(M80_FIXTURE.sourceTemplates)).toBe(true)
    expect(Object.isFrozen(M80_HELD_REGISTRY)).toBe(true)
    expect(Object.isFrozen(M80_HELD_REGISTRY[0]!.sourceArtifactIds)).toBe(true)
    for (const source of M80_FIXTURE.sourceTemplates) {
      const identity = { sourceId: source.sourceId, entityId: source.entityId, locationId: source.locationId, displayLabel: source.displayLabel, category: source.category, subtype: source.subtype }
      expect(source.sourceIdentitySha256).toBe(m80HashCanonical(identity))
    }
  })

  test("validates the complete exact fixture through a separately supplied admission", () => {
    const validated = validateM80Setup(setup(), admission())
    expect(validated.fixture).toEqual({ profileId: M80_FIXTURE_PROFILE, version: 1, sha256: M80_FIXTURE_SHA256 })
    expect(validated.sources).toHaveLength(14)
    expect(validated.evidenceRequirements).toHaveLength(19)
    expect(new Set(validated.sources.map((row) => row.sourceIdentitySha256)).size).toBe(14)
    expect(validated.completeness).toBe("incomplete")
  })

  test("returns held, unsupported and named missing facts with zero releases and no numerical output", () => {
    const classified = classifyM80Foundation(setup(), admission(), M80_HELD_REGISTRY)
    expect(classified.releasedSupportedCount).toBe(0)
    expect(classified.results.filter((row) => row.state === "held_candidate")).toHaveLength(6)
    expect(classified.results.filter((row) => row.state === "unsupported")).toHaveLength(7)
    expect(classified.results.filter((row) => row.state === "missing_facts")).toHaveLength(1)
    expect(new Set(classified.results.filter((row) => row.state === "held_candidate").map((row) => row.candidateProfileId))).toEqual(new Set(M80_HELD_REGISTRY.map((row) => row.profileId)))
    const unclassified = classified.results.find((row) => row.sourceId.endsWith("1014"))!
    expect(unclassified.requiredFactCodes).toEqual(["activity_data_kind", "activity_unit", "equipment_kind", "fuel_or_gas"])
    expect(unclassified.blockerCodes).toContain("source_facts_missing")
    const unsupportedFire = classified.results.find((row) => row.sourceId.endsWith("1008"))!
    expect(unsupportedFire.state).toBe("unsupported")
    expect(unsupportedFire.blockerCodes).toContain("no_candidate_profile_matches_known_facts")
    const process = classified.results.find((row) => row.sourceId.endsWith("1012"))!
    expect(process.state).toBe("unsupported")
    expect(process.blockerCodes).toContain("process_screen_unknowns_preserved")
    expect(process.requiredFactCodes).toHaveLength(14)
    expect(process.requiredFactCodes).toContain("process_category_mineral_products")
    expect(process.requiredFactCodes).toContain("gas_group_NF3")
    const outputKeys = collectKeys(classified)
    for (const forbidden of ["factor", "gwp", "methodSha256", "releaseEligible", "result", "calculation", "subtotal", "amount", "quantity", "documentBytes"]) expect(outputKeys.has(forbidden)).toBe(false)
    expect(JSON.stringify(classified)).not.toContain('"released_supported"')
  })

  test("canonicalizes equivalent row and registry ordering without changing classification", () => {
    const reordered = setup()
    reordered.entities.reverse()
    reordered.locations.reverse()
    reordered.sources.reverse()
    reordered.evidenceRequirements.reverse()
    for (const source of reordered.sources) source.evidenceRequirementIds.reverse()
    const registry = cloneRegistry().reverse()
    for (const row of registry) row.sourceArtifactIds.reverse()
    const expected = classifyM80Foundation(setup(), admission(), M80_HELD_REGISTRY)
    const actual = classifyM80Foundation(reordered, admission(), registry)
    expect(m71CanonicalJson(actual)).toBe(m71CanonicalJson(expected))
  })
})

describe("M80 caller and context refusal", () => {
  test("rejects caller authority fields at the root and nested source boundary", () => {
    for (const field of ["releaseEligible", "factor", "gwp", "methodHash", "eligibilityResult", "result", "documentBytes", "contact"]) {
      const candidate = setup() as unknown as Record<string, unknown>
      candidate[field] = field === "releaseEligible" ? true : "caller-value"
      expect(() => validateM80Setup(candidate, admission())).toThrow(M80ValidationError)
    }
    for (const field of ["releaseEligible", "factor", "gwp", "methodHash", "eligibilityResult", "result"]) {
      const candidate = setup() as any
      candidate.sources[0].knownFacts[field] = field === "releaseEligible" ? true : "caller-value"
      expect(() => validateM80Setup(candidate, admission())).toThrow(M80ValidationError)
    }
  })

  test("rejects mismatched, inactive and caller-shaped fixture admissions", () => {
    expect(() => validateM80Setup(setup(), { ...admission(), companyId: OTHER_COMPANY_ID })).toThrow("Fixture admission is not bound to this company.")
    expect(() => validateM80Setup(setup(), { ...admission(), fixtureSha256: "0".repeat(64) })).toThrow("Exact active fixture admission required.")
    expect(() => validateM80Setup(setup(), { ...admission(), active: false })).toThrow("Exact active fixture admission required.")
    const candidate = setup() as any
    candidate.fixtureAdmission = admission()
    expect(() => validateM80Setup(candidate, admission())).toThrow(M80ValidationError)
  })

  test("rejects prototypes, duplicate JSON keys and oversized payloads", () => {
    const polluted = setup()
    Object.setPrototypeOf(polluted.sources[0]!, { releaseEligible: true })
    expect(() => validateM80Setup(polluted, admission())).toThrow("Plain JSON object required.")
    expect(() => parseM80Json('{"companyId":"a","companyId":"b"}')).toThrow(M80ValidationError)
    const oversized = setup() as any
    oversized.untrustedText = "x".repeat(M80_MAX_CANONICAL_BYTES)
    expect(() => validateM80Setup(oversized, admission())).toThrow("M80 setup exceeds the canonical byte limit.")
  })

  test("rejects duplicate IDs, removed rows, bad cross-references and capacity overflow", () => {
    const duplicate = setup()
    duplicate.sources[1]!.sourceId = duplicate.sources[0]!.sourceId
    expect(() => validateM80Setup(duplicate, admission())).toThrow(M80ValidationError)

    const removed = setup()
    removed.sources.pop()
    expect(() => validateM80Setup(removed, admission())).toThrow("Every fixed fixture source must remain visible.")

    const rebound = setup()
    rebound.sources[0]!.locationId = rebound.locations[1]!.locationId
    expect(() => validateM80Setup(rebound, admission())).toThrow("Fixture source identity cannot be rebound or repurposed.")

    const badRequirement = setup()
    badRequirement.evidenceRequirements[0]!.sourceId = badRequirement.sources[1]!.sourceId
    expect(() => validateM80Setup(badRequirement, admission())).toThrow("Evidence requirement cannot be rebound or repurposed.")

    const missingGasGroup = setup()
    missingGasGroup.sources.find((row) => row.category === "process_emissions")!.processScreen!.gasGroups.pop()
    expect(() => validateM80Setup(missingGasGroup, admission())).toThrow("All seven gas groups must remain explicit.")

    const overCapacity = setup()
    overCapacity.sources = Array.from({ length: 41 }, () => structuredClone(overCapacity.sources[0]!))
    expect(() => validateM80Setup(overCapacity, admission())).toThrow("Source-census capacity exceeded.")
  })

  test("keeps unknown eligibility facts and unsupported boundaries explicit", () => {
    const unknown = setup()
    unknown.sources[0]!.knownFacts.activityUnit = "unknown"
    const unknownResult = classifyM80Foundation(unknown, admission(), M80_HELD_REGISTRY).results.find((row) => row.sourceId.endsWith("1001"))!
    expect(unknownResult.state).toBe("missing_facts")
    expect(unknownResult.requiredFactCodes).toEqual(["activity_unit"])

    const boundaryUnknown = setup()
    boundaryUnknown.entities[0]!.controlState = "unknown"
    const boundaryResult = classifyM80Foundation(boundaryUnknown, admission(), M80_HELD_REGISTRY).results.find((row) => row.sourceId.endsWith("1001"))!
    expect(boundaryResult.state).toBe("missing_facts")
    expect(boundaryResult.requiredFactCodes).toContain("entity_control_state")
    const processBoundaryResult = classifyM80Foundation(boundaryUnknown, admission(), M80_HELD_REGISTRY).results.find((row) => row.sourceId.endsWith("1012"))!
    expect(processBoundaryResult.state).toBe("missing_facts")
    expect(processBoundaryResult.blockerCodes).toContain("process_screen_unknowns_preserved")
    expect(processBoundaryResult.requiredFactCodes).toHaveLength(15)
    expect(processBoundaryResult.requiredFactCodes).toContain("entity_control_state")
    expect(processBoundaryResult.requiredFactCodes).toContain("process_category_mineral_products")
    expect(processBoundaryResult.requiredFactCodes).toContain("gas_group_NF3")

    const boundaryOutside = setup()
    boundaryOutside.locations[0]!.activePeriodState = "partial_or_changed"
    const outsideResult = classifyM80Foundation(boundaryOutside, admission(), M80_HELD_REGISTRY).results.find((row) => row.sourceId.endsWith("1001"))!
    expect(outsideResult.state).toBe("unsupported")
    expect(outsideResult.blockerCodes).toContain("location_period_outside_candidate")
  })
})

describe("M80 held registry refusal", () => {
  test("fails closed when the registry is absent, duplicated, corrupt or claims release", () => {
    expect(() => classifyM80Foundation(setup(), admission(), null)).toThrow(M80RegistryError)

    const duplicate = cloneRegistry()
    duplicate[1] = structuredClone(duplicate[0]!)
    expect(() => classifyM80Foundation(setup(), admission(), duplicate)).toThrow(M80RegistryError)

    const corrupt = cloneRegistry()
    corrupt[0]!.methodSha256 = "0".repeat(64)
    expect(() => classifyM80Foundation(setup(), admission(), corrupt)).toThrow(M80RegistryError)

    const released = cloneRegistry() as any
    released[0].status = "released"
    expect(() => classifyM80Foundation(setup(), admission(), released)).toThrow(M80RegistryError)
  })
})
