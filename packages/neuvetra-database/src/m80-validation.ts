import { m71CanonicalJson, m71HashString, m71Uuid, parseM71Json } from "./m71-validation"
import {
  M80_ACTIVITY_DATA_KINDS,
  M80_ACTIVITY_UNITS,
  M80_DATA_CLASSIFICATION,
  M80_EQUIPMENT_KINDS,
  M80_EVIDENCE_REQUIREMENT_TYPES,
  M80_FIXTURE_PROFILE,
  M80_FIXTURE_VERSION,
  M80_FUEL_OR_GAS,
  M80_GAS_GROUPS,
  M80_MAX_CANONICAL_BYTES,
  M80_MAX_ENTITIES,
  M80_MAX_EVIDENCE_REQUIREMENTS,
  M80_MAX_LOCATIONS,
  M80_MAX_SOURCES,
  M80_PERIOD,
  M80_PROCESS_CATEGORIES,
  M80_SOURCE_CATEGORIES,
  M80_SOURCE_SUBTYPES,
  type M80EligibilityResult,
  type M80FixtureAdmission,
  type M80FoundationClassification,
  type M80HeldProfile,
  type M80KnownFacts,
  type M80ProfileId,
  type M80SetupInput,
  type M80SourceCensusInput,
  type M80ValidatedSetup,
} from "./m80-contract"
import { M80_FIXTURE, M80_FIXTURE_SHA256, M80_HELD_REGISTRY } from "./m80-fixture"

export class M80ValidationError extends Error {}
export class M80RegistryError extends Error {}

const fail = (message: string): never => { throw new M80ValidationError(message) }
const registryFail = (message = "The held profile registry could not be verified."): never => { throw new M80RegistryError(message) }

function plainRecord(value: unknown, message = "Plain JSON object required."): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) fail(message)
  for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(value))) if (descriptor.get || descriptor.set) fail(message)
}

function assertJsonTree(value: unknown): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return
  if (typeof value === "number") { if (!Number.isFinite(value)) fail("Finite JSON values required."); return }
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype) fail("Plain JSON arrays required.")
    for (const child of value) assertJsonTree(child)
    return
  }
  plainRecord(value)
  for (const child of Object.values(value)) assertJsonTree(child)
}

function keys(value: unknown, expected: readonly string[], message = "Exact M80 field set required."): asserts value is Record<string, unknown> {
  plainRecord(value)
  if (Object.keys(value).sort().join("|") !== [...expected].sort().join("|")) fail(message)
}

function array(value: unknown, maximum: number, message: string): unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > maximum) fail(message)
  return value as unknown[]
}

function exactEnum<T extends string>(value: unknown, allowed: readonly T[], message: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) fail(message)
  return value as T
}

function uuid(value: unknown): string {
  if (!m71Uuid(value)) fail("Lowercase UUID required.")
  return value as string
}

function unique(values: string[], message: string): string[] {
  if (new Set(values).size !== values.length) fail(message)
  return [...values].sort()
}

function exactIds(actual: string[], expected: readonly string[], message: string): void {
  if (actual.length !== expected.length || actual.some((id, index) => id !== [...expected].sort()[index])) fail(message)
}

function validateAdmission(admission: unknown, companyId: string): M80FixtureAdmission {
  assertJsonTree(admission)
  keys(admission, ["companyId", "fixtureProfileId", "fixtureVersion", "fixtureSha256", "active"], "Trusted fixture admission has an invalid shape.")
  if (!m71Uuid(admission.companyId) || admission.companyId !== companyId) fail("Fixture admission is not bound to this company.")
  if (admission.fixtureProfileId !== M80_FIXTURE_PROFILE || admission.fixtureVersion !== M80_FIXTURE_VERSION || admission.fixtureSha256 !== M80_FIXTURE_SHA256 || admission.active !== true) fail("Exact active fixture admission required.")
  return structuredClone(admission) as unknown as M80FixtureAdmission
}

function validateKnownFacts(value: unknown): M80KnownFacts {
  keys(value, ["fuelOrGas", "equipmentKind", "activityDataKind", "activityUnit"])
  return {
    fuelOrGas: exactEnum(value.fuelOrGas, M80_FUEL_OR_GAS, "Closed fuel or gas fact required."),
    equipmentKind: exactEnum(value.equipmentKind, M80_EQUIPMENT_KINDS, "Closed equipment fact required."),
    activityDataKind: exactEnum(value.activityDataKind, M80_ACTIVITY_DATA_KINDS, "Closed activity-data fact required."),
    activityUnit: exactEnum(value.activityUnit, M80_ACTIVITY_UNITS, "Closed activity unit required."),
  }
}

