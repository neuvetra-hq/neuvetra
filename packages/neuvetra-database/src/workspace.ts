import { readCorporateInventory, validateM71Save, validateM71Review, type M71SaveInput, type M71ReviewInput } from "./m71"
import { readAnnualElectricityEvidence, validateAnnualEvidenceInput, validateAnnualEvidenceReview, type AnnualEvidenceInput, type AnnualEvidenceCorrection, type AnnualEvidenceReviewInput } from "./m68"
import { readAnnualEvidenceReports, validateAnnualEvidenceReportInput, type AnnualEvidenceReportInput } from "./m68-report"
import { readAnnualElectricityWorksheet, validateAnnualWorksheetInput, validateAnnualWorksheetReview, type AnnualWorksheetInput, type AnnualWorksheetCorrection, type AnnualWorksheetReviewInput } from "./m67"
import { readAnnualWorksheetReports, validateAnnualWorksheetReportInput, type AnnualWorksheetReportInput } from "./m67-report"
import { readSourceElectricityWorksheet, validateSourceWorksheetInput, validateSourceWorksheetReview, type SourceWorksheetInput, type SourceWorksheetCorrection, type SourceWorksheetReviewInput } from "./m66"
import { readSourceWorksheetReports, validateSourceWorksheetReportInput, type SourceWorksheetReportInput } from "./m66-report"
import { readElectricitySources, validateElectricitySourceUpload } from "./m66-sources"
import { readWorksheetReports, validateWorksheetReportInput, type WorksheetReportInput } from "./m65"
import { readElectricityWorksheet, validateWorksheetInput, validateWorksheetReview, type WorksheetInput, type WorksheetCorrection, type WorksheetReviewInput } from "./m64"
import { M58_FIXTURE_BYTES, M58_FIXTURE_SHA256, M58_REPORTED, M58_TOTALS, M58_WARNINGS, multiplyMwh, type AnnualInventory, type AnnualPeriod, type AnnualRegister } from "./m58"
import { buildInventoryEvidenceArchive, verifyInventoryEvidenceArchive, type EvidencePackBuild, type EvidencePackReceipt, type M59AuditEvent } from "./m59"
import { buildDraftInventoryReport, hashReportBytes } from "./m60"
import { M61_PROFILE, hashDraftReportDecisionSnapshot, validateDraftReportReviewInput, type DraftReportReviewInput } from "./m61"
export { M58_FACTOR, M58_FIXTURE_BYTES, M58_FIXTURE_SHA256, M58_REPORTED, M58_TOTALS, M58_WARNINGS, type AnnualInventory, type AnnualPeriod, type AnnualRegister } from "./m58"
export { M59_PROFILE, M59_ENTRY_COUNT, M59_ENTRY_NAMES, M59_MAX_ARCHIVE_BYTES, buildInventoryEvidenceArchive, inspectInventoryEvidenceArchive, verifyInventoryEvidenceArchive, type EvidencePackBuild, type EvidencePackExpectation, type EvidencePackInputs, type EvidencePackReceipt } from "./m59"
export { M60_PROFILE, M60_MEDIA_TYPE, M60_MAX_REPORT_BYTES, buildDraftInventoryReport, hashReportBytes, type DraftInventoryReportBuild } from "./m60"
export { M61_PROFILE, M61_LIMITATION_ACKNOWLEDGMENTS, M61_CHANGE_ROUTE_CODES, draftReportDecisionSnapshotPayload, hashDraftReportDecisionSnapshot, validateDraftReportReviewInput, type DraftReportReviewInput, type DraftReportDecisionSnapshotInput, type DraftReportReviewDecision, type DraftReportReviewReason, type DraftReportChangeRouteCode } from "./m61"

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`
  const object = value as Record<string, unknown>
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(",")}}`
}

function sha256(value: unknown): string {
  return new Bun.CryptoHasher("sha256").update(canonicalJson(value)).digest("hex")
}

function databaseInstant(value: string): string {
  const instant = new Date(value)
  if (!Number.isFinite(instant.getTime())) throw new Error("Stored timestamp is invalid.")
  return instant.toISOString()
}

export interface CompanyWorkspaceRecord {
  id: string
  companyName: string
  countryCode: "US"
  stateCode: "CA"
  facility: {
    id: string
    name: string
    egridSubregion: "CAMX"
  }
  boundary: {
    id: string
    reportingYear: 2023
    approach: "operational_control"
    status: "draft"
    version: 1
  }
}

export interface SyntheticWorkspaceInput {
  companyName: "Synthetic Acme, Inc."
  facilityName: "Synthetic California office"
  countryCode: "US"
  stateCode: "CA"
  egridSubregion: "CAMX"
  reportingYear: 2023
  approach: "operational_control"
}

export interface SyntheticBillRecord {
  id: string
  companyId: string
  originalName: "neuvetra-m55-synthetic-electricity-bill.pdf"
  mediaType: "application/pdf"
  byteLength: 4605
  sha256: "0a97cd0976c03af0776214fc19bdc3d4f0c00e9c835f3e116574a6f375c8e135"
  parserVersion: "m55-fixed-pdf-v1"
  supplierName: "Synthetic Golden State Electric"
  accountLabel: "SYNTHETIC-0001"
  billNumber: "SYN-CA-2023-01"
  servicePeriodStart: "2023-01-01"
  servicePeriodEnd: "2023-01-31"
  sourceLocators: {
    servicePeriod: { startByte: 3119; endByte: 3147 }
    electricityKwh: { startByte: 3384; endByte: 3394 }
  }
  state: "needs_review" | "reviewed" | "linked_draft"
  versions: Array<{
    id: string
    version: number
    facilityId: string | null
    electricityKwh: string
    correctionReason: string | null
  }>
  draftActivity: null | {
    id: string
    billVersionId: string
    quantityMwh: string
    status: "draft"
  }
  draftCalculation: SyntheticDraftCalculation | null
}

export interface SyntheticDraftCalculation {
  id: string
  activityVersionId: string
  billVersionId: string
  evidenceId: string
  facilityId: string
  boundaryId: string
  billVersion: 2
  sourceQuantityKwh: "12346.000"
  normalizedQuantityMwh: "12.346000"
  status: "draft"
  classification: "development_candidate"
  releaseEligible: false
  method: { id: "scope2-location-based-egrid-subregion"; version: "2023-r2-camx-v1"; implementationSha256: string; reviewedEngineSha256: string; authorityRecordSha256: string }
  factor: { id: "epa-egrid2023-r2-camx-total-output"; version: "eGRID2023-revision-2"; candidateSha256: string; sourceSha256: string; sheet: "SRL23"; totalOutputCell: "AI6"; value: "195.0402888" }
  gwpPolicy: { id: "epa-egrid2023-ar5-100-year"; version: "egrid2023-technical-guide-v1"; policySha256: string }
  inputSnapshotSha256: string
  resultPayloadSha256: string
  total: { unrounded: "2407.9674055248"; display: "2407.9674"; unit: "kg CO2e"; rounding: string }
  gasResults: Record<string, unknown>
  reconciliation: { authority: string; componentSum: "2407.8330020304"; componentRoundingDelta: "0.1344034944"; explanation: string }
  trace: Array<Record<string, unknown>>
  billVersionPayloadSha256: string
  createdBy: string
  createdAt: string
  record: Record<string, unknown>
}

export interface SyntheticCalculationLineage {
  extractionId: string
  parserVersion: "m55-fixed-pdf-v1"
  previousBillVersionId: string
  activityVersion: 1
}

export interface EvidencePackRecord {
  id:string;companyId:string;inventoryId:string;profile:"neuvetra.synthetic.inventory-evidence-pack.v1";manifestSha256:string;lineageRootSha256:string;
  archiveSha256:string;archiveByteLength:number;entryCount:17;createdBy:string;createdAt:string;archive:Uint8Array
}
export interface DraftInventoryReportRecord{id:string;companyId:string;inventoryId:string;evidencePackId:string;profile:"neuvetra.synthetic.inventory-draft-report.v1";inventorySnapshotSha256:string;sourceArchiveSha256:string;sourceManifestSha256:string;sourceLineageRootSha256:string;reportSha256:string;reportByteLength:number;createdBy:string;createdAt:string;report:Uint8Array}
export interface DraftInventoryReportReviewRecord{id:string;companyId:string;reportId:string;profile:typeof M61_PROFILE;decision:"accept_bounded_internal_draft"|"changes_requested";outcome:"accepted_bounded_internal_draft"|"changes_requested";reasonCode:"exact_report_reviewed_for_bounded_internal_use"|"report_revision_required";acknowledgedLimitations:string[];changeRouteCode:DraftReportReviewInput["changeRouteCode"];changeNote:string|null;reportSha256:string;reportCreatedBy:string;inventorySnapshotSha256:string;sourceArchiveSha256:string;sourceManifestSha256:string;sourceLineageRootSha256:string;decisionSnapshotSha256:string;releaseEligible:false;decidedBy:string;decidedAt:string}

export const M57_WARNINGS = [
  "annual_coverage_incomplete_1_of_12_months",
  "market_based_scope2_not_included",
  "factor_and_method_not_released",
  "synthetic_local_only_no_assurance",
] as const

export interface SyntheticInventoryReview {
  id: string
  companyId: string
  boundaryId: string
  calculationId: string
  version: 1
  reportingYear: 2023
  scope: "scope_2_location_based"
  reviewState: "awaiting_review" | "approved_bounded_draft" | "changes_requested"
  completeness: "incomplete"
  releaseEligible: false
  coverage: { expectedFacilities: 1; coveredFacilities: 1; expectedPeriods: 12; coveredPeriods: 1; coveredMonths: ["2023-01"]; missingMonths: string[] }
  warnings: string[]
  line: { facilityId: string; servicePeriodStart: "2023-01-01"; servicePeriodEnd: "2023-01-31"; quantityMwh: "12.346000"; subtotalKgCo2e: "2407.9674"; calculationResultSha256: string }
  snapshotSha256: string
  submittedBy: string
  submittedAt: string
  decision: null | { id: string; decision: "approve_bounded_draft" | "changes_requested"; outcome: "approved_bounded_draft" | "changes_requested"; acknowledgedWarnings: string[]; reasonCode: "bounded_synthetic_scope_reviewed" | "source_or_calculation_revision_required"; decidedBy: string; decidedAt: string }
}

interface WorkspaceRow {
  id: string
  company_name: string
  country_code: "US"
  state_code: "CA"
  facility_id: string
  facility_name: string
  egrid_subregion: "CAMX"
  boundary_id: string
  reporting_year: 2023
  approach: "operational_control"
  status: "draft"
  version: 1
}

