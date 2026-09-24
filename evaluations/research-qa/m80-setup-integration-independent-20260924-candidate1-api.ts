import type {
  M80EvidenceRequirement,
  M80FixtureAdmission,
  M80FoundationClassification,
  M80HeldProfile,
  M80ValidatedSetup,
} from "../../../../packages/neuvetra-database/src/m80-contract"
import type { HostedWorkspaceActor } from "./workspace-api"

export interface M80BetaSetupVersion {
  id: string; companyId: string; reportingYear: 2025; revision: number; previousVersionId: string | null; previousVersionSha256: string | null
  setup: M80ValidatedSetup; payloadSha256: string; versionSha256: string; createdBy: string; createdAt: string
}
export type M80BetaVersionSummary = Omit<M80BetaSetupVersion, "setup">
export interface M80FoundationView {
  profile: "m80-scope1-beta-foundation-runtime-v1"; syntheticOnly: true; canManage: boolean; fixtureAdmission: M80FixtureAdmission; releaseRegistry: M80HeldProfile[]
  currentVersion: M80BetaSetupVersion | null; history: M80BetaVersionSummary[]; setup: M80ValidatedSetup; eligibility: M80FoundationClassification
}
export interface M80SaveSetupInput { idempotencyKey: string; expectedRevision: number; expectedVersionId: string | null; expectedVersionSha256: string | null; correctionReason: null | "synthetic_fact_correction"; setup: unknown }
export interface M80SaveSetupResult { foundation: M80FoundationView; savedVersion: M80BetaSetupVersion; replayed: boolean }

const RUNTIME_PROFILE = "m80-scope1-beta-foundation-runtime-v1"
const FIXTURE_PROFILE = "m80-synthetic-scope1-foundation-v1"
const FIXTURE_SHA256 = "2c6a9f78cded2a209bf536969e4ea389baa7fe1633c8ef63fad0c22826f77dc1"
const ENTITY_ID = "80000000-0000-4000-8000-000000000001"

export const M80_LOCATION_LABELS: ReadonlyMap<string, string> = new Map([
  ["80000000-0000-4000-8000-000000000101", "Synthetic location north"],
  ["80000000-0000-4000-8000-000000000102", "Synthetic location south"],
] as const)

const sourceMetadata = [
  ["80000000-0000-4000-8000-000000001001", "Synthetic stationary natural gas source", "stationary_combustion", "natural_gas", ["80000000-0000-4000-8000-000000002001", "80000000-0000-4000-8000-000000002002"]],
  ["80000000-0000-4000-8000-000000001002", "Synthetic emergency generator", "stationary_combustion", "distillate_no2", ["80000000-0000-4000-8000-000000002003"]],
  ["80000000-0000-4000-8000-000000001003", "Synthetic controlled diesel fleet", "mobile_combustion", "on_road_vehicle", ["80000000-0000-4000-8000-000000002004", "80000000-0000-4000-8000-000000002005"]],
  ["80000000-0000-4000-8000-000000001004", "Synthetic HFC-134a refrigeration equipment", "fugitive", "refrigeration", ["80000000-0000-4000-8000-000000002006", "80000000-0000-4000-8000-000000002007"]],
  ["80000000-0000-4000-8000-000000001005", "Synthetic R-410A fixed HVAC equipment", "fugitive", "fixed_hvac", ["80000000-0000-4000-8000-000000002008", "80000000-0000-4000-8000-000000002009"]],
  ["80000000-0000-4000-8000-000000001006", "Synthetic HFC-227ea fire suppression equipment", "fugitive", "fire_suppression", ["80000000-0000-4000-8000-000000002010", "80000000-0000-4000-8000-000000002011"]],
  ["80000000-0000-4000-8000-000000001007", "Synthetic other-gas refrigeration source", "fugitive", "refrigeration", ["80000000-0000-4000-8000-000000002012"]],
  ["80000000-0000-4000-8000-000000001008", "Synthetic other-gas fire suppression source", "fugitive", "fire_suppression", ["80000000-0000-4000-8000-000000002013"]],
  ["80000000-0000-4000-8000-000000001009", "Synthetic other stationary fuel source", "stationary_combustion", "other_stationary_fuel", ["80000000-0000-4000-8000-000000002014"]],
  ["80000000-0000-4000-8000-000000001010", "Synthetic gasoline vehicle source", "mobile_combustion", "on_road_vehicle", ["80000000-0000-4000-8000-000000002015"]],
  ["80000000-0000-4000-8000-000000001011", "Synthetic non-road diesel equipment", "mobile_combustion", "non_road_equipment", ["80000000-0000-4000-8000-000000002016"]],
  ["80000000-0000-4000-8000-000000001012", "Synthetic process emissions screen", "process_emissions", "process_screen", ["80000000-0000-4000-8000-000000002017"]],
  ["80000000-0000-4000-8000-000000001013", "Synthetic direct gas release source", "direct_gas_release", "direct_gas", ["80000000-0000-4000-8000-000000002018"]],
  ["80000000-0000-4000-8000-000000001014", "Synthetic unclassified direct Scope 1 source", "other_direct_scope1", "other_direct", ["80000000-0000-4000-8000-000000002019"]],
] as const