export function parseM80Json(text: string): unknown {
  try { return parseM71Json(text, M80_MAX_CANONICAL_BYTES) }
  catch { fail("Invalid, duplicate-key or oversized M80 JSON.") }
}

/**
 * Validates caller data against a trusted admission supplied by a future server
 * adapter. This function checks context integrity; it does not authenticate a user
 * or authorize a tenant by itself.
 */
export function validateM80Setup(value: unknown, trustedAdmission: unknown): M80ValidatedSetup {
  assertJsonTree(value)
  const bytes = new TextEncoder().encode(m71CanonicalJson(value)).byteLength
  if (bytes > M80_MAX_CANONICAL_BYTES) fail("M80 setup exceeds the canonical byte limit.")
  keys(value, ["companyId", "dataClassification", "reportingPeriod", "consolidationApproach", "boundaryProposal", "entities", "locations", "sources", "evidenceRequirements", "completeness"])
  const companyId = uuid(value.companyId)
  const admission = validateAdmission(trustedAdmission, companyId)
  if (value.dataClassification !== M80_DATA_CLASSIFICATION || value.consolidationApproach !== "operational_control_proposed" || value.completeness !== "incomplete") fail("Exact synthetic incomplete proposal state required.")
  keys(value.reportingPeriod, ["start", "endExclusive"])
  if (m71CanonicalJson(value.reportingPeriod) !== m71CanonicalJson(M80_PERIOD)) fail("Only the proposed full calendar 2025 period is admitted.")
  keys(value.boundaryProposal, ["reportingYearState", "jointVentureState", "ownershipChangeState"])
  if (value.boundaryProposal.reportingYearState !== "calendar_2025_proposed") fail("Calendar 2025 must remain a proposal.")
  exactEnum(value.boundaryProposal.jointVentureState, ["unknown", "none_proposed"], "Closed joint-venture state required.")
  exactEnum(value.boundaryProposal.ownershipChangeState, ["unknown", "none_proposed"], "Closed ownership-change state required.")

  const entities = array(value.entities, M80_MAX_ENTITIES, "Entity capacity exceeded.").map((raw) => {
    keys(raw, ["entityId", "ownershipState", "controlState", "activePeriodState", "inclusionState"])
    return {
      entityId: uuid(raw.entityId),
      ownershipState: exactEnum(raw.ownershipState, ["unknown", "wholly_owned_proposed", "other_structure_proposed"], "Closed ownership proposal required."),
      controlState: exactEnum(raw.controlState, ["unknown", "operational_control_proposed", "not_controlled_proposed"], "Closed entity control proposal required."),
      activePeriodState: exactEnum(raw.activePeriodState, ["unknown", "full_2025_proposed", "partial_or_changed"], "Closed entity period proposal required."),
      inclusionState: exactEnum(raw.inclusionState, ["unknown", "included_proposed", "excluded_proposed"], "Closed entity inclusion proposal required."),
    }
  }).sort((a, b) => a.entityId.localeCompare(b.entityId))
  exactIds(unique(entities.map((row) => row.entityId), "Duplicate entity IDs are not supported."), M80_FIXTURE.entityTemplates.map((row) => row.entityId), "Exact fixture entities must remain present.")

  const locations = array(value.locations, M80_MAX_LOCATIONS, "Location capacity exceeded.").map((raw) => {
    keys(raw, ["locationId", "entityId", "countryCode", "regionCode", "controlState", "activePeriodState", "inclusionState"])
    return {
      locationId: uuid(raw.locationId),
      entityId: uuid(raw.entityId),
      countryCode: exactEnum(raw.countryCode, ["US", "unknown"], "Closed country fact required."),
      regionCode: exactEnum(raw.regionCode, ["CA", "other_us", "unknown"], "Closed region fact required."),
      controlState: exactEnum(raw.controlState, ["unknown", "operational_control_proposed", "not_controlled_proposed"], "Closed location control proposal required."),
      activePeriodState: exactEnum(raw.activePeriodState, ["unknown", "full_2025_proposed", "partial_or_changed"], "Closed location period proposal required."),
      inclusionState: exactEnum(raw.inclusionState, ["unknown", "included_proposed", "excluded_proposed"], "Closed location inclusion proposal required."),
    }
  }).sort((a, b) => a.locationId.localeCompare(b.locationId))
  exactIds(unique(locations.map((row) => row.locationId), "Duplicate location IDs are not supported."), M80_FIXTURE.locationTemplates.map((row) => row.locationId), "Exact fixture locations must remain present.")
  for (const location of locations) {
    const template = M80_FIXTURE.locationTemplates.find((row) => row.locationId === location.locationId)!
    if (location.entityId !== template.entityId || !entities.some((row) => row.entityId === location.entityId)) fail("Fixture location/entity reference mismatch.")
  }

  const evidenceRequirements = array(value.evidenceRequirements, M80_MAX_EVIDENCE_REQUIREMENTS, "Evidence-requirement capacity exceeded.").map((raw) => {
    keys(raw, ["requirementId", "sourceId", "requirementType", "coveragePeriod", "state", "fixtureReferenceKey"])
    const fixtureReferenceKey = exactEnum(raw.fixtureReferenceKey, M80_FIXTURE.sourceTemplates.flatMap((source) => source.evidenceRequirements.map((requirement) => requirement.fixtureReferenceKey)), "Exact fixture evidence reference required.")
    return {
      requirementId: uuid(raw.requirementId),
      sourceId: uuid(raw.sourceId),
      requirementType: exactEnum(raw.requirementType, M80_EVIDENCE_REQUIREMENT_TYPES, "Closed evidence-requirement type required."),
      coveragePeriod: exactEnum(raw.coveragePeriod, ["calendar_2025_proposed"], "Closed evidence coverage required."),
      state: exactEnum(raw.state, ["unknown", "missing", "synthetic_fixture_reference"], "Closed evidence state required."),
      fixtureReferenceKey,
    }
  }).sort((a, b) => a.requirementId.localeCompare(b.requirementId))
  const expectedRequirements = M80_FIXTURE.sourceTemplates.flatMap((source) => source.evidenceRequirements.map((requirement) => ({ ...requirement, sourceId: source.sourceId })))
  exactIds(unique(evidenceRequirements.map((row) => row.requirementId), "Duplicate evidence-requirement IDs are not supported."), expectedRequirements.map((row) => row.requirementId), "Exact fixture evidence requirements must remain present.")
  for (const requirement of evidenceRequirements) {
    const template = expectedRequirements.find((row) => row.requirementId === requirement.requirementId)!
    if (requirement.sourceId !== template.sourceId || requirement.requirementType !== template.requirementType || requirement.fixtureReferenceKey !== template.fixtureReferenceKey) fail("Evidence requirement cannot be rebound or repurposed.")
  }

  const sources = array(value.sources, M80_MAX_SOURCES, "Source-census capacity exceeded.").map((raw): M80SourceCensusInput => {
    keys(raw, ["sourceId", "entityId", "locationId", "category", "subtype", "knownFacts", "processScreen", "evidenceRequirementIds"])
    const sourceId = uuid(raw.sourceId)
    const template = M80_FIXTURE.sourceTemplates.find((row) => row.sourceId === sourceId) ?? fail("Only fixed fixture source identities are admitted.")
    const entityId = uuid(raw.entityId)
    const locationId = uuid(raw.locationId)
    const category = exactEnum(raw.category, M80_SOURCE_CATEGORIES, "Closed Scope 1 category required.")
    const subtype = exactEnum(raw.subtype, M80_SOURCE_SUBTYPES, "Closed Scope 1 subtype required.")
    if (entityId !== template.entityId || locationId !== template.locationId || category !== template.category || subtype !== template.subtype) fail("Fixture source identity cannot be rebound or repurposed.")
    if (!entities.some((row) => row.entityId === entityId) || !locations.some((row) => row.locationId === locationId && row.entityId === entityId)) fail("Source references do not resolve to one fixture entity/location.")
    const evidenceRequirementIds = unique(array(raw.evidenceRequirementIds, 8, "Source evidence-reference capacity exceeded.").map(uuid), "Duplicate source evidence references are not supported.")
    exactIds(evidenceRequirementIds, template.evidenceRequirements.map((row) => row.requirementId), "Source must retain its exact evidence requirements.")
    if (evidenceRequirementIds.some((id) => !evidenceRequirements.some((row) => row.requirementId === id && row.sourceId === sourceId))) fail("Source evidence reference does not resolve.")
    let processScreen: M80SourceCensusInput["processScreen"] = null
    if (category === "process_emissions") {
      keys(raw.processScreen, ["categories", "gasGroups"], "Exact process screen required.")
      const categories = array(raw.processScreen.categories, 7, "Process-category capacity exceeded.").map((entry) => {
        keys(entry, ["category", "state"], "Exact process-category state required.")
        return { category: exactEnum(entry.category, M80_PROCESS_CATEGORIES, "Closed process category required."), state: exactEnum(entry.state, ["unknown", "indicated", "not_applicable_pending_review"], "Closed process-category state required.") }
      }).sort((a, b) => a.category.localeCompare(b.category))
      exactIds(unique(categories.map((entry) => entry.category), "Duplicate process categories are not supported."), M80_PROCESS_CATEGORIES, "All seven process categories must remain explicit.")
      const gasGroups = array(raw.processScreen.gasGroups, 7, "Gas-group capacity exceeded.").map((entry) => {
        keys(entry, ["gasGroup", "state"], "Exact gas-group state required.")
        return { gasGroup: exactEnum(entry.gasGroup, M80_GAS_GROUPS, "Closed gas group required."), state: exactEnum(entry.state, ["unknown", "indicated", "not_applicable_pending_review"], "Closed gas-group state required.") }
      }).sort((a, b) => a.gasGroup.localeCompare(b.gasGroup))
      exactIds(unique(gasGroups.map((entry) => entry.gasGroup), "Duplicate gas groups are not supported."), M80_GAS_GROUPS, "All seven gas groups must remain explicit.")
      processScreen = { categories, gasGroups }
    } else if (raw.processScreen !== null) fail("Only the fixed process source may carry a process screen.")
    return { sourceId, entityId, locationId, category, subtype, knownFacts: validateKnownFacts(raw.knownFacts), processScreen, evidenceRequirementIds }
  }).sort((a, b) => a.sourceId.localeCompare(b.sourceId))
  exactIds(unique(sources.map((row) => row.sourceId), "Duplicate source IDs are not supported."), M80_FIXTURE.sourceTemplates.map((row) => row.sourceId), "Every fixed fixture source must remain visible.")

  const globalIds = [...entities.map((row) => row.entityId), ...locations.map((row) => row.locationId), ...sources.map((row) => row.sourceId), ...evidenceRequirements.map((row) => row.requirementId)]
  unique(globalIds, "Fixture record IDs must be globally unique.")

  const setup: M80ValidatedSetup = {
    companyId,
    dataClassification: M80_DATA_CLASSIFICATION,
    reportingPeriod: M80_PERIOD,
    consolidationApproach: "operational_control_proposed",
    boundaryProposal: structuredClone(value.boundaryProposal) as M80ValidatedSetup["boundaryProposal"],
    entities,
    locations,
    sources: sources.map((row) => ({ ...row, sourceIdentitySha256: M80_FIXTURE.sourceTemplates.find((template) => template.sourceId === row.sourceId)!.sourceIdentitySha256 })),
    evidenceRequirements,
    completeness: "incomplete",
    fixture: { profileId: admission.fixtureProfileId, version: admission.fixtureVersion, sha256: admission.fixtureSha256 },
  }
  if (new TextEncoder().encode(m71CanonicalJson(setup)).byteLength > M80_MAX_CANONICAL_BYTES) fail("Validated M80 setup exceeds the canonical byte limit.")
  return setup
}

