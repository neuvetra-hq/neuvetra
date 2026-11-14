/**
 * Spend CSV imports and remembered mappings: database access (Scope 3 completion I-09; Claude, 30 October 2026; DESIGN
 * §3.6, §7.3, D9, A29). Server-only. A file is imported through 0030's `import_scope3_spend` in one transaction (every line
 * a `purchase_spend` record, or nothing); the same bytes replay. Mappings are 0030's versioned
 * `scope3_spend_mapping_versions` (heads view, `security_invoker`); saving one also corrects every imported line of the
 * group whose mapping the file did not state (group correction), in the same transaction.
 *
 * Everything is read under the caller's own company read policy; writes go through 0030's security-definer RPCs (owner
 * or admin). The caller supplies a transaction with the server-authenticated JWT subject and the runtime role.
 */
import { createHash } from 'node:crypto'
import type { WorkspaceSql } from './workspace'
import { readCollectionActivities, readCollectionEvidence } from './collection'
import { limitedText } from './collection-text-rule'
import { validateCollectionActivityForSave, type CollectionActivityRecord } from './collection-contract'
import { scope3ReportingYearOf } from './scope3-assessment-contract'
import { scope3SpendNaicsAllowed, SCOPE3_SPEND_IMPORT_CATEGORIES, type PurchaseSpendCollectionPayload, type Scope3SpendMappingRequest } from './scope3-collection-contract'
import { scope3SpendMappingKeyInput } from './scope3-collection'
import { buildScope3SpendImportRequest, scope3SpendImportReconciliation, type Scope3SpendParse, type Scope3SpendReconciliation } from './scope3-spend-import'
import { scope3SpendGroupKeyInput, scope3SpendIsGroupMapping, scope3SpendMappingKeyInputOf } from './scope3-spend-grouping'
import { validateCollectionSaveInput } from './collection-contract'
import { scope3SpendConversionReason, scope3SpendConvertAmount, scope3SpendNotesWithConversion, scope3SpendRateMatchesLineYear, validateScope3SpendConversionInput } from './scope3-spend-currency'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const SHA256 = /^[0-9a-f]{64}$/
export const scope3Sha256 = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex')
const problem = (message: string, code: string) => Object.assign(new Error(message), { code })

export interface Scope3SpendImportRecord {
  id: string; companyId: string; reportingYear: number; fileSha256: string; fileName: string; evidenceId: string; locationId: string; setupVersionId: string
  rowCount: number; fileTotals: Record<string, string>; nonNumericRows: number; createdBy: string; createdAt: string
  /** Each line as imported: its row, the record it saved and its fingerprint. */
  lines: Array<{ row: number; recordId: string; lineFingerprint: string }>
  /** File total = imported total per currency, from the lines' first revisions (what the import saved). */
  reconciliation: Scope3SpendReconciliation
}
export interface Scope3SpendMappingRecord {
  id: string; companyId: string; mappingKeySha256: string; glAccount: string; vendor: string; description: string
  category: number; naicsCode: string; marginChoice: 'with_margins' | 'without_margins'; revision: number; createdBy: string; createdAt: string
}

type ImportRow = { id: string; company_id: string; reporting_year: number; file_sha256: string; file_name: string; evidence_id: string; location_id: string; setup_version_id: string; row_count: number; file_totals: Record<string, string>; non_numeric_rows: number; created_by: string; created_at: string }
type LineRow = { import_id: string; row_number: number; line_fingerprint: string; record_id: string }
type FirstVersionRow = { record_id: string; original_quantity: string; original_unit: string }

/**
 * Round 3 (EN-1): the import read-backs, as plain single-table statements with no join. Round 2 joined each line to its
 * record's first version (`left join … on record_id … and revision=1`); with statistics that do not know a new company
 * the planner made that a nested loop scanning every one of the company's versions per line, with the SECURITY DEFINER
 * RLS function on each inner row (about N² calls: 18–31 s for 2,000 lines, past the 15 s statement timeout). Now each
 * statement reads one table by its company (and import) and the first versions are found by the unique
 * (record_id, revision) key through `record_id = any($2)`: linear whatever the statistics. Exported so the native test
 * can EXPLAIN exactly these statements.
 */