export const M80_SOURCE_LABELS: ReadonlyMap<string, string> = new Map(sourceMetadata.map(([id, label]) => [id, label]))
const PROCESS_CATEGORIES = ["agricultural_biological", "chemical_production", "metal_production", "mineral_products", "oil_and_gas", "other_direct_process", "waste_treatment"] as const
const GAS_GROUPS = ["CH4", "CO2", "HFCs", "N2O", "NF3", "PFCs", "SF6"] as const
const SOURCE_IDENTITY_HASHES = ["eaba061b17daf18ef95b8398781221bf9539eef99019bec8cae69af0c373040f", "ae7447e27b9a17a1328426d457f2cbd399337c1430bcb6770f9ccf9394f000cf", "f2ed90361f0bef91ca92ce196622ee5962f29ac30d42ba57b96317188bef5a37", "7a6df5e6a17c4473fcaaf552131bd2b38b0ce8057c58cb78986eb560cafacd9d", "91a4e1743591221a5490589166aef71191be3df91874f74f5f71ca714576787b", "d0fa1bf63c640f94a6dde7c5d929c25c8f483d11738de1f4d777d750cff06786", "38a544dccc26219685c81d6ad894c6b7e8e35f19a433552ef43c61a0cc140e68", "a50dfa0aaf318d462265f4f6f654cc0fab5a6f904ae4d1ac558eea05f75af143", "9e06174ed25c4319f9e4cff0088f9338f2402d4399a218bc38ac18d6749c7ffc", "cd641a48f0e1d011c0154e6c200af2b0af15212fc1bfad4a13ef8448035d181f", "a230ecd36d2a2efb44e7c525507a76d6b33d92257c1db4f82d48edb02bf71387", "ed7f1467128c732d5636cf7df86f10fb3a190a5f8a3f06d59e06b862c835a90c", "5c7d359d407e8eef497aad68cb0664993923d940e98d0f98d23518f132baa489", "7e5ed9490901650161073829706ccd80375453e347a600d785196fe5f64c5ae8"] as const
const EVIDENCE_METADATA = [
  ["fuel_record", "M80-EVIDENCE-STATIONARY-GAS-01"], ["meter_summary", "M80-EVIDENCE-STATIONARY-GAS-02"], ["fuel_record", "M80-EVIDENCE-STATIONARY-DIESEL-01"],
  ["vehicle_register", "M80-EVIDENCE-MOBILE-DIESEL-01"], ["mileage_evidence", "M80-EVIDENCE-MOBILE-DIESEL-02"], ["equipment_register", "M80-EVIDENCE-HFC134A-01"],
  ["service_record", "M80-EVIDENCE-HFC134A-02"], ["equipment_register", "M80-EVIDENCE-R410A-01"], ["service_record", "M80-EVIDENCE-R410A-02"],
  ["equipment_register", "M80-EVIDENCE-HFC227EA-01"], ["service_record", "M80-EVIDENCE-HFC227EA-02"], ["equipment_register", "M80-EVIDENCE-OTHER-REFRIGERANT-01"],
  ["equipment_register", "M80-EVIDENCE-OTHER-FIRE-01"], ["fuel_record", "M80-EVIDENCE-OTHER-STATIONARY-01"], ["vehicle_register", "M80-EVIDENCE-GASOLINE-01"],
  ["equipment_register", "M80-EVIDENCE-NONROAD-01"], ["process_screen_attestation", "M80-EVIDENCE-PROCESS-01"], ["direct_release_record", "M80-EVIDENCE-DIRECT-GAS-01"],
  ["source_census_record", "M80-EVIDENCE-UNCLASSIFIED-01"],
] as const
const RELEASE_PROFILES = ["controlled_on_road_fossil_diesel_medium_heavy_2007_2022", "stable_serviced_fugitive_equipment", "stationary_fossil_distillate_no2_emergency_generator_default_hhv", "stationary_natural_gas_hhv_mmbtu"] as const
const RELEASE_AUTHORITY: Record<typeof RELEASE_PROFILES[number], { methodId: string; methodVersion: string | null; hashes: readonly [string, string, string, string]; sources: readonly string[] }> = {
  controlled_on_road_fossil_diesel_medium_heavy_2007_2022: { methodId: "mobile-diesel-combustion", methodVersion: "m74-development-v1", hashes: ["7598384902729e8a6708beb359e7564f500ad85c0d3ad38f094ee580a05c0497", "1dc0bb7249d91e854004a8cadd34068be3fc03ecdd6e10b4cf297d375d7f52a6", "416931c40b347f1e22e9d4019ca1c28bd27ce40d7c16a3beeac3dadbbb783187", "c151f9b90b23eba7ee9d36dd57a851ecf7a6f200c915579819b683d2b3b3c1c7"], sources: ["epa_hub_2025_xlsx", "epa_hub_2025_pdf", "epa_mobile_guidance_2023_pdf", "ghg_protocol_required_gases_gwp_2013_pdf", "ghg_protocol_corporate_standard_pdf"] },
  stable_serviced_fugitive_equipment: { methodId: "m77-stable-serviced-equipment-2025-candidate-v1", methodVersion: null, hashes: ["acbfed90deaf7c164fe889b87732a998396ace265c92973ba3f79c6a71c038af", "3c81c8d1b4ee6b2435765013d0578021556b70d35f16e4512ebecf1c873f25b4", "80a514d4596fc214ea3086941b37377f9e939f7541e40590fa4ee243deb1e24d", "80a514d4596fc214ea3086941b37377f9e939f7541e40590fa4ee243deb1e24d"], sources: ["epa_hub_2025_xlsx", "epa_hub_2025_pdf", "epa_fugitive_guidance_2023_pdf", "ghg_protocol_required_gases_gwp_2013_pdf", "ghg_protocol_corporate_standard_pdf"] },
  stationary_fossil_distillate_no2_emergency_generator_default_hhv: { methodId: "m76.stationary-distillate-no2.ca2025.ar5.default-hhv.v1", methodVersion: "m76-development-v1", hashes: ["8924b6c99a7b2b1525f2f2ef641978bbdfc5c7116c40a9fc828e418e56a4a722", "60de93b901185527affd1eae73d400582cc9d041ecd13bb5668c9041374f6266", "7f2a655ff2fc3a214f8f076aeaf7acebc25a50f89801985f255157a3ab3a85d0", "c151f9b90b23eba7ee9d36dd57a851ecf7a6f200c915579819b683d2b3b3c1c7"], sources: ["epa_hub_2025_xlsx", "epa_hub_2025_pdf", "epa_stationary_guidance_2023_pdf", "ghg_protocol_required_gases_gwp_2013_pdf", "ghg_protocol_corporate_standard_pdf"] },
  stationary_natural_gas_hhv_mmbtu: { methodId: "stationary-natural-gas-combustion", methodVersion: "m73-development-v1", hashes: ["a596ea0d377f33ac34e1333852c313c855c2a18ac08006525a78bbfb7cce9898", "e1b91d4fa6afa1126eeb642769c458d0b0b747c12ad5ee172543afb9246eaa14", "80da7b01f57c852a1bca9a6f80a23636baef02091cd26880a7395c8331f5a20f", "d87fb6c54a170e1dff70327bf475774febb3681a754cb8abec9c4c31efa3b908"], sources: ["epa_hub_2025_xlsx", "epa_hub_2025_pdf", "epa_stationary_guidance_2023_pdf", "ghg_protocol_required_gases_gwp_2013_pdf", "ghg_protocol_corporate_standard_pdf"] },
}
const HASH = /^[0-9a-f]{64}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const CODE = /^[A-Za-z0-9_]+$/