function validateHeldRegistry(value: unknown): readonly M80HeldProfile[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length !== M80_HELD_REGISTRY.length) registryFail()
  try { assertJsonTree(value) } catch { registryFail() }
  const rows = (value as unknown[]).map((raw) => {
    try { keys(raw, ["profileId", "status", "methodId", "methodVersion", "methodSha256", "engineSha256", "factorIdentitySha256", "gwpIdentitySha256", "sourceArtifactIds"]) } catch { registryFail() }
    const row = raw as Record<string, unknown>
    if (row.status !== "held_candidate" || typeof row.profileId !== "string" || typeof row.methodId !== "string" || !(row.methodVersion === null || typeof row.methodVersion === "string") || !m71HashString(row.methodSha256) || !m71HashString(row.engineSha256) || !m71HashString(row.factorIdentitySha256) || !m71HashString(row.gwpIdentitySha256)) registryFail()
    if (!Array.isArray(row.sourceArtifactIds) || row.sourceArtifactIds.some((id: unknown) => typeof id !== "string")) registryFail()
    const sourceArtifactIds = row.sourceArtifactIds as string[]
    return { ...row, sourceArtifactIds: [...sourceArtifactIds].sort() } as unknown as M80HeldProfile
  }).sort((a, b) => a.profileId.localeCompare(b.profileId))
  if (new Set(rows.map((row) => row.profileId)).size !== rows.length) registryFail()
  const expected = M80_HELD_REGISTRY.map((row) => ({ ...row, sourceArtifactIds: [...row.sourceArtifactIds].sort() })).sort((a, b) => a.profileId.localeCompare(b.profileId))
  if (m71CanonicalJson(rows) !== m71CanonicalJson(expected)) registryFail()
  return rows
}

