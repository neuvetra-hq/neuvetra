/**
 * Round 3, lane D (Claude, 31 October 2026): every new user-facing text of the record forms, the Results screen, print and
 * the frozen report view for the round-2 product review (PR-2, PR-6, PR-7, PR-8, PR-9, PR-10, PR-12, PR-13), accounting
 * AC-3 and ROUND3 owner decision 5. New file, so no shipped or earlier-round text changes.
 */

/** Owner decision 5 (AC-3, PR-2): the capped data-quality label is the only category label shown; the engine score is secondary. */
export const SCOPE3_DQ_TEXT_R3D = {
  /** The category's label as shown, with "capped" when it was capped. */
  label: (label: string, capped: boolean) => capped ? `${label} (capped)` : label,
  /** The engine's kg-weighted score (1 very good to 4 poor), shown beside the label as a number only. */
  weighted: (score: string) => `weighted score ${score}`,
  cappedBecause: (reasons: readonly string[]) => `Capped at fair because ${reasons.join(" and ")}.`,
  /** Print: the column of the indicator scores (no label word), then the label column. */
  printScoresHeading: "Data-quality scores (T / Ti / G / C / R / weighted)",
  printLabelHeading: "Data-quality label",
  /** A frozen version stored before labels were capped (v1 documents) shows the label it stored. */
  storedBeforeCap: "This version was stored before data-quality labels were capped at fair for categories with lines not quantified (owner decision of round 2); its labels are shown exactly as stored.",
} as const

/** Screening decisions in company setup's own words (PR-9): "Not applicable", never "not relevant". */
export const SCOPE3_SCREENING_TEXT_R3D: Readonly<Record<string, string>> = {
  included: "Included", excluded: "Excluded", not_relevant: "Not applicable", not_screened: "Not screened",
}
/** The category status words where they differ from the shared words (the screen and print use setup's wording). */
export const SCOPE3_STATUS_TEXT_R3D: Readonly<Record<string, string>> = { not_relevant: "Not applicable (no such activity)" }
export const SCOPE3_CONFLICT_TEXT_R3D = {
  /** The category row's note, naming how the category was screened out. */
  detail: (decision: string) => `Records exist for a category you screened out as ${(SCOPE3_SCREENING_TEXT_R3D[decision] ?? decision).toLowerCase()}: change the screening or withdraw the records.`,
  /** The to-do item of the category. */
  todo: (category: number, decision: string, n: number) => `Category ${category} is screened out as ${(SCOPE3_SCREENING_TEXT_R3D[decision] ?? decision).toLowerCase()}, but ${n} active record${n === 1 ? " exists" : "s exist"}. Change the screening or withdraw the records.`,
  /** PR-7: a counted line in a screened-out category is not "fixed"; the screening is resolved. */
  resolve: "Resolve the screening",
  resolveAria: (sourceId: string) => `Resolve the screening: ${sourceId}`,
  /** PR-10: beside the headline. */
  headline: (tonnes: string, categories: readonly number[]) => `Includes ${tonnes} t from ${categories.length === 1 ? "category" : "categories"} ${categories.join(", ")}, screened out in company setup (screening conflict).`,
} as const

/** PR-9: the Results footer lists all of Scope 3. */
export const SCOPE3_FOOTER_TEXT_R3D = {
  scope3: "; Scope 3: all 15 categories (purchases by spend or supplier data, capital goods, fuel- and energy-related activities, freight, waste, business travel and hotel stays, commuting and teleworking, leased assets, processing, use and end of life of sold products, franchises and investments), reported separately",
} as const

/** PR-8: calculation details describe how a value was transcribed, never the tool tag. */
export const SCOPE3_PROVENANCE_TEXT_R3D: Readonly<Record<string, string>> = {
  webfetch_double_read: "transcribed from the source document (read twice)",
}

/** PR-6, PR-12: problems found before save, each naming its field (the field's label in quotes). */
export const SCOPE3_PRESAVE_TEXT_R3D = {
  vehicle: "Vehicle: choose the vehicle (or “Something else” if none fits). A freight record without one can’t be calculated.",
  haulBasis: "How do you know the haul length?: say how you know the flight length (for example, the booking export).",
  wastePair: (material: string, treatment: string) => `Treatment: EPA publishes no factor for ${material} that is ${treatment.toLowerCase()}. Choose one of the treatments listed for this material.`,
  share: (field: string) => `${field}: enter a percent with up to 3 decimals and no % sign (0 if this treatment isn’t used).`,
  /** The disabled Save's description when nothing has changed. */
  unchanged: "Save is off: nothing has changed yet.",
} as const

/** PR-8: the saved-records list. */
export const SCOPE3_SAVED_TEXT_R3D = {
  invoiceDate: (date: string) => `Invoice date ${date}`,
  period: (start: string, end: string) => `${start} to ${end} (last day covered)`,
} as const

/** PR-13: the Scope 3 CSV, as one file or as a ZIP of one CSV per section. */
export const SCOPE3_CSV_TEXT_R3D = {
  oneFile: "Download Scope 3 CSV",
  zip: "Download as ZIP (one CSV per section)",
  zipAria: "Download the Scope 3 CSV as a ZIP with one CSV file per section",
  notesFile: "00-notes-and-columns.csv",
  readme: (sections: readonly string[]) => `# This ZIP holds the Scope 3 CSV split into one file per section (${sections.join(", ")}). Each file starts with its own header row. The notes and column definitions of the single-file CSV are in this file, unchanged.`,
} as const

/** PR-9 / EN-4: the frozen report view. */
export const SCOPE3_FROZEN_TEXT_R3D = {
  tonnesHeading: "t CO2e (2 decimals)",
  kgHeading: "kg CO2e (exact, as stored)",
} as const

/**
 * Bug hunt D (1 November 2026): the printed Scope 3 section (draft report and frozen version). The CARB line is named as the
 * screen ("CARB’s proposed five") and the CSV ("CARB proposed mandatory categories") name it, so it is never read as the
 * completeness of every category; a frozen version prints alone, without Scope 1 and 2 totals above it.
 */
export const SCOPE3_PRINT_TEXT_D = {
  notAdded: (frozen: boolean) => frozen ? "Scope 3 is never added to the Scope 1 and 2 totals." : "Scope 3 is never added to the Scope 1 and 2 totals above.",
  proposedFive: (line: string) => `CARB’s proposed five categories (a proposal, not adopted): ${line}`,
} as const