export const SCOPE3_SPEND_IMPORT_READBACK_SQL = {
  imports: `select id,company_id,reporting_year,file_sha256,file_name,evidence_id,location_id,setup_version_id,row_count,file_totals,non_numeric_rows,created_by,created_at::text created_at
    from neuvetra.scope3_spend_imports where company_id=$1 and ($2::uuid is null or id=$2) order by created_at,id`,
  lines: 'select import_id,row_number,line_fingerprint,record_id from neuvetra.scope3_spend_import_lines where company_id=$1 and import_id=any($2::uuid[]) order by import_id,row_number',
  versions: 'select record_id,original_quantity,original_unit from neuvetra.collection_activity_versions where company_id=$1 and record_id=any($2::uuid[]) and revision=1',
  order: 'select id,row_number() over (order by created_at,id) ord from neuvetra.scope3_spend_imports where company_id=$1',
} as const

/**
 * The company's imports, oldest first, each with its lines and reconciliation (only `importId` when given: the write
 * path's read-back of the import it just saved). Empty for a non-member.
 */
export async function readScope3SpendImports(tx: WorkspaceSql, companyId: string, importId: string | null = null): Promise<Scope3SpendImportRecord[]> {
  if (!UUID.test(companyId) || (importId !== null && !UUID.test(importId))) return []
  const imports = await tx.query<ImportRow>(SCOPE3_SPEND_IMPORT_READBACK_SQL.imports, [companyId, importId])
  if (imports.rows.length === 0) return []
  const lines = await tx.query<LineRow>(SCOPE3_SPEND_IMPORT_READBACK_SQL.lines, [companyId, imports.rows.map(row => row.id)])
  const firsts = await tx.query<FirstVersionRow>(SCOPE3_SPEND_IMPORT_READBACK_SQL.versions, [companyId, [...new Set(lines.rows.map(line => line.record_id))]])
  const first = new Map(firsts.rows.map(row => [row.record_id, row]))
  const byImport = new Map<string, LineRow[]>()
  for (const line of lines.rows) { const list = byImport.get(line.import_id); if (list) list.push(line); else byImport.set(line.import_id, [line]) }
  return imports.rows.map(row => {
    const mine = byImport.get(row.id) ?? []
    if (row.company_id !== companyId || mine.length !== row.row_count || mine.some((line, i) => line.row_number !== i + 1 || !first.has(line.record_id)))
      throw new Error('Scope 3 spend import integrity check failed.')
    return {
      id: row.id, companyId: row.company_id, reportingYear: row.reporting_year, fileSha256: row.file_sha256, fileName: row.file_name, evidenceId: row.evidence_id, locationId: row.location_id,
      setupVersionId: row.setup_version_id, rowCount: row.row_count, fileTotals: row.file_totals, nonNumericRows: row.non_numeric_rows, createdBy: row.created_by, createdAt: new Date(row.created_at).toISOString(),
      lines: mine.map(line => ({ row: line.row_number, recordId: line.record_id, lineFingerprint: line.line_fingerprint })),
      reconciliation: scope3SpendImportReconciliation(row.file_totals, row.non_numeric_rows, mine.map(line => { const v = first.get(line.record_id)!; return { amount: v.original_quantity, currency: v.original_unit } })),
    }
  })
}

/** The company's saved import lines in 0030's duplicate order (import time, import ID, row). Round 3 (EN-1): no join. */
export async function readScope3SpendImportLines(tx: WorkspaceSql, companyId: string): Promise<Array<{ importId: string; row: number; fingerprint: string; recordId: string }>> {
  if (!UUID.test(companyId)) return []
  const order = await tx.query<{ id: string; ord: string }>(SCOPE3_SPEND_IMPORT_READBACK_SQL.order, [companyId])
  if (order.rows.length === 0) return []
  const rank = new Map(order.rows.map(row => [row.id, Number(row.ord)]))
  const rows = await tx.query<LineRow>(SCOPE3_SPEND_IMPORT_READBACK_SQL.lines, [companyId, order.rows.map(row => row.id)])
  return rows.rows.filter(row => rank.has(row.import_id)).sort((a, b) => rank.get(a.import_id)! - rank.get(b.import_id)! || a.row_number - b.row_number)
    .map(row => ({ importId: row.import_id, row: row.row_number, fingerprint: row.line_fingerprint, recordId: row.record_id }))
}

type MappingRow = { id: string; company_id: string; mapping_key_sha256: string; gl_account: string; vendor: string; description: string; category: number; naics_code: string; margin_choice: 'with_margins' | 'without_margins'; revision: number; created_by: string; created_at: string }
const mapping = (row: MappingRow): Scope3SpendMappingRecord => ({ id: row.id, companyId: row.company_id, mappingKeySha256: row.mapping_key_sha256, glAccount: row.gl_account, vendor: row.vendor, description: row.description,
  category: row.category, naicsCode: row.naics_code, marginChoice: row.margin_choice, revision: row.revision, createdBy: row.created_by, createdAt: new Date(row.created_at).toISOString() })
