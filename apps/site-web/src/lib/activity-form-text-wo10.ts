// WO-10 (Activity form errors and focus): the words of the Activity form's field anatomy, error summary and save outcome.
// Every field label says "Required" or "Optional"; "Required" marks exactly the fields the save checks report when empty.

export const ACTIVITY_FORM_TEXT_WO10 = {
  required: "Required",
  optional: "Optional",
  /** The error summary's title before a save was tried (Save stays on, so the person can find the problems). */
  summaryBefore: (count: number) => count === 1 ? "Fix this before saving:" : `Fix these ${count} things before saving:`,
  /** The error summary's title after a save that was refused or failed. */
  summaryAfter: (count: number) => count === 1 ? "Not saved. Fix this:" : `Not saved. Fix these ${count} things:`,
  /** Pressing Save when nothing on the record has changed. */
  unchanged: "Nothing has changed yet, so there is nothing to save.",
  saved: (version: number) => `Saved · version ${version}`,
  withdrawn: (version: number) => `Withdrawn · version ${version}`,
  replayed: (version: number) => `Saved · version ${version}. The earlier save was confirmed.`,
  vehicleFuel: "Choose the vehicle fuel (gasoline or diesel).",
  vehicleType: "Choose a vehicle type for the selected fuel.",
  modelYear: "Enter the model year as a whole year from 1900 to 2026.",
  vehicleCount: "Vehicle count must be a whole number above zero, or left blank.",
  vintageYear: (index: number) => `Market-based instrument ${index} vintage year must be a four-digit year.`,
} as const