function candidateProfile(source: M80SourceCensusInput): M80ProfileId | null {
  const facts = source.knownFacts
  if (source.category === "stationary_combustion" && source.subtype === "natural_gas" && facts.fuelOrGas === "fossil_natural_gas" && facts.equipmentKind === "stationary_other" && facts.activityDataKind === "annual_hhv_energy" && facts.activityUnit === "MMBtu_HHV") return "stationary_natural_gas_hhv_mmbtu"
  if (source.category === "stationary_combustion" && source.subtype === "distillate_no2" && facts.fuelOrGas === "fossil_distillate_no2" && facts.equipmentKind === "emergency_generator" && facts.activityDataKind === "metered_gallons" && facts.activityUnit === "US_gallon") return "stationary_fossil_distillate_no2_emergency_generator_default_hhv"
  if (source.category === "mobile_combustion" && source.subtype === "on_road_vehicle" && facts.fuelOrGas === "fossil_diesel" && facts.equipmentKind === "medium_heavy_on_road_2007_2022" && facts.activityDataKind === "gallons_and_actual_miles" && facts.activityUnit === "US_gallon_and_vehicle_mile") return "controlled_on_road_fossil_diesel_medium_heavy_2007_2022"
  if (source.category === "fugitive" && facts.activityDataKind === "service_refill_mass" && facts.activityUnit === "kg_named_gas_or_blend") {
    if (source.subtype === "refrigeration" && facts.fuelOrGas === "HFC-134a" && facts.equipmentKind === "refrigeration") return "stable_serviced_fugitive_equipment"
    if (source.subtype === "fixed_hvac" && facts.fuelOrGas === "R-410A" && facts.equipmentKind === "fixed_hvac") return "stable_serviced_fugitive_equipment"
    if (source.subtype === "fire_suppression" && facts.fuelOrGas === "HFC-227ea" && facts.equipmentKind === "fire_suppression") return "stable_serviced_fugitive_equipment"
  }
  return null
}

