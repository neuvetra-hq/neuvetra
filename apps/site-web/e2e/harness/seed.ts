/**
 * E2E-01: the deterministic synthetic seed. Every identifier below is fixed, so a test can name a record by ID and every
 * run starts from the same data. Users and rosters are written as an operator would (auth.users plus the repository's
 * `provisionStagingRoster`); company setup, records and the spend import go through the real HTTP API as the owner, so
 * they pass the same validation a browser save does.
 */
import { createSyntheticCompanySetup } from "../../../../packages/neuvetra-database/src/company-setup-fixture"
import { provisionStagingRoster, SCOPE3_SETUP_CATEGORY_TOKENS, type WorkspaceConnection } from "../../../../packages/neuvetra-database/src/index"
import { E2E_PROJECT_REF } from "./database"

/** Synthetic people. The token is what the stubbed Supabase hands the browser and what the injected validator accepts. */
export const USERS = {
  owner: { id: "e2e00000-0000-4000-8000-000000000001", email: "owner@example.test" },
  admin: { id: "e2e00000-0000-4000-8000-000000000002", email: "admin@example.test" },
  member: { id: "e2e00000-0000-4000-8000-000000000003", email: "member@example.test" },
  otherOwner: { id: "e2e00000-0000-4000-8000-000000000004", email: "other-owner@example.test" },
} as const
export type UserKey = keyof typeof USERS

export const COMPANIES = {
  /** Company 1: owner, admin and a view-only member; Scope 1, 2 and 3 records and a spend import. */
  first: "e2e00000-0000-4000-8000-0000000000c1",
  /** Company 2: its own owner and one record. */
  second: "e2e00000-0000-4000-8000-0000000000c2",
} as const

/** Record IDs, by the state the seed puts them in. */
export const RECORDS = {
  gasReady: "e2e00000-0000-4000-8000-00000000a001",
  electricityReady: "e2e00000-0000-4000-8000-00000000a002",
  gasNeedsInput: "e2e00000-0000-4000-8000-00000000a003",
  gasHeld: "e2e00000-0000-4000-8000-00000000a004",
  waste: "e2e00000-0000-4000-8000-00000000a005",
  travel: "e2e00000-0000-4000-8000-00000000a006",
  commuting: "e2e00000-0000-4000-8000-00000000a007",
  spend: "e2e00000-0000-4000-8000-00000000a008",
  secondCompanyGas: "e2e00000-0000-4000-8000-00000000b001",
} as const

/** The spend import's CSV: five coded lines and one with no category, so its review has something to show. */
export const SPEND_IMPORT_CSV = "line_id,date,vendor,gl_account,gl_description,description,amount,currency,dollar_year,category,naics_code,margin_choice,capital_full_cost\n" + [
  "Q-1,2025-03-14,Acme Consulting LLC,6110,Professional services,Strategy workshop,18250.00,USD,2025,1,541611,with_margins,",
  "Q-2,2025-04-02,Byte Systems Inc,6120,IT services,Cloud migration,9400.55,USD,2025,1,541512,with_margins,",
  "Q-3,2025-05-20,Northwind Freight,6200,Freight,Inbound pallets,4120.10,USD,2025,4,484121,with_margins,",
  "Q-4,2025-06-11,SkyHigh Airlines,6300,Travel,Flights to Denver,2280.00,USD,2025,6,481111,with_margins,",
  "Q-5,2025-07-01,Green Waste Co,6400,Waste hauling,Monthly pickup,1310.40,USD,2025,5,562111,with_margins,",
  "Q-6,2025-08-09,Unknown Vendor,6999,Miscellaneous,Unclassified purchase,775.25,USD,2025,,,with_margins,",
].join("\n") + "\n"

/** Deterministic idempotency keys: one per seeded write. */
function key(n: number) { return `e2e00000-0000-4000-8000-${String(n).padStart(12, "0")}` }

type Call = (user: UserKey, route: string, init?: { body?: unknown; raw?: Uint8Array<ArrayBuffer>; headers?: Record<string, string> }) => Promise<unknown>

type Quantity = { originalValue: string; originalUnit: string; normalizedValue: string | null; normalizedUnit: string | null }
const quantity = (value: string, unit: string): Quantity => ({ originalValue: value, originalUnit: unit, normalizedValue: value, normalizedUnit: unit })

function companySetup(scope3: boolean) {
  const base = createSyntheticCompanySetup()
  const location = base.locations[0]!
  return {
    ...base,
    // Reporting period January to November 2025, so a Scope 1 record for December 2025 (inside calendar 2025, which
    // the API requires) is held as outside the reporting period.
    reportingPeriod: { ...base.reportingPeriod, start: "2025-01-01", endExclusive: "2025-12-01" },
    boundary: { ...base.boundary, approach: "operational_control" },
    entities: base.entities.map(entity => ({ ...entity, inclusion: "included", control: "operational_control" })),
    locations: [{ ...location, inclusion: "included", control: "reporting_company", startMode: "period_start", endMode: "period_end" }],
    screening: [
      { id: "stationary", scope: 1, category: "stationary_combustion", state: "yes", reason: "", details: "Synthetic boiler.", locationId: location.id },
      { id: "electricity", scope: 2, category: "purchased_electricity", state: "yes", reason: "", details: "Synthetic utility account.", locationId: location.id },
      ...(scope3 ? [1, 4, 5, 6, 7].map(category => ({ id: `s3-${category}`, scope: 3, category: SCOPE3_SETUP_CATEGORY_TOKENS[category - 1]!, state: "yes", reason: "", details: `Synthetic category ${category} activity.`, locationId: null })) : []),
    ],
  }
}