const MAPPING_COLUMNS = 'id,company_id,mapping_key_sha256,gl_account,vendor,description,category,naics_code,margin_choice,revision,created_by,created_at::text created_at'

/**
 * BF-12b (QA F-1): remembered mappings by the key their own texts give TODAY. A group mapping's key is the SHA-256 of its
 * vendor-and-account key text (`scope3SpendMappingKeyInputOf`), and that text follows `scope3SpendVendorKey`; when the rule
 * changes (BF-12 kept combining marks: Devanagari, Thai, Turkish capital İ), a row saved earlier is still stored under its
 * old key. Each stored head is therefore read under the key its texts give now (`mappingKeySha256`), with the key it is
 * stored under (`storedKeySha256`), so the import, the screen and the save all find it; nothing stored is rewritten.
 * When two heads give the same key (the row saved under the old key and one saved later under the new key), the one stored
 * under the new key is used (it is the one saves reach), else the newest. Rows whose stored key is already today's key are
 * read exactly as before. Pure, so it is tested without a database.
 */
export function scope3SpendCanonicalMappingHeads(rows: readonly Scope3SpendMappingRecord[], sha256: (text: string) => string = scope3Sha256): Array<Scope3SpendMappingRecord & { storedKeySha256: string }> {
  const chosen = new Map<string, Scope3SpendMappingRecord & { storedKeySha256: string }>()
  for (const row of rows) {
    const key = sha256(scope3SpendMappingKeyInputOf(row)), candidate = { ...row, mappingKeySha256: key, storedKeySha256: row.mappingKeySha256 }
    const held = chosen.get(key)
    const better = !held || (held.storedKeySha256 !== key && (candidate.storedKeySha256 === key || candidate.createdAt > held.createdAt || (candidate.createdAt === held.createdAt && candidate.storedKeySha256 > held.storedKeySha256)))
    if (better) chosen.set(key, candidate)
  }
  return [...chosen.values()].sort((a, b) => a.mappingKeySha256 < b.mappingKeySha256 ? -1 : a.mappingKeySha256 > b.mappingKeySha256 ? 1 : 0)
}
async function readScope3SpendMappingHeads(tx: WorkspaceSql, companyId: string) {
  if (!UUID.test(companyId)) return []
  const rows = await tx.query<MappingRow>(`select ${MAPPING_COLUMNS} from neuvetra.scope3_spend_mapping_heads where company_id=$1 order by mapping_key_sha256`, [companyId])
  return scope3SpendCanonicalMappingHeads(rows.rows.map(mapping))
}
/** The latest revision of each remembered mapping, by the mapping key its texts give today (BF-12b). */
export async function readScope3SpendMappings(tx: WorkspaceSql, companyId: string): Promise<Scope3SpendMappingRecord[]> {
  return (await readScope3SpendMappingHeads(tx, companyId)).map(({ storedKeySha256: _stored, ...row }) => row)
}

async function checkActor(tx: WorkspaceSql, actorId: string, message: string) {
  const actor = await tx.query<{ id: string }>('select neuvetra.current_user_id() id')
  if (actor.rows[0]?.id !== actorId) throw problem(message, '42501')
}

/**
 * Imports a parsed file through `import_scope3_spend`, against the current setup version (its reporting period and
 * year), at one included setup location (A11), with the uploaded file as its evidence (same SHA-256, not rejected). The
 * file name is the evidence's. Mapping memory and the company's earlier lines are read in the same transaction.
 */