function missingFactCodes(facts: M80KnownFacts): string[] {
  const missing: string[] = []
  if (facts.fuelOrGas === "unknown") missing.push("fuel_or_gas")
  if (facts.equipmentKind === "unknown") missing.push("equipment_kind")
  if (facts.activityDataKind === "unknown") missing.push("activity_data_kind")
  if (facts.activityUnit === "unknown") missing.push("activity_unit")
  return missing
}

function boundaryState(setup: M80ValidatedSetup, source: M80SourceCensusInput): { missing: string[]; unsupported: string[] } {
  const entity = setup.entities.find((row) => row.entityId === source.entityId)!
  const location = setup.locations.find((row) => row.locationId === source.locationId)!
  const missing: string[] = []
  const unsupported: string[] = []
  if (setup.boundaryProposal.jointVentureState === "unknown") missing.push("boundary_joint_venture_state")
  if (setup.boundaryProposal.ownershipChangeState === "unknown") missing.push("boundary_ownership_change_state")
  if (entity.ownershipState === "unknown") missing.push("entity_ownership_state")
  else if (entity.ownershipState !== "wholly_owned_proposed") unsupported.push("entity_ownership_outside_candidate")
  if (entity.controlState === "unknown") missing.push("entity_control_state")
  else if (entity.controlState !== "operational_control_proposed") unsupported.push("entity_control_outside_candidate")
  if (entity.activePeriodState === "unknown") missing.push("entity_active_period_state")
  else if (entity.activePeriodState !== "full_2025_proposed") unsupported.push("entity_period_outside_candidate")
  if (entity.inclusionState === "unknown") missing.push("entity_inclusion_state")
  else if (entity.inclusionState !== "included_proposed") unsupported.push("entity_not_included_in_candidate")
  if (location.countryCode === "unknown") missing.push("location_country")
  if (location.regionCode === "unknown") missing.push("location_region")
  else if (location.regionCode !== "CA") unsupported.push("location_region_outside_candidate")
  if (location.controlState === "unknown") missing.push("location_control_state")
  else if (location.controlState !== "operational_control_proposed") unsupported.push("location_control_outside_candidate")
  if (location.activePeriodState === "unknown") missing.push("location_active_period_state")
  else if (location.activePeriodState !== "full_2025_proposed") unsupported.push("location_period_outside_candidate")
  if (location.inclusionState === "unknown") missing.push("location_inclusion_state")
  else if (location.inclusionState !== "included_proposed") unsupported.push("location_not_included_in_candidate")
  return { missing: [...new Set(missing)].sort(), unsupported: [...new Set(unsupported)].sort() }
}

