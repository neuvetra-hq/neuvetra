/**
 * Pure synthetic M80 foundation contract.
 *
 * This contract has no calculation or release authority. The first slice accepts
 * only an operator-admitted fixed fixture and every current method profile is held.
 */
export const M80_FIXTURE_PROFILE = "m80-synthetic-scope1-foundation-v1" as const
export const M80_FIXTURE_VERSION = 1 as const
export const M80_DATA_CLASSIFICATION = "synthetic_rehearsal" as const
export const M80_PERIOD = { start: "2025-01-01", endExclusive: "2026-01-01" } as const
export const M80_MAX_CANONICAL_BYTES = 50_000
export const M80_MAX_ENTITIES = 3
export const M80_MAX_LOCATIONS = 8
export const M80_MAX_SOURCES = 40
export const M80_MAX_EVIDENCE_REQUIREMENTS = 100

export const M80_SOURCE_CATEGORIES = [
  "stationary_combustion",
  "mobile_combustion",
  "fugitive",
  "process_emissions",
  "direct_gas_release",
  "other_direct_scope1",
] as const

export const M80_SOURCE_SUBTYPES = [
  "natural_gas",
  "distillate_no2",
  "other_stationary_fuel",
  "on_road_vehicle",
  "non_road_equipment",
  "refrigeration",
  "fixed_hvac",
  "fire_suppression",
  "other_fugitive",
  "process_screen",
  "direct_gas",
  "other_direct",
] as const

export const M80_FUEL_OR_GAS = [
  "fossil_natural_gas",
  "fossil_distillate_no2",
  "fossil_diesel",
  "gasoline",
  "propane_lpg",
  "renewable_diesel",
  "other_fuel",
  "HFC-134a",
  "HFC-227ea",
  "R-410A",
  "other_gas",
  "not_applicable",
  "unknown",
] as const

export const M80_EQUIPMENT_KINDS = [
  "stationary_other",
  "emergency_generator",
  "medium_heavy_on_road_2007_2022",
  "vehicle_other",
  "non_road_equipment",
  "refrigeration",
  "fixed_hvac",
  "fire_suppression",
  "industrial_process",
  "other",
  "unknown",
] as const

export const M80_ACTIVITY_DATA_KINDS = [
  "annual_hhv_energy",
  "metered_gallons",
  "gallons_and_actual_miles",
  "service_refill_mass",
  "screen_only",
  "unknown",
] as const

export const M80_ACTIVITY_UNITS = [
  "MMBtu_HHV",
  "US_gallon",
  "US_gallon_and_vehicle_mile",
  "kg_named_gas_or_blend",
  "not_applicable",
  "unknown",
] as const

export const M80_EVIDENCE_REQUIREMENT_TYPES = [
  "fuel_record",
  "meter_summary",
  "vehicle_register",
  "mileage_evidence",
  "equipment_register",
  "service_record",
  "process_screen_attestation",
  "direct_release_record",
  "source_census_record",
] as const

export const M80_PROFILE_IDS = [
  "stationary_natural_gas_hhv_mmbtu",
  "controlled_on_road_fossil_diesel_medium_heavy_2007_2022",
  "stationary_fossil_distillate_no2_emergency_generator_default_hhv",
  "stable_serviced_fugitive_equipment",
] as const

export const M80_PROCESS_CATEGORIES = [
  "mineral_products",
  "chemical_production",
  "metal_production",
  "oil_and_gas",
  "waste_treatment",
  "agricultural_biological",
  "other_direct_process",
] as const

export const M80_GAS_GROUPS = ["CO2", "CH4", "N2O", "HFCs", "PFCs", "SF6", "NF3"] as const

export type M80SourceCategory = typeof M80_SOURCE_CATEGORIES[number]
export type M80SourceSubtype = typeof M80_SOURCE_SUBTYPES[number]
export type M80FuelOrGas = typeof M80_FUEL_OR_GAS[number]
export type M80EquipmentKind = typeof M80_EQUIPMENT_KINDS[number]
export type M80ActivityDataKind = typeof M80_ACTIVITY_DATA_KINDS[number]
export type M80ActivityUnit = typeof M80_ACTIVITY_UNITS[number]
export type M80EvidenceRequirementType = typeof M80_EVIDENCE_REQUIREMENT_TYPES[number]
export type M80ProfileId = typeof M80_PROFILE_IDS[number]
export type M80ProcessCategory = typeof M80_PROCESS_CATEGORIES[number]
export type M80GasGroup = typeof M80_GAS_GROUPS[number]

