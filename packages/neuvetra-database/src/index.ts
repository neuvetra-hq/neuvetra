import { PGlite, type Transaction } from "@electric-sql/pglite"

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
}

interface ActivityRow {
  id: string
  bill_version_id: string
  quantity_mwh: string
  status: "draft"
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
      `select id, version, facility_id, electricity_kwh::text, correction_reason
       from neuvetra.bill_versions where company_id = $1 and evidence_id = $2 order by version`,
      [companyId, evidenceId],
    )
    const activity = await tx.query<ActivityRow>(
      `select a.id, a.bill_version_id, a.quantity_mwh::text, a.status
       from neuvetra.inventory_activity_versions a join neuvetra.bill_versions v on v.company_id = a.company_id and v.id = a.bill_version_id
       where a.company_id = $1 and v.evidence_id = $2 order by a.version desc limit 1`,
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

  async close() {
    await this.db.close()
  }
}
