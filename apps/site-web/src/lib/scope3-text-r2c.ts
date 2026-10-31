/**
 * Round 2c integration (Claude, 31 October 2026): the new user-facing texts for the six items lane D's first-time walk left
 * out of its scope (log R2-polish.md, "Out of my scope" 1, 2, 4, 6, 7). New file, so no shipped text changes (ROUND2 text
 * rule): the shipped amount label and the shared contract's estimate-basis message stay as they are; these are shown only on
 * the Scope 3 forms and screens that need them.
 */

/**
 * (1) The amount field of the four 0029 Scope 3 forms at schema 30, named by what the chosen unit measures. The shipped
 * label ("Amount (distance, or mass of waste)") stays for a schema-29 server; it called hotel room-nights and freight
 * ton-miles a distance or a mass.
 */
const AMOUNT_BY_UNIT: Readonly<Record<string, string>> = {
  "room-night": "Room-nights",
  "mile": "Distance of one flight (one way)",
  "km": "Distance of one flight (one way)",
  "passenger-mile": "Passenger distance (passenger-miles or passenger-km)",
  "passenger-km": "Passenger distance (passenger-miles or passenger-km)",
  "vehicle-mile": "Vehicle distance (vehicle-miles or vehicle-km)",
  "vehicle-km": "Vehicle distance (vehicle-miles or vehicle-km)",
  "short ton-mile": "Freight moved (weight × distance)",
  "tonne-km": "Freight moved (weight × distance)",
  "short_ton": "Mass of waste",
  "metric_ton": "Mass of waste",
  "kg": "Mass of waste",
  "lb": "Mass of waste",
}
/** When the unit is not one the method takes (written under "Another unit"), the kind says what the amount is. */
const AMOUNT_BY_KIND: Readonly<Record<string, string>> = {
  transport: "Amount moved (vehicle distance, or weight × distance)",
  waste: "Mass of waste",
  business_travel: "Distance travelled, or room-nights for a hotel stay",
  employee_commuting: "Distance travelled",
}
/** `mode` is business travel's (air by flight distance is "air"; the amount is then one flight's distance). */
export function scope3AmountLabelR2C(kind: string, unit: string, mode = ""): string {
  const byKind = AMOUNT_BY_KIND[kind] ?? "Amount"
  const byUnit = AMOUNT_BY_UNIT[unit]
  if (!byUnit) return byKind
  // A mass is only a waste amount; a plain mile or km only an air trip's flight distance.
  if (byUnit === AMOUNT_BY_UNIT.kg) return kind === "waste" ? byUnit : byKind
  if (unit === "mile" || unit === "km") return kind === "business_travel" && mode === "air" ? byUnit : byKind
  return byUnit
}

/**
 * (2) An estimated record without a basis. The shared contract's message ("Only estimated records carry an estimate
 * basis.") is shipped and also guards the API; on the Scope 3 forms the save-problems list says what to do instead.
 */
export const SAVE_TEXT_R2C = {
  estimateBasisMissing: "Say how this estimate was made: fill in “How was this estimate made?” (or choose Actual or Unknown).",
} as const

/**
 * (4) The spend import's two dollar figures on one stated basis. The file and import totals are net (a credit or refund
 * line is subtracted); the mapping progress counts purchases only (a credit is held and never mapped), so it says so and
 * shows the credits and the net beside it.
 */
export const SPEND_BASIS_TEXT_R2C = {
  totalsNet: "Totals, net of credits",
  basisLine: (currency: string, purchases: string, credits: string, net: string, creditLines: number) =>
    `${currency}: purchases ${purchases} − credits ${credits} (${creditLines} line${creditLines === 1 ? "" : "s"}) = net ${net}`,
  fileTotalNet: "File total (net of credits)",
  importedTotalNet: "Imported total (net of credits)",
  meterLabel: "US dollars with a code (purchases, before credits)",
  meterOf: (mapped: string, purchases: string) => `${mapped} of ${purchases}`,
  credits: (credits: string, lines: number, net: string) => `Credits and refunds: −${credits} on ${lines} line${lines === 1 ? "" : "s"}, held and not counted. Net of credits: ${net}.`,
  otherAmounts: (lines: number) => ` ${lines} line(s) in another currency or without a plain amount are not in the dollar figures.`,
} as const

/** (5) A form chunk that can't be loaded after a new release (its file name changed): one retry, then this. */
export const LAZY_TEXT_R2C = {
  newerVersion: "A newer version is available — reload the page to continue. Changes not yet saved on this page will be lost.",
  reload: "Reload",
} as const

/**
 * (6) What to do after company setup is saved: assess the Scope 3 categories setup includes (approval of a Scope 3 report
 * needs an assessment for each), then collect activity records.
 */
export const SETUP_NEXT_TEXT_R2C = {
  title: "Next step",
  assess: (categories: readonly number[], year: number) =>
    `Assess the Scope 3 ${categories.length === 1 ? "category" : "categories"} you included (${categories.join(", ")}) for ${year}: a Scope 3 report can be approved only once each has an assessment. Then collect activity records.`,
  documentExcluded: (categories: readonly number[]) => `Categories screened out (${categories.join(", ")}) can be documented with an assessment too, for the exclusion register.`,
  collect: "Collect activity records and evidence for the reporting period on the Activity page; Results & report shows the draft figures.",
  assessButton: "Assess the Scope 3 categories (step 06)",
  activityButton: "Go to Activity",
} as const
export interface Scope3SetupNextStep { assess: number[]; documentExcluded: number[]; text: string[] }
/**
 * The next step after a save, from the saved screening and the reporting year's assessments (null below schema 30 or not
 * loaded yet: then only the Activity step is named).
 */
export function scope3SetupNextStep(screening: ReadonlyArray<{ category: number; decision: "included" | "excluded" | "not_relevant" | "not_screened" }>, assessments: { reportingYear: number; categories: readonly number[] } | null): Scope3SetupNextStep {
  if (!assessments) return { assess: [], documentExcluded: [], text: [SETUP_NEXT_TEXT_R2C.collect] }
  const assessed = new Set(assessments.categories)
  const assess = screening.filter(row => row.decision === "included" && !assessed.has(row.category)).map(row => row.category).sort((a, b) => a - b)
  const documentExcluded = screening.filter(row => (row.decision === "excluded" || row.decision === "not_relevant") && !assessed.has(row.category)).map(row => row.category).sort((a, b) => a - b)
  const text = [
    ...(assess.length ? [SETUP_NEXT_TEXT_R2C.assess(assess, assessments.reportingYear)] : []),
    ...(documentExcluded.length ? [SETUP_NEXT_TEXT_R2C.documentExcluded(documentExcluded)] : []),
    ...(assess.length ? [] : [SETUP_NEXT_TEXT_R2C.collect]),
  ]
  return { assess, documentExcluded, text }
}
