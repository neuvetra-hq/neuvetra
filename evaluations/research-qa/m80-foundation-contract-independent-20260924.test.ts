import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { M80_FIXTURE_PROFILE, M80_FIXTURE_VERSION, M80_MAX_CANONICAL_BYTES } from "../../packages/neuvetra-database/src/m80-contract"
import { createM80FixtureSetup, M80_FIXTURE, M80_FIXTURE_SHA256, M80_HELD_REGISTRY, m80HashCanonical } from "../../packages/neuvetra-database/src/m80-fixture"
import { classifyM80Foundation, parseM80Json, validateM80Setup } from "../../packages/neuvetra-database/src/m80-validation"

// Independent criteria originate in accepted CTO/CPO plans and the M79 inventory.
// These tests do not establish provenance/authentication of the context argument.
const COMPANY = "80000000-0000-4000-8000-000000009901"
const FOREIGN = "80000000-0000-4000-8000-000000009902"
const setup = () => structuredClone(createM80FixtureSetup(COMPANY))
const admission = () => ({ companyId: COMPANY, fixtureProfileId: M80_FIXTURE_PROFILE, fixtureVersion: M80_FIXTURE_VERSION, fixtureSha256: M80_FIXTURE_SHA256, active: true })
const classify = (value: unknown = setup(), context: unknown = admission(), registry: unknown = M80_HELD_REGISTRY) => classifyM80Foundation(value, context, registry)
const sourceSuffix = (n: number) => `80000000-0000-4000-8000-${String(1000 + n).padStart(12, "0")}`
const bySource = (n: number, value: unknown = setup()) => classify(value).results.find((row) => row.sourceId === sourceSuffix(n))!
const canonical = (value: unknown): string => Array.isArray(value) ? `[${value.map(canonical).join(",")}]` : value && typeof value === "object" ? `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(",")}}` : JSON.stringify(value)
const reverseKeys = (value: unknown): unknown => Array.isArray(value) ? value.map(reverseKeys) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).reverse().map(([k, v]) => [k, reverseKeys(v)])) : value
function objectPaths(value: unknown, prefix: (string | number)[] = []): (string | number)[][] {
  if (!value || typeof value !== "object") return []
  return [...(Array.isArray(value) ? [] : [prefix]), ...Object.entries(value).flatMap(([k, v]) => objectPaths(v, [...prefix, Array.isArray(value) ? Number(k) : k]))]
}
function at(root: any, path: (string | number)[]) { return path.reduce((value, key) => value[key], root) }

