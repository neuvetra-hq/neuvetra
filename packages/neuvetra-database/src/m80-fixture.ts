import { m71CanonicalJson } from "./m71-validation"
import {
  M80_DATA_CLASSIFICATION,
  M80_FIXTURE_PROFILE,
  M80_FIXTURE_VERSION,
  M80_GAS_GROUPS,
  M80_PERIOD,
  M80_PROCESS_CATEGORIES,
  type M80EvidenceRequirement,
  type M80HeldProfile,
  type M80KnownFacts,
  type M80SetupInput,
  type M80SourceCategory,
  type M80SourceSubtype,
} from "./m80-contract"

export const m80HashCanonical = (value: unknown): string =>
  new Bun.CryptoHasher("sha256").update(m71CanonicalJson(value)).digest("hex")

export interface M80FixtureSourceTemplate {
  sourceId: string
  entityId: string
  locationId: string
  displayLabel: string
  category: M80SourceCategory
  subtype: M80SourceSubtype
  initialFacts: M80KnownFacts
  evidenceRequirements: Omit<M80EvidenceRequirement, "sourceId">[]
  sourceIdentitySha256: string
}

const ENTITY_ID = "80000000-0000-4000-8000-000000000001"
const LOCATION_NORTH_ID = "80000000-0000-4000-8000-000000000101"
const LOCATION_SOUTH_ID = "80000000-0000-4000-8000-000000000102"

const source = (
  sourceId: string,
  locationId: string,
  displayLabel: string,
  category: M80SourceCategory,
  subtype: M80SourceSubtype,
  initialFacts: M80KnownFacts,
  evidenceRequirements: Omit<M80EvidenceRequirement, "sourceId">[],
): M80FixtureSourceTemplate => {
  const identity = { sourceId, entityId: ENTITY_ID, locationId, displayLabel, category, subtype }
  return { ...identity, initialFacts, evidenceRequirements, sourceIdentitySha256: m80HashCanonical(identity) }
}

const req = (
  requirementId: string,
  requirementType: M80EvidenceRequirement["requirementType"],
  fixtureReferenceKey: string,
  state: M80EvidenceRequirement["state"] = "missing",
): Omit<M80EvidenceRequirement, "sourceId"> => ({
  requirementId,
  requirementType,
  coveragePeriod: "calendar_2025_proposed",
  state,
  fixtureReferenceKey,
})