interface BillEvidenceRow {
  id: string
  company_id: string
  original_name: SyntheticBillRecord["originalName"]
  media_type: SyntheticBillRecord["mediaType"]
  byte_length: SyntheticBillRecord["byteLength"]
  sha256: SyntheticBillRecord["sha256"]
  parser_version: SyntheticBillRecord["parserVersion"]
  account_label: SyntheticBillRecord["accountLabel"]
  supplier_name: SyntheticBillRecord["supplierName"]
  bill_number: SyntheticBillRecord["billNumber"]
  service_period_start: SyntheticBillRecord["servicePeriodStart"]
  service_period_end: SyntheticBillRecord["servicePeriodEnd"]
}

interface BillVersionRow {
  id: string
  version: number
  facility_id: string | null
  electricity_kwh: string
  correction_reason: string | null
  previous_version_id: string | null
}

interface ActivityRow {
  id: string
  bill_version_id: string
  quantity_mwh: string
  status: "draft"
}

interface CalculationRow {
  id: string
  activity_version_id: string
  bill_version_id: string
  evidence_id: string
  facility_id: string
  boundary_id: string
  source_quantity_kwh: string
  normalized_quantity_mwh: string
  status: "draft"
  classification: "development_candidate"
  release_eligible: false
  adapter_implementation_sha256: string
  reviewed_engine_sha256: string
  authority_record_sha256: string
  factor_candidate_sha256: string
  source_sha256: string
  gwp_policy_sha256: string
  input_snapshot_sha256: string
  result_payload_sha256: string
  result_payload_json: string
  created_by: string
  created_at: string
}

interface InventoryRow {
  id: string; company_id: string; boundary_id: string; calculation_id: string; version: 1; reporting_year: 2023
  scope: "scope_2_location_based"; expected_facilities: 1; covered_facilities: 1; expected_periods: 12; covered_periods: 1
  covered_months: ["2023-01"]; missing_months: string[]; complete: false; factor_release_eligible: false; warning_codes: string[]
  calculation_result_sha256: string; snapshot_sha256: string; submitted_by: string; submitted_at: string
  facility_id: string; service_period_start: "2023-01-01"; service_period_end: "2023-01-31"; normalized_quantity_mwh: "12.346000"; display_kg_co2e: "2407.9674"
  decision_id: string | null; decision: "approve_bounded_draft" | "changes_requested" | null; outcome: "approved_bounded_draft" | "changes_requested" | null
  acknowledged_warning_codes: string[] | null; reason_code: "bounded_synthetic_scope_reviewed" | "source_or_calculation_revision_required" | null; decided_by: string | null; decided_at: string | null
}

const WORKSPACE_QUERY = `
  select c.id, c.name company_name, c.country_code, c.state_code,
    f.id facility_id, f.name facility_name, f.egrid_subregion,
    b.id boundary_id, b.reporting_year, b.approach, b.status, b.version
  from neuvetra.companies c
  join neuvetra.facilities f on f.company_id = c.id
  join neuvetra.reporting_boundaries b on b.company_id = c.id
  join neuvetra.boundary_facilities bf
    on bf.company_id = c.id and bf.facility_id = f.id and bf.boundary_id = b.id
  where c.id = $1
`

function toRecord(row: WorkspaceRow): CompanyWorkspaceRecord {
  return {
    id: row.id,
    companyName: row.company_name,
    countryCode: row.country_code,
    stateCode: row.state_code,
    facility: {
      id: row.facility_id,
      name: row.facility_name,
      egridSubregion: row.egrid_subregion,
    },
    boundary: {
      id: row.boundary_id,
      reportingYear: row.reporting_year,
      approach: row.approach,
      status: row.status,
      version: row.version,
    },
  }
}

export interface WorkspaceSql {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>
  exec(sql: string): Promise<unknown>
}

export interface WorkspaceConnection extends WorkspaceSql {
  transaction<T>(operation: (tx: WorkspaceSql) => Promise<T>): Promise<T>
  close(): Promise<void>
}

export class WorkspaceDatabase {
  protected constructor(protected readonly db: WorkspaceConnection) {}

  async findCorporateInventory(userId:string,companyId:string){return this.asUser(userId,tx=>readCorporateInventory(tx,companyId))}
  async saveCorporateInventory(userId:string,companyId:string,inventoryId:string|null,input:M71SaveInput){
    const normalized=validateM71Save(input)
    return this.asTrustedUser(userId,async tx=>{const saved=(await tx.query<{id:string}>("select neuvetra.save_corporate_inventory($1,$2,$3::text::jsonb) id",[companyId,inventoryId,JSON.stringify(normalized)])).rows[0]!.id;const result=await readCorporateInventory(tx,companyId);const v=result?.versions.find(v=>v.id===saved);if(!v)throw new Error("Corporate coverage could not be verified.");return {...v,review:null}})
  }
  async reviewCorporateInventory(userId:string,companyId:string,inventoryId:string,input:M71ReviewInput){
    const normalized=validateM71Review(input)
    return this.asTrustedUser(userId,async tx=>{const saved=(await tx.query<{id:string}>("select neuvetra.review_corporate_inventory($1,$2,$3::text::jsonb) id",[companyId,inventoryId,JSON.stringify(normalized)])).rows[0]!.id;const result=await readCorporateInventory(tx,companyId);const r=result?.versions.map(v=>v.review).find(r=>r?.id===saved);if(!r)throw new Error("Corporate coverage could not be verified.");return r})
  }

