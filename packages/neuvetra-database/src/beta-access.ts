import type { WorkspaceConnection } from "./workspace"
import { createPostgresConnection } from "./hosted"
import { BETA_ACCESS_PROFILE, BETA_ACCESS_SCHEMA_VERSION, normalizeBetaEmail, type BetaAccessRecord, type BetaRole } from "./beta-access-contract"

interface AccessRow {
  company_id: string
  role: BetaRole
  membership_generation: number | string
  display_label?: string
  state: "access_admitted_setup_pending"
  replayed?: boolean
}

function mapAccess(row: AccessRow): BetaAccessRecord {
  const generation = Number(row.membership_generation)
  if (!Number.isSafeInteger(generation) || generation < 1) throw new Error("Beta access response is invalid.")
  return { companyId: row.company_id, role: row.role, membershipGeneration: generation, state: row.state, ...(row.display_label === undefined ? {} : { displayLabel: row.display_label }) }
}

function requireUuid(value: string, label: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new Error(`${label} is invalid.`)
}

export type BetaDatabaseErrorKind = "conflict" | "unavailable" | "dependency"
export class BetaDatabaseError extends Error {
  constructor(readonly kind: BetaDatabaseErrorKind) { super(kind) }
}

function classify(error: unknown): never {
  const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : ""
  if (code === "23505") throw new BetaDatabaseError("conflict")
  if (code === "P0002") throw new BetaDatabaseError("unavailable")
  throw new BetaDatabaseError("dependency")
}

export class BetaAccessDatabase {
  private constructor(private readonly db: WorkspaceConnection) {}

  static async create(options: { connectionString: string; databaseName: string; runtimeRole: string }): Promise<BetaAccessDatabase> {
    const url = new URL(options.connectionString)
    if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") throw new Error("Local beta database target required.")
    if (url.hostname !== "127.0.0.1" || url.port !== "55472" || decodeURIComponent(url.username) !== options.runtimeRole || decodeURIComponent(url.pathname.slice(1)) !== options.databaseName || !options.databaseName.startsWith("m80_beta_access_") || !options.runtimeRole.startsWith("m80_beta_access_runtime_") || url.search || url.hash) throw new Error("Local beta database target required.")
    const database = new BetaAccessDatabase(createPostgresConnection(options.connectionString, { maxConnections: 4, tls: false }))
    try { await database.checkReadiness(); return database } catch { await database.close(); throw new Error("Beta access dependency is unavailable.") }
  }

  private async asActor<T>(actorId: string, verifiedEmail: string, operation: (db: WorkspaceConnection) => Promise<T>): Promise<T> {
    requireUuid(actorId, "Actor")
    const email = normalizeBetaEmail(verifiedEmail)
    try {
      return await this.db.transaction(async tx => {
        await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [actorId])
        await tx.query("select set_config('request.jwt.claim.email',$1,true)", [email])
        return operation({ ...tx, transaction: async callback => callback(tx), close: async () => {} })
      })
    } catch (error) { classify(error) }
  }

  async checkReadiness() {
    try {
      await this.db.transaction(async tx => {
        await tx.query("select set_config('request.jwt.claim.sub','',true)")
        await tx.query("select * from neuvetra_beta.read_session()")
      })
      return { profile: BETA_ACCESS_PROFILE, schemaVersion: BETA_ACCESS_SCHEMA_VERSION }
    } catch (error) { classify(error) }
  }

  async redeem(actorId: string, verifiedEmail: string, tokenDigest: string, requestId: string): Promise<{ access: BetaAccessRecord; replayed: boolean }> {
    requireUuid(requestId, "Request")
    return this.asActor(actorId, verifiedEmail, async tx => {
      const result = await tx.query<AccessRow>("select * from neuvetra_beta.redeem_invitation($1,$2,$3)", [tokenDigest, requestId, normalizeBetaEmail(verifiedEmail)])
      if (result.rows.length !== 1) throw new Error("Beta access response is invalid.")
      return { access: mapAccess(result.rows[0]!), replayed: result.rows[0]!.replayed === true }
    })
  }

  async readSession(actorId: string, verifiedEmail: string): Promise<BetaAccessRecord[]> {
    return this.asActor(actorId, verifiedEmail, async tx => (await tx.query<AccessRow>("select * from neuvetra_beta.read_session()")).rows.map(mapAccess))
  }

  async readWorkspace(actorId: string, verifiedEmail: string, companyId: string): Promise<BetaAccessRecord | null> {
    requireUuid(companyId, "Company")
    return this.asActor(actorId, verifiedEmail, async tx => {
      const rows = (await tx.query<AccessRow>("select * from neuvetra_beta.read_workspace($1)", [companyId])).rows
      return rows.length === 1 ? mapAccess(rows[0]!) : null
    })
  }

  async close(): Promise<void> { await this.db.close() }
}

