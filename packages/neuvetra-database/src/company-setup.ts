import type { WorkspaceSql } from './workspace'
import { m71CanonicalJson } from './m71-validation'

import type { CompanySetup, CompanySetupVersion, CompanySetupView, CompanySetupSaveResult } from './company-setup-contract'
export type * from './company-setup-contract'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
type Row = { id: string; company_id: string; revision: number; previous_version_id: string | null; correction_reason: string | null; payload: CompanySetup; payload_sha256: string; created_by: string; created_at: string }
const columns = 'id,company_id,revision,previous_version_id,correction_reason,payload,payload_sha256,created_by,created_at::text'
function decode(row: Row): CompanySetupVersion {
  if (new Bun.CryptoHasher('sha256').update(m71CanonicalJson(row.payload)).digest('hex') !== row.payload_sha256) throw new Error('Company setup integrity check failed.')
  return { id: row.id, companyId: row.company_id, revision: row.revision, previousVersionId: row.previous_version_id, correctionReason: row.correction_reason, setup: row.payload, payloadSha256: row.payload_sha256, createdBy: row.created_by, createdAt: new Date(row.created_at).toISOString() }
}

/** Caller supplies a transaction with server-authenticated JWT subject and runtime role. */
export async function readCompanySetup(tx: WorkspaceSql, companyId: string): Promise<CompanySetupView | null> {
  if (!UUID.test(companyId)) return null
  const access = await tx.query<{ member: boolean; manage: boolean }>('select neuvetra.is_company_member($1) member,neuvetra.can_manage_company($1) manage', [companyId])
  if (access.rows[0]?.member !== true) return null
  // Read head and history under one statement snapshot; a concurrent save cannot create a false mismatch.
  const rows = await tx.query<Row & {head_id:string;head_revision:number}>(`select ${columns},
    (select version_id from neuvetra.company_setup_heads h where h.company_id=v.company_id) head_id,
    (select revision from neuvetra.company_setup_heads h where h.company_id=v.company_id) head_revision
    from neuvetra.company_setup_versions v where company_id=$1 order by revision`, [companyId])
  const versions = rows.rows.map(decode)
  for (let i=0;i<versions.length;i++) {
    if (versions[i]!.revision!==i+1 || versions[i]!.previousVersionId!==(versions[i-1]?.id??null)) throw new Error('Company setup history integrity check failed.')
  }
  const last=versions[versions.length-1]
  if (last && (rows.rows[0]?.head_id!==last.id || rows.rows[0]?.head_revision!==last.revision)) throw new Error('Company setup head integrity check failed.')
  return { profile: 'neuvetra.company-setup.v1', syntheticOnly: true, canManage: access.rows[0].manage, currentVersion: versions[versions.length-1] ?? null, history: versions.map(({ setup: _setup, ...summary }) => summary) }
}
export async function readCompanySetupVersion(tx: WorkspaceSql, companyId: string, versionId: string): Promise<CompanySetupVersion | null> {
  if (!UUID.test(companyId) || !UUID.test(versionId)) return null
  const access = await tx.query<{ member: boolean }>('select neuvetra.is_company_member($1) member', [companyId])
  if (access.rows[0]?.member !== true) return null
  const rows = await tx.query<Row>(`select ${columns} from neuvetra.company_setup_versions where company_id=$1 and id=$2`, [companyId, versionId])
  return rows.rows[0] ? decode(rows.rows[0]) : null
}
export async function saveCompanySetup(tx: WorkspaceSql, actorId: string, companyId: string, input: unknown): Promise<CompanySetupSaveResult> {
  const actor = await tx.query<{ id: string }>('select neuvetra.current_user_id() id')
  if (actor.rows[0]?.id !== actorId) throw Object.assign(new Error('Company setup unavailable.'), { code: '42501' })
  const result = await tx.query<{ record_id: string; replayed: boolean }>('select * from neuvetra.save_company_setup($1,$2::text::jsonb)', [companyId, JSON.stringify(input)])
  const row = result.rows[0]
  if (!row) throw new Error('Company setup save returned no receipt.')
  const foundation = await readCompanySetup(tx, companyId)
  const savedVersion = await readCompanySetupVersion(tx, companyId, row.record_id)
  if (!foundation || !savedVersion) throw new Error('Company setup save could not be read back.')
  return { foundation, savedVersion, replayed: row.replayed }
}