export async function importScope3SpendFile(tx: WorkspaceSql, actorId: string, companyId: string, input: { parsed: Scope3SpendParse; fileSha256: string; evidenceId: string; locationId: string }): Promise<{ import: Scope3SpendImportRecord; replayed: boolean; saved: number }> {
  if (!UUID.test(actorId) || !UUID.test(companyId)) throw new Error('Scope 3 spend import unavailable.')
  await checkActor(tx, actorId, 'Scope 3 spend import unavailable.')
  if (!input.parsed.ok) throw problem('The spend file has errors; nothing was imported.', '22023')
  if (!SHA256.test(input.fileSha256) || !UUID.test(input.evidenceId) || !UUID.test(input.locationId)) throw problem('Invalid Scope 3 spend import.', '22023')
  const head = (await tx.query<{ version_id: string; period_start: string | null; period_end_exclusive: string | null }>(`select h.version_id,v.period_start::text period_start,v.period_end_exclusive::text period_end_exclusive
    from neuvetra.company_setup_heads h join neuvetra.company_setup_versions v on v.id=h.version_id and v.company_id=h.company_id where h.company_id=$1`, [companyId])).rows[0]
  if (!head) throw problem('Save company setup before importing spend.', 'setup_required')
  const reportingYear = scope3ReportingYearOf(head.period_end_exclusive)
  if (!head.period_start || !head.period_end_exclusive || reportingYear === null) throw problem('Save company setup with a reporting period before importing spend.', 'setup_required')
  const location = (await tx.query<{ inclusion: string }>('select inclusion from neuvetra.company_setup_locations where company_id=$1 and version_id=$2 and id=$3', [companyId, head.version_id, input.locationId])).rows[0]
  if (!location || location.inclusion !== 'included') throw problem('Choose a location that company setup includes.', 'location_not_included')
  const evidence = (await readCollectionEvidence(tx, companyId)).find(file => file.id === input.evidenceId)
  if (!evidence || evidence.quarantineStatus === 'rejected' || evidence.sha256 !== input.fileSha256) throw problem('The uploaded file is not this company’s evidence with the same bytes.', 'evidence_mismatch')
  const [mappings, earlierLines] = await Promise.all([readScope3SpendMappings(tx, companyId), readScope3SpendImportLines(tx, companyId)])
  const built = buildScope3SpendImportRequest({ companyId, parsed: input.parsed, fileSha256: input.fileSha256, fileName: evidence.originalName, evidenceId: input.evidenceId, locationId: input.locationId,
    setupVersionId: head.version_id, reportingYear, reportingPeriod: { start: head.period_start, endExclusive: head.period_end_exclusive }, mappings, earlierLines, sha256: scope3Sha256 })
  const receipt = (await tx.query<{ import_id: string; replayed: boolean; saved: number }>('select * from neuvetra.import_scope3_spend($1,$2::text::jsonb)', [companyId, JSON.stringify(built.request)])).rows[0]
  if (!receipt) throw new Error('Scope 3 spend import returned no receipt.')
  // Round 3 (EN-1): only the import just saved (or replayed), read without joins.
  const saved = (await readScope3SpendImports(tx, companyId, receipt.import_id))[0]
  // A new import is exactly what was sent and reconciles; a replay is the earlier import of the same bytes.
  if (!saved || saved.fileSha256 !== input.fileSha256 || (!receipt.replayed && (saved.id !== built.request.importId || saved.rowCount !== built.request.rowCount || !saved.reconciliation.reconciled
    || saved.lines.some((line, i) => line.recordId !== built.request.rows[i]!.recordId || line.lineFingerprint !== built.request.rows[i]!.lineFingerprint)))) throw new Error('Scope 3 spend import could not be read back.')
  return { import: saved, replayed: receipt.replayed, saved: receipt.saved }
}