const sets = {
  ownership: new Set(["unknown", "wholly_owned_proposed", "other_structure_proposed"]),
  control: new Set(["unknown", "operational_control_proposed", "not_controlled_proposed"]),
  active: new Set(["unknown", "full_2025_proposed", "partial_or_changed"]),
  inclusion: new Set(["unknown", "included_proposed", "excluded_proposed"]),
  fuel: new Set(["fossil_natural_gas", "fossil_distillate_no2", "fossil_diesel", "gasoline", "propane_lpg", "renewable_diesel", "other_fuel", "HFC-134a", "HFC-227ea", "R-410A", "other_gas", "not_applicable", "unknown"]),
  equipment: new Set(["stationary_other", "emergency_generator", "medium_heavy_on_road_2007_2022", "vehicle_other", "non_road_equipment", "refrigeration", "fixed_hvac", "fire_suppression", "industrial_process", "other", "unknown"]),
  activity: new Set(["annual_hhv_energy", "metered_gallons", "gallons_and_actual_miles", "service_refill_mass", "screen_only", "unknown"]),
  unit: new Set(["MMBtu_HHV", "US_gallon", "US_gallon_and_vehicle_mile", "kg_named_gas_or_blend", "not_applicable", "unknown"]),
  evidenceType: new Set(["fuel_record", "meter_summary", "vehicle_register", "mileage_evidence", "equipment_register", "service_record", "process_screen_attestation", "direct_release_record", "source_census_record"]),
  evidenceState: new Set(["unknown", "missing", "synthetic_fixture_reference"]),
  screenState: new Set(["unknown", "indicated", "not_applicable_pending_review"]),
}

