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
    return new DevelopmentWorkspaceDatabase(db)
  }

  private async asUser<T>(userId: string, operation: (tx: Transaction) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [userId])
      await tx.exec("set local role authenticated")
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

  async findWorkspace(userId: string, workspaceId: string): Promise<CompanyWorkspaceRecord | null> {
    return this.asUser(userId, async (tx) => {
      const result = await tx.query<WorkspaceRow>(WORKSPACE_QUERY, [workspaceId])
      return result.rows.length === 1 ? toRecord(result.rows[0]!) : null
    })
  }

  async close() {
    await this.db.close()
  }
}