export interface M80EntityProposal {
  entityId: string
  ownershipState: "unknown" | "wholly_owned_proposed" | "other_structure_proposed"
  controlState: "unknown" | "operational_control_proposed" | "not_controlled_proposed"
  activePeriodState: "unknown" | "full_2025_proposed" | "partial_or_changed"
  inclusionState: "unknown" | "included_proposed" | "excluded_proposed"
}

export interface M80LocationProposal {
  locationId: string
  entityId: string
  countryCode: "US" | "unknown"
  regionCode: "CA" | "other_us" | "unknown"
  controlState: "unknown" | "operational_control_proposed" | "not_controlled_proposed"
  activePeriodState: "unknown" | "full_2025_proposed" | "partial_or_changed"
  inclusionState: "unknown" | "included_proposed" | "excluded_proposed"
}

export interface M80KnownFacts {
  fuelOrGas: M80FuelOrGas
  equipmentKind: M80EquipmentKind
  activityDataKind: M80ActivityDataKind
  activityUnit: M80ActivityUnit
}

export interface M80ProcessScreen {
  categories: { category: M80ProcessCategory; state: "unknown" | "indicated" | "not_applicable_pending_review" }[]
  gasGroups: { gasGroup: M80GasGroup; state: "unknown" | "indicated" | "not_applicable_pending_review" }[]
}

export interface M80SourceCensusInput {
  sourceId: string
  entityId: string
  locationId: string
  category: M80SourceCategory
  subtype: M80SourceSubtype
  knownFacts: M80KnownFacts
  processScreen: M80ProcessScreen | null
  evidenceRequirementIds: string[]
}

export interface M80EvidenceRequirement {
  requirementId: string
  sourceId: string
  requirementType: M80EvidenceRequirementType
  coveragePeriod: "calendar_2025_proposed"
  state: "unknown" | "missing" | "synthetic_fixture_reference"
  fixtureReferenceKey: string
}

export interface M80SetupInput {
  companyId: string
  dataClassification: typeof M80_DATA_CLASSIFICATION
  reportingPeriod: typeof M80_PERIOD
  consolidationApproach: "operational_control_proposed"
  boundaryProposal: {
    reportingYearState: "calendar_2025_proposed"
    jointVentureState: "unknown" | "none_proposed"
    ownershipChangeState: "unknown" | "none_proposed"
  }
  entities: M80EntityProposal[]
  locations: M80LocationProposal[]
  sources: M80SourceCensusInput[]
  evidenceRequirements: M80EvidenceRequirement[]
  completeness: "incomplete"
}

export interface M80FixtureAdmission {
  companyId: string
  fixtureProfileId: typeof M80_FIXTURE_PROFILE
  fixtureVersion: typeof M80_FIXTURE_VERSION
  fixtureSha256: string
  active: boolean
}

export interface M80ValidatedSource extends M80SourceCensusInput {
  sourceIdentitySha256: string
}

export interface M80ValidatedSetup extends Omit<M80SetupInput, "sources"> {
  fixture: {
    profileId: typeof M80_FIXTURE_PROFILE
    version: typeof M80_FIXTURE_VERSION
    sha256: string
  }
  sources: M80ValidatedSource[]
}

export interface M80HeldProfile {
  profileId: M80ProfileId
  status: "held_candidate"
  methodId: string
  methodVersion: string | null
  methodSha256: string
  engineSha256: string
  factorIdentitySha256: string
  gwpIdentitySha256: string
  sourceArtifactIds: string[]
}

export type M80EligibilityState = "released_supported" | "held_candidate" | "unsupported" | "missing_facts"
export type M80FoundationEligibilityState = Exclude<M80EligibilityState, "released_supported">

export interface M80EligibilityResult {
  sourceId: string
  sourceIdentitySha256: string
  state: M80FoundationEligibilityState
  candidateProfileId: M80ProfileId | null
  blockerCodes: string[]
  requiredFactCodes: string[]
  evidenceRequirementIds: string[]
}

export interface M80FoundationClassification {
  profile: typeof M80_FIXTURE_PROFILE
  fixtureSha256: string
  dataClassification: typeof M80_DATA_CLASSIFICATION
  completeness: "incomplete"
  releasedSupportedCount: 0
  results: M80EligibilityResult[]
}