function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype }
function keys(value: Record<string, unknown>, expected: readonly string[]) { return Object.keys(value).sort().join("|") === [...expected].sort().join("|") }
function fail(): never { throw new Error("The Scope 1 setup response was not recognized.") }
function arrayOfCodes(value: unknown): value is string[] { return Array.isArray(value) && value.every(item => typeof item === "string" && CODE.test(item)) && new Set(value).size === value.length }
function instant(value: unknown): value is string { return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) }
function exactArray(value: unknown, expected: readonly string[]) { return Array.isArray(value) && value.length === expected.length && value.every((item, index) => item === expected[index]) }
function canonical(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value)
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`
  if (object(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`
  throw new Error("Unsupported canonical value.")
}
async function sha256(value: unknown) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical(value)))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("")
}

function decodeSetup(value: unknown, companyId: string): M80ValidatedSetup {
  if (!object(value) || !keys(value, ["companyId", "dataClassification", "reportingPeriod", "consolidationApproach", "boundaryProposal", "entities", "locations", "sources", "evidenceRequirements", "completeness", "fixture"]) || value.companyId !== companyId || value.dataClassification !== "synthetic_rehearsal" || value.consolidationApproach !== "operational_control_proposed" || value.completeness !== "incomplete") fail()
  const period = value.reportingPeriod, boundary = value.boundaryProposal, fixture = value.fixture
  if (!object(period) || !keys(period, ["start", "endExclusive"]) || period.start !== "2025-01-01" || period.endExclusive !== "2026-01-01") fail()
  if (!object(boundary) || !keys(boundary, ["reportingYearState", "jointVentureState", "ownershipChangeState"]) || boundary.reportingYearState !== "calendar_2025_proposed" || !["unknown", "none_proposed"].includes(String(boundary.jointVentureState)) || !["unknown", "none_proposed"].includes(String(boundary.ownershipChangeState))) fail()
  if (!object(fixture) || !keys(fixture, ["profileId", "version", "sha256"]) || fixture.profileId !== FIXTURE_PROFILE || fixture.version !== 1 || fixture.sha256 !== FIXTURE_SHA256) fail()
  if (!Array.isArray(value.entities) || value.entities.length !== 1) fail()
  const entity = value.entities[0]
  if (!object(entity) || !keys(entity, ["entityId", "ownershipState", "controlState", "activePeriodState", "inclusionState"]) || entity.entityId !== ENTITY_ID || !sets.ownership.has(String(entity.ownershipState)) || !sets.control.has(String(entity.controlState)) || !sets.active.has(String(entity.activePeriodState)) || !sets.inclusion.has(String(entity.inclusionState))) fail()
  if (!Array.isArray(value.locations) || value.locations.length !== 2) fail()
  for (const [index, locationId] of [...M80_LOCATION_LABELS.keys()].entries()) {
    const location = value.locations[index]
    if (!object(location) || !keys(location, ["locationId", "entityId", "countryCode", "regionCode", "controlState", "activePeriodState", "inclusionState"]) || location.locationId !== locationId || location.entityId !== ENTITY_ID || !["US", "unknown"].includes(String(location.countryCode)) || !["CA", "other_us", "unknown"].includes(String(location.regionCode)) || !sets.control.has(String(location.controlState)) || !sets.active.has(String(location.activePeriodState)) || !sets.inclusion.has(String(location.inclusionState))) fail()
  }
  if (!Array.isArray(value.sources) || value.sources.length !== sourceMetadata.length) fail()
  for (const [index, [sourceId, , category, subtype, requirementIds]] of sourceMetadata.entries()) {
    const source = value.sources[index]
    if (!object(source) || !keys(source, ["sourceId", "entityId", "locationId", "category", "subtype", "knownFacts", "processScreen", "evidenceRequirementIds", "sourceIdentitySha256"]) || source.sourceId !== sourceId || source.entityId !== ENTITY_ID || !M80_LOCATION_LABELS.has(String(source.locationId)) || source.category !== category || source.subtype !== subtype || !exactArray(source.evidenceRequirementIds, requirementIds) || source.sourceIdentitySha256 !== SOURCE_IDENTITY_HASHES[index]) fail()
    const facts = source.knownFacts
    if (!object(facts) || !keys(facts, ["fuelOrGas", "equipmentKind", "activityDataKind", "activityUnit"]) || !sets.fuel.has(String(facts.fuelOrGas)) || !sets.equipment.has(String(facts.equipmentKind)) || !sets.activity.has(String(facts.activityDataKind)) || !sets.unit.has(String(facts.activityUnit))) fail()
    if (category === "process_emissions") {
      const screen = source.processScreen
      if (!object(screen) || !keys(screen, ["categories", "gasGroups"]) || !Array.isArray(screen.categories) || !Array.isArray(screen.gasGroups) || screen.categories.length !== 7 || screen.gasGroups.length !== 7) fail()
      screen.categories.forEach((row, rowIndex) => { if (!object(row) || !keys(row, ["category", "state"]) || row.category !== PROCESS_CATEGORIES[rowIndex] || !sets.screenState.has(String(row.state))) fail() })
      screen.gasGroups.forEach((row, rowIndex) => { if (!object(row) || !keys(row, ["gasGroup", "state"]) || row.gasGroup !== GAS_GROUPS[rowIndex] || !sets.screenState.has(String(row.state))) fail() })
    } else if (source.processScreen !== null) fail()
  }
  const expectedEvidence = sourceMetadata.flatMap(([sourceId, , , , requirementIds]) => requirementIds.map(requirementId => ({ sourceId, requirementId })))
  if (!Array.isArray(value.evidenceRequirements) || value.evidenceRequirements.length !== 19) fail()
  value.evidenceRequirements.forEach((requirement, index) => {
    const expected = expectedEvidence[index]!
    const metadata = EVIDENCE_METADATA[index]!
    if (!object(requirement) || !keys(requirement, ["requirementId", "sourceId", "requirementType", "coveragePeriod", "state", "fixtureReferenceKey"]) || requirement.requirementId !== expected.requirementId || requirement.sourceId !== expected.sourceId || requirement.requirementType !== metadata[0] || requirement.fixtureReferenceKey !== metadata[1] || requirement.coveragePeriod !== "calendar_2025_proposed" || !sets.evidenceState.has(String(requirement.state))) fail()
  })
  return value as unknown as M80ValidatedSetup
}