const SOURCE_TEMPLATES: M80FixtureSourceTemplate[] = [
  source("80000000-0000-4000-8000-000000001001", LOCATION_NORTH_ID, "Synthetic stationary natural gas source", "stationary_combustion", "natural_gas", { fuelOrGas: "fossil_natural_gas", equipmentKind: "stationary_other", activityDataKind: "annual_hhv_energy", activityUnit: "MMBtu_HHV" }, [req("80000000-0000-4000-8000-000000002001", "fuel_record", "M80-EVIDENCE-STATIONARY-GAS-01"), req("80000000-0000-4000-8000-000000002002", "meter_summary", "M80-EVIDENCE-STATIONARY-GAS-02")]),
  source("80000000-0000-4000-8000-000000001002", LOCATION_NORTH_ID, "Synthetic emergency generator", "stationary_combustion", "distillate_no2", { fuelOrGas: "fossil_distillate_no2", equipmentKind: "emergency_generator", activityDataKind: "metered_gallons", activityUnit: "US_gallon" }, [req("80000000-0000-4000-8000-000000002003", "fuel_record", "M80-EVIDENCE-STATIONARY-DIESEL-01")]),
  source("80000000-0000-4000-8000-000000001003", LOCATION_SOUTH_ID, "Synthetic controlled diesel fleet", "mobile_combustion", "on_road_vehicle", { fuelOrGas: "fossil_diesel", equipmentKind: "medium_heavy_on_road_2007_2022", activityDataKind: "gallons_and_actual_miles", activityUnit: "US_gallon_and_vehicle_mile" }, [req("80000000-0000-4000-8000-000000002004", "vehicle_register", "M80-EVIDENCE-MOBILE-DIESEL-01"), req("80000000-0000-4000-8000-000000002005", "mileage_evidence", "M80-EVIDENCE-MOBILE-DIESEL-02")]),
  source("80000000-0000-4000-8000-000000001004", LOCATION_NORTH_ID, "Synthetic HFC-134a refrigeration equipment", "fugitive", "refrigeration", { fuelOrGas: "HFC-134a", equipmentKind: "refrigeration", activityDataKind: "service_refill_mass", activityUnit: "kg_named_gas_or_blend" }, [req("80000000-0000-4000-8000-000000002006", "equipment_register", "M80-EVIDENCE-HFC134A-01"), req("80000000-0000-4000-8000-000000002007", "service_record", "M80-EVIDENCE-HFC134A-02")]),
  source("80000000-0000-4000-8000-000000001005", LOCATION_NORTH_ID, "Synthetic R-410A fixed HVAC equipment", "fugitive", "fixed_hvac", { fuelOrGas: "R-410A", equipmentKind: "fixed_hvac", activityDataKind: "service_refill_mass", activityUnit: "kg_named_gas_or_blend" }, [req("80000000-0000-4000-8000-000000002008", "equipment_register", "M80-EVIDENCE-R410A-01"), req("80000000-0000-4000-8000-000000002009", "service_record", "M80-EVIDENCE-R410A-02")]),
  source("80000000-0000-4000-8000-000000001006", LOCATION_SOUTH_ID, "Synthetic HFC-227ea fire suppression equipment", "fugitive", "fire_suppression", { fuelOrGas: "HFC-227ea", equipmentKind: "fire_suppression", activityDataKind: "service_refill_mass", activityUnit: "kg_named_gas_or_blend" }, [req("80000000-0000-4000-8000-000000002010", "equipment_register", "M80-EVIDENCE-HFC227EA-01"), req("80000000-0000-4000-8000-000000002011", "service_record", "M80-EVIDENCE-HFC227EA-02")]),
  source("80000000-0000-4000-8000-000000001007", LOCATION_SOUTH_ID, "Synthetic other-gas refrigeration source", "fugitive", "refrigeration", { fuelOrGas: "other_gas", equipmentKind: "refrigeration", activityDataKind: "service_refill_mass", activityUnit: "kg_named_gas_or_blend" }, [req("80000000-0000-4000-8000-000000002012", "equipment_register", "M80-EVIDENCE-OTHER-REFRIGERANT-01")]),
  source("80000000-0000-4000-8000-000000001008", LOCATION_SOUTH_ID, "Synthetic other-gas fire suppression source", "fugitive", "fire_suppression", { fuelOrGas: "other_gas", equipmentKind: "fire_suppression", activityDataKind: "service_refill_mass", activityUnit: "kg_named_gas_or_blend" }, [req("80000000-0000-4000-8000-000000002013", "equipment_register", "M80-EVIDENCE-OTHER-FIRE-01")]),
  source("80000000-0000-4000-8000-000000001009", LOCATION_NORTH_ID, "Synthetic other stationary fuel source", "stationary_combustion", "other_stationary_fuel", { fuelOrGas: "other_fuel", equipmentKind: "stationary_other", activityDataKind: "metered_gallons", activityUnit: "US_gallon" }, [req("80000000-0000-4000-8000-000000002014", "fuel_record", "M80-EVIDENCE-OTHER-STATIONARY-01")]),
  source("80000000-0000-4000-8000-000000001010", LOCATION_SOUTH_ID, "Synthetic gasoline vehicle source", "mobile_combustion", "on_road_vehicle", { fuelOrGas: "gasoline", equipmentKind: "vehicle_other", activityDataKind: "gallons_and_actual_miles", activityUnit: "US_gallon_and_vehicle_mile" }, [req("80000000-0000-4000-8000-000000002015", "vehicle_register", "M80-EVIDENCE-GASOLINE-01")]),
  source("80000000-0000-4000-8000-000000001011", LOCATION_SOUTH_ID, "Synthetic non-road diesel equipment", "mobile_combustion", "non_road_equipment", { fuelOrGas: "fossil_diesel", equipmentKind: "non_road_equipment", activityDataKind: "metered_gallons", activityUnit: "US_gallon" }, [req("80000000-0000-4000-8000-000000002016", "equipment_register", "M80-EVIDENCE-NONROAD-01")]),
  source("80000000-0000-4000-8000-000000001012", LOCATION_NORTH_ID, "Synthetic process emissions screen", "process_emissions", "process_screen", { fuelOrGas: "not_applicable", equipmentKind: "industrial_process", activityDataKind: "screen_only", activityUnit: "not_applicable" }, [req("80000000-0000-4000-8000-000000002017", "process_screen_attestation", "M80-EVIDENCE-PROCESS-01")]),
  source("80000000-0000-4000-8000-000000001013", LOCATION_NORTH_ID, "Synthetic direct gas release source", "direct_gas_release", "direct_gas", { fuelOrGas: "other_gas", equipmentKind: "other", activityDataKind: "screen_only", activityUnit: "not_applicable" }, [req("80000000-0000-4000-8000-000000002018", "direct_release_record", "M80-EVIDENCE-DIRECT-GAS-01")]),
  source("80000000-0000-4000-8000-000000001014", LOCATION_SOUTH_ID, "Synthetic unclassified direct Scope 1 source", "other_direct_scope1", "other_direct", { fuelOrGas: "unknown", equipmentKind: "unknown", activityDataKind: "unknown", activityUnit: "unknown" }, [req("80000000-0000-4000-8000-000000002019", "source_census_record", "M80-EVIDENCE-UNCLASSIFIED-01", "unknown")]),
]

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
  }
  return value
}