export interface Scope3SpendMappingSaveInput {
  expectedRevision: number
  /**
   * Round 2 UX-1: `group` maps every line of a vendor and GL account (scope3-spend-grouping.ts; description empty);
   * `line` (the default when the body has no scope) maps one line key, a per-line override that wins over its group.
   */
  scope: 'line' | 'group'
  mapping: { glAccount: string; vendor: string; description: string; category: number; naicsCode: string; marginChoice: 'with_margins' | 'without_margins' }
  /** Attestations applied to every corrected line of the group (never remembered: they are facts about each line). */
  categoryConfirmed: boolean | null
  activityOverlapConfirmed: boolean | null
}
const exactKeys = (value: unknown, keys: string[]) => !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join('|') === [...keys].sort().join('|')
/** Shape of a mapping save (the route's body). The database checks the rest (category set, code in the category's set). */
export function validateScope3SpendMappingSaveInput(value: unknown): Scope3SpendMappingSaveInput {
  const bad = () => { throw problem('Invalid Scope 3 spend mapping.', '22023') }
  const keys = ['expectedRevision', 'mapping', 'categoryConfirmed', 'activityOverlapConfirmed']
  if (!exactKeys(value, keys) && !exactKeys(value, [...keys, 'scope'])) bad()
  const v = value as Record<string, unknown>, m = v.mapping as Record<string, unknown>
  const scope = v.scope === undefined || v.scope === 'line' ? 'line' as const : v.scope === 'group' ? 'group' as const : bad()
  if (!Number.isInteger(v.expectedRevision) || (v.expectedRevision as number) < 0 || (v.expectedRevision as number) > 999) bad()
  if (!exactKeys(m, ['glAccount', 'vendor', 'description', 'category', 'naicsCode', 'marginChoice'])) bad()
  // BF-32: counted after NFC, and an over-long text is named (the limits are 0030's, which count characters of the stored, normalised text).
  const text = (x: unknown) => typeof x === 'string' && !/[\u0000-\u001f\u007f-\u009f]/u.test(x)
  if (text(m.glAccount)) limitedText(m.glAccount as string, 120, 'GL account')
  if (text(m.vendor)) limitedText(m.vendor as string, 200, 'Vendor')
  if (text(m.description)) limitedText(m.description as string, 200, 'Description')
  if (!text(m.glAccount) || !text(m.vendor) || !text(m.description) || !(SCOPE3_SPEND_IMPORT_CATEGORIES as readonly unknown[]).includes(m.category)
    || typeof m.naicsCode !== 'string' || !/^\d{6}$/.test(m.naicsCode) || !scope3SpendNaicsAllowed(m.category as number, m.naicsCode) || !['with_margins', 'without_margins'].includes(m.marginChoice as string)) bad()
  for (const flag of [v.categoryConfirmed, v.activityOverlapConfirmed]) if (flag !== null && typeof flag !== 'boolean') bad()
  // A group mapping is stored with an empty description and needs a vendor or an account; a line mapping a description.
  if (scope === 'group' ? m.description !== '' || scope3SpendGroupKeyInput({ glAccount: m.glAccount as string, supplierName: m.vendor as string }) === null : (m.description as string).trim() === '') bad()
  return { expectedRevision: v.expectedRevision as number, scope, mapping: { glAccount: (m.glAccount as string).normalize('NFC'), vendor: (m.vendor as string).normalize('NFC'), description: (m.description as string).normalize('NFC'),
    category: m.category as number, naicsCode: m.naicsCode as string, marginChoice: m.marginChoice as 'with_margins' | 'without_margins' }, categoryConfirmed: v.categoryConfirmed as boolean | null, activityOverlapConfirmed: v.activityOverlapConfirmed as boolean | null }
}

/**
 * The imported spend lines of one mapping group whose mapping the file did not state (unmatched, from memory, or set by
 * a mapping). Round 2 UX-1: for a `group` mapping, the lines of that vendor and GL account (scope3-spend-grouping.ts),
 * except lines that have their own remembered line mapping (a per-line override wins over its group).
 */
export function scope3SpendMappingGroup(records: readonly CollectionActivityRecord[], mappingKeySha256: string, sha256: (text: string) => string = scope3Sha256,
  options: { scope: 'line' | 'group'; lineKeysWithOwnMapping?: ReadonlySet<string> } = { scope: 'line' }): CollectionActivityRecord[] {
  return records.filter(record => {
    const a = record.currentVersion.activity
    if (a.kind !== 'purchase_spend' || a.state !== 'active') return false
    const p = a.payload as PurchaseSpendCollectionPayload
    if (p.importId === null || p.mappingSource === 'file') return false
    const lineKey = sha256(scope3SpendMappingKeyInput(p))
    if (options.scope === 'line') return lineKey === mappingKeySha256
    const group = scope3SpendGroupKeyInput(p)
    return group !== null && sha256(group) === mappingKeySha256 && !(options.lineKeysWithOwnMapping?.has(lineKey) ?? false)
  })
}

/**
 * Saves a mapping revision (owner or admin; optimistic revision per key) and corrects each line of its group to the
 * mapping, as one transaction: a line that cannot be corrected leaves the mapping unsaved too. Lines already equal to
 * the mapping (and the attestations) are left as they are.
 *
 * Round 2 (ENG-9): the group (computed here with the shared mapping key) goes to 0030's save_scope3_spend_mapping with the
 * head version each line was read at, and the database writes every correction in one set-based statement under the
 * company lock (no per-line saves). The corrected lines are read back and checked.
 */