/** Provisions users and rosters (operator), then writes setup, records and a spend import through the API. */
export async function seed(operator: WorkspaceConnection, call: Call) {
  for (const user of Object.values(USERS)) await operator.query("insert into auth.users(id) values($1)", [user.id])
  await provisionStagingRoster(operator, { expectedProjectRef: E2E_PROJECT_REF, workspaceId: COMPANIES.first, ownerUserId: USERS.owner.id, members: [{ userId: USERS.admin.id, role: "admin" }, { userId: USERS.member.id, role: "member" }] })
  await provisionStagingRoster(operator, { expectedProjectRef: E2E_PROJECT_REF, workspaceId: COMPANIES.second, ownerUserId: USERS.otherOwner.id, members: [] })

  let n = 0
  const saveSetup = async (user: UserKey, company: string, scope3: boolean) => {
    const saved = await call(user, `/workspace/${company}/setup`, { body: { idempotencyKey: key(++n), expectedRevision: 0, expectedVersionId: null, correctionReason: null, setup: companySetup(scope3) } }) as { savedVersion: { id: string } }
    return saved.savedVersion.id
  }
  const location = createSyntheticCompanySetup().locations[0]!.id
  const record = (setupVersionId: string, kind: string, sourceId: string, amount: Quantity, payload: unknown, extra: Record<string, unknown> = {}) => ({
    locationId: location, setupVersionId, state: "active", withdrawalReason: null, quality: "actual", estimateBasis: null,
    period: { start: "2025-01-01", endExclusive: "2025-07-01" }, reference: "E2E synthetic", notes: "", evidenceIds: [],
    kind, sourceId, quantity: amount, payload, ...extra,
  })
  const saveRecord = (user: UserKey, company: string, id: string, activity: unknown) =>
    call(user, `/workspace/${company}/collection/activities/${id}`, { body: { idempotencyKey: key(++n), expectedRevision: 0, expectedVersionId: null, correctionReason: null, activity } })

  const first = await saveSetup("owner", COMPANIES.first, true)
  const spendPayload = { category: 1, naicsCode: "541511", dollarYear: 2024, marginChoice: "with_margins", boughtAtFactoryGate: false, capitalFullCost: null, taxTreatment: "excludes_sales_tax", supplierName: "Synthetic Software LLC", glAccount: "6100",
    description: "Software consulting", categoryConfirmed: false, activityOverlap: "unknown", importId: null, importRow: null, mappingSource: "user", paidByReportingCompany: null, spendEstimateBasis: null, lineDate: null, possibleDuplicateOf: null, duplicateConfirmedDistinct: false }
  const firstRecords: Array<[string, unknown]> = [
    [RECORDS.gasReady, record(first, "natural_gas", "GAS-1", quantity("12500", "therm"), { heatContent: null })],
    [RECORDS.electricityReady, record(first, "electricity", "M-1", quantity("250000", "kWh"), { meterOrAccountNumber: "M-1", utilityName: "City & County of San Francisco", site: "Office", zip: "94105", subregion: "CAMX", utilityEiaId: "16612", instruments: [] })],
    // Needs input: the quantity is unknown.
    [RECORDS.gasNeedsInput, record(first, "natural_gas", "GAS-2", { originalValue: "", originalUnit: "therm", normalizedValue: null, normalizedUnit: null }, { heatContent: null }, { quality: "unknown" })],
    // Held: December 2025 is after the reporting period.
    [RECORDS.gasHeld, record(first, "natural_gas", "GAS-DEC", quantity("800", "therm"), { heatContent: null }, { period: { start: "2025-12-01", endExclusive: "2026-01-01" } })],
    [RECORDS.waste, record(first, "waste", "W-1", quantity("17.125", "metric_ton"), { category: 5, material: "asphalt_concrete", treatment: "recycled" })],
    [RECORDS.travel, record(first, "business_travel", "T-1", quantity("2400", "mile"), { mode: "air", passengerSegments: 4, haulBasis: null })],
    [RECORDS.commuting, record(first, "employee_commuting", "C-1", quantity("9800", "passenger-mile"), { mode: "bus" })],
    [RECORDS.spend, record(first, "purchase_spend", "S-1", quantity("125000.5", "USD"), spendPayload)],
  ]
  for (const [id, activity] of firstRecords) await saveRecord("owner", COMPANIES.first, id, activity)

  // One spend import with six lines: the CSV is uploaded as evidence, then imported against the setup's location.
  const csv = new TextEncoder().encode(SPEND_IMPORT_CSV)
  const upload = await call("owner", `/workspace/${COMPANIES.first}/collection/evidence`, { raw: csv, headers: { "content-type": "text/csv", "x-neuvetra-original-name": "ledger-2025.csv", "x-neuvetra-upload-id": key(++n) } }) as { receipt: { evidenceId: string } }
  await call("owner", `/workspace/${COMPANIES.first}/scope3/spend-imports?evidenceId=${upload.receipt.evidenceId}&locationId=${location}`, { raw: csv, headers: { "content-type": "text/csv" } })

  const second = await saveSetup("otherOwner", COMPANIES.second, false)
  await saveRecord("otherOwner", COMPANIES.second, RECORDS.secondCompanyGas, record(second, "natural_gas", "OTHER-GAS", quantity("5", "therm"), { heatContent: null }))
}