export const M80_FIXTURE = deepFreeze({
  profileId: M80_FIXTURE_PROFILE,
  version: M80_FIXTURE_VERSION,
  displayLabel: "Synthetic Scope 1 foundation company",
  reportingPeriod: M80_PERIOD,
  entityTemplates: [{ entityId: ENTITY_ID, displayLabel: "Synthetic parent entity" }],
  locationTemplates: [
    { locationId: LOCATION_NORTH_ID, entityId: ENTITY_ID, displayLabel: "Synthetic California location north" },
    { locationId: LOCATION_SOUTH_ID, entityId: ENTITY_ID, displayLabel: "Synthetic California location south" },
  ],
  sourceTemplates: SOURCE_TEMPLATES,
} as const)

export const M80_FIXTURE_SHA256 = "2c6a9f78cded2a209bf536969e4ea389baa7fe1633c8ef63fad0c22826f77dc1" as const
if (m80HashCanonical(M80_FIXTURE) !== M80_FIXTURE_SHA256) throw new Error("M80 fixed fixture bytes changed without a new fixture version and reviewed hash.")

export const M80_HELD_REGISTRY: readonly M80HeldProfile[] = deepFreeze([
  { profileId: "stationary_natural_gas_hhv_mmbtu", status: "held_candidate", methodId: "stationary-natural-gas-combustion", methodVersion: "m73-development-v1", methodSha256: "a596ea0d377f33ac34e1333852c313c855c2a18ac08006525a78bbfb7cce9898", engineSha256: "e1b91d4fa6afa1126eeb642769c458d0b0b747c12ad5ee172543afb9246eaa14", factorIdentitySha256: "80da7b01f57c852a1bca9a6f80a23636baef02091cd26880a7395c8331f5a20f", gwpIdentitySha256: "d87fb6c54a170e1dff70327bf475774febb3681a754cb8abec9c4c31efa3b908", sourceArtifactIds: ["epa_hub_2025_xlsx", "epa_hub_2025_pdf", "epa_stationary_guidance_2023_pdf", "ghg_protocol_required_gases_gwp_2013_pdf", "ghg_protocol_corporate_standard_pdf"] },
  { profileId: "controlled_on_road_fossil_diesel_medium_heavy_2007_2022", status: "held_candidate", methodId: "mobile-diesel-combustion", methodVersion: "m74-development-v1", methodSha256: "7598384902729e8a6708beb359e7564f500ad85c0d3ad38f094ee580a05c0497", engineSha256: "1dc0bb7249d91e854004a8cadd34068be3fc03ecdd6e10b4cf297d375d7f52a6", factorIdentitySha256: "416931c40b347f1e22e9d4019ca1c28bd27ce40d7c16a3beeac3dadbbb783187", gwpIdentitySha256: "c151f9b90b23eba7ee9d36dd57a851ecf7a6f200c915579819b683d2b3b3c1c7", sourceArtifactIds: ["epa_hub_2025_xlsx", "epa_hub_2025_pdf", "epa_mobile_guidance_2023_pdf", "ghg_protocol_required_gases_gwp_2013_pdf", "ghg_protocol_corporate_standard_pdf"] },
  { profileId: "stationary_fossil_distillate_no2_emergency_generator_default_hhv", status: "held_candidate", methodId: "m76.stationary-distillate-no2.ca2025.ar5.default-hhv.v1", methodVersion: "m76-development-v1", methodSha256: "8924b6c99a7b2b1525f2f2ef641978bbdfc5c7116c40a9fc828e418e56a4a722", engineSha256: "60de93b901185527affd1eae73d400582cc9d041ecd13bb5668c9041374f6266", factorIdentitySha256: "7f2a655ff2fc3a214f8f076aeaf7acebc25a50f89801985f255157a3ab3a85d0", gwpIdentitySha256: "c151f9b90b23eba7ee9d36dd57a851ecf7a6f200c915579819b683d2b3b3c1c7", sourceArtifactIds: ["epa_hub_2025_xlsx", "epa_hub_2025_pdf", "epa_stationary_guidance_2023_pdf", "ghg_protocol_required_gases_gwp_2013_pdf", "ghg_protocol_corporate_standard_pdf"] },
  { profileId: "stable_serviced_fugitive_equipment", status: "held_candidate", methodId: "m77-stable-serviced-equipment-2025-candidate-v1", methodVersion: null, methodSha256: "acbfed90deaf7c164fe889b87732a998396ace265c92973ba3f79c6a71c038af", engineSha256: "3c81c8d1b4ee6b2435765013d0578021556b70d35f16e4512ebecf1c873f25b4", factorIdentitySha256: "80a514d4596fc214ea3086941b37377f9e939f7541e40590fa4ee243deb1e24d", gwpIdentitySha256: "80a514d4596fc214ea3086941b37377f9e939f7541e40590fa4ee243deb1e24d", sourceArtifactIds: ["epa_hub_2025_xlsx", "epa_hub_2025_pdf", "epa_fugitive_guidance_2023_pdf", "ghg_protocol_required_gases_gwp_2013_pdf", "ghg_protocol_corporate_standard_pdf"] },
])