export async function saveScope3SpendMapping(tx: WorkspaceSql, actorId: string, companyId: string, input: unknown): Promise<{ mapping: Scope3SpendMappingRecord; corrected: Array<{ recordId: string; versionId: string; revision: number }>; unchanged: number }> {
  if (!UUID.test(actorId) || !UUID.test(companyId)) throw new Error('Scope 3 spend mapping unavailable.')
  await checkActor(tx, actorId, 'Scope 3 spend mapping unavailable.')
  const valid = validateScope3SpendMappingSaveInput(input)
  const m = valid.mapping
  const mappingKeySha256 = scope3Sha256(scope3SpendMappingKeyInputOf(m))
  // Round 2 integration: lane C's group rule (UX-1) selects the lines; lane B's set-based save (ENG-9) writes them. A group
  // mapping corrects the vendor-and-account group's lines except those with their own (line) mapping, which always wins.
  const heads = await readScope3SpendMappingHeads(tx, companyId)
  const lineKeysWithOwnMapping = valid.scope === 'group' ? new Set(heads.filter(row => !scope3SpendIsGroupMapping(row)).map(row => row.mappingKeySha256)) : undefined
  const group = scope3SpendMappingGroup(await readCollectionActivities(tx, companyId), mappingKeySha256, scope3Sha256, { scope: valid.scope, lineKeysWithOwnMapping })
  // BF-12b (QA F-1): a mapping remembered under an earlier key for the same texts is revised under the key it is stored
  // under, with its own revision checked: the screen's expected revision applies to it, and no second remembered row
  // with the same texts can be created.
  const storedKeySha256 = heads.find(row => row.mappingKeySha256 === mappingKeySha256)?.storedKeySha256 ?? mappingKeySha256
  const request: Scope3SpendMappingRequest = { expectedRevision: valid.expectedRevision, mapping: { mappingKeySha256: storedKeySha256, glAccount: m.glAccount, vendor: m.vendor, description: m.description,
    category: m.category as Scope3SpendMappingRequest['mapping']['category'], naicsCode: m.naicsCode, marginChoice: m.marginChoice },
    corrections: group.map(record => ({ recordId: record.id, expectedVersionId: record.currentVersion.id })),
    attestations: { categoryConfirmed: valid.categoryConfirmed, activityOverlapConfirmed: valid.activityOverlapConfirmed } }
  const receipt = (await tx.query<{ mapping_id: string; revision: number; corrected: number; unchanged: number }>('select * from neuvetra.save_scope3_spend_mapping($1,$2::text::jsonb)', [companyId, JSON.stringify(request)])).rows[0]
  if (!receipt) throw new Error('Scope 3 spend mapping returned no receipt.')
  const savedRow = (await tx.query<MappingRow>(`select ${MAPPING_COLUMNS} from neuvetra.scope3_spend_mapping_versions where company_id=$1 and id=$2`, [companyId, receipt.mapping_id])).rows[0]
  if (!savedRow || savedRow.revision !== receipt.revision || savedRow.mapping_key_sha256 !== storedKeySha256 || savedRow.naics_code !== m.naicsCode || savedRow.category !== m.category || savedRow.created_by !== actorId) throw new Error('Scope 3 spend mapping could not be read back.')
  // Read back: every listed line is at its read version (unchanged) or one revision later with exactly the mapping.
  const before = new Map(group.map(record => [record.id, record]))
  const corrected: Array<{ recordId: string; versionId: string; revision: number }> = []
  let unchanged = 0
  for (const record of (await readCollectionActivities(tx, companyId)).filter(item => before.has(item.id))) {
    const old = before.get(record.id)!, version = record.currentVersion, p = version.activity.payload as PurchaseSpendCollectionPayload
    if (version.id === old.currentVersion.id) { unchanged++; continue }
    if (version.revision !== old.currentVersion.revision + 1 || version.previousVersionId !== old.currentVersion.id || p.naicsCode !== m.naicsCode || p.category !== m.category || p.marginChoice !== m.marginChoice || p.mappingSource !== 'user'
      || version.correctionReason !== `Mapped to NAICS ${m.naicsCode} (category ${m.category}, ${m.marginChoice.replace('_', ' ')}) by spend mapping revision ${receipt.revision}.`) throw new Error('Scope 3 spend mapping could not be read back.')
    corrected.push({ recordId: record.id, versionId: version.id, revision: version.revision })
  }
  if (corrected.length !== receipt.corrected || unchanged !== receipt.unchanged || corrected.length + unchanged !== group.length) throw new Error('Scope 3 spend mapping could not be read back.')
  corrected.sort((a, b) => a.recordId.localeCompare(b.recordId))
  return { mapping: { ...mapping(savedRow), mappingKeySha256 }, corrected, unchanged }
}