function persistedSetup(setup: M80ValidatedSetup) {
  const root = structuredClone(setup) as unknown as Record<string, unknown>
  delete root.fixture
  const sources = (root.sources as Array<Record<string, unknown>>).map(source => {
    const row = { ...source }
    delete row.sourceIdentitySha256
    return row
  })
  return { ...root, sources }
}

async function decodeVersion(value: unknown, companyId: string): Promise<M80BetaSetupVersion> {
  if (!object(value) || !keys(value, ["id", "companyId", "reportingYear", "revision", "previousVersionId", "previousVersionSha256", "setup", "payloadSha256", "versionSha256", "createdBy", "createdAt"]) || typeof value.id !== "string" || !UUID.test(value.id) || value.companyId !== companyId || value.reportingYear !== 2025 || !Number.isSafeInteger(value.revision) || Number(value.revision) < 1 || typeof value.createdBy !== "string" || !UUID.test(value.createdBy) || !instant(value.createdAt) || typeof value.payloadSha256 !== "string" || !HASH.test(value.payloadSha256) || typeof value.versionSha256 !== "string" || !HASH.test(value.versionSha256)) fail()
  if ((value.previousVersionId !== null && (typeof value.previousVersionId !== "string" || !UUID.test(value.previousVersionId))) || (value.previousVersionSha256 !== null && (typeof value.previousVersionSha256 !== "string" || !HASH.test(value.previousVersionSha256)))) fail()
  const setup = decodeSetup(value.setup, companyId)
  if (await sha256(persistedSetup(setup)) !== value.payloadSha256) fail()
  const hashPayload = { profile: RUNTIME_PROFILE, id: value.id, companyId, reportingYear: 2025, revision: value.revision, previousVersionId: value.previousVersionId, previousVersionSha256: value.previousVersionSha256, fixtureProfileId: FIXTURE_PROFILE, fixtureVersion: 1, fixtureSha256: FIXTURE_SHA256, payloadSha256: value.payloadSha256, createdBy: value.createdBy, createdAt: value.createdAt, dataClassification: "synthetic_rehearsal", completeness: "incomplete", releasedSupportedCount: 0 }
  if (await sha256(hashPayload) !== value.versionSha256) fail()
  return { ...value, setup } as unknown as M80BetaSetupVersion
}