/** Returns held, unsupported or missing-facts only; this foundation cannot release or calculate. */
export function classifyM80Foundation(value: unknown, trustedAdmission: unknown, heldRegistry: unknown): M80FoundationClassification {
  const setup = validateM80Setup(value, trustedAdmission)
  const registry = validateHeldRegistry(heldRegistry)
  const results: M80EligibilityResult[] = setup.sources.map((source) => {
    const boundary = boundaryState(setup, source)
    const missing = [...new Set([...boundary.missing, ...missingFactCodes(source.knownFacts)])].sort()
    const processUnknowns = source.processScreen === null ? [] : [
      ...source.processScreen.categories.filter((entry) => entry.state === "unknown").map((entry) => `process_category_${entry.category}`),
      ...source.processScreen.gasGroups.filter((entry) => entry.state === "unknown").map((entry) => `gas_group_${entry.gasGroup}`),
    ].sort()
    const evidence = setup.evidenceRequirements.filter((row) => source.evidenceRequirementIds.includes(row.requirementId))
    const evidenceBlockers = evidence.filter((row) => row.state !== "synthetic_fixture_reference").map((row) => row.state === "missing" ? "evidence_missing" : "evidence_state_unknown")
    if (missing.length) return { sourceId: source.sourceId, sourceIdentitySha256: source.sourceIdentitySha256, state: "missing_facts", candidateProfileId: null, blockerCodes: [...new Set(["source_facts_missing", ...(processUnknowns.length ? ["process_screen_unknowns_preserved"] : []), ...evidenceBlockers])].sort(), requiredFactCodes: [...new Set([...missing, ...processUnknowns])].sort(), evidenceRequirementIds: [...source.evidenceRequirementIds] }
    const profileId = candidateProfile(source)
    if (boundary.unsupported.length || !profileId) return { sourceId: source.sourceId, sourceIdentitySha256: source.sourceIdentitySha256, state: "unsupported", candidateProfileId: null, blockerCodes: [...new Set([...(boundary.unsupported.length ? boundary.unsupported : ["no_candidate_profile_matches_known_facts"]), ...(processUnknowns.length ? ["process_screen_unknowns_preserved"] : []), ...evidenceBlockers])].sort(), requiredFactCodes: processUnknowns, evidenceRequirementIds: [...source.evidenceRequirementIds] }
    if (!registry.some((row) => row.profileId === profileId && row.status === "held_candidate")) registryFail()
    return { sourceId: source.sourceId, sourceIdentitySha256: source.sourceIdentitySha256, state: "held_candidate", candidateProfileId: profileId, blockerCodes: [...new Set(["profile_release_held", ...evidenceBlockers])].sort(), requiredFactCodes: [], evidenceRequirementIds: [...source.evidenceRequirementIds] }
  })
  return { profile: M80_FIXTURE_PROFILE, fixtureSha256: M80_FIXTURE_SHA256, dataClassification: M80_DATA_CLASSIFICATION, completeness: "incomplete", releasedSupportedCount: 0, results }
}