/**
 * Round 3 (owner decision 7, EN-3): "withdraw this import" (owner or admin). Every line of the import that is still active
 * gets a withdrawn version with the reason given, in one set-based statement under the company lock (0030's
 * withdraw_scope3_spend_import); lines already withdrawn stay as they are. Body: exactly `{ reason }` (3–2,000 characters).
 */
export async function withdrawScope3SpendImport(tx: WorkspaceSql, actorId: string, companyId: string, importId: string, input: unknown): Promise<{ importId: string; withdrawn: number; alreadyWithdrawn: number }> {
  if (!UUID.test(actorId) || !UUID.test(companyId) || !UUID.test(importId)) throw problem('Invalid Scope 3 spend import withdrawal.', '22023')
  if (!exactKeys(input, ['reason'])) throw problem('Invalid Scope 3 spend import withdrawal.', '22023')
  const reason = (input as { reason: unknown }).reason
  if (typeof reason !== 'string' || reason.trim().length < 3 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(reason)) throw problem('Say why this import is withdrawn (at least 3 characters).', '22023')
  const normalizedReason = limitedText(reason, 2000, 'Withdrawal reason', 'reason')
  await checkActor(tx, actorId, 'Scope 3 spend import withdrawal unavailable.')
  const row = (await tx.query<{ import_id: string; withdrawn: number; already_withdrawn: number }>('select * from neuvetra.withdraw_scope3_spend_import($1,$2::text::jsonb)', [companyId, JSON.stringify({ importId, reason: normalizedReason })])).rows[0]
  if (!row || row.import_id !== importId) throw new Error('Scope 3 spend import withdrawal returned no receipt.')
  return { importId: row.import_id, withdrawn: row.withdrawn, alreadyWithdrawn: row.already_withdrawn }
}

/**
 * Round 3 (for lane C's bulk actions, e.g. a currency conversion applied to every held line in one currency): corrects
 * imported spend lines in bulk (owner or admin) through 0030's save_scope3_spend_corrections, in one set-based statement
 * under the company lock. Each correction names the line, the head version it was read at (a changed line refuses the whole
 * save, 23505) and its next activity, which must keep the line's identity (kind, import ID and row, source ID; else 22023)
 * and pass the activity contract (validated here first, then by SQL). Lines whose activity is unchanged are left as they
 * are. One correction reason for all.
 */
export async function saveScope3SpendCorrections(tx: WorkspaceSql, actorId: string, companyId: string, input: { reason: string; corrections: Array<{ recordId: string; expectedVersionId: string; activity: unknown }> }): Promise<{ corrected: number; unchanged: number }> {
  if (!UUID.test(actorId) || !UUID.test(companyId)) throw problem('Invalid Scope 3 spend corrections.', '22023')
  if (typeof input.reason !== 'string' || input.reason.trim().length < 3 || !Array.isArray(input.corrections) || input.corrections.length < 1 || input.corrections.length > 3000
    || input.corrections.some(item => !exactKeys(item, ['recordId', 'expectedVersionId', 'activity']) || !UUID.test(item.recordId) || !UUID.test(item.expectedVersionId))) throw problem('Invalid Scope 3 spend corrections.', '22023')
  limitedText(input.reason, 2000, 'Correction reason', 'correctionReason')
  const corrections = input.corrections.map(item => ({ recordId: item.recordId, expectedVersionId: item.expectedVersionId, activity: validateCollectionActivityForSave(item.activity) }))
  await checkActor(tx, actorId, 'Scope 3 spend corrections unavailable.')
  const row = (await tx.query<{ corrected: number; unchanged: number }>('select * from neuvetra.save_scope3_spend_corrections($1,$2::text::jsonb)', [companyId, JSON.stringify({ reason: input.reason.normalize('NFC'), corrections })])).rows[0]
  if (!row) throw new Error('Scope 3 spend corrections returned no receipt.')
  return { corrected: row.corrected, unchanged: row.unchanged }
}

/**
 * Round 3 lane C (PR-11): converts every active imported spend line in one currency to US dollars at the user's rate, in
 * the caller's one transaction, through the existing record-save RPC (`save_collection_activity`, owner or admin; one
 * correction per line against the version read here). A line whose amount is not a plain positive number (a credit, text)
 * is skipped and listed, and so is a line whose calendar year is not the rate date's (BF-14, `rate_date_outside_line_year`). The lines are read back once at the end and checked. No new SQL: the integrator may later move
 * this to a set-based 0030 statement (see the round 3 lane C log).
 */