function decodeSummary(value: unknown, companyId: string): M80BetaVersionSummary {
  if (!object(value) || !keys(value, ["id", "companyId", "reportingYear", "revision", "previousVersionId", "previousVersionSha256", "payloadSha256", "versionSha256", "createdBy", "createdAt"]) || typeof value.id !== "string" || !UUID.test(value.id) || value.companyId !== companyId || value.reportingYear !== 2025 || !Number.isSafeInteger(value.revision) || Number(value.revision) < 1 || typeof value.createdBy !== "string" || !UUID.test(value.createdBy) || !instant(value.createdAt) || typeof value.payloadSha256 !== "string" || !HASH.test(value.payloadSha256) || typeof value.versionSha256 !== "string" || !HASH.test(value.versionSha256)) fail()
  if ((value.previousVersionId !== null && (typeof value.previousVersionId !== "string" || !UUID.test(value.previousVersionId))) || (value.previousVersionSha256 !== null && (typeof value.previousVersionSha256 !== "string" || !HASH.test(value.previousVersionSha256)))) fail()
  return value as unknown as M80BetaVersionSummary
}

export async function decodeM80Foundation(value: unknown, companyId: string): Promise<M80FoundationView> {
  if (!object(value) || !keys(value, ["profile", "syntheticOnly", "canManage", "fixtureAdmission", "releaseRegistry", "currentVersion", "history", "setup", "eligibility"]) || value.profile !== RUNTIME_PROFILE || value.syntheticOnly !== true || typeof value.canManage !== "boolean") fail()
  const admission = value.fixtureAdmission
  if (!object(admission) || !keys(admission, ["companyId", "fixtureProfileId", "fixtureVersion", "fixtureSha256", "active"]) || admission.companyId !== companyId || admission.fixtureProfileId !== FIXTURE_PROFILE || admission.fixtureVersion !== 1 || admission.fixtureSha256 !== FIXTURE_SHA256 || admission.active !== true) fail()
  if (!Array.isArray(value.releaseRegistry) || value.releaseRegistry.length !== 4) fail()
  const observedProfiles: string[] = []
  for (const release of value.releaseRegistry) {
    if (!object(release) || !keys(release, ["profileId", "status", "methodId", "methodVersion", "methodSha256", "engineSha256", "factorIdentitySha256", "gwpIdentitySha256", "sourceArtifactIds"]) || !RELEASE_PROFILES.includes(release.profileId as never) || release.status !== "held_candidate" || typeof release.methodId !== "string" || !release.methodId || (release.methodVersion !== null && typeof release.methodVersion !== "string") || ![release.methodSha256, release.engineSha256, release.factorIdentitySha256, release.gwpIdentitySha256].every(hash => typeof hash === "string" && HASH.test(hash)) || !Array.isArray(release.sourceArtifactIds) || release.sourceArtifactIds.length === 0 || !release.sourceArtifactIds.every(id => typeof id === "string" && CODE.test(id))) fail()
    const authority = RELEASE_AUTHORITY[release.profileId as typeof RELEASE_PROFILES[number]]
    if (!authority || release.methodId !== authority.methodId || release.methodVersion !== authority.methodVersion || !exactArray([release.methodSha256, release.engineSha256, release.factorIdentitySha256, release.gwpIdentitySha256], authority.hashes) || !exactArray(release.sourceArtifactIds, authority.sources)) fail()
    observedProfiles.push(release.profileId as string)
  }
  if (observedProfiles.sort().join("|") !== [...RELEASE_PROFILES].sort().join("|")) fail()
  const setup = decodeSetup(value.setup, companyId)
  const eligibility = value.eligibility
  if (!object(eligibility) || !keys(eligibility, ["profile", "fixtureSha256", "dataClassification", "completeness", "releasedSupportedCount", "results"]) || eligibility.profile !== FIXTURE_PROFILE || eligibility.fixtureSha256 !== FIXTURE_SHA256 || eligibility.dataClassification !== "synthetic_rehearsal" || eligibility.completeness !== "incomplete" || eligibility.releasedSupportedCount !== 0 || !Array.isArray(eligibility.results) || eligibility.results.length !== 14) fail()
  eligibility.results.forEach((result, index) => {
    const source = setup.sources[index]!, expected = sourceMetadata[index]!
    if (!object(result) || !keys(result, ["sourceId", "sourceIdentitySha256", "state", "candidateProfileId", "blockerCodes", "requiredFactCodes", "evidenceRequirementIds"]) || result.sourceId !== expected[0] || result.sourceIdentitySha256 !== source.sourceIdentitySha256 || !["held_candidate", "unsupported", "missing_facts"].includes(String(result.state)) || (result.candidateProfileId !== null && !RELEASE_PROFILES.includes(result.candidateProfileId as never)) || !arrayOfCodes(result.blockerCodes) || !arrayOfCodes(result.requiredFactCodes) || !exactArray(result.evidenceRequirementIds, expected[4])) fail()
  })
  const currentVersion = value.currentVersion === null ? null : await decodeVersion(value.currentVersion, companyId)
  if (!Array.isArray(value.history)) fail()
  const history = value.history.map(item => decodeSummary(item, companyId))
  history.forEach((item, index) => {
    const prior = history[index - 1]
    if (item.revision !== index + 1 || item.previousVersionId !== (prior?.id ?? null) || item.previousVersionSha256 !== (prior?.versionSha256 ?? null)) fail()
  })
  const head = history.length ? history[history.length - 1]! : null
  if ((currentVersion === null) !== (head === null) || (currentVersion && (!head || currentVersion.id !== head.id || currentVersion.versionSha256 !== head.versionSha256 || canonical(currentVersion.setup) !== canonical(setup)))) fail()
  return { ...value, setup, currentVersion, history, eligibility } as unknown as M80FoundationView
}

