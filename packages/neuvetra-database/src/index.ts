import { PGlite, type Transaction } from "@electric-sql/pglite"

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`
  const object = value as Record<string, unknown>
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(",")}}`
}

function sha256(value: unknown): string {
  return new Bun.CryptoHasher("sha256").update(canonicalJson(value)).digest("hex")
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

export class DevelopmentWorkspaceDatabase {
  private constructor(private readonly db: PGlite) {}

  static async create(authenticatedUserIds: readonly string[]) {
    if (authenticatedUserIds.length === 0 || new Set(authenticatedUserIds).size !== authenticatedUserIds.length) {
      throw new Error("Supply distinct synthetic authenticated users.")
    }
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
    return new DevelopmentWorkspaceDatabase(db)
  }

  private async asUser<T>(userId: string, operation: (tx: Transaction) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [userId])
      await tx.exec("set local role authenticated")
      return operation(tx)
    })
  }

  private async asTrustedUser<T>(userId: string, operation: (tx: Transaction) => Promise<T>): Promise<T> {
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

  async canManageWorkspace(userId: string, workspaceId: string): Promise<boolean> {
    return this.asUser(userId, async (tx) => {
      const result = await tx.query<{ allowed: boolean }>("select neuvetra.can_manage_company($1) allowed", [workspaceId])
      return result.rows[0]?.allowed === true
    })
  }

  private async readBill(tx: Transaction, companyId: string, evidenceId: string): Promise<SyntheticBillRecord | null> {
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

  async close() {
    await this.db.close()
  }
}