export async function convertScope3SpendCurrency(tx: WorkspaceSql, actorId: string, companyId: string, input: unknown): Promise<{
  converted: Array<{ recordId: string; sourceId: string; versionId: string; revision: number; from: string; usd: string }>; skipped: Array<{ recordId: string; sourceId: string; reason: string }> }> {
  if (!UUID.test(actorId) || !UUID.test(companyId)) throw new Error('Scope 3 currency conversion unavailable.')
  await checkActor(tx, actorId, 'Scope 3 currency conversion unavailable.')
  const conversion = validateScope3SpendConversionInput(input)
  // Bug hunt (PR 22, 1 November 2026): each converted line is saved against the current setup version, as every correction
  // is (save_collection_activity requires it); a line imported before the latest setup save kept its old version and the
  // conversion was refused (23503) for good.
  const setupHead = (await tx.query<{ version_id: string }>('select version_id from neuvetra.company_setup_heads where company_id=$1', [companyId])).rows[0]?.version_id
  if (!setupHead) throw problem('Save company setup before converting spend.', 'setup_required')
  const lines = (await readCollectionActivities(tx, companyId)).filter(record => {
    const a = record.currentVersion.activity, p = a.payload as PurchaseSpendCollectionPayload
    return record.kind === 'purchase_spend' && a.state === 'active' && p.importId !== null && a.quantity.originalUnit === conversion.currency
  }).sort((x, y) => x.currentVersion.activity.sourceId.localeCompare(y.currentVersion.activity.sourceId) || x.id.localeCompare(y.id))
  const planned: Array<{ record: CollectionActivityRecord; from: string; usd: string }> = []
  const skipped: Array<{ recordId: string; sourceId: string; reason: string }> = []
  for (const record of lines) {
    const written = record.currentVersion.activity.quantity.originalValue.trim()
    if (!/^(0|[1-9][0-9]{0,11})(\.[0-9]{1,3})?$/.test(written)) { skipped.push({ recordId: record.id, sourceId: record.currentVersion.activity.sourceId, reason: written.startsWith('-') ? 'negative_amount_not_supported' : 'amount_not_a_number' }); continue }
    // BF-14 (audit B-5), after the amount checks so a credit is reported as a credit in any year: one rate is never applied across
    // years. Only a line of the rate date's own calendar year is converted; any other line of the currency (or one whose year is unknown:
    // no date and a period crossing years) is listed and stays held in its own currency, to be converted at a rate dated in its own year.
    const a = record.currentVersion.activity
    if (!scope3SpendRateMatchesLineYear({ lineDate: (a.payload as PurchaseSpendCollectionPayload).lineDate, period: a.period }, conversion.rateDate)) { skipped.push({ recordId: record.id, sourceId: a.sourceId, reason: 'rate_date_outside_line_year' }); continue }
    planned.push({ record, from: written, usd: scope3SpendConvertAmount(written, conversion.rate) })
  }
  for (const { record, from, usd } of planned) {
    const version = record.currentVersion, a = version.activity
    const full = { ...conversion, amount: from, usd }
    const request = validateCollectionSaveInput({ idempotencyKey: crypto.randomUUID(), expectedRevision: version.revision, expectedVersionId: version.id, correctionReason: scope3SpendConversionReason(full),
      activity: { ...a, setupVersionId: setupHead, quantity: { originalValue: usd, originalUnit: 'USD', normalizedValue: usd, normalizedUnit: 'USD' }, notes: scope3SpendNotesWithConversion(a.notes, full) } })
    const receipt = (await tx.query<{ record_id: string; version_id: string; replayed: boolean }>('select * from neuvetra.save_collection_activity($1,$2,$3::text::jsonb)', [companyId, record.id, JSON.stringify(request)])).rows[0]
    if (!receipt || receipt.record_id !== record.id || receipt.replayed) throw new Error('Scope 3 currency conversion returned no receipt.')
  }
  // Read back once: each converted line is one revision later, in US dollars, with exactly the planned amount.
  const after = new Map((await readCollectionActivities(tx, companyId)).map(record => [record.id, record]))
  const converted = planned.map(({ record, from, usd }) => {
    const now = after.get(record.id)!.currentVersion
    if (now.revision !== record.currentVersion.revision + 1 || now.previousVersionId !== record.currentVersion.id || now.activity.quantity.originalUnit !== 'USD' || now.activity.quantity.originalValue !== usd) throw new Error('Scope 3 currency conversion could not be read back.')
    return { recordId: record.id, sourceId: now.activity.sourceId, versionId: now.id, revision: now.revision, from, usd }
  })
  return { converted, skipped }
}