  protected async asUser<T>(userId: string, operation: (tx: WorkspaceSql) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [userId])
      await tx.exec("set local role authenticated")
      return operation(tx)
    })
  }

  protected async asTrustedUser<T>(userId: string, operation: (tx: WorkspaceSql) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [userId])
      return operation(tx)
    })
  }

  async createWorkspace(userId: string, input: SyntheticWorkspaceInput): Promise<CompanyWorkspaceRecord> {
    const companyId = crypto.randomUUID()
    const facilityId = crypto.randomUUID()
    const boundaryId = crypto.randomUUID()
    const auditId = crypto.randomUUID()
    return this.asUser(userId, async (tx) => {
      await tx.query(
        "select neuvetra.create_company_workspace($1, $2, $3, $4, $5, $6, $7)",
        [companyId, input.companyName, facilityId, input.facilityName, boundaryId, input.reportingYear, auditId],
      )
      const result = await tx.query<WorkspaceRow>(WORKSPACE_QUERY, [companyId])
      if (result.rows.length !== 1) throw new Error("Created workspace could not be read back.")
      return toRecord(result.rows[0]!)
    })
  }

  async createWorkspaceWithSyntheticMembers(userId: string, input: SyntheticWorkspaceInput, members: ReadonlyArray<{ userId: string; role: "admin" | "member" }>): Promise<CompanyWorkspaceRecord> {
    const companyId = crypto.randomUUID()
    const facilityId = crypto.randomUUID()
    const boundaryId = crypto.randomUUID()
    const auditId = crypto.randomUUID()
    return this.asTrustedUser(userId, async (tx) => {
      await tx.query(
        "select neuvetra.create_company_workspace($1, $2, $3, $4, $5, $6, $7)",
        [companyId, input.companyName, facilityId, input.facilityName, boundaryId, input.reportingYear, auditId],
      )
      for (const member of members) {
        await tx.query("insert into neuvetra.company_members (company_id, user_id, role) values ($1, $2, $3)", [companyId, member.userId, member.role])
      }
      const result = await tx.query<WorkspaceRow>(WORKSPACE_QUERY, [companyId])
      if (result.rows.length !== 1) throw new Error("Created workspace could not be read back.")
      return toRecord(result.rows[0]!)
    })
  }

  async findWorkspace(userId: string, workspaceId: string): Promise<CompanyWorkspaceRecord | null> {
    return this.asUser(userId, async (tx) => {
      const result = await tx.query<WorkspaceRow>(WORKSPACE_QUERY, [workspaceId])
      return result.rows.length === 1 ? toRecord(result.rows[0]!) : null
    })
  }

  async findSyntheticWorkspaceForUser(userId: string): Promise<CompanyWorkspaceRecord | null> {
    return this.asUser(userId, async (tx) => {
      const result = await tx.query<WorkspaceRow>(WORKSPACE_QUERY.replace("where c.id = $1", "where c.created_by = $1 and c.name = 'Synthetic Acme, Inc.'"), [userId])
      return result.rows.length === 1 ? toRecord(result.rows[0]!) : null
    })
  }

  async canManageWorkspace(userId: string, workspaceId: string): Promise<boolean> {
    return this.asUser(userId, async (tx) => {
      const result = await tx.query<{ allowed: boolean }>("select neuvetra.can_manage_company($1) allowed", [workspaceId])
      return result.rows[0]?.allowed === true
    })
  }

  private async readBill(tx: WorkspaceSql, companyId: string, evidenceId: string): Promise<SyntheticBillRecord | null> {
    const evidence = await tx.query<BillEvidenceRow>(
      `select e.id, e.company_id, e.original_name, e.media_type, e.byte_length, e.sha256, j.parser_version,
        j.extracted_payload->>'account_label' account_label, j.extracted_payload->>'supplier_name' supplier_name,
        j.extracted_payload->>'bill_number' bill_number, j.extracted_payload->>'service_period_start' service_period_start,
        j.extracted_payload->>'service_period_end' service_period_end
       from neuvetra.bill_evidence e join neuvetra.extraction_jobs j on j.company_id = e.company_id and j.evidence_id = e.id
       where e.company_id = $1 and e.id = $2`,
      [companyId, evidenceId],
    )
    if (evidence.rows.length !== 1) return null
    const versions = await tx.query<BillVersionRow>(
      `select id, version, facility_id, electricity_kwh::text, correction_reason, previous_version_id
       from neuvetra.bill_versions where company_id = $1 and evidence_id = $2 order by version`,
      [companyId, evidenceId],
    )
    const activity = await tx.query<ActivityRow>(
      `select a.id, a.bill_version_id, a.quantity_mwh::text, a.status
       from neuvetra.inventory_activity_versions a join neuvetra.bill_versions v on v.company_id = a.company_id and v.id = a.bill_version_id
       where a.company_id = $1 and v.evidence_id = $2 order by a.version desc limit 1`,
      [companyId, evidenceId],
    )
    const calculation = await tx.query<CalculationRow>(
      `select c.id, c.activity_version_id, c.bill_version_id, c.evidence_id, c.facility_id, c.boundary_id,
        c.source_quantity_kwh::text, c.normalized_quantity_mwh::text, c.status, c.classification, c.release_eligible,
        c.adapter_implementation_sha256, c.reviewed_engine_sha256, c.authority_record_sha256, c.factor_candidate_sha256, c.source_sha256, c.gwp_policy_sha256,
        c.input_snapshot_sha256, c.result_payload_sha256, c.result_payload_json, c.created_by, c.created_at::text
       from neuvetra.inventory_calculation_results c
       join neuvetra.bill_versions v on v.company_id = c.company_id and v.id = c.bill_version_id
       where c.company_id = $1 and v.evidence_id = $2 limit 1`,
      [companyId, evidenceId],
    )
    const row = evidence.rows[0]!
    const activityRow = activity.rows[0]
    const draftActivity = activityRow ? {
      id: activityRow.id,
      billVersionId: activityRow.bill_version_id,
      quantityMwh: activityRow.quantity_mwh,
      status: activityRow.status,
    } : null
    const calculationRow = calculation.rows[0]
    const payload = calculationRow ? JSON.parse(calculationRow.result_payload_json) as Record<string, any> : null
    if (calculationRow && payload) {
      const unhashed = Object.fromEntries(Object.entries(payload).filter(([key]) => key !== "result_payload_sha256"))
      if (canonicalJson(payload) !== calculationRow.result_payload_json || sha256(unhashed) !== calculationRow.result_payload_sha256 || sha256(payload.input_snapshot) !== calculationRow.input_snapshot_sha256) throw new Error("Stored calculation integrity check failed.")
    }
    const billVersionPayloadSha256 = versions.rows[1] ? sha256({
      id: versions.rows[1].id, version: versions.rows[1].version, facilityId: versions.rows[1].facility_id,
      electricityKwh: versions.rows[1].electricity_kwh, correctionReason: versions.rows[1].correction_reason,
      previousVersionId: versions.rows[1].previous_version_id,
    }) : null
    const draftCalculation: SyntheticDraftCalculation | null = calculationRow && payload && billVersionPayloadSha256 ? {
      id: calculationRow.id,
      activityVersionId: calculationRow.activity_version_id,
      billVersionId: calculationRow.bill_version_id,
      evidenceId: calculationRow.evidence_id,
      facilityId: calculationRow.facility_id,
      boundaryId: calculationRow.boundary_id,
      billVersion: 2,
      sourceQuantityKwh: calculationRow.source_quantity_kwh as "12346.000",
      normalizedQuantityMwh: calculationRow.normalized_quantity_mwh as "12.346000",
      status: calculationRow.status,
      classification: calculationRow.classification,
      releaseEligible: calculationRow.release_eligible,
      method: { id: payload.method.id, version: payload.method.version, implementationSha256: calculationRow.adapter_implementation_sha256, reviewedEngineSha256: calculationRow.reviewed_engine_sha256, authorityRecordSha256: calculationRow.authority_record_sha256 },
      factor: {
        id: payload.factor.id, version: payload.factor.version, candidateSha256: calculationRow.factor_candidate_sha256,
        sourceSha256: calculationRow.source_sha256, sheet: payload.factor.source.sheet,
        totalOutputCell: payload.factor.total_output_co2e.cell, value: payload.factor.total_output_co2e.value,
      },
      gwpPolicy: { id: payload.gwp_policy.id, version: payload.gwp_policy.version, policySha256: calculationRow.gwp_policy_sha256 },
      inputSnapshotSha256: calculationRow.input_snapshot_sha256,
      resultPayloadSha256: calculationRow.result_payload_sha256,
      total: payload.total,
      gasResults: payload.gas_results,
      reconciliation: {
        authority: payload.reconciliation.authority,
        componentSum: payload.reconciliation.component_sum,
        componentRoundingDelta: payload.reconciliation.component_rounding_delta,
        explanation: payload.reconciliation.explanation,
      },
      trace: payload.trace,
      billVersionPayloadSha256,
      createdBy: calculationRow.created_by,
      createdAt: calculationRow.created_at,
      record: { calculationId: calculationRow.id, billVersionPayloadSha256, createdBy: calculationRow.created_by, createdAt: calculationRow.created_at, result: payload },
    } : null
    return {
      id: row.id,
      companyId: row.company_id,
      originalName: row.original_name,
      mediaType: row.media_type,
      byteLength: row.byte_length,
      sha256: row.sha256,
      parserVersion: row.parser_version,
      supplierName: row.supplier_name,
      accountLabel: row.account_label,
      billNumber: row.bill_number,
      servicePeriodStart: row.service_period_start,
      servicePeriodEnd: row.service_period_end,
      sourceLocators: {
        servicePeriod: { startByte: 3119, endByte: 3147 },
        electricityKwh: { startByte: 3384, endByte: 3394 },
      },
      state: draftActivity ? "linked_draft" : versions.rows.length > 1 ? "reviewed" : "needs_review",
      versions: versions.rows.map((version) => ({
        id: version.id,
        version: version.version,
        facilityId: version.facility_id,
        electricityKwh: version.electricity_kwh,
        correctionReason: version.correction_reason,
      })),
      draftActivity,
      draftCalculation,
    }
  }

  async ingestSyntheticBill(userId: string, companyId: string, bytes: Uint8Array, sha256: string): Promise<SyntheticBillRecord> {
    return this.asUser(userId, async (tx) => {
      const existing = await tx.query<{ id: string }>("select id from neuvetra.bill_evidence where company_id = $1 and sha256 = $2", [companyId, sha256])
      if (existing.rows[0]) return (await this.readBill(tx, companyId, existing.rows[0].id))!
      const ids = Array.from({ length: 6 }, () => crypto.randomUUID())
      const ingested = await tx.query<{ id: string }>(
        "select neuvetra.ingest_synthetic_bill($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) id",
        [companyId, ...ids, bytes, sha256, "neuvetra-m55-synthetic-electricity-bill.pdf"],
      )
      return (await this.readBill(tx, companyId, ingested.rows[0]!.id))!
    })
  }

  async correctSyntheticBill(userId: string, companyId: string, evidenceId: string, facilityId: string): Promise<SyntheticBillRecord> {
    return this.asUser(userId, async (tx) => {
      const bill = await this.readBill(tx, companyId, evidenceId)
      if (!bill) throw new Error("Evidence not found.")
      if (bill.versions[1]) return bill
      const ids = Array.from({ length: 3 }, () => crypto.randomUUID())
      await tx.query(
        "select neuvetra.correct_synthetic_bill($1, $2, $3, $4, $5, $6, $7, 12346.000, 'Synthetic review exercise')",
        [companyId, facilityId, evidenceId, bill.versions[0]!.id, ...ids],
      )
      return (await this.readBill(tx, companyId, evidenceId))!
    })
  }

  async linkSyntheticBill(userId: string, companyId: string, evidenceId: string, boundaryId: string): Promise<SyntheticBillRecord> {
    return this.asUser(userId, async (tx) => {
      const bill = await this.readBill(tx, companyId, evidenceId)
      if (!bill) throw new Error("Evidence not found.")
      if (bill.draftActivity) return bill
      const reviewed = bill.versions.find((version) => version.version === 2 && version.facilityId)
      if (!reviewed?.facilityId) throw new Error("Review required.")
      await tx.query(
        "select neuvetra.link_synthetic_bill($1, $2, $3, $4, $5, $6)",
        [companyId, boundaryId, reviewed.facilityId, reviewed.id, crypto.randomUUID(), crypto.randomUUID()],
      )
      return (await this.readBill(tx, companyId, evidenceId))!
    })
  }

  async findSyntheticBill(userId: string, companyId: string, evidenceId: string): Promise<SyntheticBillRecord | null> {
    return this.asUser(userId, (tx) => this.readBill(tx, companyId, evidenceId))
  }

  async findSyntheticBillByCalculation(userId: string, companyId: string, calculationId: string): Promise<SyntheticBillRecord | null> {
    return this.asUser(userId, async (tx) => {
      const result = await tx.query<{ evidence_id: string }>("select evidence_id from neuvetra.inventory_calculation_results where company_id = $1 and id = $2", [companyId, calculationId])
      return result.rows[0] ? this.readBill(tx, companyId, result.rows[0].evidence_id) : null
    })
  }

  async findSyntheticCalculationLineage(userId: string, companyId: string, evidenceId: string): Promise<SyntheticCalculationLineage | null> {
    return this.asUser(userId, async (tx) => {
      const result = await tx.query<{ extraction_id: string; parser_version: "m55-fixed-pdf-v1"; previous_bill_version_id: string; activity_version: 1 }>(
        `select j.id extraction_id, j.parser_version, v.previous_version_id previous_bill_version_id, a.version activity_version
         from neuvetra.extraction_jobs j
         join neuvetra.bill_versions v on v.company_id = j.company_id and v.evidence_id = j.evidence_id and v.version = 2
         join neuvetra.inventory_activity_versions a on a.company_id = v.company_id and a.bill_version_id = v.id
         where j.company_id = $1 and j.evidence_id = $2 and j.status = 'completed'`,
        [companyId, evidenceId],
      )
      const row = result.rows[0]
      return row ? { extractionId: row.extraction_id, parserVersion: row.parser_version, previousBillVersionId: row.previous_bill_version_id, activityVersion: row.activity_version } : null
    })
  }

  async findSyntheticCalculationIdempotency(userId: string, companyId: string, idempotencyKey: string): Promise<{ operationFingerprint: string } | null> {
    return this.asUser(userId, async (tx) => {
      const result = await tx.query<{ operation_fingerprint: string }>("select operation_fingerprint from neuvetra.inventory_calculation_results where company_id = $1 and idempotency_key = $2", [companyId, idempotencyKey])
      return result.rows[0] ? { operationFingerprint: result.rows[0].operation_fingerprint } : null
    })
  }

  async createSyntheticBillCalculation(userId: string, companyId: string, evidenceId: string, activityId: string, idempotencyKey: string, operationFingerprint: string, resultPayload: Record<string, unknown>): Promise<SyntheticBillRecord> {
    return this.asTrustedUser(userId, async (tx) => {
      const bill = await this.readBill(tx, companyId, evidenceId)
      if (!bill?.draftActivity || bill.draftActivity.id !== activityId) throw new Error("Linked draft evidence required.")
      const suppliedResultHash = resultPayload.result_payload_sha256
      const unhashed = Object.fromEntries(Object.entries(resultPayload).filter(([key]) => key !== "result_payload_sha256"))
      const inputSnapshot = resultPayload.input_snapshot
      if (typeof suppliedResultHash !== "string" || suppliedResultHash !== sha256(unhashed) || typeof resultPayload.input_snapshot_sha256 !== "string" || resultPayload.input_snapshot_sha256 !== sha256(inputSnapshot)) {
        throw new Error("Calculation integrity check failed.")
      }
      const canonicalResultJson = canonicalJson(resultPayload)
      await tx.query(
        "select neuvetra.create_synthetic_bill_calculation($1, $2, $3, $4, $5, $6, $7, $8)",
        [companyId, evidenceId, activityId, crypto.randomUUID(), crypto.randomUUID(), idempotencyKey, operationFingerprint, canonicalResultJson],
      )
      return (await this.readBill(tx, companyId, evidenceId))!
    })
  }

  private async readSyntheticInventory(tx: WorkspaceSql, companyId: string): Promise<SyntheticInventoryReview | null> {
    const result = await tx.query<InventoryRow>(
      `select i.id, i.company_id, i.boundary_id, i.calculation_id, i.version, i.reporting_year, i.scope,
        i.expected_facilities, i.covered_facilities, i.expected_periods, i.covered_periods, i.covered_months, i.missing_months,
        i.complete, i.factor_release_eligible, i.warning_codes, i.calculation_result_sha256, i.snapshot_sha256,
        i.submitted_by, i.created_at::text submitted_at, c.facility_id, v.service_period_start::text, v.service_period_end::text,
        c.normalized_quantity_mwh::text, c.display_kg_co2e::text,
        d.id decision_id, d.decision, d.outcome, d.acknowledged_warning_codes, d.reason_code, d.decided_by, d.decided_at::text
       from neuvetra.inventory_versions i
       join neuvetra.inventory_calculation_results c on c.company_id = i.company_id and c.id = i.calculation_id
       join neuvetra.bill_versions v on v.company_id = c.company_id and v.id = c.bill_version_id
       left join neuvetra.inventory_review_decisions d on d.company_id = i.company_id and d.inventory_version_id = i.id
       where i.company_id = $1 and i.version = 1`, [companyId],
    )
    const row = result.rows[0]
    if (!row) return null
    const snapshot = {
      profile: "m57-synthetic-scope2-inventory-v1", companyId: row.company_id, boundaryId: row.boundary_id, calculationId: row.calculation_id,
      calculationResultSha256: row.calculation_result_sha256, reportingYear: 2023, scope: "scope_2_location_based",
      coverage: { expectedFacilities: 1, coveredFacilities: 1, expectedPeriods: 12, coveredPeriods: 1, coveredMonths: ["2023-01"], missingMonths: row.missing_months },
      warnings: [...M57_WARNINGS], complete: false, releaseEligible: false,
    }
    if (sha256(snapshot) !== row.snapshot_sha256 || row.complete || row.factor_release_eligible || canonicalJson(row.warning_codes) !== canonicalJson(M57_WARNINGS)) throw new Error("Stored inventory integrity check failed.")
    return {
      id: row.id, companyId: row.company_id, boundaryId: row.boundary_id, calculationId: row.calculation_id, version: 1, reportingYear: 2023,
      scope: "scope_2_location_based", reviewState: row.outcome ?? "awaiting_review", completeness: "incomplete", releaseEligible: false,
      coverage: { expectedFacilities: 1, coveredFacilities: 1, expectedPeriods: 12, coveredPeriods: 1, coveredMonths: ["2023-01"], missingMonths: row.missing_months },
      warnings: [...M57_WARNINGS],
      line: { facilityId: row.facility_id, servicePeriodStart: row.service_period_start, servicePeriodEnd: row.service_period_end, quantityMwh: row.normalized_quantity_mwh, subtotalKgCo2e: row.display_kg_co2e, calculationResultSha256: row.calculation_result_sha256 },
      snapshotSha256: row.snapshot_sha256, submittedBy: row.submitted_by, submittedAt: databaseInstant(row.submitted_at),
      decision: row.decision_id && row.decision && row.outcome && row.reason_code && row.decided_by && row.decided_at ? {
        id: row.decision_id, decision: row.decision, outcome: row.outcome, acknowledgedWarnings: row.acknowledged_warning_codes ?? [], reasonCode: row.reason_code, decidedBy: row.decided_by, decidedAt: databaseInstant(row.decided_at),
      } : null,
    }
  }

  async findSyntheticInventory(userId: string, companyId: string): Promise<SyntheticInventoryReview | null> {
    return this.asUser(userId, (tx) => this.readSyntheticInventory(tx, companyId))
  }

  async findSyntheticInventoryIdempotency(userId: string, companyId: string, idempotencyKey: string): Promise<{ operationFingerprint: string } | null> {
    return this.asUser(userId, async (tx) => {
      const result = await tx.query<{ operation_fingerprint: string }>(`select operation_fingerprint from neuvetra.inventory_versions where company_id = $1 and idempotency_key = $2
        union all select operation_fingerprint from neuvetra.inventory_review_decisions where company_id = $1 and idempotency_key = $2`, [companyId, idempotencyKey])
      return result.rows[0] ? { operationFingerprint: result.rows[0].operation_fingerprint } : null
    })
  }

  async createSyntheticInventory(userId: string, companyId: string, calculationId: string, idempotencyKey: string, operationFingerprint: string, snapshotSha256: string): Promise<SyntheticInventoryReview> {
    return this.asTrustedUser(userId, async (tx) => {
      await tx.query("select neuvetra.create_synthetic_scope2_inventory($1,$2,$3,$4,$5,$6,$7)", [companyId, calculationId, crypto.randomUUID(), crypto.randomUUID(), idempotencyKey, operationFingerprint, snapshotSha256])
      const inventory = await this.readSyntheticInventory(tx, companyId)
      if (!inventory) throw new Error("Inventory could not be read back.")
      return inventory
    })
  }

  async recordSyntheticInventoryReview(userId: string, companyId: string, inventoryId: string, decision: "approve_bounded_draft" | "changes_requested", reasonCode: string, acknowledgments: string[], idempotencyKey: string, operationFingerprint: string): Promise<SyntheticInventoryReview> {
    return this.asTrustedUser(userId, async (tx) => {
      await tx.query("select neuvetra.record_synthetic_inventory_review($1,$2,$3,$4,$5,$6,$7,$8,$9)", [companyId, inventoryId, crypto.randomUUID(), crypto.randomUUID(), decision, reasonCode, acknowledgments, idempotencyKey, operationFingerprint])
      const inventory = await this.readSyntheticInventory(tx, companyId)
      if (!inventory) throw new Error("Inventory could not be read back.")
      return inventory
    })
  }

  private async readAnnualRegisters(tx: WorkspaceSql, companyId: string): Promise<AnnualRegister[]> {
    const result = await tx.query<{ payload_json: string; snapshot_sha256: string; created_by: string; created_at: string }>(
      `select payload_json, snapshot_sha256, created_by, created_at::text from neuvetra.annual_source_register_versions where company_id=$1 order by version`, [companyId],
    )
    return result.rows.map((row) => {
      const payload = JSON.parse(row.payload_json) as Omit<AnnualRegister, "createdBy" | "createdAt">
      const { snapshotSha256: _stored, ...unhashed } = payload
      if (canonicalJson(payload) !== row.payload_json || sha256(unhashed) !== row.snapshot_sha256 || payload.snapshotSha256 !== row.snapshot_sha256) throw new Error("Stored annual register integrity check failed.")
      return { ...payload, createdBy: row.created_by, createdAt: databaseInstant(row.created_at) }
    })
  }

  async findAnnualRegisters(userId: string, companyId: string): Promise<AnnualRegister[]> {
    return this.asUser(userId, (tx) => this.readAnnualRegisters(tx, companyId))
  }

  async createAnnualRegister(userId: string, companyId: string, previousInventoryVersionId: string, idempotencyKey: string): Promise<AnnualRegister> {
    return this.asTrustedUser(userId, async (tx) => {
      const existing = await tx.query<{ operation_fingerprint: string }>("select operation_fingerprint from neuvetra.annual_source_register_versions where company_id=$1 and idempotency_key=$2", [companyId, idempotencyKey])
      const workspace = (await tx.query<WorkspaceRow>(WORKSPACE_QUERY, [companyId])).rows[0]
      if (!workspace) throw new Error("Workspace not found.")
      const predecessor = await this.readSyntheticInventory(tx, companyId)
      if (!predecessor || predecessor.id !== previousInventoryVersionId || predecessor.reviewState !== "approved_bounded_draft") throw new Error("Approved predecessor required.")
      const fingerprint = sha256({ companyId, previousInventoryVersionId })
      if (existing.rows[0]?.operation_fingerprint !== undefined && existing.rows[0].operation_fingerprint !== fingerprint) throw new Error("Annual register request conflicts.")
      const stored = (await this.readAnnualRegisters(tx, companyId)).find((item) => item.version === 1)
      const registerId = stored?.id ?? crypto.randomUUID()
      const periods: AnnualPeriod[] = Array.from({ length: 12 }, (_, index) => {
        const month = `2023-${String(index + 1).padStart(2, "0")}`
        if (index === 0) return { month, state: "reported", version: 1, quantityMwh: "12.346000", emissionsKgCo2e: "2407.9674055248", evidence: { source: "M56 calculation derived from M55 bill version 2", sha256: predecessor.line.calculationResultSha256, locator: `calculation ${predecessor.calculationId}; service 2023-01-01..2023-01-31` }, reason: null, method: null, formula: null, basisMonths: [] } satisfies AnnualPeriod
        return { month, state: "missing", version: 1, quantityMwh: null, emissionsKgCo2e: null, evidence: null, reason: "awaiting_source", method: null, formula: null, basisMonths: [] } satisfies AnnualPeriod
      })
      const base = { id: registerId, companyId, boundaryId: workspace.boundary_id, previousInventoryVersionId, version: 1 as const, reportingYear: 2023 as const, facilityId: workspace.facility_id, status: "incomplete" as const, counts: { expected: 12 as const, resolved: 1, reported: 1, estimated: 0, excluded: 0, missing: 11, calculationBearing: 1 }, periods, totals: null, fixtureSha256: null }
      const snapshotSha256 = sha256(base)
      const payload = { ...base, snapshotSha256 }
      if (stored) {
        const { createdBy: _createdBy, createdAt: _createdAt, ...storedPayload } = stored
        if (canonicalJson(storedPayload) !== canonicalJson(payload)) throw new Error("Stored annual register conflicts with its approved predecessor.")
        return stored
      }
      await tx.query("select neuvetra.create_annual_source_register($1,$2,$3,$4,$5,$6,$7,$8)", [companyId, previousInventoryVersionId, registerId, crypto.randomUUID(), canonicalJson(payload), snapshotSha256, idempotencyKey, fingerprint])
      return (await this.readAnnualRegisters(tx, companyId))[0]!
    })
  }

  async completeAnnualRegister(userId: string, companyId: string, registerId: string, expectedSnapshotSha256: string, idempotencyKey: string): Promise<AnnualRegister> {
    return this.asTrustedUser(userId, async (tx) => {
      const registers = await this.readAnnualRegisters(tx, companyId)
      const initial = registers.find((item) => item.id === registerId && item.version === 1)
      if (!initial || initial.snapshotSha256 !== expectedSnapshotSha256) throw new Error("Annual register request conflicts.")
      const fixtureBytes = new Uint8Array(await Bun.file(new URL("../../../data/synthetic/m58-electricity-register-2023.json", import.meta.url)).arrayBuffer())
      const fixtureSha256 = new Bun.CryptoHasher("sha256").update(fixtureBytes).digest("hex")
      if (fixtureBytes.byteLength !== M58_FIXTURE_BYTES || fixtureSha256 !== M58_FIXTURE_SHA256) throw new Error("Fixed annual register fixture integrity check failed.")
      const completed = registers.find((item) => item.version === 2)
      const evidence = { source: "M58 fixed fictional electricity register", sha256: fixtureSha256, locator: "" }
      const periods: AnnualPeriod[] = M58_REPORTED.map(([month, quantityMwh], index) => ({
        month, state: "reported", version: month === "2023-01" ? 1 : 2, quantityMwh,
        emissionsKgCo2e: multiplyMwh(quantityMwh), evidence: month === "2023-01" ? initial.periods[0]!.evidence : { ...evidence, locator: `rows[${index - 1}]` },
        reason: null, method: null, formula: null, basisMonths: [],
      }))
      periods.push({ month: "2023-11", state: "estimated", version: 2, quantityMwh: "12.493000", emissionsKgCo2e: "2436.6383279784", evidence: null, reason: "synthetic_november_statement_unavailable", method: "mean_of_prior_two_reported_months_v1", formula: "(12.765000 + 12.221000) / 2", basisMonths: ["2023-09", "2023-10"] })
      periods.push({ month: "2023-12", state: "excluded", version: 2, quantityMwh: null, emissionsKgCo2e: null, evidence: { ...evidence, locator: "closureMemo" }, reason: "outside_operational_control_after_lease_end", method: null, formula: null, basisMonths: [] })
      const registerId2 = completed?.id ?? crypto.randomUUID()
      const base = { id: registerId2, companyId, boundaryId: initial.boundaryId, previousInventoryVersionId: initial.previousInventoryVersionId, version: 2 as const, reportingYear: 2023 as const, facilityId: initial.facilityId, status: "resolved_with_exceptions" as const, counts: { expected: 12 as const, resolved: 12, reported: 10, estimated: 1, excluded: 1, missing: 0, calculationBearing: 11 }, periods, totals: M58_TOTALS, fixtureSha256 }
      const snapshotSha256 = sha256(base)
      const payload = { ...base, snapshotSha256 }
      const fingerprint = sha256({ companyId, registerId, expectedSnapshotSha256, fixtureSha256 })
      const prior = await tx.query<{ operation_fingerprint: string }>("select operation_fingerprint from neuvetra.annual_source_register_versions where company_id=$1 and idempotency_key=$2", [companyId, idempotencyKey])
      if (prior.rows[0] && prior.rows[0].operation_fingerprint !== fingerprint) throw new Error("Annual register request conflicts.")
      if (completed) {
        const { createdBy: _createdBy, createdAt: _createdAt, ...storedPayload } = completed
        if (canonicalJson(storedPayload) !== canonicalJson(payload)) throw new Error("Stored completed register conflicts with its source register.")
        return completed
      }
      if (!prior.rows[0]) await tx.query("select neuvetra.complete_annual_source_register($1,$2,$3,$4,$5,$6,$7,$8,$9)", [companyId, registerId, registerId2, crypto.randomUUID(), canonicalJson(payload), fixtureSha256, snapshotSha256, idempotencyKey, fingerprint])
      return (await this.readAnnualRegisters(tx, companyId)).find((item) => item.version === 2)!
    })
  }

  private async readAnnualInventory(tx: WorkspaceSql, companyId: string): Promise<AnnualInventory | null> {
    const result = await tx.query<{ payload_json: string; snapshot_sha256: string; submitted_by: string; submitted_at: string; decision_id: string | null; decision: AnnualInventory["decision"] extends infer D ? string | null : never; reason_code: string | null; acknowledged_warning_codes: string[] | null; decided_by: string | null; decided_at: string | null }>(
      `select i.payload_json,i.snapshot_sha256,i.submitted_by,i.submitted_at::text,d.id decision_id,d.decision,d.reason_code,d.acknowledged_warning_codes,d.decided_by,d.decided_at::text
       from neuvetra.annual_inventory_versions i left join neuvetra.annual_inventory_review_decisions d on d.company_id=i.company_id and d.annual_inventory_version_id=i.id where i.company_id=$1 and i.version=2`, [companyId],
    )
    const row = result.rows[0]; if (!row) return null
    const payload = JSON.parse(row.payload_json) as Omit<AnnualInventory, "submittedBy" | "submittedAt" | "decision">
    const { snapshotSha256: _stored, ...unhashed } = payload
    if (canonicalJson(payload) !== row.payload_json || sha256(unhashed) !== row.snapshot_sha256 || payload.snapshotSha256 !== row.snapshot_sha256) throw new Error("Stored annual inventory integrity check failed.")
    const decision = row.decision_id && row.decision && row.reason_code && row.decided_by && row.decided_at ? {
      id: row.decision_id, decision: row.decision as "approve_bounded_annual_location_draft" | "changes_requested", outcome: (row.decision === "approve_bounded_annual_location_draft" ? "approved_bounded_annual_location_draft" : "changes_requested") as AnnualInventory["decision"] extends infer D ? any : never,
      reasonCode: row.reason_code as "bounded_annual_location_register_reviewed" | "source_or_calculation_revision_required", acknowledgedWarnings: row.acknowledged_warning_codes ?? [], decidedBy: row.decided_by, decidedAt: databaseInstant(row.decided_at),
    } : null
    return { ...payload, submittedBy: row.submitted_by, submittedAt: databaseInstant(row.submitted_at), decision }
  }

  async findAnnualInventory(userId: string, companyId: string): Promise<AnnualInventory | null> { return this.asUser(userId, (tx) => this.readAnnualInventory(tx, companyId)) }

  async createAnnualInventory(userId: string, companyId: string, registerId: string, idempotencyKey: string): Promise<AnnualInventory> {
    return this.asTrustedUser(userId, async (tx) => {
      const register = (await this.readAnnualRegisters(tx, companyId)).find((item) => item.id === registerId && item.version === 2)
      if (!register || !register.totals) throw new Error("Resolved annual register required.")
      const existingInventory = await this.readAnnualInventory(tx, companyId)
      const inventoryId = existingInventory?.id ?? crypto.randomUUID()
      const base = { id: inventoryId, companyId, boundaryId: register.boundaryId, previousInventoryVersionId: register.previousInventoryVersionId, registerId, registerSnapshotSha256: register.snapshotSha256, version: 2 as const, reportingYear: 2023 as const, scope: "scope_2_location_based" as const, periodResolution: "resolved_with_exceptions" as const, overallInventoryCompleteness: "incomplete" as const, releaseEligible: false as const, counts: { expected: 12 as const, resolved: 12 as const, reported: 10 as const, estimated: 1 as const, excluded: 1 as const, missing: 0 as const, calculationBearing: 11 as const }, totals: M58_TOTALS, warnings: [...M58_WARNINGS] }
      const snapshotSha256 = sha256(base); const payload = { ...base, snapshotSha256 }; const fingerprint = sha256({ companyId, registerId, registerSnapshotSha256: register.snapshotSha256 })
      const prior = await tx.query<{ operation_fingerprint: string }>("select operation_fingerprint from neuvetra.annual_inventory_versions where company_id=$1 and idempotency_key=$2", [companyId,idempotencyKey])
      if (prior.rows[0] && prior.rows[0].operation_fingerprint !== fingerprint) throw new Error("Annual inventory request conflicts.")
      if (existingInventory) {
        const { submittedBy: _submittedBy, submittedAt: _submittedAt, decision: _decision, ...storedPayload } = existingInventory
        if (canonicalJson(storedPayload) !== canonicalJson(payload)) throw new Error("Stored annual inventory conflicts with its resolved register.")
        return existingInventory
      }
      if (!prior.rows[0]) await tx.query("select neuvetra.create_annual_inventory_v2($1,$2,$3,$4,$5,$6,$7,$8)", [companyId,registerId,inventoryId,crypto.randomUUID(),canonicalJson(payload),snapshotSha256,idempotencyKey,fingerprint])
      return (await this.readAnnualInventory(tx, companyId))!
    })
  }

  async reviewAnnualInventory(userId: string, companyId: string, inventoryId: string, decision: "approve_bounded_annual_location_draft" | "changes_requested", reasonCode: string, acknowledgedWarnings: string[], expectedSnapshotSha256: string, idempotencyKey: string): Promise<AnnualInventory> {
    return this.asTrustedUser(userId, async (tx) => {
      const inventory = await this.readAnnualInventory(tx, companyId)
      if (!inventory || inventory.id !== inventoryId || inventory.snapshotSha256 !== expectedSnapshotSha256) throw new Error("Annual inventory review conflicts.")
      const fingerprint = sha256({ userId, inventoryId, decision, reasonCode, acknowledgedWarnings, expectedSnapshotSha256 })
      const prior = await tx.query<{ operation_fingerprint: string }>("select operation_fingerprint from neuvetra.annual_inventory_review_decisions where company_id=$1 and idempotency_key=$2", [companyId,idempotencyKey])
      if (prior.rows[0] && prior.rows[0].operation_fingerprint !== fingerprint) throw new Error("Annual inventory review conflicts.")
      if (!prior.rows[0]) await tx.query("select neuvetra.review_annual_inventory_v2($1,$2,$3,$4,$5,$6,$7,$8,$9)", [companyId,inventoryId,crypto.randomUUID(),crypto.randomUUID(),decision,reasonCode,acknowledgedWarnings,idempotencyKey,fingerprint])
      return (await this.readAnnualInventory(tx, companyId))!
    })
  }

  private async assembleAnnualEvidencePack(tx: WorkspaceSql, companyId: string, inventoryId: string): Promise<EvidencePackBuild> {
    const workspaceRow=(await tx.query<WorkspaceRow>(WORKSPACE_QUERY,[companyId])).rows[0]
    const [predecessorInventory,registers,annualInventory]=await Promise.all([this.readSyntheticInventory(tx,companyId),this.readAnnualRegisters(tx,companyId),this.readAnnualInventory(tx,companyId)])
    if(!workspaceRow||!predecessorInventory?.decision||predecessorInventory.reviewState!=="approved_bounded_draft"||!annualInventory?.decision||annualInventory.id!==inventoryId||annualInventory.decision.outcome!=="approved_bounded_annual_location_draft")throw new Error("Approved annual inventory required.")
    const link=await tx.query<{evidence_id:string}>("select evidence_id from neuvetra.inventory_calculation_results where company_id=$1 and id=$2",[companyId,predecessorInventory.calculationId])
    const bill=link.rows[0]?await this.readBill(tx,companyId,link.rows[0].evidence_id):null
    if(!bill?.draftActivity||!bill.draftCalculation)throw new Error("Approved annual inventory required.")
    const eventRows=await tx.query<{id:string;company_id:string;actor_user_id:string;event_type:M59AuditEvent["eventType"];subject_id:string;event_meta:Record<string,unknown>;created_at:string}>(
      "select id,company_id,actor_user_id,event_type,subject_id,event_meta,created_at::text from neuvetra.evidence_audit_log where company_id=$1 "+
      "union all select id,company_id,actor_user_id,event_type,calculation_id subject_id,event_meta,created_at::text from neuvetra.calculation_audit_log where company_id=$1 "+
      "union all select id,company_id,actor_user_id,event_type,subject_id,event_meta,created_at::text from neuvetra.inventory_review_audit_log where company_id=$1 "+
      "union all select id,company_id,actor_user_id,event_type,subject_id,event_meta,created_at::text from neuvetra.annual_inventory_audit_log where company_id=$1 order by created_at,event_type,id",[companyId],
    )
    const expectedOrder=["bill.ingested","bill.corrected","bill.linked","calculation.created","inventory.version.created","inventory.review.recorded","annual_register.created","annual_register.completed","annual_inventory.created","annual_inventory.reviewed"]
    const auditEvents=expectedOrder.map((eventType)=>{const row=eventRows.rows.find(item=>item.event_type===eventType);if(!row)throw new Error("Approved annual inventory required.");return{id:row.id,companyId:row.company_id,actorUserId:row.actor_user_id,eventType:row.event_type,subjectId:row.subject_id,metadata:row.event_meta,occurredAt:databaseInstant(row.created_at)}})
    const [rawBillBytes,rawRegisterBytes,rawFixtureManifestBytes]=await Promise.all([
      Bun.file(new URL("../../../output/pdf/neuvetra-m55-synthetic-electricity-bill.pdf",import.meta.url)).bytes(),
      Bun.file(new URL("../../../data/synthetic/m58-electricity-register-2023.json",import.meta.url)).bytes(),
      Bun.file(new URL("../../../data/synthetic/m58-electricity-register-2023.manifest.json",import.meta.url)).bytes(),
    ])
    const{draftCalculation:calculation,...billSnapshot}=bill
    const calculationSnapshot={...calculation,record:calculation.record.result as Record<string,unknown>}
    return buildInventoryEvidenceArchive({workspace:toRecord(workspaceRow),bill:billSnapshot,calculation:calculationSnapshot,predecessorInventory,registers,annualInventory,rawBillBytes,rawRegisterBytes,rawFixtureManifestBytes,auditEvents} as Parameters<typeof buildInventoryEvidenceArchive>[0])
  }

  private async readAnnualEvidencePack(tx:WorkspaceSql,companyId:string,inventoryId:string):Promise<EvidencePackRecord|null>{
    const result=await tx.query<{id:string;company_id:string;annual_inventory_version_id:string;profile:EvidencePackRecord["profile"];manifest_sha256:string;lineage_root_sha256:string;archive_bytes:Uint8Array;archive_sha256:string;archive_byte_length:number;entry_count:17;created_by:string;created_at:string}>("select id,company_id,annual_inventory_version_id,profile,manifest_sha256,lineage_root_sha256,archive_bytes,archive_sha256,archive_byte_length,entry_count,created_by,created_at::text from neuvetra.inventory_evidence_packs where company_id=$1 and annual_inventory_version_id=$2",[companyId,inventoryId])
    const row=result.rows[0];if(!row)return null
    const archive=new Uint8Array(row.archive_bytes)
    if(row.profile!=="neuvetra.synthetic.inventory-evidence-pack.v1"||row.entry_count!==17||archive.byteLength!==row.archive_byte_length)throw new Error("Stored evidence pack failed integrity verification.")
    try{verifyInventoryEvidenceArchive(archive,{archiveSha256:row.archive_sha256,manifestSha256:row.manifest_sha256,lineageRootSha256:row.lineage_root_sha256,companyId:row.company_id,inventoryId:row.annual_inventory_version_id})}catch{throw new Error("Stored evidence pack failed integrity verification.")}
    return{id:row.id,companyId:row.company_id,inventoryId:row.annual_inventory_version_id,profile:row.profile,manifestSha256:row.manifest_sha256,lineageRootSha256:row.lineage_root_sha256,archiveSha256:row.archive_sha256,archiveByteLength:row.archive_byte_length,entryCount:row.entry_count,createdBy:row.created_by,createdAt:databaseInstant(row.created_at),archive}
  }

  async createAnnualEvidencePack(userId:string,companyId:string,inventoryId:string,expectedInventorySnapshotSha256:string,idempotencyKey:string):Promise<EvidencePackRecord>{
    return this.asTrustedUser(userId,async(tx)=>{
      const build=await this.assembleAnnualEvidencePack(tx,companyId,inventoryId)
      const operationFingerprint=sha256({companyId,inventoryId,expectedInventorySnapshotSha256,profile:"neuvetra.synthetic.inventory-evidence-pack.v1"})
      await tx.query("select neuvetra.create_inventory_evidence_pack($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",[companyId,inventoryId,crypto.randomUUID(),crypto.randomUUID(),expectedInventorySnapshotSha256,build.manifestSha256,build.lineageRootSha256,build.archive,build.archiveSha256,build.archiveByteLength,idempotencyKey,operationFingerprint])
      const record=await this.readAnnualEvidencePack(tx,companyId,inventoryId);if(!record)throw new Error("Evidence pack could not be read back.");return record
    })
  }
  async findAnnualEvidencePack(userId:string,companyId:string,inventoryId:string):Promise<EvidencePackRecord|null>{return this.asUser(userId,tx=>this.readAnnualEvidencePack(tx,companyId,inventoryId))}
  async replayAnnualEvidencePack(userId:string,companyId:string,inventoryId:string,packId:string,archive:Uint8Array):Promise<EvidencePackReceipt>{
    return this.asUser(userId,async(tx)=>{const stored=await this.readAnnualEvidencePack(tx,companyId,inventoryId);if(!stored||stored.id!==packId)throw new Error("Evidence pack not found.");const current=await this.assembleAnnualEvidencePack(tx,companyId,inventoryId);if(current.archiveSha256!==stored.archiveSha256||current.archiveByteLength!==stored.archiveByteLength)throw new Error("Evidence pack is not current.");return verifyInventoryEvidenceArchive(archive,{archiveSha256:stored.archiveSha256,manifestSha256:stored.manifestSha256,lineageRootSha256:stored.lineageRootSha256,companyId,inventoryId,currentArchive:current.archive})})
  }

  private async readDraftInventoryReport(tx:WorkspaceSql,companyId:string,inventoryId:string):Promise<DraftInventoryReportRecord|null>{
    const row=(await tx.query<any>("select id,company_id,annual_inventory_version_id,evidence_pack_id,profile,inventory_snapshot_sha256,source_archive_sha256,source_manifest_sha256,source_lineage_root_sha256,report_bytes,report_sha256,report_byte_length,created_by,created_at::text from neuvetra.inventory_draft_reports where company_id=$1 and annual_inventory_version_id=$2",[companyId,inventoryId])).rows[0];if(!row)return null
    const report=new Uint8Array(row.report_bytes),pack=await this.readAnnualEvidencePack(tx,companyId,inventoryId),inventory=await this.readAnnualInventory(tx,companyId),workspace=(await tx.query<WorkspaceRow>(WORKSPACE_QUERY,[companyId])).rows[0]
    if(!pack||!inventory||!workspace)throw new Error("Stored draft inventory report failed integrity verification.")
    const current=await this.assembleAnnualEvidencePack(tx,companyId,inventoryId)
    if(current.archiveSha256!==pack.archiveSha256||current.archiveByteLength!==pack.archiveByteLength)throw new Error("Stored draft inventory report failed integrity verification.")
    const rebuilt=buildDraftInventoryReport(pack.archive,{archiveSha256:pack.archiveSha256,manifestSha256:pack.manifestSha256,lineageRootSha256:pack.lineageRootSha256,companyId,inventoryId,currentArchive:current.archive},workspace.company_name)
    const sameBytes=report.byteLength===rebuilt.report.byteLength&&report.every((byte,index)=>byte===rebuilt.report[index])
    if(row.profile!==rebuilt.profile||row.evidence_pack_id!==pack.id||row.inventory_snapshot_sha256!==inventory.snapshotSha256||row.source_archive_sha256!==rebuilt.sourceArchiveSha256||row.source_manifest_sha256!==rebuilt.sourceManifestSha256||row.source_lineage_root_sha256!==rebuilt.sourceLineageRootSha256||report.byteLength!==row.report_byte_length||row.report_byte_length!==rebuilt.reportByteLength||hashReportBytes(report)!==row.report_sha256||row.report_sha256!==rebuilt.reportSha256||!sameBytes)throw new Error("Stored draft inventory report failed integrity verification.")
    return{id:row.id,companyId:row.company_id,inventoryId:row.annual_inventory_version_id,evidencePackId:row.evidence_pack_id,profile:row.profile,inventorySnapshotSha256:row.inventory_snapshot_sha256,sourceArchiveSha256:row.source_archive_sha256,sourceManifestSha256:row.source_manifest_sha256,sourceLineageRootSha256:row.source_lineage_root_sha256,reportSha256:row.report_sha256,reportByteLength:row.report_byte_length,createdBy:row.created_by,createdAt:databaseInstant(row.created_at),report}
  }
  async createDraftInventoryReport(userId:string,companyId:string,inventoryId:string,packId:string,expectedInventorySnapshotSha256:string,expectedArchiveSha256:string,idempotencyKey:string):Promise<DraftInventoryReportRecord>{return this.asTrustedUser(userId,async tx=>{
    const pack=await this.readAnnualEvidencePack(tx,companyId,inventoryId),inventory=await this.readAnnualInventory(tx,companyId),workspace=(await tx.query<WorkspaceRow>(WORKSPACE_QUERY,[companyId])).rows[0]
    if(!pack||pack.id!==packId||pack.archiveSha256!==expectedArchiveSha256||!inventory||inventory.snapshotSha256!==expectedInventorySnapshotSha256||!workspace)throw new Error("Verified current evidence pack required.")
    const current=await this.assembleAnnualEvidencePack(tx,companyId,inventoryId);if(current.archiveSha256!==pack.archiveSha256)throw new Error("Verified current evidence pack required.")
    const built=buildDraftInventoryReport(pack.archive,{archiveSha256:pack.archiveSha256,manifestSha256:pack.manifestSha256,lineageRootSha256:pack.lineageRootSha256,companyId,inventoryId,currentArchive:current.archive},workspace.company_name)
    const fingerprint=sha256({companyId,inventoryId,packId,expectedInventorySnapshotSha256,expectedArchiveSha256,profile:built.profile})
    await tx.query("select neuvetra.create_inventory_draft_report($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)",[companyId,inventoryId,packId,crypto.randomUUID(),crypto.randomUUID(),expectedInventorySnapshotSha256,expectedArchiveSha256,built.report,built.reportSha256,built.reportByteLength,built.sourceManifestSha256,built.sourceLineageRootSha256,idempotencyKey,fingerprint])
    const result=await this.readDraftInventoryReport(tx,companyId,inventoryId);if(!result)throw new Error("Draft inventory report could not be read back.");return result
  })}
  async findDraftInventoryReport(userId:string,companyId:string,inventoryId:string):Promise<DraftInventoryReportRecord|null>{return this.asUser(userId,tx=>this.readDraftInventoryReport(tx,companyId,inventoryId))}

  private async readDraftInventoryReportReview(tx:WorkspaceSql,companyId:string,inventoryId:string,reportId:string):Promise<DraftInventoryReportReviewRecord|null>{
    const report=await this.readDraftInventoryReport(tx,companyId,inventoryId);if(!report||report.id!==reportId)return null
    const row=(await tx.query<any>("select id,company_id,report_id,profile,decision,outcome,reason_code,acknowledged_limitations,change_route_code,change_note,report_sha256,report_created_by,inventory_snapshot_sha256,source_archive_sha256,source_manifest_sha256,source_lineage_root_sha256,decision_snapshot_sha256,release_eligible,decided_by,decided_at::text from neuvetra.inventory_draft_report_review_decisions where company_id=$1 and report_id=$2",[companyId,reportId])).rows[0];if(!row)return null
    try{validateDraftReportReviewInput({decision:row.decision,reasonCode:row.reason_code,acknowledgedLimitations:row.acknowledged_limitations,changeRouteCode:row.change_route_code,changeNote:row.change_note})}catch{throw new Error("Stored draft report review failed integrity verification.")}
    const expectedOutcome=row.decision==="accept_bounded_internal_draft"?"accepted_bounded_internal_draft":"changes_requested"
    const decisionSnapshotSha256=hashDraftReportDecisionSnapshot({companyId:row.company_id,reportId:row.report_id,profile:row.profile,decision:row.decision,outcome:row.outcome,reasonCode:row.reason_code,acknowledgedLimitations:row.acknowledged_limitations,changeRouteCode:row.change_route_code,changeNote:row.change_note,reportSha256:row.report_sha256,reportCreatedBy:row.report_created_by,inventorySnapshotSha256:row.inventory_snapshot_sha256,sourceArchiveSha256:row.source_archive_sha256,sourceManifestSha256:row.source_manifest_sha256,sourceLineageRootSha256:row.source_lineage_root_sha256,releaseEligible:false,reviewerIdentity:row.decided_by})
    if(row.profile!==M61_PROFILE||row.outcome!==expectedOutcome||row.release_eligible!==false||row.decided_by===report.createdBy||row.report_created_by!==report.createdBy||row.report_sha256!==report.reportSha256||row.inventory_snapshot_sha256!==report.inventorySnapshotSha256||row.source_archive_sha256!==report.sourceArchiveSha256||row.source_manifest_sha256!==report.sourceManifestSha256||row.source_lineage_root_sha256!==report.sourceLineageRootSha256||row.decision_snapshot_sha256!==decisionSnapshotSha256)throw new Error("Stored draft report review failed integrity verification.")
    const audits=(await tx.query<{company_id:string;decision_id:string;report_id:string;actor_user_id:string;event_type:string;event_meta:Record<string,unknown>}>("select company_id,decision_id,report_id,actor_user_id,event_type,event_meta from neuvetra.inventory_draft_report_review_audit_log where company_id=$1 and report_id=$2",[companyId,reportId])).rows
    const audit=audits[0],expectedAudit={decision:row.decision,report_sha256:row.report_sha256,report_created_by:row.report_created_by,decision_snapshot_sha256:row.decision_snapshot_sha256,change_route_code:row.change_route_code}
    if(audits.length!==1||!audit||audit.company_id!==row.company_id||audit.report_id!==row.report_id||audit.decision_id!==row.id||audit.actor_user_id!==row.decided_by||audit.event_type!=="inventory_draft_report.reviewed"||canonicalJson(audit.event_meta)!==canonicalJson(expectedAudit))throw new Error("Stored draft report review failed integrity verification.")
    return{id:row.id,companyId:row.company_id,reportId:row.report_id,profile:row.profile,decision:row.decision,outcome:row.outcome,reasonCode:row.reason_code,acknowledgedLimitations:[...row.acknowledged_limitations],changeRouteCode:row.change_route_code,changeNote:row.change_note,reportSha256:row.report_sha256,reportCreatedBy:row.report_created_by,inventorySnapshotSha256:row.inventory_snapshot_sha256,sourceArchiveSha256:row.source_archive_sha256,sourceManifestSha256:row.source_manifest_sha256,sourceLineageRootSha256:row.source_lineage_root_sha256,decisionSnapshotSha256:row.decision_snapshot_sha256,releaseEligible:false,decidedBy:row.decided_by,decidedAt:databaseInstant(row.decided_at)}
  }

  async reviewDraftInventoryReport(userId:string,companyId:string,inventoryId:string,reportId:string,input:DraftReportReviewInput):Promise<DraftInventoryReportReviewRecord>{return this.asTrustedUser(userId,async tx=>{
    validateDraftReportReviewInput(input)
    const report=await this.readDraftInventoryReport(tx,companyId,inventoryId)
    if(!report||report.id!==reportId||report.reportSha256!==input.expectedReportSha256||report.createdBy===userId)throw new Error("Draft report review conflicts.")
    const outcome=input.decision==="accept_bounded_internal_draft"?"accepted_bounded_internal_draft":"changes_requested"
    const decisionSnapshotSha256=hashDraftReportDecisionSnapshot({companyId,reportId,profile:M61_PROFILE,decision:input.decision,outcome,reasonCode:input.reasonCode,acknowledgedLimitations:input.acknowledgedLimitations,changeRouteCode:input.changeRouteCode,changeNote:input.changeNote,reportSha256:report.reportSha256,reportCreatedBy:report.createdBy,inventorySnapshotSha256:report.inventorySnapshotSha256,sourceArchiveSha256:report.sourceArchiveSha256,sourceManifestSha256:report.sourceManifestSha256,sourceLineageRootSha256:report.sourceLineageRootSha256,releaseEligible:false,reviewerIdentity:userId})
    const operationFingerprint=sha256({userId,companyId,inventoryId,reportId,decision:input.decision,reasonCode:input.reasonCode,acknowledgedLimitations:input.acknowledgedLimitations,changeRouteCode:input.changeRouteCode,changeNote:input.changeNote,reportSha256:report.reportSha256,reportCreatedBy:report.createdBy,inventorySnapshotSha256:report.inventorySnapshotSha256,sourceArchiveSha256:report.sourceArchiveSha256,sourceManifestSha256:report.sourceManifestSha256,sourceLineageRootSha256:report.sourceLineageRootSha256,decisionSnapshotSha256})
    await tx.query("select neuvetra.review_inventory_draft_report($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)",[companyId,inventoryId,reportId,crypto.randomUUID(),crypto.randomUUID(),input.decision,input.reasonCode,input.acknowledgedLimitations,input.changeRouteCode,input.changeNote,report.reportSha256,report.inventorySnapshotSha256,report.sourceArchiveSha256,report.sourceManifestSha256,report.sourceLineageRootSha256,report.createdBy,decisionSnapshotSha256,input.idempotencyKey,operationFingerprint])
    const result=await this.readDraftInventoryReportReview(tx,companyId,inventoryId,reportId);if(!result)throw new Error("Draft report review could not be read back.");return result
  })}
  async findDraftInventoryReportReview(userId:string,companyId:string,inventoryId:string,reportId:string):Promise<DraftInventoryReportReviewRecord|null>{return this.asUser(userId,tx=>this.readDraftInventoryReportReview(tx,companyId,inventoryId,reportId))}

  async findElectricityWorksheet(userId: string, companyId: string) {
    return this.asUser(userId, tx => readElectricityWorksheet(tx, companyId))
  }
  async saveElectricityWorksheet(userId: string, companyId: string, input: WorksheetInput | WorksheetCorrection, correction = false) {
    validateWorksheetInput(input, correction)
    return this.asTrustedUser(userId, async tx => {
      await tx.query("select neuvetra.save_electricity_worksheet($1,$2::text::jsonb,$3)", [companyId, JSON.stringify(input), correction])
      const result = await readElectricityWorksheet(tx, companyId)
      if (!result) throw new Error("Worksheet unavailable.")
      return result
    })
  }
  async reviewElectricityWorksheet(userId: string, companyId: string, input: WorksheetReviewInput) {
    validateWorksheetReview(input)
    return this.asTrustedUser(userId, async tx => {
      await tx.query("select neuvetra.review_electricity_worksheet($1,$2::text::jsonb)", [companyId, JSON.stringify(input)])
      const result = await readElectricityWorksheet(tx, companyId)
      if (!result) throw new Error("Worksheet unavailable.")
      return result
    })
  }
  async findWorksheetReports(userId:string,companyId:string) {
    return this.asUser(userId,async tx=>(await readWorksheetReports(tx,companyId))?.list??null)
  }
  async findWorksheetReport(userId:string,companyId:string,reportId:string) {
    return this.asUser(userId,async tx=>(await readWorksheetReports(tx,companyId))?.list.reports.find(r=>r.id===reportId)??null)
  }
  async downloadWorksheetReport(userId:string,companyId:string,reportId:string) {
    return this.asUser(userId,async tx=>{
      const records=await readWorksheetReports(tx,companyId),report=records?.list.reports.find(r=>r.id===reportId)
      return report?{report,bytes:records!.bytes.get(reportId)!}:null
    })
  }
  async createWorksheetReport(userId:string,companyId:string,input:WorksheetReportInput) {
    validateWorksheetReportInput(input)
    return this.asTrustedUser(userId,async tx=>{
      const created=await tx.query<{id:string}>("select neuvetra.create_worksheet_report($1,$2::text::jsonb) id",[companyId,JSON.stringify(input)])
      const record=(await readWorksheetReports(tx,companyId))?.list.reports.find(r=>r.id===created.rows[0]?.id)
      if(!record)throw new Error("Worksheet report unavailable.")
      return record
    })
  }
  async findSourceElectricityWorksheet(userId: string, companyId: string) {
    return this.asUser(userId, tx => readSourceElectricityWorksheet(tx, companyId))
  }
  async saveSourceElectricityWorksheet(userId: string, companyId: string, input: SourceWorksheetInput | SourceWorksheetCorrection, correction = false) {
    validateSourceWorksheetInput(input, correction)
    return this.asTrustedUser(userId, async tx => {
      await tx.query("select neuvetra.save_source_worksheet($1,$2::text::jsonb,$3)", [companyId, JSON.stringify(input), correction])
      const result = await readSourceElectricityWorksheet(tx, companyId)
      if (!result) throw new Error("Worksheet unavailable.")
      return result
    })
  }
  async reviewSourceElectricityWorksheet(userId: string, companyId: string, input: SourceWorksheetReviewInput) {
    validateSourceWorksheetReview(input)
    return this.asTrustedUser(userId, async tx => {
      await tx.query("select neuvetra.review_source_worksheet($1,$2::text::jsonb)", [companyId, JSON.stringify(input)])
      const result = await readSourceElectricityWorksheet(tx, companyId)
      if (!result) throw new Error("Worksheet unavailable.")
      return result
    })
  }
  async findSourceWorksheetReports(userId:string,companyId:string) {
    return this.asUser(userId,async tx=>(await readSourceWorksheetReports(tx,companyId))?.list??null)
  }
  async findSourceWorksheetReport(userId:string,companyId:string,reportId:string) {
    return this.asUser(userId,async tx=>(await readSourceWorksheetReports(tx,companyId))?.list.reports.find(r=>r.id===reportId)??null)
  }
  async downloadSourceWorksheetReport(userId:string,companyId:string,reportId:string) {
    return this.asUser(userId,async tx=>{
      const records=await readSourceWorksheetReports(tx,companyId),report=records?.list.reports.find(r=>r.id===reportId)
      return report?{report,bytes:records!.bytes.get(reportId)!}:null
    })
  }
  async createSourceWorksheetReport(userId:string,companyId:string,input:SourceWorksheetReportInput) {
    validateSourceWorksheetReportInput(input)
    return this.asTrustedUser(userId,async tx=>{
      const created=await tx.query<{id:string}>("select neuvetra.create_source_worksheet_report($1,$2::text::jsonb) id",[companyId,JSON.stringify(input)])
      const record=(await readSourceWorksheetReports(tx,companyId))?.list.reports.find(r=>r.id===created.rows[0]?.id)
      if(!record)throw new Error("Worksheet report unavailable.")
      return record
    })
  }
  async findAnnualElectricityEvidence(userId: string, companyId: string) {
    return this.asUser(userId, tx => readAnnualElectricityEvidence(tx, companyId))
  }
  async saveAnnualElectricityEvidence(userId: string, companyId: string, input: AnnualEvidenceInput | AnnualEvidenceCorrection, correction = false) {
    validateAnnualEvidenceInput(input, correction)
    return this.asTrustedUser(userId, async tx => {
      await tx.query("select neuvetra.save_annual_electricity_evidence($1,$2::text::jsonb,$3)", [companyId, JSON.stringify(input), correction])
      const result = await readAnnualElectricityEvidence(tx, companyId)
      if (!result) throw new Error("Worksheet unavailable.")
      return result
    })
  }
  async reviewAnnualElectricityEvidence(userId: string, companyId: string, input: AnnualEvidenceReviewInput) {
    validateAnnualEvidenceReview(input)
    return this.asTrustedUser(userId, async tx => {
      await tx.query("select neuvetra.review_annual_electricity_evidence($1,$2::text::jsonb)", [companyId, JSON.stringify(input)])
      const result = await readAnnualElectricityEvidence(tx, companyId)
      if (!result) throw new Error("Worksheet unavailable.")
      return result
    })
  }
  async findAnnualEvidenceReports(userId:string,companyId:string) {
    return this.asUser(userId,async tx=>(await readAnnualEvidenceReports(tx,companyId))?.list??null)
  }
  async findAnnualEvidenceReport(userId:string,companyId:string,reportId:string) {
    return this.asUser(userId,async tx=>(await readAnnualEvidenceReports(tx,companyId))?.list.reports.find(r=>r.id===reportId)??null)
  }
  async downloadAnnualEvidenceReport(userId:string,companyId:string,reportId:string) {
    return this.asUser(userId,async tx=>{
      const records=await readAnnualEvidenceReports(tx,companyId),report=records?.list.reports.find(r=>r.id===reportId)
      return report?{report,bytes:records!.bytes.get(reportId)!}:null
    })
  }
  async createAnnualEvidenceReport(userId:string,companyId:string,input:AnnualEvidenceReportInput) {
    validateAnnualEvidenceReportInput(input)
    return this.asTrustedUser(userId,async tx=>{
      const created=await tx.query<{id:string}>("select neuvetra.create_annual_evidence_report($1,$2::text::jsonb) id",[companyId,JSON.stringify(input)])
      const record=(await readAnnualEvidenceReports(tx,companyId))?.list.reports.find(r=>r.id===created.rows[0]?.id)
      if(!record)throw new Error("Worksheet report unavailable.")
      return record
    })
  }
  async findAnnualElectricityWorksheet(userId: string, companyId: string) {
    return this.asUser(userId, tx => readAnnualElectricityWorksheet(tx, companyId))
  }
  async saveAnnualElectricityWorksheet(userId: string, companyId: string, input: AnnualWorksheetInput | AnnualWorksheetCorrection, correction = false) {
    validateAnnualWorksheetInput(input, correction)
    return this.asTrustedUser(userId, async tx => {
      await tx.query("select neuvetra.save_annual_electricity_worksheet($1,$2::text::jsonb,$3)", [companyId, JSON.stringify(input), correction])
      const result = await readAnnualElectricityWorksheet(tx, companyId)
      if (!result) throw new Error("Worksheet unavailable.")
      return result
    })
  }
  async reviewAnnualElectricityWorksheet(userId: string, companyId: string, input: AnnualWorksheetReviewInput) {
    validateAnnualWorksheetReview(input)
    return this.asTrustedUser(userId, async tx => {
      await tx.query("select neuvetra.review_annual_electricity_worksheet($1,$2::text::jsonb)", [companyId, JSON.stringify(input)])
      const result = await readAnnualElectricityWorksheet(tx, companyId)
      if (!result) throw new Error("Worksheet unavailable.")
      return result
    })
  }
  async findAnnualWorksheetReports(userId:string,companyId:string) {
    return this.asUser(userId,async tx=>(await readAnnualWorksheetReports(tx,companyId))?.list??null)
  }
  async findAnnualWorksheetReport(userId:string,companyId:string,reportId:string) {
    return this.asUser(userId,async tx=>(await readAnnualWorksheetReports(tx,companyId))?.list.reports.find(r=>r.id===reportId)??null)
  }
  async downloadAnnualWorksheetReport(userId:string,companyId:string,reportId:string) {
    return this.asUser(userId,async tx=>{
      const records=await readAnnualWorksheetReports(tx,companyId),report=records?.list.reports.find(r=>r.id===reportId)
      return report?{report,bytes:records!.bytes.get(reportId)!}:null
    })
  }
  async createAnnualWorksheetReport(userId:string,companyId:string,input:AnnualWorksheetReportInput) {
    validateAnnualWorksheetReportInput(input)
    return this.asTrustedUser(userId,async tx=>{
      const created=await tx.query<{id:string}>("select neuvetra.create_annual_electricity_report($1,$2::text::jsonb) id",[companyId,JSON.stringify(input)])
      const record=(await readAnnualWorksheetReports(tx,companyId))?.list.reports.find(r=>r.id===created.rows[0]?.id)
      if(!record)throw new Error("Worksheet report unavailable.")
      return record
    })
  }
  async findElectricitySources(userId:string,companyId:string){return this.asUser(userId,async tx=>(await readElectricitySources(tx,companyId))?.list??null)}
  async findElectricitySource(userId:string,companyId:string,sourceId:string){return this.asUser(userId,async tx=>(await readElectricitySources(tx,companyId))?.list.sources.find(s=>s.id===sourceId)??null)}
  async downloadElectricitySource(userId:string,companyId:string,sourceId:string){return this.asUser(userId,async tx=>{const found=await readElectricitySources(tx,companyId),source=found?.list.sources.find(s=>s.id===sourceId);return source?{source,bytes:found!.bytes.get(sourceId)!}:null})}
  async uploadElectricitySource(userId:string,companyId:string,name:string,type:string,bytes:Uint8Array,key:string){
    validateElectricitySourceUpload(name,type,bytes,key)
    return this.asTrustedUser(userId,async tx=>{
      const created=await tx.query<{id:string}>("select neuvetra.upload_electricity_source($1,$2,$3,$4::text,$5) id",[companyId,name,type,Buffer.from(bytes).toString("hex"),key])
      const result=(await readElectricitySources(tx,companyId))?.list.sources.find(s=>s.id===created.rows[0]?.id)
      if(!result)throw new Error("Source unavailable.");return result
    })
  }
  async close() {
    await this.db.close()
  }
}