export async function decodeM80Version(value: unknown, companyId: string, expectedVersionId?: string) {
  const version = await decodeVersion(value, companyId)
  if (expectedVersionId && version.id !== expectedVersionId) fail()
  return version
}

export class M80ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code: string | null) { super(message) }
  get conflict() { return this.status === 409 }
}

const RESPONSE_LIMIT = 250_000
async function boundedText(response: Response) {
  const declared = Number(response.headers.get("content-length"))
  if (Number.isFinite(declared) && declared > RESPONSE_LIMIT) throw new Error("The Scope 1 setup response was too large.")
  if (!response.body) return ""
  const reader = response.body.getReader(), decoder = new TextDecoder("utf-8", { fatal: true })
  let bytes = 0, text = ""
  while (true) {
    const part = await reader.read()
    if (part.done) break
    bytes += part.value.byteLength
    if (bytes > RESPONSE_LIMIT) { await reader.cancel(); throw new Error("The Scope 1 setup response was too large.") }
    text += decoder.decode(part.value, { stream: true })
  }
  return text + decoder.decode()
}
function parseBoundedJson(text: string): unknown {
  let index = 0
  const failJson = (): never => { throw new Error("The Scope 1 setup response was not recognized.") }
  const whitespace = () => { while (/\s/.test(text[index] ?? "") && index < text.length) index += 1 }
  const string = () => { const start = index++; while (index < text.length) { if (text[index] === "\\") { index += 2; continue } if (text[index++] === '"') return JSON.parse(text.slice(start, index)) as string } return failJson() }
  const scan = (): void => {
    whitespace()
    if (text[index] === "{") {
      index += 1; const observed = new Set<string>(); whitespace(); if (text[index] === "}") { index += 1; return }
      while (index < text.length) { whitespace(); if (text[index] !== '"') failJson(); const key = string(); if (observed.has(key)) failJson(); observed.add(key); whitespace(); if (text[index++] !== ":") failJson(); scan(); whitespace(); const end = text[index++]; if (end === "}") return; if (end !== ",") failJson() }
    } else if (text[index] === "[") {
      index += 1; whitespace(); if (text[index] === "]") { index += 1; return }
      while (index < text.length) { scan(); whitespace(); const end = text[index++]; if (end === "]") return; if (end !== ",") failJson() }
    } else if (text[index] === '"') string()
    else { const start = index; while (index < text.length && !/[\s,}\]]/.test(text[index]!)) index += 1; if (start === index) failJson(); JSON.parse(text.slice(start, index)) }
  }
  try { scan(); whitespace(); if (index !== text.length) failJson(); return JSON.parse(text) as unknown } catch { return failJson() }
}
async function body(response: Response) {
  let value: unknown = null
  try { value = parseBoundedJson(await boundedText(response)) } catch (error) { if (response.ok) throw error }
  if (!response.ok) {
    const message = object(value) && typeof value.error === "string" ? value.error : "The Scope 1 setup is unavailable."
    const code = object(value) && typeof value.code === "string" ? value.code : null
    throw new M80ApiError(message, response.status, code)
  }
  return value
}
function headers(actor: HostedWorkspaceActor, json = false) {
  actor.signal?.throwIfAborted()
  if (!actor.accessToken || /[\r\n]/.test(actor.accessToken)) throw new Error("Sign in again to continue.")
  const result = new Headers({ authorization: `Bearer ${actor.accessToken}` })
  if (json) result.set("content-type", "application/json")
  return result
}
async function request(actor: HostedWorkspaceActor, url: string, init: RequestInit, fetcher: typeof fetch) {
  const response = await fetcher(url, { ...init, signal: actor.signal })
  actor.signal?.throwIfAborted()
  if (response.status === 401 || response.status === 403) actor.onUnauthorized?.()
  return response
}