export interface SyntheticBetaTenant {
  companyId: string
  admissionId: string
  displayLabel: string
  fixtureManifestSha256: string
}

export interface SyntheticBetaFixtureManifest {
  sha256: string
  tenants: readonly SyntheticBetaTenant[]
  identities: readonly string[]
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`
}

export function syntheticBetaFixtureManifestSha256(manifest: SyntheticBetaFixtureManifest): string {
  const payload = {
    profile: "neuvetra.beta-access.synthetic-fixture-manifest.v1",
    identities: [...manifest.identities],
    tenants: manifest.tenants.map(({ companyId, admissionId, displayLabel }) => ({ companyId, admissionId, displayLabel })),
  }
  return new Bun.CryptoHasher("sha256").update(canonicalJson(payload)).digest("hex")
}

function assertFixtureTenant(manifest: SyntheticBetaFixtureManifest, tenant: SyntheticBetaTenant): void {
  const exact = manifest.tenants.find(value => value.companyId === tenant.companyId)
  const identities = manifest.identities.map(normalizeBetaEmail)
  if (Object.keys(manifest).sort().join(",") !== "identities,sha256,tenants" || manifest.tenants.some(value => Object.keys(value).sort().join(",") !== "admissionId,companyId,displayLabel,fixtureManifestSha256")
    || !exact || JSON.stringify(exact) !== JSON.stringify(tenant) || tenant.fixtureManifestSha256 !== manifest.sha256 || syntheticBetaFixtureManifestSha256(manifest) !== manifest.sha256
    || identities.some(email => !email.endsWith(".invalid")) || new Set(identities).size !== identities.length
    || new Set(manifest.tenants.map(value => value.companyId)).size !== manifest.tenants.length || new Set(manifest.tenants.map(value => value.admissionId)).size !== manifest.tenants.length) throw new Error("Exact synthetic tenant manifest required.")
}

/** Operator-only: admits one exact tenant from the in-process synthetic fixture manifest. */
export async function admitBetaTenant(db: WorkspaceConnection, manifest: SyntheticBetaFixtureManifest, tenant: SyntheticBetaTenant, decisionReference: string): Promise<void> {
  assertFixtureTenant(manifest, tenant); requireUuid(tenant.companyId, "Company"); requireUuid(tenant.admissionId, "Admission")
  await db.transaction(async tx => {
    const target = await tx.query<{ fixture_manifest_sha256: string }>("select fixture_manifest_sha256 from neuvetra_beta.target for update")
    if (target.rows[0]?.fixture_manifest_sha256 !== manifest.sha256) throw new Error("Synthetic fixture manifest mismatch.")
    await tx.query("insert into neuvetra_beta.tenant_admissions(company_id,admission_id,fixture_manifest_sha256,display_label,data_classification) values($1,$2,$3,$4,'synthetic_rehearsal')", [tenant.companyId, tenant.admissionId, manifest.sha256, tenant.displayLabel])
    await tx.query("insert into neuvetra_beta.audit(id,event_type,company_id,decision_reference) values($1,'admission_created',$2,$3)", [crypto.randomUUID(), tenant.companyId, decisionReference])
  })
}

/** Operator-only. The raw token exists only in the returned in-memory value. */
export async function issueBetaInvitation(db: WorkspaceConnection, manifest: SyntheticBetaFixtureManifest, input: { companyId: string; recipientEmail: string; role: BetaRole; decisionReference: string }): Promise<{ invitationId: string; token: string }> {
  const tenant = manifest.tenants.find(value => value.companyId === input.companyId)
  if (!tenant) throw new Error("Exact synthetic tenant manifest required.")
  assertFixtureTenant(manifest, tenant)
  const email = normalizeBetaEmail(input.recipientEmail)
  if (!email.endsWith(".invalid") || !manifest.identities.includes(email) || !["owner", "member"].includes(input.role)) throw new Error("Exact synthetic identity required.")
  const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex")
  const digest = new Bun.CryptoHasher("sha256").update(token).digest("hex")
  const invitationId = crypto.randomUUID()
  await db.transaction(async tx => {
    const admission = await tx.query<{ company_id: string }>("select company_id from neuvetra_beta.tenant_admissions where company_id=$1 and admission_id=$2 and fixture_manifest_sha256=$3 and active and tombstoned_at is null for update", [input.companyId, tenant.admissionId, manifest.sha256])
    if (admission.rows.length !== 1) throw new Error("Admission unavailable.")
    await tx.query("insert into neuvetra_beta.invitations(id,company_id,admission_id,token_digest,recipient_email,role,expires_at,issuer_decision_reference) values($1,$2,$3,$4,$5,$6,clock_timestamp()+interval '24 hours',$7)", [invitationId, input.companyId, tenant.admissionId, digest, email, input.role, input.decisionReference])
    await tx.query("insert into neuvetra_beta.audit(id,event_type,company_id,invitation_id,decision_reference) values($1,'invitation_issued',$2,$3,$4)", [crypto.randomUUID(), input.companyId, invitationId, input.decisionReference])
  })
  return { invitationId, token }
}

export async function revokeBetaInvitation(db: WorkspaceConnection, invitationId: string, decisionReference: string): Promise<void> {
  requireUuid(invitationId, "Invitation")
  await db.transaction(async tx => {
    const candidate = await tx.query<{ company_id: string }>("select company_id from neuvetra_beta.invitations where id=$1", [invitationId])
    if (candidate.rows.length !== 1) throw new Error("Invitation unavailable.")
    await tx.query("select company_id from neuvetra_beta.tenant_admissions where company_id=$1 for update", [candidate.rows[0]!.company_id])
    const rows = await tx.query<{ company_id: string }>("update neuvetra_beta.invitations set status='revoked' where id=$1 and status='pending' returning company_id", [invitationId])
    if (rows.rows.length !== 1) throw new Error("Invitation unavailable.")
    await tx.query("insert into neuvetra_beta.audit(id,event_type,company_id,invitation_id,decision_reference) values($1,'invitation_revoked',$2,$3,$4)", [crypto.randomUUID(), rows.rows[0]!.company_id, invitationId, decisionReference])
  })
}

export async function revokeBetaMembership(db: WorkspaceConnection, companyId: string, actorId: string, decisionReference: string): Promise<void> {
  requireUuid(companyId, "Company"); requireUuid(actorId, "Actor")
  await db.transaction(async tx => {
    await tx.query("select pg_advisory_xact_lock(hashtextextended($1::text,80253))", [actorId])
    const rows = await tx.query<{ generation: string }>("update neuvetra_beta.memberships set active=false,revoked_at=clock_timestamp(),generation=generation+1 where company_id=$1 and user_id=$2 and active returning generation", [companyId, actorId])
    if (rows.rows.length !== 1) throw new Error("Membership unavailable.")
    await tx.query("insert into neuvetra_beta.audit(id,event_type,company_id,actor_id,membership_generation,decision_reference) values($1,'membership_revoked',$2,$3,$4,$5)", [crypto.randomUUID(), companyId, actorId, rows.rows[0]!.generation, decisionReference])
  })
}

export async function disableBetaAdmission(db: WorkspaceConnection, companyId: string, decisionReference: string, tombstone = false): Promise<void> {
  requireUuid(companyId, "Company")
  await db.transaction(async tx => {
    const rows = await tx.query<{ company_id: string }>(`update neuvetra_beta.tenant_admissions set active=false,tombstoned_at=case when $2 then coalesce(tombstoned_at,clock_timestamp()) else tombstoned_at end where company_id=$1 and active returning company_id`, [companyId, tombstone])
    if (rows.rows.length !== 1) throw new Error("Admission unavailable.")
    await tx.query("insert into neuvetra_beta.audit(id,event_type,company_id,decision_reference) values($1,$2,$3,$4)", [crypto.randomUUID(), tombstone ? "admission_tombstoned" : "admission_disabled", companyId, decisionReference])
  })
}
