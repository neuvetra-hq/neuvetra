/**
 * Round 2, lane D (Claude, 31 October 2026): every new user-facing text of the Scope 3 Results to-do list, the category
 * row actions, Fix, the record filters, the grouped disclosures, the units note, the readiness gate, the approve-with-
 * open-issues acknowledgement, the self-approval confirmation and the empty-company call to action (round-1 product review
 * UX-2, UX-3, UX-5, UX-9, UX-10, UX-23; accounting ACC-10; ROUND2 decisions 5 and 7). New file so no shipped text changes.
 */

export const SCOPE3_TODO_TEXT = {
  heading: "Scope 3 to-do",
  intro: "Every Scope 3 line that isn’t counted yet and every category step still open, with the action that resolves it. Items marked “Blocks approval” must be resolved, or acknowledged, before a report version is approved.",
  none: "Nothing to do: every Scope 3 line is counted or documented, and every relevant category has an assessment.",
  /** WO-04c: counted possible duplicates (`confirm` of the `total`) are "to confirm (counted)", not "to do". */
  count: (total: number, blocking: number, confirm = 0) => `${total - confirm || !confirm ? `${total - confirm} to do` : ""}${confirm ? `${total - confirm ? " · " : ""}${confirm} ${SCOPE3_TO_CONFIRM}` : ""}${blocking ? ` · ${blocking} block${blocking === 1 ? "s" : ""} approval` : ""}`,
  /** WO-04c: the chip on a counted possible duplicate (both records are in the total; nothing to do if they differ). */
  toConfirm: "To confirm (counted)",
  blocks: "Blocks approval",
  optional: "Not blocking",
  showAll: (n: number) => `Show all ${n}`,
  showFewer: "Show fewer",
  category: (category: number, title: string) => `Category ${category}. ${title}`,
  /** The short name of a category step (the group heading already names the category). */
  step: { screening_conflict: "Screening conflict", review_required: "Screening conflict", not_screened: "Not screened yet", assessment_missing: "Assessment missing", assessment_excluded: "Exclusion not documented", no_records: "No records yet" } as Readonly<Record<string, string>>,
  /** A held, pending or conflicting line, named by its source ID and kind. */
  lineTitle: (kind: string, sourceId: string) => `${kind} · ${sourceId}`,
  derivedFrom: (kind: string, sourceId: string) => `Follows its ${kind.toLowerCase()} record ${sourceId}: fix that record and this line recalculates.`,
  alsoHolds: (kinds: string[]) => `Also held for the same reason: ${kinds.join(", ")}.`,
  conflictLine: (category: number) => `This record is in category ${category}, which company setup screens out. It still counts in the total until you change the screening or withdraw it.`,
  pendingLine: "Its method waits for a factor source that isn’t available yet. It isn’t counted, and never as zero.",
  optionalPendingLine: "An optional activity that can’t be quantified yet. It isn’t counted, and never as zero.",
  outsideLine: "Outside the reporting period, so it isn’t counted.",
  // Category steps
  assessmentMissing: (category: number) => `Category ${category} is included but has no assessment: say what it covers, why it is relevant (Scope 3 Standard Table 6.1) and how big it is.`,
  assessmentExcluded: (category: number) => `Category ${category} is screened out without an assessment: record the reason, the relevance criteria and an estimated magnitude for the exclusion register.`,
  notScreened: (category: number) => `Category ${category} isn’t screened yet: decide whether it is relevant. Unknown is never counted as zero.`,
  noRecords: (category: number) => `Category ${category} is included but has no records yet.`,
  conflict: (category: number, n: number) => `Category ${category} is screened as not relevant or excluded, but ${n} active record${n === 1 ? "" : "s"} exist. Change the screening or withdraw the records.`,
} as const

/** WO-04c: how Results labels a counted possible duplicate in its counts (the Overview's note uses the same words). */
export const SCOPE3_TO_CONFIRM = "to confirm (counted)"