describe("M80 independently challenged offline contract", () => {
  test("trusted argument integrity and client/context separation", () => {
    for (const context of [null, {}, { ...admission(), active: false }, { ...admission(), active: "true" }, { ...admission(), companyId: FOREIGN }, { ...admission(), fixtureVersion: 2 }, { ...admission(), fixtureProfileId: "synthetic" }, { ...admission(), fixtureSha256: "0".repeat(64) }, { ...admission(), released: true }]) expect(() => classify(setup(), context)).toThrow()
    for (const field of ["trustedAdmission", "fixture", "releaseEligible", "released_supported", "factor", "gwp", "methodSha256", "calculation", "export", "document", "contact", "description", "filename", "url", "bytes", "base64"]) expect(() => classify({ ...setup(), [field]: admission() })).toThrow()
    const other = setup(); other.companyId = FOREIGN
    expect(() => classify(other)).toThrow()
    // A matching caller-constructed context is intentionally NOT authentication.
    expect(classify(other, { ...admission(), companyId: FOREIGN }).releasedSupportedCount).toBe(0)
  })

  test("closed object schemas refuse an added authority key at every object boundary", () => {
    for (const path of objectPaths(setup())) {
      const value = setup(); at(value, path).releaseEligible = true
      expect(() => classify(value)).toThrow()
    }
  })

  test("raw JSON duplicate/escaped keys, prototype fields, malformed and oversize inputs fail", () => {
    const raw = JSON.stringify(setup())
    const cases = [raw.replace('"companyId":', '"companyId":"x","companyId":'), raw.replace('"companyId":', '"company\\u0049d":"x","companyId":'), raw.replace('"fuelOrGas":', '"fuelOrGas":"other_gas","fuelOrGas":'), '{"__proto__":{}}', '{"constructor":{}}', raw.slice(0, -1), `[${" ".repeat(M80_MAX_CANONICAL_BYTES)}]`]
    for (const text of cases) expect(() => classify(parseM80Json(text))).toThrow()
    expect(classify(parseM80Json(raw)).releasedSupportedCount).toBe(0)
  })

  test("object prototypes and accessors are refused without executing an accessor", () => {
    const inherited = Object.assign(Object.create({ releaseEligible: true }), setup())
    expect(() => classify(inherited)).toThrow()
    let read = false; const value = setup()
    Object.defineProperty(value.sources[0].knownFacts, "fuelOrGas", { enumerable: true, get() { read = true; return "fossil_natural_gas" } })
    expect(() => classify(value)).toThrow(); expect(read).toBe(false)
    for (const replacement of [null, [], new Date(), "synthetic", 1, NaN]) expect(() => classify(replacement)).toThrow()
  })

  test("full census cannot be deleted, duplicated, rebound or given arbitrary new identities", () => {
    for (const name of ["entities", "locations", "sources", "evidenceRequirements"] as const) {
      const missing = setup(); missing[name].pop(); expect(() => classify(missing)).toThrow()
      const duplicate = setup(); (duplicate[name] as any[]).push(structuredClone(duplicate[name][0])); expect(() => classify(duplicate)).toThrow()
      const excess = setup(); (excess as any)[name] = Array.from({ length: 101 }, () => structuredClone(excess[name][0])); expect(() => classify(excess)).toThrow()
    }
    for (const change of [
      (v: any) => v.locations[0].entityId = FOREIGN,
      (v: any) => v.sources[0].entityId = FOREIGN,
      (v: any) => v.sources[0].locationId = v.locations[1].locationId,
      (v: any) => v.sources[0].sourceId = FOREIGN,
      (v: any) => v.sources[0].category = "other_direct_scope1",
      (v: any) => v.evidenceRequirements[0].sourceId = v.sources[1].sourceId,
      (v: any) => v.evidenceRequirements[0].fixtureReferenceKey = v.evidenceRequirements[1].fixtureReferenceKey,
      (v: any) => v.sources[0].evidenceRequirementIds = v.sources[1].evidenceRequirementIds,
      (v: any) => v.sources[0].evidenceRequirementIds.push(v.sources[0].evidenceRequirementIds[0]),
    ]) { const value = setup(); change(value); expect(() => classify(value)).toThrow() }
  })

  test("independent initial expectations retain every source and classify all four M79 families held", () => {
    const out = classify()
    expect(out.results.length).toBe(setup().sources.length)
    for (const n of [1, 2, 3, 4, 5, 6]) { expect(bySource(n).state).toBe("held_candidate"); expect(bySource(n).blockerCodes).toContain("profile_release_held") }
    for (const n of [7, 8, 9, 10, 11, 13]) expect(bySource(n).state).toBe("unsupported")
    expect(bySource(14).state).toBe("missing_facts")
    expect(bySource(14).requiredFactCodes.sort()).toEqual(["activity_data_kind", "activity_unit", "equipment_kind", "fuel_or_gas"])
    expect(new Set(out.results.filter((r) => r.state === "held_candidate").map((r) => r.candidateProfileId)).size).toBe(4)
    expect(out.releasedSupportedCount).toBe(0); expect(out.completeness).toBe("incomplete")
    expect(out.results.some((r) => (r.state as string) === "released_supported")).toBe(false)
  })

  test("each missing known fact is named and unsupported substitutions never become held", () => {
    for (const key of ["fuelOrGas", "equipmentKind", "activityDataKind", "activityUnit"] as const) {
      const value = setup(); value.sources[0].knownFacts[key] = "unknown"
      expect(bySource(1, value).state).toBe("missing_facts"); expect(bySource(1, value).requiredFactCodes.length).toBe(1)
    }
    for (const [index, key, replacement] of [[0, "activityUnit", "US_gallon"], [1, "fuelOrGas", "renewable_diesel"], [2, "equipmentKind", "non_road_equipment"], [2, "activityDataKind", "metered_gallons"], [3, "fuelOrGas", "R-410A"], [4, "fuelOrGas", "HFC-134a"], [5, "fuelOrGas", "other_gas"]] as const) {
      const value = setup(); (value.sources[index].knownFacts as any)[key] = replacement
      expect(bySource(index + 1, value).state).toBe("unsupported")
    }
  })

  test("every unknown boundary fact survives and blocks matching; exclusion does not erase a source", () => {
    const original = setup()
    const paths = [...Object.keys(original.entities[0]).filter((k) => k !== "entityId").map((k) => ["entities", 0, k]), ...Object.keys(original.locations[0]).filter((k) => !["locationId", "entityId"].includes(k)).map((k) => ["locations", 0, k]), ["boundaryProposal", "jointVentureState"], ["boundaryProposal", "ownershipChangeState"]] as (string | number)[][]
    for (const path of paths) {
      const value = setup(); at(value, path.slice(0, -1))[path.at(-1)!] = "unknown"
      expect(bySource(1, value).state).toBe("missing_facts"); expect(bySource(1, value).requiredFactCodes.length).toBeGreaterThan(0)
      expect(classify(value).results.length).toBe(original.sources.length)
    }
    const excluded = setup(); excluded.locations[0].inclusionState = "excluded_proposed"
    expect(bySource(1, excluded).state).toBe("unsupported"); expect(classify(excluded).results.length).toBe(original.sources.length)
  })

  test("evidence is metadata only and completed synthetic references do not release a profile", () => {
    const value = setup()
    for (const evidence of value.evidenceRequirements) evidence.state = "synthetic_fixture_reference"
    expect(bySource(1, value).state).toBe("held_candidate"); expect(bySource(1, value).blockerCodes).toContain("profile_release_held")
    for (const field of ["issuer", "filename", "contact", "url", "description", "bytes", "base64", "text"]) {
      const bad = setup(); (bad.evidenceRequirements[0] as any)[field] = "SYNTHETIC-UNTRUSTED-SENTINEL"
      let message = ""; try { classify(bad) } catch (error) { message = String(error) }
      expect(message.length).toBeGreaterThan(0); expect(message).not.toContain("SYNTHETIC-UNTRUSTED-SENTINEL")
    }
  })

  test("all seven process and gas screens remain explicit and composed missing facts retain every unknown", () => {
    const categories = ["mineral_products", "chemical_production", "metal_production", "oil_and_gas", "waste_treatment", "agricultural_biological", "other_direct_process"]
    const gases = ["CO2", "CH4", "N2O", "HFCs", "PFCs", "SF6", "NF3"]
    const value = setup(), screen = value.sources.find((s) => s.sourceId === sourceSuffix(12))!.processScreen!
    expect(screen.categories.map((r) => r.category).sort()).toEqual(categories.sort())
    expect(screen.gasGroups.map((r) => r.gasGroup).sort()).toEqual(gases.sort())
    expect([...screen.categories, ...screen.gasGroups].every((r) => r.state === "unknown")).toBe(true)
    const expectedCodes = [...categories.map((s) => `process_category_${s}`), ...gases.map((s) => `gas_group_${s}`)]
    for (const code of expectedCodes) expect(bySource(12, value).requiredFactCodes).toContain(code)
    // A second missing fact must not erase the first fourteen named unknowns.
    value.entities[0].controlState = "unknown"
    const composed = bySource(12, value)
    expect(composed.state).toBe("missing_facts")
    for (const code of [...expectedCodes, "entity_control_state"]) expect(composed.requiredFactCodes).toContain(code)
    const composedSource = setup(); composedSource.sources.find((s) => s.sourceId === sourceSuffix(12))!.knownFacts.activityDataKind = "unknown"
    for (const code of [...expectedCodes, "activity_data_kind"]) expect(bySource(12, composedSource).requiredFactCodes).toContain(code)
    for (const collection of ["categories", "gasGroups"] as const) {
      const missing = setup(); missing.sources.find((s) => s.sourceId === sourceSuffix(12))!.processScreen![collection].pop()
      expect(() => classify(missing)).toThrow()
      const duplicate = setup(); const list = duplicate.sources.find((s) => s.sourceId === sourceSuffix(12))!.processScreen![collection] as any[]
      list[1] = structuredClone(list[0]); expect(() => classify(duplicate)).toThrow()
    }
  })

  test("closed registry refuses changed authority, missing/duplicate rows and coordinated identities", () => {
    for (const registry of [null, [], [...M80_HELD_REGISTRY, M80_HELD_REGISTRY[0]], M80_HELD_REGISTRY.slice(1), M80_HELD_REGISTRY.map(() => M80_HELD_REGISTRY[0])]) expect(() => classify(setup(), admission(), registry)).toThrow()
    for (const [key, value] of [["status", "released"], ["status", "superseded"], ["engineSha256", "0".repeat(64)], ["factorIdentitySha256", "0".repeat(64)], ["effectiveDate", "2025-01-01"], ["expiresAt", "2024-12-31"], ["releaseEligible", true]] as const) {
      const registry: any = structuredClone(M80_HELD_REGISTRY); registry[0][key] = value
      expect(() => classify(setup(), admission(), registry)).toThrow()
    }
    const coordinated: any = structuredClone(M80_HELD_REGISTRY)
    for (const row of coordinated) { row.methodSha256 = "0".repeat(64); row.engineSha256 = "0".repeat(64); row.factorIdentitySha256 = "0".repeat(64); row.gwpIdentitySha256 = "0".repeat(64) }
    expect(() => classify(setup(), admission(), coordinated)).toThrow()
  })

  test("registry profile and method hashes match independently read M79 inventory", () => {
    const inventory = JSON.parse(readFileSync("docs/research/m79-method-source-inventory.json", "utf8"))
    expect(M80_HELD_REGISTRY.map((r) => r.profileId).sort()).toEqual(inventory.profiles.map((p: any) => p.profileId).sort())
    for (const held of M80_HELD_REGISTRY) {
      const profile = inventory.profiles.find((p: any) => p.profileId === held.profileId)
      expect(held.methodSha256).toBe(profile.methodIdentity.methodSha256); expect(held.engineSha256).toBe(profile.methodIdentity.engineSha256)
      expect(held.methodId).toBe(profile.methodIdentity.id); expect(held.methodVersion).toBe(profile.methodIdentity.version)
      expect(held.factorIdentitySha256).toBe(profile.methodIdentity.factorSha256 ?? profile.methodIdentity.factorGwpDescriptorSha256)
      expect(held.gwpIdentitySha256).toBe(profile.methodIdentity.gwpSha256 ?? profile.methodIdentity.factorGwpDescriptorSha256)
      expect([...held.sourceArtifactIds].sort()).toEqual([...profile.sourceArtifacts].sort())
      expect(held.status).toBe("held_candidate")
    }
  })

  test("canonical identity and output ignore harmless ordering and never alias mutable input", () => {
    const value = setup(), expected = validateM80Setup(value, admission())
    const reordered = reverseKeys(value) as ReturnType<typeof setup>
    reordered.sources.reverse(); reordered.locations.reverse(); reordered.evidenceRequirements.reverse()
    for (const source of reordered.sources) source.evidenceRequirementIds.reverse()
    for (const source of reordered.sources) { source.processScreen?.categories.reverse(); source.processScreen?.gasGroups.reverse() }
    expect(validateM80Setup(reordered, admission())).toEqual(expected); expect(classify(reordered)).toEqual(classify(value))
    const reorderedRegistry = structuredClone(M80_HELD_REGISTRY).reverse()
    for (const row of reorderedRegistry) row.sourceArtifactIds.reverse()
    expect(classify(value, admission(), reorderedRegistry)).toEqual(classify(value))
    expect(M80_FIXTURE_SHA256).toBe(createHash("sha256").update(canonical(M80_FIXTURE)).digest("hex"))
    expect(m80HashCanonical(reverseKeys(M80_FIXTURE))).toBe(M80_FIXTURE_SHA256)
    value.sources[0].knownFacts.fuelOrGas = "unknown"; value.sources[0].evidenceRequirementIds.pop()
    expect(expected.sources[0].knownFacts.fuelOrGas).toBe("fossil_natural_gas"); expect(expected.sources[0].evidenceRequirementIds.length).toBe(2)
    expect(Object.isFrozen(M80_FIXTURE)).toBe(true); expect(Object.isFrozen(M80_FIXTURE.sourceTemplates[0].initialFacts)).toBe(true); expect(Object.isFrozen(M80_HELD_REGISTRY[0].sourceArtifactIds)).toBe(true)
  })

  test("no released/numerical/customer-completeness payload is returned", () => {
    const out = classify()
    expect(Object.keys(out).sort()).toEqual(["profile", "fixtureSha256", "dataClassification", "completeness", "releasedSupportedCount", "results"].sort())
    for (const row of out.results) expect(Object.keys(row).sort()).toEqual(["sourceId", "sourceIdentitySha256", "state", "candidateProfileId", "blockerCodes", "requiredFactCodes", "evidenceRequirementIds"].sort())
    const value = setup()
    expect(value.boundaryProposal.reportingYearState).toBe("calendar_2025_proposed"); expect(value.consolidationApproach).toBe("operational_control_proposed")
    for (const field of ["complete", "released", "real_customer"]) expect(() => classify({ ...value, completeness: field })).toThrow()
  })
})