export function createM80FixtureSetup(companyId: string): M80SetupInput {
  const evidenceRequirements = SOURCE_TEMPLATES.flatMap((template) => template.evidenceRequirements.map((requirement) => ({ ...requirement, sourceId: template.sourceId })))
  return {
    companyId,
    dataClassification: M80_DATA_CLASSIFICATION,
    reportingPeriod: M80_PERIOD,
    consolidationApproach: "operational_control_proposed",
    boundaryProposal: { reportingYearState: "calendar_2025_proposed", jointVentureState: "none_proposed", ownershipChangeState: "none_proposed" },
    entities: M80_FIXTURE.entityTemplates.map(({ entityId }) => ({ entityId, ownershipState: "wholly_owned_proposed", controlState: "operational_control_proposed", activePeriodState: "full_2025_proposed", inclusionState: "included_proposed" })),
    locations: M80_FIXTURE.locationTemplates.map(({ locationId, entityId }) => ({ locationId, entityId, countryCode: "US", regionCode: "CA", controlState: "operational_control_proposed", activePeriodState: "full_2025_proposed", inclusionState: "included_proposed" })),
    sources: SOURCE_TEMPLATES.map((template) => ({
      sourceId: template.sourceId,
      entityId: template.entityId,
      locationId: template.locationId,
      category: template.category,
      subtype: template.subtype,
      knownFacts: { ...template.initialFacts },
      processScreen: template.category === "process_emissions" ? {
        categories: M80_PROCESS_CATEGORIES.map((category) => ({ category, state: "unknown" as const })),
        gasGroups: M80_GAS_GROUPS.map((gasGroup) => ({ gasGroup, state: "unknown" as const })),
      } : null,
      evidenceRequirementIds: template.evidenceRequirements.map((requirement) => requirement.requirementId),
    })),
    evidenceRequirements,
    completeness: "incomplete",
  }
}