/** The buttons of the to-do list and the category rows. */
export const SCOPE3_ACTION_TEXT = {
  fix: "Fix",
  view: "View",
  fixAria: (sourceId: string) => `Fix ${sourceId}`,
  fixSource: (sourceId: string) => `Fix ${sourceId}`,
  openRecord: "Open the record",
  withdraw: "Withdraw or correct",
  assessment: "Add the assessment",
  editAssessment: "Edit the assessment",
  closeAssessment: "Close the assessment",
  documentExclusion: "Document in the assessment",
  screen: "Screen in company setup",
  changeScreening: "Change the screening",
  addRecord: (category: number) => `Add a record for category ${category}`,
  fixRecords: (n: number) => `Fix ${n} record${n === 1 ? "" : "s"}`,
  review: (n: number) => `Review ${n} record${n === 1 ? "" : "s"}`,
  todo: (n: number, confirm = 0) => SCOPE3_TODO_TEXT.count(n, 0, confirm),
} as const

/** Inline assessment editing from the to-do list (UX-5). */
export const SCOPE3_INLINE_ASSESSMENT_TEXT = {
  loading: "Loading the assessment…",
  unavailable: "Assessments can’t be edited here right now. Open company setup, step 6, to edit them.",
  noYear: "Save company setup with a reporting period before adding an assessment.",
  saved: "Assessment saved. The results are being recalculated.",
} as const

/** Units on screen (UX-9): one unit, t CO2e, fixed 2 decimals; exact kilograms only in the calculation details, print and CSV. */
export const SCOPE3_UNIT_TEXT = {
  unit: "t CO2e",
  biogenicUnit: "t CO2",
  belowDisplay: "< 0.01",
  aboveNegativeDisplay: "> −0.01",
  note: "Figures are metric tonnes CO2e (t), rounded half-even to 2 decimals. Exact kilograms are in each line’s calculation details, the printed report and the CSV. “—” means nothing was calculated: unknown is never shown as zero.",
  hoverKg: (kg: string) => `${kg} kg CO2e (exact engine figure)`,
  exactKg: (kg: string) => `${kg} kg CO2e`,
} as const

/** A calculated line whose minimum boundary isn’t met (UX-3): the reason is shown instead of a Fix button. */
export const SCOPE3_PARTIAL_TEXT = {
  prefix: "Partial boundary:",
  mappedShare: (percent: string, fuels: string) => `upstream factors cover ${percent}% of the fossil fuel burned for this grid region’s power; ${fuels} upstream isn’t quantified (never counted as zero).`,
  fuel: { COAL: "coal", OIL: "oil", OFSL: "other fossil fuels", OTHF: "other fuels", GAS: "natural gas" } as Readonly<Record<string, string>>,
  closed: "Its upstream line is calculated separately, so the category counts this boundary as met.",
  generic: "part of this activity’s life cycle isn’t covered by the method; see the category methodology.",
} as const

/** Record list filters and grouping (UX-9). */
export const SCOPE3_RECORD_FILTER_TEXT = {
  heading: "Scope 3 records",
  category: "Category",
  allCategories: "All categories",
  status: "Status",
  kind: "Activity",
  allKinds: "All activities",
  search: "Search source ID or reference",
  statuses: { all: "All", attention: "Needs attention", counted: "Counted", not_counted: "Not counted" } as Readonly<Record<string, string>>,
  shown: (shown: number, total: number) => `Showing ${shown} of ${total} lines`,
  more: (n: number) => `Show ${n} more`,
  none: "No line matches these filters.",
  group: (category: number, title: string, n: number) => `${category}. ${title} · ${n} line${n === 1 ? "" : "s"}`,
} as const

/** Disclosures grouped by category and sorted (UX-9). */
export const SCOPE3_DISCLOSURE_GROUP_TEXT = {
  heading: "Scope 3 disclosures",
  intro: "Grouped by category. A disclosure that applies to several categories is listed under each of them.",
  across: "Across Scope 3",
  group: (category: number, title: string, n: number) => `${category}. ${title} · ${n} disclosure${n === 1 ? "" : "s"}`,
} as const