export async function loadM80Foundation(companyId: string, actor: HostedWorkspaceActor, fetcher: typeof fetch = fetch) {
  const result = await decodeM80Foundation(await body(await request(actor, `/workspace-api/workspace/${companyId}/scope1-beta-setup`, { headers: headers(actor) }, fetcher)), companyId)
  actor.signal?.throwIfAborted()
  return result
}
export async function loadM80Version(companyId: string, versionId: string, actor: HostedWorkspaceActor, fetcher: typeof fetch = fetch) {
  const result = await decodeM80Version(await body(await request(actor, `/workspace-api/workspace/${companyId}/scope1-beta-setup/versions/${versionId}`, { headers: headers(actor) }, fetcher)), companyId, versionId)
  actor.signal?.throwIfAborted()
  return result
}

export interface M80SaveAttempt { idempotencyKey: string; request: M80SaveSetupInput }
export function createM80SaveAttempt(foundation: M80FoundationView, setup: M80ValidatedSetup, idempotencyKey = crypto.randomUUID()): M80SaveAttempt {
  const current = foundation.currentVersion
  return { idempotencyKey, request: { idempotencyKey, expectedRevision: current?.revision ?? 0, expectedVersionId: current?.id ?? null, expectedVersionSha256: current?.versionSha256 ?? null, correctionReason: current ? "synthetic_fact_correction" : null, setup: persistedSetup(setup) } }
}

export async function saveM80Foundation(companyId: string, attempt: M80SaveAttempt, actor: HostedWorkspaceActor, fetcher: typeof fetch = fetch): Promise<M80SaveSetupResult> {
  const raw = await body(await request(actor, `/workspace-api/workspace/${companyId}/scope1-beta-setup`, { method: "POST", headers: headers(actor, true), body: JSON.stringify(attempt.request) }, fetcher))
  if (!object(raw) || !keys(raw, ["foundation", "savedVersion", "replayed"]) || typeof raw.replayed !== "boolean") fail()
  const foundation = await decodeM80Foundation(raw.foundation, companyId)
  const savedVersion = await decodeM80Version(raw.savedVersion, companyId)
  const summary = foundation.history.find(item => item.id === savedVersion.id)
  if (!summary || summary.versionSha256 !== savedVersion.versionSha256 || savedVersion.createdBy !== actor.userId || savedVersion.revision !== attempt.request.expectedRevision + 1 || savedVersion.previousVersionId !== attempt.request.expectedVersionId || savedVersion.previousVersionSha256 !== attempt.request.expectedVersionSha256 || canonical(persistedSetup(savedVersion.setup)) !== canonical(attempt.request.setup) || (!raw.replayed && foundation.currentVersion?.id !== savedVersion.id)) fail()
  actor.signal?.throwIfAborted()
  return { foundation, savedVersion, replayed: raw.replayed }
}

export function cloneM80Setup(setup: M80ValidatedSetup): M80ValidatedSetup { return structuredClone(setup) }
export function updateM80Evidence(setup: M80ValidatedSetup, requirementId: string, state: M80EvidenceRequirement["state"]): M80ValidatedSetup {
  const next = cloneM80Setup(setup), requirement = next.evidenceRequirements.find(item => item.requirementId === requirementId)
  if (!requirement) throw new Error("Evidence requirement not found.")
  requirement.state = state
  return next
}