export class DevelopmentWorkspaceDatabase extends WorkspaceDatabase {
  private constructor(db: WorkspaceConnection) { super(db) }

  static async create(authenticatedUserIds: readonly string[]) {
    if (authenticatedUserIds.length === 0 || new Set(authenticatedUserIds).size !== authenticatedUserIds.length) {
      throw new Error("Supply distinct synthetic authenticated users.")
    }
    const { PGlite } = await import("@electric-sql/pglite")
    const db = new PGlite()
    await db.exec(`
      create role authenticated;
      create schema auth;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      grant usage on schema auth to authenticated;
      grant execute on function auth.uid() to authenticated;
    `)
    for (const userId of authenticatedUserIds) {
      await db.query("insert into auth.users (id) values ($1)", [userId])
    }
    const migration = await Bun.file(new URL("./migrations/0001_company_workspace.sql", import.meta.url)).text()
    await db.exec(migration)
    const billMigration = await Bun.file(new URL("./migrations/0002_synthetic_bill_intake.sql", import.meta.url)).text()
    await db.exec(billMigration)
    const calculationMigration = await Bun.file(new URL("./migrations/0003_synthetic_bill_calculation.sql", import.meta.url)).text()
    await db.exec(calculationMigration)
    const inventoryMigration = await Bun.file(new URL("./migrations/0004_inventory_review.sql", import.meta.url)).text()
    await db.exec(inventoryMigration)
    const annualRegisterMigration = await Bun.file(new URL("./migrations/0005_annual_electricity_register.sql", import.meta.url)).text()
    await db.exec(annualRegisterMigration)
    const evidencePackMigration = await Bun.file(new URL("./migrations/0006_inventory_evidence_pack.sql", import.meta.url)).text()
    await db.exec(evidencePackMigration)
    await db.exec(await Bun.file(new URL("./migrations/0007_inventory_draft_report.sql", import.meta.url)).text())
    await db.exec(await Bun.file(new URL("./migrations/0008_inventory_draft_report_review.sql", import.meta.url)).text())
    await db.exec(await Bun.file(new URL("./migrations/0010_manual_electricity_worksheet.sql", import.meta.url)).text())
    await db.exec(await Bun.file(new URL("./migrations/0011_worksheet_reports.sql", import.meta.url)).text())
    await db.exec(await Bun.file(new URL("./migrations/0012_source_electricity_worksheet.sql", import.meta.url)).text())
    await db.exec(await Bun.file(new URL("./migrations/0013_annual_electricity_worksheet.sql", import.meta.url)).text())
    return new DevelopmentWorkspaceDatabase(db)
  }

}