/** Category status added by lane B (decision 5); the web shows it even before the shared status text has it. */
export const SCOPE3_SCREENING_CONFLICT_TEXT = {
  status: "Screening conflict",
  detail: "Records exist for a category you marked not relevant: change the screening or withdraw the records.",
} as const

/** The readiness gate, the approve-with-open-issues acknowledgement and self-approval (UX-10, ACC-10, decision 7). */
export const SCOPE3_READINESS_TEXT = {
  heading: "Readiness for approval",
  ready: "Ready: no category needs input, has a screening conflict or needs review, and every relevant category has an assessment.",
  notReady: (n: number) => `${n} open issue${n === 1 ? "" : "s"}. A draft version can still be prepared; approving it needs these resolved or explicitly acknowledged.`,
  liveNote: "Based on the live results below. A prepared version keeps the issues it was frozen with.",
  issue: {
    input_needed: (category: number) => `Category ${category} needs input: some of its records aren’t counted yet.`,
    screening_conflict: (category: number) => `Category ${category} has a screening conflict: records exist for a category screened out.`,
    // Round 2 integration: lane B's `needs_review` is a counted line the calculation returned for review (a screened-out
    // category with records is `screening_conflict`), so the words say that. BF-01: or a counted line may repeat another record.
    needs_review: (category: number) => `Category ${category} needs review: some of its counted lines were returned for review by the calculation or may repeat another record.`,
    assessment_missing: (category: number) => `Category ${category} is relevant but has no assessment.`,
    included_category_has_no_records: (category: number) => `Category ${category} is included but has no records. Add activity data or document a category-wide exclusion in screening.${category === 10 ? ' Obtain processor data; an average-data processing estimate is unavailable in this beta, and missing data is not zero.' : ''}`,
  } as Readonly<Record<string, (category: number) => string>>,
  frozenHeading: "Open issues frozen with this version",
  acknowledge: (n: number) => `I approve this version with the ${n} open issue${n === 1 ? "" : "s"} listed above. The acknowledgement is stored with the approval and printed.`,
  acknowledgeRequired: "Acknowledge the open issues before approving, or resolve them and prepare a new version.",
  selfConfirm: "I prepared this version and I am approving it myself. Self-approval is a control exception: it is recorded, printed and exported.",
  selfConfirmRequired: "Confirm the self-approval before approving.",
  approveWithIssues: "Approve with open issues",
  approve: "Approve this version",
  approveSelf: "Approve (self-approval)",
  controlException: "Control exception: self-approved",
  controlExceptionChip: "Self-approved · control exception",
  acknowledged: (n: number) => `Approved with ${n} open issue${n === 1 ? "" : "s"} acknowledged:`,
  approvedReady: "Approved with no open issues.",
  /** Bug hunt D: a v1 version was prepared before the readiness gate existed; its open issues were never frozen. */
  notRecorded: "Readiness was not recorded with this version: it was prepared before the readiness check existed. Each category’s frozen status is shown below.",
  approvedNotRecorded: "Approved (readiness was not recorded with this version).",
} as const

/** The empty company (UX-23): what to do first, and no empty CSV. */
export const SCOPE3_EMPTY_TEXT = {
  heading: "Start Scope 3 by screening the 15 categories",
  body: "Decide which of the 15 value-chain categories are relevant to the company. Screened categories show here with their status; records you add then calculate in their category.",
  screen: "Screen your 15 categories",
  addRecord: "Add a Scope 3 record",
} as const

/** The Scope 1 and 2 “Needs attention” area points to the Scope 3 list (UX-2). */
export const SCOPE3_ATTENTION_LINK_TEXT = {
  line: (n: number, blocking: number, confirm = 0) => `Scope 3: ${n - confirm || !confirm ? `${n - confirm} item${n - confirm === 1 ? "" : "s"} to do` : ""}${confirm ? `${n - confirm ? " · " : ""}${confirm} item${confirm === 1 ? "" : "s"} ${SCOPE3_TO_CONFIRM}` : ""}${blocking ? `, ${blocking} blocking approval` : ""}.`,
  go: "Go to the Scope 3 to-do list",
} as const

// --- Round 2 polish, lane D (Claude, 31 October 2026): assessment prefill, the frozen change log in words, times ---

/** UX-5: a new assessment opened from the to-do list starts from what company setup already says about the category. */
export const SCOPE3_PREFILL_TEXT = {
  note: "Prefilled from company setup (step 6). Check the wording, add the rest, then save.",
  setupNote: "Prefilled from your answer above. Check the wording, add the rest, then save.",
  /** UX-15: a category none of the documentable gaps belongs to. */
  noExclusions: "None of the documentable gaps applies to this category.",
  /** On Results the decision is not shown above the editor (it is in company setup). */
  decisionElsewhere: "The decision itself (included, excluded or not applicable) is saved with company setup.",
} as const

/**
 * UX-7 (remainder): the frozen change log names each record by its activity and source ID (with its description when it
 * has one), never by an internal id. Display only: the stored report text keeps its ids untouched.
 */
export const SCOPE3_CHANGE_LOG_TEXT = {
  first: (year: number) => `First version: no earlier approved version for reporting year ${year}.`,
  compared: (revision: number, sha: string, approvedAt: string) => `Compared with approved revision ${revision} (report SHA-256 ${sha}…, approved ${approvedAt}).`,
  engine: (before: string, after: string) => `Calculation engine changed: ${before}… → ${after}…`,
  register: (name: string, before: string, after: string) => `Factor register changed (${name}): ${before} → ${after}`,
  methodsAdded: (titles: string[]) => `Methods added: ${titles.join("; ")}`,
  methodsRemoved: (titles: string[]) => `Methods removed: ${titles.join("; ")}`,
  screening: (category: number, before: string, after: string) => `Screening of category ${category} changed: ${before} → ${after}`,
  assessment: (category: number, before: number | null, after: number | null) => before === null ? `Assessment of category ${category} added (revision ${after})` : after === null ? `Assessment of category ${category} removed (was revision ${before})` : `Assessment of category ${category} changed: revision ${before} → ${after}`,
  assessmentDetail: (category: number) => `Assessment of category ${category} changed (reason or documented exclusions)`,
  mapping: (record: string, before: string, after: string) => `Spend mapping changed for ${record}: ${before} → ${after}`,
  /** Bug hunt D: with the price basis and where the mapping came from, so a margin- or source-only change shows what changed. */
  mappingSide: (category: number, naics: string | null, margin?: string | null, source?: string | null) => `category ${category}, NAICS ${naics ?? "none"}${margin ? `, ${({ with_margins: "with margins", without_margins: "without margins" } as Readonly<Record<string, string>>)[margin] ?? margin.replace(/_/g, " ")}` : ""}${source ? ` (${({ file: "from the imported file", memory: "from a remembered mapping", user: "entered by hand", unmatched: "not matched yet" } as Readonly<Record<string, string>>)[source] ?? source.replace(/_/g, " ")})` : ""}`,
  added: (record: string, category: number) => `Record added: ${record} (category ${category})`,
  removed: (record: string, category: number) => `Record removed: ${record} (category ${category})`,
  edited: (record: string, category: number) => `Record changed: ${record} (category ${category})`,
  revision: (before: number, after: number) => `revision ${before} → ${after}`,
  method: (before: string, after: string) => `method ${before} → ${after}`,
  total: (before: string, after: string) => `${before} → ${after}`,
  category: (category: number, before: string, after: string) => `Category ${category}: ${before} → ${after}`,
  known: (before: string, after: string) => `Known-source subtotal: ${before} → ${after}`,
  none: "none",
  noFigure: "no figure",
  /** A record that is in neither stored version this view can read (its activity and category are still named). */
  unknownRecord: (kind: string) => `${kind} record (not in this version’s results)`,
  derived: (kind: string, sourceKind: string, sourceId: string) => `${kind} · from ${sourceKind.toLowerCase()} ${sourceId}`,
  registers: { main: "main Scope 3 factors", spend: "spend-based factors (EPA supply chain)", supplement: "fuel and supplementary factors", us_upstream: "U.S. upstream fuel and electricity factors", building_hotel: "building and hotel factors" } as Readonly<Record<string, string>>,
} as const
